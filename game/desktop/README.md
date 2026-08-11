# City Shooter — Desktop (Electron)

Wrapper Electron che avvia il server Colyseus in background e apre il gioco in una finestra nativa. Genera **.exe** (Windows), **.dmg** (macOS) o **.AppImage** (Linux).

## Prerequisiti
- Node.js 18+
- Un token Mapbox gratuito su https://account.mapbox.com

## Build passo passo (sul TUO PC — non funziona da questo container)

```bash
# 1. Metti il token Mapbox nel client (viene incorporato nel bundle)
cd game/client
cp .env.example .env
# apri .env e metti il tuo VITE_MAPBOX_TOKEN

# 2. Installa tutto (il postinstall di desktop builda anche client + server)
cd ../desktop
npm install

# 3a. Test rapido (apre l'app dev, senza pacchettizzare)
npm start

# 3b. Genera il .exe (SU WINDOWS)
npm run dist:win
#     -> game/desktop/dist/CityShooter-0.1.0-x64.exe          (installer NSIS)
#     -> game/desktop/dist/CityShooter-0.1.0-x64-portable.exe (portable, doppio click)

# 3c. Per macOS: npm run dist:mac  (deve girare su un Mac)
# 3d. Per Linux: npm run dist:linux (genera AppImage)
```

## Perche non posso crossbuild Windows -> Linux "da qui"
electron-builder puo cross-compilare **solo se Wine e installato** sulla macchina Linux, e va comunque firmato/testato altrove. Il modo pulito e' lanciare `npm run dist:win` **su Windows** (o su una VM / CI Windows).

## Se non hai Windows
- Usa una **GitHub Action** con `runs-on: windows-latest` che esegue `npm install && npm run dist:win` in `game/desktop`, allega il .exe come artifact. Ci vogliono 3-4 minuti.
- Oppure una VM Windows temporanea (Azure trial, ecc).

Vuoi che ti aggiunga la workflow GitHub Actions per costruire il .exe in automatico ad ogni push? Basta chiedermelo.
