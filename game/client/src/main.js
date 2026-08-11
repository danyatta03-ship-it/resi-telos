import * as THREE from "three";
import mapboxgl from "mapbox-gl";
import { Player } from "./player.js";
import { BuildingsCache } from "./world.js";
import { connect } from "./net.js";

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "ws://localhost:2567";
if (!TOKEN) {
  document.body.innerHTML = "<h2 style='color:#fff;padding:20px;font-family:sans-serif'>Manca VITE_MAPBOX_TOKEN nel file client/.env</h2>";
  throw new Error("missing token");
}
mapboxgl.accessToken = TOKEN;

const CITIES = [
  { name: "Milano",   lng: 9.19,     lat: 45.4642 },
  { name: "New York", lng: -74.0060, lat: 40.7128 },
  { name: "Tokyo",    lng: 139.6917, lat: 35.6895 },
];
let cityIdx = 0;

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/dark-v11",
  center: [CITIES[0].lng, CITIES[0].lat],
  zoom: 17, pitch: 75, bearing: 0, antialias: true,
});

const scene = new THREE.Scene();
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(50, 100, 30); scene.add(sun);

// Remote player avatars
const remotes = new Map(); // sessionId -> { mesh, state }
function makeAvatar(color = 0xff5555) {
  const g = new THREE.CapsuleGeometry(0.4, 1.0, 4, 8);
  const m = new THREE.MeshLambertMaterial({ color });
  const mesh = new THREE.Mesh(g, m);
  scene.add(mesh);
  return mesh;
}

// Local player + input
const canvas = map.getCanvas();
const player = new Player(canvas);
let buildings;

map.on("style.load", () => {
  // Add extruded 3D buildings so the world you see matches the world you raycast.
  const layers = map.getStyle().layers;
  const firstSymbol = layers.find(l => l.type === "symbol")?.id;
  map.addLayer({
    id: "3d-buildings", source: "composite", "source-layer": "building",
    filter: ["==", "extrude", "true"], type: "fill-extrusion", minzoom: 15,
    paint: {
      "fill-extrusion-color": "#8a8f98",
      "fill-extrusion-height": ["get", "height"],
      "fill-extrusion-base": ["get", "min_height"],
      "fill-extrusion-opacity": 0.9,
    },
  }, firstSymbol);

  buildings = new BuildingsCache(map, map.getCenter());
});

// Colyseus
let room;
(async () => {
  try {
    room = await connect(SERVER_URL);
    room.state.players.onAdd = (p, id) => {
      if (id === room.sessionId) return;
      const rem = { mesh: makeAvatar(0xff4444), state: p };
      remotes.set(id, rem);
      p.onChange = () => {}; // schema v2: property proxies used in render loop
    };
    room.state.players.onRemove = (_p, id) => {
      const r = remotes.get(id);
      if (r) { scene.remove(r.mesh); r.mesh.geometry.dispose(); }
      remotes.delete(id);
    };
    room.onMessage("hit", ({ target, hp }) => {
      if (target === room.sessionId) document.getElementById("hp").textContent = hp;
    });
    room.onMessage("respawn", ({ id }) => {
      if (id === room.sessionId) {
        player.pos.set(0, 1.7, 0);
        document.getElementById("hp").textContent = 100;
      }
    });
  } catch (e) {
    console.warn("Colyseus non raggiungibile — modalita single-player.", e);
  }
})();

// City switch
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyM") {
    cityIdx = (cityIdx + 1) % CITIES.length;
    const c = CITIES[cityIdx];
    map.jumpTo({ center: [c.lng, c.lat], zoom: 17 });
    buildings?.setOrigin(new mapboxgl.LngLat(c.lng, c.lat));
    player.pos.set(0, 1.7, 0); player.vel.set(0, 0, 0);
    room?.send("setCity", { lng: c.lng, lat: c.lat });
  }
});

// Shooting: pick nearest remote in a small cone around look direction.
canvas.addEventListener("mousedown", (e) => {
  if (!player.locked || e.button !== 0 || !room) return;
  const look = player.lookDir();
  const eye = player.pos;
  let bestId = null, bestScore = 0.985; // ~10 deg cone
  const tmp = new THREE.Vector3();
  for (const [id, r] of remotes) {
    tmp.copy(r.mesh.position).sub(eye);
    const dist = tmp.length();
    if (dist < 0.1 || dist > 300) continue;
    tmp.normalize();
    const dot = tmp.dot(look);
    if (dot > bestScore) { bestScore = dot; bestId = id; }
  }
  if (bestId) room.send("shoot", { targetId: bestId });
});

// Custom layer wires Mapbox's camera matrix into Three.js
const customLayer = {
  id: "three-world", type: "custom", renderingMode: "3d",
  onAdd(mapObj, gl) {
    this.renderer = new THREE.WebGLRenderer({
      canvas: mapObj.getCanvas(), context: gl, antialias: true,
    });
    this.renderer.autoClear = false;
    this.camera = new THREE.Camera();
  },
  render(gl, matrix) {
    // Convert local meters (relative to buildings.origin) into Mercator, then
    // multiply Mapbox's projection matrix by our local-to-mercator transform.
    if (!buildings) return;
    const origin = buildings.origin;
    const merc = mapboxgl.MercatorCoordinate.fromLngLat({ lng: origin.lng, lat: origin.lat }, 0);
    const scale = merc.meterInMercatorCoordinateUnits();
    const m = new THREE.Matrix4()
      .makeTranslation(merc.x, merc.y, merc.z)
      .scale(new THREE.Vector3(scale, -scale, scale))
      // three: y-up, x-east, z-south. Mercator: x-east, y-south, z-up. Rotate x by -90 deg.
      .multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2));
    this.camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix).multiply(m);
    this.renderer.resetState();
    this.renderer.render(scene, this.camera);
    map.triggerRepaint();
  },
};
map.on("style.load", () => map.addLayer(customLayer));

// Game loop — drive Mapbox camera from player transform
let last = performance.now();
function frame() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (buildings) {
    player.update(dt, (x, z) => buildings.groundY(x, z));

    // Sync remote avatar meshes from Colyseus state
    if (room) {
      for (const [id, r] of remotes) {
        const s = r.state;
        r.mesh.position.set(s.x, s.y - 0.85, s.z);
        r.mesh.rotation.y = s.yaw;
      }
      // Publish our transform ~20 Hz
      publishThrottled(now);
    }

    // Position Mapbox first-person camera at the player
    const lngLat = localToLngLat(buildings.origin, player.pos.x, player.pos.z);
    const camOpts = new mapboxgl.FreeCameraOptions(
      mapboxgl.MercatorCoordinate.fromLngLat(lngLat, player.pos.y),
      undefined
    );
    // Look toward a target 100m ahead
    const look = player.lookDir().multiplyScalar(100).add(player.pos);
    const lookLngLat = localToLngLat(buildings.origin, look.x, look.z);
    camOpts.lookAtPoint(lookLngLat, look.y);
    map.setFreeCameraOptions(camOpts);
  }

  // HUD
  if (room) {
    const me = room.state.players.get(room.sessionId);
    if (me) document.getElementById("kd").textContent = `${me.kills}/${me.deaths}`;
    const board = [...room.state.players.entries()]
      .map(([id, p]) => `${id === room.sessionId ? "you" : p.name} — ${p.kills}/${p.deaths}`)
      .join("<br>");
    document.getElementById("board").innerHTML = board;
  }

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

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
