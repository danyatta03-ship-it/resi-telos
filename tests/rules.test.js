// Test sulle Security Rules.
//
// Non eseguono le regole (servirebbe l'emulatore Firebase): verificano
// proprieta' strutturali che, se violate, aprono un buco. In particolare:
//   1. le regole del gestionale devono restare IDENTICHE alla v1
//   2. nessun nodo del portale deve essere leggibile senza autenticazione
//   3. i nodi append-only devono davvero impedire la sovrascrittura
//   4. i nodi riservati all'admin devono controllare il claim

import { describe, it, assert, eq } from './run.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export async function runRulesTests() {
  const v1 = JSON.parse(readFileSync(join(root, 'firebase-rules.json'), 'utf8')).rules;
  const v2raw = JSON.parse(readFileSync(join(root, 'firebase-rules-v2.json'), 'utf8'));
  const v2 = v2raw.rules;

  describe('Regole — retrocompatibilita\' col gestionale');

  const LEGACY_NODES = [
    'returns', 'chat', 'presence', 'admin', 'security_log',
    'notifEvents', 'notif', 'ocrLive', 'mailFollowups',
    'pkgphotos', '_backups', 'codeMem', '_killswitch'
  ];

  it('tutti i nodi del gestionale sono ancora presenti', () => {
    for (const node of LEGACY_NODES) {
      assert(v2[node] !== undefined, 'nodo mancante nella v2: ' + node);
    }
  });

  it('le regole dei nodi del gestionale sono invariate', () => {
    for (const node of LEGACY_NODES) {
      eq(JSON.stringify(v2[node]), JSON.stringify(v1[node]),
        'le regole di "' + node + '" sono cambiate: il gestionale potrebbe rompersi');
    }
  });

  it('la radice resta chiusa', () => {
    eq(v2['.read'], false);
    eq(v2['.write'], false);
  });

  it('returns/ resta scrivibile dall\'auth anonima del gestionale', () => {
    // Se questa cambiasse, il gestionale (che usa signInAnonymously) smetterebbe
    // di poter salvare.
    eq(v2.returns['.read'], 'auth != null');
    eq(v2.returns.$key['.write'], 'auth != null');
  });

  describe('Regole — nodi del portale');

  const PORTAL_NODES = [
    'portal_users', 'portal_view', 'portal_access', 'portal_timeline',
    'portal_messages', 'portal_documents', 'portal_requests',
    'portal_config', 'portal_notifications', 'portal_audit', 'portal_sync_meta'
  ];

  it('tutti i nodi del portale sono definiti', () => {
    for (const node of PORTAL_NODES) {
      assert(v2[node] !== undefined, 'nodo del portale mancante: ' + node);
    }
  });

  it('nessun nodo del portale e\' leggibile senza autenticazione', () => {
    const json = JSON.stringify(v2);
    // Cerco letterali ".read": true dentro i rami portal_*
    for (const node of PORTAL_NODES) {
      const branch = JSON.stringify(v2[node]);
      assert(branch.indexOf('".read":true') < 0 && branch.indexOf('".read": true') < 0,
        'lettura pubblica in ' + node);
    }
  });

  it('ogni regola di lettura del portale verifica auth', () => {
    const problems = [];
    walk(v2, (path, key, value) => {
      if (key !== '.read' && key !== '.write') return;
      if (!path.startsWith('portal_')) return;
      if (typeof value !== 'string') {
        if (value !== false) problems.push(path + '/' + key + ' = ' + JSON.stringify(value));
        return;
      }
      if (value.indexOf('auth') < 0) problems.push(path + '/' + key + ' = ' + value);
    });
    eq(problems.length, 0, 'regole senza controllo auth:\n      ' + problems.join('\n      '));
  });

  describe('Regole — append-only');

  it('la timeline non e\' sovrascrivibile', () => {
    const rule = v2.portal_timeline.$returnKey.$eventId['.write'];
    assert(rule.indexOf('!data.exists()') >= 0,
      'la timeline deve essere append-only: manca !data.exists()');
  });

  it('i messaggi non sono sovrascrivibili', () => {
    const rule = v2.portal_messages.$returnKey.$msgId['.write'];
    assert(rule.indexOf('!data.exists()') >= 0,
      'i messaggi devono essere append-only');
  });

  it('l\'audit non e\' sovrascrivibile', () => {
    assert(v2.portal_audit.$k['.write'].indexOf('!data.exists()') >= 0);
  });

  it('la timeline impedisce di falsificare l\'attore', () => {
    const actor = v2.portal_timeline.$returnKey.$eventId.actor['.validate'];
    assert(actor.indexOf('auth.uid') >= 0,
      'actor deve coincidere con auth.uid, altrimenti si possono firmare eventi a nome altrui');
  });

  it('la timeline impedisce di falsificare il ruolo', () => {
    const role = v2.portal_timeline.$returnKey.$eventId.actorRole['.validate'];
    assert(role.indexOf('auth.token.prole') >= 0,
      'actorRole deve coincidere col claim');
  });

  it('i messaggi impediscono di falsificare il mittente', () => {
    const from = v2.portal_messages.$returnKey.$msgId.from['.validate'];
    assert(from.indexOf('auth.uid') >= 0);
    const role = v2.portal_messages.$returnKey.$msgId.fromRole['.validate'];
    assert(role.indexOf('auth.token.prole') >= 0);
  });

  it('la timeline rifiuta campi non previsti', () => {
    eq(v2.portal_timeline.$returnKey.$eventId.$other['.validate'], false,
      'campi arbitrari nella timeline permetterebbero di iniettare dati non validati');
  });

  it('i messaggi rifiutano campi non previsti', () => {
    eq(v2.portal_messages.$returnKey.$msgId.$other['.validate'], false);
  });

  describe('Regole — isolamento fra utenti');

  it('la proiezione cliente e\' vincolata allo scope dell\'utente', () => {
    const rule = v2.portal_view.client.$scopeId['.read'];
    assert(rule.indexOf('portal_users') >= 0 && rule.indexOf('scope') >= 0 && rule.indexOf('$scopeId') >= 0,
      'la lettura deve verificare che lo scope appartenga all\'utente');
    assert(rule.indexOf("auth.token.prole == 'CLIENTE'") >= 0,
      'la regola deve vincolare anche il ruolo');
  });

  it('agente e corriere hanno lo stesso vincolo', () => {
    for (const [branch, role] of [['agent', 'AGENTE'], ['courier', 'CORRIERE']]) {
      const rule = v2.portal_view[branch].$scopeId['.read'];
      assert(rule.indexOf('portal_users') >= 0 && rule.indexOf('$scopeId') >= 0,
        branch + ': manca il vincolo di scope');
      assert(rule.indexOf("auth.token.prole == '" + role + "'") >= 0,
        branch + ': manca il vincolo di ruolo');
    }
  });

  it('un esterno non puo\' scrivere nelle proiezioni', () => {
    for (const branch of ['client', 'agent', 'courier']) {
      const rule = v2.portal_view[branch].$scopeId['.write'];
      assert(rule.indexOf('ADMIN') >= 0 && rule.indexOf('TELOS') >= 0,
        branch + ': la scrittura deve essere riservata allo staff');
      assert(rule.indexOf('CLIENTE') < 0 && rule.indexOf('CORRIERE') < 0,
        branch + ': un ruolo esterno puo\' scrivere');
    }
  });

  it('timeline, messaggi e documenti sono vincolati a portal_access', () => {
    for (const node of ['portal_timeline', 'portal_messages', 'portal_documents']) {
      const rule = v2[node].$returnKey['.read'];
      assert(rule.indexOf('portal_access') >= 0,
        node + ': la lettura deve passare da portal_access');
      assert(rule.indexOf('auth.uid') >= 0,
        node + ': il controllo deve essere legato all\'utente corrente');
    }
  });

  it('portal_access e\' scrivibile solo dallo staff', () => {
    const rule = v2.portal_access.$uid['.write'];
    assert(rule.indexOf('ADMIN') >= 0 && rule.indexOf('TELOS') >= 0);
    // Se un cliente potesse scriverlo, si autorizzerebbe da solo su qualunque reso.
    assert(rule.indexOf('auth.uid == $uid') < 0,
      'l\'utente non deve poter modificare il proprio elenco di accessi');
  });

  it('le notifiche sono private per utente', () => {
    const rule = v2.portal_notifications.$uid['.read'];
    assert(rule.indexOf('auth.uid == $uid') >= 0,
      'ogni utente deve leggere solo le proprie notifiche');
  });

  describe('Regole — privilegi amministrativi');

  it('solo ADMIN scrive gli utenti del portale', () => {
    const rule = v2.portal_users.$uid['.write'];
    assert(rule.indexOf("auth.token.prole == 'ADMIN'") >= 0);
    assert(rule.indexOf('TELOS') < 0, 'TELOS non deve poter creare utenti');
  });

  it('un utente puo\' scrivere solo i propri token e preferenze', () => {
    eq(v2.portal_users.$uid.prefs['.write'], "auth != null && auth.uid == $uid");
    eq(v2.portal_users.$uid.fcmTokens['.write'], "auth != null && auth.uid == $uid");
  });

  it('il ruolo nel profilo e\' vincolato ai valori ammessi', () => {
    const rule = v2.portal_users.$uid.role['.validate'];
    assert(rule.indexOf('ADMIN|TELOS|CLIENTE|AGENTE|CORRIERE') >= 0,
      'il campo role deve accettare solo i ruoli previsti');
  });

  it('solo ADMIN configura SLA e brand', () => {
    assert(v2.portal_config.sla['.write'].indexOf("prole == 'ADMIN'") >= 0);
    assert(v2.portal_config.brand['.write'].indexOf("prole == 'ADMIN'") >= 0);
    assert(v2.portal_config.flags['.write'].indexOf("prole == 'ADMIN'") >= 0);
  });

  it('l\'audit e\' leggibile solo da ADMIN', () => {
    assert(v2.portal_audit['.read'].indexOf("prole == 'ADMIN'") >= 0);
  });

  describe('Regole — contatori per il badge del gestionale');

  it('portal_counters e\' leggibile anche dall\'auth anonima del gestionale', () => {
    // Il gestionale usa signInAnonymously e non ha il claim 'prole': se la
    // lettura richiedesse un ruolo, il badge non funzionerebbe mai.
    eq(v2.portal_counters['.read'], 'auth != null');
  });

  it('solo lo staff puo\' scrivere i contatori', () => {
    const rule = v2.portal_counters['.write'];
    assert(rule.indexOf('ADMIN') >= 0 && rule.indexOf('TELOS') >= 0);
    assert(rule.indexOf('CLIENTE') < 0, 'un cliente potrebbe gonfiare il badge');
  });

  it('i contatori accettano solo numeri, non testo libero', () => {
    const staff = v2.portal_counters.staff;
    for (const field of ['pending', 'contested', 'messages', 'total']) {
      const rule = staff[field]['.validate'];
      assert(rule.indexOf('isNumber') >= 0, field + ' deve essere numerico');
      assert(rule.indexOf('>= 0') >= 0, field + ' non puo\' essere negativo');
    }
    eq(staff.$other['.validate'], false,
      'nessun campo extra: il nodo e\' leggibile da tutti, deve restare di soli numeri');
  });

  describe('Regole — limiti di dimensione');

  it('i campi testuali del portale hanno un limite', () => {
    const checks = [
      v2.portal_messages.$returnKey.$msgId.text['.validate'],
      v2.portal_timeline.$returnKey.$eventId.note['.validate'],
      v2.portal_notifications.$uid.$nid.title['.validate']
    ];
    for (const rule of checks) {
      assert(/length\s*<\s*\d+/.test(rule), 'manca un limite di lunghezza: ' + rule);
    }
  });

  it('la dimensione dei documenti e\' limitata', () => {
    const rule = v2.portal_documents.$returnKey.$docId.size['.validate'];
    assert(/<=\s*\d+/.test(rule), 'il campo size deve avere un tetto');
  });

  it('i timestamp non possono essere nel futuro', () => {
    const rule = v2.portal_timeline.$returnKey.$eventId.ts['.validate'];
    assert(rule.indexOf('now') >= 0,
      'ts deve essere confrontato con now, altrimenti si datano eventi nel futuro');
  });

  describe('Regole — file Storage');

  it('storage.rules esiste ed e\' chiuso di default', () => {
    const storage = readFileSync(join(root, 'storage.rules'), 'utf8');
    assert(storage.indexOf('allow read, write: if false') >= 0,
      'manca la regola catch-all che nega tutto il resto');
    assert(storage.indexOf('rules_version') >= 0);
  });

  it('storage impedisce la sovrascrittura dei file', () => {
    const storage = readFileSync(join(root, 'storage.rules'), 'utf8');
    assert(storage.indexOf('allow update: if false') >= 0,
      'i file devono essere immutabili una volta caricati');
  });
}

// Percorre l'albero delle regole invocando fn(path, key, value) su ogni
// chiave che inizia con un punto (.read, .write, .validate).
function walk(node, fn, path = '') {
  if (!node || typeof node !== 'object') return;
  for (const key in node) {
    const value = node[key];
    if (key.startsWith('.')) {
      fn(path, key, value);
    } else {
      walk(value, fn, path ? path + '/' + key : key);
    }
  }
}
