const { app, BrowserWindow, shell } = require("electron");
const path = require("path");

// Push GPU quality knobs
app.commandLine.appendSwitch("enable-features", "Vulkan,UseSkiaRenderer");
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.disableHardwareAcceleration = false;

const isDev = !app.isPackaged;
const RESOURCES = isDev ? path.join(__dirname, "..") : process.resourcesPath;
const PLAY_HTML = path.join(RESOURCES, "game", "play.html");

let win = null;
function createWindow() {
  win = new BrowserWindow({
    width: 1600, height: 1000,
    backgroundColor: "#0b1220",
    autoHideMenuBar: true,
    title: "REALWAR — Roma",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadFile(PLAY_HTML);
  win.webContents.on("did-fail-load", (_e, code, desc, url) => {
    console.error("did-fail-load", code, desc, url);
  });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
