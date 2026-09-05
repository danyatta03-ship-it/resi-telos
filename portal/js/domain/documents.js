// Documenti e foto allegati a un reso.
//
// Il file va su Firebase Storage; i METADATI (chi, quando, che tipo) vanno
// su RTDB in portal_documents/<returnKey>/<docId>. La riga su RTDB e' cio' che
// rende il file scopribile: senza, il path in Storage non e' indovinabile.
//
// I file sono immutabili: si caricano e si cancellano, non si sovrascrivono.
// Serve a rendere la pratica difendibile in caso di contestazione.

import { storage, hasStorage, paths } from '../core/firebase.js';
import { getUid, getRole, getDisplayName, isStaff } from '../core/auth.js';
import { snapToArray } from '../core/store.js';
import { logDocument } from './timeline.js';

export const MAX_SIZE = 15 * 1024 * 1024;

export const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
  'application/pdf'
];

export const DOC_TYPE = {
  BOLLA: 'BOLLA',
  FOTO_PEZZO: 'FOTO_PEZZO',
  FOTO_IMBALLO: 'FOTO_IMBALLO',
  DOCUMENTO: 'DOCUMENTO',
  FIRMA: 'FIRMA',
  ALTRO: 'ALTRO'
};

export const DOC_TYPE_META = {
  BOLLA:        { label: 'Bolla / DDT',     icon: '📄' },
  FOTO_PEZZO:   { label: 'Foto pezzo',      icon: '📷' },
  FOTO_IMBALLO: { label: 'Foto imballo',    icon: '📦' },
  DOCUMENTO:    { label: 'Documento',       icon: '📎' },
  FIRMA:        { label: 'Bolla firmata',   icon: '✍️' },
  ALTRO:        { label: 'Altro',           icon: '🗂️' }
};

export function typeLabel(t) {
  return (DOC_TYPE_META[t] && DOC_TYPE_META[t].label) || 'Documento';
}

export function typeIcon(t) {
  return (DOC_TYPE_META[t] && DOC_TYPE_META[t].icon) || '📎';
}

export function validateFile(file) {
  if (!file) return { ok: false, reason: 'Nessun file selezionato' };
  if (file.size > MAX_SIZE) {
    return { ok: false, reason: 'File troppo grande (max ' + Math.round(MAX_SIZE / 1048576) + ' MB)' };
  }
  const type = String(file.type || '').toLowerCase();
  if (ALLOWED_TYPES.indexOf(type) < 0) {
    return { ok: false, reason: 'Formato non ammesso. Usa JPG, PNG, WEBP o PDF.' };
  }
  return { ok: true };
}

// Le foto da telefono arrivano a 4000px e 8 MB: ridurle prima dell'upload
// risparmia banda al cliente e spazio a noi, senza perdere leggibilita'.
export async function compressImage(file, maxDim = 2000, quality = 0.85) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  if (file.size < 400 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
  } catch (e) {
    return file; // createImageBitmap non supportato: carico l'originale
  }
}

function docId() {
  return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function sanitizeName(name) {
  return String(name || 'file')
    .replace(/[^\w.\-]+/g, '_')
    .slice(-120);
}

// Carica un file e registra i metadati. onProgress riceve 0-100.
export async function uploadDocument(returnKey, file, opts = {}) {
  if (!hasStorage()) throw new Error('Storage non disponibile: caricamento non attivo su questo progetto.');
  const check = validateFile(file);
  if (!check.ok) throw new Error(check.reason);

  const prepared = opts.compress === false ? file : await compressImage(file);
  const id = docId();
  const safeName = sanitizeName(prepared.name);
  const storagePath = 'portal/returns/' + returnKey + '/' + id + '_' + safeName;

  const ref = storage().ref(storagePath);
  const task = ref.put(prepared, {
    contentType: prepared.type,
    customMetadata: { returnKey, uploadedBy: getUid() || '', role: getRole() || '' }
  });

  await new Promise((resolve, reject) => {
    task.on('state_changed',
      (snap) => {
        if (typeof opts.onProgress === 'function' && snap.totalBytes) {
          opts.onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
        }
      },
      reject,
      resolve
    );
  });

  const meta = {
    ts: Date.now(),
    uploadedBy: getUid(),
    uploaderName: getDisplayName(),
    uploaderRole: getRole(),
    type: opts.type || DOC_TYPE.DOCUMENTO,
    filename: safeName,
    storagePath,
    size: prepared.size,
    contentType: prepared.type
  };

  // I metadati vanno scritti direttamente, non accodati: se il file e' su
  // Storage ma la riga manca, il file resta orfano e invisibile.
  await paths.documents(returnKey).child(id).set(meta);
  logDocument(returnKey, safeName, storagePath).catch(() => {});

  return Object.assign({ id }, meta);
}

export async function getDownloadUrl(storagePath) {
  if (!hasStorage()) return null;
  try {
    return await storage().ref(storagePath).getDownloadURL();
  } catch (e) {
    return null;
  }
}

export async function deleteDocument(returnKey, doc) {
  if (!doc || !doc.id) throw new Error('Documento non valido');
  if (!isStaff() && doc.uploadedBy !== getUid()) {
    throw new Error('Puoi eliminare solo i documenti che hai caricato.');
  }
  await paths.documents(returnKey).child(doc.id).remove();
  // Il file in Storage e' cancellabile solo dallo staff (vedi storage.rules).
  // Se fallisce, la riga e' comunque sparita e il file non e' piu' raggiungibile.
  if (hasStorage() && doc.storagePath) {
    try { await storage().ref(doc.storagePath).delete(); } catch (e) { /* gia' rimosso o non autorizzato */ }
  }
}

export function bindDocuments(returnKey, { next, fail }) {
  const ref = paths.documents(returnKey);
  const handler = ref.on('value', (snap) => next(normalize(snap)), (err) => fail(err));
  return () => ref.off('value', handler);
}

export async function loadDocuments(returnKey) {
  const snap = await paths.documents(returnKey).once('value');
  return normalize(snap);
}

function normalize(snap) {
  const rows = snapToArray(snap).map((d) => Object.assign({}, d, { id: d._key }));
  rows.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return rows;
}

export function isImage(doc) {
  return !!doc && /^image\//.test(String(doc.contentType || ''));
}

export function formatSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return n + ' B';
  if (n < 1048576) return Math.round(n / 1024) + ' KB';
  return (n / 1048576).toFixed(1) + ' MB';
}
