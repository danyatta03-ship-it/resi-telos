// js/data/sync.js — reconcile locale ↔ Firebase (STUB progettuale).
//
// STATO: pattern documentativo. Il vero merge oggi è sparso in ~10
// callback dentro index.html (`.on('value', ...)`, `.on('child_added')`,
// gestione conflitti manuale). Questo modulo mostra la forma finale
// che dovrebbe assumere.
//
// Regole (invariabili):
//   - "last-write-wins" a livello di riga: chi ha _ts maggiore vince
//   - _key immutabile: se manca, la riga viene ignorata
//   - _frozen (storico) mai sovrascritto da sync (solo update esplicito)
//
// Non ancora usato in index.html. Estrazione vera → Fase 3.
'use strict';

// Merge di una snapshot Firebase con lo state locale.
// Ritorna { rows: mergedMap, changed: keysCambiate[] }.
function mergeSnapshot(local, remote){
  local  = local  || {};
  remote = remote || {};
  var out = {};
  var changed = [];

  // Prima passata: chiavi locali
  for(var k in local){
    if(!Object.prototype.hasOwnProperty.call(local, k)) continue;
    var l = local[k];
    var r = remote[k];
    if(!r){ out[k] = l; continue; } // solo locale
    // Storico: mai toccato da sync automatico
    if(l && l._frozen){ out[k] = l; continue; }
    // Last-write-wins
    if((r._ts || 0) > (l._ts || 0)){ out[k] = r; changed.push(k); }
    else out[k] = l;
  }

  // Seconda passata: chiavi solo remote (nuove per noi)
  for(var k2 in remote){
    if(!Object.prototype.hasOwnProperty.call(remote, k2)) continue;
    if(k2 in out) continue;
    out[k2] = remote[k2];
    changed.push(k2);
  }

  return { rows: out, changed: changed };
}

// Verifica se una riga è pubblicabile su FB (evita write di record vuoti)
function isPublishable(row){
  if(!row || !row._key) return false;
  if(!row.fase) return false;
  return true;
}

var api = { mergeSnapshot, isPublishable };
if(typeof module !== 'undefined' && module.exports) module.exports = api;
if(typeof window !== 'undefined') window._sync = api;
