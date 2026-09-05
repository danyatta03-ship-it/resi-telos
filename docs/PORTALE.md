# Portale Tracking Resi

Piattaforma web/PWA rivolta a **clienti, agenti e corrieri**, collegata allo
stesso Firebase del gestionale interno. Vive in `portal/` ed e' un'applicazione
**separata**: il gestionale (`index.html`) non e' stato modificato in alcun punto.

---

## 1. Perche' una seconda applicazione

Il gestionale e' pensato per gli operatori Telos: 40 stati, 31 campi per record,
autenticazione anonima, tutto visibile a chiunque sia connesso. Va benissimo per
chi lavora le pratiche, ed e' inadatto a chiunque altro.

Aprirlo all'esterno avrebbe richiesto di riscriverne la sicurezza da capo. La
scelta e' stata invece affiancargli un portale con un proprio modello di accesso,
lasciando il gestionale esattamente com'e'.

| | Gestionale | Portale |
|---|---|---|
| Utenti | Operatori interni | Clienti, agenti, corrieri (+ staff) |
| Autenticazione | Anonima | Email/password + custom claims |
| Autorizzazione | Nessuna lato server | Security Rules per ruolo e perimetro |
| Stati | 40 (fase + stato) | 12 di tracking |
| Codice | `index.html`, ~16.700 righe | 40 moduli ES |

---

## 2. Architettura

```
                    ┌──────────────────────────────┐
                    │   Firebase Realtime Database │
                    │                              │
   ┌────────────┐   │  returns/       ◄── invariato│
   │ Gestionale │──►│  chat/ presence/ …           │
   │ index.html │   │                              │
   │ (anonimo)  │   │  portal_users/               │
   └────────────┘   │  portal_view/{client,…}      │
                    │  portal_access/              │
   ┌────────────┐   │  portal_timeline/            │
   │  Portale   │──►│  portal_messages/            │
   │  portal/   │   │  portal_documents/           │
   │ (email/pw) │   │  portal_requests/            │
   └─────┬──────┘   │  portal_config/  portal_audit│
         │          └──────────────┬───────────────┘
         │                         ▲
         │  /api/portal-*          │ Admin SDK
         └────────►┌───────────────┴──────────┐
                   │   Netlify Functions      │
                   │   portal-claims  (ruoli) │
                   │   portal-sync  (proiez.) │
                   │   portal-notify   (push) │
                   └──────────────────────────┘
```

### Struttura del codice

```
portal/
├── index.html              shell PWA
├── manifest.json  sw.js  firebase-messaging-sw.js
├── config/brand.json       default white-label
├── css/                    base · layout · components
└── js/
    ├── core/               infrastruttura, non conosce il dominio
    │   ├── bus.js          event bus
    │   ├── config.js       brand + config Firebase
    │   ├── firebase.js     init + helper di path
    │   ├── auth.js         login, claims, profilo
    │   ├── router.js       routing hash con guardie
    │   ├── store.js        stato reattivo + cache
    │   ├── idb.js          wrapper IndexedDB
    │   └── offline.js      coda di scrittura
    ├── domain/             regole di business, nessun DOM
    │   ├── roles.js        ruoli, permessi, proiezione campi
    │   ├── workflow.js     macchina a stati
    │   ├── timeline.js     registro eventi append-only
    │   ├── sla.js          soglie e ore lavorative
    │   ├── returns.js      accesso ai resi per ruolo
    │   ├── messages.js     thread per reso
    │   ├── documents.js    upload e metadati
    │   ├── requests.js     richieste di reso
    │   ├── notifications.js in-app + FCM
    │   └── kpi.js          aggregazioni
    ├── ui/                 componenti, nessuna logica di dominio
    │   ├── dom.js  toast.js  modal.js
    │   ├── components.js   badge, card, timeline, KPI…
    │   └── shell.js        header, sidebar, tab bar
    ├── views/              una per schermata
    └── app.js              bootstrap e rotte
```

Le dipendenze vanno in una sola direzione: `views → ui → domain → core`.
Due test lo verificano automaticamente.

---

## 3. Ruoli

| Ruolo | Vede | Puo' fare | Interfaccia |
|---|---|---|---|
| **ADMIN** | Tutto | Utenti, SLA, brand, audit, tutte le transizioni | Portale completo |
| **TELOS** | Tutto | Approva, lavora, chiude, risponde | Portale completo |
| **CLIENTE** | Solo i propri codici cliente | Apre richieste, carica documenti, scrive, contesta | Pagina singola |
| **AGENTE** | I clienti della propria zona | Come il cliente + dati economici | Pagina singola |
| **CORRIERE** | I resi del proprio vettore | Aggiorna ritiro/transito/consegna | Pagina singola |

Il ruolo vive nel **custom claim `prole`**, firmato da Google e impostato solo
dalla function `portal-claims`. Le Security Rules leggono quello: il client non
puo' falsificarlo.

### 3.1 Perche' gli esterni hanno una pagina sola

Cliente, agente e corriere non stanno "dentro un gestionale": aprono il link,
guardano i loro resi, agiscono e chiudono. Dargli dashboard, sezioni e barra di
navigazione significa farli girare fra pagine che per loro sono quasi tutte
vuote.

Per questi ruoli il portale e' **una pagina sola** — il tracking — con il
riepilogo in cima, i filtri, l'elenco e il dettaglio. Niente sidebar, niente tab
bar. Notifiche e profilo restano raggiungibili dall'header. E' l'esperienza di
un'applicazione esterna che manda informazioni al database, non di un
gestionale in miniatura.

Governato da `isTrackingOnly(role)` in `portal/js/domain/roles.js`. Gli interni
mantengono il portale completo.

---

## 4. Come funziona l'isolamento dei dati

Le regole RTDB non sanno filtrare un elenco: su `returns/` l'accesso e'
tutto-o-niente. Dare a un cliente il permesso di leggere `returns/` significa
trasmettergli i resi di tutti — anche se la UI ne mostra uno solo.

Il portale ribalta il problema con **proiezioni precalcolate**:

1. `portal-sync` (schedulata ogni 10 minuti) legge `returns/` con privilegi di
   servizio.
2. Per ogni scope scrive `portal_view/client/<codice>`, `portal_view/agent/<nome>`,
   `portal_view/courier/<vettore>` contenenti **solo le righe di competenza** e
   **solo i campi ammessi a quel ruolo**.
3. Scrive `portal_access/<uid>/<returnKey> = true`, l'indice su cui le regole
   autorizzano timeline, messaggi e documenti.

Un cliente legge il suo ramo e nient'altro. Nel suo ramo **non esiste
fisicamente** il prezzo di carico, la nota interna o il nome dell'operatore.

Campi trasmessi per ruolo (`portal/js/domain/roles.js` → `VISIBLE_FIELDS`, in
specchio con `netlify/functions/portal-sync.js` → `FIELDS`):

| | Cliente | Agente | Corriere |
|---|:-:|:-:|:-:|
| Codice, quantita', stato | ✓ | ✓ | ✓ |
| Fornitore, causale | ✓ | ✓ | — |
| Prezzo | — | ✓ | — |
| Anomalia, agente | — | ✓ | — |
| Note interne, `_log`, `_who` | — | — | — |

---

## 5. Workflow di tracking

```
RICHIESTO ──► APPROVATO ──► ATTESA_RITIRO ──► RITIRATO ──► IN_TRANSITO
    │             │                                            │
    ▼             ▼                                            ▼
RIFIUTATO    (contestabile)                                CONSEGNATO
                                                                │
                                       ┌────────────────────────┘
                                       ▼
                                 IN_VERIFICA ──► IN_LAVORAZIONE
                                       │               │
                                       ▼               ▼
                                  CHIUSO_OK  /  CHIUSO_NR
```

Ogni transizione dichiara **quali ruoli** possono compierla. Un corriere non
puo' chiudere una pratica, un cliente non puo' approvare il proprio reso: non e'
la UI a nasconderlo, e' `validateTransition()` a rifiutarlo, e le regole a
rifiutare comunque la scrittura.

**Allineamento col gestionale.** Lo stato di tracking si deriva automaticamente
da `fase`/`stato`:

| Gestionale | Tracking |
|---|---|
| RICEVIMENTO | CONSEGNATO |
| UFFICIO RESI | IN_VERIFICA |
| MAGAZZINO | IN_LAVORAZIONE |
| FINALE + "NON RENDIBILE" | CHIUSO_NR |
| FINALE (altro) | CHIUSO_OK |

Il portale **non scrive mai** `fase` o `stato`: le azioni esterne vivono solo
nella timeline. Il gestionale resta l'unico padrone del proprio nodo.

---

## 6. Timeline

Registro **append-only** per ogni reso. Le regole ammettono la scrittura solo se
`!data.exists()`: un evento, una volta scritto, non si modifica e non si cancella
da client.

L'id evento e' **derivato dal contenuto** (`fnv1a` di reso+attore+azione+minuto).
Rigiocare la stessa azione dalla coda offline, o toccare due volte il bottone,
riscrive lo stesso nodo con lo stesso valore: nessun duplicato.

Le regole impongono inoltre `actor == auth.uid` e `actorRole == auth.token.prole`:
non si possono firmare eventi a nome di altri.

---

## 7. SLA

Soglie configurabili per stato (Admin → SLA), con default sensati di fabbrica.

Il tempo si misura in **ore lavorative** (lun-ven 08:00-18:00), non solari: un
reso consegnato venerdi' alle 17 non risulta in ritardo lunedi' mattina. Sono i
clienti a leggere questi numeri e devono corrispondere alla loro percezione.

---

## 8. Offline

Ogni scrittura passa dalla coda (`core/offline.js`). Se la connessione manca,
l'operazione finisce in IndexedDB e riparte alla riconnessione. Gli id
deterministici rendono il replay sicuro.

Lo `store` serve la copia in cache mentre la rete risponde: il portale si apre
pieno di dati anche senza campo.

---

## 8-bis. Modalita' di prova

Il portale si puo' provare **senza configurare nulla**: ne' Firebase, ne'
account, ne' Netlify.

Dalla schermata di accesso, "🔍 Prova il portale senza account" apre un
elenco di ruoli. Scegliendone uno si entra con un finto SDK Firebase e un
database in memoria popolato di dati verosimili (codici Bosch reali, clienti
nel formato del gestionale, vettori usati davvero).

Serve a valutare l'interfaccia e i permessi prima di mettere il portale in
produzione. Il resto del codice non sa di essere in prova: gira identico a
come girera' con dati veri.

- Si attiva **solo** con un click esplicito o con `?demo` nell'URL
- Una striscia gialla sempre visibile impedisce di scambiare i dati finti per veri
- Non tocca Firebase e non ha accesso a nessun dato reale
- Per rimuoverla del tutto in produzione: cancella `portal/js/core/demo.js` e
  il suo import in `portal/js/app.js`

Codice: `portal/js/core/demo.js`.

---

## 8-ter. Badge nel gestionale

Nell'header del gestionale, per UFF/MAG/ADM, compare un pulsante 🌐 con una
pastiglia rossa in alto a destra: quante cose arrivate dall'esterno aspettano
una risposta (richieste da esaminare + contestazioni aperte + messaggi delle
ultime 72 ore).

Il gestionale gira con auth **anonima** e non puo' leggere i nodi del portale —
le regole glielo impediscono, ed e' giusto. Legge invece
`portal_counters/staff`, un nodo di soli numeri aggregati: nessun nome, nessun
codice cliente, nessun dato di una pratica specifica. E' l'unico nodo del
portale leggibile senza il claim `prole`, e la scrittura resta riservata allo
staff.

I contatori sono ricalcolati da `portal-sync` a ogni giro (10 minuti).

---

## 9. Messa in produzione

### 9.1 Dipendenze

```bash
npm install
```

Aggiunge `firebase-admin`, usato dalle sole Netlify Functions.

### 9.2 Firebase Console

**Authentication** → Sign-in method → abilita **Email/Password**.
(L'accesso anonimo resta abilitato: serve al gestionale.)

**Realtime Database** → Regole → incolla `firebase-rules-v2.json` → Pubblica.
Contiene le regole del gestionale **invariate** piu' quelle del portale; un test
automatico verifica che le prime non cambino mai.

**Storage** → Regole → incolla `storage.rules` → Pubblica.
Senza Storage il portale funziona lo stesso: gli upload si disabilitano da soli.

**Cloud Messaging** (facoltativo, per il push) → Impostazioni progetto → Cloud
Messaging → Certificati push web → genera la coppia di chiavi e annota la
**VAPID key**.

### 9.3 Variabili d'ambiente Netlify

| Variabile | Obbligatoria | Contenuto |
|---|:-:|---|
| `FIREBASE_SERVICE_ACCOUNT` | ✓ | JSON del service account (o base64) |
| `FIREBASE_DB_URL` | ✓ | `https://<progetto>-default-rtdb.<regione>.firebasedatabase.app` |
| `ALLOWED_ORIGINS` | consigliata | `https://<sito>.netlify.app` |
| `PORTAL_BOOTSTRAP_SECRET` | temporanea | Segreto per creare il primo admin. **Rimuovere dopo l'uso.** |
| `PORTAL_SYNC_MAX_AGE_DAYS` | no | Giorni di storico da proiettare (default 400) |
| `PORTAL_SYNC_MAX_ROWS` | no | Tetto di righe per sincronizzazione (default 6000) |

Il service account si scarica da Firebase Console → Impostazioni progetto →
Account di servizio → Genera nuova chiave privata. Se l'interfaccia Netlify
rovina le newline della chiave privata, incolla il JSON codificato in base64:
la function accetta entrambi i formati.

### 9.4 Primo amministratore

Non puo' crearlo un amministratore, perche' non ne esiste ancora nessuno. Per
questo solo caso si usa il segreto di bootstrap:

```bash
curl -X POST https://<sito>.netlify.app/api/portal-claims \
  -H 'Content-Type: application/json' \
  -d '{
    "action": "bootstrap",
    "secret": "<PORTAL_BOOTSTRAP_SECRET>",
    "email": "admin@telosgroup.it",
    "displayName": "Nome Cognome",
    "password": "una-password-lunga"
  }'
```

La via si chiude da sola appena esiste un admin attivo. **Rimuovi comunque
`PORTAL_BOOTSTRAP_SECRET` dalle variabili subito dopo.**

### 9.5 Prima sincronizzazione

```bash
# dal portale: Admin → si autentica da solo
curl -X POST https://<sito>.netlify.app/api/portal-sync \
  -H "Authorization: Bearer <ID_TOKEN>"
```

Poi gira da sola ogni 10 minuti (`netlify.toml`).

### 9.6 Utenti

Portale → **Utenti** → *Nuovo utente*. Per i ruoli esterni indica il perimetro
(un valore per riga):

- **Cliente** → codici cliente, es. `007183`
- **Agente** → nomi zona, es. `Direzionali Torino`
- **Corriere** → vettori, es. `PIEMME`

I valori devono coincidere con quelli scritti dal gestionale nei campi `sogg`,
`agente`, `vetRic`/`vetUsc`. L'utente riceve un link per impostare la password.

Dopo aver creato utenti esterni, lancia una sincronizzazione: e' quella a
popolare il loro perimetro.

---

## 10. Test

```bash
npm test
```

178 test senza dipendenze esterne:

| Suite | Copre |
|---|---|
| workflow | 40 test sulle transizioni e sui permessi per ruolo |
| sla | ore lavorative, soglie, weekend, formattazione |
| roles | permessi e proiezione dei campi per ruolo |
| timeline | idempotenza degli id, ordinamento, lettura stato |
| returns | filtri, ordinamenti, parsing dei formati reali |
| rules | regole del gestionale invariate, isolamento, append-only |
| imports | ogni simbolo importato esiste davvero |
| escaping | nessuna doppia codifica, nessuna innerHTML scoperta |

I test su `rules` sono la rete di sicurezza piu' importante: verificano che le
regole del gestionale restino **byte per byte identiche** alla v1.

---

## 11. Note operative

**Il gestionale non e' stato toccato.** `index.html`, `sw.js`, `js/taxonomies.js`
e `firebase-rules.json` sono invariati. Le uniche modifiche fuori da `portal/`
sono additive: rotte e header in `netlify.toml`, una dipendenza in `package.json`.

**Ritardo di allineamento.** Le proiezioni si aggiornano ogni 10 minuti: un
cliente vede lo stato del gestionale entro quel margine. Le azioni fatte *dal
portale* (transizioni, messaggi, documenti) sono invece immediate. Per accorciare
il ritardo si abbassa lo `schedule` in `netlify.toml`, oppure il gestionale
potra' in futuro chiamare `/api/portal-sync` dopo un salvataggio.

**Storage assente.** Se Firebase Storage non e' attivo il portale funziona e
disabilita i soli caricamenti.

**Push assente.** Senza VAPID key restano le notifiche in-app.

---

## 12. Limiti noti

| | |
|---|---|
| Allineamento a intervalli | 10 minuti fra gestionale e proiezioni |
| Volume proiettato | 6.000 resi piu' recenti, 400 giorni |
| Aggancio cliente | Richiede il codice numerico in `sogg` ("007183 - NOME"). I record con la sola ragione sociale non vengono associati |
| Vettori composti | `CIPI/PIEMME` viene assegnato a entrambi |
| Festivita' | Lo SLA salta i weekend, non le festivita' nazionali |
