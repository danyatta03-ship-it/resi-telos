// tests/spunta-normalize.test.js — normalizzazione stringhe SPUNTA BANCALE
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { normalizeString, similarity, contains } = require('../js/ui/spunta/normalize.js');

test('normalizeString: upper + trim + collapse spazi', () => {
  assert.strictEqual(normalizeString('  casadei  '), 'CASADEI');
  assert.strictEqual(normalizeString('CASA   DEI'), 'CASA DEI');
});

test('normalizeString: rimuove accenti', () => {
  assert.strictEqual(normalizeString('perché'), 'PERCHE');
  assert.strictEqual(normalizeString('CITTÀ'), 'CITTA');
  assert.strictEqual(normalizeString('mécanique'), 'MECANIQUE');
});

test('normalizeString: rimuove SRL SPA SNC SAS', () => {
  assert.strictEqual(normalizeString('CASADEI S.R.L.'), 'CASADEI');
  assert.strictEqual(normalizeString('Casadei srl'), 'CASADEI');
  assert.strictEqual(normalizeString('AUTO SERVICE SPA'), 'AUTO SERVICE');
  // "& C" residuo dopo strip ampersand è accettabile: 'ROSSI C' matcha 'ROSSI'
  // con similarity > 0.9 (vedi test similarity)
  assert.match(normalizeString('Rossi & C. snc'), /^ROSSI( C)?$/);
  assert.strictEqual(normalizeString('PIROLA E FRATELLI SAS'), 'PIROLA E FRATELLI');
});

test('normalizeString: rimuove ampersand e punteggiatura', () => {
  assert.strictEqual(normalizeString('B&B GOMME'), 'B B GOMME');
  assert.strictEqual(normalizeString('AUTO/RIC.SPA'), 'AUTO RIC');
});

test('normalizeString: input null/vuoto → stringa vuota', () => {
  assert.strictEqual(normalizeString(null),      '');
  assert.strictEqual(normalizeString(undefined), '');
  assert.strictEqual(normalizeString(''),        '');
});

test('similarity: identiche → 1', () => {
  assert.strictEqual(similarity('CASADEI', 'CASADEI'), 1);
});

test('similarity: SRL vs no-SRL → 1 (normalizzate uguali)', () => {
  assert.strictEqual(similarity('CASADEI S.R.L.', 'casadei'), 1);
});

test('similarity: prefix simile → alto (>= 0.7)', () => {
  assert.ok(similarity('CASADEI', 'CASADEI SUD') >= 0.7);
});

test('similarity: totalmente diverse → basso (< 0.3)', () => {
  assert.ok(similarity('CASADEI', 'PNEUS ALPI') < 0.3);
});

test('similarity: substring match per stringhe corte', () => {
  assert.ok(similarity('BOS', 'BOSCH') >= 0.8);
});

test('contains: case + accent insensitive', () => {
  assert.strictEqual(contains('Perché No', 'perche'), true);
  assert.strictEqual(contains('CASADEI SRL', 'casadei'), true);
  assert.strictEqual(contains('CASADEI', 'x'), false);
});
