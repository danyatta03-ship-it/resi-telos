// tests/sync.test.js — merge locale ↔ remote
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const sync = require('../js/data/sync.js');

test('mergeSnapshot: chiavi solo locali → mantenute', () => {
  const out = sync.mergeSnapshot({ a: { _key:'a', _ts:1 } }, {});
  assert.deepStrictEqual(out.rows.a, { _key:'a', _ts:1 });
  assert.deepStrictEqual(out.changed, []);
});

test('mergeSnapshot: chiavi solo remote → aggiunte + changed', () => {
  const out = sync.mergeSnapshot({}, { b: { _key:'b', _ts:2 } });
  assert.deepStrictEqual(out.rows.b, { _key:'b', _ts:2 });
  assert.deepStrictEqual(out.changed, ['b']);
});

test('mergeSnapshot: last-write-wins (remote più recente)', () => {
  const l = { x: { _key:'x', _ts:10, v:'local' } };
  const r = { x: { _key:'x', _ts:20, v:'remote' } };
  const out = sync.mergeSnapshot(l, r);
  assert.strictEqual(out.rows.x.v, 'remote');
  assert.deepStrictEqual(out.changed, ['x']);
});

test('mergeSnapshot: last-write-wins (local più recente)', () => {
  const l = { x: { _key:'x', _ts:30, v:'local' } };
  const r = { x: { _key:'x', _ts:20, v:'remote' } };
  const out = sync.mergeSnapshot(l, r);
  assert.strictEqual(out.rows.x.v, 'local');
  assert.deepStrictEqual(out.changed, []);
});

test('mergeSnapshot: record _frozen mai sovrascritto', () => {
  const l = { s: { _key:'s', _ts:1, _frozen:true, v:'storico' } };
  const r = { s: { _key:'s', _ts:100, v:'remote' } };
  const out = sync.mergeSnapshot(l, r);
  assert.strictEqual(out.rows.s.v, 'storico');
  assert.strictEqual(out.rows.s._frozen, true);
  assert.deepStrictEqual(out.changed, []);
});

test('isPublishable: richiede _key e fase', () => {
  assert.strictEqual(sync.isPublishable(null), false);
  assert.strictEqual(sync.isPublishable({}), false);
  assert.strictEqual(sync.isPublishable({ _key:'x' }), false);
  assert.strictEqual(sync.isPublishable({ _key:'x', fase:'RICEVIMENTO' }), true);
});
