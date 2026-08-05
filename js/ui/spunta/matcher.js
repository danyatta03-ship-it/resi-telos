// js/ui/spunta/matcher.js — trova la riga della lista attesa che matcha
// un input operatore (digitato o letto da OCR etichetta).
//
// Ritorna:
//   { match: 'none'|'single'|'multi', rows: [...], scores: [...] }
//
// Regole:
//   - Match minimo su similarity(mittente) >= 0.55
//   - Bonus se anche la città matcha (>= 0.6)
//   - Se score max > secondo * 1.35 → considerato "single"
//   - Altrimenti restituisce tutti quelli in cima e chiede all'operatore
//
// Funzione pura: nessun DOM, nessun IO. Testabile.
'use strict';

var norm = (typeof require === 'function')
  ? require('./normalize.js')
  : (typeof window !== 'undefined' ? window._spuntaNorm : null);

function findMatch(input, lista, opts){
  opts = opts || {};
  var THRESHOLD = opts.threshold != null ? opts.threshold : 0.55;
  var CITY_BONUS = opts.cityBonus != null ? opts.cityBonus : 0.15;
  var GAP = opts.gap != null ? opts.gap : 1.35;

  if(!input || !Array.isArray(lista) || lista.length === 0){
    return { match: 'none', rows: [], scores: [] };
  }

  // Estraiamo mittente + città dall'input.
  // Convenzione: se contiene "-" o "," la parte dopo è la città.
  var inputParts = _splitMittenteCitta(input);

  var hasCity = !!inputParts.citta;

  var scored = lista.map(function(row, i){
    var sMitt = norm.similarity(inputParts.mittente, row.mittente || '');
    var sCity = hasCity ? norm.similarity(inputParts.citta, row.citta || '') : 0;
    var score;
    if(hasCity){
      // Quando l'operatore ha fornito la città, la usiamo come tie-break FORTE.
      // score = sMitt * (0.5 + 0.5 * sCity):
      //   perfect mittente + zero città  → 0.50 (perde vs partial+city)
      //   partial mittente + perfect città → cresce del 100%
      score = sMitt * (0.5 + 0.5 * sCity);
    } else {
      // Solo mittente: score = sMitt + eventuale bonus "contains" full-word
      score = sMitt;
      if(norm.contains(row.mittente || '', input)) score += 0.10;
    }
    return { row: row, score: score, sMitt: sMitt, sCity: sCity, idx: i };
  }).filter(function(x){ return x.sMitt >= THRESHOLD; });

  scored.sort(function(a, b){ return b.score - a.score; });

  if(scored.length === 0) return { match: 'none', rows: [], scores: [] };

  // Single quando:
  //  - solo un candidato, OPPURE
  //  - distacco netto (score1 >= score2 * GAP), OPPURE
  //  - la città del top matcha praticamente esatta E l'altro no
  var top = scored[0];
  var second = scored[1];
  var singleByGap = !second || top.score >= second.score * GAP;
  var singleByCity = hasCity && second &&
                      top.sCity >= 0.9 && second.sCity < 0.5;
  if(singleByGap || singleByCity){
    return {
      match: 'single',
      rows: [top.row],
      scores: [top.score]
    };
  }

  // Multi: prendi i top-N (max 5)
  var top = scored.slice(0, 5);
  return {
    match: 'multi',
    rows: top.map(function(x){ return x.row; }),
    scores: top.map(function(x){ return x.score; })
  };
}

// Divide "CASADEI SRL - VERRES" o "CASADEI, VERRES" in mittente/citta.
function _splitMittenteCitta(s){
  var m = String(s || '').split(/\s*[-,;]\s*/);
  if(m.length >= 2){
    return { mittente: m[0], citta: m.slice(1).join(' ') };
  }
  return { mittente: s || '', citta: '' };
}

// Lookup codice cliente Telos in CLI_DATA (mappa nome→codice o array oggetti).
// Non usato nel matcher principale, esposto per la UI (mostra il codice
// se disponibile).
function lookupCliData(nome, cliData){
  if(!nome || !cliData) return null;
  var target = norm.normalizeString(nome);
  if(!target) return null;
  // cliData è tipicamente { "CODICE": {nome:..., citta:...} }
  var best = null;
  var bestScore = 0;
  for(var cod in cliData){
    if(!Object.prototype.hasOwnProperty.call(cliData, cod)) continue;
    var rec = cliData[cod];
    var nomeRec = rec && (rec.nome || rec.ragione || rec.rs);
    if(!nomeRec) continue;
    var s = norm.similarity(target, nomeRec);
    if(s > bestScore && s >= 0.75){
      bestScore = s;
      best = { codice: cod, nome: nomeRec, citta: rec.citta || rec.city || '', score: s };
    }
  }
  return best;
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = { findMatch, lookupCliData };
}
if(typeof window !== 'undefined'){
  window._spuntaMatcher = { findMatch, lookupCliData };
}
