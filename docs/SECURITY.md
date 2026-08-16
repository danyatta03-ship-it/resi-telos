# Security notes — Resi Telos

Aggiornato v35p (audit cybersec applicato).

## Hardening già in produzione

- **HTTP security headers** (`netlify.toml`): CSP, HSTS 1y+preload, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy restrittiva.
- **CORS proxy Gemini** (`netlify/functions/gemini.js`): allow-list via env `ALLOWED_ORIGINS` (fallback su `URL`/`DEPLOY_PRIME_URL` Netlify).
- **PIN admin PBKDF2**: SHA-256 + salt casuale + 200k iterazioni. Migrazione automatica dalla vecchia SHA-256 nuda al primo login corretto.
- **Throttle PIN**: delay progressivo 500ms→8s + lockout 5 minuti dopo 5 tentativi.
- **XSS chat**: allow-list `data:image/…` + `https://…` sui campi `photo`/`file`.
- **Idle timeout admin**: 15 minuti.
- **Audit log** (`security_log/`): login/mod/change_pin tracciati.

## Da configurare in produzione (manuale)

### 1. Env vars Netlify (Dashboard → Site settings → Environment variables)

```
GEMINI_KEYS         = <chiave1>,<chiave2>,…       # richiesto per AI
GEMINI_MODELS       = gemini-2.5-flash-lite,gemini-2.0-flash   # opzionale
ALLOWED_ORIGINS     = https://resi-telos.netlify.app           # anti abuse quota
```

Senza `ALLOWED_ORIGINS`, il proxy ripiega sull'URL del deploy Netlify e — solo in dev locale — accetta `*`.

### 2. Regole Firebase Realtime Database

Applicare il file [`firebase-rules.json`](../firebase-rules.json):

Firebase Console → Realtime Database → **Regole** → Incolla il contenuto → **Pubblica**.

Le regole:
- Negano l'accesso root (`".read": false, ".write": false`)
- Aprono ogni sottoalbero (`returns/`, `chat/`, `admin/`, `pkgphotos/`, …) solo ad utenti autenticati (Anonymous Auth compreso)
- Validano schema e dimensioni: `chat/photo` solo `data:image/` o `https://`, max 400 KB; `pkgphotos/dataUrl` max 4 MB; `text` max 4000 char
- `security_log/` append-only (nessun overwrite)
- `_killswitch` leggibile senza auth (serve al boot per bloccare l'app)

### 3. Firebase Auth

Console → Authentication → Sign-in method → **Anonymous** deve essere abilitato.

## Findings noti / rischio residuo

| Sev | Finding | Mitigazione | Stato |
|---|---|---|---|
| LOW | CSP con `'unsafe-inline'` per script/style | Necessario finché l'app usa `onclick=` inline ovunque | Accettato |
| LOW | Nessuna SRI su `unpkg`/`cdnjs` (fallback) | Librerie principali servite same-origin da Netlify | Accettato |
| INFO | RTDB apiKey pubblica | Standard Firebase: la sicurezza si fa via Auth + Rules | Documentato |

## Cosa fare in caso di sospetto data breach

1. Cambiare il PIN admin (Admin → Sicurezza → 🔑 Cambia PIN)
2. Ruotare le chiavi Gemini (Google AI Studio) → aggiornare `GEMINI_KEYS` su Netlify
3. Attivare killswitch: Firebase Console → `_killswitch` → `{ enabled: true, message: "..." }` (l'app si blocca all'avvio)
4. Rivedere `security_log/` per attività anomala
5. Fare backup completo del DB (Admin → Backup)
