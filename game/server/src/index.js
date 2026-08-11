import http from "http";
import express from "express";
import colyseus from "colyseus";
import wsTransport from "@colyseus/ws-transport";
import { GameState, Player, Pickup } from "./schema.js";
const { Server, Room } = colyseus;
const { WebSocketTransport } = wsTransport;

const RESPAWN_MS = 2500;
const WEAPONS = {
  pistol: { damage: 30, minInterval: 195 },
  rifle:  { damage: 18, minInterval: 78  },
};
const REGEN_DELAY_MS = 4000;
const REGEN_PER_SEC = 12;
const GRENADE_DAMAGE = 90;
const GRENADE_RADIUS = 6;
const GRENADE_COOLDOWN_MS = 3000;
const PICKUP_COUNT = 6;
const PICKUP_RANGE = 60;

function rnd(range) { return (Math.random() - 0.5) * 2 * range; }

class GameRoom extends Room {
  onCreate() {
    this.setState(new GameState());
    this.maxClients = 32;
    this.lastShot = new Map();
    this.lastGrenade = new Map();
    this.lastDamageAt = new Map();

    this._spawnInitialPickups();

    this.onMessage("move", (client, data) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || p.hp <= 0) return;
      if (Number.isFinite(data.x) && Number.isFinite(data.y) && Number.isFinite(data.z)) {
        p.x = data.x; p.y = data.y; p.z = data.z;
        p.yaw = data.yaw ?? p.yaw;
        p.pitch = data.pitch ?? p.pitch;
        p.crouch = data.crouch ? 1 : 0;
      }
      // Pickup collection
      for (const [id, pk] of this.state.pickups) {
        if (!pk.active) continue;
        const dx = pk.x - p.x, dz = pk.z - p.z;
        if (dx * dx + dz * dz < 1.6 * 1.6) {
          if (pk.kind === "hp" && p.hp < 100) {
            p.hp = Math.min(100, p.hp + 50);
            pk.active = false;
            this.broadcast("pickup", { id, by: client.sessionId, kind: pk.kind });
            this.clock.setTimeout(() => this._respawnPickup(id), 15000);
          }
        }
      }
    });

    this.onMessage("shoot", (client, data) => {
      const shooter = this.state.players.get(client.sessionId);
      if (!shooter || shooter.hp <= 0) return;
      const weapon = WEAPONS[data?.weapon] ? data.weapon : "pistol";
      const w = WEAPONS[weapon];
      const now = Date.now();
      const last = this.lastShot.get(client.sessionId);
      if (last && last.weapon === weapon && now - last.at < w.minInterval) return;
      this.lastShot.set(client.sessionId, { weapon, at: now });
      this.broadcast("shot", { by: client.sessionId, weapon, x: shooter.x, y: shooter.y, z: shooter.z });

      const targetId = data?.targetId;
      if (!targetId) return;
      const target = this.state.players.get(targetId);
      if (!target || target.hp <= 0 || targetId === client.sessionId) return;
      const dx = shooter.x - target.x, dy = shooter.y - target.y, dz = shooter.z - target.z;
      if (dx * dx + dy * dy + dz * dz > 500 * 500) return;

      target.hp = Math.max(0, target.hp - w.damage);
      this.lastDamageAt.set(targetId, now);
      this.broadcast("hit", { by: client.sessionId, target: targetId, hp: target.hp, weapon });
      if (target.hp === 0) this._kill(client.sessionId, targetId, weapon);
    });

    this.onMessage("grenade", (client, data) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || p.hp <= 0) return;
      const now = Date.now();
      const last = this.lastGrenade.get(client.sessionId) || 0;
      if (now - last < GRENADE_COOLDOWN_MS) return;
      this.lastGrenade.set(client.sessionId, now);
      if (!Number.isFinite(data?.vx) || !Number.isFinite(data?.vy) || !Number.isFinite(data?.vz)) return;
      const id = `g${Math.random().toString(36).slice(2, 8)}`;
      this.broadcast("grenade", {
        id, by: client.sessionId,
        x: p.x, y: p.y, z: p.z,
        vx: data.vx, vy: data.vy, vz: data.vz,
      });
      // Explosion after 2s, server authoritative
      this.clock.setTimeout(() => this._detonateGrenade(client.sessionId, p.x, p.y, p.z, data.vx, data.vy, data.vz, id), 2000);
    });

    this.onMessage("ping", (client, data) => {
      client.send("pong", { t: data?.t });
    });

    this.onMessage("chat", (client, data) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      const msg = String(data?.msg || "").slice(0, 140);
      if (!msg) return;
      this.broadcast("chat", { from: p.name, msg });
    });

    this.onMessage("setCity", (_client, data) => {
      if (Number.isFinite(data?.lng) && Number.isFinite(data?.lat)) {
        this.state.cityLng = data.lng;
        this.state.cityLat = data.lat;
        this.broadcast("city", { lng: data.lng, lat: data.lat });
      }
    });

    this.setSimulationInterval((delta) => {
      const now = Date.now();
      const gain = REGEN_PER_SEC * (delta / 1000);
      for (const [id, p] of this.state.players) {
        if (p.hp <= 0 || p.hp >= 100) continue;
        const t = this.lastDamageAt.get(id) ?? 0;
        if (now - t < REGEN_DELAY_MS) continue;
        p.hp = Math.min(100, p.hp + gain);
      }
    }, 200);
  }

  _kill(byId, targetId, weapon) {
    const shooter = this.state.players.get(byId);
    const target = this.state.players.get(targetId);
    if (!target) return;
    if (shooter && byId !== targetId) {
      shooter.kills += 1;
      shooter.streak += 1;
    }
    target.deaths += 1;
    target.streak = 0;
    this.broadcast("kill", { by: byId, target: targetId, weapon, streak: shooter?.streak ?? 0 });
    this.clock.setTimeout(() => {
      target.hp = 100;
      target.x = rnd(40); target.z = rnd(40); target.y = 1.7;
      this.broadcast("respawn", { id: targetId });
    }, RESPAWN_MS);
  }

  _detonateGrenade(byId, x0, y0, z0, vx, vy, vz, id) {
    // Simulate 2s of projectile flight to get impact point (no collisions server-side; client visual will handle).
    const g = -18;
    const t = 2.0;
    const ex = x0 + vx * t;
    const ez = z0 + vz * t;
    const ey = Math.max(0.2, y0 + vy * t + 0.5 * g * t * t);
    this.broadcast("explosion", { id, x: ex, y: ey, z: ez });
    for (const [pid, p] of this.state.players) {
      if (p.hp <= 0) continue;
      const dx = p.x - ex, dy = p.y - ey, dz = p.z - ez;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d > GRENADE_RADIUS) continue;
      const falloff = 1 - d / GRENADE_RADIUS;
      const dmg = Math.round(GRENADE_DAMAGE * falloff);
      if (dmg <= 0) continue;
      p.hp = Math.max(0, p.hp - dmg);
      this.lastDamageAt.set(pid, Date.now());
      this.broadcast("hit", { by: byId, target: pid, hp: p.hp, weapon: "grenade" });
      if (p.hp === 0) this._kill(byId, pid, "grenade");
    }
  }

  _spawnInitialPickups() {
    for (let i = 0; i < PICKUP_COUNT; i++) {
      const pk = new Pickup();
      pk.id = `pk${i}`;
      pk.x = rnd(PICKUP_RANGE);
      pk.z = rnd(PICKUP_RANGE);
      pk.kind = "hp";
      pk.active = true;
      this.state.pickups.set(pk.id, pk);
    }
  }
  _respawnPickup(id) {
    const pk = this.state.pickups.get(id);
    if (!pk) return;
    pk.x = rnd(PICKUP_RANGE);
    pk.z = rnd(PICKUP_RANGE);
    pk.active = true;
    this.broadcast("pickupSpawn", { id, x: pk.x, z: pk.z });
  }

  onJoin(client, options) {
    const p = new Player();
    p.name = (options?.name || "player").slice(0, 16);
    p.x = rnd(40); p.z = rnd(40);
    this.state.players.set(client.sessionId, p);
  }

  onLeave(client) {
    this.state.players.delete(client.sessionId);
    this.lastShot.delete(client.sessionId);
    this.lastGrenade.delete(client.sessionId);
    this.lastDamageAt.delete(client.sessionId);
  }
}

const app = express();
app.get("/", (_req, res) => res.send("city-shooter colyseus ok"));
const server = http.createServer(app);
const gameServer = new Server({ transport: new WebSocketTransport({ server }) });
gameServer.define("arena", GameRoom);
const PORT = process.env.PORT || 2567;
server.listen(PORT, () => console.log(`Colyseus listening on :${PORT}`));
