// Riceve un reso dall'app pubblica e lo scrive nel database.
//
// E' l'unico punto in cui i dati di un estraneo entrano nel sistema, quindi
// qui non ci si fida di NIENTE di quello che arriva: ogni campo viene
// validato, troncato e normalizzato prima di toccare il database. Il client
// puo' mandare qualunque cosa; quello che viene salvato lo decide questa
// funzione.
//
// Perche' passa da qui invece di scrivere direttamente su Firebase: l'app
// pubblica e' su un link che gira fra clienti, agenti e corrieri. Se avesse
// credenziali Firebase, chiunque potrebbe usarle per leggere gli invii degli
// altri. Cosi' invece l'app non ha nessun accesso al database — parla solo
// con questo endpoint, che scrive per suo conto.

const { getAdmin, corsHeaders, json } = require('./_portal-admin');

const CAUSALI = [
  'ERRATO ORDINE', 'ERRATA SPEDIZIONE', 'ORDINE DISDETTO CLIENTE', 'ORDINE MULTIPLO',
  'DIVERSO DA OE / INCOMPATIBILE', 'ERRATO CONFEZIONAMENTO', 'INCOMPLETO - MANCA UN PEZZO',
  'CARCASSA', 'GARANZIA', 'DANNEGGIATO', 'PERVENUTO MONTATO / SPORCO', 'ALTRO'
];

const TIPI = ['CLIENTE', 'AGENTE', 'CORRIERE', 'FILIALE', 'ALTRO'];

const MAX_FOTO = 3;
const MAX_FOTO_BYTES = 1600 * 1024;   // per singola foto, dopo compressione client
const MAX_BODY_BYTES = 6 * 1024 * 1024;
const MAX_ARTICOLI = 40;

// Anti-abuso elementare: massimo N invii per IP in una finestra.
// Vive in memoria del container, quindi non e' una difesa forte — un attacco
// vero passerebbe da IP diversi o aspetterebbe un cold start. Serve a fermare
// il doppio-click e lo script improvvisato, non un avversario determinato.
const FINESTRA_MS = 10 * 60 * 1000;
const MAX_PER_IP = 12;
const recenti = new Map();

function troppiInvii(ip) {
  const ora = Date.now();
  const lista = (recenti.get(ip) || []).filter((t) => ora - t < FINESTRA_MS);
  if (lista.length >= MAX_PER_IP) {
    recenti.set(ip, lista);
    return true;
  }
  lista.push(ora);
  recenti.set(ip, lista);
  // Pulizia opportunistica: senza, la mappa cresce finche' il container vive.
  if (recenti.size > 500) {
    for (const [k, v] of recenti) {
      if (!v.some((t) => ora - t < FINESTRA_MS)) recenti.delete(k);
    }
  }
  return false;
}

exports.handler = async (event) => {
  const origin = (event.headers && (event.headers.origin || event.headers.Origin)) || '';
  const H = corsHeaders(origin);

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: H, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Metodo non consentito' }, H);

  const raw = event.body || '';
  if (raw.length > MAX_BODY_BYTES) {
    return json(413, { error: 'Invio troppo pesante: riduci il numero di foto.' }, H);
  }

  const ip = (event.headers && (event.headers['x-nf-client-connection-ip'] ||
    event.headers['x-forwarded-for'] || '')).split(',')[0].trim() || 'sconosciuto';
  if (troppiInvii(ip)) {
    return json(429, { error: 'Troppi invii ravvicinati. Attendi qualche minuto e riprova.' }, H);
  }

  let body;
  try {
    body = JSON.parse(raw || '{}');
  } catch (e) {
    return json(400, { error: 'Dati non validi.' }, H);
  }

  const v = valida(body);
  if (!v.ok) return json(400, { error: v.errori.join(' ') }, H);

  let fb;
  try {
    fb = getAdmin();
  } catch (e) {
    return json(503, { error: 'Servizio non configurato. Contatta l\'ufficio resi.' }, H);
  }

  const ref = generaRiferimento();
  const id = ref;
  const record = Object.assign({
    ref,
    ts: Date.now(),
    stato: 'NUOVO',
    letto: false,
    origine: 'PORTALE',
    ip: ip.slice(0, 45)
  }, v.dati);

  try {
    const db = fb.database();
    await db.ref('portal_submissions/' + id).set(record);
    await aggiornaContatori(db);
  } catch (e) {
    return json(503, { error: 'Non riesco a registrare l\'invio. Riprova fra poco.' }, H);
  }

  return json(200, {
    ok: true,
    ref,
    ts: record.ts,
    messaggio: 'Reso ricevuto. Conserva il riferimento per seguire la pratica.'
  }, H);
};

// RS + 6 caratteri senza vocali (niente parole involontarie) e senza
// caratteri ambigui a voce o su carta: 0/O, 1/I/L.
const ALFABETO = '23456789BCDFGHJKMNPQRSTVWXZ';

function generaRiferimento() {
  let s = '';
  for (let i = 0; i < 6; i++) s += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  return 'RS-' + s;
}

function testo(valore, max) {
  return String(valore == null ? '' : valore).replace(/\s+/g, ' ').trim().slice(0, max);
}

function valida(body) {
  const errori = [];
  const m = body.mittente || {};

  const nome = testo(m.nome, 120);
  const azienda = testo(m.azienda, 200);
  if (nome.length < 2) errori.push('Indica il tuo nome.');
  if (azienda.length < 2) errori.push('Indica la tua azienda.');

  const causale = testo(body.causale, 120).toUpperCase();
  if (CAUSALI.indexOf(causale) < 0) errori.push('Motivo del reso non valido.');

  const tipo = TIPI.indexOf(String(m.tipo || '').toUpperCase()) >= 0
    ? String(m.tipo).toUpperCase() : 'ALTRO';

  const email = testo(m.email, 200);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errori.push('Email non valida.');

  const articoliIn = Array.isArray(body.articoli) ? body.articoli.slice(0, MAX_ARTICOLI) : [];
  const articoli = [];
  for (const a of articoliIn) {
    const cod = testo(a && a.cod, 60).toUpperCase();
    if (!cod) continue;
    const qty = Math.min(9999, Math.max(1, parseInt(a && a.qty, 10) || 1));
    const riga = { cod, qty };
    const marca = testo(a && a.marca, 20).toUpperCase();
    const forn = testo(a && a.forn, 120);
    if (marca) riga.marca = marca;
    if (forn) riga.forn = forn;
    articoli.push(riga);
  }
  if (!articoli.length) errori.push('Serve almeno un articolo con il codice.');

  const fotoIn = Array.isArray(body.foto) ? body.foto.slice(0, MAX_FOTO) : [];
  const foto = [];
  for (const f of fotoIn) {
    const s = String(f || '');
    // Solo JPEG/PNG/WEBP in dataURL: nessun SVG (puo' contenere script) e
    // nessun URL remoto (diventerebbe una richiesta in uscita dal gestionale).
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(s)) {
      errori.push('Una delle foto non e\' in un formato valido.');
      break;
    }
    if (s.length * 0.75 > MAX_FOTO_BYTES) {
      errori.push('Una foto e\' troppo pesante.');
      break;
    }
    foto.push(s);
  }

  if (errori.length) return { ok: false, errori };

  const dati = {
    mittente: { nome, azienda, tipo },
    causale,
    articoli
  };
  const telefono = testo(m.telefono, 40);
  if (telefono) dati.mittente.telefono = telefono;
  if (email) dati.mittente.email = email;

  const codiceCliente = testo(body.codiceCliente, 40).toUpperCase();
  if (codiceCliente) dati.codiceCliente = codiceCliente;

  const note = testo(body.note, 2000);
  if (note) dati.note = note;

  if (foto.length) dati.foto = foto;

  return { ok: true, dati };
}

// Contatori aggregati per il badge del gestionale. Sono numeri e basta:
// il gestionale gira con auth anonima e questo e' l'unico nodo del portale
// che puo' leggere.
async function aggiornaContatori(db) {
  try {
    const snap = await db.ref('portal_submissions').once('value');
    const tutti = snap.val() || {};
    let nuovi = 0;
    let inEsame = 0;
    let daLeggere = 0;
    for (const k in tutti) {
      const s = tutti[k];
      if (!s) continue;
      if (s.stato === 'NUOVO') nuovi++;
      if (s.stato === 'IN_ESAME') inEsame++;
      if (!s.letto) daLeggere++;
    }
    await db.ref('portal_counters/staff').set({
      nuovi, inEsame, daLeggere, total: daLeggere, ts: Date.now()
    });
  } catch (e) {
    // Il badge e' un di piu': se fallisce, l'invio resta comunque registrato.
  }
}

exports.__test__ = { valida, generaRiferimento, CAUSALI, TIPI };
