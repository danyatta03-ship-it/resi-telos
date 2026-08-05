// tests/bus.test.js — event bus
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { createBus } = require('../js/core/bus.js');

test('bus.on + emit consegna il dato ai listener', () => {
  const bus = createBus();
  let got = null;
  bus.on('rows:changed', d => { got = d; });
  const n = bus.emit('rows:changed', { key: 'ABC' });
  assert.deepStrictEqual(got, { key: 'ABC' });
  assert.strictEqual(n, 1);
});

test('bus.on ritorna unsubscribe che rimuove il listener', () => {
  const bus = createBus();
  let count = 0;
  const un = bus.on('x', () => count++);
  bus.emit('x'); bus.emit('x');
  un();
  bus.emit('x');
  assert.strictEqual(count, 2);
});

test('bus.off rimuove listener specifico', () => {
  const bus = createBus();
  let a = 0, b = 0;
  const fnA = () => a++;
  const fnB = () => b++;
  bus.on('x', fnA); bus.on('x', fnB);
  bus.off('x', fnA);
  bus.emit('x');
  assert.strictEqual(a, 0);
  assert.strictEqual(b, 1);
});

test('bus.once auto-rimuove dopo la prima emissione', () => {
  const bus = createBus();
  let n = 0;
  bus.once('x', () => n++);
  bus.emit('x'); bus.emit('x'); bus.emit('x');
  assert.strictEqual(n, 1);
});

test('bus emette a più listener nello stesso evento', () => {
  const bus = createBus();
  const seen = [];
  bus.on('e', () => seen.push('a'));
  bus.on('e', () => seen.push('b'));
  bus.on('e', () => seen.push('c'));
  const n = bus.emit('e');
  assert.deepStrictEqual(seen, ['a','b','c']);
  assert.strictEqual(n, 3);
});

test('un listener che lancia NON blocca gli altri', () => {
  const bus = createBus();
  let ok = false;
  // silenzio l'output di console.error durante il test
  const orig = console.error; console.error = () => {};
  try{
    bus.on('e', () => { throw new Error('boom'); });
    bus.on('e', () => { ok = true; });
    bus.emit('e');
  } finally { console.error = orig; }
  assert.strictEqual(ok, true);
});

test('un listener che si disiscrive durante emit non altera l\'iterazione', () => {
  const bus = createBus();
  let a = 0, b = 0;
  const unA = bus.on('e', () => { a++; unA(); });
  bus.on('e', () => { b++; });
  bus.emit('e');
  bus.emit('e');
  assert.strictEqual(a, 1); // ha fatto una sola volta
  assert.strictEqual(b, 2); // b però riceve entrambe
});

test('bus.clear() rimuove tutto; bus.clear(name) solo un evento', () => {
  const bus = createBus();
  bus.on('a', () => {}); bus.on('b', () => {});
  bus.clear('a');
  assert.strictEqual(bus._listenerCount('a'), 0);
  assert.strictEqual(bus._listenerCount('b'), 1);
  bus.clear();
  assert.strictEqual(bus._listenerCount('b'), 0);
});

test('emit senza listener → 0 (nessun errore)', () => {
  const bus = createBus();
  assert.strictEqual(bus.emit('nada'), 0);
});
