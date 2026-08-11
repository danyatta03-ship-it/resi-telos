// Bridges the query-string `serverUrl` to window.__SERVER_URL__ so the client can read it.
const { contextBridge } = require("electron");
try {
  const params = new URLSearchParams(location.search);
  const url = params.get("serverUrl");
  if (url) contextBridge.exposeInMainWorld("__SERVER_URL__", url);
} catch (e) { /* noop */ }
