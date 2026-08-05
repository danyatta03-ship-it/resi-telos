// tests/spunta-matcher.test.js — logica di match SPUNTA BANCALE
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { findMatch, lookupCliData } = require('../js/ui/spunta/matcher.js');

const LISTA = [
  { id:1, mittente:'CASADEI S.R.L.',    citta:'VERRES',           colliAttesi:1 },
  { id:2, mittente:'AUTO SERVICE SPA',  citta:'AOSTA',            colliAttesi:2 },
  { id:3, mittente:'GARAGE BIANCHI',    citta:'IVREA',            colliAttesi:1 },
  { id:4, mittente:'PNEUS ALPI',        citta:'COURMAYEUR',       colliAttesi:1 },
  { id:5, mittente:'MECC. ROSSI',       citta:'CHATILLON',        colliAttesi:1 },
  { id:6, mittente:'CASADEI SUD SRL',   citta:'PALERMO',          colliAttesi:1 }
];

test('findMatch: single match esatto', () => {
  const out = findMatch('PNEUS ALPI', LISTA);
  assert.strictEqual(out.match, 'single');
  assert.strictEqual(out.rows[0].id, 4);
});

test('findMatch: single match tollerante a SRL', () => {
  const out = findMatch('AUTO SERVICE', LISTA);
  assert.strictEqual(out.match, 'single');
  assert.strictEqual(out.rows[0].id, 2);
});

test('findMatch: match con etichetta OCR "CASADEI SRL - VERRES"', () => {
  const out = findMatch('CASADEI SRL - VERRES', LISTA);
  assert.strictEqual(out.match, 'single');
  assert.strictEqual(out.rows[0].id, 1);
});

test('findMatch: multi quando due CASADEI simili (senza città)', () => {
  const out = findMatch('CASADEI', LISTA);
  assert.strictEqual(out.match, 'multi');
  const ids = out.rows.map(r => r.id).sort();
  assert.ok(ids.includes(1));
  assert.ok(ids.includes(6));
});

test('findMatch: multi risolto a single quando la città è fornita', () => {
  const out = findMatch('CASADEI - PALERMO', LISTA);
  assert.strictEqual(out.match, 'single');
  assert.strictEqual(out.rows[0].id, 6);
});

test('findMatch: nessun match → none', () => {
  const out = findMatch('AZIENDA INESISTENTE', LISTA);
  assert.strictEqual(out.match, 'none');
  assert.strictEqual(out.rows.length, 0);
});

test('findMatch: input vuoto → none (non lancia)', () => {
  assert.strictEqual(findMatch('', LISTA).match, 'none');
  assert.strictEqual(findMatch(null, LISTA).match, 'none');
});

test('findMatch: lista vuota → none', () => {
  assert.strictEqual(findMatch('CASADEI', []).match, 'none');
});

test('findMatch: match tollerante ad accenti nella città', () => {
  const out = findMatch('MECC ROSSI - Chatillón', LISTA);
  assert.strictEqual(out.match, 'single');
  assert.strictEqual(out.rows[0].id, 5);
});

test('findMatch: score decrescente nei multi', () => {
  const out = findMatch('CASADEI', LISTA);
  if(out.match === 'multi'){
    for(let i = 1; i < out.scores.length; i++){
      assert.ok(out.scores[i - 1] >= out.scores[i], 'score non decrescenti');
    }
  }
});

// ── lookupCliData ────────────────────────────────────────────────────
test('lookupCliData: trova cliente per nome fuzzy', () => {
  const cli = {
    '009820': { nome: 'CASADEI SRL', citta: 'VERRES' },
    '014102': { nome: 'AUTO SERVICE SPA', citta: 'AOSTA' },
    '022300': { nome: 'GARAGE BIANCHI', citta: 'IVREA' }
  };
  const out = lookupCliData('CASADEI', cli);
  assert.ok(out);
  assert.strictEqual(out.codice, '009820');
});

test('lookupCliData: se nulla supera 0.75 → null', () => {
  const cli = { '000001': { nome: 'ROSSI' } };
  assert.strictEqual(lookupCliData('PNEUS ALPI', cli), null);
});
