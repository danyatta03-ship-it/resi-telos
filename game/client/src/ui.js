import mapboxgl from "mapbox-gl";

// One-time HUD/UI wiring. Returns handles for the game loop to update.
export function setupUI({ onName, onCityPick, cities }) {
  const root = document.createElement("div");
  root.innerHTML = `
    <style>
      #menu { position:fixed; inset:0; z-index:20; background:linear-gradient(180deg,#0b1220 0%,#1a2a44 100%);
        display:flex; align-items:center; justify-content:center; font-family:system-ui,sans-serif; color:#fff; }
      #menu .card { background:rgba(0,0,0,.55); padding:24px 28px; border-radius:14px; min-width:320px; }
      #menu h1 { margin:0 0 4px; font-size:22px; } #menu .sub { color:#9db; margin-bottom:16px; font-size:13px; }
      #menu input, #menu select, #menu button { width:100%; padding:10px 12px; border-radius:8px; border:1px solid #345;
        background:#0b1220; color:#fff; font-size:14px; margin-top:8px; }
      #menu button { background:#3d8bfd; border:none; font-weight:600; cursor:pointer; margin-top:14px; }
      #vignette { position:fixed; inset:0; pointer-events:none; z-index:6; box-shadow: inset 0 0 200px 40px rgba(255,0,0,0); transition:box-shadow .12s; }
      #killfeed { position:fixed; top:8px; right:220px; z-index:7; font:12px/1.4 system-ui,sans-serif; color:#fff; text-align:right; text-shadow:0 1px 2px #000; }
      #killfeed div { background:rgba(0,0,0,.4); padding:3px 8px; border-radius:4px; margin-bottom:4px; display:inline-block; }
      #ammo { position:fixed; bottom:12px; right:16px; z-index:7; font:600 20px system-ui,sans-serif; color:#fff; background:rgba(0,0,0,.5); padding:6px 14px; border-radius:8px; }
      #weap { position:fixed; bottom:56px; right:16px; z-index:7; font:12px system-ui,sans-serif; color:#9db; text-align:right; }
      #minimap { position:fixed; bottom:12px; left:12px; width:180px; height:180px; z-index:7; border-radius:12px; overflow:hidden; border:2px solid rgba(255,255,255,.2); }
      #minimap canvas { pointer-events:none; }
      #death { position:fixed; inset:0; background:rgba(0,0,0,.55); color:#fff; z-index:15; display:none; align-items:center; justify-content:center; font:600 32px system-ui,sans-serif; pointer-events:none; }
      .nametag { color:#fff; font:12px system-ui,sans-serif; text-shadow:0 1px 2px #000; text-align:center; pointer-events:none; }
      .nametag .bar { width:60px; height:5px; background:rgba(255,255,255,.15); border-radius:3px; margin:2px auto 0; overflow:hidden; }
      .nametag .bar span { display:block; height:100%; background:#4ade80; }
    </style>
    <div id="menu"><div class="card">
      <h1>City Shooter</h1><div class="sub">FPS su citta reali</div>
      <label>Nome</label><input id="menuName" maxlength="16" value="player" />
      <label>Citta</label><select id="menuCity"></select>
      <button id="menuStart">Entra</button>
    </div></div>
    <div id="vignette"></div>
    <div id="killfeed"></div>
    <div id="weap">[1] Pistol  [2] Rifle  •  R ricarica</div>
    <div id="ammo">12 / 12</div>
    <div id="minimap"></div>
    <div id="death">SEI MORTO — respawn...</div>
  `;
  document.body.appendChild(root);

  const citySel = document.getElementById("menuCity");
  cities.forEach((c, i) => {
    const o = document.createElement("option"); o.value = String(i); o.textContent = c.name; citySel.appendChild(o);
  });
  document.getElementById("menuStart").onclick = () => {
    const name = document.getElementById("menuName").value.trim() || "player";
    const idx = parseInt(citySel.value, 10);
    onName(name); onCityPick(idx);
    document.getElementById("menu").style.display = "none";
  };

  // Minimap
  const minimap = new mapboxgl.Map({
    container: "minimap",
    style: "mapbox://styles/mapbox/dark-v11",
    center: [cities[0].lng, cities[0].lat], zoom: 15, interactive: false, attributionControl: false,
  });
  const meMarkerEl = document.createElement("div");
  meMarkerEl.style.cssText = "width:10px;height:10px;background:#4ade80;border:2px solid #fff;border-radius:50%;";
  const meMarker = new mapboxgl.Marker({ element: meMarkerEl }).setLngLat([cities[0].lng, cities[0].lat]).addTo(minimap);
  const remoteMarkers = new Map(); // id -> Marker

  function setMinimapCenter(lngLat, bearingDeg) {
    minimap.jumpTo({ center: [lngLat.lng, lngLat.lat], bearing: bearingDeg });
    meMarker.setLngLat([lngLat.lng, lngLat.lat]);
  }
  function updateRemoteMarker(id, lngLat) {
    let m = remoteMarkers.get(id);
    if (!m) {
      const el = document.createElement("div");
      el.style.cssText = "width:8px;height:8px;background:#f87171;border:1px solid #fff;border-radius:50%;";
      m = new mapboxgl.Marker({ element: el }).setLngLat([lngLat.lng, lngLat.lat]).addTo(minimap);
      remoteMarkers.set(id, m);
    } else m.setLngLat([lngLat.lng, lngLat.lat]);
  }
  function removeRemoteMarker(id) {
    remoteMarkers.get(id)?.remove(); remoteMarkers.delete(id);
  }

  // Damage vignette
  const vignette = document.getElementById("vignette");
  function flashDamage(strength = 1) {
    vignette.style.boxShadow = `inset 0 0 220px 60px rgba(255,0,0,${0.55 * strength})`;
    setTimeout(() => vignette.style.boxShadow = "inset 0 0 200px 40px rgba(255,0,0,0)", 120);
  }

  // Kill feed
  const feed = document.getElementById("killfeed");
  function addKill(by, target) {
    const el = document.createElement("div");
    el.textContent = `${by}  ->  ${target}`;
    feed.prepend(el);
    setTimeout(() => el.remove(), 4000);
  }

  // Nametag layer: positions absolute divs projected from world coords.
  const nametags = new Map(); // id -> element
  function ensureNametag(id, name) {
    let el = nametags.get(id);
    if (!el) {
      el = document.createElement("div");
      el.className = "nametag";
      el.innerHTML = `<div class="who">${name}</div><div class="bar"><span></span></div>`;
      el.style.cssText = "position:fixed; z-index:6; transform:translate(-50%,-100%);";
      document.body.appendChild(el);
      nametags.set(id, el);
    }
    return el;
  }
  function setNametag(id, name, screenX, screenY, hp, visible) {
    if (!visible) { const e = nametags.get(id); if (e) e.style.display = "none"; return; }
    const el = ensureNametag(id, name);
    el.style.display = "block";
    el.style.left = `${screenX}px`;
    el.style.top = `${screenY}px`;
    el.querySelector(".who").textContent = name;
    el.querySelector(".bar span").style.width = `${Math.max(0, hp)}%`;
  }
  function removeNametag(id) {
    const e = nametags.get(id); if (e) { e.remove(); nametags.delete(id); }
  }

  const death = document.getElementById("death");
  function showDeath(on) { death.style.display = on ? "flex" : "none"; }

  const ammoEl = document.getElementById("ammo");
  function setAmmo(a, m) { ammoEl.textContent = `${a} / ${m}`; }

  return {
    setMinimapCenter, updateRemoteMarker, removeRemoteMarker,
    flashDamage, addKill, setNametag, removeNametag, showDeath, setAmmo,
  };
}
