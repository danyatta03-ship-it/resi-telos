// Valori condivisi fra app pubblica, funzioni server e gestionale.
// Se cambi qui, controlla anche netlify/functions/portal-submit.js: il server
// non si fida di quello che arriva dal client e rivalida con la stessa lista.

export const TIPI_MITTENTE = [
  { value: 'CLIENTE', label: 'Cliente / officina' },
  { value: 'AGENTE', label: 'Agente Telos' },
  { value: 'CORRIERE', label: 'Corriere / vettore' },
  { value: 'FILIALE', label: 'Filiale Telos' },
  { value: 'ALTRO', label: 'Altro' }
];

// Sottoinsieme leggibile delle causali del gestionale (js/taxonomies.js).
// Quelle interne — le sotto-anomalie di garanzia, per dire — non hanno senso
// per chi sta al banco con il pezzo in mano.
export const CAUSALI = [
  'ERRATO ORDINE',
  'ERRATA SPEDIZIONE',
  'ORDINE DISDETTO CLIENTE',
  'ORDINE MULTIPLO',
  'DIVERSO DA OE / INCOMPATIBILE',
  'ERRATO CONFEZIONAMENTO',
  'INCOMPLETO - MANCA UN PEZZO',
  'CARCASSA',
  'GARANZIA',
  'DANNEGGIATO',
  'PERVENUTO MONTATO / SPORCO',
  'ALTRO'
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
  causale: 120,
  note: 2000,
  articoli: 40,
  codArticolo: 60,
  marca: 20,
  fornitore: 120,
  qtyMax: 9999,
  foto: 3,
  messaggio: 2000
};
