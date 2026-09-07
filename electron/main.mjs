import { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } from "electron";
import path from "node:path";
import fs from "node:fs";
import { spawn, execFileSync } from "node:child_process";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { EngineHost, enginePath, ensureEngineBuilt } from "./engine-host.mjs";

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
let engine = new EngineHost();
let quitting = false;
let hitRegions = [];
let latestWindows = [];

if (process.platform === "win32") app.setAppUserModelId("com.nordlyse.digipet");

function quitApp() {
  quitting = true;
  helper?.kill();
  engine.stop();
  app.quit();
}

function iconFile(name) {
  return path.join(__dirname, "..", "assets", name);
}

function loadIcon(name, size) {
  const file = iconFile(name);
  const img = fs.existsSync(file) ? nativeImage.createFromPath(file) : nativeImage.createEmpty();
  if (size && !img.isEmpty()) return img.resize({ width: size, height: size });
  return img;
}

function windowIcon() {
  return loadIcon("icon.png", 256);
}

function resourceDir() {
  return app.isPackaged ? process.resourcesPath : path.join(__dirname, "..");
}

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
      mcpAsked: false,
      mcps: [],
      ...JSON.parse(fs.readFileSync(configPath(), "utf8")),
    };
  } catch {
    return { species: "cat", onboarded: false, volume: 0.55, openAtLogin: true, mcpAsked: false, mcps: [] };
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
  if (process.platform !== "darwin") return null;
  const bin = path.join(resourceDir(), "native", "list-windows");
  if (fs.existsSync(bin)) {
    try {
      fs.chmodSync(bin, 0o755);
    } catch {
      /* packaged resources may be read-only */
    }
    return bin;
  }
  if (app.isPackaged) return null;
  const src = path.join(__dirname, "..", "native", "list-windows.c");
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

function addOverlay() {
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
    icon: windowIcon(),
    focusable: true,
    roundedCorners: false,
    type: process.platform === "darwin" ? "panel" : undefined,
    icon: windowIcon(),
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

function addPicker() {
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
    icon: windowIcon(),
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

function addChat(forceMcp = false) {
  if (chat) {
    if (forceMcp) chat.webContents.send("show-mcp");
    chat.show();
    chat.focus();
    return;
  }
  const wa = screen.getPrimaryDisplay().workArea;
  chat = new BrowserWindow({
    x: Math.round(wa.x + wa.width - 430),
    y: Math.round(wa.y + 72),
    width: 420,
    height: 620,
    title: "DigiPet sohbet",
    icon: windowIcon(),
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
  const open = async () => {
    if (!app.isPackaged) {
      const url = new URL(`${DEV_URL}/chat.html`);
      if (forceMcp) url.searchParams.set("mcp", "1");
      await chat.loadURL(url.toString());
    } else {
      await chat.loadFile(path.join(__dirname, "..", "dist", "chat.html"), {
        query: forceMcp ? { mcp: "1" } : {},
      });
    }
    chat.show();
    chat.focus();
  };
  void open();
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
    { label: "Hayvan seçimini aç…", click: () => addPicker() },
    { label: "Pet ile konuş", click: () => addChat() },
    { label: "Yardımcılar (MCP)…", click: () => addChat(true) },
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
      label: "Quit",
      accelerator: "CmdOrCtrl+Q",
      click: () => quitApp(),
    },
  ]);
  if (!tray) {
    const image = loadIcon("tray.png", process.platform === "darwin" ? 22 : 32);
    tray = new Tray(image.isEmpty() ? loadIcon("icon.png", 32) : image);
    tray.setToolTip("DigiPet");
    tray.on("click", () => tray.popUpContextMenu());
    tray.on("right-click", () => tray.popUpContextMenu());
    tray.on("double-click", () => tray.popUpContextMenu());
  }
  tray.setContextMenu(menu);
}

function installAppMenu() {
  const quitItem = {
    label: "Quit",
    accelerator: "CmdOrCtrl+Q",
    click: () => quitApp(),
  };
  const template =
    process.platform === "darwin"
      ? [{ label: "DigiPet", submenu: [{ role: "about" }, { type: "separator" }, quitItem] }]
      : [{ label: "DigiPet", submenu: [quitItem] }];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  if (process.platform === "darwin") {
    app.dock?.setIcon(loadIcon("icon.png"));
    app.dock?.setMenu(Menu.buildFromTemplate([quitItem]));
    app.dock?.show();
  }
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

function fallbackCatalog() {
  const os = process.platform === "darwin" ? "darwin" : process.platform === "win32" ? "win32" : "linux";
  return [
    {
      id: "weather",
      title: "Hava durumu",
      description: "Open-Meteo ile şehir hava raporu. Anahtar gerekmez.",
      license: "MIT (araç) · Open-Meteo CC BY 4.0 (veri)",
      platforms: ["darwin", "win32", "linux"],
    },
    {
      id: "mail",
      title: "Mail",
      description: "Gelen kutusu oku, gönder, sil.",
      license: "MIT",
      platforms: ["darwin", "win32", "linux"],
    },
    {
      id: "calendar",
      title: "Takvim",
      description: "Bugünkü toplantı / etkinlik var mı bak.",
      license: "MIT",
      platforms: ["darwin", "win32", "linux"],
    },
    {
      id: "apps",
      title: "Uygulamalar",
      description: "Uygulama aç / kapat.",
      license: "MIT",
      platforms: ["darwin", "win32", "linux"],
    },
    {
      id: "messages",
      title: "Mesajlar",
      description: "Mesaj gönder / sil. macOS Messages; diğerlerinde sınırlı.",
      license: "MIT",
      platforms: ["darwin", "win32", "linux"],
    },
  ].filter((item) => item.platforms.includes(os));
}

async function bootEngine() {
  const cfg = loadConfig();
  const bin = enginePath(resourceDir());
  if (!app.isPackaged) {
    chat?.webContents.send("engine-progress", { pct: 3, label: "Rust motoru derleniyor…" });
    ensureEngineBuilt(path.join(__dirname, ".."), bin);
  }
  if (!fs.existsSync(bin)) {
    throw new Error("Rust motoru yok. rustup + cargo kurup npm run build:native çalıştır.");
  }
  engine.onProgress = (pct, label) => {
    chat?.webContents.send("engine-progress", { pct, label });
  };
  await engine.start(bin, path.join(app.getPath("userData"), "models"), cfg.mcps ?? []);
}

function registerIpc() {
  ipcMain.handle("get-config", () => loadConfig());
  ipcMain.handle("complete-onboarding", (_e, species) => {
    const next = { ...loadConfig(), species, onboarded: true };
    saveConfig(next);
    app.setLoginItemSettings({ openAtLogin: next.openAtLogin });
    if (!overlay) addOverlay();
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
  ipcMain.handle("open-picker", () => addPicker());
  ipcMain.handle("open-chat", () => addChat());
  ipcMain.handle("close-chat", () => {
    if (chat && !chat.isDestroyed()) chat.close();
  });
  ipcMain.handle("mcp-catalog", async () => {
    return { items: fallbackCatalog(), asked: loadConfig().mcpAsked === true, enabled: loadConfig().mcps ?? [] };
  });
  ipcMain.handle("set-mcps", async (_e, mcps) => {
    const list = Array.isArray(mcps) ? mcps.filter((id) => typeof id === "string") : [];
    const next = { ...loadConfig(), mcps: list, mcpAsked: true };
    saveConfig(next);
    try {
      await bootEngine();
      await engine.setMcps(list);
    } catch {
      /* catalog still saved; engine may start later */
    }
    return next;
  });
  ipcMain.handle("chat-pet", async (_e, payload) => {
    await bootEngine();
    if (payload?.reset) {
      await engine.reset();
      return "";
    }
    const cfg = loadConfig();
    return engine.chat({
      species: payload?.species,
      name: payload?.name,
      text: payload?.text,
      lang: payload?.lang || "tr",
      mcps: cfg.mcps ?? [],
    });
  });
  ipcMain.on("pet-say", (_e, payload) => {
    overlay?.webContents.send("pet-say", payload);
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
  installAppMenu();
  rebuildTray();
  startWindowWatcher();
  startHitPoll();
  if (!cfg.onboarded) addPicker();
  else {
    addOverlay();
  }
});

app.on("before-quit", () => {
  quitting = true;
  helper?.kill();
  engine.stop();
});

app.on("window-all-closed", () => {
  /* stay running in the tray until Quit */
});

app.on("activate", () => {
  const cfg = loadConfig();
  if (!cfg.onboarded) addPicker();
  else if (!overlay) addOverlay();
});
