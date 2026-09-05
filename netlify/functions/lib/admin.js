// Helper condiviso dalle function del portale.
//
// Inizializza Firebase Admin una volta sola per container e mette a
// disposizione la verifica del token chiamante. Le credenziali stanno SOLO
// nelle env var Netlify: FIREBASE_SERVICE_ACCOUNT (JSON del service account)
// e FIREBASE_DB_URL.
//
// Ogni function del portale che scrive dati passa da requireRole(): senza
// quel controllo chiunque conosca l'URL potrebbe promuoversi ad amministratore.

let admin = null;
let initError = null;

function loadAdmin() {
  if (admin || initError) return { admin, initError };
  try {
    // eslint-disable-next-line global-require
    admin = require('firebase-admin');
  } catch (e) {
    initError = new Error('Dipendenza firebase-admin non installata: aggiungila al package.json.');
    return { admin: null, initError };
  }

  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT || '';
    const dbUrl = process.env.FIREBASE_DB_URL || '';
    if (!raw || !dbUrl) {
      initError = new Error('Configurazione mancante: definire FIREBASE_SERVICE_ACCOUNT e FIREBASE_DB_URL su Netlify.');
      return { admin: null, initError };
    }
    let credentials;
    try {
      // Il JSON puo' essere incollato tale e quale oppure in base64:
      // alcune UI rovinano le newline della private key, il base64 le salva.
      const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
      credentials = JSON.parse(text);
      if (credentials.private_key) {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      }
    } catch (e) {
      initError = new Error('FIREBASE_SERVICE_ACCOUNT non e\' un JSON valido.');
      return { admin: null, initError };
    }
    try {
      admin.initializeApp({
        credential: admin.credential.cert(credentials),
        databaseURL: dbUrl
      });
    } catch (e) {
      initError = e;
      return { admin: null, initError };
    }
  }
  return { admin, initError: null };
}

function getAdmin() {
  const res = loadAdmin();
  if (res.initError) throw res.initError;
  return res.admin;
}

function corsHeaders(reqOrigin) {
  const explicit = (process.env.ALLOWED_ORIGINS || '')
    .split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
  const defaults = [process.env.URL, process.env.DEPLOY_PRIME_URL].filter(Boolean);
  const allow = explicit.length ? explicit : defaults;
  let origin = '*';
  if (allow.length) origin = (reqOrigin && allow.includes(reqOrigin)) ? reqOrigin : allow[0];
  return {
    'Access-Control-Allow-Origin': origin,
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json'
  };
}

function json(statusCode, body, headers) {
  return { statusCode, headers, body: JSON.stringify(body) };
}

// Verifica il bearer token e, se richiesto, che il chiamante abbia uno dei
// ruoli ammessi. Il ruolo si legge dal custom claim, non dal database:
// il claim e' firmato da Google e non falsificabile dal client.
async function requireRole(event, allowedRoles) {
  const header = (event.headers && (event.headers.authorization || event.headers.Authorization)) || '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) {
    const err = new Error('Token di autenticazione mancante.');
    err.statusCode = 401;
    throw err;
  }
  const fb = getAdmin();
  let decoded;
  try {
    // checkRevoked: un utente a cui e' stato revocato l'accesso non deve
    // poter continuare a operare col token ancora in corso di validita'.
    decoded = await fb.auth().verifyIdToken(match[1], true);
  } catch (e) {
    const err = new Error('Token non valido o scaduto.');
    err.statusCode = 401;
    throw err;
  }
  const role = decoded.prole || null;
  if (allowedRoles && allowedRoles.indexOf(role) < 0) {
    const err = new Error('Operazione non consentita per il ruolo ' + (role || 'non assegnato') + '.');
    err.statusCode = 403;
    throw err;
  }
  return { uid: decoded.uid, email: decoded.email, role, token: decoded };
}

// Chiavi Firebase: stessa normalizzazione del client (portal/js/core/firebase.js).
// Se le due divergono, uno scope scritto dal server non viene letto dal client.
function safeKey(value) {
  return String(value == null ? '' : value)
    .trim()
    .toUpperCase()
    .replace(/[.#$/[\]]/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 200);
}

module.exports = { getAdmin, corsHeaders, json, requireRole, safeKey };
