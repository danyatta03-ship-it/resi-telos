// Test sulla sincronizzazione Firebase — perdite di ascoltatori.
//
// Nasce dal guasto che produceva i "problemi a caso": _fbConnectDb registra
// sette ascoltatori permanenti, e quando una connessione falliva _vFail si
// limitava a FB_REF=null. Azzerare il riferimento NON stacca gli ascoltatori:
// li rende solo irraggiungibili. Restavano vivi, e ensureFB ritenta dopo 5
// secondi e poi ogni 30 — quindi ogni tentativo fallito ne aggiungeva altri
// sette sopra i precedenti.
//
// Un PC lasciato in errore per un'ora ne accumulava un centinaio per tipo.
// Alla riconnessione partivano tutti insieme: renderAll ripetuto decine di
// volte per riga, notifiche doppie, presenza scritta N volte, il carico
// iniziale di returns scaricato N volte. Sintomi diversi ogni volta, una
// sola radice — ed e' esattamente la classe di guasto che non si riesce a
// riprodurre a comando, perche' dipende da quanto a lungo il PC e' rimasto
// in errore prima che qualcuno guardasse.
//
// Questi test non eseguono il codice: leggono la struttura. Se qualcuno
// riaggiunge un .on() fuori dal registro, o toglie il detach dal punto di
// fallimento, la perdita torna — e il test la ferma prima del deploy.

import { describe, it, assert, eq } from './run.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export async function runSyncTests() {
  const html = readFileSync(join(root, 'index.html'), 'utf8');

  const connect = (() => {
    const i = html.indexOf('function _fbConnectDb(');
    assert(i > 0, 'manca _fbConnectDb');
    const j = html.indexOf('\nfunction openFBModal(', i);
    assert(j > i, 'non trovo la fine di _fbConnectDb');
    return html.slice(i, j);
  })();

  describe('Sync — gli ascoltatori non devono accumularsi');

  it('esiste il registro degli ascoltatori', () => {
    assert(html.indexOf('function _fbOn(') > 0, 'manca _fbOn: senza registro non si puo\' staccare niente');
    assert(html.indexOf('function _fbDetachAll(') > 0, 'manca _fbDetachAll');
  });

  it('_fbDetachAll stacca davvero, non azzera soltanto la lista', () => {
    const f = html.slice(html.indexOf('function _fbDetachAll('));
    const corpo = f.slice(0, f.indexOf('\n}'));
    assert(/\.off\(/.test(corpo), '_fbDetachAll deve chiamare .off() su ogni ascoltatore');
    assert(corpo.indexOf('_FB_AUTH_OFF') > 0,
      'anche onAuthStateChanged va disiscritto: restituisce una funzione, non basta ignorarla');
  });

  it('in _fbConnectDb nessun ascoltatore sfugge al registro', () => {
    // Ogni .on( dentro la connessione deve essere passato da _fbOn.
    const fuori = [];
    const re = /(^|[^n])\.on\('/g;   // "_fbOn(" finisce con n prima del punto? no: escludo per contesto
    let m;
    while ((m = re.exec(connect))) {
      const prima = connect.slice(Math.max(0, m.index - 120), m.index);
      if (prima.lastIndexOf('_fbOn(') < 0) {
        fuori.push(connect.slice(Math.max(0, m.index - 60), m.index + 40).replace(/\s+/g, ' '));
      }
    }
    eq(fuori.length, 0, 'ascoltatori registrati fuori dal registro:\n      ' + fuori.join('\n      '));
  });

  it('il punto di fallimento stacca prima di arrendersi', () => {
    const i = connect.indexOf('function _vFail(');
    assert(i > 0, 'manca _vFail');
    const corpo = connect.slice(i, connect.indexOf('}', connect.indexOf('cb(false', i)));
    assert(corpo.indexOf('_fbDetachAll()') > 0,
      'senza detach, FB_REF=null lascia vivi sette ascoltatori e il retry ne aggiunge altri sette');
  });

  it('ogni nuovo tentativo parte pulito', () => {
    const testa = connect.slice(0, connect.indexOf("db.ref('returns')") + 40);
    assert(testa.indexOf('_fbDetachAll()') > 0,
      '_fbConnectDb deve staccare gli agganci del tentativo precedente prima di crearne di nuovi');
  });

  describe('Sync — le risposte dei tentativi superati vanno ignorate');

  it('esiste il contatore di generazione', () => {
    assert(html.indexOf('_FB_GEN') > 0, 'manca _FB_GEN');
    assert(connect.indexOf('++_FB_GEN') > 0, 'ogni tentativo deve incrementare la generazione');
    assert(connect.indexOf('function _viva()') > 0, 'manca il controllo _viva()');
  });

  it('il carico iniziale non sovrascrive con dati di un tentativo vecchio', () => {
    // once('value') di un tentativo fallito puo' arrivare dopo che un
    // tentativo nuovo ha gia' popolato rows: senza guardia lo sovrascrive
    // con una fotografia piu' vecchia del database.
    const i = connect.indexOf("FB_REF.once('value', function(snap)");
    assert(i > 0, 'manca il carico iniziale');
    assert(connect.slice(i, i + 160).indexOf('_viva()') > 0,
      'il carico iniziale deve controllare di appartenere al tentativo corrente');
  });

  it('ogni singolo ascoltatore controlla la generazione', () => {
    // Contare le guardie e confrontarle col numero di ascoltatori non basta:
    // ci sono altri _viva() nel file (il carico iniziale, idbGet,
    // _fbAttachChild), quindi il totale resta alto anche togliendo una
    // guardia. Va guardato ogni ascoltatore uno per uno.
    const senzaGuardia = [];
    let i = -1;
    while ((i = connect.indexOf('_fbOn(', i + 1)) >= 0) {
      const apertura = connect.indexOf('{', connect.indexOf('function', i));
      const inizio = connect.slice(apertura + 1, apertura + 90);
      if (!/!_viva\(\)\s*\)\s*return/.test(inizio)) {
        senzaGuardia.push(connect.slice(i, i + 70).replace(/\s+/g, ' '));
      }
    }
    const attacchi = (connect.match(/_fbOn\(/g) || []).length;
    assert(attacchi >= 6, 'attesi almeno 6 ascoltatori registrati, trovati ' + attacchi);
    eq(senzaGuardia.length, 0,
      'un ascoltatore di un tentativo superato continuerebbe a scrivere:\n      ' +
      senzaGuardia.join('\n      '));
  });

  describe('Sync — la perdita deve restare visibile');

  it('la Diagnostica mostra quanti ascoltatori sono attivi', () => {
    // Il guasto e' rimasto invisibile per mesi perche' non c'era niente da
    // guardare: si vedevano solo i sintomi, sempre diversi.
    assert(html.indexOf('Ascoltatori attivi: ') > 0,
      'senza questo numero in Diagnostica, una perdita futura torna invisibile');
    assert(/_FB_ON\.length\s*<=\s*\d+/.test(html),
      'il conteggio deve avere una soglia, altrimenti e\' solo un numero');
  });

  describe('Sync — il CSP non deve strozzare il trasporto di Firebase');

  it('script-src ammette il dominio del database', () => {
    // La causa vera di mesi di "Timeout: nessuna risposta dal database".
    //
    // Il Realtime Database NON apre il websocket per primo: stabilisce una
    // connessione in long-polling e poi la promuove. Il long-polling
    // funziona iniettando tag <script> verso <database>.firebasedatabase.app
    // — quindi passa da script-src, non da connect-src. Con quel dominio
    // assente da script-src il browser blocca il trasporto iniziale, la
    // connessione non si stabilisce mai, e il websocket non viene nemmeno
    // tentato: l'SDK resta muto. Nessun errore, solo silenzio, su
    // QUALUNQUE rete — anche sotto 5G, dove nessun firewall aziendale puo'
    // entrarci.
    //
    // Era gia' stato affrontato a meta': "v35r — connect-src rilassato a
    // https:/wss: dopo report Firebase non connette". Quella correzione
    // apriva la strada al websocket ma lasciava chiuso il trasporto che
    // viene prima, e per mesi ha fatto sembrare il guasto un problema di
    // rete.
    const toml = readFileSync(join(root, 'netlify.toml'), 'utf8');
    const riga = toml.split('\n').find((l) => /^\s*Content-Security-Policy\s*=/.test(l));
    assert(riga, 'manca la Content-Security-Policy');
    const m = /script-src ([^;]+);/.exec(riga);
    assert(m, 'manca script-src nella CSP');
    assert(/firebasedatabase\.app/.test(m[1]),
      'script-src non ammette *.firebasedatabase.app: il long-polling di Firebase viene bloccato e il database resta muto\n      script-src attuale: ' + m[1].trim());
  });

  it('la diagnosi sa riconoscere un blocco del CSP', () => {
    // Senza questo, un blocco del CSP viene attribuito alla rete — ed e'
    // esattamente l'errore che ha mandato fuori strada la diagnosi finora.
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    assert(html.indexOf("'securitypolicyviolation'") > 0,
      'la diagnosi deve ascoltare gli avvisi del browser: in console non li vede nessuno da un telefono');
    assert(html.indexOf('function cspBloccaDatabase(') > 0,
      'manca il riconoscimento delle violazioni che riguardano il database');
  });

  it('il verdetto non dà piu\' la colpa alla rete a priori', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    const i = html.indexOf('if(restOk && !wsOk){');
    assert(i > 0, 'manca il verdetto per https-ok/realtime-ko');
    const corpo = html.slice(i, i + 2200);
    // La vecchia conclusione dava la rete dell'ufficio per certa. Era
    // sbagliata: lo stesso guasto si presenta identico sotto rete mobile.
    assert(corpo.indexOf('rete dell\\\'ufficio') < 0,
      'il verdetto accusa ancora la rete dell\'ufficio, che con il telefono non c\'entra');
    assert(corpo.indexOf('CSP') > 0,
      'il verdetto deve nominare il CSP: e\' la causa che si presenta su qualunque rete');
    assert(corpo.indexOf('long-polling') > 0,
      'il verdetto deve spiegare che il trasporto iniziale non e\' il websocket');
  });

  it('il service worker non intercetta le chiamate al database', () => {
    // Il ripiego https parla con *.firebasedatabase.app, un'origine diversa
    // da quella del sito. Il service worker la lascia passare solo grazie
    // al controllo sull'origine: se cadesse, metterebbe in cache le
    // risposte del database e il gestionale servirebbe dati vecchi per
    // sempre, senza nessun errore visibile. Peggio, la cache network-first
    // restituirebbe l'ultima copia buona anche a database irraggiungibile.
    const sw = readFileSync(join(root, 'sw.js'), 'utf8');
    const i = sw.indexOf("addEventListener('fetch'");
    assert(i > 0, 'manca il gestore fetch nel service worker');
    const testa = sw.slice(i, i + 400);
    assert(/url\.origin\s*!==\s*location\.origin\)\s*return/.test(testa),
      'il service worker deve ignorare le richieste verso altre origini, database compreso');
  });

  it('l\'azzeramento di emergenza stacca tutto', () => {
    const i = html.indexOf('function performLocalWipe(');
    const corpo = html.slice(i, i + 900);
    assert(corpo.indexOf('_fbDetachAll()') > 0,
      'dopo il wipe nessun ascoltatore deve poter ripopolare i dati');
  });
}
