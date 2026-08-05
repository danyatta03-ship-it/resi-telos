// tests/storage.test.js — wrapper storage (fallback in-memory in Node)
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const storage = require('../js/data/storage.js');

// In Node non c'è localStorage → il wrapper cade sull'in-memory backend.
// Reset tra i test per isolarli.
function reset(){ storage._resetMemForTests(); }

test('KEYS: naming stabile', () => {
  assert.strictEqual(storage.KEYS.FORN, 'tf');
  assert.strictEqual(storage.KEYS.SOGG, 'ts');
  assert.strictEqual(storage.KEYS.MEM,  'tm');
});

test('getStr default vuoto se chiave mancante', () => {
  reset();
  assert.strictEqual(storage.getStr('nope'), '');
  assert.strictEqual(storage.getStr('nope', 'def'), 'def');
});

test('setStr/getStr round-trip', () => {
  reset();
  storage.setStr('k', 'ciao');
  assert.strictEqual(storage.getStr('k'), 'ciao');
});

test('setJSON/getJSON con oggetto', () => {
  reset();
  storage.setJSON('obj', { a: 1, b: [2, 3] });
  assert.deepStrictEqual(storage.getJSON('obj'), { a: 1, b: [2, 3] });
});

test('getJSON restituisce default se chiave mancante', () => {
  reset();
  assert.deepStrictEqual(storage.getJSON('missing', []), []);
  assert.strictEqual(storage.getJSON('missing'), undefined);
});

test('getJSON su stringa non-JSON → default (non lancia)', () => {
  reset();
  storage.setStr('k', 'non-json{');
  assert.deepStrictEqual(storage.getJSON('k', 'fallback'), 'fallback');
});

test('remove: idempotente', () => {
  reset();
  storage.setStr('k', 'v');
  storage.remove('k');
  assert.strictEqual(storage.getStr('k'), '');
  storage.remove('k'); // secondo remove non lancia
});

test('appendUnique aggiunge e non duplica', () => {
  reset();
  storage.appendUnique('list', 'A');
  storage.appendUnique('list', 'B');
  storage.appendUnique('list', 'A'); // già dentro
  assert.deepStrictEqual(storage.getJSON('list'), ['A', 'B']);
});

test('appendUnique ignora stringhe vuote', () => {
  reset();
  storage.appendUnique('list', '');
  storage.appendUnique('list', '  ');
  storage.appendUnique('list', 'X');
  assert.deepStrictEqual(storage.getJSON('list'), ['X']);
});

test('pushCapped rispetta il cap FIFO (unshift+truncate)', () => {
  reset();
  storage.pushCapped('log', { id: 1 }, 3);
  storage.pushCapped('log', { id: 2 }, 3);
  storage.pushCapped('log', { id: 3 }, 3);
  storage.pushCapped('log', { id: 4 }, 3);
  const arr = storage.getJSON('log');
  assert.strictEqual(arr.length, 3);
  assert.strictEqual(arr[0].id, 4); // ultimo inserito in cima
  assert.strictEqual(arr[2].id, 2); // id 1 espulso
});
