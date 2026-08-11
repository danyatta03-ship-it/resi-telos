# City Shooter

Prototipo di FPS browser-based (stile krunker.io) su citta reali. Mapbox GL fornisce edifici 3D e mappa; Three.js rendera nella stessa scena via CustomLayer; Colyseus fa il multiplayer autoritativo.

## Setup
```bash
cd game
npm install
cp client/.env.example client/.env    # metti VITE_MAPBOX_TOKEN
npm run dev
```
Client: http://localhost:5173  •  Server: ws://localhost:2567

## Feature (prototipo)
- **6 citta reali** selezionabili da menu (Milano, NYC, Tokyo, Parigi, Londra, San Francisco)
- **FPS controller** WASD + mouse (pointer lock), corsa, salto, gravita
- **Collisioni con muri** (raycast a piu altezze contro la mesh degli edifici) + camminata sopra i tetti
- **2 armi**: Pistol (1) / Rifle (2), ricarica (R), munizioni, RPM/danno/spread/rinculo distinti
- **Viewmodel** (braccia + arma) in overlay, con bob, kick di rinculo, animazione reload
- **Effetti**: muzzle flash + luce, tracer, spark di impatto, vignetta rossa quando colpito
- **Hitscan client** con controllo occlusione dagli edifici; server valida cooldown e danno
- **Nametag + healthbar** proiettati sopra i giocatori remoti
- **HUD**: HP, K/D, ammo, killfeed, leaderboard, schermata di morte con respawn timer
- **Minimappa** in alto-sinistra con te (verde) e nemici (rossi), orientata al bearing
- **Rigenerazione HP** dopo 4s senza danni (server-side)
- **FOV kick** in corsa e sullo sparo
- **Colyseus room** autoritativa: cooldown per arma, damage per arma, respawn randomizzato

## Struttura
```
game/
  server/src/
    index.js     GameRoom: move/shoot/setCity, regen tick, cooldowns
    schema.js    GameState + Player (pos, yaw, pitch, hp, kills, deaths, name)
  client/src/
    main.js      init map, CustomLayer three, game loop, hitscan
    player.js    controller FPS con recoil/FOV kick
    world.js     BuildingsCache: mesh da querySourceFeatures, ground/collide/raycast
    weapons.js   WEAPONS table + Viewmodel (overlay scene)
    effects.js   tracer, spark, muzzle
    ui.js        menu, HUD, minimap, nametag, killfeed, vignette, death overlay
    net.js       colyseus.js client
```

## Controlli
| Tasto | Azione |
|---|---|
| Click canvas | cattura mouse |
| WASD | movimento |
| Shift | corsa |
| Space | salto |
| Mouse | mira |
| Click sx | spara (tenuto = fuoco automatico) |
| 1 / 2 | Pistol / Rifle |
| R | ricarica |
| Esc | rilascia mouse |

## Limiti onesti
- Hitscan sui remoti e client-side (server rifiuta solo cooldown/target invalidi/distanza). Anti-cheat = 0.
- Collisioni sui muri sono raycast semplice, non sweep: a velocita alte puo passare attraverso spigoli.
- Nametag usano proiezione manuale con la matrix del CustomLayer — approssimativa ma leggibile.
- Nessun audio (nessun asset incluso). Aggiungibile con Howler + tre file wav.
