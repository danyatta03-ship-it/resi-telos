// tests/utils.test.js — helper puri di js/core/utils.js
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const u = require('../js/core/utils.js');

test('xe: escape HTML', () => {
  assert.strictEqual(u.xe('<b>x</b>'), '&lt;b&gt;x&lt;/b&gt;');
  assert.strictEqual(u.xe('"a&b"'),    '&quot;a&amp;b&quot;');
  assert.strictEqual(u.xe(null),        '');
  assert.strictEqual(u.xe(undefined),   '');
  assert.strictEqual(u.xe(0),           '0');
});

test('fd: ISO → DD/MM/YYYY', () => {
  assert.strictEqual(u.fd('2026-08-05'), '05/08/2026');
  assert.strictEqual(u.fd('2026-08-05T14:30:00Z'), '05/08/2026');
  assert.strictEqual(u.fd(''), '');
  assert.strictEqual(u.fd(null), '');
});

test('nprc: virgola o punto, isFinite check', () => {
  assert.strictEqual(u.nprc('12,50'), 12.5);
  assert.strictEqual(u.nprc('12.50'), 12.5);
  assert.strictEqual(u.nprc(42),      42);
  assert.strictEqual(u.nprc('abc'),    0);
  assert.strictEqual(u.nprc(''),       0);
  assert.strictEqual(u.nprc(null),     0);
  assert.strictEqual(u.nprc(Infinity), 0);
});

test('eur: vuoto se ≤ 0', () => {
  assert.strictEqual(u.eur(12.5),   '€12.50');
  assert.strictEqual(u.eur('12,3'), '€12.30');
  assert.strictEqual(u.eur(0),      '');
  assert.strictEqual(u.eur(-1),     '');
  assert.strictEqual(u.eur(''),     '');
});

test('addBusinessDays: 5 gg da lunedì → lunedì successivo', () => {
  const mon = new Date('2026-08-03T09:00:00Z'); // lunedì
  const out = u.addBusinessDays(mon, 5);
  assert.strictEqual(out.getUTCDay(), 1); // lunedì
  assert.strictEqual(out.getUTCDate(), 10);
});

test('addBusinessDays: salta sabato e domenica', () => {
  const fri = new Date('2026-08-07T09:00:00Z'); // venerdì
  const out = u.addBusinessDays(fri, 1);
  assert.strictEqual(out.getUTCDay(), 1); // lunedì successivo
});

test('_fmtDDMMYYYY: formatta timestamp', () => {
  const ts = new Date('2026-01-09T12:00:00Z').getTime();
  const s = u._fmtDDMMYYYY(ts);
  // dipende dal fuso, controlliamo solo la forma DD/MM/YYYY
  assert.match(s, /^\d{2}\/\d{2}\/\d{4}$/);
});
