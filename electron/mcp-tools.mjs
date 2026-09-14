import { execFile, execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { lang, t } from "./i18n.mjs";

const execFileAsync = promisify(execFile);
const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

export function osKey() {
  if (process.platform === "darwin") return "darwin";
  if (process.platform === "win32") return "win32";
  return "linux";
}

export function osTitle() {
  if (process.platform === "darwin") return "macOS";
  if (process.platform === "win32") return "Windows";
  return "Linux";
}

export function mcpCatalog() {
  const os = osKey();
  const mac = os === "darwin";
  const win = os === "win32";
  const items = [
    {
      id: "weather",
      title: t("weather"),
      description: t("weatherDesc"),
      license: t("weatherLic"),
      platforms: ["darwin", "win32", "linux"],
    },
    {
      id: "mail",
      title: win ? t("mailOutlook") : mac ? t("mailApple") : t("mailXdg"),
      description: mac ? t("mailDescMac") : win ? t("mailDescWin") : t("mailDescLinux"),
      license: mac ? t("mailLicMac") : win ? t("mailLicWin") : t("mailLicLinux"),
      platforms: ["darwin", "win32", "linux"],
    },
    {
      id: "calendar",
      title: win ? t("calOutlook") : mac ? t("calApple") : t("calKhal"),
      description: t("calendarDesc"),
      license: mac ? t("calLicMac") : win ? t("calLicWin") : t("calLicLinux"),
      platforms: ["darwin", "win32", "linux"],
    },
    {
      id: "apps",
      title: t("appsTitle"),
      description: mac ? t("appsDescMac") : win ? t("appsDescWin") : t("appsDescLinux"),
      license: t("appsLic"),
      platforms: ["darwin", "win32", "linux"],
    },
    {
      id: "messages",
      title: mac ? t("msgApple") : t("msgOther"),
      description: mac ? t("msgDescMac") : t("msgDescOther"),
      license: mac ? t("msgLicMac") : t("msgLicOther"),
      platforms: ["darwin", "win32", "linux"],
    },
  ];
  return items.filter((item) => item.platforms.includes(os));
}

export async function primeHelpers(ids) {
  const set = new Set(ids || []);
  const jobs = [];
  if (set.has("calendar")) jobs.push(primeCalendar());
  if (set.has("mail")) jobs.push(primeMail());
  if (set.has("messages")) jobs.push(primeMessages());
  await Promise.allSettled(jobs);
}

async function primeCalendar() {
  if (osKey() !== "darwin") return;
  try {
    await runCalendar(["list"]);
  } catch {
    /* OS dialog may have been dismissed */
  }
}

async function primeMail() {
  if (osKey() !== "darwin") return;
  try {
    await osascript('tell application "Mail" to get name', 25000);
  } catch {
    /* OS dialog may have been dismissed */
  }
}

async function primeMessages() {
  if (osKey() !== "darwin") return;
  try {
    await osascript('tell application "Messages" to get name', 25000);
  } catch {
    /* OS dialog may have been dismissed */
  }
}

const SOUND = {
  cat: "Miyav",
  dog: "Hav",
  turtle: "Tok tok",
  elephant: "Büüü",
  bird: "Cik cik",
  eagle: "Kriii",
  ghost: "Buggg",
  rabbit: "Piy piy",
};

const memory = { city: "", pendingWeather: false };

export function resetChatMemory() {
  memory.city = "";
  memory.pendingWeather = false;
}

export function parseIntent(text) {
  const raw = String(text || "").trim();
  const lower = raw.toLowerCase();
  if (!raw) return null;
  if (has(lower, ["mail", "e-posta", "eposta"]) && has(lower, ["sil", "delete"])) {
    return { server: "mail", tool: "delete", args: { query: after(lower, ["sil", "delete"]) } };
  }
  if (has(lower, ["mail", "e-posta", "eposta", "email"]) && has(lower, ["gönder", "gonder", "send"])) {
    return { server: "mail", tool: "send", args: { to: emailOf(text) || "", subject: "DigiPet", body: text } };
  }
  if (has(lower, ["mesaj", "imessage", "sms"]) && has(lower, ["sil", "delete"])) {
    return { server: "messages", tool: "delete", args: { query: after(lower, ["sil", "delete"]) } };
  }
  if (has(lower, ["mesaj", "imessage", "sms"]) && has(lower, ["gönder", "gonder", "yolla", "send", "mesaj at"])) {
    return { server: "messages", tool: "send", args: { to: after(lower, ["mesaj", "sms"]), body: text } };
  }
  const insertCal = has(lower, [
    "olay ekle",
    "add event",
    "add an event",
    "new event",
    "legg til hendelse",
    "olustur",
    "oluştur",
    "schedule",
  ]);
  if (
    insertCal &&
    has(lower, ["takvim", "toplantı", "toplanti", "meeting", "calendar", "randevu", "ajanda", "kalender", "olay", "event"])
  ) {
    return {
      server: "calendar",
      tool: "insert",
      args: { title: eventTitle(raw), days: daysOffset(lower), ...timeRange(raw) },
    };
  }
  if (has(lower, ["takvim", "toplantı", "toplanti", "meeting", "calendar", "randevu", "ajanda", "kalender"])) {
    if (
      has(lower, ["ekle", "add", "insert", "yeni", "new", "legg til", "legge til", "opprett", "olustur", "oluştur", "schedule"])
    ) {
      return {
        server: "calendar",
        tool: "insert",
        args: { title: eventTitle(raw), days: daysOffset(lower), ...timeRange(raw) },
      };
    }
    return { server: "calendar", tool: "upcoming", args: {} };
  }
  if (has(lower, ["hava", "weather", "sıcaklık", "sicaklik", "yağmur", "yagmur", "forecast", "vær", "vaer"])) {
    const city = cityOf(raw) || memory.city;
    memory.pendingWeather = !city;
    if (city) memory.city = city;
    return { server: "weather", tool: "current", args: { city } };
  }
  if (memory.pendingWeather && looksLikePlace(raw)) {
    const city = cityOf(raw) || raw;
    memory.city = city;
    memory.pendingWeather = false;
    return { server: "weather", tool: "current", args: { city } };
  }
  const quit = appAfter(lower, ["kapat ", "kapa ", "quit ", "close "], [" kapat", " kapa", " quit", " close"]);
  if (quit) return { server: "apps", tool: "quit", args: { app: quit } };
  const open = appAfter(lower, ["aç ", "ac ", "open "], [" aç", " ac", " open"]);
  if (open) return { server: "apps", tool: "open", args: { app: open } };
  if (has(lower, ["mail", "e-posta", "eposta", "inbox", "gelen kutusu"])) {
    return { server: "mail", tool: "list", args: {} };
  }
  return null;
}

export async function runMcp(intent) {
  const { server, tool, args } = intent;
  if (server === "weather" && tool === "current") return weather(args.city);
  if (server === "mail") return mail(tool, args);
  if (server === "calendar" && tool === "insert") return calendarInsert(args);
  if (server === "calendar") return calendar();
  if (server === "apps") return apps(tool, args.app);
  if (server === "messages") return messages(tool, args);
  throw new Error(t("unknownAgent"));
}

export function petReply(species, name, userText, toolText) {
  const sound = SOUND[species] || "Miyav";
  if (toolText) return `${sound}! ${toolText}`.slice(0, 500);
  const q = (userText || "").trim();
  if (!q) return `${sound}!`;
  return `${sound}! ${name} ${t("listen")} ${t("askHelpers")}`.slice(0, 500);
}

function has(t, words) {
  return words.some((w) => t.includes(w));
}

function after(t, keys) {
  for (const k of keys) {
    const i = t.indexOf(k);
    if (i >= 0) return t.slice(i + k.length).replace(/^[\s:,-]+/, "").trim();
  }
  return "";
}

function emailOf(text) {
  const m = String(text).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0] : "";
}

function cityOf(text) {
  const stop = new Set([
    "yarin",
    "yarın",
    "yarina",
    "yarına",
    "tomorrow",
    "bugun",
    "bugün",
    "today",
    "hava",
    "weather",
    "nasil",
    "nasıl",
    "how",
    "the",
    "in",
    "at",
    "ta",
    "te",
    "da",
    "de",
    "dan",
    "den",
    "for",
    "a",
    "an",
    "is",
    "what",
    "wie",
    "morgen",
    "vær",
    "vaer",
    "i",
    "og",
    "på",
    "pa",
    "will",
    "be",
    "like",
    "olacak",
    "olur",
    "nedir",
    "icin",
    "için",
    "bir",
    "city",
    "sehir",
    "şehir",
    "by",
    "kac",
    "kaç",
    "derece",
    "degree",
    "degrees",
    "celsius",
    "fahrenheit",
    "temp",
    "temperature",
    "sicaklik",
    "sıcaklık",
    "wind",
    "ruzgar",
    "rüzgar",
    "many",
    "much",
    "peki",
  ]);
  const cleaned = String(text || "")
    .replace(/['’](ta|te|da|de|dan|den)\b/gi, "")
    .replace(/[?¿!.,:;]/g, " ");
  const toks = cleaned.split(/[^A-Za-zÀ-ÿÇĞİÖŞÜçğıöşü-]+/).filter(Boolean);
  const places = toks.filter((w) => !stop.has(w.toLowerCase()) && w.length > 2);
  const capped = places.filter((w) => {
    const ch = w[0];
    return ch && ch === ch.toUpperCase() && ch !== ch.toLowerCase();
  });
  return (capped[0] || places[0] || "").replace(/[^A-Za-zÀ-ÿÇĞİÖŞÜçğıöşü-]/g, "");
}

function looksLikePlace(text) {
  const raw = String(text || "").trim();
  if (!raw || raw.length > 48) return false;
  if (/[?@]|https?:/i.test(raw)) return false;
  const words = raw.split(/\s+/);
  if (words.length > 4) return false;
  return Boolean(cityOf(raw) || /^[\p{L}][\p{L}\s-]{1,40}$/u.test(raw));
}

function daysOffset(lower) {
  if (has(lower, ["bugün", "bugun", "today", "i dag"])) return 0;
  if (has(lower, ["yarın", "yarin", "yarina", "yarına", "tomorrow", "i morgen"])) return 1;
  return 1;
}

function timeRange(text) {
  const m = String(text || "")
    .replace(/,/g, ".")
    .match(/(\d{1,2})[.:](\d{2})\s*[-–]\s*(\d{1,2})[.:](\d{2})/);
  if (!m) return { startH: 10, startM: 0, endH: 11, endM: 0 };
  return { startH: Number(m[1]), startM: Number(m[2]), endH: Number(m[3]), endM: Number(m[4]) };
}

function eventTitle(text) {
  const s = String(text || "")
    .replace(/\d{1,2}[.:]\d{2}(\s*[-–]\s*\d{1,2}[.:]\d{2})?/g, " ")
    .replace(/[?¿!.,:;]/g, " ")
    .replace(
      /\b(takvime|takvim|calendar|kalender|olay|event|hendelse|ekle|add|insert|yeni|new|legg til|legge til|opprett|oluştur\w*|olustur\w*|musun|misin|mısın|would you|can you|please|lütfen|lutfen|saat|clock|aras[ıi]nda|between|from|until|bir|an|the|en|et|to|into|onto|yar[ıi]na?|tomorrow|bug[uü]n|today|i morgen|i dag|peki|schedule)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
  return (s || "DigiPet").slice(0, 80);
}

function eventSummary(raw) {
  return String(raw || "DigiPet")
    .replace(/["\\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function localStamp(days, h, m) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(h, m, 0, 0);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:00`;
}

function hourNum(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function appAfter(t, prefixes, suffixes) {
  for (const p of prefixes) {
    if (t.startsWith(p)) {
      const name = t.slice(p.length).trim();
      if (name) return name;
    }
  }
  for (const s of suffixes) {
    if (t.endsWith(s)) {
      const name = t.slice(0, -s.length).trim();
      if (name && name.split(/\s+/).length <= 3) return name;
    }
  }
  return "";
}

function sanitize(raw) {
  return String(raw || "")
    .replace(/[^A-Za-z0-9 ._-]/g, "")
    .trim()
    .slice(0, 80);
}

function quote(s) {
  return String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function run(cmd, args, ms = 8000) {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      timeout: ms,
      maxBuffer: 1024 * 1024,
      killSignal: "SIGKILL",
    });
    return String(stdout || stderr || "").trim();
  } catch (err) {
    const msg = String(err?.message || err);
    if (err?.killed || /ETIMEDOUT|timed out/i.test(msg)) {
      throw new Error(t("timeout"));
    }
    if (/-1743|-1728|not authorised|not authorized|osascript is not allowed/i.test(msg)) {
      throw new Error(t("noPerm"));
    }
    throw err;
  }
}

async function osascript(script, ms = 8000) {
  return run("osascript", ["-e", script], ms);
}

async function powershell(script) {
  return run("powershell", ["-NoProfile", "-NonInteractive", "-Command", script]);
}

function pickPlace(results, q) {
  const list = Array.isArray(results) ? results : [];
  if (!list.length) return null;
  const name = String(q || "")
    .trim()
    .toLowerCase();
  const exact = list.filter((p) => String(p.name || "").toLowerCase() === name);
  const pool = exact.length ? exact : list;
  return pool.find((p) => p.country_code === "NO") || pool[0];
}

function calendarHelper() {
  const packed = process.resourcesPath ? path.join(process.resourcesPath, "native", "calendar") : "";
  if (packed && fs.existsSync(packed)) return packed;
  const bin = path.join(rootDir, "native", "calendar");
  if (fs.existsSync(bin)) return bin;
  const src = path.join(rootDir, "native", "calendar.m");
  if (process.platform !== "darwin" || !fs.existsSync(src)) return null;
  execFileSync("clang", ["-O2", "-fobjc-arc", "-o", bin, src, "-framework", "EventKit", "-framework", "Foundation"]);
  fs.chmodSync(bin, 0o755);
  return bin;
}

async function runCalendar(args, ms = 50000) {
  const bin = calendarHelper();
  if (!bin) throw new Error(t("calAccess"));
  try {
    const { stdout, stderr } = await execFileAsync(bin, args, {
      timeout: ms,
      maxBuffer: 1024 * 1024,
      killSignal: "SIGKILL",
    });
    return String(stdout || stderr || "").trim();
  } catch (err) {
    const out = String(err?.stdout || err?.stderr || "");
    if (/NEED_PERM/.test(out) || /NEED_PERM/.test(String(err?.message || ""))) return "NEED_PERM";
    if (err?.killed || /ETIMEDOUT|timed out/i.test(String(err?.message || ""))) {
      throw new Error(t("calAccess"));
    }
    throw err;
  }
}

function formatNextEvent(title, when, where) {
  const place = String(where || "").trim() || t("noPlace");
  return `${t("nextMeeting")} ${title} — ${when}. ${t("place")} ${place}`;
}

async function weather(city) {
  const q = (city || "").trim();
  if (!q) return t("weatherNeedCity");
  const geoRes = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=5&language=${lang() === "tr" ? "tr" : "en"}`,
  );
  const geo = await geoRes.json();
  const place = pickPlace(geo?.results, q);
  if (!place) return `${t("cityNotFound")} ${q}`;
  const fxRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current_weather=true&timezone=auto`,
  );
  const fx = await fxRes.json();
  const cw = fx?.current_weather || {};
  return `${place.name}: ${Math.round(cw.temperature ?? 0)}°C, rüzgar ${Math.round(cw.windspeed ?? 0)} km/s (Open-Meteo)`;
}

async function mail(kind, args) {
  const plat = osKey();
  if (kind === "list") {
    if (plat === "darwin") {
      return osascript(`tell application "Mail"
  set n to (count of messages of inbox)
  if n is 0 then return "Gelen kutusu boş."
  return (n as text) & " mail var (Apple Mail)."
end tell`);
    }
    if (plat === "win32") {
      return powershell(`$ol = New-Object -ComObject Outlook.Application
$n = $ol.Session.GetDefaultFolder(6).Items.Count
"$n mail var (Outlook)."`);
    }
    return "Linux’ta gelen kutusu otomatik okunmaz. Mail ajanı gönderim için xdg-email kullanır.";
  }
  if (kind === "send") {
    const to = sanitize(args.to);
    if (!to) return "Kime? Bir e-posta adresi yaz.";
    if (plat === "darwin") {
      return osascript(`tell application "Mail"
  set msg to make new outgoing message with properties {subject:"${quote(args.subject || "DigiPet")}", content:"${quote(args.body || "")}", visible:true}
  tell msg to make new to recipient at end of to recipients with properties {address:"${quote(to)}"}
  send msg
end tell
return "gönderildi"`);
    }
    if (plat === "win32") {
      return powershell(`$ol = New-Object -ComObject Outlook.Application
$m = $ol.CreateItem(0)
$m.To = "${quote(to)}"
$m.Subject = "${quote(args.subject || "DigiPet")}"
$m.Body = "${quote(args.body || "")}"
$m.Send()
"gönderildi"`);
    }
    await run("xdg-open", [`mailto:${to}`]);
    return "posta uygulaması açıldı";
  }
  if (kind === "delete") {
    if (plat === "darwin") {
      return osascript(`tell application "Mail"
  if (count of messages of inbox) is 0 then return "silinecek mail yok"
  delete (item 1 of (messages of inbox))
  return "son gelen mail silindi"
end tell`);
    }
    if (plat === "win32") {
      return powershell(`$ol = New-Object -ComObject Outlook.Application
$inbox = $ol.Session.GetDefaultFolder(6)
if ($inbox.Items.Count -eq 0) { "silinecek mail yok"; exit }
$inbox.Items.GetFirst().Delete()
"silindi"`);
    }
    return "Linux’ta mail silme yok.";
  }
  return "bilinmeyen mail işlemi";
}

async function calendar() {
  const plat = osKey();
  if (plat === "darwin") {
    const out = await runCalendar(["list"]);
    if (out === "NEED_PERM") return t("calAccess");
    if (!out || out === "NONE") return t("noEvents");
    const [title, when, where = ""] = out.split("\t");
    return formatNextEvent(title || "DigiPet", when || "", where);
  }
  if (plat === "win32") {
    return powershell(`$ol = New-Object -ComObject Outlook.Application
$cal = $ol.Session.GetDefaultFolder(9)
$items = $cal.Items
$items.Sort("[Start]")
$start = Get-Date
$end = $start.AddDays(60)
$next = $null
foreach ($it in $items) {
  try {
    $s = [datetime]$it.Start
    if ($s -ge $start -and $s -lt $end) { $next = $it; break }
  } catch {}
}
if (-not $next) { "${t("noEvents")}" } else {
  $loc = [string]$next.Location
  if (-not $loc) { $loc = "${t("noPlace")}" }
  "${t("nextMeeting")} $($next.Subject) — $($next.Start). ${t("place")} $loc"
}`);
  }
  try {
    return await run("khal", ["list", "today", "tomorrow"]);
  } catch {
    return t("noEvents");
  }
}

async function calendarInsert(args) {
  const title = eventSummary(args.title) || "DigiPet";
  const days = Number(args.days) === 0 ? 0 : 1;
  const startH = hourNum(args.startH, 10);
  const startM = hourNum(args.startM, 0);
  const endH = hourNum(args.endH, 11);
  const endM = hourNum(args.endM, 0);
  const plat = osKey();
  if (plat === "darwin") {
    const out = await runCalendar(["insert", title, localStamp(days, startH, startM), localStamp(days, endH, endM)]);
    if (out === "NEED_PERM") return t("calAccess");
    if (out === "OK") return `${t("eventAdded")} ${title}`;
    return out || `${t("eventAdded")} ${title}`;
  }
  if (plat === "win32") {
    return powershell(`$ol = New-Object -ComObject Outlook.Application
$m = $ol.CreateItem(1)
$m.Subject = "${quote(title)}"
$m.Start = (Get-Date).Date.AddDays(${days}).AddHours(${startH}).AddMinutes(${startM})
$m.End = (Get-Date).Date.AddDays(${days}).AddHours(${endH}).AddMinutes(${endM})
$m.Save()
"${t("eventAdded")} ${quote(title)}"`);
  }
  try {
    const day = days === 0 ? "today" : "tomorrow";
    await run("khal", ["new", `${day} ${pad2(startH)}:${pad2(startM)}`, `${pad2(endH)}:${pad2(endM)}`, title]);
    return `${t("eventAdded")} ${title}`;
  } catch {
    throw new Error(t("noEvents"));
  }
}

async function apps(kind, app) {
  const name = sanitize(app);
  if (!name) return "Hangi uygulama?";
  const plat = osKey();
  if (kind === "open") {
    if (plat === "darwin") {
      await run("open", ["-a", name]);
      return `${name} açıldı`;
    }
    if (plat === "win32") {
      await powershell(`Start-Process "${quote(name)}"`);
      return `${name} açıldı`;
    }
    try {
      await run("xdg-open", [name]);
    } catch {
      await run(name, []);
    }
    return `${name} açıldı`;
  }
  if (kind === "quit") {
    if (plat === "darwin") {
      await osascript(`tell application "${quote(name)}" to quit`);
      return `${name} kapatıldı`;
    }
    if (plat === "win32") {
      await powershell(`Get-Process | Where-Object { $_.ProcessName -like "*${quote(name)}*" } | Stop-Process -Force`);
      return `${name} kapatıldı`;
    }
    await run("pkill", ["-x", name]);
    return `${name} kapatıldı`;
  }
  return "bilinmeyen uygulama işlemi";
}

async function messages(kind, args) {
  if (osKey() !== "darwin") return "Mesaj ajanı bu işletim sisteminde sınırlı (iMessage yok).";
  if (kind === "send") {
    const to = sanitize(args.to);
    if (!to) return "Kime mesaj?";
    return osascript(`tell application "Messages"
  send "${quote(args.body || "")}" to buddy "${quote(to)}" of (1st service whose service type is iMessage)
end tell
return "mesaj gönderildi"`);
  }
  return "Messages silme sistem tarafından kısıtlı.";
}
