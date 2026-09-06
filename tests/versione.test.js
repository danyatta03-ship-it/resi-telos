// Test sulla versione dell'app e sulla diagnostica Firebase.
//
// Nascono da un guasto reale: il gestionale mostrava OFFLINE con
// "Timeout: nessuna risposta dal database", e per giorni non e' stato
// possibile capire se il dispositivo stesse davvero girando la build con la
// correzione — oppure una copia vecchia rimasta nella cache del service
// worker. Due cose devono essere vere perche' quella domanda abbia risposta:
//
//   1. la versione e' la stessa ovunque, sw.js compreso
//   2. la diagnostica non puo' restare appesa: il caso peggiore del
//      Realtime Database non e' un errore, e' il silenzio

import { describe, it, assert, eq } from './run.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export async function runVersioneTests() {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const sw = readFileSync(join(root, 'sw.js'), 'utf8');

  describe('Versione — deve essere la stessa ovunque');

  // La versione mostrata in Impostazioni e' quella di riferimento.
  const attesa = (html.match(/id="appVersionLbl">(v\d+[a-z]*)</) || [])[1];

  it('Impostazioni dichiara una versione', () => {
    assert(attesa, 'manca #appVersionLbl: senza, l\'utente non sa cosa sta girando');
  });

  it('il pulsante "aggiorna app" mostra la stessa versione', () => {
    const v = (html.match(/>(v\d+[a-z]*) · aggiorna app</) || [])[1];
    eq(v, attesa, 'il footer mostra una versione diversa da Impostazioni');
  });

  it('la Diagnostica Firebase mostra la stessa versione', () => {
    // Serve li' dentro: e' la prima schermata che si guarda quando il
    // database non risponde, ed e' li' che bisogna poter escludere subito
    // "sta girando una build vecchia".
    const box = html.slice(html.indexOf('🩺 Diagnostica Firebase'));
    const v = (box.slice(0, 200).match(/(v\d+[a-z]*)/) || [])[1];
    eq(v, attesa, 'la diagnostica mostra una versione diversa: e\' proprio il posto dove non deve');
  });

  it('la cache del service worker e\' stata rinominata', () => {
    // Se CACHE non cambia, il service worker continua a servire i file
    // vecchi: la correzione viene pubblicata ma sul dispositivo non arriva
    // mai, e si finisce a cercare un guasto in codice che non e' in esecuzione.
    const v = (sw.match(/CACHE\s*=\s*'resi-telos-(v\d+[a-z]*)'/) || [])[1];
    eq(v, attesa, 'sw.js serve ancora la cache di un\'altra versione');
  });

  describe('Diagnostica — nessuna prova puo\' restare appesa');

  const corpo = (() => {
    const i = html.indexOf('window.fbDeepTest = function()');
    assert(i > 0, 'manca fbDeepTest');
    return html.slice(i, html.indexOf('\nfunction getFBCfg()', i));
  })();

  it('esiste il limite di tempo condiviso', () => {
    assert(html.indexOf('function _fbConScadenza(') > 0,
      'senza scadenza una promessa che non risponde mai blocca il test per sempre');
  });

  it('ogni lettura dell\'SDK nella diagnosi ha una scadenza', () => {
    // once('value') non fallisce quando il token non viene accettato: resta
    // sospeso. Ogni chiamata deve passare da _fbConScadenza.
    const letture = corpo.match(/\.once\('value'\)/g) || [];
    assert(letture.length > 0, 'la diagnosi non legge nulla dal database');
    for (const pezzo of corpo.split(/\.once\('value'\)/).slice(0, -1)) {
      const coda = pezzo.slice(-260);
      assert(coda.indexOf('_fbConScadenza') >= 0,
        'una once(\'value\') della diagnosi non e\' protetta da _fbConScadenza');
    }
  });

  it('anche la chiamata https ha una scadenza', () => {
    const i = corpo.indexOf('fetch(');
    assert(i > 0, 'manca la prova via https, quella che distingue rete da websocket');
    assert(corpo.slice(Math.max(0, i - 300), i).indexOf('_fbConScadenza') >= 0,
      'la fetch non e\' protetta: un proxy che non risponde la lascerebbe appesa');
  });

  it('la prova del websocket si arrende dopo un tempo definito', () => {
    const i = corpo.indexOf(".ref('.info/connected')");
    assert(i > 0, 'manca la prova su .info/connected: e\' l\'unica che dice se il socket si apre');
    assert(/setTimeout\(function\(\)\{ fine\(false\); \}, \d+\)/.test(corpo),
      'senza scadenza, un websocket che non si collega lascia la riga in attesa per sempre');
  });

  it('il test rapido non resta piu\' su "Test in corso…"', () => {
    const i = html.indexOf('function fbLiveTest()');
    const live = html.slice(i, html.indexOf('\nfunction _fbConScadenza(', i));
    assert(live.indexOf('_ltWatch') > 0, 'fbLiveTest non ha un controllo di attesa');
    eq((live.match(/_ltFine\(\)/g) || []).length, 3,
      'ogni uscita di fbLiveTest (successo ed errore) deve fermare il controllo di attesa');
  });

  it('la diagnosi distingue https da websocket', () => {
    // E' il motivo per cui esiste: "Timeout: nessuna risposta dal database
    // (URL errato o rete bloccata)" metteva insieme quattro guasti diversi.
    assert(corpo.indexOf('restOk && !wsOk') > 0,
      'manca il verdetto che separa "https passa ma il websocket no"');
    assert(/401|403/.test(corpo), 'manca il verdetto per token rifiutato o regole chiuse');
  });
}
