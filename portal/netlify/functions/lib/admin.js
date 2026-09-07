// Helper condiviso dalle function del portale.
//
// Inizializza Firebase Admin una volta sola per container e mette a
// disposizione la verifica del token chiamante. Le credenziali stanno SOLO
// nelle env var Netlify: FIREBASE_SERVICE_ACCOUNT (JSON del service account)
// e FIREBASE_DB_URL.
//
// Non c'e' nessun controllo di ruolo perche' non ci sono ruoli: l'app
// pubblica non ha login. La validazione di quello che arriva la fa
// portal-submit, campo per campo, e le credenziali restano solo qui sul
// server — l'app pubblica non ha mai accesso al database.

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

module.exports = { getAdmin, corsHeaders, json };
