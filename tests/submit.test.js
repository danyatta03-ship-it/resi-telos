// Test della validazione lato server.
//
// E' il punto piu' delicato del sistema: l'app pubblica sta su un link che
// gira liberamente, quindi qui arriva tutto quello che a qualcuno viene in
// mente di mandare. Questi test verificano che il server non si fidi mai del
// client — nemmeno del proprio client.

import { describe, it, assert, eq } from './run.js';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { valida, generaRiferimento, CAUSALI, TIPI } = require(join(root, 'netlify/functions/portal-submit.js')).__test__;
const { pubblico, REF_RE } = require(join(root, 'netlify/functions/portal-status.js')).__test__;

function base(extra) {
  return Object.assign({
    mittente: { nome: 'Mario Rossi', azienda: 'Autofficina Rossi', tipo: 'CLIENTE' },
    causale: 'GARANZIA',
    articoli: [{ cod: '0986444981', marca: 'BOS', qty: 1, forn: 'BOSCH' }]
  }, extra || {});
}

export async function runSubmitTests() {
  describe('Invio — casi validi');

  it('accetta un invio completo', () => {
    const r = valida(base());
    assert(r.ok, 'doveva passare: ' + (r.errori || []).join(' '));
    eq(r.dati.mittente.nome, 'Mario Rossi');
    eq(r.dati.articoli.length, 1);
    eq(r.dati.articoli[0].cod, '0986444981');
  });

  it('normalizza codici e marche in maiuscolo', () => {
    const r = valida(base({ articoli: [{ cod: 'abc123', marca: 'bos', qty: 2 }] }));
    assert(r.ok);
    eq(r.dati.articoli[0].cod, 'ABC123');
    eq(r.dati.articoli[0].marca, 'BOS');
  });

  it('collassa gli spazi e taglia i bordi', () => {
    const r = valida(base({ mittente: { nome: '  Mario   Rossi  ', azienda: 'X srl', tipo: 'CLIENTE' } }));
    assert(r.ok);
    eq(r.dati.mittente.nome, 'Mario Rossi');
  });

  it('omette i campi facoltativi vuoti invece di salvarli vuoti', () => {
    const r = valida(base());
    eq(r.dati.note, undefined);
    eq(r.dati.codiceCliente, undefined);
    eq(r.dati.mittente.telefono, undefined);
  });

  describe('Invio — dati mancanti');

  it('rifiuta senza nome', () => {
    const r = valida(base({ mittente: { azienda: 'X srl', tipo: 'CLIENTE' } }));
    eq(r.ok, false);
    assert(r.errori.some((e) => /nome/i.test(e)));
  });

  it('rifiuta senza azienda', () => {
    const r = valida(base({ mittente: { nome: 'Mario Rossi', tipo: 'CLIENTE' } }));
    eq(r.ok, false);
    assert(r.errori.some((e) => /azienda/i.test(e)));
  });

  it('rifiuta un nome di una lettera', () => {
    eq(valida(base({ mittente: { nome: 'M', azienda: 'X srl' } })).ok, false);
  });

  it('rifiuta senza articoli', () => {
    const r = valida(base({ articoli: [] }));
    eq(r.ok, false);
    assert(r.errori.some((e) => /articolo/i.test(e)));
  });

  it('rifiuta articoli senza codice', () => {
    eq(valida(base({ articoli: [{ marca: 'BOS', qty: 1 }] })).ok, false);
  });

  it('rifiuta una causale inventata', () => {
    const r = valida(base({ causale: 'PERCHE MI VA' }));
    eq(r.ok, false);
    assert(r.errori.some((e) => /motivo/i.test(e)));
  });

  it('accetta tutte le causali dell\'elenco', () => {
    for (const c of CAUSALI) {
      assert(valida(base({ causale: c })).ok, 'causale rifiutata: ' + c);
    }
  });

  describe('Invio — dati ostili');

  it('tronca i campi lunghissimi invece di rifiutarli', () => {
    const r = valida(base({
      mittente: { nome: 'A'.repeat(5000), azienda: 'B'.repeat(5000), tipo: 'CLIENTE' },
      note: 'C'.repeat(50000)
    }));
    assert(r.ok);
    assert(r.dati.mittente.nome.length <= 120, 'nome non troncato: ' + r.dati.mittente.nome.length);
    assert(r.dati.mittente.azienda.length <= 200);
    assert(r.dati.note.length <= 2000);
  });

  it('limita il numero di articoli', () => {
    const molti = [];
    for (let i = 0; i < 500; i++) molti.push({ cod: 'C' + i, qty: 1 });
    const r = valida(base({ articoli: molti }));
    assert(r.ok);
    assert(r.dati.articoli.length <= 40, 'articoli non limitati: ' + r.dati.articoli.length);
  });

  it('normalizza quantita\' assurde', () => {
    eq(valida(base({ articoli: [{ cod: 'X', qty: -5 }] })).dati.articoli[0].qty, 1);
    eq(valida(base({ articoli: [{ cod: 'X', qty: 0 }] })).dati.articoli[0].qty, 1);
    eq(valida(base({ articoli: [{ cod: 'X', qty: 999999 }] })).dati.articoli[0].qty, 9999);
    eq(valida(base({ articoli: [{ cod: 'X', qty: 'tanti' }] })).dati.articoli[0].qty, 1);
  });

  it('un tipo mittente inventato diventa ALTRO invece di passare', () => {
    const r = valida(base({ mittente: { nome: 'M R', azienda: 'X srl', tipo: 'AMMINISTRATORE' } }));
    assert(r.ok);
    eq(r.dati.mittente.tipo, 'ALTRO');
  });

  it('accetta tutti i tipi previsti', () => {
    for (const t of TIPI) {
      eq(valida(base({ mittente: { nome: 'M R', azienda: 'X srl', tipo: t } })).dati.mittente.tipo, t);
    }
  });

  it('rifiuta email malformate', () => {
    eq(valida(base({ mittente: { nome: 'M R', azienda: 'X srl', email: 'non-una-email' } })).ok, false);
    assert(valida(base({ mittente: { nome: 'M R', azienda: 'X srl', email: 'a@b.it' } })).ok);
  });

  it('non lascia passare campi extra inventati dal client', () => {
    const r = valida(base({ stato: 'ACCETTATO', letto: true, esito: 'me lo approvo da solo', admin: true }));
    assert(r.ok);
    eq(r.dati.stato, undefined, 'il client non deve poter fissare lo stato');
    eq(r.dati.esito, undefined, 'il client non deve poter scrivere l\'esito');
    eq(r.dati.admin, undefined);
  });

  it('non lascia passare campi extra dentro gli articoli', () => {
    const r = valida(base({ articoli: [{ cod: 'X', qty: 1, prezzo: 9999, interno: 'segreto' }] }));
    assert(r.ok);
    eq(r.dati.articoli[0].prezzo, undefined);
    eq(r.dati.articoli[0].interno, undefined);
  });

  describe('Invio — foto');

  it('accetta dataURL JPEG validi', () => {
    const r = valida(base({ foto: ['data:image/jpeg;base64,' + 'A'.repeat(200)] }));
    assert(r.ok, (r.errori || []).join(' '));
    eq(r.dati.foto.length, 1);
  });

  it('rifiuta SVG, che puo\' contenere script', () => {
    eq(valida(base({ foto: ['data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='] })).ok, false);
  });

  it('rifiuta URL remoti al posto delle foto', () => {
    eq(valida(base({ foto: ['https://esempio.it/immagine.jpg'] })).ok, false);
  });

  it('rifiuta dataURL non immagine', () => {
    eq(valida(base({ foto: ['data:text/html;base64,PHNjcmlwdD4='] })).ok, false);
  });

  it('rifiuta foto oltre il limite di peso', () => {
    eq(valida(base({ foto: ['data:image/jpeg;base64,' + 'A'.repeat(3 * 1024 * 1024) ] })).ok, false);
  });

  it('non salva piu\' di tre foto', () => {
    const molte = [];
    for (let i = 0; i < 10; i++) molte.push('data:image/jpeg;base64,' + 'A'.repeat(100));
    const r = valida(base({ foto: molte }));
    assert(r.ok);
    assert(r.dati.foto.length <= 3, 'foto non limitate: ' + r.dati.foto.length);
  });

  describe('Riferimenti');

  it('hanno il formato atteso', () => {
    for (let i = 0; i < 200; i++) {
      assert(REF_RE.test(generaRiferimento()), 'riferimento non valido');
    }
  });

  it('non contengono caratteri ambigui a voce', () => {
    // 0/O e 1/I/L si confondono al telefono e sulla carta.
    for (let i = 0; i < 200; i++) {
      const r = generaRiferimento();
      assert(!/[01OIL]/.test(r.slice(3)), 'carattere ambiguo in ' + r);
    }
  });

  it('non si ripetono in modo evidente', () => {
    const visti = new Set();
    for (let i = 0; i < 500; i++) visti.add(generaRiferimento());
    assert(visti.size > 480, 'troppe collisioni: ' + visti.size + '/500');
  });

  describe('Stato — cosa esce davvero dal server');

  const record = {
    ref: 'RS-ABCDEF', ts: 1700000000000, stato: 'IN_ESAME',
    causale: 'GARANZIA', note: 'nota del mittente', esito: '',
    codiceCliente: '007183',
    mittente: { nome: 'Mario Rossi', azienda: 'Rossi snc', telefono: '011123', email: 'a@b.it' },
    articoli: [{ cod: 'X1', qty: 1 }],
    foto: ['data:image/jpeg;base64,AAA', 'data:image/jpeg;base64,BBB'],
    letto: false,
    ip: '203.0.113.9',
    gestitoDa: 'SARA',
    messaggi: {
      m2: { ts: 200, da: 'TELOS', autore: 'Sara', testo: 'ciao' },
      m1: { ts: 100, da: 'MITTENTE', autore: 'Mario', testo: 'buongiorno' }
    }
  };

  it('non restituisce l\'IP di chi ha inviato', () => {
    eq(pubblico(record).ip, undefined);
  });

  it('non restituisce i flag interni', () => {
    const p = pubblico(record);
    eq(p.letto, undefined);
    eq(p.gestitoDa, undefined);
  });

  it('non rimanda indietro le foto, solo quante sono', () => {
    const p = pubblico(record);
    eq(p.foto, undefined);
    eq(p.nFoto, 2);
  });

  it('non restituisce telefono ed email del mittente', () => {
    // Chi consulta ha gia' i propri recapiti; rimandarli indietro
    // significherebbe esporli a chiunque entri in possesso del riferimento.
    const p = pubblico(record);
    eq(p.mittente.telefono, undefined);
    eq(p.mittente.email, undefined);
    eq(p.mittente.nome, 'Mario Rossi');
  });

  it('restituisce i messaggi in ordine cronologico', () => {
    const p = pubblico(record);
    eq(p.messaggi.length, 2);
    eq(p.messaggi[0].testo, 'buongiorno');
    eq(p.messaggi[1].testo, 'ciao');
  });

  it('normalizza il mittente dei messaggi ai due valori ammessi', () => {
    const p = pubblico(Object.assign({}, record, {
      messaggi: { m1: { ts: 1, da: 'ADMIN', testo: 'x' } }
    }));
    eq(p.messaggi[0].da, 'MITTENTE');
  });

  it('scarta i messaggi senza testo', () => {
    const p = pubblico(Object.assign({}, record, {
      messaggi: { m1: { ts: 1, da: 'TELOS' }, m2: { ts: 2, da: 'TELOS', testo: 'ok' } }
    }));
    eq(p.messaggi.length, 1);
  });

  it('regge un record incompleto senza esplodere', () => {
    const p = pubblico({ ref: 'RS-ABCDEF' });
    eq(p.stato, 'NUOVO');
    eq(p.articoli.length, 0);
    eq(p.messaggi.length, 0);
    eq(p.nFoto, 0);
  });

  describe('Formato del riferimento');

  it('accetta solo il formato previsto', () => {
    assert(REF_RE.test('RS-ABCDEF'));
    assert(REF_RE.test('RS-23456789'));
    assert(!REF_RE.test('RS-abc'), 'minuscole non ammesse');
    assert(!REF_RE.test('XX-ABCDEF'), 'prefisso sbagliato');
    assert(!REF_RE.test('RS-ABC'), 'troppo corto');
    assert(!REF_RE.test('RS-ABCDEF/../admin'), 'path traversal');
    assert(!REF_RE.test(''), 'vuoto');
  });
}
