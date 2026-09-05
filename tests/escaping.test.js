// Test sull'escaping dell'output.
//
// Nasce da un bug reale: i messaggi comparivano come "e&#39; stato approvato"
// invece di "e' stato approvato". La causa e' che h() crea nodi di testo con
// createTextNode — che gia' neutralizza l'HTML — quindi passargli esc(x)
// produce una DOPPIA codifica, visibile all'utente come entita' grezze.
//
// Regola del progetto:
//   • testo passato a h()      → MAI esc(): createTextNode e' gia' sicuro
//   • valore usato con html:   → SEMPRE esc(), altrimenti e' XSS
//
// Questo test verifica entrambe le meta' della regola.

import { describe, it, assert, eq } from './run.js';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const portalJs = join(root, 'portal', 'js');

function listJsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...listJsFiles(full));
    else if (entry.endsWith('.js')) out.push(full);
  }
  return out;
}

export async function runEscapingTests() {
  const files = listJsFiles(portalJs).filter((f) => !f.endsWith('ui/dom.js'));

  describe('Escaping — nessuna doppia codifica');

  it('esc() non viene usato su testo passato a h()', () => {
    const offenders = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      const lines = src.split('\n');
      lines.forEach((line, i) => {
        // Cerco esc( su righe che NON assegnano a html:
        if (!/\besc\(/.test(line)) return;
        if (/html\s*:/.test(line)) return;         // uso legittimo
        if (/^\s*(\/\/|\*)/.test(line)) return;    // commento
        offenders.push(relative(root, file) + ':' + (i + 1) + '  ' + line.trim().slice(0, 90));
      });
    }
    eq(offenders.length, 0,
      'esc() su testo gia\' sicuro produce doppia codifica:\n      ' + offenders.join('\n      '));
  });

  describe('Escaping — nessuna innerHTML non protetta');

  it('innerHTML non riceve mai dati non passati da esc()', () => {
    const offenders = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      const lines = src.split('\n');
      lines.forEach((line, i) => {
        const m = /\.innerHTML\s*=\s*(.+)$/.exec(line);
        if (!m) return;
        const value = m[1].trim();
        // Letterali costanti e stringhe vuote sono innocui.
        if (/^(''|""|`[^${]*`|'[^']*'|"[^"]*")\s*;?$/.test(value)) return;
        if (/esc\(/.test(value)) return;
        offenders.push(relative(root, file) + ':' + (i + 1) + '  ' + line.trim().slice(0, 90));
      });
    }
    eq(offenders.length, 0,
      'assegnazioni a innerHTML da rivedere:\n      ' + offenders.join('\n      '));
  });

  it('la proprieta\' html: di h() e\' usata solo con contenuto statico o esc()', () => {
    const offenders = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      const re = /html\s*:\s*([^,}\n]+)/g;
      let m;
      while ((m = re.exec(src))) {
        const value = m[1].trim();
        if (/^('[^']*'|"[^"]*")$/.test(value)) continue;  // letterale
        if (/esc\(/.test(value)) continue;
        const line = src.slice(0, m.index).split('\n').length;
        offenders.push(relative(root, file) + ':' + line + '  html: ' + value.slice(0, 70));
      }
    }
    eq(offenders.length, 0,
      'html: con contenuto dinamico non protetto:\n      ' + offenders.join('\n      '));
  });

  describe('Escaping — comportamento di esc()');

  it('esc() neutralizza i caratteri pericolosi', async () => {
    const dom = await import('../portal/js/ui/dom.js');
    eq(dom.esc('<script>alert(1)</script>'),
       '&lt;script&gt;alert(1)&lt;/script&gt;');
    eq(dom.esc('a & b'), 'a &amp; b');
    eq(dom.esc('"virgolette"'), '&quot;virgolette&quot;');
    eq(dom.esc("l'apostrofo"), 'l&#39;apostrofo');
  });

  it('esc() gestisce null e undefined senza esplodere', async () => {
    const dom = await import('../portal/js/ui/dom.js');
    eq(dom.esc(null), '');
    eq(dom.esc(undefined), '');
    eq(dom.esc(0), '0');
    eq(dom.esc(false), 'false');
  });

  describe('Escaping — precedenza degli operatori');

  it('nessun "x || \'\'" concatenato senza parentesi', () => {
    // "'testo: ' + err.message || ''" si valuta come
    // "('testo: ' + err.message) || ''" — quasi sempre non e' cio' che si
    // voleva. Il bug e' silenzioso: produce "testo: undefined".
    const offenders = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      const lines = src.split('\n');
      lines.forEach((line, i) => {
        if (/^\s*(\/\/|\*)/.test(line)) return;
        // + qualcosa || '...'   oppure   qualcosa || '...' +
        if (/\+\s*[A-Za-z_$][\w$.]*\s*\|\|\s*['"]/.test(line) ||
            /[A-Za-z_$][\w$.]*\s*\|\|\s*'[^']*'\s*\+/.test(line)) {
          offenders.push(relative(root, file) + ':' + (i + 1) + '  ' + line.trim().slice(0, 90));
        }
      });
    }
    eq(offenders.length, 0,
      'precedenza ambigua fra + e || (servono parentesi):\n      ' + offenders.join('\n      '));
  });
}
