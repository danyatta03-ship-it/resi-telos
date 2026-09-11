type Downloadable = Blob | string | ArrayBuffer | Uint8Array<ArrayBufferLike>;

/** Scarica un blob come file, funziona su desktop e mobile. */
export function downloadBlob(data: Downloadable, filename: string, mime = 'application/octet-stream'): void {
  let blob: Blob;
  if (data instanceof Blob) blob = data;
  else if (data instanceof Uint8Array) {
    // La copia evita i problemi di tipo fra ArrayBuffer e SharedArrayBuffer.
    blob = new Blob([new Uint8Array(data).buffer as ArrayBuffer], { type: mime });
  } else blob = new Blob([data], { type: mime });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
