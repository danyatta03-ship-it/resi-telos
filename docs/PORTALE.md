# App pubblica "Reso Telos"

Una pagina web da dare a **clienti, agenti e corrieri**: compilano il reso,
scrivono il proprio nome, inviano. L'invio arriva nel gestionale, nella scheda
**PORTALE**, con la notifica sul badge.

Nessun login, nessun account da creare, nessun ruolo. Si pubblica su Netlify e
si manda il link.

---

## 1. Come funziona

```
   CHI RENDE                    SERVER                    TELOS
   (link pubblico)         (Netlify Functions)          (gestionale)

   ┌──────────────┐                                   ┌──────────────┐
   │  portal/     │   POST /api/portal-submit         │  index.html  │
   │              │ ────────────────────────►┐        │              │
   │  compila     │                          │        │  scheda      │
   │  e invia     │                    ┌─────▼─────┐  │  PORTALE     │
   │              │                    │ Firebase  │◄─┤              │
   │              │                    │ RTDB      │  │  badge 🌐 3  │
   │  RS-B9FKCJ   │   GET  /api/portal-status       │  │              │
   │  controlla   │ ◄──────────────────┴───────────┘  │  accetta →   │
   │  lo stato    │                                   │  inserisce   │
   └──────────────┘                                   └──────────────┘
        │                                                     │
        └────────── nessun accesso diretto a Firebase ────────┘
                    (non ha l'SDK, non ha credenziali)
```

### Perche' l'app pubblica non parla con Firebase

Il gestionale si autentica su Firebase in modo **anonimo**. Se anche l'app
pubblica lo facesse, chiunque aprisse il link avrebbe **lo stesso livello di
accesso del gestionale** — e le regole del database non sanno distinguere due
utenti anonimi. Un cliente potrebbe leggere gli invii di tutti gli altri.

Per questo l'app pubblica **non ha l'SDK Firebase**: manda i dati a due
funzioni sul server, che scrivono e leggono al posto suo. L'app non ha nessuna
via per interrogare il database. Un test lo verifica a ogni esecuzione.

---

## 2. File

```
portal/                       app pubblica (nessuna dipendenza esterna)
├── index.html
├── css/app.css
├── manifest.json  sw.js
└── js/
    ├── app.js                avvio e router (3 schermate)
    ├── form.js               modulo di invio
    ├── stato.js              conferma, consultazione, ricerca
    ├── api.js                unico canale verso il server
    ├── photos.js             compressione foto
    ├── dom.js                helper
    └── costanti.js           causali, stati, limiti

netlify/functions/
├── portal-submit.js          riceve e valida gli invii
├── portal-status.js          consultazione e risposte del mittente
└── lib/admin.js              Firebase Admin condiviso

index.html                    gestionale: scheda PORTALE + badge
firebase-rules-v2.json        regole (gestionale invariato + 2 nodi nuovi)
```

---

## 3. Cosa vede chi apre il link

**Modulo di invio** — chi sei (nome, azienda, in che qualita', contatti),
cosa rendi (motivo, articoli, note), foto. Nome, azienda, motivo e almeno un
codice articolo sono obbligatori; il resto e' facoltativo.

Comodita' pensate per chi compila da un telefono in magazzino:

- la **bozza si salva da sola**: una telefonata a meta' non fa perdere tutto
- le **foto si comprimono** prima dell'invio (1400px, ~250 KB l'una); tre foto
  da telefono non compresse sarebbero 18 MB che su rete mobile non partono
- gli errori dicono **cosa manca**, non "compila i campi obbligatori"

**Conferma** — un riferimento tipo `RS-B9FKCJ` e un link da salvare.

**Consultazione** — con il riferimento si vede lo stato, il riepilogo e si puo'
scrivere all'ufficio resi. I riferimenti restano nel browser di chi ha inviato,
cosi' non deve riscriverli.

---

## 4. Cosa vede Telos

Nel gestionale, scheda **PORTALE** (visibile a UFF, MAG e ADM):

| Azione | Effetto |
|---|---|
| **Accetta e inserisci** | Segna l'invio come accettato e **precompila il form di inserimento** col primo articolo: codice, marca, quantita', fornitore, causale tradotta e riferimento nelle note |
| **Non accettare** | Chiede la motivazione, che il mittente vede nella sua pagina |
| **Rispondi** | Conversazione col mittente, dentro la pratica |
| **Foto** | Le immagini allegate all'invio |
| **Segna letto** | Toglie l'invio dal filtro "da leggere" e dal badge |
| **Link pubblico** | Copia l'indirizzo da mandare a clienti, agenti e corrieri |

Il badge 🌐 nell'header conta gli invii **da leggere**. Il gestionale non puo'
leggere i nodi del portale con l'auth anonima, quindi legge
`portal_counters/staff`: soli numeri aggregati, nessun nome e nessuna pratica.

---

## 5. Dati

### `portal_submissions/<RS-XXXXXX>`

```
ref, ts, stato, letto, origine, ip
mittente: { nome, azienda, tipo, telefono, email }
codiceCliente, causale, note
articoli: [ { cod, marca, qty, forn } ]
foto: [ dataURL ]              massimo 3
messaggi: { <id>: { ts, da, autore, testo } }
esito, gestitoDa, gestitoTs    compilati da Telos
```

Stati: `NUOVO → IN_ESAME → ACCETTATO → CHIUSO`, oppure `RIFIUTATO`.

### `portal_counters/staff`

`{ nuovi, inEsame, daLeggere, total, ts }` — solo numeri.

---

## 6. Sicurezza

Il link e' pubblico, quindi il server **non si fida di niente** di cio' che
arriva. `portal-submit.js` rivalida e normalizza ogni campo:

| | |
|---|---|
| Campi lunghissimi | Troncati, non rifiutati |
| Causale inventata | Rifiutata: deve stare nell'elenco |
| Tipo mittente inventato | Diventa `ALTRO` |
| Quantita' negative o assurde | Riportate fra 1 e 9999 |
| Campi extra (`stato`, `esito`, `admin`…) | Ignorati: li decide il server |
| Foto SVG | Rifiutate — possono contenere script |
| URL remoti al posto delle foto | Rifiutati |
| Oltre 40 articoli / 3 foto | Tagliati |
| Invii ravvicinati | Massimo 12 per IP ogni 10 minuti |

La consultazione restituisce **meno** di quello che c'e' nel database: niente
IP, niente flag interni, niente foto (chi le ha caricate le ha gia'), niente
telefono ed email del mittente.

I riferimenti sono casuali su ~387 milioni di combinazioni e non contengono
caratteri che si confondono al telefono (`0/O`, `1/I/L`).

**Limiti dichiarati:** il rate limit vive nella memoria del container Netlify,
quindi ferma il doppio click e lo script improvvisato, non un avversario
determinato che cambia IP o aspetta un riavvio. Chi ottiene un riferimento
altrui puo' vedere quell'invio: e' il compromesso di non avere login.

---

## 7. Messa in produzione

### 7.1 Dipendenze

```bash
npm install
```

Aggiunge `firebase-admin`, usato solo dalle funzioni.

### 7.2 Firebase Console

**Realtime Database → Regole** → incolla `firebase-rules-v2.json` → Pubblica.
Contiene le regole del gestionale **invariate** piu' i due nodi nuovi; un test
fallisce se le prime cambiano.

Non serve altro: niente Authentication da configurare, niente Storage.

### 7.2-bis Cosa contengono le regole

Il file `firebase-rules-v2.json` contiene **solo** la chiave `rules`, perche'
la Console Firebase rifiuta qualsiasi altra chiave di primo livello: un file
con dentro una sezione di commenti non si riesce a incollare. Le spiegazioni
stanno qui.

Regole Firebase Realtime Database — Resi Telos + app pubblica di invio reso.

RETROCOMPATIBILITA': tutti i nodi usati dal gestionale (returns, chat,
presence, admin, security_log, notifEvents, notif, ocrLive, mailFollowups,
pkgphotos, _backups, codeMem, _killswitch) mantengono ESATTAMENTE le regole
della v1. Il gestionale continua a funzionare con auth anonima senza alcuna
modifica. Un test automatico (tests/rules.test.js) confronta i due file e
fallisce se anche una sola di quelle regole cambia.

NOVITA': due soli nodi.

  portal_submissions/<RS-XXXXXX>
    Gli invii che arrivano dall'app pubblica. Li SCRIVE la Netlify Function
    portal-submit con l'Admin SDK, che bypassa queste regole: percio' qui
    la scrittura serve solo al GESTIONALE, che aggiorna stato, esito e
    risposte. L'app pubblica non ha credenziali Firebase e non compare mai
    in questo nodo: parla solo con le funzioni.

  portal_counters/staff
    Numeri aggregati per il badge nell'header del gestionale. Nessun nome,
    nessun codice, nessuna pratica: solo quanti invii aspettano risposta.

PERCHE' L'APP PUBBLICA NON PARLA CON FIREBASE
  Il link gira fra clienti, agenti e corrieri. Se l'app avesse credenziali
  Firebase, chiunque lo aprisse avrebbe lo stesso livello di accesso del
  gestionale (entrambi auth anonima) e potrebbe leggere gli invii altrui:
  le regole RTDB non sanno distinguere due utenti anonimi. Facendo passare
  tutto dalle funzioni, l'app pubblica non ha proprio modo di interrogare
  il database.

APPLICARE: Firebase Console -> Realtime Database -> Regole -> incolla -> Pubblica.

---

### 7.3 Variabili d'ambiente Netlify

| Variabile | Obbligatoria | Contenuto |
|---|:-:|---|
| `FIREBASE_SERVICE_ACCOUNT` | ✓ | JSON del service account (o in base64) |
| `FIREBASE_DB_URL` | ✓ | `https://<progetto>-default-rtdb.<regione>.firebasedatabase.app` |
| `ALLOWED_ORIGINS` | consigliata | `https://<sito>.netlify.app` |

Il service account si scarica da Firebase Console → Impostazioni progetto →
Account di servizio → Genera nuova chiave privata. Se l'interfaccia Netlify
rovina le newline della chiave, incolla il JSON in base64: la funzione accetta
entrambi i formati.

### 7.4 Pubblicazione

```bash
git push
```

Netlify costruisce e pubblica. Il link da distribuire e':

```
https://<il-tuo-sito>.netlify.app/portal/
```

Lo si trova anche nel gestionale: scheda **PORTALE** → *🔗 Link pubblico*.

---

## 8. Test

```bash
npm test
```

66 test senza dipendenze esterne:

| Suite | Copre |
|---|---|
| submit | validazione lato server: dati mancanti, campi ostili, foto, riferimenti, cosa esce dalla consultazione |
| rules | regole del gestionale invariate, nodi nuovi, nessun resto della versione precedente, l'app pubblica non contiene Firebase |
| escaping | nessuna doppia codifica, nessuna `innerHTML` scoperta |

---

## 9. Note

**Il gestionale resta suo padrone.** L'app pubblica non scrive mai su
`returns/`: gli invii vivono in un nodo separato finche' un operatore non
preme "Accetta e inserisci", che precompila il form ma **non salva** — la riga
la crea l'operatore, come sempre.

**Piu' articoli in un invio.** Il precompilamento porta il primo; gli altri
restano elencati nell'invio, che si conclude quando l'operatore ha finito.

**Causali.** Quelle del portale sono scritte per chi sta al banco. Vengono
tradotte in quelle del gestionale quando esiste un corrispondente esatto; sulle
altre il campo resta vuoto e sceglie l'operatore, invece di indovinare.
