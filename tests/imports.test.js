// Verifica statica del grafo degli import.
//
// Nasce da un bug reale: una vista importava `auth` da core/auth.js, dove non
// esiste (sta in core/firebase.js). L'errore non compare a build time — non
// c'e' un build — e nemmeno nei test di dominio: si manifesta solo aprendo la
// pagina, come schermata bianca. Questo test lo intercetta prima.
//
// Controlla che ogni simbolo importato sia effettivamente esportato dal
// modulo di destinazione, e che ogni file referenziato esista.

import { describe, it, assert, eq } from './run.js';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative } from 'node:path';

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

// Estrae i nomi esportati. Copre le forme usate nel progetto:
//   export function x   export const x   export let x   export class x
//   export { a, b as c }   export default
function parseExports(src) {
  const names = new Set();

  const declRe = /^\s*export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm;
  let m;
  while ((m = declRe.exec(src))) names.add(m[1]);

  const listRe = /export\s*\{([^}]*)\}(?!\s*from)/g;
  while ((m = listRe.exec(src))) {
    for (const part of m[1].split(',')) {
      const piece = part.trim();
      if (!piece) continue;
      const asMatch = /\s+as\s+([A-Za-z_$][\w$]*)$/.exec(piece);
      names.add(asMatch ? asMatch[1] : piece.split(/\s+/)[0]);
    }
  }

  // re-export: export { a } from './x'  →  il nome resta esportato da qui
  const reExportRe = /export\s*\{([^}]*)\}\s*from\s*['"][^'"]+['"]/g;
  while ((m = reExportRe.exec(src))) {
    for (const part of m[1].split(',')) {
      const piece = part.trim();
      if (!piece) continue;
      const asMatch = /\s+as\s+([A-Za-z_$][\w$]*)$/.exec(piece);
      names.add(asMatch ? asMatch[1] : piece.split(/\s+/)[0]);
    }
  }

  if (/export\s+default\b/.test(src)) names.add('default');
  return names;
}

// Estrae gli import statici: { specifier, names[], line }
function parseImports(src) {
  const out = [];
  const re = /import\s+([^'"]+?)\s+from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src))) {
    const clause = m[1].trim();
    const specifier = m[2];
    const line = src.slice(0, m.index).split('\n').length;
    const names = [];

    const braceMatch = /\{([^}]*)\}/.exec(clause);
    if (braceMatch) {
      for (const part of braceMatch[1].split(',')) {
        const piece = part.trim();
        if (!piece) continue;
        names.push(piece.split(/\s+as\s+/)[0].trim());
      }
    }
    // import Default from '...'  oppure  import Default, { a } from '...'
    const defaultMatch = /^([A-Za-z_$][\w$]*)\s*(?:,|$)/.exec(clause);
    if (defaultMatch && !clause.startsWith('{') && !clause.startsWith('*')) {
      names.push('default');
    }
    out.push({ specifier, names, line });
  }
  return out;
}

export async function runImportTests() {
  const files = listJsFiles(portalJs);
  const exportCache = new Map();

  function exportsOf(file) {
    if (!exportCache.has(file)) exportCache.set(file, parseExports(readFileSync(file, 'utf8')));
    return exportCache.get(file);
  }

  describe('Import — risoluzione dei file');

  it('trova i moduli del portale', () => {
    assert(files.length > 20, 'attesi almeno 20 moduli, trovati ' + files.length);
  });

  const missingFiles = [];
  const missingNames = [];

  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    for (const imp of parseImports(src)) {
      if (!imp.specifier.startsWith('.')) continue;  // solo import relativi
      const target = resolve(dirname(file), imp.specifier);
      if (!existsSync(target)) {
        missingFiles.push(relative(root, file) + ':' + imp.line + ' → ' + imp.specifier);
        continue;
      }
      const available = exportsOf(target);
      for (const name of imp.names) {
        if (!available.has(name)) {
          missingNames.push(
            relative(root, file) + ':' + imp.line +
            ' importa "' + name + '" da ' + imp.specifier + ' che non lo esporta'
          );
        }
      }
    }
  }

  it('ogni modulo importato esiste su disco', () => {
    eq(missingFiles.length, 0, 'file non trovati:\n      ' + missingFiles.join('\n      '));
  });

  it('ogni simbolo importato e\' effettivamente esportato', () => {
    eq(missingNames.length, 0, 'import non risolti:\n      ' + missingNames.join('\n      '));
  });

  describe('Import — coerenza col service worker');

  it('il service worker precarica tutti i moduli esistenti', () => {
    const sw = readFileSync(join(root, 'portal', 'sw.js'), 'utf8');
    const missing = [];
    for (const file of files) {
      const rel = './' + relative(join(root, 'portal'), file).split('\\').join('/');
      if (sw.indexOf("'" + rel + "'") < 0) missing.push(rel);
    }
    eq(missing.length, 0,
      'moduli non elencati in PRECACHE (il portale non funzionerebbe offline):\n      ' + missing.join('\n      '));
  });

  it('il service worker non elenca file inesistenti', () => {
    const sw = readFileSync(join(root, 'portal', 'sw.js'), 'utf8');
    const listed = [];
    const re = /'(\.\.?\/[^']+)'/g;
    let m;
    const precacheBlock = /var PRECACHE = \[([\s\S]*?)\];/.exec(sw);
    assert(precacheBlock, 'blocco PRECACHE non trovato in sw.js');
    while ((m = re.exec(precacheBlock[1]))) listed.push(m[1]);

    const broken = listed.filter((rel) => {
      if (rel === './') return false;
      return !existsSync(resolve(join(root, 'portal'), rel));
    });
    eq(broken.length, 0, 'file elencati in PRECACHE ma inesistenti:\n      ' + broken.join('\n      '));
  });

  describe('Import — nessuna dipendenza circolare fra livelli');

  it('i moduli core non importano da views o ui', () => {
    const violations = [];
    for (const file of files) {
      if (!file.includes('/core/')) continue;
      const src = readFileSync(file, 'utf8');
      for (const imp of parseImports(src)) {
        if (/\/(views|ui)\//.test(imp.specifier) || /^\.\.\/(views|ui)\//.test(imp.specifier)) {
          violations.push(relative(root, file) + ' → ' + imp.specifier);
        }
      }
    }
    eq(violations.length, 0,
      'il livello core deve restare indipendente dalla UI:\n      ' + violations.join('\n      '));
  });

  it('i moduli domain non importano da views', () => {
    const violations = [];
    for (const file of files) {
      if (!file.includes('/domain/')) continue;
      const src = readFileSync(file, 'utf8');
      for (const imp of parseImports(src)) {
        if (/views\//.test(imp.specifier)) violations.push(relative(root, file) + ' → ' + imp.specifier);
      }
    }
    eq(violations.length, 0,
      'il livello domain non deve dipendere dalle viste:\n      ' + violations.join('\n      '));
  });
}
