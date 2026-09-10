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

// Verifica che il sito sia collegato al database, senza scrivere niente.
//
// Serve subito dopo aver creato il sito: se le variabili d'ambiente non
// sono a posto, il primo a scoprirlo sarebbe un cliente che invia un reso
// e lo vede sparire. Interroga un riferimento di forma valida che non puo'
// esistere, e legge la risposta:
//
//   404  → tutto collegato: il server ha cercato davvero e non ha trovato
//   503  → le credenziali Firebase mancano o sono sbagliate
//   altro→ le function non sono state costruite, o manca l'instradamento
export async function verificaCollegamento() {
  let res;
  try {
    res = await fetch(STATUS_URL + '?ref=RS-000000', { method: 'GET', cache: 'no-store' });
  } catch (e) {
    return { ok: false, causa: 'rete', dettaglio: 'Il sito non risponde.' };
  }

  let corpo = null;
  try { corpo = await res.json(); } catch (e) { /* non JSON: gestito sotto */ }

  if (res.status === 404) return { ok: true, stato: 404 };
  if (res.status === 503) {
    return { ok: false, causa: 'credenziali', stato: 503,
      dettaglio: (corpo && corpo.error) || 'Servizio non configurato.' };
  }
  if (!corpo) {
    // Il server ha risposto con una pagina, non con JSON: quasi sempre vuol
    // dire che /api/... non e' instradato e siamo finiti sull'index.
    return { ok: false, causa: 'instradamento', stato: res.status,
      dettaglio: 'La risposta non e\' quella di una function.' };
  }
  return { ok: false, causa: 'inatteso', stato: res.status,
    dettaglio: (corpo && corpo.error) || ('HTTP ' + res.status) };
}

export function inviaMessaggio(ref, testo, autore) {
  return call(STATUS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref, testo, autore })
  });
}
