import type { Beat } from '../types';
import { uid } from '../utils/id';

const DB_NAME = 'trap-beat-generator';
const DB_VERSION = 1;
const STORE = 'beats';
const AUTOSAVE_KEY = 'tbg:autosave';

export interface BeatSummary {
  id: string;
  name: string;
  bpm: number;
  key: string;
  moods: string[];
  bars: number;
  updatedAt: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return openDb().then(
    (db) =>
      new Promise<T | null>((resolve) => {
        if (!db) {
          resolve(null);
          return;
        }
        const transaction = db.transaction(STORE, mode);
        const request = fn(transaction.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
      }),
  );
}

/** Fallback su localStorage se IndexedDB non e' disponibile (es. Safari privato). */
function localFallback(): Beat[] {
  try {
    const raw = localStorage.getItem('tbg:beats');
    return raw ? (JSON.parse(raw) as Beat[]) : [];
  } catch {
    return [];
  }
}

function writeLocalFallback(beats: Beat[]): void {
  try {
    localStorage.setItem('tbg:beats', JSON.stringify(beats));
  } catch {
    /* quota piena: ignoriamo, IndexedDB resta la via principale */
  }
}

export async function saveBeat(beat: Beat): Promise<void> {
  const payload: Beat = { ...beat, updatedAt: Date.now() };
  const done = await tx('readwrite', (store) => store.put(payload) as unknown as IDBRequest<IDBValidKey>);
  if (done === null) {
    const beats = localFallback().filter((b) => b.id !== payload.id);
    beats.push(payload);
    writeLocalFallback(beats);
  }
}

export async function listBeats(): Promise<Beat[]> {
  const all = await tx<Beat[]>('readonly', (store) => store.getAll() as IDBRequest<Beat[]>);
  const beats = all ?? localFallback();
  return beats.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadBeat(id: string): Promise<Beat | null> {
  const beat = await tx<Beat>('readonly', (store) => store.get(id) as IDBRequest<Beat>);
  return beat ?? localFallback().find((b) => b.id === id) ?? null;
}

export async function deleteBeat(id: string): Promise<void> {
  const done = await tx('readwrite', (store) => store.delete(id) as unknown as IDBRequest<undefined>);
  if (done === null) writeLocalFallback(localFallback().filter((b) => b.id !== id));
}

export async function duplicateBeat(id: string): Promise<Beat | null> {
  const beat = await loadBeat(id);
  if (!beat) return null;
  const copy: Beat = {
    ...structuredClone(beat),
    id: uid('beat'),
    name: `${beat.name} (copia)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await saveBeat(copy);
  return copy;
}

/** Salvataggio automatico dell'ultima sessione, per riaprire l'app dov'era rimasta. */
export function autosave(beat: Beat | null): void {
  try {
    if (!beat) localStorage.removeItem(AUTOSAVE_KEY);
    else localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(beat));
  } catch {
    /* niente autosave se lo storage e' pieno */
  }
}

export function readAutosave(): Beat | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    return raw ? (JSON.parse(raw) as Beat) : null;
  } catch {
    return null;
  }
}
