# City Shooter

Prototipo di FPS multiplayer browser-based (stile krunker.io) su citta reali. Mapbox GL rende la mappa + edifici 3D estrusi da OpenStreetMap; Three.js rendera nella stessa scena via CustomLayer; Colyseus gestisce il server autoritativo.

## Setup

```bash
cd game
npm install
npm run dev
```
Zero token, zero registrazione — usa MapLibre GL + tile gratuiti da OpenFreeMap.

Client su http://localhost:5173 • Server Colyseus su ws://localhost:2567.

## Feature

**Mappa & rendering**
- 8 citta selezionabili (Milano, NYC, Tokyo, Parigi, Londra, San Fran, Berlino, Roma)
- Edifici 3D reali estrusi da Mapbox `building` layer
- Three.js integrato via CustomLayer (share della projection matrix Mapbox)
- Illuminazione ambiente + sole + hemi light
- Sky lasciato a Mapbox

**Controller FPS**
- WASD + mouse look (pointer lock), corsa (Shift), salto (Space)
- Crouch toggle (C) con lerp altezza occhi
- ADS (right click): zoom, spread ridotto, sensibilita ridotta
- FOV kick su corsa e sparo
- Collisioni con muri (raycast a piu altezze contro mesh edifici)
- Cammina/salta sopra tetti (ground raycast)

**Armi & combattimento**
- 2 armi: Pistol (1) e Rifle (2) con RPM/damage/spread/recoil distinti
- Ricarica (R) con animazione + suono
- Fuoco automatico tenendo click
- Hitscan con occlusione edifici
- Granate (G): fisica ad arco, bounce, esplosione ad area con damage falloff, cooldown 3s
- HP regen server-side dopo 4s senza danni
- Pickup HP (+50) sparsi in mappa che rispawnano

**Networking (Colyseus)**
- Room autoritativa: cooldown per arma, damage table, pickup collection, esplosioni server-side
- Broadcast: `shot / hit / kill / respawn / grenade / explosion / pickup / pickupSpawn / chat / city`
- Ping heartbeat per RTT
- Rigenerazione HP autoritativa

**Audio (procedurale WebAudio, zero asset)**
- Sparo (variazioni pistol/rifle), hit, hitmarker, reload, jump, footstep, death, esplosione, pickup, streak jingle
- Volume falloff per distanza approssimato

**UI / HUD**
- Menu iniziale (nome + citta)
- Crosshair, HP, K/D, ammo, cooldown granata
- Viewmodel arma+braccia (bob, kick, animazione reload)
- Nametag + healthbar 3D proiettati sopra i remoti
- Killfeed
- Vignetta rossa quando colpito
- Hitmarker sul crosshair quando colpisci
- Announcer killstreak (DOUBLE / TRIPLE / RAMPAGE / UNSTOPPABLE / GODLIKE)
- Scoreboard su Tab (K/D/Streak/Ping)
- Chat su Enter (140 char, broadcast)
- Minimappa in basso-sx orientata al bearing, mostra te / nemici / pickup
- Schermata "SEI MORTO" + respawn timer

**Effetti visivi**
- Muzzle flash + point light
- Tracer proiettile
- Spark impatto
- Esplosione: fireball + shockwave ring + debris + point light

## Controlli

| Tasto | Azione |
|---|---|
| Click canvas | cattura mouse |
| WASD | movimento |
| Shift | corsa |
| Space | salto |
| C | accovacciati (toggle) |
| Click sx | spara (tenuto = auto) |
| Click dx | mira (ADS) |
| G | lancia granata |
| R | ricarica |
| 1 / 2 | Pistol / Rifle |
| M | cambia citta |
| Tab | classifica |
| Enter | chat |
| Esc | rilascia mouse / chiudi chat |

## Struttura

```
game/
  server/src/
    index.js     GameRoom: shoot/grenade/move/chat/city/ping, regen, respawn
    schema.js    GameState (Players, Pickups, city)
  client/src/
    main.js      init map, CustomLayer three, game loop, hitscan
    player.js    controller FPS (recoil, ADS, crouch, footstep events)
    world.js     BuildingsCache: ground/collide/raycast dagli edifici Mapbox
    weapons.js   WEAPONS table + Viewmodel (overlay scene)
    effects.js   tracer, spark, muzzle, explosion, grenade physics
    audio.js     SFX procedurale WebAudio
    ui.js        menu, HUD, minimap, nametag, hitmarker, killfeed, streak, scoreboard, chat
    net.js       colyseus.js client
```

## Limiti onesti
- Hitscan sui remoti lato client (server rifiuta cooldown/target/distanza). Zero anti-cheat.
- Collisioni sono raycast, non capsule sweep: a velocita alte puo capitare di attraversare spigoli.
- Nametag e minimappa aggiornano ogni frame — su citta molto dense (>50 remoti) va throttled.
- Nessun voice chat, nessun matchmaking multi-room, nessuna persistenza.
- Le esplosioni non testano occlusione degli edifici (line-of-sight): danno anche attraverso muri.
