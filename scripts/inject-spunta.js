#!/usr/bin/env node
// scripts/inject-spunta.js — inietta i blocchi SPUNTA BANCALE
// (CSS, HTML, JS) dentro index.html usando marcatori idempotenti.
//
// Idempotente: se i marcatori esistono già, ri-esegue sostituendo il
// contenuto (comodo per aggiornare la feature senza duplicare).
//
// Uso: node scripts/inject-spunta.js
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const idxPath = path.join(root, 'index.html');
const spuntaDir = path.join(root, 'js', 'ui', 'spunta');

const MARK = {
  cssStart:  '/* ═══ SPUNTA BANCALE — CSS BEGIN ═══ */',
  cssEnd:    '/* ═══ SPUNTA BANCALE — CSS END ═══ */',
  htmlStart: '<!-- ═══ SPUNTA BANCALE — HTML BEGIN ═══ -->',
  htmlEnd:   '<!-- ═══ SPUNTA BANCALE — HTML END ═══ -->',
  jsStart:   '<!-- ═══ SPUNTA BANCALE — JS BEGIN ═══ -->',
  jsEnd:     '<!-- ═══ SPUNTA BANCALE — JS END ═══ -->'
};

function read(f){ return fs.readFileSync(path.join(spuntaDir, f), 'utf8'); }

function replaceOrInject(src, startMark, endMark, block, injectFn){
  const s = src.indexOf(startMark);
  const e = src.indexOf(endMark);
  if(s >= 0 && e > s){
    // rimpiazzo esistente
    return src.slice(0, s) + startMark + '\n' + block + '\n' + endMark + src.slice(e + endMark.length);
  }
  return injectFn(src, startMark + '\n' + block + '\n' + endMark);
}

// ── Preparo i blocchi ──────────────────────────────────────────────
const cssBlock  = read('spunta.css');
const htmlBlock = read('spunta.html');
const jsBlock =
  '// ── normalize.js ──\n' + read('normalize.js') + '\n' +
  '// ── matcher.js ──\n'   + read('matcher.js')   + '\n' +
  '// ── spunta.js ──\n'    + read('spunta.js');

let html = fs.readFileSync(idxPath, 'utf8');

// ── 1) CSS: prima del primo </style> ───────────────────────────────
html = replaceOrInject(html, MARK.cssStart, MARK.cssEnd, cssBlock, function(src, wrapped){
  const idx = src.indexOf('</style>');
  if(idx < 0) throw new Error('</style> non trovato in index.html');
  return src.slice(0, idx) + '\n' + wrapped + '\n' + src.slice(idx);
});

// ── 2) HTML: subito dopo la chiusura di pgHist ─────────────────────
// pgHist è l'ultimo pg-block, e chiude PRIMA di '<div id="memEditorBox"'.
// (Nota storica: hPanRie NON è sibling — è annidato dentro pgHist.
//  Iniettare prima di hPanRie mette pgSpunta dentro pgHist → contenuti
//  invisibili perché pgHist è display:none. Uso memEditorBox che è a
//  livello body sicuro.)
html = replaceOrInject(html, MARK.htmlStart, MARK.htmlEnd, htmlBlock, function(src, wrapped){
  const anchor = '<div id="memEditorBox"';
  const idx = src.indexOf(anchor);
  if(idx < 0) throw new Error("Ancora HTML '<div id=\"memEditorBox\"' non trovata");
  return src.slice(0, idx) + wrapped + '\n\n' + src.slice(idx);
});

// ── 3) JS: prima di </body> come <script> ──────────────────────────
const jsWrapper = '<script>\n' + jsBlock + '\n</script>';
html = replaceOrInject(html, MARK.jsStart, MARK.jsEnd, jsWrapper, function(src, wrapped){
  const idx = src.lastIndexOf('</body>');
  if(idx < 0) throw new Error('</body> non trovato');
  return src.slice(0, idx) + wrapped + '\n\n' + src.slice(idx);
});

fs.writeFileSync(idxPath, html);
console.log('✅ Iniettati:');
console.log('   - CSS  (' + cssBlock.length + ' char)');
console.log('   - HTML (' + htmlBlock.length + ' char)');
console.log('   - JS   (' + jsBlock.length + ' char)');
console.log('Totale index.html:', fs.statSync(idxPath).size, 'byte');
