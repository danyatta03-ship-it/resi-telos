// Compila ed esegue i test in TypeScript senza runner esterni.
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readdirSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const testsDir = resolve(here, '../tests');
const outDir = mkdtempSync(join(tmpdir(), 'tbg-tests-'));

const files = readdirSync(testsDir).filter((f) => f.endsWith('.ts'));
let failed = 0;

try {
  for (const file of files) {
    const outfile = join(outDir, `${basename(file, '.ts')}.mjs`);
    await build({
      entryPoints: [join(testsDir, file)],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile,
      logLevel: 'warning',
    });
    console.log(`\n=== ${file} ===`);
    try {
      await import(pathToFileURL(outfile).href);
    } catch (error) {
      failed++;
      console.error(error);
    }
  }
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

process.exit(failed === 0 ? 0 : 1);
