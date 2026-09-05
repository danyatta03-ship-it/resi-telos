// Test del calcolo SLA. La parte delicata e' il conteggio in ore lavorative:
// un errore qui produce ritardi fantasma il lunedi mattina, e i clienti se ne
// accorgono subito.

import { describe, it, assert, eq, near } from './run.js';
import {
  businessHoursBetween, evaluate, setSlaConfig, getSlaConfig,
  DEFAULT_SLA, LEVEL, formatHours, levelLabel, configurableStates
} from '../portal/js/domain/sla.js';
import { STATE } from '../portal/js/domain/workflow.js';

// Helper: costruisce una data locale. Mese 1-based per leggibilita'.
function d(year, month, day, hour = 0, minute = 0) {
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
}

export async function runSlaTests() {
  describe('SLA — ore lavorative');

  it('conta le ore dentro la giornata lavorativa', () => {
    // Lunedi 5 gennaio 2026, 09:00 → 12:00
    near(businessHoursBetween(d(2026, 1, 5, 9), d(2026, 1, 5, 12)), 3, 0.01);
  });

  it('ignora le ore prima dell\'apertura', () => {
    // 06:00 → 10:00 : contano solo le 2 ore dopo le 08:00
    near(businessHoursBetween(d(2026, 1, 5, 6), d(2026, 1, 5, 10)), 2, 0.01);
  });

  it('ignora le ore dopo la chiusura', () => {
    // 16:00 → 22:00 : contano solo le 2 ore fino alle 18:00
    near(businessHoursBetween(d(2026, 1, 5, 16), d(2026, 1, 5, 22)), 2, 0.01);
  });

  it('una giornata piena vale 10 ore', () => {
    near(businessHoursBetween(d(2026, 1, 5, 0), d(2026, 1, 5, 23, 59)), 10, 0.02);
  });

  it('salta il fine settimana', () => {
    // Venerdi 9 gen ore 17 → Lunedi 12 gen ore 9.
    // Venerdi: 17→18 = 1h. Sabato e domenica: 0. Lunedi: 8→9 = 1h. Totale 2h.
    near(businessHoursBetween(d(2026, 1, 9, 17), d(2026, 1, 12, 9)), 2, 0.02);
  });

  it('un weekend intero non produce ore', () => {
    // Sabato 10 gen → domenica 11 gen
    near(businessHoursBetween(d(2026, 1, 10, 8), d(2026, 1, 11, 18)), 0, 0.01);
  });

  it('somma i giorni infrasettimanali', () => {
    // Lunedi 08:00 → mercoledi 18:00 = 3 giornate piene = 30h
    near(businessHoursBetween(d(2026, 1, 5, 8), d(2026, 1, 7, 18)), 30, 0.05);
  });

  it('un intervallo nullo o invertito vale zero', () => {
    eq(businessHoursBetween(d(2026, 1, 5, 10), d(2026, 1, 5, 10)), 0);
    eq(businessHoursBetween(d(2026, 1, 5, 15), d(2026, 1, 5, 9)), 0);
  });

  it('regge intervalli lunghi senza esplodere', () => {
    // Un anno intero: il ciclo interno ha una guardia, non deve andare in loop.
    const hours = businessHoursBetween(d(2025, 1, 1, 8), d(2026, 1, 1, 8));
    assert(hours > 2000 && hours < 3000, 'ore fuori range plausibile: ' + hours);
  });

  describe('SLA — valutazione');

  it('sotto la soglia di avviso lo stato e\' OK', () => {
    setSlaConfig({ CONSEGNATO: { warnHours: 16, critHours: 40 } });
    // Lunedi 09:00 → lunedi 14:00 = 5h lavorative
    const res = evaluate(STATE.CONSEGNATO, d(2026, 1, 5, 9), d(2026, 1, 5, 14));
    eq(res.level, LEVEL.OK);
    near(res.hours, 5, 0.02);
    eq(res.overBy, 0);
  });

  it('superata la soglia di avviso passa a WARN', () => {
    setSlaConfig({ CONSEGNATO: { warnHours: 16, critHours: 40 } });
    // Lunedi 08:00 → mercoledi 10:00 = 10 + 10 + 2 = 22h
    const res = evaluate(STATE.CONSEGNATO, d(2026, 1, 5, 8), d(2026, 1, 7, 10));
    eq(res.level, LEVEL.WARN);
    near(res.hours, 22, 0.05);
    near(res.overBy, 6, 0.05);
  });

  it('superata la soglia critica passa a CRIT', () => {
    setSlaConfig({ CONSEGNATO: { warnHours: 16, critHours: 40 } });
    // Lunedi 08:00 → lunedi successivo 08:00 = 5 giornate = 50h
    const res = evaluate(STATE.CONSEGNATO, d(2026, 1, 5, 8), d(2026, 1, 12, 8));
    eq(res.level, LEVEL.CRIT);
    near(res.hours, 50, 0.1);
    near(res.overBy, 10, 0.1);
  });

  it('gli stati terminali non hanno SLA', () => {
    const res = evaluate(STATE.CHIUSO_OK, d(2020, 1, 1, 8), d(2026, 1, 1, 8));
    eq(res.level, LEVEL.NONE);
  });

  it('senza timestamp di partenza non si valuta', () => {
    eq(evaluate(STATE.CONSEGNATO, 0, Date.now()).level, LEVEL.NONE);
    eq(evaluate(STATE.CONSEGNATO, null, Date.now()).level, LEVEL.NONE);
  });

  it('uno stato senza soglie configurate non produce falsi allarmi', () => {
    eq(evaluate('STATO_INESISTENTE', d(2020, 1, 1), Date.now()).level, LEVEL.NONE);
  });

  it('la percentuale di consumo resta nel range 0-100', () => {
    setSlaConfig({ CONSEGNATO: { warnHours: 16, critHours: 40 } });
    const late = evaluate(STATE.CONSEGNATO, d(2026, 1, 5, 8), d(2026, 1, 26, 8));
    assert(late.pct >= 0 && late.pct <= 100, 'pct fuori range: ' + late.pct);
    eq(late.pct, 100);
  });

  describe('SLA — configurazione');

  it('accetta soglie valide', () => {
    setSlaConfig({ RICHIESTO: { warnHours: 4, critHours: 12 } });
    eq(getSlaConfig().RICHIESTO.warnHours, 4);
    eq(getSlaConfig().RICHIESTO.critHours, 12);
  });

  it('scarta valori non numerici o negativi tornando al default', () => {
    setSlaConfig({ RICHIESTO: { warnHours: 'pippo', critHours: 12 } });
    eq(getSlaConfig().RICHIESTO.warnHours, DEFAULT_SLA.RICHIESTO.warnHours);
    setSlaConfig({ RICHIESTO: { warnHours: -5, critHours: 12 } });
    eq(getSlaConfig().RICHIESTO.warnHours, DEFAULT_SLA.RICHIESTO.warnHours);
  });

  it('impedisce che la soglia critica sia sotto quella di avviso', () => {
    setSlaConfig({ RICHIESTO: { warnHours: 20, critHours: 5 } });
    const cfg = getSlaConfig().RICHIESTO;
    assert(cfg.critHours >= cfg.warnHours, 'crit deve essere >= warn');
  });

  it('gli stati non menzionati tornano ai default', () => {
    setSlaConfig({ RICHIESTO: { warnHours: 4, critHours: 12 } });
    eq(getSlaConfig().IN_TRANSITO.warnHours, DEFAULT_SLA.IN_TRANSITO.warnHours);
  });

  it('una config nulla non rompe nulla', () => {
    setSlaConfig(null);
    setSlaConfig(undefined);
    assert(getSlaConfig().RICHIESTO, 'la config deve restare utilizzabile');
  });

  it('gli stati configurabili escludono i terminali', () => {
    const list = configurableStates();
    assert(!list.includes(STATE.CHIUSO_OK));
    assert(!list.includes(STATE.CHIUSO_NR));
    assert(!list.includes(STATE.RIFIUTATO));
    assert(list.includes(STATE.RICHIESTO));
  });

  describe('SLA — formattazione');

  it('formatta ore e giorni in modo leggibile', () => {
    eq(formatHours(0), '—');
    eq(formatHours(0.5), '30min');
    eq(formatHours(5), '5h');
    eq(formatHours(10), '1g');
    eq(formatHours(15), '1g 5h');
    eq(formatHours(20), '2g');
  });

  it('le etichette di livello ci sono per tutti i casi', () => {
    for (const l of [LEVEL.OK, LEVEL.WARN, LEVEL.CRIT, LEVEL.NONE]) {
      assert(levelLabel(l).length > 0, 'etichetta mancante per ' + l);
    }
  });

  // Ripristino i default: gli altri file di test non devono ereditare
  // una configurazione manomessa.
  setSlaConfig(DEFAULT_SLA);
}
