import { Client } from "colyseus.js";

export async function connect(serverUrl) {
  const client = new Client(serverUrl);
  const room = await client.joinOrCreate("arena", { name: "player" });
  return room;
}
