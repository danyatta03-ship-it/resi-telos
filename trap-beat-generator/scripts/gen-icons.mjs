// Genera le icone PNG della PWA senza dipendenze esterne (encoder PNG minimale).
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../public/icons');
mkdirSync(outDir, { recursive: true });

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function mix(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function draw(size, { padding = 0 } = {}) {
  const buf = Buffer.alloc(size * size * 4);
  const px = (x, y, [r, g, b], a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    const sa = a / 255;
    buf[i] = Math.round(buf[i] * (1 - sa) + r * sa);
    buf[i + 1] = Math.round(buf[i + 1] * (1 - sa) + g * sa);
    buf[i + 2] = Math.round(buf[i + 2] * (1 - sa) + b * sa);
    buf[i + 3] = Math.max(buf[i + 3], Math.round(255 * sa));
  };

  const inner = size - padding * 2;
  const radius = inner * 0.22;
  const bgTop = [18, 22, 38];
  const bgBottom = [6, 7, 11];

  for (let y = 0; y < inner; y++) {
    for (let x = 0; x < inner; x++) {
      // angoli arrotondati
      const cx = Math.min(x, inner - 1 - x);
      const cy = Math.min(y, inner - 1 - y);
      let alpha = 255;
      if (cx < radius && cy < radius) {
        const d = Math.hypot(radius - cx, radius - cy);
        if (d > radius) continue;
        if (d > radius - 1.5) alpha = Math.round(255 * (radius - d) / 1.5);
      }
      const t = y / inner;
      const glow = Math.max(0, 1 - Math.hypot(x - inner * 0.5, y - inner * 0.32) / (inner * 0.75));
      const base = mix(bgTop, bgBottom, t);
      const col = mix(base, [36, 54, 92], glow * 0.55);
      px(x + padding, y + padding, col, alpha);
    }
  }

  // barre stile step-sequencer / waveform
  const bars = [0.34, 0.62, 0.45, 0.95, 0.55, 0.78, 0.4, 0.68];
  const palette = [
    [57, 223, 160],
    [125, 240, 194],
    [139, 92, 246],
    [255, 107, 53],
    [57, 223, 160],
    [177, 140, 255],
    [255, 157, 107],
    [57, 223, 160],
  ];
  const areaW = inner * 0.68;
  const startX = padding + (inner - areaW) / 2;
  const gap = areaW / bars.length;
  const barW = gap * 0.52;
  const midY = padding + inner * 0.54;
  const maxH = inner * 0.4;
  for (let i = 0; i < bars.length; i++) {
    const h = maxH * bars[i];
    const x0 = Math.round(startX + i * gap + (gap - barW) / 2);
    const x1 = Math.round(x0 + barW);
    const y0 = Math.round(midY - h / 2);
    const y1 = Math.round(midY + h / 2);
    const r = Math.max(1, Math.round(barW * 0.45));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const dx = Math.min(x - x0, x1 - x);
        const dy = Math.min(y - y0, y1 - y);
        if (dx < r && dy < r && Math.hypot(r - dx, r - dy) > r) continue;
        const t = (y - y0) / Math.max(1, y1 - y0);
        px(x, y, mix(palette[i], [255, 255, 255], 0.16 * (1 - t)));
      }
    }
  }

  // linea di base
  const lineY = Math.round(padding + inner * 0.78);
  for (let x = Math.round(startX); x < Math.round(startX + areaW); x++) {
    for (let y = lineY; y < lineY + Math.max(2, Math.round(inner * 0.018)); y++) {
      px(x, y, [61, 73, 105]);
    }
  }
  return buf;
}

const targets = [
  { file: 'icon-192.png', size: 192, padding: 0 },
  { file: 'icon-512.png', size: 512, padding: 0 },
  { file: 'maskable-512.png', size: 512, padding: 56 },
  { file: 'apple-touch-icon.png', size: 180, padding: 0 },
];

for (const t of targets) {
  const png = encodePng(t.size, t.size, draw(t.size, { padding: t.padding }));
  writeFileSync(resolve(outDir, t.file), png);
  console.log('icona creata:', t.file, png.length, 'bytes');
}
