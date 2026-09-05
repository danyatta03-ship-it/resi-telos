// Coda di scrittura offline.
//
// Ogni azione che scrive su Firebase passa da qui. Se la connessione c'e',
// la scrittura parte subito; se fallisce per rete o siamo offline, finisce in
// IndexedDB e viene rigiocata alla riconnessione.
//
// IDEMPOTENZA: ogni operazione porta un id deterministico e scrive su un path
// che include quell'id (set, mai push). Rigiocare la coda due volte produce
// lo stesso risultato — nessun evento timeline duplicato, nessun messaggio
// doppio. E' il motivo per cui la coda puo' permettersi di essere aggressiva
// nei retry.

import { queueAll, queuePut, queueDel } from './idb.js';
import { isConnected, db } from './firebase.js';
import { emit, EVENTS, on } from './bus.js';

const MAX_ATTEMPTS = 8;
let flushing = false;
let pendingCount = 0;

// Errori che NON hanno senso ritentare: il permesso non arrivera' da solo.
const FATAL = /permission_denied|PERMISSION_DENIED|invalid|INVALID/;

export function getPendingCount() {
  return pendingCount;
}

export async function refreshPendingCount() {
  const rows = await queueAll();
  pendingCount = rows.length;
  emit(EVENTS.QUEUE_CHANGED, pendingCount);
  return pendingCount;
}

// op = { id, path, mode: 'set'|'update', value, label }
export async function enqueue(op) {
  const item = Object.assign({ ts: Date.now(), attempts: 0 }, op);
  if (!item.id) item.id = 'op_' + item.ts + '_' + Math.random().toString(36).slice(2, 8);
  await queuePut(item);
  await refreshPendingCount();
  return item.id;
}

async function runOp(op) {
  const ref = db().ref(op.path);
  if (op.mode === 'update') await ref.update(op.value);
  else await ref.set(op.value);
}

// Prova la scrittura subito; se fallisce per un motivo transitorio la accoda.
// Ritorna { ok, queued } — la UI mostra "inviato" o "in coda".
export async function write(op) {
  const item = Object.assign({ ts: Date.now(), attempts: 0, mode: 'set' }, op);
  if (!item.id) item.id = 'op_' + item.ts + '_' + Math.random().toString(36).slice(2, 8);

  if (!isConnected()) {
    await enqueue(item);
    return { ok: false, queued: true };
  }
  try {
    await runOp(item);
    return { ok: true, queued: false };
  } catch (err) {
    if (FATAL.test(String((err && err.message) || ''))) {
      // Accodarlo servirebbe solo a ritentare in eterno un rifiuto.
      throw err;
    }
    await enqueue(item);
    return { ok: false, queued: true };
  }
}

export async function flush() {
  if (flushing || !isConnected()) return { sent: 0, failed: 0, dropped: 0 };
  flushing = true;
  let sent = 0;
  let failed = 0;
  let dropped = 0;
  try {
    const rows = await queueAll();
    for (const op of rows) {
      if (!isConnected()) break;
      try {
        await runOp(op);
        await queueDel(op.id);
        sent++;
      } catch (err) {
        const msg = String((err && err.message) || '');
        const attempts = (op.attempts || 0) + 1;
        if (FATAL.test(msg) || attempts >= MAX_ATTEMPTS) {
          // Scarto: e' definitivamente rifiutata o ha esaurito i tentativi.
          // Meglio perdere una scrittura che bloccare la coda per sempre.
          console.warn('[offline] operazione scartata', op.path, msg);
          await queueDel(op.id);
          dropped++;
        } else {
          await queuePut(Object.assign({}, op, { attempts, lastError: msg.slice(0, 200) }));
          failed++;
        }
      }
    }
  } finally {
    flushing = false;
    await refreshPendingCount();
  }
  return { sent, failed, dropped };
}

export function initOffline() {
  on(EVENTS.CONN_CHANGED, (online) => {
    if (online) flush();
  });
  window.addEventListener('online', () => flush());
  refreshPendingCount();
  if (isConnected()) flush();
}
