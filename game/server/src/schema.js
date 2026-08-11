import { Schema, MapSchema, type } from "@colyseus/schema";

export class Player extends Schema {
  constructor() {
    super();
    this.x = 0; this.y = 1.7; this.z = 0;
    this.yaw = 0; this.pitch = 0;
    this.hp = 100;
    this.kills = 0; this.deaths = 0;
    this.streak = 0;
    this.name = "player";
    this.crouch = 0;
  }
}
type("number")(Player.prototype, "x");
type("number")(Player.prototype, "y");
type("number")(Player.prototype, "z");
type("number")(Player.prototype, "yaw");
type("number")(Player.prototype, "pitch");
type("number")(Player.prototype, "hp");
type("number")(Player.prototype, "kills");
type("number")(Player.prototype, "deaths");
type("number")(Player.prototype, "streak");
type("number")(Player.prototype, "crouch");
type("string")(Player.prototype, "name");

export class Pickup extends Schema {
  constructor() { super(); this.id = ""; this.x = 0; this.z = 0; this.kind = "hp"; this.active = true; }
}
type("string")(Pickup.prototype, "id");
type("number")(Pickup.prototype, "x");
type("number")(Pickup.prototype, "z");
type("string")(Pickup.prototype, "kind");
type("boolean")(Pickup.prototype, "active");

export class GameState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
    this.pickups = new MapSchema();
    this.cityLng = 9.19;
    this.cityLat = 45.4642;
  }
}
type({ map: Player })(GameState.prototype, "players");
type({ map: Pickup })(GameState.prototype, "pickups");
type("number")(GameState.prototype, "cityLng");
type("number")(GameState.prototype, "cityLat");
