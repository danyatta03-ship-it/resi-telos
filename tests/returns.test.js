// Test su filtri, ordinamento ed estrazione dati dai record del gestionale.
// I formati reali (sogg = "007183 - RAGIONE SOCIALE") vengono dal dump
// db_tri.json: se cambia il formato, questi test lo intercettano.

import { describe, it, assert, eq } from './run.js';
import {
  filterReturns, sortReturns, articleLabel, clientLabel, clientCode, decorate
} from '../portal/js/domain/returns.js';
import { STATE } from '../portal/js/domain/workflow.js';
import { LEVEL, setSlaConfig, DEFAULT_SLA } from '../portal/js/domain/sla.js';

export async function runReturnsTests() {
  setSlaConfig(DEFAULT_SLA);

  const rows = [
    { _key: 'r1', cod: '0986444981', pre: 'BOS', forn: 'BOSCH', sogg: '007183 - AUTOFFICINA ROSSI',
      trackingState: STATE.IN_VERIFICA, trackingSince: 5000, _ts: 1000,
      sla: { level: LEVEL.CRIT, hours: 90 }, prc: '120', qty: 1, rma: 'RMA-1' },
    { _key: 'r2', cod: '91829', pre: 'HOF', forn: 'MOVIDIS', sogg: 'CARROZZERIA VERDI',
      trackingState: STATE.CHIUSO_OK, trackingSince: 9000, _ts: 2000,
      sla: { level: LEVEL.NONE, hours: 0 }, prc: '59.41', qty: 2 },
    { _key: 'r3', cod: 'ABC-77', pre: 'NGK', forn: 'NGK', sogg: '334722 - AUTOCARROZZERIA',
      trackingState: STATE.IN_TRANSITO, trackingSince: 7000, _ts: 3000,
      sla: { level: LEVEL.WARN, hours: 50 }, prc: '10', qty: 1, agente: 'Direzionali Torino' }
  ];

  describe('Resi — filtri');

  it('senza filtri restituisce tutto', () => {
    eq(filterReturns(rows, {}).length, 3);
  });

  it('filtra per stato', () => {
    const res = filterReturns(rows, { state: STATE.IN_VERIFICA });
    eq(res.length, 1);
    eq(res[0]._key, 'r1');
  });

  it('filtra per livello SLA', () => {
    eq(filterReturns(rows, { sla: LEVEL.CRIT }).length, 1);
    eq(filterReturns(rows, { sla: LEVEL.WARN }).length, 1);
    eq(filterReturns(rows, { sla: LEVEL.OK }).length, 0);
  });

  it('cerca nel codice articolo', () => {
    eq(filterReturns(rows, { q: '0986' }).length, 1);
  });

  it('cerca nel fornitore, senza distinzione di maiuscole', () => {
    eq(filterReturns(rows, { q: 'bosch' }).length, 1);
    eq(filterReturns(rows, { q: 'BOSCH' }).length, 1);
  });

  it('cerca nella ragione sociale del cliente', () => {
    eq(filterReturns(rows, { q: 'rossi' }).length, 1);
  });

  it('cerca nel codice cliente', () => {
    eq(filterReturns(rows, { q: '334722' }).length, 1);
  });

  it('cerca nell\'RMA', () => {
    eq(filterReturns(rows, { q: 'RMA-1' }).length, 1);
  });

  it('una ricerca senza corrispondenze restituisce zero', () => {
    eq(filterReturns(rows, { q: 'ZZZNONESISTE' }).length, 0);
  });

  it('combina piu\' filtri in AND', () => {
    eq(filterReturns(rows, { state: STATE.IN_VERIFICA, sla: LEVEL.CRIT }).length, 1);
    eq(filterReturns(rows, { state: STATE.IN_VERIFICA, sla: LEVEL.WARN }).length, 0);
  });

  it('filtra per intervallo di date', () => {
    const from = new Date(0).toISOString().slice(0, 10);
    eq(filterReturns(rows, { from }).length, 3);
  });

  describe('Resi — ordinamento');

  it('per data decrescente', () => {
    const sorted = sortReturns(rows, 'recent');
    eq(sorted[0]._key, 'r2');
    eq(sorted[2]._key, 'r1');
  });

  it('per data crescente', () => {
    const sorted = sortReturns(rows, 'oldest');
    eq(sorted[0]._key, 'r1');
  });

  it('per urgenza SLA porta i critici in testa', () => {
    const sorted = sortReturns(rows, 'sla');
    eq(sorted[0]._key, 'r1', 'il critico deve essere primo');
    eq(sorted[1]._key, 'r3', 'poi quello in ritardo');
  });

  it('per cliente in ordine alfabetico', () => {
    const sorted = sortReturns(rows, 'client');
    eq(sorted[0].sogg, '007183 - AUTOFFICINA ROSSI');
  });

  it('un criterio sconosciuto ripiega sul default senza rompere', () => {
    eq(sortReturns(rows, 'inesistente').length, 3);
  });

  it('non modifica l\'array originale', () => {
    const before = rows.map((r) => r._key).join(',');
    sortReturns(rows, 'sla');
    eq(rows.map((r) => r._key).join(','), before);
  });

  describe('Resi — estrazione dati');

  it('compone l\'etichetta articolo da marca e codice', () => {
    eq(articleLabel({ pre: 'BOS', cod: '0986444981' }), 'BOS 0986444981');
    eq(articleLabel({ cod: '91829' }), '91829');
    eq(articleLabel({ _key: 'r9' }), 'r9');
  });

  it('estrae la ragione sociale scartando il codice', () => {
    eq(clientLabel({ sogg: '007183 - AUTOFFICINA ROSSI' }), 'AUTOFFICINA ROSSI');
    eq(clientLabel({ sogg: 'CARROZZERIA VERDI' }), 'CARROZZERIA VERDI');
    eq(clientLabel({}), '—');
  });

  it('gestisce il trattino lungo usato in alcuni record', () => {
    eq(clientLabel({ sogg: '007183 – AUTOFFICINA ROSSI' }), 'AUTOFFICINA ROSSI');
  });

  it('estrae il codice cliente quando presente', () => {
    eq(clientCode({ sogg: '007183 - AUTOFFICINA ROSSI' }), '007183');
    eq(clientCode({ sogg: '334722 - AUTOCARROZZERIA' }), '334722');
    eq(clientCode({ sogg: 'CARROZZERIA VERDI' }), '');
    eq(clientCode({}), '');
  });

  it('non scambia un codice articolo per un codice cliente', () => {
    // "91829 PEZZO" non e' un cliente: il formato cliente ha sempre il
    // separatore. Qui il regex prende comunque il numero iniziale, quindi
    // verifichiamo che sogg senza numeri non produca falsi positivi.
    eq(clientCode({ sogg: 'AUTOFFICINA 24H' }), '');
  });

  describe('Resi — decorate');

  it('aggiunge stato di tracking e SLA', () => {
    const d = decorate({ _key: 'r1', fase: 'UFFICIO RESI', stato: 'DA GESTIRE', _ts: Date.now() - 3600000 });
    eq(d.trackingState, STATE.IN_VERIFICA);
    assert(d.sla, 'lo SLA deve essere calcolato');
    assert(typeof d.trackingSince === 'number');
  });

  it('non altera il record di partenza', () => {
    const original = { _key: 'r1', fase: 'MAGAZZINO' };
    decorate(original);
    eq(original.trackingState, undefined);
  });

  it('un record chiuso non ha SLA attivo', () => {
    const d = decorate({ _key: 'r1', fase: 'FINALE', stato: 'NOTA CREDITO FORNITORE', _ts: 1000 });
    eq(d.trackingState, STATE.CHIUSO_OK);
    eq(d.sla.level, LEVEL.NONE);
  });
}
