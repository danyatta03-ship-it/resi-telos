// Test sulle Security Rules.
//
// Non eseguono le regole (servirebbe l'emulatore Firebase): verificano
// proprieta' strutturali che, se violate, aprono un buco o rompono il
// gestionale. In particolare:
//   1. le regole del gestionale devono restare IDENTICHE alla v1
//   2. i nodi nuovi devono richiedere autenticazione
//   3. i campi che decide il server non devono essere scrivibili a piacere
//   4. non devono esistere nodi avanzati dalla versione precedente

import { describe, it, assert, eq } from './run.js';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export async function runRulesTests() {
  const v1 = JSON.parse(readFileSync(join(root, 'firebase-rules.json'), 'utf8')).rules;
  const v2 = JSON.parse(readFileSync(join(root, 'firebase-rules-v2.json'), 'utf8')).rules;

  describe('Regole — il gestionale non deve accorgersi di niente');

  const LEGACY = [
    'returns', 'chat', 'presence', 'admin', 'security_log',
    'notifEvents', 'notif', 'ocrLive', 'mailFollowups',
    'pkgphotos', '_backups', 'codeMem', '_killswitch'
  ];

  it('tutti i nodi del gestionale sono ancora presenti', () => {
    for (const n of LEGACY) assert(v2[n] !== undefined, 'nodo mancante: ' + n);
  });

  it('le loro regole sono identiche byte per byte alla v1', () => {
    for (const n of LEGACY) {
      eq(JSON.stringify(v2[n]), JSON.stringify(v1[n]),
        'le regole di "' + n + '" sono cambiate: il gestionale potrebbe rompersi');
    }
  });

  it('la radice resta chiusa', () => {
    eq(v2['.read'], false);
    eq(v2['.write'], false);
  });

  it('returns/ resta scrivibile con l\'auth anonima del gestionale', () => {
    eq(v2.returns['.read'], 'auth != null');
    eq(v2.returns.$key['.write'], 'auth != null');
  });

  it('il file contiene SOLO la chiave "rules"', () => {
    // La Console Firebase rifiuta qualsiasi altra chiave di primo livello.
    // Un file con dentro una sezione di commenti sembra valido — e' JSON
    // corretto — ma non si riesce a incollare: la Console risponde con un
    // errore di parsing e le regole vecchie restano attive.
    for (const f of ['firebase-rules.json', 'firebase-rules-v2.json']) {
      const chiavi = Object.keys(JSON.parse(readFileSync(join(root, f), 'utf8')));
      eq(chiavi.join(','), 'rules', f + ' ha chiavi extra: ' + chiavi.join(', '));
    }
  });

  describe('Regole — copertura di quello che il gestionale usa davvero');

  it('ogni nodo toccato da index.html ha una regola', () => {
    // Nasce da un bug reale: _diag (il nodo su cui il pulsante "Test
    // connessione" prova a scrivere) non aveva regole, quindi cadeva sul
    // ".write": false della radice. Il test riportava "Scrittura rifiutata"
    // anche quando i resi si salvavano benissimo — e faceva pensare che la
    // sincronizzazione fosse rotta. Stessa storia per _backups_meta, che
    // coordina il backup giornaliero fra i PC.
    const html = readFileSync(join(root, 'index.html'), 'utf8');

    // Cerco solo i nodi di PRIMO livello: .ref('X') e root.child('X').
    // Un .child('y') su un riferimento gia' annidato non e' un nodo radice.
    const radice = new Set();
    const re = /(?:\.ref\(|\broot\.child\()'([A-Za-z_][A-Za-z0-9_]*)/g;
    let m;
    while ((m = re.exec(html))) radice.add(m[1]);

    // '.info/connected' e' un nodo di servizio dell'SDK, non del database.
    radice.delete('info');

    const scoperti = Array.from(radice).filter((n) => v2[n] === undefined).sort();
    eq(scoperti.length, 0,
      'nodi usati dal gestionale ma senza regole (verrebbero negati):\n      ' + scoperti.join('\n      '));
  });

  it('_diag e _backups_meta sono scrivibili', () => {
    assert(v2._diag, '_diag serve al pulsante "Test connessione"');
    assert(v2._backups_meta, '_backups_meta coordina il backup automatico');
    eq(v2._diag.$device['.write'], 'auth != null');
    eq(v2._backups_meta['.write'], 'auth != null');
  });

  describe('Regole — nodi nuovi');

  it('esistono solo i due nodi del portale, piu\' i due di servizio', () => {
    const nuovi = Object.keys(v2).filter((k) => !k.startsWith('.') && LEGACY.indexOf(k) < 0);
    eq(nuovi.sort().join(','), '_backups_meta,_diag,portal_counters,portal_submissions',
      'nodi inattesi: ' + nuovi.join(', '));
  });

  it('non sono rimasti nodi della versione precedente', () => {
    // portal_users, portal_view, portal_access, portal_timeline… appartenevano
    // all'impianto con login e ruoli, che non esiste piu'. Se ricomparissero
    // sarebbero superficie di attacco senza nessuno che la usa.
    const morti = ['portal_users', 'portal_view', 'portal_access', 'portal_timeline',
      'portal_messages', 'portal_documents', 'portal_requests', 'portal_config',
      'portal_notifications', 'portal_audit', 'portal_sync_meta'];
    for (const n of morti) eq(v2[n], undefined, 'nodo obsoleto ancora presente: ' + n);
  });

  it('entrambi richiedono autenticazione in lettura', () => {
    eq(v2.portal_submissions['.read'], 'auth != null');
    eq(v2.portal_counters['.read'], 'auth != null');
  });

  it('nessuna lettura pubblica fra i nodi nuovi', () => {
    for (const n of ['portal_submissions', 'portal_counters']) {
      const branch = JSON.stringify(v2[n]);
      assert(branch.indexOf('".read":true') < 0, 'lettura pubblica in ' + n);
    }
  });

  describe('Regole — invii dal portale');

  const sub = () => v2.portal_submissions.$ref;

  it('la chiave deve avere il formato del riferimento', () => {
    const rule = sub().ref['.validate'];
    assert(rule.indexOf('RS-') >= 0, 'il campo ref deve essere vincolato al formato');
  });

  it('lo stato ammette solo i valori previsti', () => {
    const rule = sub().stato['.validate'];
    for (const s of ['NUOVO', 'IN_ESAME', 'ACCETTATO', 'RIFIUTATO', 'CHIUSO']) {
      assert(rule.indexOf(s) >= 0, 'stato mancante nella regola: ' + s);
    }
  });

  it('non si possono aggiungere campi inventati', () => {
    eq(sub().$other['.validate'], false,
      'campi arbitrari permetterebbero di scrivere dati non validati');
    eq(sub().mittente.$other['.validate'], false);
    eq(sub().articoli.$i.$other['.validate'], false);
    eq(sub().messaggi.$mid.$other['.validate'], false);
  });

  it('le foto possono essere solo immagini in dataURL', () => {
    const rule = sub().foto.$i['.validate'];
    // Dentro la regex la barra e' sfuggita: cerco "data:image" e il gruppo
    // dei formati, non la stringa letterale col separatore.
    assert(/data:image/.test(rule), 'deve accettare solo dataURL immagine');
    assert(/jpeg\|png\|webp/.test(rule), 'deve elencare i formati ammessi');
    assert(rule.indexOf('svg') < 0, 'gli SVG non devono essere ammessi: possono contenere script');
    assert(/length\s*<\s*\d+/.test(rule), 'manca il limite di peso');
  });

  it('il mittente di un messaggio ammette due soli valori', () => {
    const rule = sub().messaggi.$mid.da['.validate'];
    assert(rule.indexOf('TELOS') >= 0 && rule.indexOf('MITTENTE') >= 0);
  });

  it('i campi testuali hanno tutti un limite di lunghezza', () => {
    const campi = [sub().causale, sub().note, sub().esito, sub().codiceCliente,
      sub().mittente.nome, sub().mittente.azienda, sub().messaggi.$mid.testo];
    for (const c of campi) {
      assert(/length\s*<\s*\d+/.test(c['.validate']), 'manca un limite: ' + c['.validate']);
    }
  });

  it('la quantita\' e\' un numero entro limiti sensati', () => {
    const rule = sub().articoli.$i.qty['.validate'];
    assert(rule.indexOf('isNumber') >= 0);
    assert(rule.indexOf('> 0') >= 0, 'la quantita\' non puo\' essere zero o negativa');
  });

  describe('Regole — contatori del badge');

  it('sono leggibili anche dall\'auth anonima del gestionale', () => {
    // Il gestionale usa signInAnonymously: se servisse un ruolo, il badge
    // non funzionerebbe mai.
    eq(v2.portal_counters['.read'], 'auth != null');
  });

  it('contengono solo numeri, nessun dato di una pratica', () => {
    const staff = v2.portal_counters.staff;
    for (const campo of ['nuovi', 'inEsame', 'daLeggere', 'total']) {
      const rule = staff[campo]['.validate'];
      assert(rule.indexOf('isNumber') >= 0, campo + ' deve essere numerico');
      assert(rule.indexOf('>= 0') >= 0, campo + ' non puo\' essere negativo');
    }
    eq(staff.$other['.validate'], false,
      'il nodo e\' leggibile da chiunque sia autenticato: deve restare di soli numeri');
  });

  describe('Pulizia — niente resti dell\'impianto precedente');

  it('le funzioni con utenti e ruoli sono state rimosse', () => {
    for (const dir of ['netlify/functions', 'portal/netlify/functions']) {
      for (const f of ['portal-claims.js', 'portal-sync.js', 'portal-notify.js']) {
        assert(!existsSync(join(root, dir, f)), 'funzione obsoleta ancora presente: ' + dir + '/' + f);
      }
    }
  });

  it('le due funzioni nuove stanno nel sito del portale', () => {
    for (const f of ['portal-submit.js', 'portal-status.js']) {
      assert(existsSync(join(root, 'portal/netlify/functions', f)), 'funzione mancante: ' + f);
    }
  });

  it('l\'app pubblica non contiene l\'SDK Firebase', () => {
    // E' il cuore del modello di sicurezza: se l'app caricasse Firebase,
    // chiunque abbia il link avrebbe le stesse credenziali del gestionale.
    const html = readFileSync(join(root, 'portal/index.html'), 'utf8');
    assert(html.indexOf('firebasejs') < 0, 'l\'app pubblica carica l\'SDK Firebase');
    assert(html.indexOf('firebase-app') < 0);
  });

  it('nessun modulo dell\'app pubblica nomina Firebase', () => {
    const files = ['app.js', 'api.js', 'form.js', 'stato.js', 'photos.js', 'dom.js', 'costanti.js'];
    for (const f of files) {
      const src = readFileSync(join(root, 'portal/js', f), 'utf8');
      assert(!/firebase/i.test(src.replace(/^\s*\/\/.*$/gm, '')),
        f + ' fa riferimento a Firebase fuori dai commenti');
    }
  });

  it('l\'app pubblica parla solo con i due endpoint previsti', () => {
    const api = readFileSync(join(root, 'portal/js/api.js'), 'utf8');
    const urls = (api.match(/'\/api\/[^']+'/g) || []).map((s) => s.replace(/'/g, ''));
    eq(urls.sort().join(','), '/api/portal-status,/api/portal-submit',
      'endpoint inattesi: ' + urls.join(', '));
  });

  describe('Due siti — il gestionale e l\'invio resi non devono toccarsi');

  it('ogni sito instrada solo le function che possiede', () => {
    // Una rotta verso una function che il sito non ha produce un 404 al
    // primo invio, in silenzio: la pagina sembra funzionare e il reso non
    // arriva da nessuna parte.
    const gest = readFileSync(join(root, 'netlify.toml'), 'utf8');
    const port = readFileSync(join(root, 'portal/netlify.toml'), 'utf8');

    assert(gest.indexOf('/api/gemini') >= 0, 'il gestionale ha perso la rotta /api/gemini');
    for (const rotta of ['/api/portal-submit', '/api/portal-status']) {
      assert(gest.indexOf('to = "/.netlify/functions/' + rotta.replace('/api/', '')) < 0,
        'il gestionale instrada ancora ' + rotta + ', ma la function non e\' piu\' qui');
      assert(port.indexOf(rotta) >= 0, 'manca ' + rotta + ' nel sito del portale');
    }
    for (const morta of ['portal-claims', 'portal-sync', 'portal-notify']) {
      assert(gest.indexOf(morta) < 0 && port.indexOf(morta) < 0, 'rotta obsoleta: ' + morta);
    }
  });

  it('il sito del portale e\' autonomo', () => {
    // Base directory "portal": Netlify ci cerca dentro netlify.toml,
    // package.json e le function. Se manca uno dei tre, il deploy parte lo
    // stesso ma le function non vengono costruite.
    for (const f of ['portal/netlify.toml', 'portal/package.json', 'portal/index.html']) {
      assert(existsSync(join(root, f)), 'manca ' + f + ': il secondo sito non si costruisce');
    }
    const pkg = JSON.parse(readFileSync(join(root, 'portal/package.json'), 'utf8'));
    assert(pkg.dependencies && pkg.dependencies['firebase-admin'],
      'senza firebase-admin nel package.json del portale le function non possono scrivere sul database');
    const toml = readFileSync(join(root, 'portal/netlify.toml'), 'utf8');
    assert(/functions\s*=\s*"netlify\/functions"/.test(toml),
      'il percorso delle function e\' relativo alla base directory "portal"');
  });

  it('il gestionale non serve piu\' una copia dell\'app pubblica', () => {
    // Restava servita da /portal/ ma senza le sue function: ogni invio
    // sarebbe fallito. Peggio di una pagina assente, perche' sembra viva.
    const gest = readFileSync(join(root, 'netlify.toml'), 'utf8');
    assert(gest.indexOf('from = "/portal/*"') >= 0,
      'manca il rinvio da /portal/*: chi usa un vecchio link trova una copia rotta');
    assert(existsSync(join(root, 'portale-spostato.html')), 'manca la pagina di rinvio');
  });

  it('il gestionale sa che il portale ha un indirizzo suo', () => {
    // Prima il link si ricavava da location.origin + '/portal/': con due
    // siti distinti quell'indirizzo non esiste piu', e "Copia link" avrebbe
    // consegnato ai clienti un indirizzo morto.
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    assert(html.indexOf('function portaleUrlPubblico(') > 0, 'manca la lettura dell\'indirizzo configurato');
    assert(html.indexOf('function portaleImpostaLink(') > 0, 'manca il modo di impostarlo');
    const fn = html.slice(html.indexOf('function portaleCopiaLink('), html.indexOf('function portaleCopiaLink(') + 700);
    assert(fn.indexOf("location.origin") < 0,
      'portaleCopiaLink ricava ancora il link dall\'indirizzo del gestionale');
    assert(fn.indexOf('portaleUrlPubblico()') > 0, 'deve usare l\'indirizzo configurato');
  });

  it('l\'app pubblica non puo\' parlare con nessuno tranne le sue function', () => {
    // La CSP del portale e' piu' stretta di quella del gestionale: se un
    // giorno qualcuno ci aggiungesse una chiamata a Firebase, il browser la
    // bloccherebbe prima che diventi una falla.
    const toml = readFileSync(join(root, 'portal/netlify.toml'), 'utf8');
    // Solo la direttiva vera: cercare "connect-src" in tutto il file
    // pescherebbe anche il commento che la spiega.
    const riga = toml.split('\n').find((l) => /^\s*Content-Security-Policy\s*=/.test(l));
    assert(riga, 'manca la Content-Security-Policy nel sito del portale');
    const m = /connect-src ([^;]+)[;"]/.exec(riga);
    assert(m, 'manca connect-src nella CSP del portale');
    eq(m[1].trim(), "'self'",
      'il portale deve poter contattare solo il proprio sito, non il database');
  });
}
