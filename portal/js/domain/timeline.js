// Timeline: registro eventi APPEND-ONLY per ogni reso.
//
// Immutabilita': le Security Rules ammettono la scrittura solo se
// `!data.exists()` — un evento, una volta scritto, non si modifica e non si
// cancella da client. E' il registro su cui si basa ogni contestazione, quindi
// deve essere credibile.
//
// Idempotenza: l'id evento e' DERIVATO dal contenuto (fnv1a di reso+attore+
// azione+minuto). Se la stessa azione viene rigiocata dalla coda offline, o
// l'utente tocca due volte il bottone, il secondo `set` scrive esattamente lo
// stesso nodo con lo stesso valore: nessun duplicato in timeline. La finestra
// di un minuto e' voluta — due click rapidi collassano, due azioni identiche
// a distanza di tempo restano distinte perche' sono eventi reali.

import { paths } from '../core/firebase.js';
import { write } from '../core/offline.js';
import { getUid, getRole, getDisplayName } from '../core/auth.js';
import { validateTransition, stateLabel } from './workflow.js';
import { snapToArray } from '../core/store.js';

export const ACTION = {
  CREATED:      'CREATED',
  STATE_CHANGE: 'STATE_CHANGE',
  MESSAGE:      'MESSAGE',
  DOCUMENT:     'DOCUMENT',
  NOTE:         'NOTE',
  SLA_BREACH:   'SLA_BREACH'
};

export const ACTION_META = {
  CREATED:      { label: 'Pratica aperta',       icon: '➕' },
  STATE_CHANGE: { label: 'Cambio stato',         icon: '🔄' },
  MESSAGE:      { label: 'Messaggio',            icon: '💬' },
  DOCUMENT:     { label: 'Documento caricato',   icon: '📎' },
  NOTE:         { label: 'Nota',                 icon: '📝' },
  SLA_BREACH:   { label: 'SLA superato',         icon: '⏰' }
};

// Hash FNV-1a a 32 bit: deterministico, veloce, e non serve che sia
// crittografico — deve solo evitare collisioni fra eventi diversi.
function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(36);
}

export function eventId(returnKey, actor, action, detail, ts) {
  const minute = Math.floor((ts || Date.now()) / 60000);
  const seed = [returnKey, actor, action, detail || '', minute].join('|');
  // Prefisso ordinabile: Firebase ordina le chiavi lessicograficamente e
  // cosi' la timeline arriva gia' in ordine cronologico senza sort lato client.
  return 'e' + String(minute).padStart(10, '0') + '_' + fnv1a(seed);
}

function baseEvent(action, extra) {
  const ts = Date.now();
  const ev = {
    ts,
    actor: getUid() || 'unknown',
    actorName: getDisplayName(),
    actorRole: getRole() || 'CLIENTE',
    action
  };
  // Le regole rifiutano i campi non previsti e i valori vuoti: costruisco
  // l'oggetto solo con quello che serve davvero.
  if (extra) {
    for (const k in extra) {
      const v = extra[k];
      if (v !== undefined && v !== null && v !== '') ev[k] = v;
    }
  }
  return ev;
}

async function append(returnKey, event, detailForId) {
  const id = eventId(returnKey, event.actor, event.action, detailForId, event.ts);
  const res = await write({
    id: 'tl_' + returnKey + '_' + id,
    path: 'portal_timeline/' + returnKey + '/' + id,
    mode: 'set',
    value: event,
    label: 'Timeline ' + event.action
  });
  return Object.assign({ id }, res);
}

export function logCreated(returnKey, note) {
  return append(returnKey, baseEvent(ACTION.CREATED, { note }), 'created');
}

// Registra un cambio di stato. Rivalida la transizione qui dentro: chi chiama
// potrebbe aver costruito il bottone da uno stato ormai vecchio.
export async function logStateChange(returnKey, from, to, note) {
  const role = getRole();
  const check = validateTransition(from, to, role);
  if (!check.ok) {
    const err = new Error(check.reason);
    err.code = 'workflow/invalid-transition';
    throw err;
  }
  const ev = baseEvent(ACTION.STATE_CHANGE, { from: from || '', to, note });
  return append(returnKey, ev, from + '>' + to);
}

export function logMessage(returnKey, text) {
  return append(returnKey, baseEvent(ACTION.MESSAGE, { note: String(text || '').slice(0, 2000) }), 'msg');
}

export function logDocument(returnKey, filename, storagePath) {
  const ev = baseEvent(ACTION.DOCUMENT, {
    note: filename,
    attachments: storagePath ? [storagePath] : undefined
  });
  return append(returnKey, ev, 'doc:' + filename);
}

export function logNote(returnKey, note) {
  return append(returnKey, baseEvent(ACTION.NOTE, { note: String(note || '').slice(0, 2000) }), 'note');
}

export function logSlaBreach(returnKey, state, hours) {
  const ev = baseEvent(ACTION.SLA_BREACH, {
    to: state,
    note: 'SLA superato: ' + Math.round(hours) + 'h in stato ' + stateLabel(state)
  });
  return append(returnKey, ev, 'sla:' + state);
}

// Legge la timeline una volta sola.
export async function loadTimeline(returnKey) {
  const snap = await paths.timeline(returnKey).once('value');
  return normalize(snap);
}

// Sottoscrizione live. Ritorna la funzione di teardown per lo store.
export function bindTimeline(returnKey, { next, fail }) {
  const ref = paths.timeline(returnKey);
  const handler = ref.on('value', (snap) => next(normalize(snap)), (err) => fail(err));
  return () => ref.off('value', handler);
}

function normalize(snap) {
  const rows = snapToArray(snap).map((e) => Object.assign({}, e, { id: e._key }));
  rows.sort((a, b) => (a.ts || 0) - (b.ts || 0));
  return rows;
}

// Ultimo cambio di stato registrato: da qui si ricava lo stato corrente del
// portale e da quanto tempo ci si trova (input del calcolo SLA).
export function lastStateChange(events) {
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].action === ACTION.STATE_CHANGE && events[i].to) return events[i];
  }
  return null;
}

export function currentPortalState(events) {
  const last = lastStateChange(events);
  return last ? last.to : null;
}

export function actionLabel(action) {
  return (ACTION_META[action] && ACTION_META[action].label) || action;
}

export function actionIcon(action) {
  return (ACTION_META[action] && ACTION_META[action].icon) || '•';
}
