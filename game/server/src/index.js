import http from "http";
import express from "express";
import { Server, Room } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GameState, Player } from "./schema.js";

const RESPAWN_MS = 2500;
const WEAPONS = {
  pistol: { damage: 30, minInterval: 195 }, // rpm 300 -> 200ms, small slack
  rifle:  { damage: 18, minInterval: 78  }, // rpm 720 -> 83ms
};
const REGEN_DELAY_MS = 4000;
const REGEN_PER_SEC = 12;

class GameRoom extends Room {
  onCreate() {
    this.setState(new GameState());
    this.maxClients = 32;
    this.lastShot = new Map();      // sessionId -> { weapon, at }
    this.lastDamageAt = new Map();  // sessionId -> ts

    this.onMessage("move", (client, data) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || p.hp <= 0) return;
      if (Number.isFinite(data.x) && Number.isFinite(data.y) && Number.isFinite(data.z)) {
        p.x = data.x; p.y = data.y; p.z = data.z;
        p.yaw = data.yaw ?? p.yaw;
        p.pitch = data.pitch ?? p.pitch;
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

      const targetId = data?.targetId;
      if (!targetId) return;
      const target = this.state.players.get(targetId);
      if (!target || target.hp <= 0 || targetId === client.sessionId) return;
      const dx = shooter.x - target.x, dy = shooter.y - target.y, dz = shooter.z - target.z;
      if (dx * dx + dy * dy + dz * dz > 500 * 500) return;

      target.hp = Math.max(0, target.hp - w.damage);
      this.lastDamageAt.set(targetId, now);
      this.broadcast("hit", { by: client.sessionId, target: targetId, hp: target.hp, weapon });
      if (target.hp === 0) {
        shooter.kills += 1;
        target.deaths += 1;
        this.broadcast("kill", { by: client.sessionId, target: targetId, weapon });
        this.clock.setTimeout(() => {
          target.hp = 100;
          target.x = (Math.random() - 0.5) * 40;
          target.z = (Math.random() - 0.5) * 40;
          target.y = 1.7;
          this.broadcast("respawn", { id: targetId });
        }, RESPAWN_MS);
      }
    });

    this.onMessage("setCity", (_client, data) => {
      if (Number.isFinite(data?.lng) && Number.isFinite(data?.lat)) {
        this.state.cityLng = data.lng;
        this.state.cityLat = data.lat;
        this.broadcast("city", { lng: data.lng, lat: data.lat });
      }
    });

    // HP regen tick
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

  onJoin(client, options) {
    const p = new Player();
    p.name = (options?.name || "player").slice(0, 16);
    p.x = (Math.random() - 0.5) * 40;
    p.z = (Math.random() - 0.5) * 40;
    this.state.players.set(client.sessionId, p);
  }

  onLeave(client) {
    this.state.players.delete(client.sessionId);
    this.lastShot.delete(client.sessionId);
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
