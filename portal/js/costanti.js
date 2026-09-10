// Valori condivisi fra app pubblica e funzioni server.
// Se cambi qui, controlla anche netlify/functions/portal-submit.js: il server
// non si fida di quello che arriva dal client e rivalida con la stessa lista.
//
// Tutto quello che c'e' in questo file ricalca il MODULO ACCETTAZIONE RESI
// cartaceo (proposta v3). Chi compila online e chi compila a mano devono
// trovare le stesse voci, con le stesse parole: altrimenti i due canali
// producono dati che non si possono confrontare.
//
// La sezione "NOTE INTERNE RICEVIMENTO RESI" del cartaceo non compare qui
// apposta: e' ad uso interno Telos e non riguarda chi manda il reso.

export const TIPI_MITTENTE = [
  { value: 'CLIENTE', label: 'Cliente / officina' },
  { value: 'AGENTE', label: 'Agente Telos' },
  { value: 'CORRIERE', label: 'Corriere / vettore' },
  { value: 'FILIALE', label: 'Filiale Telos' },
  { value: 'ALTRO', label: 'Altro' }
];

// Sezione 1 del modulo — "Documento di acquisto".
export const TIPI_DOCUMENTO = [
  'VENDITA', 'FATTURA', 'FLOTTA', 'CORRISPETTIVO', 'VISIONE', 'NOLEGGIO'
];

// Sezione 3 del modulo — "Causale reso", nello stesso ordine del cartaceo.
export const CAUSALI = [
  'ERRATO ORDINE CLIENTE',
  'CARCASSA',
  'GARANZIA',
  'GARANZIA MANODOPERA E DANNI',
  'ORDINE DISDETTO',
  'GARANZIA MANODOPERA',
  'ERRATO CONFEZIONAMENTO',
  'DANNEGGIATO',
  'INCOMPLETO',
  'DIVERSO DA OE / INCOMPATIBILE',
  'PERVENUTO MONTATO',
  'ERRATA SPEDIZIONE',
  'ALTRO'
];

// Avvisi che il cartaceo stampa accanto ad alcune causali. Online conviene
// mostrarli solo quando servono: un elenco di avvertenze sempre visibile
// non lo legge nessuno.
export const AVVISI_CAUSALE = {
  'DANNEGGIATO': 'Un danno va segnalato entro 24 ore dal ricevimento della merce.'
};

// Sezione 4 — "Reso in garanzia". Si apre solo per queste causali, con
// l'elenco degli allegati richiesti.
export function inGaranzia(causale) {
  return String(causale || '').indexOf('GARANZIA') >= 0;
}

export const ALLEGATI_GARANZIA = [
  'Libretto di circolazione del veicolo.',
  'Se il materiale è ELETTRICO o DIESEL: la diagnosi.',
  'Se il materiale è BOSCH: la ricevuta d\'installazione, oppure una relazione su carta intestata.'
];

// Stati dell'invio, dal punto di vista di chi lo ha mandato.
export const STATI = {
  NUOVO:      { label: 'Ricevuto',      colore: '#8FA4B8', desc: 'L\'ufficio resi ha ricevuto la tua richiesta.' },
  IN_ESAME:   { label: 'In esame',      colore: '#E6B03C', desc: 'Stiamo verificando la pratica.' },
  ACCETTATO:  { label: 'Accettato',     colore: '#2ECC71', desc: 'Reso accettato e preso in carico.' },
  RIFIUTATO:  { label: 'Non accettato', colore: '#E05555', desc: 'La richiesta non è stata accolta.' },
  CHIUSO:     { label: 'Concluso',      colore: '#5BB8E0', desc: 'Pratica conclusa.' }
};

export const ORDINE_STATI = ['NUOVO', 'IN_ESAME', 'ACCETTATO', 'CHIUSO'];

export function statoLabel(s) {
  return (STATI[s] && STATI[s].label) || s || '—';
}

export function statoColore(s) {
  return (STATI[s] && STATI[s].colore) || '#8FA4B8';
}

export function statoDesc(s) {
  return (STATI[s] && STATI[s].desc) || '';
}

// Limiti, replicati lato server.
export const LIMITI = {
  nome: 120,
  azienda: 200,
  telefono: 40,
  email: 200,
  codiceCliente: 40,
  ddtNumero: 60,
  docNumero: 60,
  causale: 120,
  note: 2000,
  articoli: 40,
  codArticolo: 60,
  marca: 20,
  descrizione: 200,
  qtyMax: 9999,
  km: 9999999,
  foto: 3,
  messaggio: 2000
};
