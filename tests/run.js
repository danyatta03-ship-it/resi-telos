// Runner di test minimale, senza dipendenze.
//   node tests/run.js
//
// I moduli del dominio sono ES module puri (nessun accesso al DOM o a
// Firebase in fase di import), quindi si possono importare e verificare
// direttamente in Node.

import { runSubmitTests } from './submit.test.js';
import { runRulesTests } from './rules.test.js';
import { runEscapingTests } from './escaping.test.js';
import { runVersioneTests } from './versione.test.js';
import { runSyncTests } from './sync.test.js';
import { runRestTests } from './rest.test.js';

let passed = 0;
let failed = 0;
const failures = [];
let suite = '';

export function describe(name) {
  suite = name;
  console.log('\n\x1b[1m' + name + '\x1b[0m');
}

// Test asincroni in attesa. Prima non esistevano: it() chiamava fn() e
// basta, quindi un test async restituiva una promessa che nessuno guardava
// e veniva contato come superato SENZA aver eseguito una sola asserzione.
// Due test sull'escaping sono rimasti cosi' per settimane, verdi e vuoti,
// e puntavano per giunta a un file che non esiste piu'.
const inCorso = [];

function ok(name) {
  passed++;
  console.log('  \x1b[32m✓\x1b[0m ' + name);
}
function ko(suiteName, name, err) {
  failed++;
  failures.push({ suite: suiteName, name, err });
  console.log('  \x1b[31m✗\x1b[0m ' + name);
  console.log('    \x1b[31m' + (err && err.message) + '\x1b[0m');
}

export function it(name, fn) {
  const suiteCorrente = suite;
  let esito;
  try {
    esito = fn();
  } catch (err) {
    ko(suiteCorrente, name, err);
    return;
  }
  if (esito && typeof esito.then === 'function') {
    inCorso.push(esito.then(() => ok(name), (err) => ko(suiteCorrente, name, err)));
    return;
  }
  ok(name);
}

// Da chiamare dopo ogni gruppo: senza, i test asincroni verrebbero contati
// dopo il riepilogo — cioe' mai.
export async function attendi() {
  await Promise.all(inCorso);
  inCorso.length = 0;
}

export function assert(condition, message) {
  if (!condition) throw new Error(message || 'assertion failed');
}

export function eq(actual, expected, message) {
  if (actual !== expected) {
    throw new Error((message || 'valori diversi') + '\n      atteso:  ' + JSON.stringify(expected) + '\n      ricevuto: ' + JSON.stringify(actual));
  }
}

export function near(actual, expected, tolerance, message) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error((message || 'valore fuori tolleranza') + ' — atteso ~' + expected + ', ricevuto ' + actual);
  }
}

export function throws(fn, message) {
  let threw = false;
  try { fn(); } catch (e) { threw = true; }
  if (!threw) throw new Error(message || 'ci si aspettava un\'eccezione');
}

console.log('\x1b[1m\x1b[36m╔══════════════════════════════════════════════╗\x1b[0m');
console.log('\x1b[1m\x1b[36m║   Test — App pubblica Reso Telos             ║\x1b[0m');
console.log('\x1b[1m\x1b[36m╚══════════════════════════════════════════════╝\x1b[0m');

await runSubmitTests(); await attendi();
await runRulesTests(); await attendi();
await runEscapingTests(); await attendi();
await runVersioneTests(); await attendi();
await runSyncTests(); await attendi();
await runRestTests(); await attendi();

console.log('\n' + '─'.repeat(48));
if (failed === 0) {
  console.log('\x1b[32m\x1b[1m✓ ' + passed + ' test superati\x1b[0m');
  process.exit(0);
} else {
  console.log('\x1b[31m\x1b[1m✗ ' + failed + ' falliti\x1b[0m, ' + passed + ' superati');
  console.log('\nDettaglio fallimenti:');
  for (const f of failures) {
    console.log('  • [' + f.suite + '] ' + f.name);
    console.log('    ' + (f.err && f.err.message));
  }
  process.exit(1);
}
