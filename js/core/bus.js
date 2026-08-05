// js/core/bus.js — event bus minimale.
//
// Motivazione: oggi renderList() è chiamata da ~30 punti sparsi
// (dopo addRow, svEdit, advFase, delete, bulk, filtri, sync FB, ecc).
// Con un event bus i punti che modificano lo stato emettono un evento;
// il renderer si iscrive una volta sola. Riduce l'accoppiamento e
// rende più facile sostituire il renderer (Fase 5: virtual scroll).
//
// API:
//   bus.on(name, fn)     → ritorna unsubscribe()
//   bus.off(name, fn)    → rimuove listener specifico
//   bus.emit(name, data) → chiama tutti i listener; errori isolati
//   bus.once(name, fn)   → listener one-shot
//   bus.clear([name])    → rimuove tutti i listener (di name o globali)
//
// Nomi eventi convenzionali (per il refactor futuro):
//   'rows:changed'   → una riga è stata add/edit/delete/adv
//   'auth:role'      → cambio ruolo
//   'theme:change'   → toggle dark/light
//   'notif:new'      → notifica ricevuta (cross-device o locale)
//   'sync:online'    → FB connesso / disconnesso
'use strict';

function createBus(){
  var listeners = Object.create(null);

  function on(name, fn){
    if(typeof fn !== 'function') return function(){};
    (listeners[name] = listeners[name] || []).push(fn);
    return function unsub(){ off(name, fn); };
  }

  function off(name, fn){
    var arr = listeners[name]; if(!arr) return;
    for(var i = arr.length - 1; i >= 0; i--){
      if(arr[i] === fn) arr.splice(i, 1);
    }
    if(arr.length === 0) delete listeners[name];
  }

  function once(name, fn){
    var un = on(name, function(data){ un(); try{ fn(data); }catch(e){ _err(e, name); } });
    return un;
  }

  function emit(name, data){
    var arr = listeners[name]; if(!arr) return 0;
    var count = 0;
    // copia difensiva: un listener che si disiscrive non altera l'iterazione
    var snap = arr.slice();
    for(var i = 0; i < snap.length; i++){
      try{ snap[i](data); count++; }
      catch(e){ _err(e, name); }
    }
    return count;
  }

  function clear(name){
    if(name == null) listeners = Object.create(null);
    else delete listeners[name];
  }

  function _listenerCount(name){
    return (listeners[name] || []).length;
  }

  function _err(e, name){
    try{
      if(typeof console !== 'undefined' && console.error){
        console.error('[bus] listener di "' + name + '" ha lanciato:', e);
      }
    }catch(_){}
  }

  return { on, off, once, emit, clear, _listenerCount };
}

// Istanza singleton di default
var bus = createBus();

if(typeof module !== 'undefined' && module.exports){
  module.exports = bus;
  module.exports.createBus = createBus;
}
if(typeof window !== 'undefined'){
  window._bus = bus;
}
