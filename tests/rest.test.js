// Test del trasporto di riserva via HTTPS (fbRestRef).
//
// Questo modulo esiste perche' l'SDK del Realtime Database parla su
// websocket, e una rete che lascia passare https ma blocca l'upgrade a
// websocket ferma il gestionale senza che nessuno possa farci niente: l'SDK
// non fallisce, tace. fbRestRef rifa' i nove metodi che il gestionale usa
// davvero sopra la REST API di Firebase, che viaggia su https normale.
//
// E' codice che sostituisce il database: se sbaglia un URL, un metodo o un
// confronto, i resi si perdono. Quindi non basta controllare che esista —
// qui viene eseguito davvero, contro un finto Firebase in memoria, e si
// verifica ogni chiamata che produce: metodo HTTP, percorso, parametri,
// corpo, e gli eventi che emette quando i dati cambiano sotto.

import { describe, it, assert, eq } from './run.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const attesa = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Il finto Firebase ────────────────────────────────────────────────
// Serve un albero in memoria via REST, registrando ogni richiesta.
function creaServer(albero) {
  const richieste = [];
  let negaTutto = false;

  function leggi(path) {
    if (!path) return albero;
    let v = albero;
    for (const seg of path.split('/')) v = (v && typeof v === 'object') ? v[seg] : undefined;
    return v === undefined ? null : v;
  }
  function scrivi(path, val) {
    const parti = path.split('/');
    const ultimo = parti.pop();
    let v = albero;
    for (const seg of parti) { if (!v[seg] || typeof v[seg] !== 'object') v[seg] = {}; v = v[seg]; }
    if (val === null) delete v[ultimo]; else v[ultimo] = val;
  }

  const fetch = (url, opzioni = {}) => {
    const u = new URL(url);
    const metodo = opzioni.method || 'GET';
    const path = u.pathname.replace(/^\//, '').replace(/\.json$/, '');
    richieste.push({ metodo, path, url, query: u.search, corpo: opzioni.body ? JSON.parse(opzioni.body) : undefined });

    if (negaTutto) return Promise.resolve({ ok: false, status: 401, text: () => Promise.resolve('Permission denied') });

    let corpo = null;
    if (metodo === 'GET') {
      corpo = leggi(path);
      const limite = u.searchParams.get('limitToLast') || u.searchParams.get('limitToFirst');
      if (limite && corpo && typeof corpo === 'object') {
        const ks = Object.keys(corpo).sort();
        const scelte = u.searchParams.get('limitToLast') ? ks.slice(-Number(limite)) : ks.slice(0, Number(limite));
        corpo = Object.fromEntries(scelte.map((k) => [k, corpo[k]]));
      }
    } else if (metodo === 'PUT') {
      scrivi(path, JSON.parse(opzioni.body)); corpo = JSON.parse(opzioni.body);
    } else if (metodo === 'PATCH') {
      const cur = leggi(path) || {};
      scrivi(path, Object.assign({}, cur, JSON.parse(opzioni.body))); corpo = JSON.parse(opzioni.body);
    } else if (metodo === 'DELETE') {
      scrivi(path, null);
    } else if (metodo === 'POST') {
      const nome = '-Gen' + (richieste.length);
      scrivi(path + '/' + nome, JSON.parse(opzioni.body));
      corpo = { name: nome };
    }
    return Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve(JSON.stringify(corpo)) });
  };

  return { fetch, richieste, albero, nega: (v) => { negaTutto = v; } };
}

// ── Carica il modulo vero, estratto da index.html ────────────────────
function caricaModulo(server) {
  const html = readFileSync(join(root, 'index.html'), 'utf8');
  const da = html.indexOf('var FB_REST = {');
  const a = html.indexOf('// Debounce per il sync incrementale');
  assert(da > 0 && a > da, 'non trovo il modulo REST dentro index.html');
  const sorgente = html.slice(da, a);

  // Stub minimi: il token viaggia gia' su https, qui basta che ci sia.
  const contesto = {
    firebase: { auth: () => ({ currentUser: { getIdToken: () => Promise.resolve('TOKEN') } }) },
    fetch: server.fetch,
    setTimeout, clearTimeout, setInterval, clearInterval,
    encodeURIComponent, JSON, Object, Date, Math, Promise, String, Error
  };
  const fabbrica = new Function(
    ...Object.keys(contesto),
    sorgente + '\n; return { FB_REST: FB_REST, fbRestRef: fbRestRef, fbRestStop: fbRestStop, _fbSnap: _fbSnap };'
  );
  return fabbrica(...Object.values(contesto));
}

export async function runRestTests() {
  // ── Scenari eseguiti prima, asserzioni dopo ────────────────────────
  // Il runner e' sincrono: raccolgo qui tutto quello che serve.
  const esiti = {};

  {
    const srv = creaServer({
      returns: { a1: { _key: 'a1', cod: 'AAA' }, b2: { _key: 'b2', cod: 'BBB' } },
      presence: { pc1: { name: 'Ufficio', ts: 1 } },
      security_log: { mods: { m1: { t: 1 }, m2: { t: 2 }, m3: { t: 3 } } }
    });
    const M = caricaModulo(srv);
    M.FB_REST.base = 'https://db.example.com';
    M.FB_REST.intervallo = 30;

    const ref = M.fbRestRef('returns');

    // Lettura
    const snap = await ref.once('value');
    esiti.letturaVal = snap.val();
    esiti.letturaNum = snap.numChildren();
    esiti.letturaEsiste = snap.exists();
    const figli = [];
    snap.forEach((s) => { figli.push(s.key + '=' + s.val().cod); });
    esiti.forEach = figli.join(',');
    esiti.snapChild = snap.child('a1/cod').val();
    esiti.snapChildMancante = snap.child('zz/cod').val();

    // Scritture
    await ref.child('c3').set({ _key: 'c3', cod: 'CCC' });
    await ref.child('a1').update({ cod: 'MODIFICATO' });
    await ref.child('b2').remove();
    const nuovo = await M.fbRestRef('security_log/mods').push({ t: 9 });
    esiti.pushKey = nuovo.key;
    esiti.alberoDopo = Object.keys(srv.albero.returns).sort().join(',');
    esiti.valoreAggiornato = srv.albero.returns.a1.cod;

    // Percorsi e parametri
    esiti.root = M.fbRestRef('returns').root.child('portal_counters/staff')._path;
    await M.fbRestRef('security_log/mods').limitToLast(2).once('value');
    esiti.richieste = srv.richieste;
    esiti.urlLettura = srv.richieste[0].url;
  }

  {
    // Ascolto: il polling deve emettere gli stessi eventi dell'SDK.
    const srv = creaServer({ returns: { a1: { _key: 'a1', cod: 'AAA' } } });
    const M = caricaModulo(srv);
    M.FB_REST.base = 'https://db.example.com';
    M.FB_REST.intervallo = 20;

    const ref = M.fbRestRef('returns');
    const aggiunti = [], cambiati = [], rimossi = [], valori = [];

    ref.on('child_added', (s) => aggiunti.push(s.key));
    ref.on('child_changed', (s) => cambiati.push(s.key + ':' + s.val().cod));
    ref.on('child_removed', (s) => rimossi.push(s.key));
    ref.on('value', () => valori.push(1));

    await attesa(70);
    esiti.primoGiro = aggiunti.slice();
    esiti.valoriDopoPrimoGiro = valori.length;

    srv.albero.returns.z9 = { _key: 'z9', cod: 'ZZZ' };
    srv.albero.returns.a1.cod = 'CAMBIATO';
    await attesa(90);
    esiti.aggiuntiDopo = aggiunti.slice();
    esiti.cambiatiDopo = cambiati.slice();

    delete srv.albero.returns.z9;
    await attesa(90);
    esiti.rimossiDopo = rimossi.slice();

    // Nessuna modifica: 'value' non deve ri-emettere
    const primaValori = valori.length;
    await attesa(90);
    esiti.valoriSenzaModifiche = valori.length - primaValori;

    // Spegnimento
    esiti.pollsPrima = M.FB_REST.polls.length;
    M.fbRestStop();
    const richiestePrima = srv.richieste.length;
    await attesa(90);
    esiti.richiesteDopoStop = srv.richieste.length - richiestePrima;
    esiti.pollsDopo = M.FB_REST.polls.length;
  }

  {
    // off() mirato: spegne solo l'ascoltatore indicato.
    const srv = creaServer({ returns: {} });
    const M = caricaModulo(srv);
    M.FB_REST.base = 'https://db.example.com';
    M.FB_REST.intervallo = 20;
    const ref = M.fbRestRef('returns');
    const a = ref.on('value', () => {});
    ref.on('child_added', () => {});
    esiti.offPrima = M.FB_REST.polls.length;
    ref.off('value', a);
    esiti.offDopo = M.FB_REST.polls.length;
    esiti.offRimasto = M.FB_REST.polls[0] && M.FB_REST.polls[0].ev;
    M.fbRestStop();
  }

  {
    // Rifiuto del server: deve arrivare un errore riconoscibile.
    const srv = creaServer({ returns: {} });
    const M = caricaModulo(srv);
    M.FB_REST.base = 'https://db.example.com';
    srv.nega(true);
    try {
      await M.fbRestRef('returns').once('value');
      esiti.errore = '(nessun errore)';
    } catch (e) { esiti.errore = e.message; }
  }

  // ── Asserzioni ─────────────────────────────────────────────────────

  describe('REST — lettura');

  it('once(\'value\') restituisce i dati del nodo', () => {
    eq(Object.keys(esiti.letturaVal).sort().join(','), 'a1,b2');
    eq(esiti.letturaNum, 2);
    eq(esiti.letturaEsiste, true);
  });

  it('la snapshot si comporta come quella dell\'SDK', () => {
    eq(esiti.forEach, 'a1=AAA,b2=BBB', 'forEach deve visitare i figli in ordine');
    eq(esiti.snapChild, 'AAA', 'child() deve scendere lungo il percorso');
    eq(esiti.snapChildMancante, null, 'un percorso inesistente deve dare null, non esplodere');
  });

  it('la lettura chiede GET sul percorso giusto, col token', () => {
    const r = esiti.richieste[0];
    eq(r.metodo, 'GET');
    eq(r.path, 'returns');
    assert(esiti.urlLettura.indexOf('auth=TOKEN') > 0, 'il token deve viaggiare nella query');
    assert(esiti.urlLettura.indexOf('.json') > 0, 'la REST API di Firebase vuole il suffisso .json');
  });

  describe('REST — scrittura');

  it('set() usa PUT, update() usa PATCH, remove() usa DELETE', () => {
    const perPath = (p, m) => esiti.richieste.find((r) => r.path === p && r.metodo === m);
    assert(perPath('returns/c3', 'PUT'), 'set() deve essere una PUT sul figlio');
    assert(perPath('returns/a1', 'PATCH'), 'update() deve essere una PATCH: una PUT cancellerebbe gli altri campi');
    assert(perPath('returns/b2', 'DELETE'), 'remove() deve essere una DELETE');
  });

  it('le scritture arrivano davvero nel database', () => {
    eq(esiti.alberoDopo, 'a1,c3', 'c3 aggiunto e b2 rimosso');
    eq(esiti.valoreAggiornato, 'MODIFICATO');
  });

  it('update() non azzera i campi che non nomina', () => {
    // E' la differenza fra PATCH e PUT: sbagliarla qui vorrebbe dire
    // perdere silenziosamente meta' dei campi di ogni riga toccata.
    const r = esiti.richieste.find((x) => x.path === 'returns/a1' && x.metodo === 'PATCH');
    eq(Object.keys(r.corpo).join(','), 'cod', 'la PATCH deve mandare solo i campi cambiati');
  });

  it('push() crea una chiave nuova e la restituisce', () => {
    assert(esiti.pushKey && esiti.pushKey.indexOf('-Gen') === 0,
      'push() deve tornare un riferimento sulla chiave generata dal server, non su quella del padre');
  });

  describe('REST — percorsi e filtri');

  it('root risale alla radice del database', () => {
    // Il gestionale usa FB_REF.root.child('...') in 28 punti: se root
    // restasse agganciato a returns, scriverebbe tutto nel posto sbagliato.
    eq(esiti.root, 'portal_counters/staff');
  });

  it('limitToLast aggiunge orderBy, che il REST pretende', () => {
    const r = esiti.richieste.find((x) => x.query.indexOf('limitToLast') > 0);
    assert(r, 'nessuna richiesta con limitToLast');
    assert(r.query.indexOf('orderBy=%22%24key%22') > 0,
      'senza orderBy="$key" la REST API rifiuta limitTo* con un errore');
  });

  describe('REST — ascolto continuo');

  it('al primo giro emette child_added per quello che c\'e\' gia\'', () => {
    // Come l'SDK: il gestionale ci conta, perche' salta il replay usando
    // fbInitKeys.
    eq(esiti.primoGiro.join(','), 'a1');
  });

  it('emette child_added solo per le righe nuove', () => {
    eq(esiti.aggiuntiDopo.join(','), 'a1,z9', 'a1 non deve essere riemesso');
  });

  it('emette child_changed quando una riga cambia', () => {
    eq(esiti.cambiatiDopo.join(','), 'a1:CAMBIATO');
  });

  it('emette child_removed quando una riga sparisce', () => {
    eq(esiti.rimossiDopo.join(','), 'z9');
  });

  it('value non si ripete se i dati non cambiano', () => {
    // Senza il confronto, ogni giro rifarebbe renderAll: l'app diventerebbe
    // inusabile per conto suo.
    assert(esiti.valoriDopoPrimoGiro >= 1, 'value deve emettere almeno una volta');
    eq(esiti.valoriSenzaModifiche, 0, 'value ha riemesso senza che i dati cambiassero');
  });

  describe('REST — spegnimento');

  it('fbRestStop ferma davvero le richieste', () => {
    assert(esiti.pollsPrima >= 4, 'attesi 4 ascoltatori attivi, trovati ' + esiti.pollsPrima);
    eq(esiti.pollsDopo, 0, 'il registro deve restare vuoto');
    eq(esiti.richiesteDopoStop, 0,
      'dopo lo stop il polling ha continuato a interrogare il database: e\' la stessa perdita di prima, in versione https');
  });

  it('off() spegne solo l\'ascoltatore indicato', () => {
    eq(esiti.offPrima, 2);
    eq(esiti.offDopo, 1);
    eq(esiti.offRimasto, 'child_added', 'e\' stato spento quello sbagliato');
  });

  describe('REST — errori');

  it('un rifiuto del server diventa un errore riconoscibile', () => {
    // fbErrText traduce PERMISSION_DENIED nella frase che dice cosa fare;
    // un messaggio generico finirebbe nel ramo "errore sconosciuto".
    eq(esiti.errore, 'PERMISSION_DENIED');
  });
}
