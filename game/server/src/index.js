import http from "http";
import express from "express";
import { Server, Room } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GameState, Player } from "./schema.js";

const RESPAWN_MS = 2500;
const DAMAGE = 25;

class GameRoom extends Room {
  onCreate() {
    this.setState(new GameState());
    this.maxClients = 16;

    this.onMessage("move", (client, data) => {
      const p = this.state.players.get(client.sessionId);
      if (!p || p.hp <= 0) return;
      // Trust client transforms for the prototype; clamp only extreme jumps.
      if (Number.isFinite(data.x) && Number.isFinite(data.y) && Number.isFinite(data.z)) {
        p.x = data.x; p.y = data.y; p.z = data.z;
        p.yaw = data.yaw ?? p.yaw;
        p.pitch = data.pitch ?? p.pitch;
      }
    });

    this.onMessage("shoot", (client, data) => {
      const shooter = this.state.players.get(client.sessionId);
      if (!shooter || shooter.hp <= 0) return;
      const targetId = data?.targetId;
      if (!targetId) return;
      const target = this.state.players.get(targetId);
      if (!target || target.hp <= 0 || targetId === client.sessionId) return;
      // Distance sanity check (very loose)
      const dx = shooter.x - target.x, dy = shooter.y - target.y, dz = shooter.z - target.z;
      if (dx * dx + dy * dy + dz * dz > 500 * 500) return;

      target.hp = Math.max(0, target.hp - DAMAGE);
      this.broadcast("hit", { by: client.sessionId, target: targetId, hp: target.hp });
      if (target.hp === 0) {
        shooter.kills += 1;
        target.deaths += 1;
        this.broadcast("kill", { by: client.sessionId, target: targetId });
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
      }
    });
  }

  onJoin(client, options) {
    const p = new Player();
    p.name = (options?.name || "player").slice(0, 20);
    p.x = (Math.random() - 0.5) * 40;
    p.z = (Math.random() - 0.5) * 40;
    this.state.players.set(client.sessionId, p);
  }

  onLeave(client) {
    this.state.players.delete(client.sessionId);
  }
}

const app = express();
app.get("/", (_req, res) => res.send("city-shooter colyseus ok"));
const server = http.createServer(app);
const gameServer = new Server({ transport: new WebSocketTransport({ server }) });
gameServer.define("arena", GameRoom);

const PORT = process.env.PORT || 2567;
server.listen(PORT, () => console.log(`Colyseus listening on :${PORT}`));
