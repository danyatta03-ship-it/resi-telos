import * as THREE from "three";
import mapboxgl from "mapbox-gl";
import { Player } from "./player.js";
import { BuildingsCache } from "./world.js";
import { connect } from "./net.js";
import { Viewmodel, WEAPONS } from "./weapons.js";
import { Effects } from "./effects.js";
import { setupUI, KILLSTREAKS } from "./ui.js";
import { Sfx } from "./audio.js";

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const SERVER_URL = (typeof window !== "undefined" && window.__SERVER_URL__) || import.meta.env.VITE_SERVER_URL || "ws://localhost:2567";
if (!TOKEN) {
  document.body.innerHTML = "<h2 style='color:#fff;padding:20px;font-family:sans-serif'>Manca VITE_MAPBOX_TOKEN in client/.env</h2>";
  throw new Error("missing token");
}
mapboxgl.accessToken = TOKEN;

const CITIES = [
  { name: "Milano",    lng: 9.19,     lat: 45.4642 },
  { name: "New York",  lng: -74.0060, lat: 40.7128 },
  { name: "Tokyo",     lng: 139.6917, lat: 35.6895 },
  { name: "Parigi",    lng: 2.3522,   lat: 48.8566 },
  { name: "Londra",    lng: -0.1276,  lat: 51.5074 },
  { name: "San Fran",  lng: -122.42,  lat: 37.7749 },
  { name: "Berlino",   lng: 13.4050,  lat: 52.5200 },
  { name: "Roma",      lng: 12.4964,  lat: 41.9028 },
];
let cityIdx = 0;
let playerName = "player";

const sfx = new Sfx();

const map = new mapboxgl.Map({
  container: "map", style: "mapbox://styles/mapbox/dark-v11",
  center: [CITIES[0].lng, CITIES[0].lat], zoom: 17, pitch: 75, bearing: 0, antialias: true,
});

const scene = new THREE.Scene();
scene.background = null;
scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.position.set(60, 120, 40); scene.add(sun);
scene.add(new THREE.HemisphereLight(0x88aaff, 0x223344, 0.4));

const effects = new Effects(scene);

// UI
const ui = setupUI({
  cities: CITIES,
  onName: (n) => { playerName = n; },
  onCityPick: (i) => { cityIdx = i; switchCity(i); },
  onChat: (msg) => room?.send("chat", { msg }),
});

// Remotes
const remotes = new Map();
function makeAvatar(name) {
  const grp = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.4, 1.0, 4, 10),
    new THREE.MeshLambertMaterial({ color: 0xff4444 })
  );
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 12, 10),
    new THREE.MeshLambertMaterial({ color: 0xffd2a8 })
  );
  head.position.y = 0.95;
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.1, 0.4),
    new THREE.MeshLambertMaterial({ color: 0x222222 })
  );
  gun.position.set(0.3, 0.3, -0.15);
  grp.add(body, head, gun);
  grp.userData = { body, head, gun, bob: 0, lastPos: new THREE.Vector3(), name };
  scene.add(grp);
  return grp;
}

// Pickup visuals
const pickupMeshes = new Map();
function makePickup(id, x, z) {
  const grp = new THREE.Group();
  const box = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x22d3ee, emissive: 0x004466, emissiveIntensity: 0.5 })
  );
  const cross = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.55, 0.05),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  const cross2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.2, 0.05),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  cross.position.z = 0.26; cross2.position.z = 0.26;
  grp.add(box, cross, cross2);
  grp.position.set(x, 0.9, z);
  scene.add(grp);
  pickupMeshes.set(id, grp);
}
function updatePickupActive(id, active) {
  const m = pickupMeshes.get(id);
  if (m) m.visible = active;
}

// Local player
const canvas = map.getCanvas();
const player = new Player(canvas, (evt) => {
  if (evt === "jump") sfx.jump();
  else if (evt === "step") sfx.footstep();
});
let buildings;

// Weapons
let currentWeapon = "pistol";
const ammo = { pistol: WEAPONS.pistol.mag, rifle: WEAPONS.rifle.mag };
let lastShotAt = 0;
let reloadingUntil = 0;
let mouseDown = false;
let lastGrenadeAt = -Infinity;
const GRENADE_COOLDOWN = 3000;

let viewmodel = null;
let renderer = null;
const customLayer = {
  id: "three-world", type: "custom", renderingMode: "3d",
  onAdd(mapObj, gl) {
    renderer = new THREE.WebGLRenderer({ canvas: mapObj.getCanvas(), context: gl, antialias: true });
    renderer.autoClear = false;
    this.camera = new THREE.Camera();
    viewmodel = new Viewmodel(renderer);
  },
  render(gl, matrix) {
    if (!buildings) return;
    const origin = buildings.origin;
    const merc = mapboxgl.MercatorCoordinate.fromLngLat({ lng: origin.lng, lat: origin.lat }, 0);
    const scale = merc.meterInMercatorCoordinateUnits();
    const m = new THREE.Matrix4()
      .makeTranslation(merc.x, merc.y, merc.z)
      .scale(new THREE.Vector3(scale, -scale, scale))
      .multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
    this.camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix).multiply(m);
    renderer.resetState();
    renderer.render(scene, this.camera);
    viewmodel?.render();
    map.triggerRepaint();
  },
};

map.on("style.load", () => {
  const layers = map.getStyle().layers;
  const firstSymbol = layers.find(l => l.type === "symbol")?.id;
  if (!map.getLayer("3d-buildings")) {
    map.addLayer({
      id: "3d-buildings", source: "composite", "source-layer": "building",
      filter: ["==", "extrude", "true"], type: "fill-extrusion", minzoom: 15,
      paint: {
        "fill-extrusion-color": ["interpolate", ["linear"], ["get", "height"], 0, "#6a7180", 60, "#9aa4b2"],
        "fill-extrusion-height": ["get", "height"],
        "fill-extrusion-base": ["get", "min_height"],
        "fill-extrusion-opacity": 0.95,
      },
    }, firstSymbol);
  }
  buildings = new BuildingsCache(map, map.getCenter());
  if (!map.getLayer("three-world")) map.addLayer(customLayer);
});

function switchCity(i) {
  const c = CITIES[i];
  map.jumpTo({ center: [c.lng, c.lat], zoom: 17 });
  buildings?.setOrigin(new mapboxgl.LngLat(c.lng, c.lat));
  player.pos.set(0, 1.7, 0); player.vel.set(0, 0, 0);
  room?.send("setCity", { lng: c.lng, lat: c.lat });
}

// Colyseus
let room;
const pings = new Map();
(async () => {
  try {
    room = await connect(SERVER_URL, playerName);
    room.state.players.onAdd = (p, id) => {
      if (id === room.sessionId) return;
      remotes.set(id, { mesh: makeAvatar(p.name), state: p });
    };
    room.state.players.onRemove = (_p, id) => {
      const r = remotes.get(id);
      if (r) scene.remove(r.mesh);
      ui.removeRemoteMarker(id);
      ui.removeNametag(id);
      remotes.delete(id);
    };
    room.state.pickups.onAdd = (pk, id) => {
      makePickup(id, pk.x, pk.z);
    };
    room.state.pickups.onChange = () => {};
    room.onMessage("hit", ({ target, hp, by, weapon }) => {
      if (target === room.sessionId) {
        document.getElementById("hp").textContent = Math.round(hp);
        ui.flashDamage(1);
        sfx.hit(0);
      }
      if (by === room.sessionId && target !== room.sessionId) {
        ui.showHitmarker();
        sfx.hitmarker();
      }
      // Play hit sound for nearby players (best effort by distance from local)
      const t = room.state.players.get(target);
      if (t && target !== room.sessionId) {
        const d = Math.hypot(t.x - player.pos.x, t.z - player.pos.z);
        if (d < 40) sfx.hit(d);
      }
    });
    room.onMessage("shot", ({ by, weapon, x, y, z }) => {
      if (by === room.sessionId) return;
      const d = Math.hypot(x - player.pos.x, y - player.pos.y, z - player.pos.z);
      sfx.shot(d, weapon);
    });
    room.onMessage("kill", ({ by, target, weapon, streak }) => {
      const byName = room.state.players.get(by)?.name || by.slice(0, 4);
      const tgtName = room.state.players.get(target)?.name || target.slice(0, 4);
      ui.addKill(byName, tgtName, weapon);
      if (target === room.sessionId) { ui.showDeath(true); sfx.death(); }
      if (by === room.sessionId && streak >= 2) {
        ui.showStreak(KILLSTREAKS[streak] || `${streak}x STREAK`);
        sfx.streak(streak);
      }
    });
    room.onMessage("respawn", ({ id }) => {
      if (id === room.sessionId) {
        player.pos.set(0, 1.7, 0); player.vel.set(0, 0, 0);
        document.getElementById("hp").textContent = 100;
        ui.showDeath(false);
        for (const k of Object.keys(ammo)) ammo[k] = WEAPONS[k].mag;
        refreshAmmoHUD();
      }
    });
    room.onMessage("grenade", ({ id, by, x, y, z, vx, vy, vz }) => {
      effects.spawnGrenade(id, new THREE.Vector3(x, y, z), new THREE.Vector3(vx, vy, vz));
    });
    room.onMessage("explosion", ({ id, x, y, z }) => {
      effects.removeGrenade(id);
      effects.explosion(new THREE.Vector3(x, y, z));
      const d = Math.hypot(x - player.pos.x, y - player.pos.y, z - player.pos.z);
      sfx.explosion(d);
    });
    room.onMessage("pickup", ({ id, by, kind }) => {
      updatePickupActive(id, false);
      if (by === room.sessionId && kind === "hp") sfx.pickup();
    });
    room.onMessage("pickupSpawn", ({ id, x, z }) => {
      let m = pickupMeshes.get(id);
      if (!m) { makePickup(id, x, z); m = pickupMeshes.get(id); }
      m.position.set(x, 0.9, z);
      updatePickupActive(id, true);
    });
    room.onMessage("chat", ({ from, msg }) => ui.appendChat(from, msg));

    // Ping heartbeat
    setInterval(() => {
      if (!room) return;
      const t = performance.now();
      room.send("ping", { t });
    }, 2000);
    room.onMessage("pong", ({ t }) => {
      const rtt = performance.now() - t;
      pings.set(room.sessionId, Math.round(rtt));
    });
  } catch (e) {
    console.warn("Colyseus non raggiungibile — single-player.", e);
  }
})();

// Weapon + grenade + scoreboard + chat input
window.addEventListener("keydown", (e) => {
  if (ui.isChatOpen()) return;
  if (e.code === "Digit1") { currentWeapon = "pistol"; viewmodel?.setWeapon("pistol"); refreshAmmoHUD(); }
  if (e.code === "Digit2") { currentWeapon = "rifle";  viewmodel?.setWeapon("rifle");  refreshAmmoHUD(); }
  if (e.code === "KeyR") tryReload();
  if (e.code === "KeyG") throwGrenade();
  if (e.code === "KeyM") { cityIdx = (cityIdx + 1) % CITIES.length; switchCity(cityIdx); }
  if (e.code === "Tab") { e.preventDefault(); ui.toggleScoreboard(true); }
  if (e.code === "Enter" && !ui.isChatOpen()) { e.preventDefault(); ui.openChat(); }
});
window.addEventListener("keyup", (e) => {
  if (e.code === "Tab") { e.preventDefault(); ui.toggleScoreboard(false); }
});
canvas.addEventListener("mousedown", (e) => {
  if (e.button === 0) mouseDown = true;
  if (e.button === 2) player.setAds(true);
});
canvas.addEventListener("mouseup", (e) => {
  if (e.button === 0) mouseDown = false;
  if (e.button === 2) player.setAds(false);
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());

function refreshAmmoHUD() { ui.setAmmo(ammo[currentWeapon], WEAPONS[currentWeapon].mag); }
function tryReload() {
  const now = performance.now();
  if (reloadingUntil > now) return;
  const w = WEAPONS[currentWeapon];
  if (ammo[currentWeapon] === w.mag) return;
  reloadingUntil = now + w.reload * 1000;
  viewmodel?.startReload(w.reload);
  sfx.reload();
  ui.setReloading(true);
  setTimeout(() => { ammo[currentWeapon] = w.mag; refreshAmmoHUD(); ui.setReloading(false); }, w.reload * 1000);
}

function throwGrenade() {
  const now = performance.now();
  if (now - lastGrenadeAt < GRENADE_COOLDOWN) return;
  if (!room) return;
  lastGrenadeAt = now;
  const dir = player.lookDir().clone();
  const throwSpeed = 18;
  const v = dir.multiplyScalar(throwSpeed);
  v.y += 3; // upward arc
  room.send("grenade", { vx: v.x, vy: v.y, vz: v.z });
}

function tryShoot(now) {
  if (!player.locked) return;
  const w = WEAPONS[currentWeapon];
  const gap = 60000 / w.rpm;
  if (now - lastShotAt < gap) return;
  if (reloadingUntil > now) return;
  if (ammo[currentWeapon] <= 0) { tryReload(); return; }
  lastShotAt = now;
  ammo[currentWeapon] -= 1;
  refreshAmmoHUD();
  viewmodel?.shoot();
  const spreadScale = player.ads ? 0.35 : 1.0;
  player.addRecoil(w.recoil * (player.ads ? 0.6 : 1));
  sfx.shot(0, currentWeapon);

  const dir = player.lookDir().clone();
  dir.x += (Math.random() - 0.5) * w.spread * spreadScale;
  dir.y += (Math.random() - 0.5) * w.spread * spreadScale;
  dir.z += (Math.random() - 0.5) * w.spread * spreadScale;
  dir.normalize();
  const eye = player.pos.clone();

  let bestT = w.range, bestId = null, bestPoint = null;
  const tmp = new THREE.Vector3();
  const R = 0.55;
  for (const [id, r] of remotes) {
    const s = r.state;
    const c = tmp.set(s.x, s.y - 0.4, s.z);
    const oc = c.clone().sub(eye);
    const t = oc.dot(dir);
    if (t < 0 || t > bestT) continue;
    const perpSq = oc.lengthSq() - t * t;
    if (perpSq > R * R) continue;
    bestT = t; bestId = id;
    bestPoint = eye.clone().addScaledVector(dir, t);
  }
  const bldHit = buildings?.raycast(eye, dir, bestT);
  if (bldHit && bldHit.distance < bestT) {
    bestT = bldHit.distance; bestId = null; bestPoint = bldHit.point;
  }
  const endPoint = bestPoint ?? eye.clone().addScaledVector(dir, w.range);
  effects.tracer(eye.clone().addScaledVector(dir, 0.6), endPoint);
  if (bestPoint) effects.spark(bestPoint, bestId ? 0xff5555 : 0xffcc55);

  if (bestId && room) room.send("shoot", { targetId: bestId, weapon: currentWeapon });
}

let last = performance.now();
function frame() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (buildings && player.locked && !ui.isChatOpen()) {
    player.update(dt,
      (x, z) => buildings.groundY(x, z),
      (pos, delta, radius) => buildings.collideMove(pos, delta, radius));
    if (mouseDown) tryShoot(now);
  }

  // Remotes animation
  if (room && buildings) {
    for (const [id, r] of remotes) {
      const s = r.state;
      const u = r.mesh.userData;
      const moved = Math.hypot(s.x - u.lastPos.x, s.z - u.lastPos.z);
      u.bob += dt * (moved > 0.02 ? 10 : 0);
      const bobY = Math.sin(u.bob) * 0.08 * (moved > 0.02 ? 1 : 0);
      r.mesh.position.set(s.x, s.y - 0.85 + bobY - (s.crouch ? 0.35 : 0), s.z);
      r.mesh.rotation.y = s.yaw;
      u.head.rotation.x = -s.pitch * 0.7;
      u.lastPos.set(s.x, s.y, s.z);
      // Minimap
      const lngLat = localToLngLat(buildings.origin, s.x, s.z);
      ui.updateRemoteMarker(id, lngLat);
    }
    // Pickups spin + minimap
    for (const [id, m] of pickupMeshes) {
      m.rotation.y += dt * 2;
      m.position.y = 0.9 + Math.sin(now * 0.003 + m.position.x) * 0.1;
      const lngLat = localToLngLat(buildings.origin, m.position.x, m.position.z);
      ui.updatePickupMarker(id, lngLat, m.visible);
    }
    publishThrottled(now);
  }

  if (buildings && player.locked) {
    const lngLat = localToLngLat(buildings.origin, player.pos.x, player.pos.z);
    const camOpts = new mapboxgl.FreeCameraOptions(
      mapboxgl.MercatorCoordinate.fromLngLat(lngLat, player.pos.y),
      undefined
    );
    const look = player.lookDir().clone().multiplyScalar(100).add(player.pos);
    const lookLngLat = localToLngLat(buildings.origin, look.x, look.z);
    camOpts.lookAtPoint(lookLngLat, look.y);
    map.setFreeCameraOptions(camOpts);
    const baseFov = player.ads ? 40 : 60;
    map.transform.fov = baseFov + player.fovKick + (player.running ? 5 : 0);
    ui.setMinimapCenter(lngLat, THREE.MathUtils.radToDeg(-player.yaw));
    const moving = Math.abs(player.vel.x) + Math.abs(player.vel.z) > 0.1;
    viewmodel?.update(dt, moving, player.running);
  }

  effects.update(dt, (x, z) => buildings ? buildings.groundY(x, z) : 0);

  // Nametags
  if (buildings && room && customLayer.camera && renderer) {
    const w = renderer.domElement.clientWidth;
    const h = renderer.domElement.clientHeight;
    const projMat = customLayer.camera.projectionMatrix;
    const v = new THREE.Vector4();
    for (const [id, r] of remotes) {
      const s = r.state;
      v.set(s.x, s.y + 0.6, s.z, 1).applyMatrix4(projMat);
      if (v.w <= 0) { ui.setNametag(id, s.name, 0, 0, s.hp, false); continue; }
      const sx = ( v.x / v.w * 0.5 + 0.5) * w;
      const sy = (-v.y / v.w * 0.5 + 0.5) * h;
      const visible = v.z / v.w < 1 && sx > -50 && sx < w + 50 && sy > -50 && sy < h + 50;
      ui.setNametag(id, s.name, sx, sy, s.hp, visible);
    }
  }

  // HUD
  if (room) {
    const me = room.state.players.get(room.sessionId);
    if (me) {
      document.getElementById("kd").textContent = `${me.kills}/${me.deaths}`;
      document.getElementById("hp").textContent = Math.round(me.hp);
    }
    const rows = [...room.state.players.entries()]
      .sort((a, b) => b[1].kills - a[1].kills)
      .map(([id, p]) => ({ id, name: p.name, kills: p.kills, deaths: p.deaths, streak: p.streak, ping: pings.get(id) }));
    ui.setScoreboard(rows, room.sessionId);
    const board = rows.slice(0, 6)
      .map(r => `${r.id === room.sessionId ? "* " : ""}${r.name} ${r.kills}/${r.deaths}`)
      .join("<br>");
    document.getElementById("board").innerHTML = board;
  }

  // Grenade cooldown display
  const cd = Math.max(0, (GRENADE_COOLDOWN - (now - lastGrenadeAt)) / 1000);
  ui.setGrenadeCooldown(cd);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
refreshAmmoHUD();

function localToLngLat(origin, x, z) {
  const R = 6378137;
  const lat = origin.lat + (-z / R) * 180 / Math.PI;
  const lng = origin.lng + (x / (R * Math.cos(origin.lat * Math.PI / 180))) * 180 / Math.PI;
  return { lng, lat };
}

let lastSend = 0;
function publishThrottled(now) {
  if (now - lastSend < 50) return;
  lastSend = now;
  room.send("move", {
    x: player.pos.x, y: player.pos.y, z: player.pos.z,
    yaw: player.yaw, pitch: player.pitch,
    crouch: player.crouching ? 1 : 0,
  });
}
