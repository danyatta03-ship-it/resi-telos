// Consultazione di un singolo invio, e risposta di chi lo ha mandato.
//
// GET  /api/portal-status?ref=RS-XXXXXX   → stato di QUEL solo invio
// POST /api/portal-status                 → aggiunge un messaggio a QUEL invio
//
// Non esiste nessun endpoint che elenchi gli invii: chi ha un riferimento
// legge il proprio e nient'altro, e i riferimenti sono casuali su 27^6
// combinazioni (~387 milioni), quindi non si trovano tentando.
//
// La risposta e' volutamente PARZIALE: niente IP, niente flag interni, e le
// foto non tornano indietro (pesano e chi le ha caricate le ha gia'). Chi
// consulta vede quello che gli serve per sapere a che punto e' la pratica.

const { getAdmin, corsHeaders, json } = require('./lib/admin');

const REF_RE = /^RS-[A-Z0-9]{6,10}$/;
const MAX_MESSAGGIO = 2000;

// Stesso spirito del rate limit sull'invio: ferma il doppio-click e lo
// script banale, non un avversario determinato.
const FINESTRA_MS = 10 * 60 * 1000;
const MAX_LETTURE = 120;
const MAX_MESSAGGI = 20;
const contatori = new Map();

function troppe(ip, chiave, tetto) {
  const k = chiave + '|' + ip;
  const ora = Date.now();
  const lista = (contatori.get(k) || []).filter((t) => ora - t < FINESTRA_MS);
  if (lista.length >= tetto) {
    contatori.set(k, lista);
    return true;
  }
  lista.push(ora);
  contatori.set(k, lista);
  if (contatori.size > 800) {
    for (const [key, v] of contatori) {
      if (!v.some((t) => ora - t < FINESTRA_MS)) contatori.delete(key);
    }
  }
  return false;
}

function clientIp(event) {
  const h = event.headers || {};
  return String(h['x-nf-client-connection-ip'] || h['x-forwarded-for'] || '')
    .split(',')[0].trim() || 'sconosciuto';
}

exports.handler = async (event) => {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
  const H = corsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: H, body: '' };

  let fb;
  try {
    fb = getAdmin();
  } catch (e) {
    return json(503, { error: 'Servizio non configurato.' }, H);
  }

  if (event.httpMethod === 'GET') return leggi(fb, event, H);
  if (event.httpMethod === 'POST') return rispondi(fb, event, H);
  return json(405, { error: 'Metodo non consentito' }, H);
};

async function leggi(fb, event, H) {
  const ref = String((event.queryStringParameters || {}).ref || '').trim().toUpperCase();
  if (!REF_RE.test(ref)) return json(400, { error: 'Riferimento non valido.' }, H);
  if (troppe(clientIp(event), 'get', MAX_LETTURE)) {
    return json(429, { error: 'Troppe richieste. Attendi qualche minuto.' }, H);
  }

  let snap;
  try {
    snap = await fb.database().ref('portal_submissions/' + ref).once('value');
  } catch (e) {
    return json(503, { error: 'Non riesco a leggere. Riprova fra poco.' }, H);
  }

  const d = snap.val();
  if (!d) return json(404, { error: 'Nessun invio con questo riferimento.' }, H);

  return json(200, pubblico(d), H);
}

// Cosa esce davvero dal server. Tutto il resto — ip, letto, note interne
// dell'operatore — resta dentro.
function pubblico(d) {
  const messaggi = [];
  const src = d.messaggi || {};
  for (const id in src) {
    const m = src[id];
    if (!m || !m.testo) continue;
    messaggi.push({
      ts: m.ts || 0,
      da: m.da === 'TELOS' ? 'TELOS' : 'MITTENTE',
      autore: String(m.autore || '').slice(0, 120),
      testo: String(m.testo).slice(0, MAX_MESSAGGIO)
    });
  }
  messaggi.sort((a, b) => a.ts - b.ts);

  return {
    ref: d.ref,
    ts: d.ts || 0,
    stato: d.stato || 'NUOVO',
    causale: d.causale || '',
    note: d.note || '',
    codiceCliente: d.codiceCliente || '',
    esito: d.esito || '',
    mittente: {
      nome: (d.mittente && d.mittente.nome) || '',
      azienda: (d.mittente && d.mittente.azienda) || ''
    },
    articoli: Array.isArray(d.articoli) ? d.articoli : [],
    nFoto: Array.isArray(d.foto) ? d.foto.length : 0,
    messaggi
  };
}

async function rispondi(fb, event, H) {
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Dati non validi.' }, H);
  }

  const ref = String(body.ref || '').trim().toUpperCase();
  const testo = String(body.testo || '').replace(/\s+/g, ' ').trim().slice(0, MAX_MESSAGGIO);
  const autore = String(body.autore || '').replace(/\s+/g, ' ').trim().slice(0, 120);

  if (!REF_RE.test(ref)) return json(400, { error: 'Riferimento non valido.' }, H);
  if (!testo) return json(400, { error: 'Il messaggio e\' vuoto.' }, H);
  if (troppe(clientIp(event), 'post', MAX_MESSAGGI)) {
    return json(429, { error: 'Troppi messaggi ravvicinati. Attendi qualche minuto.' }, H);
  }

  const db = fb.database();
  let esiste;
  try {
    esiste = await db.ref('portal_submissions/' + ref + '/ts').once('value');
  } catch (e) {
    return json(503, { error: 'Non riesco a scrivere. Riprova fra poco.' }, H);
  }
  if (!esiste.exists()) return json(404, { error: 'Nessun invio con questo riferimento.' }, H);

  const id = 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  try {
    await db.ref('portal_submissions/' + ref + '/messaggi/' + id).set({
      ts: Date.now(),
      da: 'MITTENTE',
      autore: autore || 'Mittente',
      testo
    });
    // Un messaggio nuovo rimette la pratica fra quelle da guardare.
    await db.ref('portal_submissions/' + ref + '/letto').set(false);
  } catch (e) {
    return json(503, { error: 'Messaggio non registrato. Riprova.' }, H);
  }

  return json(200, { ok: true }, H);
}

exports.__test__ = { pubblico, REF_RE };
