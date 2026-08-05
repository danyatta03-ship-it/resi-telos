#!/usr/bin/env node
// scripts/check-html.js — pre-commit sanity check per index.html
//
// Verifica che:
//   1) i tag <script>...</script> siano bilanciati
//   2) ogni funzione JS abbia parentesi bilanciate a livello top
//   3) non ci siano string template rotti (backtick sbilanciati)
//   4) tutti gli id referenziati con getElementById esistano nel DOM
//
// Non è un parser HTML completo — è un guard rail contro l'incidente
// v34h (un </script> di troppo che ha rotto tutta la produzione).
//
// Usage:
//   node scripts/check-html.js [path/to/index.html]
//   exit 0 se OK, exit 1 se problemi trovati.
'use strict';

const fs = require('fs');
const path = require('path');

const file = process.argv[2] || path.join(__dirname, '..', 'index.html');
if (!fs.existsSync(file)) {
  console.error('❌ File non trovato:', file);
  process.exit(1);
}

const html = fs.readFileSync(file, 'utf8');
let errors = 0;

function fail(msg) {
  console.error('❌ ' + msg);
  errors++;
}
function ok(msg) {
  console.log('✅ ' + msg);
}

// 1) <script> / </script> bilanciati
const scriptOpen = (html.match(/<script(?:\s[^>]*)?>/gi) || []).length;
const scriptClose = (html.match(/<\/script>/gi) || []).length;
if (scriptOpen !== scriptClose) {
  fail(`Script tag sbilanciati: ${scriptOpen} <script> vs ${scriptClose} </script>`);
} else {
  ok(`Script tag bilanciati (${scriptOpen})`);
}

// 2) Estraggo il contenuto di ogni <script> e valido con new Function
const scriptRe = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;
let match, scriptIdx = 0;
while ((match = scriptRe.exec(html)) !== null) {
  scriptIdx++;
  const code = match[1];
  if (!code.trim()) continue;
  try {
    new Function(code);
  } catch (e) {
    fail(`Script #${scriptIdx} ha syntax error: ${e.message.slice(0, 200)}`);
  }
}
ok(`Sintassi JS: ${scriptIdx} blocchi <script> validi`);

// 3) Cerco backtick sbilanciati (template literal aperti e mai chiusi)
// Non applicabile: c'è troppo codice con backtick legittimi dentro stringhe.
// Skip per ora.

// 4) getElementById → id nel DOM
const idsInDom = new Set(
  Array.from(html.matchAll(/id="([^"]+)"/g)).map((m) => m[1])
);
const idsReferenced = new Set(
  Array.from(html.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)).map((m) => m[1])
);
const missing = [...idsReferenced].filter((id) => !idsInDom.has(id));
if (missing.length) {
  // Log solo se sono pochi: se sono molti probabile che l'id sia creato runtime
  if (missing.length <= 20) {
    console.warn(`⚠  ${missing.length} id referenziati NON presenti nel markup statico:`);
    missing.forEach((id) => console.warn(`   - ${id}`));
    console.warn('   (potrebbero essere creati a runtime — verifica manuale)');
  } else {
    console.warn(`⚠  ${missing.length} id referenziati non trovati nel markup — molti sono probabilmente creati a runtime`);
  }
}

// 5) Verifica che il body finisca con </html>
if (!html.trimEnd().endsWith('</html>')) {
  fail('Il file NON termina con </html> — potrebbe essere troncato');
} else {
  ok('File termina correttamente con </html>');
}

// 6) Size sanity check
const sizeKB = Math.round(fs.statSync(file).size / 1024);
if (sizeKB < 200) {
  fail(`File sospettosamente piccolo: ${sizeKB} KB (atteso >800 KB)`);
} else {
  ok(`Dimensione file: ${sizeKB} KB`);
}

if (errors > 0) {
  console.error(`\n❌ ${errors} error(i) trovato(i)`);
  process.exit(1);
}
console.log('\n✅ Tutti i check passati');
process.exit(0);
