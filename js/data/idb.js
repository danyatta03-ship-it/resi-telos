// js/data/idb.js — wrapper IndexedDB stile localStorage (Promise-based).
//
// STATO: pronto per l'uso indipendente (già testabile). L'estrazione
// da index.html (che oggi ha `idbSet/idbGet` inline) è la Fase 3.
//
// API:
//   idb.open(dbName?, storeName?)  → Promise<IDBDatabase>
//   idb.set(key, val)              → Promise<void>
//   idb.get(key)                   → Promise<any>   (null se assente)
//   idb.del(key)                   → Promise<void>
//   idb.keys()                     → Promise<string[]>
//
// Fallback: se IndexedDB non è disponibile (SSR, Safari private, quota
// esaurita), tutte le operazioni fallback su localStorage.
'use strict';

var DB_NAME  = 'resi-telos';
var STORE    = 'kv';
var _db      = null;
var _opening = null;

function _hasIdb(){
  return typeof indexedDB !== 'undefined';
}

function open(dbName, storeName){
  if(_db) return Promise.resolve(_db);
  if(_opening) return _opening;
  if(!_hasIdb()) return Promise.reject(new Error('IndexedDB non disponibile'));

  var name  = dbName  || DB_NAME;
  var store = storeName || STORE;

  _opening = new Promise(function(resolve, reject){
    var req = indexedDB.open(name, 1);
    req.onupgradeneeded = function(){
      var db = req.result;
      if(!db.objectStoreNames.contains(store)) db.createObjectStore(store);
    };
    req.onsuccess = function(){ _db = req.result; resolve(_db); };
    req.onerror   = function(){ reject(req.error); };
  });
  return _opening;
}

function _tx(mode){
  return open().then(function(db){
    return db.transaction(STORE, mode).objectStore(STORE);
  });
}

function set(key, val){
  if(!_hasIdb()){
    try{ localStorage.setItem(key, val); return Promise.resolve(); }
    catch(e){ return Promise.reject(e); }
  }
  return _tx('readwrite').then(function(os){
    return new Promise(function(res, rej){
      var r = os.put(val, key);
      r.onsuccess = function(){ res(); };
      r.onerror   = function(){ rej(r.error); };
    });
  });
}

function get(key){
  if(!_hasIdb()){
    try{ return Promise.resolve(localStorage.getItem(key)); }
    catch(e){ return Promise.resolve(null); }
  }
  return _tx('readonly').then(function(os){
    return new Promise(function(res){
      var r = os.get(key);
      r.onsuccess = function(){
        var v = r.result;
        if(v != null){ res(v); return; }
        // fallback localStorage per migrazione dolce
        try{ res(localStorage.getItem(key)); }catch(e){ res(null); }
      };
      r.onerror = function(){
        try{ res(localStorage.getItem(key)); }catch(e){ res(null); }
      };
    });
  });
}

function del(key){
  try{ localStorage.removeItem(key); }catch(e){}
  if(!_hasIdb()) return Promise.resolve();
  return _tx('readwrite').then(function(os){
    return new Promise(function(res){
      var r = os.delete(key);
      r.onsuccess = function(){ res(); };
      r.onerror   = function(){ res(); }; // best-effort
    });
  });
}

function keys(){
  if(!_hasIdb()) return Promise.resolve([]);
  return _tx('readonly').then(function(os){
    return new Promise(function(res){
      var out = [];
      var r = os.openCursor();
      r.onsuccess = function(){
        var c = r.result;
        if(c){ out.push(c.key); c.continue(); }
        else res(out);
      };
      r.onerror = function(){ res(out); };
    });
  });
}

var api = { open, set, get, del, keys };
if(typeof module !== 'undefined' && module.exports) module.exports = api;
if(typeof window !== 'undefined') window._idb = api;
