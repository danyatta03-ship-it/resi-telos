// Test della timeline. L'idempotenza degli id e' cio' che rende sicura la
// coda offline: rigiocare la stessa operazione non deve creare doppioni.

import { describe, it, assert, eq } from './run.js';
import { eventId, ACTION, ACTION_META, lastStateChange, currentPortalState, actionLabel } from '../portal/js/domain/timeline.js';
import { STATE } from '../portal/js/domain/workflow.js';

export async function runTimelineTests() {
  describe('Timeline — idempotenza degli id');

  it('stessi input producono lo stesso id', () => {
    const ts = Date.UTC(2026, 0, 5, 10, 30, 0);
    const a = eventId('r123', 'uid1', 'STATE_CHANGE', 'RICHIESTO>APPROVATO', ts);
    const b = eventId('r123', 'uid1', 'STATE_CHANGE', 'RICHIESTO>APPROVATO', ts);
    eq(a, b);
  });

  it('due click nello stesso minuto collassano in un solo evento', () => {
    const base = Date.UTC(2026, 0, 5, 10, 30, 0);
    const a = eventId('r123', 'uid1', 'STATE_CHANGE', 'X>Y', base);
    const b = eventId('r123', 'uid1', 'STATE_CHANGE', 'X>Y', base + 25000);
    eq(a, b, 'entro lo stesso minuto l\'id deve coincidere');
  });

  it('a distanza di minuti sono eventi distinti', () => {
    const base = Date.UTC(2026, 0, 5, 10, 30, 0);
    const a = eventId('r123', 'uid1', 'STATE_CHANGE', 'X>Y', base);
    const b = eventId('r123', 'uid1', 'STATE_CHANGE', 'X>Y', base + 120000);
    assert(a !== b, 'minuti diversi devono dare id diversi');
  });

  it('resi diversi non collidono', () => {
    const ts = Date.UTC(2026, 0, 5, 10, 30, 0);
    assert(eventId('r1', 'uid1', 'NOTE', 'x', ts) !== eventId('r2', 'uid1', 'NOTE', 'x', ts));
  });

  it('attori diversi non collidono', () => {
    const ts = Date.UTC(2026, 0, 5, 10, 30, 0);
    assert(eventId('r1', 'uidA', 'NOTE', 'x', ts) !== eventId('r1', 'uidB', 'NOTE', 'x', ts));
  });

  it('azioni diverse non collidono', () => {
    const ts = Date.UTC(2026, 0, 5, 10, 30, 0);
    assert(eventId('r1', 'uid1', 'NOTE', 'x', ts) !== eventId('r1', 'uid1', 'MESSAGE', 'x', ts));
  });

  it('transizioni diverse non collidono', () => {
    const ts = Date.UTC(2026, 0, 5, 10, 30, 0);
    const a = eventId('r1', 'uid1', 'STATE_CHANGE', 'RICHIESTO>APPROVATO', ts);
    const b = eventId('r1', 'uid1', 'STATE_CHANGE', 'RICHIESTO>RIFIUTATO', ts);
    assert(a !== b);
  });

  it('gli id sono ordinabili cronologicamente', () => {
    // Firebase ordina le chiavi lessicograficamente: se il prefisso e'
    // corretto, la timeline arriva gia' in ordine senza sort lato client.
    const t1 = Date.UTC(2026, 0, 5, 10, 0, 0);
    const t2 = Date.UTC(2026, 0, 5, 11, 0, 0);
    const t3 = Date.UTC(2026, 5, 5, 10, 0, 0);
    const ids = [
      eventId('r1', 'u', 'NOTE', 'a', t3),
      eventId('r1', 'u', 'NOTE', 'a', t1),
      eventId('r1', 'u', 'NOTE', 'a', t2)
    ];
    const sorted = ids.slice().sort();
    eq(sorted[0], ids[1], 'il piu vecchio deve venire per primo');
    eq(sorted[2], ids[0], 'il piu recente deve venire per ultimo');
  });

  it('gli id non contengono caratteri vietati da Firebase', () => {
    const id = eventId('r1', 'uid-1', 'STATE_CHANGE', 'A>B', Date.now());
    for (const ch of ['.', '#', '$', '/', '[', ']']) {
      assert(id.indexOf(ch) < 0, 'carattere vietato nell\'id: ' + ch);
    }
  });

  describe('Timeline — lettura dello stato');

  const events = [
    { ts: 1000, action: ACTION.CREATED, actor: 'u1' },
    { ts: 2000, action: ACTION.STATE_CHANGE, from: '', to: STATE.RICHIESTO, actor: 'u1' },
    { ts: 3000, action: ACTION.MESSAGE, actor: 'u2' },
    { ts: 4000, action: ACTION.STATE_CHANGE, from: STATE.RICHIESTO, to: STATE.APPROVATO, actor: 'u2' },
    { ts: 5000, action: ACTION.DOCUMENT, actor: 'u1' }
  ];

  it('trova l\'ultimo cambio di stato', () => {
    const last = lastStateChange(events);
    assert(last, 'deve trovarne uno');
    eq(last.to, STATE.APPROVATO);
    eq(last.ts, 4000);
  });

  it('ricava lo stato corrente del portale', () => {
    eq(currentPortalState(events), STATE.APPROVATO);
  });

  it('senza cambi di stato non inventa nulla', () => {
    const only = [{ ts: 1, action: ACTION.MESSAGE }, { ts: 2, action: ACTION.NOTE }];
    eq(lastStateChange(only), null);
    eq(currentPortalState(only), null);
  });

  it('una timeline vuota non genera errori', () => {
    eq(lastStateChange([]), null);
    eq(currentPortalState([]), null);
  });

  it('ignora i cambi di stato senza destinazione', () => {
    const broken = [
      { ts: 1, action: ACTION.STATE_CHANGE, to: STATE.RICHIESTO },
      { ts: 2, action: ACTION.STATE_CHANGE, to: '' }
    ];
    eq(currentPortalState(broken), STATE.RICHIESTO);
  });

  describe('Timeline — metadati azioni');

  it('ogni azione ha etichetta e icona', () => {
    for (const key in ACTION) {
      const meta = ACTION_META[ACTION[key]];
      assert(meta, 'metadati mancanti per ' + key);
      assert(meta.label && meta.icon, 'label o icona mancante per ' + key);
    }
  });

  it('actionLabel non restituisce mai vuoto', () => {
    eq(actionLabel(ACTION.CREATED), 'Pratica aperta');
    eq(actionLabel('SCONOSCIUTA'), 'SCONOSCIUTA');
  });
}
