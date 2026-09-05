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

  describe('Regole — nodi nuovi');

  it('esistono solo i due nodi previsti', () => {
    const nuovi = Object.keys(v2).filter((k) => !k.startsWith('.') && LEGACY.indexOf(k) < 0);
    eq(nuovi.sort().join(','), 'portal_counters,portal_submissions',
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
    for (const f of ['portal-claims.js', 'portal-sync.js', 'portal-notify.js']) {
      assert(!existsSync(join(root, 'netlify/functions', f)),
        'funzione obsoleta ancora presente: ' + f);
    }
  });

  it('le due funzioni nuove esistono', () => {
    for (const f of ['portal-submit.js', 'portal-status.js']) {
      assert(existsSync(join(root, 'netlify/functions', f)), 'funzione mancante: ' + f);
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

  it('netlify.toml instrada solo gli endpoint esistenti', () => {
    const toml = readFileSync(join(root, 'netlify.toml'), 'utf8');
    assert(toml.indexOf('/api/portal-submit') >= 0);
    assert(toml.indexOf('/api/portal-status') >= 0);
    assert(toml.indexOf('portal-claims') < 0, 'rotta obsoleta in netlify.toml');
    assert(toml.indexOf('portal-sync') < 0, 'rotta obsoleta in netlify.toml');
    assert(toml.indexOf('portal-notify') < 0, 'rotta obsoleta in netlify.toml');
  });
}
