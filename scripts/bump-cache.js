#!/usr/bin/env node
// scripts/bump-cache.js — aggiorna automaticamente il nome cache del Service
// Worker usando il git SHA corto del commit corrente.
//
// Sostituisce la riga:  var CACHE = 'resi-telos-XXXX';
// con:                  var CACHE = 'resi-telos-<hash>';
//
// Rende impossibile dimenticare il bump — basta chiamarlo dal pre-commit hook.
//
// Usage:
//   node scripts/bump-cache.js            → aggiorna sw.js con hash HEAD
//   node scripts/bump-cache.js --dry      → solo mostra cosa farebbe
//   node scripts/bump-cache.js --tag v34x → usa un tag specifico invece dell'hash
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const swFile = path.join(__dirname, '..', 'sw.js');
const dry = process.argv.includes('--dry');

// Legge il tag se passato con --tag, altrimenti usa git hash corto
let tag = null;
const tagIdx = process.argv.indexOf('--tag');
if (tagIdx > -1 && process.argv[tagIdx + 1]) {
  tag = process.argv[tagIdx + 1];
}

let version;
if (tag) {
  version = tag;
} else {
  try {
    version = execSync('git rev-parse --short HEAD', { cwd: path.dirname(swFile) })
      .toString()
      .trim();
  } catch (e) {
    console.error('❌ Impossibile ottenere git hash. Sei in un repo git?');
    process.exit(1);
  }
}

const content = fs.readFileSync(swFile, 'utf8');
const re = /var CACHE = 'resi-telos-([^']+)';/;
const m = content.match(re);
if (!m) {
  console.error('❌ Riga "var CACHE = \'resi-telos-XXX\';" non trovata in sw.js');
  process.exit(1);
}
const oldVersion = m[1];
const newContent = content.replace(re, `var CACHE = 'resi-telos-${version}';`);

console.log(`Cache SW: ${oldVersion} → ${version}`);

if (oldVersion === version) {
  console.log('✅ Nessun cambio (versione già aggiornata)');
  process.exit(0);
}

if (dry) {
  console.log('(dry run, non ho scritto)');
  process.exit(0);
}

fs.writeFileSync(swFile, newContent, 'utf8');
console.log('✅ sw.js aggiornato');
