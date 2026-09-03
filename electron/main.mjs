import { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } from "electron";
import path from "node:path";
import fs from "node:fs";
import { spawn, execFileSync } from "node:child_process";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEV_URL = process.env.DIGITPET_URL || "http://localhost:5173";
const SPECIES = ["cat", "dog", "rabbit", "turtle", "elephant", "bird", "eagle", "ghost"];
const NAMES = {
  cat: "Kedi",
  dog: "Köpek",
  rabbit: "Tavşan",
  turtle: "Kaplumbağa",
  elephant: "Fil",
  bird: "Kuş",
  eagle: "Kartal",
  ghost: "Hayalet",
};

let overlay = null;
let picker = null;
let chat = null;
let tray = null;
let helper = null;
let quitting = false;
let hitRegions = [];
let latestWindows = [];

function configPath() {
  return path.join(app.getPath("userData"), "config.json");
}

function loadConfig() {
  try {
    return {
      species: "cat",
      onboarded: false,
      volume: 0.55,
      openAtLogin: true,
      ...JSON.parse(fs.readFileSync(configPath(), "utf8")),
    };
  } catch {
    return { species: "cat", onboarded: false, volume: 0.55, openAtLogin: true };
  }
}

function saveConfig(next) {
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(next, null, 2));
}

async function waitForVite(url) {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.ok || res.status === 404) return;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}

function loadPage(win, file) {
  if (!app.isPackaged) return win.loadURL(`${DEV_URL}/${file}`);
  return win.loadFile(path.join(__dirname, "..", "dist", file));
}

function ensureHelper() {
  const bin = path.join(__dirname, "..", "native", "list-windows");
  const src = path.join(__dirname, "..", "native", "list-windows.c");
  if (process.platform !== "darwin") return null;
  if (fs.existsSync(bin)) return bin;
  execFileSync("clang", ["-O2", "-o", bin, src, "-framework", "CoreGraphics", "-framework", "CoreFoundation"]);
  return bin;
}

function startWindowWatcher() {
  if (process.platform !== "darwin") return;
  const bin = ensureHelper();
  if (!bin) return;
  const proc = spawn(bin, ["--exclude-pid", String(process.pid)]);
  helper = proc;
  const rl = readline.createInterface({ input: proc.stdout });
  rl.on("line", (line) => {
    try {
      latestWindows = JSON.parse(line);
      pushWindows();
    } catch {
      /* ignore partial lines */
    }
  });
  proc.on("exit", () => {
    if (!quitting) setTimeout(startWindowWatcher, 800);
  });
}

function pushWindows() {
  if (!overlay) return;
  const display = screen.getPrimaryDisplay();
  overlay.webContents.send("desktop-state", {
    windows: latestWindows,
    workArea: display.workArea,
    overlay: overlay.getBounds(),
  });
}

function createOverlay() {
  const display = screen.getPrimaryDisplay();
  overlay = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    transparent: true,
    frame: false,
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: true,
    roundedCorners: false,
    type: process.platform === "darwin" ? "panel" : undefined,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  overlay.setAlwaysOnTop(true, "floating");
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlay.setIgnoreMouseEvents(true, { forward: true });
  if (typeof overlay.setHiddenInMissionControl === "function") overlay.setHiddenInMissionControl(true);
  overlay.on("closed", () => {
    overlay = null;
  });
  overlay.on("close", (e) => {
    if (!quitting) e.preventDefault();
  });
  void loadPage(overlay, "index.html");
}

function createPicker() {
  if (picker) {
    picker.show();
    picker.focus();
    return;
  }
  if (process.platform === "darwin") app.dock?.show();
  const wa = screen.getPrimaryDisplay().workArea;
  picker = new BrowserWindow({
    x: Math.round(wa.x + (wa.width - 760) / 2),
    y: Math.round(wa.y + (wa.height - 640) / 2),
    width: 760,
    height: 640,
    title: "DigiPet",
    backgroundColor: "#12202e",
    resizable: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  picker.on("closed", () => {
    picker = null;
    const cfg = loadConfig();
    if (cfg.onboarded && process.platform === "darwin") app.dock?.show();
  });
  picker.setAlwaysOnTop(true, "floating");
  picker.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  void loadPage(picker, "onboarding.html").then(() => {
    picker.show();
    picker.focus();
    app.focus({ steal: true });
  });
}

function createChat() {
  if (chat) {
    chat.show();
    chat.focus();
    return;
  }
  const wa = screen.getPrimaryDisplay().workArea;
  chat = new BrowserWindow({
    x: Math.round(wa.x + wa.width - 430),
    y: Math.round(wa.y + 72),
    width: 400,
    height: 480,
    title: "DigiPet sohbet",
    backgroundColor: "#12202e",
    frame: true,
    closable: true,
    minimizable: true,
    fullscreenable: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  // Must sit above the fullscreen overlay, otherwise close buttons are unclickable.
  chat.setAlwaysOnTop(true, "pop-up-menu");
  chat.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  chat.on("closed", () => {
    chat = null;
  });
  void loadPage(chat, "chat.html").then(() => {
    chat.show();
    chat.focus();
  });
}

function rebuildTray() {
  const cfg = loadConfig();
  const petMenu = SPECIES.map((id) => ({
    label: `${NAMES[id]}`,
    type: "radio",
    checked: cfg.species === id,
    click: () => {
      const next = { ...loadConfig(), species: id, onboarded: true };
      saveConfig(next);
      overlay?.webContents.send("species-changed", id);
      rebuildTray();
    },
  }));
  const menu = Menu.buildFromTemplate([
    { label: "DigiPet", enabled: false },
    { type: "separator" },
    { label: "Hayvan", submenu: petMenu },
    { label: "Hayvan seçimini aç…", click: () => createPicker() },
    { label: "Pet ile konuş", click: () => createChat() },
    { type: "separator" },
    {
      label: "Açılışta başlat",
      type: "checkbox",
      checked: cfg.openAtLogin,
      click: (item) => {
        const next = { ...loadConfig(), openAtLogin: item.checked };
        saveConfig(next);
        app.setLoginItemSettings({ openAtLogin: item.checked });
      },
    },
    { type: "separator" },
    {
      label: "Çıkış",
      click: () => {
        quitting = true;
        app.quit();
      },
    },
  ]);
  if (!tray) {
    const image = nativeImage.createFromDataURL(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    );
    tray = new Tray(image);
    tray.setToolTip("DigiPet");
    if (process.platform === "darwin") tray.setTitle("DigiPet");
  }
  tray.setContextMenu(menu);
}

function startHitPoll() {
  setInterval(() => {
    if (!overlay || overlay.isDestroyed()) return;
    const cursor = screen.getCursorScreenPoint();
    const bounds = overlay.getBounds();
    const lx = cursor.x - bounds.x;
    const ly = cursor.y - bounds.y;
    const over = hitRegions.some((r) => lx >= r.x && lx <= r.x + r.w && ly >= r.y && ly <= r.y + r.h);
    overlay.setIgnoreMouseEvents(!over, { forward: true });
  }, 16);
}

function registerIpc() {
  ipcMain.handle("get-config", () => loadConfig());
  ipcMain.handle("complete-onboarding", (_e, species) => {
    const next = { ...loadConfig(), species, onboarded: true };
    saveConfig(next);
    app.setLoginItemSettings({ openAtLogin: next.openAtLogin });
    if (!overlay) createOverlay();
    else overlay.webContents.send("species-changed", species);
    rebuildTray();
    picker?.close();
    return next;
  });
  ipcMain.handle("set-species", (_e, species) => {
    const next = { ...loadConfig(), species };
    saveConfig(next);
    overlay?.webContents.send("species-changed", species);
    rebuildTray();
  });
  ipcMain.handle("set-volume", (_e, volume) => {
    saveConfig({ ...loadConfig(), volume });
    overlay?.webContents.send("volume-changed", volume);
  });
  ipcMain.handle("open-picker", () => createPicker());
  ipcMain.handle("open-chat", () => {
    createChat();
  });
  ipcMain.handle("close-chat", () => {
    if (chat && !chat.isDestroyed()) chat.close();
  });
  ipcMain.on("pet-say", (_e, text) => {
    overlay?.webContents.send("pet-say", String(text ?? ""));
  });
  ipcMain.on("hit-regions", (_e, regions) => {
    hitRegions = Array.isArray(regions) ? regions : [];
  });
  ipcMain.handle("ready-overlay", () => {
    pushWindows();
    return { ...loadConfig(), workArea: screen.getPrimaryDisplay().workArea, overlay: overlay?.getBounds() };
  });
}

app.whenReady().then(async () => {
  if (!app.isPackaged) await waitForVite(DEV_URL);
  registerIpc();
  const cfg = loadConfig();
  app.setLoginItemSettings({ openAtLogin: cfg.openAtLogin });
  rebuildTray();
  startWindowWatcher();
  startHitPoll();
  if (!cfg.onboarded) createPicker();
  else {
    createOverlay();
  }
});

app.on("before-quit", () => {
  quitting = true;
  helper?.kill();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && quitting) app.quit();
});

app.on("activate", () => {
  const cfg = loadConfig();
  if (!cfg.onboarded) createPicker();
  else if (!overlay) createOverlay();
});
