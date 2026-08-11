// Electron entry: spawn Colyseus server as a child process, then load client from disk.
const { app, BrowserWindow, shell, dialog } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");

const isDev = !app.isPackaged;
const RESOURCES = isDev ? path.join(__dirname, "..") : process.resourcesPath;
const SERVER_DIR = path.join(RESOURCES, "server");
const CLIENT_DIR = path.join(RESOURCES, "client", "dist"); // in prod: extraResources -> client
const CLIENT_DIR_DEV = path.join(RESOURCES, "client", "dist");
const SERVER_PORT = 2567;

let serverProc = null;
let mainWindow = null;

function startServer() {
  const entry = path.join(SERVER_DIR, "src", "index.js");
  if (!fs.existsSync(entry)) {
    dialog.showErrorBox("Server missing", "Server file not found at " + entry);
    return;
  }
  serverProc = spawn(process.execPath, [entry], {
    cwd: SERVER_DIR,
    env: { ...process.env, PORT: String(SERVER_PORT), ELECTRON_RUN_AS_NODE: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  serverProc.stdout.on("data", (b) => console.log("[server]", b.toString().trim()));
  serverProc.stderr.on("data", (b) => console.error("[server]", b.toString().trim()));
  serverProc.on("exit", (code) => console.log("[server] exited", code));
}

function waitForServer(cb, tries = 40) {
  const req = http.get(`http://127.0.0.1:${SERVER_PORT}/`, () => cb()).on("error", () => {
    if (tries <= 0) cb(new Error("server did not start"));
    else setTimeout(() => waitForServer(cb, tries - 1), 150);
  });
  req.setTimeout(300, () => req.destroy());
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800, backgroundColor: "#0b1220",
    autoHideMenuBar: true, title: "City Shooter",
    webPreferences: {
      contextIsolation: true, nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  mainWindow.setMenuBarVisibility(false);
  const clientDir = fs.existsSync(CLIENT_DIR) ? CLIENT_DIR : CLIENT_DIR_DEV;
  const indexHtml = path.join(clientDir, "index.html");
  if (!fs.existsSync(indexHtml)) {
    dialog.showErrorBox("Client missing",
      `Client build not found at ${indexHtml}. Run "npm install" in game/desktop first (it builds the client).`);
    return;
  }
  mainWindow.loadFile(indexHtml, {
    query: { serverUrl: `ws://127.0.0.1:${SERVER_PORT}` },
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
}

app.whenReady().then(() => {
  startServer();
  waitForServer(() => createWindow());
});
app.on("window-all-closed", () => { if (serverProc) serverProc.kill(); app.quit(); });
app.on("before-quit", () => { if (serverProc) serverProc.kill(); });
