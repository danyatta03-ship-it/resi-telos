import { Schema, MapSchema, type } from "@colyseus/schema";

export class Player extends Schema {
  constructor() {
    super();
    this.x = 0; this.y = 1.7; this.z = 0;
    this.yaw = 0; this.pitch = 0;
    this.hp = 100;
    this.kills = 0; this.deaths = 0;
    this.name = "player";
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
type("string")(Player.prototype, "name");

export class GameState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
    // City picked by first joiner; others follow.
    this.cityLng = 9.19;   // Milano default
    this.cityLat = 45.4642;
  }
}
type({ map: Player })(GameState.prototype, "players");
type("number")(GameState.prototype, "cityLng");
type("number")(GameState.prototype, "cityLat");
