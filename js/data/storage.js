// js/data/storage.js — wrapper tipizzato su localStorage.
//
// Motivazione: in index.html ci sono ~50 punti dove localStorage.getItem
// è avvolto in try/catch + JSON.parse. Centralizzare qui evita di dimenticare
// il try (una eccezione non catturata blocca l'avvio dell'app).
//
// Convenzioni:
//   - le chiavi sono elencate in KEYS (fonte unica)
//   - getJSON / setJSON serializzano oggetti automaticamente
//   - getStr / setStr per stringhe grezze
//   - remove è idempotente
//
// ATTENZIONE: nessun import da index.html. Le var globali del vecchio
// codice restano dove sono; questo modulo è disponibile per il refactor
// futuro e per i test.
'use strict';

// ── Chiavi conosciute (evita typo e centralizza il naming) ──────────
var KEYS = {
  FORN:          'tf',       // array fornitori suggeriti
  SOGG:          'ts',       // array soggetti suggeriti
  MEM:           'tm',       // ultimi valori (vetRic, flusso, ecc)
  SUP_DB:        'supdb',    // anagrafica fornitori manuale
  ARCH:          'tarch',    // pratiche archiviate
  REMIND:        'tremind',  // reminder utente
  REMIND_DONE:   'tremday',  // ultimo giorno reminder chiuso
  MAIL_LOG:      'maillog',  // log invio mail (max 300 record)
  MFU:           'mfu',      // follow-up mail
  TRI_OVR:       'triovr',   // override manuali sullo storico trimestre
  PHOTO_DIR:     'tpf',      // nome cartella foto pacco (File System Access)
  PKG_KEYS:      'pkgKeys',  // chiavi indice foto pacco
  SEC_LOG_MOD:   'secLogBuf',      // buffer modifiche in offline
  SEC_LOG_ACC:   'secLogAccBuf',   // buffer accessi in offline
  NOTIF_BCAST:   '_notifBcastBuf'  // buffer notifiche cross-device
};

// ── Storage backend (fallback in-memory se il browser non ha LS) ────
var _mem = {};
function _get(key){
  try{
    if(typeof localStorage !== 'undefined') return localStorage.getItem(key);
  }catch(e){}
  return (key in _mem) ? _mem[key] : null;
}
function _set(key, val){
  try{
    if(typeof localStorage !== 'undefined'){ localStorage.setItem(key, val); return true; }
  }catch(e){}
  _mem[key] = val; return false;
}
function _rm(key){
  try{
    if(typeof localStorage !== 'undefined') localStorage.removeItem(key);
  }catch(e){}
  delete _mem[key];
}

// ── API pubblica ────────────────────────────────────────────────────
function getStr(key, def){
  var v = _get(key);
  return v == null ? (def == null ? '' : def) : v;
}
function setStr(key, val){ return _set(key, String(val == null ? '' : val)); }
function remove(key){ _rm(key); }

function getJSON(key, def){
  var v = _get(key);
  if(v == null) return def;
  try{ return JSON.parse(v); }
  catch(e){ return def; }
}
function setJSON(key, obj){
  try{ return _set(key, JSON.stringify(obj)); }
  catch(e){ return false; }
}

// Aggiunge un elemento a un array persistito e lo ri-salva. Ritorna l'array.
function appendUnique(key, item){
  var arr = getJSON(key, []);
  if(!Array.isArray(arr)) arr = [];
  var s = String(item||'').trim();
  if(!s) return arr;
  if(arr.indexOf(s) < 0){ arr.push(s); setJSON(key, arr); }
  return arr;
}

// Utility per il buffer log: append + cap dimensione
function pushCapped(key, item, cap){
  var arr = getJSON(key, []);
  if(!Array.isArray(arr)) arr = [];
  arr.unshift(item);
  if(cap && arr.length > cap) arr.length = cap;
  setJSON(key, arr);
  return arr;
}

// ── Export ──────────────────────────────────────────────────────────
var api = { KEYS, getStr, setStr, getJSON, setJSON, remove, appendUnique, pushCapped };

if(typeof module !== 'undefined' && module.exports){
  module.exports = api;
  // Espone anche per test un modo di resettare la memoria interna
  module.exports._resetMemForTests = function(){ _mem = {}; };
}
if(typeof window !== 'undefined'){
  window._storage = api;
}
