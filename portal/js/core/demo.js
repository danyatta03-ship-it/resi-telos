// MODALITA' DEMO — per provare il portale senza configurare nulla.
//
// Installa un finto SDK Firebase con un database in memoria, popolato di dati
// realistici. Tutto il resto dell'applicazione non sa di essere in demo:
// gira sullo stesso identico codice che usera' in produzione.
//
// SICUREZZA: la demo non tocca Firebase e non ha accesso a dati veri. Non
// indebolisce nulla in produzione, perche' si attiva solo con ?demo nell'URL
// o premendo un pulsante nella schermata di accesso. Un utente che non sa
// della sua esistenza non ci finisce dentro per sbaglio.
//
// Per disattivarla del tutto quando il portale va in produzione, imposta
// portal_config/flags/demoDisabled = true da Admin, oppure rimuovi questo
// file e l'import in app.js.

const KEY = 'portal_demo_role';

export function isDemo() {
  try {
    if (/[?&]demo\b/.test(location.search) || /[?&]demo\b/.test(location.hash)) return true;
    return !!sessionStorage.getItem(KEY);
  } catch (e) {
    return false;
  }
}

export function demoRole() {
  try {
    return sessionStorage.getItem(KEY) || 'CLIENTE';
  } catch (e) {
    return 'CLIENTE';
  }
}

export function startDemo(role) {
  try { sessionStorage.setItem(KEY, role); } catch (e) { /* private mode */ }
  // Ricarico: il finto SDK va installato prima che i moduli si aggancino.
  location.hash = '#/';
  location.reload();
}

export function stopDemo() {
  try { sessionStorage.removeItem(KEY); } catch (e) { /* private mode */ }
  location.href = location.pathname;
}

// ── Dati di esempio ─────────────────────────────────────────────────────
// Volutamente verosimili: codici Bosch reali, clienti nel formato del
// gestionale ("007183 - RAGIONE SOCIALE"), vettori usati davvero da Telos.

const DAY = 86400000;
const now = Date.now();

function ret(o) {
  return Object.assign({
    _ts: now - 5 * DAY,
    qty: 1,
    sogg: '007183 - AUTOFFICINA ROSSI SNC',
    vetRic: 'PIEMME',
    trackingTs: now - 5 * DAY
  }, o);
}

const RETURNS = {
  d1: ret({
    _key: 'd1', cod: '0986444981', pre: 'BOS', forn: 'BOSCH', qty: 1,
    causale: 'GARANZIA', fase: 'UFFICIO RESI', stato: 'DA GESTIRE ⏳',
    datArr: isoDaysAgo(6), rma: 'RMA-24118', prc: '120.00',
    agente: 'Direzionali Torino', trackingState: 'IN_VERIFICA',
    _ts: now - 6 * DAY, trackingTs: now - 4 * DAY
  }),
  d2: ret({
    _key: 'd2', cod: '0986435441', pre: 'BOS', forn: 'BOSCH', qty: 2,
    causale: 'ERRATA SPEDIZIONE', fase: 'MAGAZZINO', stato: 'CHIUDERE',
    datArr: isoDaysAgo(14), rma: 'RMA-24090', prc: '40.00', colli: 1,
    tipoImb: 'SCATOLA', vetUsc: 'CIPI/PIEMME', agente: 'Direzionali Torino',
    trackingState: 'IN_LAVORAZIONE', _ts: now - 14 * DAY, trackingTs: now - 11 * DAY
  }),
  d3: ret({
    _key: 'd3', cod: '91829', pre: 'HOF', forn: 'MOVIDIS', qty: 1,
    causale: 'CARCASSA', fase: 'FINALE', stato: 'NOTA CREDITO FORNITORE',
    datArr: isoDaysAgo(30), prc: '59.41', agente: 'Direzionali Torino',
    trackingState: 'CHIUSO_OK', _ts: now - 30 * DAY, trackingTs: now - 3 * DAY
  }),
  d4: ret({
    _key: 'd4', cod: 'BKR6E-11', pre: 'NGK', forn: 'NGK', qty: 4,
    causale: 'ORDINE DISDETTO CLIENTE', fase: 'RICEVIMENTO', stato: 'DA GESTIRE ⏳',
    datArr: isoDaysAgo(2), prc: '3.90', agente: 'Direzionali Torino',
    trackingState: 'CONSEGNATO', _ts: now - 2 * DAY, trackingTs: now - 2 * DAY
  }),
  d5: ret({
    _key: 'd5', cod: '1987432001', pre: 'BOS', forn: 'BOSCH', qty: 1,
    causale: 'DIVERSO DA OE/INCOMPATIBILE', fase: 'FINALE',
    stato: 'NON RENDIBILE - FUORI TEMPISTICA', datArr: isoDaysAgo(70),
    prc: '18.50', agente: 'Direzionali Torino',
    trackingState: 'CHIUSO_NR', _ts: now - 70 * DAY, trackingTs: now - 20 * DAY
  }),
  d6: ret({
    _key: 'd6', cod: 'LS1892', pre: 'VAL', forn: 'VALEO', qty: 1,
    sogg: '334722 - CARROZZERIA VERDI SRL', causale: 'DANNEGGIATO - SEGNALATO AL BANCO',
    fase: 'UFFICIO RESI', stato: 'ANOMALIA UFFICIO', datArr: isoDaysAgo(9),
    prc: '76.00', vetRic: 'CITYLINE', agente: 'Direzionali Cuneo',
    trackingState: 'CONTESTATO', _ts: now - 9 * DAY, trackingTs: now - 1 * DAY
  }),
  d7: ret({
    _key: 'd7', cod: '0092S40080', pre: 'BOS', forn: 'BOSCH', qty: 1,
    sogg: '334722 - CARROZZERIA VERDI SRL', causale: 'GARANZIA',
    fase: 'RICEVIMENTO', stato: 'OK PER UFFICIO', datArr: isoDaysAgo(1),
    prc: '95.00', vetRic: 'CITYLINE', agente: 'Direzionali Cuneo',
    trackingState: 'ATTESA_RITIRO', _ts: now - 1 * DAY, trackingTs: now - 1 * DAY
  })
};

function isoDaysAgo(n) {
  return new Date(now - n * DAY).toISOString().slice(0, 10);
}

const PROFILES = {
  CLIENTE: {
    uid: 'demo-cliente', email: 'demo.cliente@officina.it', displayName: 'Marco Bianchi',
    role: 'CLIENTE', company: 'AUTOFFICINA ROSSI SNC', phone: '011 1234567',
    active: true, scope: { '007183': true }
  },
  AGENTE: {
    uid: 'demo-agente', email: 'demo.agente@telosgroup.it', displayName: 'Laura Conti',
    role: 'AGENTE', company: 'Telos — Rete commerciale', phone: '011 7654321',
    active: true, scope: { 'DIREZIONALI TORINO': true, 'DIREZIONALI CUNEO': true }
  },
  CORRIERE: {
    uid: 'demo-corriere', email: 'demo.corriere@piemme.it', displayName: 'Giuseppe Ferri',
    role: 'CORRIERE', company: 'PIEMME Trasporti', phone: '011 2223344',
    active: true, scope: { 'PIEMME': true, 'CITYLINE': true }
  },
  TELOS: {
    uid: 'demo-telos', email: 'demo.operatore@telosgroup.it', displayName: 'Sara Rinaldi',
    role: 'TELOS', company: 'TELOS SPA', phone: '011 4560000', active: true
  },
  ADMIN: {
    uid: 'demo-admin', email: 'demo.admin@telosgroup.it', displayName: 'Andrea Moretti',
    role: 'ADMIN', company: 'TELOS SPA', phone: '011 4560001', active: true
  }
};

function buildSeed(role) {
  const profile = PROFILES[role] || PROFILES.CLIENTE;
  const uid = profile.uid;

  const users = {};
  for (const r in PROFILES) users[PROFILES[r].uid] = PROFILES[r];

  // Proiezioni: le stesse che in produzione scrive portal-sync.
  const byClient = {};
  const byAgent = {};
  const byCourier = {};
  const access = {};

  for (const key in RETURNS) {
    const row = RETURNS[key];
    const code = (/^(\d{4,8})\b/.exec(String(row.sogg || '')) || [])[1];
    if (code) (byClient[code] = byClient[code] || {})[key] = row;
    if (row.agente) {
      const a = row.agente.toUpperCase();
      (byAgent[a] = byAgent[a] || {})[key] = row;
    }
    for (const field of ['vetRic', 'vetUsc']) {
      if (!row[field]) continue;
      for (const part of String(row[field]).split('/')) {
        const c = part.trim().toUpperCase();
        if (c) (byCourier[c] = byCourier[c] || {})[key] = row;
      }
    }
  }

  // Perimetro dell'utente demo.
  const scopeKeys = profile.scope ? Object.keys(profile.scope) : [];
  const source = role === 'CLIENTE' ? byClient : role === 'AGENTE' ? byAgent : role === 'CORRIERE' ? byCourier : null;
  const grants = {};
  if (source) {
    for (const s of scopeKeys) {
      const bucket = source[s];
      for (const k in bucket) grants[k] = true;
    }
  } else {
    for (const k in RETURNS) grants[k] = true;
  }
  access[uid] = grants;

  return {
    returns: RETURNS,
    portal_users: users,
    portal_view: { client: byClient, agent: byAgent, courier: byCourier },
    portal_access: access,
    portal_timeline: {
      d1: {
        e0000000001_a: { ts: now - 6 * DAY, actor: 'demo-cliente', actorName: 'Marco Bianchi', actorRole: 'CLIENTE', action: 'CREATED' },
        e0000000002_b: { ts: now - 6 * DAY + 3600000, actor: 'demo-cliente', actorName: 'Marco Bianchi', actorRole: 'CLIENTE', action: 'STATE_CHANGE', from: '', to: 'RICHIESTO' },
        e0000000003_c: { ts: now - 5 * DAY, actor: 'demo-telos', actorName: 'Sara Rinaldi', actorRole: 'TELOS', action: 'STATE_CHANGE', from: 'RICHIESTO', to: 'APPROVATO', note: 'Reso autorizzato. Prepara il pezzo con la bolla in evidenza.' },
        e0000000004_d: { ts: now - 5 * DAY + 7200000, actor: 'demo-corriere', actorName: 'Giuseppe Ferri', actorRole: 'CORRIERE', action: 'STATE_CHANGE', from: 'APPROVATO', to: 'RITIRATO' },
        e0000000005_e: { ts: now - 4 * DAY, actor: 'demo-telos', actorName: 'Sara Rinaldi', actorRole: 'TELOS', action: 'STATE_CHANGE', from: 'CONSEGNATO', to: 'IN_VERIFICA', note: 'In attesa di riscontro dal fornitore.' }
      },
      d6: {
        e0000000010_a: { ts: now - 9 * DAY, actor: 'demo-telos', actorName: 'Sara Rinaldi', actorRole: 'TELOS', action: 'CREATED' },
        e0000000011_b: { ts: now - 1 * DAY, actor: 'demo-cliente', actorName: 'Marco Bianchi', actorRole: 'CLIENTE', action: 'STATE_CHANGE', from: 'IN_VERIFICA', to: 'CONTESTATO', note: 'Il pezzo era gia\' danneggiato all\'apertura del collo. Allego le foto fatte al banco.' }
      }
    },
    portal_messages: {
      d1: {
        m001: { ts: now - 5 * DAY, from: 'demo-telos', fromName: 'Sara Rinaldi', fromRole: 'TELOS', text: 'Buongiorno, il reso e\' stato approvato. Il corriere passera\' entro 48 ore.' },
        m002: { ts: now - 5 * DAY + 1800000, from: 'demo-cliente', fromName: 'Marco Bianchi', fromRole: 'CLIENTE', text: 'Perfetto, grazie. Il pezzo e\' gia\' imballato e pronto al banco accettazione.' },
        m003: { ts: now - 4 * DAY, from: 'demo-telos', fromName: 'Sara Rinaldi', fromRole: 'TELOS', text: 'Ricevuto. Abbiamo aperto la pratica col fornitore, ti aggiorniamo appena risponde.' }
      },
      d6: {
        m010: { ts: now - 1 * DAY, from: 'demo-cliente', fromName: 'Marco Bianchi', fromRole: 'CLIENTE', text: 'Ho aperto una contestazione: il faro era rotto dentro la scatola sigillata.' }
      }
    },
    portal_documents: {},
    portal_requests: {
      req_demo1: {
        ts: now - 2 * DAY, createdBy: 'demo-cliente', createdName: 'Marco Bianchi',
        createdRole: 'CLIENTE', state: 'INVIATA', clientCode: '007183',
        clientName: 'AUTOFFICINA ROSSI SNC', causale: 'ERRATO ORDINE',
        note: 'Ordinati 4 pezzi invece di 2.',
        articoli: [{ cod: '0986424815', pre: 'BOS', qty: 2, forn: 'BOSCH' }]
      }
    },
    portal_notifications: {
      [uid]: {
        n1: { ts: now - 4 * DAY, title: 'BOS 0986444981 · In verifica', body: 'Sara Rinaldi ha aggiornato lo stato del reso.', returnKey: 'd1', read: false },
        n2: { ts: now - 1 * DAY, title: 'VAL LS1892 · Contestato', body: 'E\' stata aperta una contestazione.', returnKey: 'd6', read: false }
      }
    },
    portal_config: { sla: {}, brand: {} },
    portal_counters: { staff: { pending: 1, contested: 1, messages: 2, total: 4, ts: now } }
  };
}

// ── Finto SDK ───────────────────────────────────────────────────────────

export function installDemoBackend() {
  const role = demoRole();
  const DB = buildSeed(role);
  const profile = PROFILES[role] || PROFILES.CLIENTE;

  function getPath(path) {
    const parts = String(path).split('/').filter(Boolean);
    let node = DB;
    for (const p of parts) {
      if (node == null || typeof node !== 'object') return null;
      node = node[p];
    }
    return node === undefined ? null : node;
  }

  function setPath(path, value) {
    const parts = String(path).split('/').filter(Boolean);
    let node = DB;
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof node[parts[i]] !== 'object' || node[parts[i]] === null) node[parts[i]] = {};
      node = node[parts[i]];
    }
    if (value === null) delete node[parts[parts.length - 1]];
    else node[parts[parts.length - 1]] = value;
    notify(path);
  }

  let listeners = [];
  function notify(changed) {
    listeners.forEach((l) => {
      if (changed.indexOf(l.path) === 0 || l.path.indexOf(changed) === 0) {
        setTimeout(() => l.cb(snap(l.path)), 0);
      }
    });
  }

  function snap(path) {
    const val = getPath(path);
    return {
      val: () => val,
      exists: () => val !== null && val !== undefined,
      key: String(path).split('/').filter(Boolean).pop() || null,
      forEach: (fn) => {
        if (val && typeof val === 'object') {
          Object.keys(val).forEach((k) => fn({ key: k, val: () => val[k] }));
        }
      }
    };
  }

  function Ref(path) {
    this._path = String(path).replace(/^\/+|\/+$/g, '');
  }
  Ref.prototype.child = function (p) { return new Ref(this._path + '/' + p); };
  Ref.prototype.once = function () { return Promise.resolve(snap(this._path)); };
  Ref.prototype.on = function (event, cb) {
    const self = this;
    listeners.push({ path: self._path, cb });
    setTimeout(() => cb(snap(self._path)), 0);
    return cb;
  };
  Ref.prototype.off = function () {
    const self = this;
    listeners = listeners.filter((l) => l.path !== self._path);
  };
  Ref.prototype.set = function (v) { setPath(this._path, v); return Promise.resolve(); };
  Ref.prototype.update = function (obj) {
    for (const k in obj) setPath(this._path + '/' + k, obj[k]);
    return Promise.resolve();
  };
  Ref.prototype.remove = function () { setPath(this._path, null); return Promise.resolve(); };
  Ref.prototype.push = function (v) {
    const id = 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    setPath(this._path + '/' + id, v);
    return Promise.resolve({ key: id });
  };
  Ref.prototype.limitToLast = function () { return this; };
  Ref.prototype.limitToFirst = function () { return this; };
  Ref.prototype.orderByChild = function () { return this; };
  Ref.prototype.equalTo = function () { return this; };
  Ref.prototype.onDisconnect = function () { return { remove: () => Promise.resolve() }; };
  Object.defineProperty(Ref.prototype, 'root', { get() { return new Ref(''); } });

  const user = {
    uid: profile.uid,
    email: profile.email,
    displayName: profile.displayName,
    getIdTokenResult: () => Promise.resolve({ claims: { prole: role } }),
    getIdToken: () => Promise.resolve('demo-token'),
    reauthenticateWithCredential: () => Promise.resolve(),
    updatePassword: () => Promise.resolve()
  };

  const authApi = {
    currentUser: user,
    onAuthStateChanged(cb) { setTimeout(() => cb(authApi.currentUser), 0); return () => {}; },
    setPersistence: () => Promise.resolve(),
    signInWithEmailAndPassword: () => Promise.resolve({ user }),
    signOut() {
      authApi.currentUser = null;
      stopDemo();
      return Promise.resolve();
    },
    sendPasswordResetEmail: () => Promise.resolve()
  };

  window.PORTAL_FIREBASE = {
    apiKey: 'demo',
    databaseURL: 'https://demo-default-rtdb.europe-west1.firebasedatabase.app'
  };

  window.firebase = {
    apps: [],
    initializeApp(cfg, name) {
      const app = { name: name || '[DEFAULT]', options: cfg };
      window.firebase.apps.push(app);
      return app;
    },
    app(name) {
      const found = window.firebase.apps.filter((a) => a.name === (name || '[DEFAULT]'))[0];
      if (!found) throw new Error('app non inizializzata');
      return found;
    },
    database() {
      return {
        ref(p) {
          if (p === '.info/connected') {
            return { on: (ev, cb) => setTimeout(() => cb({ val: () => true }), 0), off() {} };
          }
          return new Ref(p || '');
        }
      };
    },
    auth: () => authApi
    // storage e messaging assenti: in demo upload e push si disabilitano da soli.
  };
  window.firebase.database.ServerValue = { TIMESTAMP: Date.now() };
  window.firebase.auth.Auth = { Persistence: { LOCAL: 'local' } };
  window.firebase.auth.EmailAuthProvider = { credential: (e, p) => ({ e, p }) };
}

export const DEMO_ROLES = [
  { role: 'CLIENTE', label: 'Cliente', icon: '👤', desc: 'AUTOFFICINA ROSSI · vede solo i propri resi' },
  { role: 'AGENTE', label: 'Agente', icon: '💼', desc: 'Torino e Cuneo · vede i clienti della zona' },
  { role: 'CORRIERE', label: 'Corriere', icon: '🚚', desc: 'PIEMME · vede i ritiri assegnati' },
  { role: 'TELOS', label: 'Operatore Telos', icon: '🏢', desc: 'Vede e lavora tutte le pratiche' },
  { role: 'ADMIN', label: 'Amministratore', icon: '⚙️', desc: 'Tutto + utenti, SLA, personalizzazione' }
];
