import mapboxgl from "mapbox-gl";

export function setupUI({ onName, onCityPick, cities, onChat }) {
  const root = document.createElement("div");
  root.innerHTML = `
    <style>
      #menu { position:fixed; inset:0; z-index:20; background:linear-gradient(180deg,#0b1220 0%,#1a2a44 100%);
        display:flex; align-items:center; justify-content:center; font-family:system-ui,sans-serif; color:#fff; }
      #menu .card { background:rgba(0,0,0,.55); padding:24px 28px; border-radius:14px; min-width:340px; }
      #menu h1 { margin:0 0 4px; font-size:22px; } #menu .sub { color:#9db; margin-bottom:16px; font-size:13px; }
      #menu input, #menu select, #menu button { width:100%; padding:10px 12px; border-radius:8px; border:1px solid #345;
        background:#0b1220; color:#fff; font-size:14px; margin-top:8px; }
      #menu button { background:#3d8bfd; border:none; font-weight:600; cursor:pointer; margin-top:14px; }
      #menu .keys { font-size:11px; color:#7c93a5; margin-top:14px; line-height:1.5; }
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
      .nametag .bar span { display:block; height:100%; background:#4ade80; transition:width .15s; }
      #hitmarker { position:absolute; top:50%; left:50%; width:20px; height:20px; margin:-10px 0 0 -10px;
        opacity:0; transition:opacity .1s; pointer-events:none; z-index:8;
        background:
          linear-gradient(45deg, transparent 45%, #fff 45% 55%, transparent 55%),
          linear-gradient(-45deg, transparent 45%, #fff 45% 55%, transparent 55%);
      }
      #streak { position:fixed; top:120px; left:50%; transform:translateX(-50%); z-index:7;
        font:800 26px system-ui,sans-serif; color:#ffdd66; text-shadow:0 2px 6px #000, 0 0 20px rgba(255,180,0,.5);
        opacity:0; transition:opacity .2s, transform .2s; pointer-events:none; }
      #scoreboard { position:fixed; inset:8% 20%; background:rgba(0,10,20,.85); border-radius:12px; z-index:12;
        display:none; color:#fff; font:14px system-ui,sans-serif; padding:20px; overflow:auto; }
      #scoreboard h2 { margin:0 0 12px; } #scoreboard table { width:100%; border-collapse:collapse; }
      #scoreboard td, #scoreboard th { padding:6px 10px; text-align:left; border-bottom:1px solid #234; }
      #scoreboard tr.me { background:rgba(80,140,255,.15); }
      #chatlog { position:fixed; bottom:210px; left:12px; width:340px; max-height:180px; overflow:hidden; z-index:7;
        font:12px system-ui,sans-serif; color:#fff; text-shadow:0 1px 2px #000; pointer-events:none; }
      #chatlog div { background:rgba(0,0,0,.4); padding:2px 6px; margin-top:2px; border-radius:4px; display:inline-block; }
      #chatinput { position:fixed; bottom:210px; left:12px; width:340px; z-index:11; padding:6px 10px; font:13px system-ui,sans-serif;
        background:rgba(0,0,0,.7); color:#fff; border:1px solid #345; border-radius:6px; display:none; }
      #reloading { position:absolute; top:56%; left:50%; transform:translateX(-50%); color:#fff; font:600 14px system-ui,sans-serif;
        opacity:0; z-index:7; text-shadow:0 1px 2px #000; }
      #grenadeCd { position:fixed; bottom:12px; right:130px; z-index:7; background:rgba(0,0,0,.5); color:#fff; padding:6px 10px; border-radius:8px; font:12px system-ui,sans-serif; }
    </style>
    <div id="menu"><div class="card">
      <h1>City Shooter</h1><div class="sub">FPS su citta reali</div>
      <label>Nome</label><input id="menuName" maxlength="16" value="player" />
      <label>Citta</label><select id="menuCity"></select>
      <button id="menuStart">Entra</button>
      <div class="keys">WASD muovi • Shift corri • Space salta • C accovacciati • R ricarica<br>
        Click sx spara • Click dx mira (ADS) • G granata • 1/2 armi<br>
        Tab classifica • Enter chat • M cambia citta • Esc rilascia mouse</div>
    </div></div>
    <div id="vignette"></div>
    <div id="hitmarker"></div>
    <div id="reloading">RICARICA...</div>
    <div id="streak"></div>
    <div id="killfeed"></div>
    <div id="chatlog"></div>
    <input id="chatinput" maxlength="140" placeholder="msg... (Enter invia, Esc annulla)" />
    <div id="weap">[1] Pistol  [2] Rifle  •  R ricarica</div>
    <div id="ammo">12 / 12</div>
    <div id="grenadeCd">G 0.0s</div>
    <div id="minimap"></div>
    <div id="death">SEI MORTO — respawn...</div>
    <div id="scoreboard"><h2>Classifica</h2><table id="scoreTable"></table></div>
  `;
  document.body.appendChild(root);

  const citySel = document.getElementById("menuCity");
  cities.forEach((c, i) => { const o = document.createElement("option"); o.value = String(i); o.textContent = c.name; citySel.appendChild(o); });
  document.getElementById("menuStart").onclick = () => {
    const name = document.getElementById("menuName").value.trim() || "player";
    const idx = parseInt(citySel.value, 10);
    onName(name); onCityPick(idx);
    document.getElementById("menu").style.display = "none";
  };

  const minimap = new mapboxgl.Map({
    container: "minimap", style: "mapbox://styles/mapbox/dark-v11",
    center: [cities[0].lng, cities[0].lat], zoom: 15.5, interactive: false, attributionControl: false,
  });
  const meMarkerEl = document.createElement("div");
  meMarkerEl.style.cssText = "width:10px;height:10px;background:#4ade80;border:2px solid #fff;border-radius:50%;";
  const meMarker = new mapboxgl.Marker({ element: meMarkerEl }).setLngLat([cities[0].lng, cities[0].lat]).addTo(minimap);
  const remoteMarkers = new Map();
  const pickupMarkers = new Map();

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
  function removeRemoteMarker(id) { remoteMarkers.get(id)?.remove(); remoteMarkers.delete(id); }
  function updatePickupMarker(id, lngLat, active) {
    let m = pickupMarkers.get(id);
    if (!m) {
      const el = document.createElement("div");
      el.style.cssText = "width:7px;height:7px;background:#22d3ee;border-radius:50%;border:1px solid #fff;";
      m = new mapboxgl.Marker({ element: el }).setLngLat([lngLat.lng, lngLat.lat]).addTo(minimap);
      pickupMarkers.set(id, m);
    } else m.setLngLat([lngLat.lng, lngLat.lat]);
    m.getElement().style.opacity = active ? "1" : "0.2";
  }

  const vignette = document.getElementById("vignette");
  function flashDamage(strength = 1) {
    vignette.style.boxShadow = `inset 0 0 220px 60px rgba(255,0,0,${0.55 * strength})`;
    setTimeout(() => vignette.style.boxShadow = "inset 0 0 200px 40px rgba(255,0,0,0)", 120);
  }

  const feed = document.getElementById("killfeed");
  function addKill(by, target, weapon = "") {
    const el = document.createElement("div");
    el.textContent = `${by}  ${weapon === "grenade" ? "*" : "->"}  ${target}`;
    feed.prepend(el);
    setTimeout(() => el.remove(), 4000);
  }

  const hitmarker = document.getElementById("hitmarker");
  function showHitmarker() {
    hitmarker.style.opacity = "1";
    clearTimeout(hitmarker._t);
    hitmarker._t = setTimeout(() => hitmarker.style.opacity = "0", 120);
  }

  const streak = document.getElementById("streak");
  function showStreak(text) {
    streak.textContent = text;
    streak.style.opacity = "1";
    streak.style.transform = "translateX(-50%) scale(1.1)";
    clearTimeout(streak._t);
    streak._t = setTimeout(() => { streak.style.opacity = "0"; streak.style.transform = "translateX(-50%) scale(1)"; }, 1400);
  }

  const nametags = new Map();
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
  function removeNametag(id) { const e = nametags.get(id); if (e) { e.remove(); nametags.delete(id); } }

  const death = document.getElementById("death");
  function showDeath(on) { death.style.display = on ? "flex" : "none"; }

  const ammoEl = document.getElementById("ammo");
  function setAmmo(a, m) { ammoEl.textContent = `${a} / ${m}`; }

  const reloadingEl = document.getElementById("reloading");
  function setReloading(on) { reloadingEl.style.opacity = on ? "1" : "0"; }

  const grenadeCdEl = document.getElementById("grenadeCd");
  function setGrenadeCooldown(s) { grenadeCdEl.textContent = `G ${s.toFixed(1)}s`; grenadeCdEl.style.color = s <= 0 ? "#4ade80" : "#fff"; }

  // Scoreboard (Tab hold)
  const scoreboard = document.getElementById("scoreboard");
  const scoreTable = document.getElementById("scoreTable");
  function setScoreboard(rows, myId) {
    scoreTable.innerHTML =
      `<tr><th>#</th><th>Nome</th><th>K</th><th>D</th><th>Streak</th><th>Ping</th></tr>` +
      rows.map((r, i) =>
        `<tr class="${r.id === myId ? "me" : ""}"><td>${i + 1}</td><td>${r.name}</td><td>${r.kills}</td><td>${r.deaths}</td><td>${r.streak || 0}</td><td>${r.ping || "-"}</td></tr>`
      ).join("");
  }
  function toggleScoreboard(on) { scoreboard.style.display = on ? "block" : "none"; }

  // Chat
  const chatlog = document.getElementById("chatlog");
  const chatinput = document.getElementById("chatinput");
  function appendChat(from, msg) {
    const el = document.createElement("div");
    el.innerHTML = `<b>${from}:</b> ${msg}`;
    chatlog.appendChild(el);
    while (chatlog.childElementCount > 6) chatlog.firstChild.remove();
    setTimeout(() => el.remove(), 8000);
  }
  let chatOpen = false;
  function openChat() {
    chatOpen = true;
    chatinput.style.display = "block";
    chatinput.value = "";
    chatinput.focus();
    document.exitPointerLock?.();
  }
  function closeChat() { chatOpen = false; chatinput.style.display = "none"; chatinput.blur(); }
  chatinput.addEventListener("keydown", (e) => {
    if (e.code === "Enter") { const v = chatinput.value.trim(); if (v) onChat?.(v); closeChat(); e.stopPropagation(); }
    else if (e.code === "Escape") { closeChat(); e.stopPropagation(); }
  });
  function isChatOpen() { return chatOpen; }

  return {
    setMinimapCenter, updateRemoteMarker, removeRemoteMarker, updatePickupMarker,
    flashDamage, addKill, setNametag, removeNametag, showDeath, setAmmo, setReloading,
    setGrenadeCooldown, showHitmarker, showStreak, setScoreboard, toggleScoreboard,
    appendChat, openChat, closeChat, isChatOpen,
  };
}

export const KILLSTREAKS = {
  2: "DOUBLE KILL",
  3: "TRIPLE KILL",
  4: "RAMPAGE",
  5: "UNSTOPPABLE",
  7: "GODLIKE",
};
