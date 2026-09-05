// Bootstrap Firebase per il portale.
//
// Usa l'SDK "compat" caricato via <script> da gstatic (stessa origine gia'
// consentita dal CSP e gia' in cache per chi usa il gestionale). Espone
// helper tipizzati sui path del portale cosi' nessun altro modulo scrive
// stringhe di path a mano.

import { getFirebaseConfig } from './config.js';
import { emit, EVENTS } from './bus.js';

let app = null;
let dbInstance = null;
let authInstance = null;
let storageInstance = null;
let connected = false;

export class FirebaseUnavailable extends Error {
  constructor(message) {
    super(message);
    this.name = 'FirebaseUnavailable';
  }
}

function sdkReady() {
  return typeof firebase !== 'undefined' && !!firebase.database && typeof firebase.auth === 'function';
}

export function waitForSdk(timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    if (sdkReady()) return resolve(true);
    const started = Date.now();
    const tick = setInterval(() => {
      if (sdkReady()) {
        clearInterval(tick);
        resolve(true);
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(tick);
        reject(new FirebaseUnavailable('SDK Firebase non caricato (rete o blocco su gstatic.com)'));
      }
    }, 150);
  });
}

export async function initFirebase() {
  if (app) return app;
  await waitForSdk();
  const cfg = getFirebaseConfig();
  if (!cfg) throw new FirebaseUnavailable('Configurazione Firebase mancante');

  // Il portale gira su un'app Firebase NOMINATA, separata da quella di default
  // del gestionale: se un domani i due venissero caricati nella stessa pagina
  // non si calpesterebbero i listener.
  try {
    app = firebase.app('portal');
  } catch (e) {
    app = firebase.initializeApp(cfg, 'portal');
  }

  dbInstance = firebase.database(app);
  authInstance = firebase.auth(app);
  try {
    if (typeof firebase.storage === 'function') storageInstance = firebase.storage(app);
  } catch (e) {
    storageInstance = null; // Storage opzionale: senza, gli upload sono disabilitati
  }

  // Stato connessione: alimenta il badge online/offline e lo svuotamento coda.
  dbInstance.ref('.info/connected').on('value', (snap) => {
    const next = snap.val() === true;
    if (next !== connected) {
      connected = next;
      emit(EVENTS.CONN_CHANGED, connected);
    }
  });

  // La sessione deve sopravvivere alla chiusura del browser: gli utenti esterni
  // non vogliono rifare il login ogni volta.
  try {
    await authInstance.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
  } catch (e) { /* alcuni browser in modalita' privata rifiutano: resta la sessione volatile */ }

  return app;
}

export function isConnected() {
  return connected;
}

export function db() {
  if (!dbInstance) throw new FirebaseUnavailable('Database non inizializzato');
  return dbInstance;
}

export function auth() {
  if (!authInstance) throw new FirebaseUnavailable('Auth non inizializzato');
  return authInstance;
}

export function storage() {
  return storageInstance;
}

export function hasStorage() {
  return !!storageInstance;
}

export function serverTimestamp() {
  return firebase.database.ServerValue.TIMESTAMP;
}

// ── Helper di path ──────────────────────────────────────────────────────
// Unico punto in cui i nomi dei nodi del portale compaiono come stringhe.

export const paths = {
  users: () => db().ref('portal_users'),
  user: (uid) => db().ref('portal_users/' + uid),
  userScope: (uid) => db().ref('portal_users/' + uid + '/scope'),
  userTokens: (uid) => db().ref('portal_users/' + uid + '/fcmTokens'),

  access: (uid) => db().ref('portal_access/' + uid),
  accessOne: (uid, returnKey) => db().ref('portal_access/' + uid + '/' + returnKey),

  viewClient: (code) => db().ref('portal_view/client/' + code),
  viewAgent: (name) => db().ref('portal_view/agent/' + name),
  viewCourier: (name) => db().ref('portal_view/courier/' + name),

  returns: () => db().ref('returns'),
  aReturn: (key) => db().ref('returns/' + key),

  timeline: (returnKey) => db().ref('portal_timeline/' + returnKey),
  messages: (returnKey) => db().ref('portal_messages/' + returnKey),
  documents: (returnKey) => db().ref('portal_documents/' + returnKey),

  requests: () => db().ref('portal_requests'),
  request: (id) => db().ref('portal_requests/' + id),

  configSla: () => db().ref('portal_config/sla'),
  configBrand: () => db().ref('portal_config/brand'),
  configFlags: () => db().ref('portal_config/flags'),

  notifications: (uid) => db().ref('portal_notifications/' + uid),
  audit: () => db().ref('portal_audit'),
  syncMeta: () => db().ref('portal_sync_meta')
};

// Chiavi Firebase: '.', '#', '$', '/', '[', ']' non sono ammessi.
// I codici cliente e i nomi agente/vettore finiscono nei path, quindi
// vanno normalizzati sia in scrittura sia in lettura, allo stesso modo.
export function safeKey(value) {
  return String(value == null ? '' : value)
    .trim()
    .toUpperCase()
    .replace(/[.#$/[\]]/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 200);
}
