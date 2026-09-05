// Macchina a stati del TRACKING.
//
// Perche' uno stato separato da fase/stato del gestionale?
// Il gestionale descrive la lavorazione INTERNA (RICEVIMENTO → UFFICIO RESI →
// MAGAZZINO → FINALE, 40 stati). Cliente, agente e corriere non hanno bisogno
// di quel dettaglio e in molti casi non devono nemmeno vederlo. Il tracking e'
// una vista esterna, piu' grossolana e stabile: 12 stati che raccontano "dov'e'
// il mio reso" senza esporre la meccanica interna.
//
// I due mondi restano allineati cosi':
//   • gestionale → tracking : deriveFromGestionale() mappa fase/stato sullo
//     stato di tracking. E' automatica: nessuno deve fare doppio lavoro.
//   • tracking → gestionale : NON scriviamo mai fase/stato. Le azioni esterne
//     (richiesta ritiro, presa corriere, contestazione) vivono solo nella
//     timeline del portale. Il gestionale non viene toccato.

export const STATE = {
  RICHIESTO:     'RICHIESTO',
  APPROVATO:     'APPROVATO',
  RIFIUTATO:     'RIFIUTATO',
  ATTESA_RITIRO: 'ATTESA_RITIRO',
  RITIRATO:      'RITIRATO',
  IN_TRANSITO:   'IN_TRANSITO',
  CONSEGNATO:    'CONSEGNATO',
  IN_VERIFICA:   'IN_VERIFICA',
  IN_LAVORAZIONE:'IN_LAVORAZIONE',
  CHIUSO_OK:     'CHIUSO_OK',
  CHIUSO_NR:     'CHIUSO_NR',
  CONTESTATO:    'CONTESTATO'
};

export const STATE_ORDER = [
  STATE.RICHIESTO,
  STATE.APPROVATO,
  STATE.ATTESA_RITIRO,
  STATE.RITIRATO,
  STATE.IN_TRANSITO,
  STATE.CONSEGNATO,
  STATE.IN_VERIFICA,
  STATE.IN_LAVORAZIONE,
  STATE.CHIUSO_OK
];

export const STATE_META = {
  RICHIESTO:      { label: 'Richiesto',        icon: '📝', color: '#8FA4B8', step: 1,
                    desc: 'Richiesta di reso inviata, in attesa di approvazione Telos.' },
  APPROVATO:      { label: 'Approvato',        icon: '✅', color: '#2ECC71', step: 2,
                    desc: 'Telos ha approvato il reso.' },
  RIFIUTATO:      { label: 'Rifiutato',        icon: '⛔', color: '#E05555', step: 2, terminal: true,
                    desc: 'Richiesta non accolta.' },
  ATTESA_RITIRO:  { label: 'Attesa ritiro',    icon: '📦', color: '#E6B03C', step: 3,
                    desc: 'In attesa che il corriere effettui il ritiro.' },
  RITIRATO:       { label: 'Ritirato',         icon: '🚚', color: '#3B9FD4', step: 4,
                    desc: 'Merce ritirata dal corriere.' },
  IN_TRANSITO:    { label: 'In transito',      icon: '🛣️', color: '#3B9FD4', step: 5,
                    desc: 'Spedizione in viaggio verso Telos.' },
  CONSEGNATO:     { label: 'Consegnato',       icon: '🏢', color: '#5BB8E0', step: 6,
                    desc: 'Merce arrivata in sede Telos.' },
  IN_VERIFICA:    { label: 'In verifica',      icon: '🔍', color: '#5BB8E0', step: 7,
                    desc: 'Ufficio resi sta verificando la pratica.' },
  IN_LAVORAZIONE: { label: 'In lavorazione',   icon: '⚙️', color: '#9B6BD4', step: 8,
                    desc: 'Pratica in lavorazione presso il magazzino.' },
  CHIUSO_OK:      { label: 'Chiuso',           icon: '🏁', color: '#2ECC71', step: 9, terminal: true,
                    desc: 'Pratica chiusa con esito positivo.' },
  CHIUSO_NR:      { label: 'Non rendibile',    icon: '🚫', color: '#E05555', step: 9, terminal: true,
                    desc: 'Reso non accettato: merce non rendibile.' },
  CONTESTATO:     { label: 'Contestato',       icon: '⚠️', color: '#E6B03C', step: 0,
                    desc: 'Contestazione aperta, in attesa di risoluzione.' }
};

export const TOTAL_STEPS = 9;

// Transizioni ammesse: stato → { stato successivo → ruoli autorizzati }.
// Un ruolo non elencato non puo' fare quella transizione, punto.
const TRANSITIONS = {
  RICHIESTO: {
    APPROVATO:  ['ADMIN', 'TELOS'],
    RIFIUTATO:  ['ADMIN', 'TELOS'],
    CONTESTATO: ['ADMIN', 'TELOS', 'CLIENTE', 'AGENTE']
  },
  APPROVATO: {
    ATTESA_RITIRO: ['ADMIN', 'TELOS'],
    RITIRATO:      ['ADMIN', 'TELOS', 'CORRIERE'],
    CONTESTATO:    ['ADMIN', 'TELOS', 'CLIENTE', 'AGENTE']
  },
  RIFIUTATO: {
    CONTESTATO: ['ADMIN', 'TELOS', 'CLIENTE', 'AGENTE'],
    RICHIESTO:  ['ADMIN']
  },
  ATTESA_RITIRO: {
    RITIRATO:   ['ADMIN', 'TELOS', 'CORRIERE'],
    CONTESTATO: ['ADMIN', 'TELOS', 'CLIENTE', 'AGENTE', 'CORRIERE']
  },
  RITIRATO: {
    IN_TRANSITO: ['ADMIN', 'TELOS', 'CORRIERE'],
    CONSEGNATO:  ['ADMIN', 'TELOS', 'CORRIERE'],
    CONTESTATO:  ['ADMIN', 'TELOS', 'CLIENTE', 'AGENTE', 'CORRIERE']
  },
  IN_TRANSITO: {
    CONSEGNATO: ['ADMIN', 'TELOS', 'CORRIERE'],
    CONTESTATO: ['ADMIN', 'TELOS', 'CLIENTE', 'AGENTE', 'CORRIERE']
  },
  CONSEGNATO: {
    IN_VERIFICA: ['ADMIN', 'TELOS'],
    CONTESTATO:  ['ADMIN', 'TELOS', 'CLIENTE', 'AGENTE']
  },
  IN_VERIFICA: {
    IN_LAVORAZIONE: ['ADMIN', 'TELOS'],
    CHIUSO_OK:      ['ADMIN', 'TELOS'],
    CHIUSO_NR:      ['ADMIN', 'TELOS'],
    CONTESTATO:     ['ADMIN', 'TELOS', 'CLIENTE', 'AGENTE']
  },
  IN_LAVORAZIONE: {
    CHIUSO_OK:  ['ADMIN', 'TELOS'],
    CHIUSO_NR:  ['ADMIN', 'TELOS'],
    CONTESTATO: ['ADMIN', 'TELOS', 'CLIENTE', 'AGENTE']
  },
  CHIUSO_OK: {
    CONTESTATO: ['ADMIN', 'TELOS', 'CLIENTE', 'AGENTE']
  },
  CHIUSO_NR: {
    CONTESTATO: ['ADMIN', 'TELOS', 'CLIENTE', 'AGENTE']
  },
  CONTESTATO: {
    IN_VERIFICA: ['ADMIN', 'TELOS'],
    CHIUSO_OK:   ['ADMIN', 'TELOS'],
    CHIUSO_NR:   ['ADMIN', 'TELOS'],
    RIFIUTATO:   ['ADMIN', 'TELOS']
  }
};

export function isState(value) {
  return Object.prototype.hasOwnProperty.call(STATE_META, value);
}

export function stateLabel(value) {
  return (STATE_META[value] && STATE_META[value].label) || value || '—';
}

export function stateColor(value) {
  return (STATE_META[value] && STATE_META[value].color) || '#888';
}

export function stateIcon(value) {
  return (STATE_META[value] && STATE_META[value].icon) || '•';
}

export function isTerminal(value) {
  return !!(STATE_META[value] && STATE_META[value].terminal);
}

export function stateStep(value) {
  return (STATE_META[value] && STATE_META[value].step) || 0;
}

// Transizioni possibili da uno stato per un dato ruolo.
export function allowedTransitions(from, role) {
  const table = TRANSITIONS[from];
  if (!table) return [];
  return Object.keys(table).filter((to) => table[to].indexOf(role) >= 0);
}

// Validazione completa di una transizione. Ritorna { ok, reason }.
// Nessuna scrittura avviene senza passare di qui.
export function validateTransition(from, to, role) {
  if (!isState(to)) return { ok: false, reason: 'Stato di destinazione sconosciuto: ' + to };
  if (!role) return { ok: false, reason: 'Ruolo mancante' };
  if (from === to) return { ok: false, reason: 'Il reso e\' gia\' in questo stato' };
  if (!from) {
    // Stato iniziale: solo RICHIESTO, e solo chi puo' aprire una richiesta.
    if (to !== STATE.RICHIESTO) return { ok: false, reason: 'Lo stato iniziale deve essere RICHIESTO' };
    if (['ADMIN', 'TELOS', 'CLIENTE', 'AGENTE'].indexOf(role) < 0) {
      return { ok: false, reason: 'Il ruolo ' + role + ' non puo\' aprire una richiesta' };
    }
    return { ok: true };
  }
  if (!isState(from)) return { ok: false, reason: 'Stato di partenza sconosciuto: ' + from };
  const table = TRANSITIONS[from];
  if (!table || !table[to]) {
    return { ok: false, reason: 'Transizione non ammessa: ' + stateLabel(from) + ' → ' + stateLabel(to) };
  }
  if (table[to].indexOf(role) < 0) {
    return { ok: false, reason: 'Il ruolo ' + role + ' non puo\' passare a ' + stateLabel(to) };
  }
  return { ok: true };
}

export function canTransition(from, to, role) {
  return validateTransition(from, to, role).ok;
}

// ── Derivazione dallo stato del gestionale ──────────────────────────────
// Un reso creato dagli operatori interni non passa da una richiesta cliente:
// nasce direttamente in RICEVIMENTO. Qui gli diamo uno stato di tracking
// sensato senza chiedere a nessuno di ridigitarlo.

export function deriveFromGestionale(row) {
  if (!row) return null;
  const fase = String(row.fase || '').toUpperCase().trim();
  const stato = String(row.stato || '').toUpperCase().trim();

  if (fase === 'FINALE') {
    if (stato.indexOf('NON RENDIBILE') >= 0) return STATE.CHIUSO_NR;
    return STATE.CHIUSO_OK;
  }
  if (fase === 'MAGAZZINO') return STATE.IN_LAVORAZIONE;
  if (fase === 'UFFICIO RESI') return STATE.IN_VERIFICA;
  if (fase === 'RICEVIMENTO') return STATE.CONSEGNATO;
  return null;
}

// Lo stato di tracking effettivo di un reso.
// Priorita': lo stato esplicito del portale vince SOLO se e' piu' avanti di
// quello derivato dal gestionale, oppure se e' una contestazione. Cosi' il
// lavoro interno fa sempre progredire il tracking, ma una presa in carico
// registrata dal corriere non viene cancellata dalla derivazione.
export function effectiveState(row, portalState) {
  const derived = deriveFromGestionale(row);
  if (portalState === STATE.CONTESTATO) return STATE.CONTESTATO;
  if (!portalState) return derived || STATE.RICHIESTO;
  if (!derived) return portalState;
  return stateStep(derived) >= stateStep(portalState) ? derived : portalState;
}

// Etichetta dell'azione mostrata sul bottone di transizione.
export const ACTION_LABEL = {
  APPROVATO:      'Approva',
  RIFIUTATO:      'Rifiuta',
  ATTESA_RITIRO:  'Metti in attesa ritiro',
  RITIRATO:       'Segna come ritirato',
  IN_TRANSITO:    'Segna in transito',
  CONSEGNATO:     'Conferma consegna',
  IN_VERIFICA:    'Prendi in verifica',
  IN_LAVORAZIONE: 'Passa in lavorazione',
  CHIUSO_OK:      'Chiudi pratica',
  CHIUSO_NR:      'Chiudi come non rendibile',
  CONTESTATO:     'Apri contestazione',
  RICHIESTO:      'Riapri richiesta'
};

export function actionLabel(to) {
  return ACTION_LABEL[to] || ('Passa a ' + stateLabel(to));
}

// Le transizioni che richiedono una nota obbligatoria: senza motivazione
// scritta un rifiuto o una contestazione non sono verificabili a posteriori.
const REQUIRE_NOTE = [STATE.RIFIUTATO, STATE.CONTESTATO, STATE.CHIUSO_NR];

export function requiresNote(to) {
  return REQUIRE_NOTE.indexOf(to) >= 0;
}
