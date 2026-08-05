#!/usr/bin/env node
// scripts/optimize-assets.js — Fase 4: ottimizzazione asset.
//
// Verifica e propone (o applica, con --apply) queste ottimizzazioni:
//
//   1) clients.json (4.7 MB) è nel precache del SW ma NON è mai fetchato
//      da index.html → sprecato in ogni installazione della PWA.
//   2) db_import.json e db_tri.json hanno lo STESSO contenuto (byte-identici),
//      ma sono duplicati sul disco (~2.7 MB × 2). index.html carica solo
//      db_tri.json; db_import.json è servito da dev-server per uso admin.
//      Proposta: mantenere solo db_tri.json e far leggere anche
//      dev-server da lì.
//
// Uso:
//   node scripts/optimize-assets.js            → analizza e stampa piano
//   node scripts/optimize-assets.js --apply    → applica (crea backup .bak)
//
// SAFETY:
//   - non tocca index.html
//   - non tocca db_tri.json, cli_data.json, client_agents.json (usati)
//   - --apply crea sempre backup .bak prima di modificare
//   - i file rimossi restano nella cronologia git (recuperabili)
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..');
const apply = process.argv.includes('--apply');

function abs(p){ return path.join(root, p); }
function exists(p){ try{ fs.accessSync(abs(p)); return true; }catch(e){ return false; } }
function size(p){ return exists(p) ? fs.statSync(abs(p)).size : 0; }
function fmtKB(b){ return (b/1024).toFixed(0) + ' KB'; }
function md5(p){
  return crypto.createHash('md5').update(fs.readFileSync(abs(p))).digest('hex');
}

console.log('══ Fase 4 — analisi asset ══\n');

// ── Check 1: clients.json ────────────────────────────────────────────
console.log('1) clients.json');
if(!exists('clients.json')){
  console.log('   ✅ già assente, nulla da fare\n');
} else {
  const s = size('clients.json');
  console.log('   ▸ presente (' + fmtKB(s) + ')');
  const idx = fs.readFileSync(abs('index.html'), 'utf8');
  const isReferenced = /clients\.json/.test(idx);
  console.log('   ▸ referenziato in index.html: ' + (isReferenced ? 'SÌ' : 'NO'));
  const sw = fs.readFileSync(abs('sw.js'), 'utf8');
  const inPrecache = /['"]\.\/clients\.json['"]/.test(sw);
  console.log('   ▸ nel precache SW: ' + (inPrecache ? 'SÌ' : 'NO'));
  if(!isReferenced && inPrecache){
    console.log('   ▶ Proposta: rimuovere da precache (spreca ' + fmtKB(s) + ' per installazione)');
    if(apply){
      fs.writeFileSync(abs('sw.js.bak'), sw);
      const newSw = sw.replace(/\s*['"]\.\/clients\.json['"],?\n?/g, '\n');
      fs.writeFileSync(abs('sw.js'), newSw);
      console.log('   ✅ sw.js aggiornato (backup: sw.js.bak)');
      // Il file .json resta sul disco: lo lascio all'utente decidere se rm.
      console.log('   ℹ  clients.json NON rimosso dal disco (git lo tiene comunque). rm manuale se vuoi.');
    }
  }
  console.log('');
}

// ── Check 2: db_import.json vs db_tri.json ───────────────────────────
console.log('2) db_import.json vs db_tri.json');
if(exists('db_import.json') && exists('db_tri.json')){
  const h1 = md5('db_import.json'), h2 = md5('db_tri.json');
  const s1 = size('db_import.json'), s2 = size('db_tri.json');
  console.log('   ▸ db_import.json: ' + fmtKB(s1) + ' md5=' + h1.slice(0,8));
  console.log('   ▸ db_tri.json:    ' + fmtKB(s2) + ' md5=' + h2.slice(0,8));
  if(h1 === h2){
    console.log('   ▶ IDENTICI. Proposta: rimuovere db_import.json dal precache SW');
    console.log('     (spreco: ' + fmtKB(s1) + ' × ogni installazione)');
    if(apply){
      const sw = fs.readFileSync(abs('sw.js'), 'utf8');
      if(!fs.existsSync(abs('sw.js.bak'))) fs.writeFileSync(abs('sw.js.bak'), sw);
      const newSw = sw.replace(/\s*['"]\.\/db_import\.json['"],?\n?/g, '\n');
      fs.writeFileSync(abs('sw.js'), newSw);
      console.log('   ✅ sw.js aggiornato');
      console.log('   ℹ  db_import.json NON rimosso dal disco (usato da dev-server.js).');
      console.log('       Vero cleanup: modificare dev-server.js per leggere da db_tri.json.');
    }
  } else {
    console.log('   ⚠ Diversi. Verifica manuale prima di dedupli-care.');
  }
  console.log('');
} else {
  console.log('   ✅ già ridotti\n');
}

// ── Check 3: lazy-load db_tri.json ───────────────────────────────────
console.log('3) db_tri.json (lazy-load)');
if(exists('db_tri.json')){
  const s = size('db_tri.json');
  console.log('   ▸ presente (' + fmtKB(s) + ')');
  console.log('   ▶ Proposta: caricare db_tri.json SOLO alla prima apertura del tab');
  console.log('     Trimestre, non all\'avvio. Beneficio: -' + fmtKB(s) + ' al primo paint.');
  console.log('   ▶ Non fattibile automaticamente — richiede refactor di index.html linee ~1486');
  console.log('     (fetch chain iniziale). Vedi docs/architecture.md Fase 5.');
  console.log('');
}

// ── Report finale ────────────────────────────────────────────────────
console.log('══ Fine analisi ══');
if(!apply){
  console.log('\n▶ Rilancia con --apply per applicare le modifiche automatiche (SW).');
}
