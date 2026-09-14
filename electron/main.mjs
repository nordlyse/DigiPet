import { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage, dialog } from "electron";
import path from "node:path";
import fs from "node:fs";
import { spawn, execFileSync } from "node:child_process";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { EngineHost, enginePath } from "./engine-host.mjs";
import { mcpCatalog, osTitle, parseIntent, petReply, primeHelpers, resetChatMemory, runMcp } from "./mcp-tools.mjs";
import { lang, petName, setLang, t } from "./i18n.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEV_URL = process.env.DIGITPET_URL || "http://localhost:5173";
const SPECIES = ["cat", "dog", "rabbit", "turtle", "elephant", "bird", "eagle", "ghost"];
const SETUP_FLOW = 2;

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

function attachEditMenu(win) {
  if (!win || win.isDestroyed()) return;
  win.webContents.on("context-menu", (_e, params) => {
    const items = [
      { role: "copy", enabled: Boolean(params.selectionText) },
      { role: "paste", enabled: Boolean(params.editFlags?.canPaste) },
      { role: "selectAll" },
    ];
    Menu.buildFromTemplate(items).popup({ window: win });
  });
}

function licensePath() {
  const packed = path.join(app.getAppPath(), "LICENSE");
  if (fs.existsSync(packed)) return packed;
  return path.join(__dirname, "..", "LICENSE");
}

function showLicense() {
  let detail = "DigiPet is MIT © 2026 Jakob Lyse. Third-party works keep their own licenses.";
  try {
    detail = fs.readFileSync(licensePath(), "utf8");
  } catch {
    /* fallback above */
  }
  void dialog.showMessageBox({
    type: "info",
    title: "DigiPet licenses",
    message: "DigiPet — MIT. Extra helpers keep their own licenses.",
    detail,
    buttons: ["OK"],
  });
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
      setupFlow: 0,
      mcps: [],
      ...JSON.parse(fs.readFileSync(configPath(), "utf8")),
    };
  } catch {
    return { species: "cat", onboarded: false, volume: 0.55, openAtLogin: true, mcpAsked: false, setupFlow: 0, mcps: [] };
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

function osLocale() {
  try {
    const preferred = app.getPreferredSystemLanguages?.();
    if (Array.isArray(preferred) && preferred[0]) return preferred[0];
  } catch {
    /* ignore */
  }
  try {
    const system = app.getSystemLocale?.();
    if (system) return system;
  } catch {
    /* ignore */
  }
  return app.getLocale();
}

function needsSetup(cfg) {
  return cfg.onboarded !== true || cfg.mcpAsked !== true || Number(cfg.setupFlow) !== SETUP_FLOW;
}

function loadPage(win, file) {
  if (!app.isPackaged) return win.loadURL(`${DEV_URL}/${file}`);
  return win.loadFile(path.join(__dirname, "..", "dist", file));
}

function withOsDialogs(fn) {
  const restore = [overlay, chat, picker].filter((w) => w && !w.isDestroyed());
  for (const w of restore) {
    try {
      w.setAlwaysOnTop(false);
    } catch {
      /* ignore */
    }
  }
  const putBack = () => {
    try {
      if (overlay && !overlay.isDestroyed()) overlay.setAlwaysOnTop(true, "floating");
      if (chat && !chat.isDestroyed()) chat.setAlwaysOnTop(true, "pop-up-menu");
      if (picker && !picker.isDestroyed()) picker.setAlwaysOnTop(true, "floating");
    } catch {
      /* ignore */
    }
  };
  return Promise.resolve()
    .then(fn)
    .finally(putBack);
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
  if (helper) return;
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
    helper = null;
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
  startWindowWatcher();
  if (overlay) return;
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

function addPicker(step) {
  if (picker) {
    if (step) picker.webContents.send("onboarding-step", step);
    picker.show();
    picker.focus();
    return;
  }
  if (process.platform === "darwin") app.dock?.show();
  const wa = screen.getPrimaryDisplay().workArea;
  picker = new BrowserWindow({
    x: Math.round(wa.x + (wa.width - 760) / 2),
    y: Math.round(wa.y + (wa.height - 780) / 2),
    width: 760,
    height: 780,
    title: t("setupTitle"),
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
  attachEditMenu(picker);
  const open = async () => {
    if (!app.isPackaged) {
      const url = new URL(`${DEV_URL}/onboarding.html`);
      url.searchParams.set("lang", lang());
      if (step) url.searchParams.set("step", step);
      await picker.loadURL(url.toString());
    } else {
      await picker.loadFile(path.join(__dirname, "..", "dist", "onboarding.html"), {
        query: step ? { lang: lang(), step } : { lang: lang() },
      });
    }
      });
    }
    picker.show();
    picker.focus();
    app.focus({ steal: true });
  };
  void open();
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
    title: t("chatTitle"),
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
  attachEditMenu(chat);
  chat.on("closed", () => {
    chat = null;
  });
  const open = async () => {
    if (!app.isPackaged) {
      const url = new URL(`${DEV_URL}/chat.html`);
      url.searchParams.set("lang", lang());
      if (forceMcp) url.searchParams.set("mcp", "1");
      await chat.loadURL(url.toString());
    } else {
      await chat.loadFile(path.join(__dirname, "..", "dist", "chat.html"), {
        query: forceMcp ? { lang: lang(), mcp: "1" } : { lang: lang() },
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
    label: `${petName(id)}`,
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
    { label: t("animal"), submenu: petMenu },
    { label: t("pickAnimal"), click: () => addPicker() },
    { label: `${osTitle()} ${t("agents")}`, click: () => addPicker("mcp") },
    { label: t("talk"), click: () => addChat() },
    { label: t("license"), click: () => showLicense() },
    { type: "separator" },
    {
      label: t("openAtLogin"),
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
      label: t("quit"),
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
    label: t("quit"),
    accelerator: "CmdOrCtrl+Q",
    click: () => quitApp(),
  };
  const licenseItem = { label: t("license"), click: () => showLicense() };
  const template =
    process.platform === "darwin"
      ? [
          { label: "DigiPet", submenu: [{ role: "about" }, licenseItem, { type: "separator" }, quitItem] },
          { role: "editMenu" },
        ]
      : [
          { label: "DigiPet", submenu: [licenseItem, { type: "separator" }, quitItem] },
          { role: "editMenu" },
        ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  if (process.platform === "darwin") {
    app.setAboutPanelOptions({
      applicationName: "DigiPet",
      copyright: "© 2026 Jakob Lyse. MIT License.",
      credits:
        "Third-party: Three.js, Electron, Vite (MIT); TypeScript (Apache-2.0). Optional Candle sidecar: Apache-2.0 OR MIT. SmolLM2: Apache-2.0. OS helpers keep their own licenses; Open-Meteo data is CC BY 4.0. Loading more than one helper applies every listed license at once. Full text: LICENSE.",
    });
    app.dock?.setIcon(loadIcon("icon.png"));
    app.dock?.setMenu(Menu.buildFromTemplate([licenseItem, quitItem]));
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
  return mcpCatalog();
}

function registerIpc() {
  ipcMain.handle("get-config", () => {
    const cfg = loadConfig();
    return { ...cfg, lang: lang(), needsSetup: needsSetup(cfg) };
  });
  ipcMain.handle("complete-onboarding", async (_e, payload) => {
    const prev = loadConfig();
    const species = (typeof payload === "string" ? payload : payload?.species) || prev.species;
    const mcps = Array.isArray(payload?.mcps) ? payload.mcps.filter((id) => typeof id === "string") : prev.mcps ?? [];
    const next = {
      ...loadConfig(),
      species,
      onboarded: true,
      mcpAsked: true,
      setupFlow: SETUP_FLOW,
      mcps,
    };
    saveConfig(next);
    app.setLoginItemSettings({ openAtLogin: next.openAtLogin });
    if (needsSetup(prev)) {
      try {
        await withOsDialogs(() => primeHelpers(mcps));
      } catch {
        /* still finish setup */
      }
    }
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
    return {
      items: fallbackCatalog(),
      asked: loadConfig().mcpAsked === true,
      enabled: loadConfig().mcps ?? [],
      os: osTitle(),
    };
  });
  ipcMain.handle("set-mcps", async (_e, mcps) => {
    const list = Array.isArray(mcps) ? mcps.filter((id) => typeof id === "string") : [];
    const next = { ...loadConfig(), mcps: list, mcpAsked: true, setupFlow: SETUP_FLOW };
    saveConfig(next);
    if (engine.proc) {
      try {
        await engine.setMcps(list);
      } catch {
        /* JS helpers still run */
      }
    }
    try {
      await withOsDialogs(() => primeHelpers(list));
    } catch {
      /* OS dialog may have been dismissed */
    }
    return next;
  });
  ipcMain.handle("chat-pet", async (_e, payload) => {
    if (payload?.reset) {
      if (engine.proc) {
        try {
          await engine.reset();
        } catch {
          /* ignore */
        }
      }
      resetChatMemory();
      return "";
    }
    const cfg = loadConfig();
    const text = String(payload?.text || "");
    const species = payload?.species || cfg.species || "cat";
    const name = payload?.name || petName(species) || t("pet");
    const enabled = new Set(cfg.mcps ?? []);
    let toolText = "";
    const intent = parseIntent(text);
    if (intent && enabled.has(intent.server)) {
      try {
        toolText = intent.server === "calendar" ? await withOsDialogs(() => runMcp(intent)) : await runMcp(intent);
      } catch (err) {
        toolText = err instanceof Error ? err.message : t("agentFailed");
      }
    } else if (intent) {
      toolText = `${intent.server} ${t("helperOff")} ${osTitle()}.`;
    }
    const bin = enginePath(resourceDir());
    if (engine.proc && fs.existsSync(bin)) {
      try {
        const llm = await engine.chat({
          species,
          name,
          text,
          lang: payload?.lang || lang(),
          mcps: cfg.mcps ?? [],
        });
        if (String(llm || "").trim()) return String(llm).trim();
      } catch {
        /* JS cevabı kullan */
      }
    }
    return petReply(species, name, text, toolText);
  });
  ipcMain.on("pet-say", (_e, payload) => {
    overlay?.webContents.send("pet-say", payload);
  });
  ipcMain.on("hit-regions", (_e, regions) => {
    hitRegions = Array.isArray(regions) ? regions : [];
  });
  ipcMain.handle("ready-overlay", () => {
    pushWindows();
    return { ...loadConfig(), workArea: screen.getPrimaryDisplay().workArea, overlay: overlay?.getBounds(), lang: lang() };
  });
}

app.whenReady().then(async () => {
  setLang(osLocale());
  if (!app.isPackaged) await waitForVite(DEV_URL);
  registerIpc();
  const cfg = loadConfig();
  app.setLoginItemSettings({ openAtLogin: cfg.openAtLogin });
  installAppMenu();
  rebuildTray();
  startHitPoll();
  if (needsSetup(cfg)) addPicker();
  else addOverlay();
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
  if (needsSetup(cfg)) addPicker();
  else if (!overlay) addOverlay();
});
