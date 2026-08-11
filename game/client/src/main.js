import * as THREE from "three";
import mapboxgl from "mapbox-gl";
import { Player } from "./player.js";
import { BuildingsCache } from "./world.js";
import { connect } from "./net.js";
import { Viewmodel, WEAPONS } from "./weapons.js";
import { Effects } from "./effects.js";
import { setupUI } from "./ui.js";

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "ws://localhost:2567";
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
];
let cityIdx = 0;
let playerName = "player";

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/dark-v11",
  center: [CITIES[0].lng, CITIES[0].lat],
  zoom: 17, pitch: 75, bearing: 0, antialias: true,
});

const scene = new THREE.Scene();
scene.background = null;
scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.position.set(60, 120, 40); scene.add(sun);
const hemi = new THREE.HemisphereLight(0x88aaff, 0x223344, 0.4); scene.add(hemi);

const effects = new Effects(scene);

// UI
const ui = setupUI({
  cities: CITIES,
  onName: (n) => { playerName = n; },
  onCityPick: (i) => { cityIdx = i; switchCity(i); },
});

// Remote avatars
const remotes = new Map(); // sessionId -> { mesh, state }
function makeAvatar() {
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
  grp.add(body, head);
  scene.add(grp);
  return grp;
}

// Local player + input
const canvas = map.getCanvas();
const player = new Player(canvas);
let buildings;

// Weapons
let currentWeapon = "pistol";
const ammo = { pistol: WEAPONS.pistol.mag, rifle: WEAPONS.rifle.mag };
let lastShotAt = 0;
let reloadingUntil = 0;
let mouseDown = false;

// Custom Three renderer sharing Mapbox GL context
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
let myHp = 100;
(async () => {
  try {
    room = await connect(SERVER_URL, playerName);
    room.state.players.onAdd = (p, id) => {
      if (id === room.sessionId) return;
      remotes.set(id, { mesh: makeAvatar(), state: p, name: p.name });
    };
    room.state.players.onRemove = (_p, id) => {
      const r = remotes.get(id);
      if (r) { scene.remove(r.mesh); }
      ui.removeRemoteMarker(id);
      ui.removeNametag(id);
      remotes.delete(id);
    };
    room.onMessage("hit", ({ target, hp, by }) => {
      if (target === room.sessionId) {
        myHp = hp;
        document.getElementById("hp").textContent = hp;
        ui.flashDamage(1);
      }
    });
    room.onMessage("kill", ({ by, target }) => {
      const byName = room.state.players.get(by)?.name || by.slice(0, 4);
      const tgtName = room.state.players.get(target)?.name || target.slice(0, 4);
      ui.addKill(byName, tgtName);
      if (target === room.sessionId) ui.showDeath(true);
    });
    room.onMessage("respawn", ({ id }) => {
      if (id === room.sessionId) {
        player.pos.set(0, 1.7, 0); player.vel.set(0, 0, 0);
        myHp = 100;
        document.getElementById("hp").textContent = 100;
        ui.showDeath(false);
      }
    });
  } catch (e) {
    console.warn("Colyseus non raggiungibile — single-player.", e);
  }
})();

// Weapon input
window.addEventListener("keydown", (e) => {
  if (e.code === "Digit1") { currentWeapon = "pistol"; viewmodel?.setWeapon("pistol"); refreshAmmoHUD(); }
  if (e.code === "Digit2") { currentWeapon = "rifle";  viewmodel?.setWeapon("rifle");  refreshAmmoHUD(); }
  if (e.code === "KeyR") tryReload();
});
canvas.addEventListener("mousedown", (e) => { if (e.button === 0) mouseDown = true; });
canvas.addEventListener("mouseup",   (e) => { if (e.button === 0) mouseDown = false; });

function refreshAmmoHUD() { ui.setAmmo(ammo[currentWeapon], WEAPONS[currentWeapon].mag); }
function tryReload() {
  if (reloadingUntil > performance.now()) return;
  const w = WEAPONS[currentWeapon];
  if (ammo[currentWeapon] === w.mag) return;
  reloadingUntil = performance.now() + w.reload * 1000;
  viewmodel?.startReload(w.reload);
  setTimeout(() => { ammo[currentWeapon] = w.mag; refreshAmmoHUD(); }, w.reload * 1000);
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
  player.addRecoil(w.recoil);

  // Aim with spread
  const dir = player.lookDir().clone();
  dir.x += (Math.random() - 0.5) * w.spread;
  dir.y += (Math.random() - 0.5) * w.spread;
  dir.z += (Math.random() - 0.5) * w.spread;
  dir.normalize();
  const eye = player.pos.clone();

  // Hitscan against remotes (sphere-capsule approx: sphere around body center)
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
  // Building occlusion
  const bldHit = buildings?.raycast(eye, dir, bestT);
  if (bldHit && bldHit.distance < bestT) {
    bestT = bldHit.distance; bestId = null; bestPoint = bldHit.point;
  }
  const endPoint = bestPoint ?? eye.clone().addScaledVector(dir, w.range);
  effects.tracer(eye.clone().addScaledVector(dir, 0.6), endPoint);
  if (bestPoint) effects.spark(bestPoint, bestId ? 0xff5555 : 0xffcc55);

  if (bestId && room) room.send("shoot", { targetId: bestId, weapon: currentWeapon });
}

// Game loop
let last = performance.now();
function frame() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (buildings && player.locked) {
    player.update(
      dt,
      (x, z) => buildings.groundY(x, z),
      (pos, delta, radius) => buildings.collideMove(pos, delta, radius),
    );

    if (mouseDown) tryShoot(now);

    // Remotes
    if (room) {
      for (const [id, r] of remotes) {
        const s = r.state;
        r.mesh.position.set(s.x, s.y - 0.85, s.z);
        r.mesh.rotation.y = s.yaw;
        // Minimap marker
        const lngLat = localToLngLat(buildings.origin, s.x, s.z);
        ui.updateRemoteMarker(id, lngLat);
      }
      publishThrottled(now);
    }

    // First-person Mapbox camera
    const lngLat = localToLngLat(buildings.origin, player.pos.x, player.pos.z);
    const camOpts = new mapboxgl.FreeCameraOptions(
      mapboxgl.MercatorCoordinate.fromLngLat(lngLat, player.pos.y),
      undefined
    );
    const look = player.lookDir().clone().multiplyScalar(100).add(player.pos);
    const lookLngLat = localToLngLat(buildings.origin, look.x, look.z);
    camOpts.lookAtPoint(lookLngLat, look.y);
    map.setFreeCameraOptions(camOpts);
    // FOV kick applied to Mapbox transform
    map.transform.fov = 60 + player.fovKick + (player.running ? 5 : 0);

    // Minimap
    ui.setMinimapCenter(lngLat, THREE.MathUtils.radToDeg(-player.yaw));

    // Viewmodel state
    const moving = Math.abs(player.vel.x) + Math.abs(player.vel.z) > 0.1;
    viewmodel?.update(dt, moving, player.running);
  }
  effects.update(dt);

  // Project remote positions to screen for nametags
  if (buildings && room && customLayer.camera && renderer) {
    const w = renderer.domElement.clientWidth;
    const h = renderer.domElement.clientHeight;
    const projMat = customLayer.camera.projectionMatrix;
    const origin = buildings.origin;
    const merc = mapboxgl.MercatorCoordinate.fromLngLat({ lng: origin.lng, lat: origin.lat }, 0);
    const scale = merc.meterInMercatorCoordinateUnits();
    const localToClip = new THREE.Matrix4()
      .makeTranslation(merc.x, merc.y, merc.z)
      .scale(new THREE.Vector3(scale, -scale, scale))
      .multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
    // camera.projectionMatrix already includes localToClip; recompute worldPos * projection directly:
    const v = new THREE.Vector4();
    for (const [id, r] of remotes) {
      const s = r.state;
      v.set(s.x, s.y + 0.6, s.z, 1).applyMatrix4(projMat);
      if (v.w <= 0) { ui.setNametag(id, r.state.name, 0, 0, r.state.hp, false); continue; }
      const sx = ( v.x / v.w * 0.5 + 0.5) * w;
      const sy = (-v.y / v.w * 0.5 + 0.5) * h;
      const visible = v.z / v.w < 1 && sx > -50 && sx < w + 50 && sy > -50 && sy < h + 50;
      ui.setNametag(id, r.state.name, sx, sy, r.state.hp, visible);
    }
  }

  // HUD stats
  if (room) {
    const me = room.state.players.get(room.sessionId);
    if (me) {
      document.getElementById("kd").textContent = `${me.kills}/${me.deaths}`;
      document.getElementById("hp").textContent = me.hp;
    }
    const board = [...room.state.players.entries()]
      .sort((a, b) => b[1].kills - a[1].kills)
      .slice(0, 6)
      .map(([id, p]) => `${id === room.sessionId ? "* " : ""}${p.name} — ${p.kills}/${p.deaths}`)
      .join("<br>");
    document.getElementById("board").innerHTML = board;
  }

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
  });
}
