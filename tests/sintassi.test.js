// Controllo di sintassi sui moduli dell'app pubblica.
//
// Il portale non ha nessun passo di build: i file vanno in produzione come
// sono scritti. Non c'e' un bundler che si lamenti, non c'e' un compilatore
// che fallisca il deploy. Una parentesi sbagliata in un modulo arriva viva
// fino al browser dell'utente, che smette di caricare la pagina e non dice
// niente a nessuno.
//
// Qui i file vengono dati a Node con --check, che li analizza come ES
// module senza eseguirli — importante, perche' eseguirli non si potrebbe:
// app.js tocca document appena caricato.

import { describe, it, assert } from './run.js';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';
import { tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export async function runSintassiTests() {
  describe('Sintassi — niente arriva rotto in produzione');

  const dir = join(root, 'portal', 'js');
  const moduli = readdirSync(dir).filter((f) => f.endsWith('.js')).sort();

  it('ci sono moduli da controllare', () => {
    assert(moduli.length >= 7, 'attesi almeno 7 moduli, trovati ' + moduli.length);
  });

  // L'estensione .mjs serve a far analizzare i file come ES module: con .js
  // Node li leggerebbe come CommonJS e ogni "import" sembrerebbe un errore.
  const tmp = mkdtempSync(join(tmpdir(), 'sintassi-'));
  try {
    for (const f of moduli) {
      it(f + ' e\' sintatticamente valido', () => {
        const dest = join(tmp, basename(f, '.js') + '.mjs');
        writeFileSync(dest, readFileSync(join(dir, f), 'utf8'));
        try {
          execFileSync(process.execPath, ['--check', dest], { stdio: 'pipe' });
        } catch (e) {
          const msg = String((e.stderr && e.stderr.toString()) || e.message)
            .split('\n').filter((l) => l.trim() && !/^\s*at /.test(l)).slice(0, 6).join('\n      ');
          throw new Error('errore di sintassi:\n      ' + msg);
        }
      });
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  it('ogni modulo importato esiste davvero', () => {
    // Un percorso sbagliato non e' un errore di sintassi: il file passa il
    // controllo e poi il browser non trova il modulo. E' gia' successo —
    // due test importavano portal/js/ui/dom.js, che non esiste piu'.
    const mancanti = [];
    for (const f of moduli) {
      const src = readFileSync(join(dir, f), 'utf8');
      const re = /from\s+'(\.[^']+)'/g;
      let m;
      while ((m = re.exec(src))) {
        const target = join(dir, m[1]);
        try { readFileSync(target); } catch (e) { mancanti.push(f + ' → ' + m[1]); }
      }
    }
    assert(mancanti.length === 0, 'import verso file inesistenti:\n      ' + mancanti.join('\n      '));
  });

  it('ogni modulo e\' raggiungibile da app.js', () => {
    // Un modulo che nessuno importa e' codice morto: si finisce per
    // modificarlo credendo di cambiare qualcosa.
    const visti = new Set();
    (function segui(f) {
      if (visti.has(f)) return;
      visti.add(f);
      const src = readFileSync(join(dir, f), 'utf8');
      const re = /from\s+'\.\/([^']+)'/g;
      let m;
      while ((m = re.exec(src))) segui(m[1]);
    })('app.js');
    const orfani = moduli.filter((f) => !visti.has(f));
    assert(orfani.length === 0, 'moduli che nessuno importa: ' + orfani.join(', '));
  });
}
