// Unico canale verso il server.
//
// L'app pubblica NON parla con Firebase. Non ha l'SDK, non ha credenziali,
// non ha accesso in lettura al database. Manda i dati a due funzioni Netlify
// che scrivono e leggono al posto suo con privilegi di servizio.
//
// E' la scelta che rende sicuro dare il link a chiunque: chi lo apre puo'
// inviare un reso e consultare il PROPRIO invio (se ne conosce il codice),
// e nient'altro. Non puo' elencare gli invii degli altri perche' non ha
// nessuna via per interrogare il database.

const SUBMIT_URL = '/api/portal-submit';
const STATUS_URL = '/api/portal-status';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function call(url, options) {
  let res;
  try {
    res = await fetch(url, options);
  } catch (e) {
    throw new ApiError('Nessuna connessione. Controlla la rete e riprova.', 0);
  }

  let json = null;
  try {
    json = await res.json();
  } catch (e) { /* risposta non JSON: gestita sotto */ }

  if (!res.ok || (json && json.error)) {
    const msg = (json && json.error) || messageForStatus(res.status);
    throw new ApiError(msg, res.status);
  }
  if (!json) throw new ApiError('Risposta del server non valida.', res.status);
  return json;
}

function messageForStatus(status) {
  if (status === 413) return 'Invio troppo pesante: riduci il numero di foto.';
  if (status === 429) return 'Troppi invii ravvicinati. Attendi qualche minuto.';
  if (status === 503) return 'Servizio momentaneamente non disponibile. Riprova fra poco.';
  return 'Errore del server (' + status + ').';
}

export function submitReso(payload) {
  return call(SUBMIT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

export function loadStato(ref) {
  return call(STATUS_URL + '?ref=' + encodeURIComponent(ref), { method: 'GET' });
}

export function inviaMessaggio(ref, testo, autore) {
  return call(STATUS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref, testo, autore })
  });
}
