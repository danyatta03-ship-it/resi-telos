import { Client } from "colyseus.js";

export async function connect(serverUrl, name = "player") {
  const client = new Client(serverUrl);
  return client.joinOrCreate("arena", { name });
}
