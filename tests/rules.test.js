// Test sulle Security Rules.
//
// Non eseguono le regole (servirebbe l'emulatore Firebase): verificano
// proprieta' strutturali che, se violate, aprono un buco o rompono il
// gestionale. In particolare:
//   1. ogni nodo che il gestionale tocca deve avere una regola, o le sue
//      scritture cadono sul ".write": false della radice
//   2. niente puo' essere letto senza autenticazione
//   3. nessuna regola puo' rifiutare una scrittura per motivi suoi
//
// Il punto 3 e' nuovo. Le regole precedenti validavano campo per campo, e
// una validazione fallita non e' un avviso: e' un rifiuto silenzioso. Con
// una scrittura multipla — la prima sincronizzazione lo e' — bastava una
// riga fuori norma per far rifiutare l'intero blocco.
//
// La validazione dei dati che arrivano da fuori resta, ma nel posto giusto:
// portal-submit.js la fa campo per campo, sul server, prima di scrivere.
// Lì un dato sbagliato produce un errore che si legge; qui produceva
// silenzio.

import { describe, it, assert, eq } from './run.js';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export async function runRulesTests() {
  const regole = JSON.parse(readFileSync(join(root, 'firebase-rules.json'), 'utf8'));
  const r = regole.rules;

  describe('Regole — un solo file, incollabile cosi\' com\'e\'');

  it('esiste un unico file di regole', () => {
    // Prima ce n'erano due (firebase-rules.json e -v2.json) e non era
    // ovvio quale fosse quello da incollare. Un file solo, nessun dubbio.
    assert(!existsSync(join(root, 'firebase-rules-v2.json')),
      'firebase-rules-v2.json e\' tornato: due file di regole si finisce per incollare quello sbagliato');
  });

  it('contiene SOLO la chiave "rules"', () => {
    // La Console Firebase rifiuta qualsiasi altra chiave di primo livello.
    // Un file con dentro una sezione di commenti sembra valido — e\' JSON
    // corretto — ma non si riesce a incollare: la Console risponde con un
    // errore di parsing e le regole vecchie restano attive.
    const chiavi = Object.keys(regole);
    eq(chiavi.join(','), 'rules', 'chiavi extra: ' + chiavi.join(', '));
  });

  it('sta in poche righe', () => {
    // Non e\' vezzo: le regole precedenti erano 300 righe di validazione
    // per campo, e nessuno poteva piu\' dire a colpo d\'occhio cosa
    // permettessero. Se tornano a crescere, e\' il momento di chiedersi
    // perche\'.
    const righe = readFileSync(join(root, 'firebase-rules.json'), 'utf8').split('\n').length;
    assert(righe < 60, 'le regole sono tornate a ' + righe + ' righe');
  });

  describe('Regole — niente piu\' rifiuti silenziosi');

  it('nessun .validate da nessuna parte', () => {
    // E\' il motivo della semplificazione. Le regole precedenti avevano
    // forme come:
    //     "!newData.exists() || newData.child('dataUrl').val().length < 4000000"
    // Se il record non ha dataUrl, .val() e\' null, .length su null non
    // esiste, la regola vale FALSO e la scrittura viene rifiutata. Stessa
    // trappola in codeMem (pretendeva sempre 'pre') e in returns
    // (pretendeva sempre 'cod').
    //
    // Il caso peggiore era la prima sincronizzazione: FB_REF.update(local)
    // e\' una scrittura multipla e ATOMICA, quindi una sola riga senza
    // 'cod' faceva rifiutare l'intero blocco. Non quella riga: tutte.
    const trovati = [];
    (function cerca(nodo, path) {
      if (!nodo || typeof nodo !== 'object') return;
      for (const k of Object.keys(nodo)) {
        if (k === '.validate') trovati.push(path || '(radice)');
        else cerca(nodo[k], path ? path + '/' + k : k);
      }
    })(r, '');
    eq(trovati.length, 0,
      'una regola di validazione fallita rifiuta la scrittura senza dire perche\':\n      ' + trovati.join('\n      '));
  });

  it('nessuna condizione oltre "auth != null"', () => {
    // Regole come "auth != null && !data.exists()" (append-only) o
    // "data.child('who').val() == newData.child('who').val()" producono lo
    // stesso guasto: una scrittura legittima rifiutata, in silenzio.
    const strane = [];
    (function cerca(nodo, path) {
      if (!nodo || typeof nodo !== 'object') return;
      for (const k of Object.keys(nodo)) {
        if (k === '.read' || k === '.write') {
          const v = nodo[k];
          if (v !== false && v !== 'auth != null') strane.push((path || '(radice)') + ' ' + k + ': ' + JSON.stringify(v));
        } else cerca(nodo[k], path ? path + '/' + k : k);
      }
    })(r, '');
    eq(strane.length, 0, 'condizioni non uniformi:\n      ' + strane.join('\n      '));
  });

  describe('Regole — quello che deve restare vero');

  it('la radice resta chiusa', () => {
    // Senza questo, chi conosce l'URL del database si scarica tutto.
    eq(r['.read'], false);
    eq(r['.write'], false);
  });

  it('nessun nodo e\' leggibile senza accesso', () => {
    // _killswitch prima aveva ".read": true. Veniva letto solo dopo il
    // login in entrambi i trasporti, quindi chiuderlo non toglie niente.
    const aperti = [];
    for (const k of Object.keys(r)) {
      if (k.startsWith('.')) continue;
      if (r[k]['.read'] !== 'auth != null') aperti.push(k + ': ' + JSON.stringify(r[k]['.read']));
    }
    eq(aperti.length, 0, 'nodi leggibili senza autenticazione:\n      ' + aperti.join('\n      '));
  });

  it('ogni nodo toccato da index.html ha una regola', () => {
    // Nasce da un bug reale: _diag (il nodo su cui il pulsante "Test
    // connessione" prova a scrivere) non aveva regole, quindi cadeva sul
    // ".write": false della radice. Il test riportava "Scrittura rifiutata"
    // anche quando i resi si salvavano benissimo — e faceva pensare che la
    // sincronizzazione fosse rotta. Stessa storia per _backups_meta, che
    // coordina il backup giornaliero fra i PC.
    const html = readFileSync(join(root, 'index.html'), 'utf8');

    // Cerco solo i nodi di PRIMO livello: .ref('X'), root.child('X') e
    // fbRestRef('X'), che e\' la versione https dello stesso riferimento.
    const radice = new Set();
    const re = /(?:\.ref\(|\broot\.child\(|\bfbRestRef\()'([A-Za-z_][A-Za-z0-9_]*)/g;
    let m;
    while ((m = re.exec(html))) radice.add(m[1]);
    radice.delete('info');   // '.info/connected' e\' un nodo di servizio dell'SDK

    const scoperti = Array.from(radice).filter((n) => r[n] === undefined).sort();
    eq(scoperti.length, 0,
      'nodi usati dal gestionale ma senza regole (verrebbero negati):\n      ' + scoperti.join('\n      '));
  });

  it('i nodi del gestionale ci sono tutti', () => {
    const attesi = ['returns', 'chat', 'presence', 'admin', 'security_log',
      'notifEvents', 'notif', 'ocrLive', 'mailFollowups',
      'pkgphotos', '_backups', 'codeMem', '_killswitch'];
    for (const n of attesi) assert(r[n] !== undefined, 'nodo mancante: ' + n);
  });

  it('i due nodi del portale ci sono, e non sono pubblici', () => {
    // L'app pubblica non tocca mai il database: scrive solo tramite la
    // function, che usa le credenziali del server. Nessuno di questi due
    // nodi deve essere raggiungibile da un browser senza accesso.
    for (const n of ['portal_submissions', 'portal_counters']) {
      assert(r[n], 'nodo mancante: ' + n);
      eq(r[n]['.read'], 'auth != null');
    }
  });

  it('non sono rimasti nodi dell\'impianto con i ruoli', () => {
    const morti = ['portal_users', 'portal_view', 'portal_access', 'portal_timeline',
      'portal_messages', 'portal_documents', 'portal_requests', 'portal_config',
      'portal_notifications', 'portal_audit', 'portal_sync_meta'];
    for (const n of morti) eq(r[n], undefined, 'nodo obsoleto ancora presente: ' + n);
  });

  it('non ci sono nodi che nessuno usa', () => {
    // Ogni nodo in piu\' e\' superficie scrivibile senza nessuno che la
    // guardi.
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    const inutili = Object.keys(r)
      .filter((k) => !k.startsWith('.'))
      .filter((k) => k !== 'portal_submissions' && k !== 'portal_counters')
      .filter((k) => html.indexOf("'" + k) < 0);
    eq(inutili.length, 0, 'nodi con regole ma mai usati: ' + inutili.join(', '));
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
