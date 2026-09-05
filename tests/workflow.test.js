// Test della macchina a stati del tracking.
// E' il cuore delle regole di business: se qui passa qualcosa che non
// dovrebbe, un corriere puo' chiudere una pratica o un cliente approvare
// il proprio reso.

import { describe, it, assert, eq } from './run.js';
import {
  STATE, STATE_META, STATE_ORDER,
  validateTransition, canTransition, allowedTransitions,
  deriveFromGestionale, effectiveState,
  isTerminal, stateStep, requiresNote, isState, stateLabel
} from '../portal/js/domain/workflow.js';

export async function runWorkflowTests() {
  describe('Workflow — integrita\' della definizione');

  it('ogni stato dichiarato ha i metadati completi', () => {
    for (const key in STATE) {
      const meta = STATE_META[STATE[key]];
      assert(meta, 'metadati mancanti per ' + key);
      assert(meta.label, 'label mancante per ' + key);
      assert(meta.color, 'colore mancante per ' + key);
      assert(typeof meta.step === 'number', 'step mancante per ' + key);
    }
  });

  it('STATE_ORDER contiene solo stati validi', () => {
    for (const s of STATE_ORDER) assert(isState(s), 'stato sconosciuto in STATE_ORDER: ' + s);
  });

  it('gli stati terminali sono esattamente tre', () => {
    const terminals = Object.keys(STATE_META).filter((s) => STATE_META[s].terminal);
    eq(terminals.length, 3);
    assert(terminals.includes('CHIUSO_OK'));
    assert(terminals.includes('CHIUSO_NR'));
    assert(terminals.includes('RIFIUTATO'));
  });

  describe('Workflow — transizioni consentite');

  it('Telos puo\' approvare una richiesta', () => {
    assert(canTransition(STATE.RICHIESTO, STATE.APPROVATO, 'TELOS'));
  });

  it('il cliente NON puo\' approvare la propria richiesta', () => {
    const res = validateTransition(STATE.RICHIESTO, STATE.APPROVATO, 'CLIENTE');
    eq(res.ok, false);
    assert(/CLIENTE/.test(res.reason), 'il motivo deve citare il ruolo');
  });

  it('il corriere puo\' segnare un ritiro ma non approvare', () => {
    assert(canTransition(STATE.ATTESA_RITIRO, STATE.RITIRATO, 'CORRIERE'));
    assert(!canTransition(STATE.RICHIESTO, STATE.APPROVATO, 'CORRIERE'));
  });

  it('il corriere NON puo\' chiudere la pratica', () => {
    assert(!canTransition(STATE.IN_VERIFICA, STATE.CHIUSO_OK, 'CORRIERE'));
    assert(!canTransition(STATE.IN_LAVORAZIONE, STATE.CHIUSO_OK, 'CORRIERE'));
  });

  it('il cliente NON puo\' chiudere ne\' rifiutare', () => {
    assert(!canTransition(STATE.IN_VERIFICA, STATE.CHIUSO_OK, 'CLIENTE'));
    assert(!canTransition(STATE.RICHIESTO, STATE.RIFIUTATO, 'CLIENTE'));
  });

  it('il cliente puo\' aprire una contestazione', () => {
    assert(canTransition(STATE.CHIUSO_NR, STATE.CONTESTATO, 'CLIENTE'));
    assert(canTransition(STATE.IN_VERIFICA, STATE.CONTESTATO, 'CLIENTE'));
  });

  it('non si salta dallo stato iniziale alla chiusura', () => {
    eq(validateTransition(STATE.RICHIESTO, STATE.CHIUSO_OK, 'ADMIN').ok, false);
  });

  it('non si torna indietro da RITIRATO ad APPROVATO', () => {
    eq(validateTransition(STATE.RITIRATO, STATE.APPROVATO, 'ADMIN').ok, false);
  });

  it('una transizione verso lo stesso stato viene respinta', () => {
    const res = validateTransition(STATE.RITIRATO, STATE.RITIRATO, 'ADMIN');
    eq(res.ok, false);
    assert(/gia'/.test(res.reason));
  });

  it('uno stato di destinazione inventato viene respinto', () => {
    eq(validateTransition(STATE.RICHIESTO, 'PIPPO', 'ADMIN').ok, false);
  });

  it('uno stato di partenza inventato viene respinto', () => {
    eq(validateTransition('PIPPO', STATE.APPROVATO, 'ADMIN').ok, false);
  });

  it('un ruolo mancante viene respinto', () => {
    eq(validateTransition(STATE.RICHIESTO, STATE.APPROVATO, null).ok, false);
    eq(validateTransition(STATE.RICHIESTO, STATE.APPROVATO, '').ok, false);
  });

  it('un ruolo inventato non passa', () => {
    eq(validateTransition(STATE.RICHIESTO, STATE.APPROVATO, 'SUPERUSER').ok, false);
  });

  describe('Workflow — stato iniziale');

  it('la prima transizione deve essere verso RICHIESTO', () => {
    assert(validateTransition(null, STATE.RICHIESTO, 'CLIENTE').ok);
    eq(validateTransition(null, STATE.APPROVATO, 'CLIENTE').ok, false);
    eq(validateTransition(null, STATE.CHIUSO_OK, 'ADMIN').ok, false);
  });

  it('il corriere non puo\' aprire una pratica', () => {
    eq(validateTransition(null, STATE.RICHIESTO, 'CORRIERE').ok, false);
  });

  describe('Workflow — allowedTransitions');

  it('elenca solo cio\' che il ruolo puo\' davvero fare', () => {
    const forCourier = allowedTransitions(STATE.RITIRATO, 'CORRIERE');
    assert(forCourier.includes(STATE.IN_TRANSITO));
    assert(forCourier.includes(STATE.CONSEGNATO));
    assert(!forCourier.includes(STATE.CHIUSO_OK));
  });

  it('ogni transizione elencata e\' effettivamente valida', () => {
    const roles = ['ADMIN', 'TELOS', 'CLIENTE', 'AGENTE', 'CORRIERE'];
    for (const from of Object.keys(STATE_META)) {
      for (const role of roles) {
        for (const to of allowedTransitions(from, role)) {
          assert(canTransition(from, to, role),
            'incoerenza: ' + role + ' ' + from + '→' + to + ' elencata ma non valida');
        }
      }
    }
  });

  it('nessun ruolo esterno puo\' raggiungere uno stato di chiusura', () => {
    for (const role of ['CLIENTE', 'AGENTE', 'CORRIERE']) {
      for (const from of Object.keys(STATE_META)) {
        const targets = allowedTransitions(from, role);
        assert(!targets.includes(STATE.CHIUSO_OK), role + ' puo\' chiudere da ' + from);
        assert(!targets.includes(STATE.CHIUSO_NR), role + ' puo\' chiudere NR da ' + from);
      }
    }
  });

  it('nessun ruolo esterno puo\' rifiutare una richiesta', () => {
    for (const role of ['CLIENTE', 'AGENTE', 'CORRIERE']) {
      for (const from of Object.keys(STATE_META)) {
        assert(!allowedTransitions(from, role).includes(STATE.RIFIUTATO),
          role + ' puo\' rifiutare da ' + from);
      }
    }
  });

  describe('Workflow — derivazione dal gestionale');

  it('FINALE + NON RENDIBILE → CHIUSO_NR', () => {
    eq(deriveFromGestionale({ fase: 'FINALE', stato: 'NON RENDIBILE - FUORI TEMPISTICA' }), STATE.CHIUSO_NR);
    eq(deriveFromGestionale({ fase: 'FINALE', stato: 'NON RENDIBILE - TUTTE LE CASISTICHE' }), STATE.CHIUSO_NR);
  });

  it('FINALE con esito positivo → CHIUSO_OK', () => {
    eq(deriveFromGestionale({ fase: 'FINALE', stato: 'NOTA CREDITO FORNITORE' }), STATE.CHIUSO_OK);
    eq(deriveFromGestionale({ fase: 'FINALE', stato: 'VENDUTO CLIENTE' }), STATE.CHIUSO_OK);
  });

  it('le altre fasi mappano sugli stati intermedi', () => {
    eq(deriveFromGestionale({ fase: 'MAGAZZINO', stato: 'CHIUDERE' }), STATE.IN_LAVORAZIONE);
    eq(deriveFromGestionale({ fase: 'UFFICIO RESI', stato: 'DA GESTIRE ⏳' }), STATE.IN_VERIFICA);
    eq(deriveFromGestionale({ fase: 'RICEVIMENTO', stato: 'DA GESTIRE ⏳' }), STATE.CONSEGNATO);
  });

  it('una fase sconosciuta non produce uno stato inventato', () => {
    eq(deriveFromGestionale({ fase: 'PIPPO', stato: 'X' }), null);
    eq(deriveFromGestionale({}), null);
    eq(deriveFromGestionale(null), null);
  });

  it('la derivazione tollera maiuscole/minuscole e spazi', () => {
    eq(deriveFromGestionale({ fase: '  magazzino ', stato: 'chiudere' }), STATE.IN_LAVORAZIONE);
  });

  describe('Workflow — stato effettivo');

  it('il lavoro interno fa avanzare il tracking', () => {
    // Il corriere aveva segnato "ritirato", ma intanto la merce e' arrivata
    // e l'ufficio la sta verificando: vince lo stato piu' avanzato.
    const row = { fase: 'UFFICIO RESI', stato: 'DA GESTIRE ⏳' };
    eq(effectiveState(row, STATE.RITIRATO), STATE.IN_VERIFICA);
  });

  it('lo stato del portale non viene perso se e\' piu\' avanti', () => {
    // Il corriere ha consegnato ma nessuno ha ancora lavorato la pratica.
    const row = { fase: 'RICEVIMENTO', stato: 'DA GESTIRE ⏳' };
    eq(effectiveState(row, STATE.CONSEGNATO), STATE.CONSEGNATO);
  });

  it('una contestazione ha sempre la precedenza', () => {
    const row = { fase: 'FINALE', stato: 'NOTA CREDITO FORNITORE' };
    eq(effectiveState(row, STATE.CONTESTATO), STATE.CONTESTATO);
  });

  it('senza stato portale si usa la derivazione', () => {
    eq(effectiveState({ fase: 'MAGAZZINO' }, null), STATE.IN_LAVORAZIONE);
  });

  it('senza dati si parte da RICHIESTO', () => {
    eq(effectiveState({}, null), STATE.RICHIESTO);
  });

  describe('Workflow — note obbligatorie');

  it('rifiuto, contestazione e chiusura NR richiedono una motivazione', () => {
    assert(requiresNote(STATE.RIFIUTATO));
    assert(requiresNote(STATE.CONTESTATO));
    assert(requiresNote(STATE.CHIUSO_NR));
  });

  it('le transizioni ordinarie non la richiedono', () => {
    assert(!requiresNote(STATE.APPROVATO));
    assert(!requiresNote(STATE.RITIRATO));
    assert(!requiresNote(STATE.CHIUSO_OK));
  });

  describe('Workflow — progressione');

  it('gli step crescono lungo il flusso nominale', () => {
    for (let i = 1; i < STATE_ORDER.length; i++) {
      assert(stateStep(STATE_ORDER[i]) > stateStep(STATE_ORDER[i - 1]),
        'step non crescente fra ' + STATE_ORDER[i - 1] + ' e ' + STATE_ORDER[i]);
    }
  });

  it('gli stati terminali sono riconosciuti', () => {
    assert(isTerminal(STATE.CHIUSO_OK));
    assert(isTerminal(STATE.CHIUSO_NR));
    assert(isTerminal(STATE.RIFIUTATO));
    assert(!isTerminal(STATE.IN_TRANSITO));
    assert(!isTerminal(STATE.CONTESTATO));
  });

  it('da uno stato terminale si puo\' solo contestare', () => {
    for (const role of ['CLIENTE', 'AGENTE']) {
      const fromOk = allowedTransitions(STATE.CHIUSO_OK, role);
      eq(fromOk.length, 1);
      eq(fromOk[0], STATE.CONTESTATO);
    }
  });

  it('stateLabel non restituisce mai vuoto', () => {
    for (const s of Object.keys(STATE_META)) assert(stateLabel(s).length > 0);
    eq(stateLabel(null), '—');
  });
}
