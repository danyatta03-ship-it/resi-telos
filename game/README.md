# City Shooter

Prototipo di FPS browser-based (stile krunker.io) ambientato in citta reali via Mapbox GL + edifici 3D di OpenStreetMap. Rendering Three.js integrato nella stessa scena Mapbox tramite CustomLayer. Multiplayer autoritativo con Colyseus.

## Setup

```bash
cd game
npm install
cp client/.env.example client/.env
# metti dentro il tuo VITE_MAPBOX_TOKEN (gratis su mapbox.com)
npm run dev
```

Client: http://localhost:5173  •  Server Colyseus: ws://localhost:2567

## Controlli
- **Click** sul canvas per catturare il mouse
- **WASD** muovi, **Space** salta, **Shift** corri
- **Mouse** guarda, **Click sx** spara (hitscan)
- **Esc** rilascia mouse
- **M** cambia citta (Milano / New York / Tokyo)

## Architettura

```
client/  Vite + Three.js + Mapbox GL + colyseus.js
  src/
    main.js         bootstrap, Mapbox map + CustomLayer three
    player.js       controller FPS (pointer lock + WASD + physics naive)
    net.js          client Colyseus, invia inputs, riceve snapshot
    world.js        raycast contro edifici estrusi
server/  Node + colyseus
  src/
    index.js        server + GameRoom
    schema.js       Player state (@colyseus/schema)
```

Il server e autoritativo su HP e hit; le posizioni sono client-side prediction con relay (semplice per un prototipo — validation stub gia predisposta in `GameRoom.onMessage("move")`).

## Note
- Gli edifici sono estrusi dai tile `composite` di Mapbox (layer `building`). Sono poligoni, quindi il raycast contro di essi e approssimato costruendo una mesh Three.js dalle features visibili attorno al player (`world.js`).
- Per production serve un tile provider proprio o un piano Mapbox.
