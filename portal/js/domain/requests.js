// Richieste di reso aperte dall'esterno.
//
// Un cliente (o un agente per suo conto) apre una richiesta PRIMA che esista
// un record nel gestionale: e' il punto di ingresso del flusso esterno. Telos
// la esamina, la approva o la rifiuta; all'approvazione un operatore crea il
// reso vero nel gestionale e i due vengono collegati (campo returnKey).
//
// Le richieste NON scrivono su returns/. Il gestionale resta l'unico padrone
// del proprio nodo.

import { paths } from '../core/firebase.js';
import { write } from '../core/offline.js';
import { getUid, getRole, getDisplayName, getScope } from '../core/auth.js';
import { snapToArray } from '../core/store.js';

export const REQ_STATE = {
  INVIATA: 'INVIATA',
  IN_ESAME: 'IN_ESAME',
  APPROVATA: 'APPROVATA',
  RIFIUTATA: 'RIFIUTATA',
  ANNULLATA: 'ANNULLATA'
};

export const REQ_META = {
  INVIATA:   { label: 'Inviata',   color: '#8FA4B8', icon: '📤' },
  IN_ESAME:  { label: 'In esame',  color: '#E6B03C', icon: '🔍' },
  APPROVATA: { label: 'Approvata', color: '#2ECC71', icon: '✅' },
  RIFIUTATA: { label: 'Rifiutata', color: '#E05555', icon: '⛔' },
  ANNULLATA: { label: 'Annullata', color: '#666',    icon: '🚫' }
};

const REQ_TRANSITIONS = {
  INVIATA:   { IN_ESAME: ['ADMIN', 'TELOS'], APPROVATA: ['ADMIN', 'TELOS'], RIFIUTATA: ['ADMIN', 'TELOS'], ANNULLATA: ['ADMIN', 'TELOS', 'CLIENTE', 'AGENTE'] },
  IN_ESAME:  { APPROVATA: ['ADMIN', 'TELOS'], RIFIUTATA: ['ADMIN', 'TELOS'], ANNULLATA: ['ADMIN', 'TELOS'] },
  APPROVATA: { ANNULLATA: ['ADMIN'] },
  RIFIUTATA: { IN_ESAME: ['ADMIN', 'TELOS'] },
  ANNULLATA: {}
};

export function reqLabel(s) {
  return (REQ_META[s] && REQ_META[s].label) || s || '—';
}

export function reqColor(s) {
  return (REQ_META[s] && REQ_META[s].color) || '#888';
}

export function reqIcon(s) {
  return (REQ_META[s] && REQ_META[s].icon) || '•';
}

export function canAdvanceRequest(from, to, role) {
  const table = REQ_TRANSITIONS[from];
  return !!(table && table[to] && table[to].indexOf(role) >= 0);
}

export function allowedRequestTransitions(from, role) {
  const table = REQ_TRANSITIONS[from];
  if (!table) return [];
  return Object.keys(table).filter((to) => table[to].indexOf(role) >= 0);
}

export function validateRequest(payload) {
  const errors = [];
  if (!payload.clientCode) errors.push('Seleziona il codice cliente.');
  if (!payload.articoli || !payload.articoli.length) errors.push('Aggiungi almeno un articolo.');
  (payload.articoli || []).forEach((a, i) => {
    if (!String(a.cod || '').trim()) errors.push('Articolo ' + (i + 1) + ': codice mancante.');
    const q = parseInt(a.qty, 10);
    if (!isFinite(q) || q < 1) errors.push('Articolo ' + (i + 1) + ': quantita\' non valida.');
  });
  if (!String(payload.causale || '').trim()) errors.push('Indica la causale del reso.');
  return { ok: errors.length === 0, errors };
}

export async function createRequest(payload) {
  const check = validateRequest(payload);
  if (!check.ok) {
    const err = new Error(check.errors.join(' '));
    err.code = 'request/invalid';
    err.errors = check.errors;
    throw err;
  }
  const uid = getUid();
  if (!uid) throw new Error('Sessione scaduta');

  const scope = getScope();
  const role = getRole();
  // Un cliente puo' aprire richieste solo per i codici che gli appartengono.
  // Le regole lo riverificano lato server; qui evitiamo di far compilare un
  // modulo che verrebbe rifiutato dopo l'invio.
  if (role === 'CLIENTE' && scope.indexOf(String(payload.clientCode).toUpperCase()) < 0) {
    throw new Error('Non sei autorizzato ad aprire richieste per questo codice cliente.');
  }

  const ts = Date.now();
  const id = 'req_' + ts.toString(36) + Math.random().toString(36).slice(2, 8);
  const record = {
    ts,
    createdBy: uid,
    createdName: getDisplayName(),
    createdRole: role,
    state: REQ_STATE.INVIATA,
    clientCode: String(payload.clientCode).toUpperCase(),
    clientName: String(payload.clientName || '').slice(0, 200),
    causale: String(payload.causale || '').slice(0, 200),
    note: String(payload.note || '').slice(0, 2000),
    articoli: (payload.articoli || []).slice(0, 50).map((a) => ({
      cod: String(a.cod || '').trim().toUpperCase().slice(0, 60),
      pre: String(a.pre || '').trim().toUpperCase().slice(0, 10),
      qty: Math.max(1, parseInt(a.qty, 10) || 1),
      forn: String(a.forn || '').trim().slice(0, 120),
      note: String(a.note || '').slice(0, 300)
    })),
    contatto: String(payload.contatto || '').slice(0, 200),
    indirizzoRitiro: String(payload.indirizzoRitiro || '').slice(0, 400)
  };

  const res = await write({
    id: 'req_' + id,
    path: 'portal_requests/' + id,
    mode: 'set',
    value: record,
    label: 'Richiesta reso'
  });
  return Object.assign({ id, request: record }, res);
}

export async function advanceRequest(id, current, to, note) {
  const role = getRole();
  if (!canAdvanceRequest(current, to, role)) {
    throw new Error('Transizione non ammessa: ' + reqLabel(current) + ' → ' + reqLabel(to));
  }
  const patch = {
    state: to,
    lastActionTs: Date.now(),
    lastActionBy: getUid(),
    lastActionName: getDisplayName(),
    lastActionRole: role
  };
  if (note) patch.decisionNote = String(note).slice(0, 2000);
  await paths.request(id).update(patch);
  return patch;
}

// Collega una richiesta approvata al record creato nel gestionale.
export async function linkToReturn(id, returnKey) {
  await paths.request(id).update({
    returnKey: String(returnKey),
    linkedTs: Date.now(),
    linkedBy: getUid()
  });
}

export function bindRequests({ next, fail }) {
  const role = getRole();
  const uid = getUid();
  // Lo staff legge tutto il nodo; un esterno non ha il permesso di elencarlo
  // e deve filtrare per i propri: orderByChild + equalTo passa le regole.
  const ref = (role === 'ADMIN' || role === 'TELOS')
    ? paths.requests().limitToLast(500)
    : paths.requests().orderByChild('createdBy').equalTo(uid);

  const handler = ref.on('value', (snap) => {
    const rows = snapToArray(snap).map((r) => Object.assign({}, r, { id: r._key }));
    rows.sort((a, b) => (b.ts || 0) - (a.ts || 0));
    next(rows);
  }, (err) => fail(err));

  return () => ref.off('value', handler);
}
