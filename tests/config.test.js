// tests/config.test.js — sanità della config statica
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const c = require('../js/core/config.js');

test('ROLE_PERMS: 4 ruoli attesi', () => {
  assert.deepStrictEqual(Object.keys(c.ROLE_PERMS).sort(), ['ADM','MAG','RIC','UFF']);
});

test('STATI: le 4 fasi hanno almeno uno stato', () => {
  ['RICEVIMENTO','UFFICIO RESI','MAGAZZINO','FINALE'].forEach(f => {
    assert.ok(Array.isArray(c.STATI[f]));
    assert.ok(c.STATI[f].length > 0, 'fase ' + f + ' vuota');
  });
});

test('FASI_ORDER e NEXT_FASE coerenti', () => {
  assert.deepStrictEqual(c.FASI_ORDER, ['RICEVIMENTO','UFFICIO RESI','MAGAZZINO','FINALE']);
  assert.strictEqual(c.NEXT_FASE['RICEVIMENTO'],  'UFFICIO RESI');
  assert.strictEqual(c.NEXT_FASE['UFFICIO RESI'], 'MAGAZZINO');
  assert.strictEqual(c.NEXT_FASE['MAGAZZINO'],    'FINALE');
  assert.strictEqual(c.NEXT_FASE['FINALE'],       undefined);
});

test('subsForCausale: GARANZIA family → sotto-cat dedicate', () => {
  const g = c.subsForCausale('GARANZIA');
  assert.ok(g.includes('FUORI GARANZIA'));
  const m = c.subsForCausale('GARANZIA MANODOPERA');
  assert.ok(m.includes('MANCA RICEVUTA'));
  // Case insensitive
  assert.deepStrictEqual(c.subsForCausale('garanzia'), g);
});

test('subsForCausale: causale generica → ANOMALIE_GEN', () => {
  const a = c.subsForCausale('ERRATA SPEDIZIONE');
  assert.strictEqual(a, c.ANOMALIE_GEN);
  assert.ok(a.includes('BOLLA MANCANTE'));
});

test('CAULIST include tutte e 3 le garanzie', () => {
  ['GARANZIA','GARANZIA MANODOPERA','GARANZIA DANNI E MANODOPERA'].forEach(g => {
    assert.ok(c.CAULIST.includes(g), 'manca ' + g);
  });
});

test('HDR: 29 colonne canoniche', () => {
  assert.strictEqual(c.HDR.length, 29);
  assert.strictEqual(c.HDR[0], 'Data Listato');
  assert.strictEqual(c.HDR[14], 'FASE');
  assert.strictEqual(c.HDR[15], 'STATO');
});

test('SLA: soglie sensate (warn < crit)', () => {
  assert.ok(c.SLA_WARN > 0);
  assert.ok(c.SLA_CRIT > c.SLA_WARN);
});

test('ROLE_PERMS.RIC: solo tab pgIns e pgList', () => {
  assert.deepStrictEqual(c.ROLE_PERMS.RIC.canSeeTabs, ['pgIns','pgList']);
  assert.strictEqual(c.ROLE_PERMS.RIC.canEditFasi.length, 1);
});

test('ROLE_PERMS.ADM: vede e modifica tutto', () => {
  assert.strictEqual(c.ROLE_PERMS.ADM.canDelete, true);
  assert.strictEqual(c.ROLE_PERMS.ADM.canViewAll, true);
  assert.ok(c.ROLE_PERMS.ADM.canEditFasi.includes('FINALE'));
});
