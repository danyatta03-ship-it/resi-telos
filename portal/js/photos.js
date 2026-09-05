// Foto allegate all'invio.
//
// Le foto viaggiano dentro il JSON dell'invio, come dataURL. E' la stessa
// scelta gia' fatta dal gestionale per le foto pacco, e ci evita di dover
// configurare Firebase Storage e di dare all'app pubblica un accesso in
// scrittura al bucket.
//
// Perche' la compressione non e' opzionale: una foto da telefono e' 4000px e
// 6 MB. Tre foto cosi' sono 18 MB di JSON, che il server rifiuta e che su
// rete mobile non partirebbero comunque. Ridotte a 1400px stanno in ~250 KB
// l'una e la bolla resta perfettamente leggibile.

export const MAX_FOTO = 3;
export const MAX_LATO = 1400;
export const QUALITA = 0.72;
export const MAX_BYTES_TOTALI = 3 * 1024 * 1024;

export function isImmagine(file) {
  return !!file && /^image\//.test(file.type || '');
}

export async function comprimi(file) {
  if (!isImmagine(file)) throw new Error('Il file "' + file.name + '" non e\' un\'immagine.');

  const bitmap = await leggiBitmap(file);
  const scala = Math.min(1, MAX_LATO / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scala);
  const h = Math.round(bitmap.height * scala);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);
  if (bitmap.close) bitmap.close();

  const dataUrl = canvas.toDataURL('image/jpeg', QUALITA);
  return { dataUrl, w, h, bytes: Math.round(dataUrl.length * 0.75) };
}

// createImageBitmap applica l'orientamento EXIF e non blocca il thread; su
// browser che non ce l'hanno ripiego su <img>, che l'orientamento lo applica
// comunque perche' i browser moderni lo fanno di default.
function leggiBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file).catch(() => viaImg(file));
  }
  return viaImg(file);
}

function viaImg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Immagine non leggibile: ' + file.name));
    };
    img.src = url;
  });
}

export function pesoTotale(foto) {
  return foto.reduce((sum, f) => sum + (f.bytes || 0), 0);
}

export function formatBytes(n) {
  if (!n) return '0 KB';
  if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
  return (n / 1048576).toFixed(1) + ' MB';
}
