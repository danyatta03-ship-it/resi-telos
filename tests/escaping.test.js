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
  const files = listJsFiles(portalJs).filter((f) => !f.endsWith('/dom.js'));

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

  describe('Escaping — xe(), la protezione del gestionale');

  // Questi due test prima importavano esc() da portal/js/ui/dom.js: un
  // percorso che non esiste piu' e una funzione che il portale non ha mai
  // riavuto dopo la riscrittura (h() usa createTextNode, che neutralizza da
  // solo). Restavano verdi perche' il runner non aspettava i test async: la
  // promessa falliva nel vuoto e it() contava un successo. Un test che non
  // puo' fallire e' peggio di nessun test, perche' occupa il posto di
  // quello vero.
  //
  // Ora verificano xe(), che il gestionale usa davvero — anche nella
  // Diagnostica, dove finiscono in pagina l'URL del database e il testo
  // grezzo degli errori restituiti dal server.
  const xe = (() => {
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    const m = html.match(/function xe\(v\)\{[^\n]*\}/);
    assert(m, 'xe() non trovata in index.html');
    return new Function('return ' + m[0].replace('function xe', 'function') + ';')();
  })();

  it('xe() neutralizza i caratteri che aprono un tag', () => {
    eq(xe('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
    eq(xe('a & b'), 'a &amp; b');
    eq(xe('"virgolette"'), '&quot;virgolette&quot;');
  });

  it('xe() codifica la e commerciale per prima', () => {
    // Se & venisse sostituita dopo <, "&lt;" diventerebbe "&amp;lt;" e in
    // pagina si leggerebbe "&lt;" invece del segno di minore.
    eq(xe('&lt;'), '&amp;lt;');
  });

  it('xe() regge valori vuoti senza esplodere', () => {
    // Li riceve davvero: fbErrText puo' tornare stringa vuota, e i campi
    // della configurazione possono mancare.
    eq(xe(null), '');
    eq(xe(undefined), '');
    eq(xe(''), '');
    eq(xe(0), '');   // String(0 || '') e' '': documentato qui perche' sorprende
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
