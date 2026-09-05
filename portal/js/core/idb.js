// Wrapper IndexedDB minimale (promise-based) per la cache offline e la coda.
// Un solo database, due object store: 'kv' per la cache, 'queue' per le
// scritture in attesa.

const DB_NAME = 'portal-resi';
const DB_VERSION = 1;
const STORE_KV = 'kv';
const STORE_QUEUE = 'queue';

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB non disponibile'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const database = req.result;
      if (!database.objectStoreNames.contains(STORE_KV)) {
        database.createObjectStore(STORE_KV);
      }
      if (!database.objectStoreNames.contains(STORE_QUEUE)) {
        database.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeName, mode, fn) {
  return open().then((database) => new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let result;
    try {
      result = fn(store);
    } catch (err) {
      reject(err);
      return;
    }
    transaction.oncomplete = () => resolve(result && result.result !== undefined ? result.result : result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  }));
}

export function kvGet(key) {
  return tx(STORE_KV, 'readonly', (store) => store.get(key)).catch(() => undefined);
}

export function kvSet(key, value) {
  return tx(STORE_KV, 'readwrite', (store) => store.put(value, key)).catch(() => undefined);
}

export function kvDel(key) {
  return tx(STORE_KV, 'readwrite', (store) => store.delete(key)).catch(() => undefined);
}

export function queueAll() {
  return tx(STORE_QUEUE, 'readonly', (store) => store.getAll())
    .then((rows) => (rows || []).sort((a, b) => (a.ts || 0) - (b.ts || 0)))
    .catch(() => []);
}

export function queuePut(item) {
  return tx(STORE_QUEUE, 'readwrite', (store) => store.put(item));
}

export function queueDel(id) {
  return tx(STORE_QUEUE, 'readwrite', (store) => store.delete(id)).catch(() => undefined);
}

export function queueClear() {
  return tx(STORE_QUEUE, 'readwrite', (store) => store.clear()).catch(() => undefined);
}
