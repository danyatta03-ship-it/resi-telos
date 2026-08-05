// tests/domain-rules.test.js — unit test regole di dominio Resi Telos.
//
// Non richiede JSDOM: le funzioni in js/domain/rules.js sono pure.
// Girare con:  node --test tests/
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const rules = require('../js/domain/rules.js');

// ═════════════════════════════════════════════════════════════════════
// Permessi
// ═════════════════════════════════════════════════════════════════════

test('canEditRow — RIC modifica RICEVIMENTO, non oltre', () => {
  assert.strictEqual(rules.canEditRow({ fase:'RICEVIMENTO' }, 'RIC'), true);
  assert.strictEqual(rules.canEditRow({ fase:'UFFICIO RESI' }, 'RIC'), false);
  assert.strictEqual(rules.canEditRow({ fase:'MAGAZZINO'    }, 'RIC'), false);
  assert.strictEqual(rules.canEditRow({ fase:'FINALE'       }, 'RIC'), false);
});

test('canEditRow — UFF modifica tutto (comprese FINALE)', () => {
  ['RICEVIMENTO','UFFICIO RESI','MAGAZZINO','FINALE'].forEach(f => {
    assert.strictEqual(rules.canEditRow({ fase:f }, 'UFF'), true, 'fase '+f);
  });
});

test('canEditRow — MAG modifica fino a MAGAZZINO, non FINALE', () => {
  assert.strictEqual(rules.canEditRow({ fase:'MAGAZZINO' }, 'MAG'), true);
  assert.strictEqual(rules.canEditRow({ fase:'FINALE'    }, 'MAG'), false);
});

test('canEditRow — record STORICO (_frozen) solo UFF e ADM', () => {
  const r = { fase:'FINALE', _frozen:true };
  assert.strictEqual(rules.canEditRow(r, 'RIC'), false);
  assert.strictEqual(rules.canEditRow(r, 'MAG'), false);
  assert.strictEqual(rules.canEditRow(r, 'UFF'), true);
  assert.strictEqual(rules.canEditRow(r, 'ADM'), true);
});

test('canEditRow — riga vuota / senza fase → false', () => {
  assert.strictEqual(rules.canEditRow(null, 'ADM'), false);
  assert.strictEqual(rules.canEditRow({}, 'ADM'),  false);
});

test('canAdv — segue NEXT_FASE se il ruolo può portarcela', () => {
  assert.strictEqual(rules.canAdv({ fase:'RICEVIMENTO' }, 'RIC'), 'UFFICIO RESI');
  assert.strictEqual(rules.canAdv({ fase:'RICEVIMENTO' }, 'UFF'), 'UFFICIO RESI');
  assert.strictEqual(rules.canAdv({ fase:'UFFICIO RESI' }, 'RIC'), '', 'RIC non può portare a MAG');
  assert.strictEqual(rules.canAdv({ fase:'MAGAZZINO' }, 'MAG'), 'FINALE');
  assert.strictEqual(rules.canAdv({ fase:'FINALE' }, 'ADM'), '', 'niente dopo FINALE');
});

test('canBack — solo se canSendBack; UFF→RIC solo ADM', () => {
  assert.strictEqual(rules.canBack({ fase:'UFFICIO RESI' }, 'RIC'), '', 'RIC non ha canSendBack');
  assert.strictEqual(rules.canBack({ fase:'UFFICIO RESI' }, 'UFF'), '', 'UFF non torna a RIC');
  assert.strictEqual(rules.canBack({ fase:'UFFICIO RESI' }, 'ADM'), 'RICEVIMENTO');
  assert.strictEqual(rules.canBack({ fase:'MAGAZZINO' }, 'UFF'), 'UFFICIO RESI');
  assert.strictEqual(rules.canBack({ fase:'FINALE' }, 'ADM'), 'MAGAZZINO');
  assert.strictEqual(rules.canBack({ fase:'RICEVIMENTO' }, 'ADM'), '', 'niente prima di RIC');
});

// ═════════════════════════════════════════════════════════════════════
// parseGiorniReso
// ═════════════════════════════════════════════════════════════════════

test('parseGiorniReso — accetta N e "N H"', () => {
  assert.strictEqual(rules.parseGiorniReso('10'),   10);
  assert.strictEqual(rules.parseGiorniReso('48'),   48);
  assert.strictEqual(rules.parseGiorniReso('48H'),   2);
  assert.strictEqual(rules.parseGiorniReso('48 H'),  2);
  assert.strictEqual(rules.parseGiorniReso('24 h'),  1);
});

test('parseGiorniReso — 12H arrotondato a 1 giorno (minimo)', () => {
  assert.strictEqual(rules.parseGiorniReso('12H'), 1);
});

test('parseGiorniReso — input vuoto/invalido → null', () => {
  assert.strictEqual(rules.parseGiorniReso(''),      null);
  assert.strictEqual(rules.parseGiorniReso(null),    null);
  assert.strictEqual(rules.parseGiorniReso('boh'),   null);
});

// ═════════════════════════════════════════════════════════════════════
// checkForzaNonRendibile
// ═════════════════════════════════════════════════════════════════════

const DB_GAR = {
  'ACME':   { valoreMin: 50, giorni: '30' },
  'BOSCH':  { valoreMin: 0,  giorni: '48H' },
  'DELPHI': { valoreMin:100, giorni: null   }
};

test('checkForzaNonRendibile — fornitore mancante o non in DB → null', () => {
  assert.strictEqual(rules.checkForzaNonRendibile({}, DB_GAR), null);
  assert.strictEqual(rules.checkForzaNonRendibile({ forn:'IGNOTO', prc:10 }, DB_GAR), null);
});

test('checkForzaNonRendibile — prezzo sotto valoreMin → PREZZO INFERIORE', () => {
  const out = rules.checkForzaNonRendibile({ forn:'ACME', prc: 30 }, DB_GAR);
  assert.ok(out, 'expected non-null');
  assert.strictEqual(out.motivo, 'PREZZO INFERIORE');
  assert.match(out.why, /30\.00.*50\.00.*ACME/);
});

test('checkForzaNonRendibile — prezzo == valoreMin → rendibile', () => {
  assert.strictEqual(rules.checkForzaNonRendibile({ forn:'ACME', prc: 50 }, DB_GAR), null);
});

test('checkForzaNonRendibile — prezzo mancante NON forza PREZZO INFERIORE', () => {
  assert.strictEqual(rules.checkForzaNonRendibile({ forn:'ACME', prc: 0 }, DB_GAR), null);
});

test('checkForzaNonRendibile — FUORI TEMPISTICHE se datAcqForn oltre giorni_reso', () => {
  // now = 2026-08-05, acq = 2026-07-01 → 35 gg > 30 → NR
  const nowMs = new Date('2026-08-05T12:00:00Z').getTime();
  const out = rules.checkForzaNonRendibile(
    { forn:'ACME', prc:100, datAcqForn:'2026-07-01' }, DB_GAR, nowMs
  );
  assert.ok(out, 'expected non-null');
  assert.strictEqual(out.motivo, 'FUORI TEMPISTICHE');
  assert.match(out.why, /2026-07-01/);
});

test('checkForzaNonRendibile — dentro tempistiche → null', () => {
  // now = 2026-08-05, acq = 2026-07-20 → 16 gg <= 30 → OK
  const nowMs = new Date('2026-08-05T12:00:00Z').getTime();
  assert.strictEqual(
    rules.checkForzaNonRendibile({ forn:'ACME', prc:100, datAcqForn:'2026-07-20' }, DB_GAR, nowMs),
    null
  );
});

test('checkForzaNonRendibile — PREZZO ha precedenza su FUORI TEMPISTICHE', () => {
  const nowMs = new Date('2026-08-05T12:00:00Z').getTime();
  const out = rules.checkForzaNonRendibile(
    { forn:'ACME', prc:10, datAcqForn:'2026-01-01' }, DB_GAR, nowMs
  );
  assert.strictEqual(out.motivo, 'PREZZO INFERIORE');
});

test('checkForzaNonRendibile — senza garanzieDb → null (nessun blocco)', () => {
  assert.strictEqual(rules.checkForzaNonRendibile({ forn:'ACME', prc:1 }, null), null);
});

test('checkForzaNonRendibile — case-insensitive sul nome fornitore', () => {
  const out = rules.checkForzaNonRendibile({ forn:'acme', prc:10 }, DB_GAR);
  assert.ok(out);
  assert.strictEqual(out.motivo, 'PREZZO INFERIORE');
});

// ═════════════════════════════════════════════════════════════════════
// findDuplicate
// ═════════════════════════════════════════════════════════════════════

test('findDuplicate — trova stessa (cod, forn) attive', () => {
  const active = [
    { cod:'ABC123', forn:'ACME', fase:'UFFICIO RESI' },
    { cod:'XYZ',    forn:'ACME', fase:'RICEVIMENTO' }
  ];
  const dup = rules.findDuplicate({ cod:'abc123', forn:'acme' }, active);
  assert.ok(dup);
  assert.strictEqual(dup.cod, 'ABC123');
});

test('findDuplicate — pratiche FINALI non contano come duplicati', () => {
  const active = [{ cod:'ABC', forn:'ACME', fase:'FINALE' }];
  assert.strictEqual(rules.findDuplicate({ cod:'ABC', forn:'ACME' }, active), null);
});

test('findDuplicate — nessun match', () => {
  const active = [{ cod:'XYZ', forn:'BOSCH', fase:'UFFICIO RESI' }];
  assert.strictEqual(rules.findDuplicate({ cod:'ABC', forn:'ACME' }, active), null);
});

// ═════════════════════════════════════════════════════════════════════
// checkCoerenzaFlusso
// ═════════════════════════════════════════════════════════════════════

test('checkCoerenzaFlusso — ANOMALIA + DA GESTIRE in RIC → blocco (v34v)', () => {
  const out = rules.checkCoerenzaFlusso({
    fase:'RICEVIMENTO', flusso:'ANOMALIA', stato:'DA GESTIRE ⏳'
  });
  assert.ok(out);
  assert.strictEqual(out.err, 'FLUSSO_INCOERENTE');
});

test('checkCoerenzaFlusso — ANOMALIA + altro stato → OK', () => {
  const out = rules.checkCoerenzaFlusso({
    fase:'RICEVIMENTO', flusso:'ANOMALIA', stato:'ANOMALIA RICEVIMENTO'
  });
  assert.strictEqual(out, null);
});

test('checkCoerenzaFlusso — STANDARD + DA GESTIRE → OK', () => {
  assert.strictEqual(rules.checkCoerenzaFlusso({
    fase:'RICEVIMENTO', flusso:'STANDARD', stato:'DA GESTIRE ⏳'
  }), null);
});
