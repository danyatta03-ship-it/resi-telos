# Due siti, un database

Il progetto pubblica **due siti Netlify distinti** dallo stesso repository.

```
                    ┌─────────────────────────┐
   Ufficio, ────────▶  SITO 1 — Gestionale    │
   magazzino        │  index.html (radice)    │
                    │  scheda PORTALE         │
                    └───────────┬─────────────┘
                                │  legge/scrive
                                ▼
                    ┌─────────────────────────┐
                    │   Firebase Realtime DB   │
                    │   portal_submissions     │
                    │   portal_counters        │
                    └───────────▲─────────────┘
                                │  scrive (solo dal server)
                    ┌───────────┴─────────────┐
   Clienti,  ───────▶  SITO 2 — Invio resi    │
   agenti,          │  base directory: portal │
   corrieri         │  2 Netlify Function     │
                    └─────────────────────────┘
```

**Il collegamento fra i due passa solo dal database.** I siti non si
conoscono e non si parlano mai direttamente.

## Perché due siti e non uno

Il gestionale contiene il pannello amministratore, l'interruttore di
emergenza e la configurazione Firebase. Tenerlo sullo stesso indirizzo di
una pagina che si manda per email a chiunque significa che quel codice è
scaricabile da chiunque. Due domini separati eliminano il problema alla
radice, invece di nasconderlo dietro un percorso poco visibile.

L'app pubblica, inoltre, **non carica l'SDK Firebase e non conosce l'URL
del database**: le credenziali stanno solo nelle variabili d'ambiente del
Sito 2, dove il browser non arriva. Chi ha il link non ha nessun accesso
ai dati — nemmeno in lettura. Un test lo verifica ad ogni modifica.

---

## Sito 1 — Gestionale

| | |
|---|---|
| Base directory | *(vuota — la radice del repo)* |
| Publish | `.` |
| Functions | `netlify/functions` (solo `gemini.js`) |
| Branch di produzione | `main` |

Chi apre `/portal/` su questo sito viene rimandato a
`portale-spostato.html`, che spiega dove si è spostata l'app. Serve a
evitare il caso peggiore: una copia dell'app **senza** le sue function,
che sembra funzionare e invece perde ogni invio in silenzio.

## Sito 2 — Invio resi

| | |
|---|---|
| Base directory | `portal` |
| Publish | `.` (cioè `portal/`) |
| Functions | `netlify/functions` (cioè `portal/netlify/functions`) |
| Branch di produzione | `main` |

Netlify legge `portal/netlify.toml` e `portal/package.json`: sono già nel
repository, non c'è niente da configurare a mano oltre alla base directory.

### Variabili d'ambiente — solo sul Sito 2

*Site configuration → Environment variables*

| Nome | Valore |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Il JSON del service account, incollato tale e quale **oppure** in base64 |
| `FIREBASE_DB_URL` | `https://<progetto>-default-rtdb.<regione>.firebasedatabase.app` |

Il service account si scarica da *Firebase Console → Impostazioni progetto
→ Account di servizio → Genera nuova chiave privata*.

Se l'interfaccia di Netlify rovina gli a-capo della chiave privata (capita),
converti il file in base64 e incolla quello: il codice accetta entrambe le
forme.

### Verificare che il Sito 2 sia collegato

Appena creato il sito, apri **`<indirizzo-del-sito>/#/verifica`**.

È una pagina di servizio: non è in nessun menu, non scrive niente, non
espone niente. Interroga un riferimento di forma valida che non può
esistere e legge il codice di risposta, così distingue i tre casi:

| Cosa dice | Cosa fare |
|---|---|
| ✓ Il sito è collegato | Nient'altro. Manda un reso di prova per chiudere il cerchio. |
| ✕ Non raggiunge il database | Mancano `FIREBASE_DB_URL` / `FIREBASE_SERVICE_ACCOUNT`, o serve un nuovo deploy dopo averle messe. |
| ✕ Le function non rispondono | La *Base directory* non è `portal`: Netlify non trova né `netlify.toml` né le function. |

Serve nei primi cinque minuti di vita del sito. Senza, il primo ad
accorgersi di una configurazione sbagliata sarebbe un cliente che invia un
reso e lo vede sparire — e in Telos nessuno saprebbe che quel reso non è
mai arrivato.

### Collegare il gestionale al Sito 2

Nel gestionale, scheda **PORTALE**, il pulsante **⚙** accanto a "Link
pubblico" chiede l'indirizzo del Sito 2. Va inserito una volta per
dispositivo. Da quel momento "🔗 Link pubblico" copia l'indirizzo giusto,
quello da mandare a clienti, agenti e corrieri.

Prima i due stavano sullo stesso sito e il link si ricavava da solo; con
due siti distinti quell'indirizzo non esiste più, e senza questa
impostazione "Copia link" consegnerebbe un indirizzo morto.

---

## Regole del database

Le regole da incollare in *Firebase Console → Realtime Database → Regole*
sono in **`firebase-rules.json`** — un solo file, si copia tutto com'è.

Sono venti righe: radice chiusa, e ogni nodo leggibile e scrivibile da chi
ha fatto l'accesso. Nient'altro.

Le precedenti erano trecento righe che validavano campo per campo, e
avevano forme come questa:

```
".validate": "!newData.exists() || newData.child('dataUrl').val().length < 4000000"
```

Se il record non ha `dataUrl`, `.val()` è `null`, `.length` su null non
esiste, la regola vale **falso** e la scrittura viene **rifiutata senza
dire perché**. La stessa trappola era in `codeMem` (pretendeva sempre
`pre`) e in `returns` (pretendeva sempre `cod`).

Il caso peggiore era la prima sincronizzazione: `update()` è una scrittura
**multipla e atomica**, quindi una sola riga fuori norma faceva rifiutare
l'intero blocco. Non quella riga: tutte.

La validazione dei dati che arrivano da fuori non è sparita — si è spostata
dove serve. `portal-submit.js` controlla ogni campo sul server, prima di
scrivere, con trentotto test a coprirla. Lì un dato sbagliato produce un
errore che si legge; nelle regole produceva silenzio.

> `_diag` e `_backups_meta` mancavano del tutto. È il motivo per cui il
> pulsante "Test connessione" rispondeva sempre "Scrittura rifiutata" anche
> quando la sincronizzazione funzionava benissimo: senza una regola propria,
> un nodo cade sul `".read": false` della radice.

---

## Quando il gestionale non sincronizza

Nel gestionale: **⚙ → Diagnostica Firebase**.

In alto c'è la **versione**. Va guardata per prima: se non è quella
dell'ultimo deploy, il dispositivo sta girando una copia vecchia rimasta
nella cache, e non c'è nessun guasto da cercare nel codice — basta
"aggiorna app" nel piè di pagina.

In fondo, **🔬 Diagnosi approfondita** esegue quattro prove separate, ognuna
con una scadenza, e dice quale strato è caduto:

| Esito | Significato |
|---|---|
| 1 ❌ | L'account anonimo non esiste più sul server. Si rinnova da solo. |
| 2 ✅ 3 ❌ | https passa, il canale realtime no. Vedi sotto: quasi sempre è il CSP. |
| 2 ❌ con 401/403 | Regole del database chiuse, oppure accesso Anonimo disattivato. |
| 2 ❌ senza risposta | Il database non è raggiungibile: rete, o URL sbagliato. |

### Il caso 2 ✅ 3 ❌ — e perché sembrava un problema di rete

Il Realtime Database **non parte dal websocket**. Prima stabilisce una
connessione in *long-polling*, e quel trasporto funziona **iniettando tag
`<script>`** verso `<database>.firebasedatabase.app` — quindi passa da
`script-src`, non da `connect-src`.

Con quel dominio assente da `script-src`, il browser blocca il trasporto
iniziale, la connessione non si stabilisce mai, e **il websocket non viene
nemmeno tentato**. L'SDK non dà errore: tace. Da fuori è indistinguibile da
un firewall — solo che succede su *qualunque* rete, telefono compreso.

Era già stato affrontato a metà: un commento in `netlify.toml` diceva
*"v35r — connect-src rilassato a https:/wss: dopo report Firebase non
connette"*. Quella correzione apriva la strada al websocket ma lasciava
chiuso il trasporto che viene prima.

La diagnosi ora ascolta gli avvisi `securitypolicyviolation` del browser —
che altrimenti finiscono solo nella console, dove da un telefono non li vede
nessuno — e se il blocco riguarda il database lo dice esplicitamente.

**Per distinguere CSP da rete in trenta secondi:** collega il dispositivo
all'hotspot del telefono. Se il guasto resta identico, la rete non c'entra.

**Il gestionale non si ferma comunque.** Quando il canale realtime non
risponde, passa da solo allo stesso database via https (REST) e continua a
lavorare: l'intestazione mostra `● ONLINE · HTTPS` in ambra. È una modalità
degradata — aggiornamento ogni pochi secondi invece che istantaneo — ma
niente si perde.

La riga **"Ascoltatori attivi"** deve dire **7**. Un numero molto più alto
significa che i tentativi di riconnessione non stanno staccando i
precedenti, e l'app sta rifacendo lo stesso lavoro N volte.

---

## Test

```
node tests/run.js
```

121 test, nessuna dipendenza esterna. Coprono la validazione degli invii,
cosa esce davvero dagli endpoint pubblici, le regole del database, la
separazione dei due siti, il trasporto https di riserva (eseguito davvero
contro un finto Firebase in memoria) e la coerenza delle versioni fra
`index.html` e `sw.js`.
