// js/ui/spunta/normalize.js — normalizzazione stringhe per matching.
//
// Cruciale: "CASADEI S.R.L." e "casadei srl" devono matchare "CASADEI".
// Funzioni pure, testabili.
'use strict';

// Suffissi giuridici da rimuovere (già normalizzati: nessun punto)
var COMPANY_SUFFIXES = [
  'SRL', 'SPA', 'SNC', 'SAS', 'SS',
  'S R L', 'S P A', 'S N C', 'S A S',
  'S.R.L.', 'S.P.A.', 'S.N.C.', 'S.A.S.',   // per la fase pre-punteggiatura
  'SOCIETA COOPERATIVA', 'COOP',
  'DI', 'E C', '& C'
];

// Rimuove accenti (è → e, ù → u, ecc.)
function stripAccents(s){
  if(!s) return '';
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function normalizeString(s){
  if(s == null) return '';
  var out = String(s);
  out = stripAccents(out);
  out = out.toUpperCase();
  // Rimuovi punteggiatura (mantenendo lettere/numeri/spazi)
  out = out.replace(/[.,;:!?"'()\/\\|_\-+*=@#%^~`\[\]{}]/g, ' ');
  out = out.replace(/[&]/g, ' ');
  // Rimuovi suffissi giuridici (ordine: prima quelli con spazi, poi corti)
  COMPANY_SUFFIXES
    .slice()
    .sort(function(a, b){ return b.length - a.length; })
    .forEach(function(sfx){
      // Sostituisci solo se preceduto da spazio o inizio-stringa
      var pattern = new RegExp('(^|\\s)' + sfx.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s|$)', 'g');
      out = out.replace(pattern, ' ');
    });
  // Collassa spazi multipli e trim
  out = out.replace(/\s+/g, ' ').trim();
  return out;
}

// Similarity 0..1 tra due stringhe normalizzate.
// Algoritmo: Dice coefficient sui bigrammi (buon compromesso velocità/qualità).
function similarity(a, b){
  a = normalizeString(a);
  b = normalizeString(b);
  if(!a || !b) return 0;
  if(a === b) return 1;
  // Match "contains" per stringhe corte
  if(a.length < 4 || b.length < 4){
    if(a.indexOf(b) >= 0 || b.indexOf(a) >= 0) return 0.9;
    return 0;
  }
  var ba = _bigrams(a);
  var bb = _bigrams(b);
  var common = 0;
  var bbCopy = bb.slice();
  for(var i = 0; i < ba.length; i++){
    var idx = bbCopy.indexOf(ba[i]);
    if(idx >= 0){ common++; bbCopy.splice(idx, 1); }
  }
  return (2 * common) / (ba.length + bb.length);
}

function _bigrams(s){
  var out = [];
  for(var i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out;
}

// Check se una query è contenuta (as prefix o substring) nella stringa normalizzata
function contains(haystack, needle){
  var h = normalizeString(haystack);
  var n = normalizeString(needle);
  if(!n) return false;
  return h.indexOf(n) >= 0;
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = { normalizeString, similarity, contains, stripAccents };
}
if(typeof window !== 'undefined'){
  window._spuntaNorm = { normalizeString, similarity, contains, stripAccents };
}
