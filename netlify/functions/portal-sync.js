// Costruisce le proiezioni per i ruoli esterni.
//
// PERCHE' SERVE
// Le regole RTDB non sanno filtrare un elenco: su returns/ l'accesso e'
// tutto-o-niente. Se dessimo a un cliente il permesso di leggere returns/,
// leggerebbe TUTTI i resi di TUTTI i clienti — anche filtrando lato UI, i
// dati gli sarebbero comunque arrivati.
//
// Questa function ribalta il problema: legge returns/ con privilegi di
// servizio e scrive, per ciascuno scope, una copia contenente SOLO le righe
// di competenza e SOLO i campi ammessi a quel ruolo. Un cliente legge il suo
// ramo e nient'altro; nel suo ramo non esiste fisicamente nulla che non debba
// vedere.
//
// Scrive anche portal_access/<uid>/<returnKey> = true, l'indice su cui le
// regole autorizzano timeline, messaggi e documenti di quella pratica.
//
// INVOCAZIONE
//   • schedulata (netlify.toml) ogni 10 minuti
//   • manuale via POST da un ADMIN, per un allineamento immediato
//
// Il gestionale NON viene toccato: qui si legge returns/ e basta.

const { getAdmin, corsHeaders, json, requireRole, safeKey } = require('./_portal-admin');

// Deve restare allineato a portal/js/domain/roles.js → VISIBLE_FIELDS.
// Se i due divergono, il portale mostra campi vuoti (o, peggio, ne pubblica
// di non previsti): sono le due meta' della stessa decisione.
const FIELDS = {
  client: [
    '_key', '_ts', 'cod', 'pre', 'qty', 'forn', 'sogg', 'causale',
    'fase', 'stato', 'datArr', 'datSta', 'vetRic', 'vetUsc', 'rma',
    'colli', 'tipoImb', 'trackingState', 'trackingTs'
  ],
  agent: [
    '_key', '_ts', 'cod', 'pre', 'qty', 'prc', 'forn', 'sogg', 'agente',
    'causale', 'anomalia', 'fase', 'stato', 'datArr', 'datSta', 'vetRic',
    'vetUsc', 'rma', 'colli', 'tipoImb', 'trackingState', 'trackingTs'
  ],
  courier: [
    '_key', '_ts', 'cod', 'qty', 'sogg', 'fase', 'stato', 'vetRic', 'vetUsc',
    'colli', 'tipoImb', 'datArr', 'trackingState', 'trackingTs'
  ]
};

// Quanto indietro guardare. I resi chiusi da mesi non servono nel portale e
// moltiplicherebbero il volume delle proiezioni.
const MAX_AGE_DAYS = Number(process.env.PORTAL_SYNC_MAX_AGE_DAYS || 400);
const MAX_ROWS = Number(process.env.PORTAL_SYNC_MAX_ROWS || 6000);

exports.handler = async (event) => {
  const reqOrigin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
  const H = corsHeaders(reqOrigin);

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: H, body: '' };

  // Netlify invoca le function schedulate senza header di autenticazione.
  const isScheduled = !!(event.headers && event.headers['x-nf-event'] === 'schedule')
    || (event.body && String(event.body).indexOf('"next_run"') >= 0);

  let fb;
  try {
    fb = getAdmin();
  } catch (e) {
    return json(503, { error: e.message }, H);
  }

  try {
    if (!isScheduled) {
      if (event.httpMethod !== 'POST') return json(405, { error: 'Metodo non consentito' }, H);
      await requireRole(event, ['ADMIN', 'TELOS']);
    }
    const result = await runSync(fb);
    return json(200, Object.assign({ ok: true }, result), H);
  } catch (err) {
    const code = err.statusCode || 500;
    return json(code, { error: err.message || 'Sincronizzazione fallita.' }, H);
  }
};

async function runSync(fb) {
  const started = Date.now();
  const db = fb.database();

  const [returnsSnap, usersSnap] = await Promise.all([
    db.ref('returns').once('value'),
    db.ref('portal_users').once('value')
  ]);

  const returns = returnsSnap.val() || {};
  const users = usersSnap.val() || {};
  const cutoff = Date.now() - MAX_AGE_DAYS * 86400000;

  // Chi puo' vedere cosa. Costruisco gli indici in memoria e scrivo una volta
  // sola: RTDB soffre migliaia di scritture puntuali.
  const viewClient = {};
  const viewAgent = {};
  const viewCourier = {};

  let considered = 0;
  let skipped = 0;

  const keys = Object.keys(returns);
  // I piu' recenti per primi: se sbatto contro MAX_ROWS voglio aver tenuto
  // quelli che contano.
  keys.sort((a, b) => (returns[b] && returns[b]._ts || 0) - (returns[a] && returns[a]._ts || 0));

  for (const key of keys) {
    if (considered >= MAX_ROWS) break;
    const row = returns[key];
    if (!row || typeof row !== 'object') continue;

    const ts = Number(row._ts) || 0;
    if (ts && ts < cutoff) { skipped++; continue; }

    considered++;
    const enriched = Object.assign({}, row, {
      _key: row._key || key,
      trackingState: deriveState(row),
      trackingTs: ts || Date.now(),
      _syncTs: started
    });

    const clientCode = extractClientCode(row.sogg);
    if (clientCode) {
      const scopeId = safeKey(clientCode);
      (viewClient[scopeId] = viewClient[scopeId] || {})[key] = project(enriched, FIELDS.client);
    }

    if (row.agente) {
      const scopeId = safeKey(row.agente);
      if (scopeId) (viewAgent[scopeId] = viewAgent[scopeId] || {})[key] = project(enriched, FIELDS.agent);
    }

    // Un reso puo' avere un vettore in ingresso e uno in uscita, spesso
    // diversi: entrambi devono poterlo vedere.
    for (const field of ['vetRic', 'vetUsc']) {
      const raw = row[field];
      if (!raw) continue;
      // "CIPI/PIEMME" indica due vettori: assegno a entrambi.
      for (const part of String(raw).split('/')) {
        const scopeId = safeKey(part);
        if (!scopeId) continue;
        (viewCourier[scopeId] = viewCourier[scopeId] || {})[key] = project(enriched, FIELDS.courier);
      }
    }
  }

  // portal_access: da scope a utente. Le regole di timeline/messaggi/documenti
  // interrogano questo indice.
  const access = {};
  for (const uid in users) {
    const u = users[uid];
    if (!u || u.active === false) continue;
    const role = u.role;
    if (role === 'ADMIN' || role === 'TELOS') continue;
    const scopeKeys = u.scope ? Object.keys(u.scope).filter((k) => u.scope[k] === true) : [];
    if (!scopeKeys.length) continue;

    const source = role === 'CLIENTE' ? viewClient : role === 'AGENTE' ? viewAgent : role === 'CORRIERE' ? viewCourier : null;
    if (!source) continue;

    const grants = {};
    for (const rawScope of scopeKeys) {
      const bucket = source[safeKey(rawScope)];
      if (!bucket) continue;
      for (const returnKey in bucket) grants[returnKey] = true;
    }
    access[uid] = grants;
  }

  // Scrittura atomica per ramo. Sostituisco l'intero nodo: cosi' un reso che
  // esce dal perimetro (cliente riassegnato, vettore cambiato) sparisce
  // davvero, invece di restare visibile per sempre.
  await Promise.all([
    db.ref('portal_view/client').set(viewClient),
    db.ref('portal_view/agent').set(viewAgent),
    db.ref('portal_view/courier').set(viewCourier),
    db.ref('portal_access').set(access)
  ]);

  const counters = await computeCounters(db);
  await db.ref('portal_counters/staff').set(counters);

  const stats = {
    ts: started,
    durationMs: Date.now() - started,
    returnsTotal: keys.length,
    returnsSynced: considered,
    returnsSkipped: skipped,
    clientScopes: Object.keys(viewClient).length,
    agentScopes: Object.keys(viewAgent).length,
    courierScopes: Object.keys(viewCourier).length,
    usersGranted: Object.keys(access).length,
    counters
  };
  await db.ref('portal_sync_meta').set(stats);

  return stats;
}

// Quante cose arrivate dall'esterno aspettano una risposta di Telos.
// Alimenta il badge sul pulsante del portale dentro il gestionale, che gira
// con auth anonima e quindi non puo' leggere i nodi veri: legge solo questi
// numeri aggregati.
async function computeCounters(db) {
  const [reqSnap, timelineSnap, msgSnap] = await Promise.all([
    db.ref('portal_requests').once('value'),
    db.ref('portal_timeline').once('value'),
    db.ref('portal_messages').once('value')
  ]);

  const requests = reqSnap.val() || {};
  let pending = 0;
  for (const id in requests) {
    const r = requests[id];
    if (r && (r.state === 'INVIATA' || r.state === 'IN_ESAME')) pending++;
  }

  // Contestazioni ancora aperte: l'ultimo cambio di stato dice CONTESTATO.
  const timeline = timelineSnap.val() || {};
  let contested = 0;
  for (const key in timeline) {
    const events = timeline[key] || {};
    let lastTs = 0;
    let lastTo = '';
    for (const id in events) {
      const e = events[id];
      if (e && e.action === 'STATE_CHANGE' && e.to && (e.ts || 0) >= lastTs) {
        lastTs = e.ts || 0;
        lastTo = e.to;
      }
    }
    if (lastTo === 'CONTESTATO') contested++;
  }

  // Messaggi scritti da ruoli esterni nelle ultime 72 ore. Non sappiamo se un
  // operatore li ha letti — quel dato e' per-utente e vive nel portale — ma
  // come segnale di "c'e' movimento" e' onesto e non richiede stato aggiuntivo.
  const cutoff = Date.now() - 72 * 3600 * 1000;
  const threads = msgSnap.val() || {};
  let messages = 0;
  for (const key in threads) {
    const thread = threads[key] || {};
    for (const id in thread) {
      const m = thread[id];
      if (!m || (m.ts || 0) < cutoff) continue;
      if (m.fromRole === 'CLIENTE' || m.fromRole === 'AGENTE' || m.fromRole === 'CORRIERE') messages++;
    }
  }

  return {
    pending,
    contested,
    messages,
    total: pending + contested + messages,
    ts: Date.now()
  };
}

function project(row, fields) {
  const out = {};
  for (const f of fields) {
    const v = row[f];
    if (v !== undefined && v !== null && v !== '') out[f] = v;
  }
  return out;
}

// Il gestionale scrive sogg come "007183 - AUTOFFICINA ROSSI" oppure solo
// come ragione sociale. Il codice, quando c'e', e' l'aggancio affidabile.
function extractClientCode(sogg) {
  const raw = String(sogg || '').trim();
  if (!raw) return '';
  const m = /^(\d{4,8})\b/.exec(raw);
  return m ? m[1] : '';
}

// Stessa logica di portal/js/domain/workflow.js → deriveFromGestionale.
function deriveState(row) {
  const fase = String(row.fase || '').toUpperCase().trim();
  const stato = String(row.stato || '').toUpperCase().trim();
  if (fase === 'FINALE') return stato.indexOf('NON RENDIBILE') >= 0 ? 'CHIUSO_NR' : 'CHIUSO_OK';
  if (fase === 'MAGAZZINO') return 'IN_LAVORAZIONE';
  if (fase === 'UFFICIO RESI') return 'IN_VERIFICA';
  if (fase === 'RICEVIMENTO') return 'CONSEGNATO';
  return 'RICHIESTO';
}
