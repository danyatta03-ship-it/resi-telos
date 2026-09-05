// Messaggistica contestuale: ogni reso ha il suo thread.
//
// A differenza della chat interna del gestionale (nodo chat/, globale), qui
// il thread e' ancorato al reso. Cliente, agente, corriere e Telos parlano
// dello STESSO pezzo, e la conversazione resta allegata alla pratica invece
// di disperdersi in mail e telefonate.
//
// Anche i messaggi sono append-only e idempotenti come la timeline.

import { paths } from '../core/firebase.js';
import { write } from '../core/offline.js';
import { getUid, getRole, getDisplayName } from '../core/auth.js';
import { snapToArray } from '../core/store.js';
import { logMessage } from './timeline.js';

const MAX_LEN = 4000;

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(36);
}

function messageId(returnKey, uid, text, ts) {
  // Chiave ordinabile per timestamp + hash del contenuto: due invii dello
  // stesso testo nello stesso secondo collassano in uno.
  const sec = Math.floor(ts / 1000);
  return 'm' + String(sec).padStart(11, '0') + '_' + fnv1a(returnKey + '|' + uid + '|' + text);
}

export async function sendMessage(returnKey, text, attachments) {
  const clean = String(text || '').trim();
  if (!clean) throw new Error('Il messaggio e\' vuoto');
  if (clean.length > MAX_LEN) throw new Error('Messaggio troppo lungo (max ' + MAX_LEN + ' caratteri)');

  const ts = Date.now();
  const uid = getUid();
  if (!uid) throw new Error('Sessione scaduta');

  const msg = {
    ts,
    from: uid,
    fromName: getDisplayName(),
    fromRole: getRole(),
    text: clean
  };
  if (attachments && attachments.length) msg.attachments = attachments.slice(0, 5);

  const id = messageId(returnKey, uid, clean, ts);
  const res = await write({
    id: 'msg_' + returnKey + '_' + id,
    path: 'portal_messages/' + returnKey + '/' + id,
    mode: 'set',
    value: msg,
    label: 'Messaggio'
  });

  // La timeline registra CHE si e' scritto e quando; il testo integrale vive
  // nel thread. Se questa fallisce non annullo il messaggio: la conversazione
  // conta piu' della riga di registro.
  logMessage(returnKey, clean.slice(0, 200)).catch(() => {});

  return Object.assign({ id, message: msg }, res);
}

export function bindMessages(returnKey, { next, fail }) {
  const ref = paths.messages(returnKey).limitToLast(200);
  const handler = ref.on('value', (snap) => next(normalize(snap)), (err) => fail(err));
  return () => ref.off('value', handler);
}

export async function loadMessages(returnKey) {
  const snap = await paths.messages(returnKey).limitToLast(200).once('value');
  return normalize(snap);
}

function normalize(snap) {
  const rows = snapToArray(snap).map((m) => Object.assign({}, m, { id: m._key }));
  rows.sort((a, b) => (a.ts || 0) - (b.ts || 0));
  return rows;
}

export function isMine(msg) {
  return !!msg && msg.from === getUid();
}

// Conteggio dei messaggi non letti: confronta con l'ultimo timestamp visto,
// tenuto in locale per-utente (non serve un round-trip al server per questo).
const SEEN_KEY = 'portal_msg_seen';

function seenMap() {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') || {};
  } catch (e) {
    return {};
  }
}

export function markSeen(returnKey) {
  const map = seenMap();
  map[returnKey] = Date.now();
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(map)); } catch (e) { /* quota */ }
}

export function unreadCount(returnKey, messages) {
  const seen = seenMap()[returnKey] || 0;
  const uid = getUid();
  return messages.filter((m) => (m.ts || 0) > seen && m.from !== uid).length;
}
