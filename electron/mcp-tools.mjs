import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { lang, t } from "./i18n.mjs";

const execFileAsync = promisify(execFile);

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
      license: "MIT yardımcı · Open-Meteo veri CC BY 4.0",
      platforms: ["darwin", "win32", "linux"],
    },
    {
      id: "mail",
      title: win ? "Mail (Outlook)" : mac ? "Mail (Apple Mail)" : "Mail (xdg-email)",
      description: mac
        ? "Mac Mail gelen kutusu oku, gönder, sil."
        : win
          ? "Outlook gelen kutusu oku, gönder, sil."
          : "Linux’ta gönderim xdg-email ile; okuma sınırlı.",
      license: mac
        ? "MIT yardımcı · Apple Mail kendi koşulları"
        : win
          ? "MIT yardımcı · Outlook kendi koşulları"
          : "MIT yardımcı · xdg-email / posta uygulaması kendi koşulları",
      platforms: ["darwin", "win32", "linux"],
    },
    {
      id: "calendar",
      title: win ? "Takvim (Outlook)" : mac ? "Takvim (Calendar)" : "Takvim (khal)",
      description: t("calendarDesc"),
      license: mac
        ? "MIT yardımcı · Apple Calendar kendi koşulları"
        : win
          ? "MIT yardımcı · Outlook kendi koşulları"
          : "MIT yardımcı · khal / takvim uygulaması kendi koşulları",
      platforms: ["darwin", "win32", "linux"],
    },
    {
      id: "apps",
      title: "Uygulamalar",
      description: mac
        ? "Safari, Mail, Finder gibi uygulamaları aç / kapat."
        : win
          ? "Notepad, Outlook gibi uygulamaları aç / kapat."
          : "xdg-open / gtk-launch ile uygulama aç / kapat.",
      license: "MIT yardımcı · açılan uygulamalar kendi koşulları",
      platforms: ["darwin", "win32", "linux"],
    },
    {
      id: "messages",
      title: mac ? "Mesajlar (Messages)" : "Mesajlar",
      description: mac
        ? "iMessage gönder / silmeyi dene."
        : "Bu işletim sisteminde iMessage yok; SMS/mailto denenir.",
      license: mac
        ? "MIT yardımcı · Apple Messages kendi koşulları"
        : "MIT yardımcı · mesaj / SMS uygulaması kendi koşulları",
      platforms: ["darwin", "win32", "linux"],
    },
  ];
  return items.filter((item) => item.platforms.includes(os));
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
  if (has(lower, ["olay ekle", "add event", "add an event", "new event", "legg til hendelse"])) {
    return {
      server: "calendar",
      tool: "insert",
      args: { title: eventTitle(raw), days: daysOffset(lower) },
    };
  }
  if (has(lower, ["takvim", "toplantı", "toplanti", "meeting", "calendar", "randevu", "ajanda", "kalender"])) {
    if (has(lower, ["ekle", "add", "insert", "yeni", "new", "legg til", "legge til", "opprett"])) {
      return {
        server: "calendar",
        tool: "insert",
        args: { title: eventTitle(raw), days: daysOffset(lower) },
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
    "the",
    "city",
    "sehir",
    "şehir",
    "by",
  ]);
  const cleaned = String(text || "")
    .replace(/['’](ta|te|da|de|dan|den)\b/gi, "")
    .replace(/[?¿!.,:;]/g, " ");
  const toks = cleaned.split(/[^A-Za-zÀ-ÿÇĞİÖŞÜçğıöşü-]+/).filter(Boolean);
  const places = toks.filter((w) => !stop.has(w.toLowerCase()) && w.length > 2);
  return (places[places.length - 1] || places[0] || "").replace(/[^A-Za-zÀ-ÿÇĞİÖŞÜçğıöşü-]/g, "");
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
  return 1;
}

function eventTitle(text) {
  const s = String(text || "")
    .replace(
      /takvime|takvim|calendar|kalender|olay|event|hendelse|toplant[ıi]|meeting|møte|mote|ekle|add|insert|yeni|new|legg til|legge til|opprett|bir|an|a|the|en|et|to|into|onto|yar[ıi]n|tomorrow|bug[uü]n|today|i morgen|i dag/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
  return (s || "DigiPet").slice(0, 80);
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

async function weather(city) {
  const q = (city || "").trim();
  if (!q) return t("weatherNeedCity");
  const geoRes = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=${lang() === "tr" ? "tr" : "en"}`,
  );
  const geo = await geoRes.json();
  const place = geo?.results?.[0];
  if (!place) return `Şehir bulunamadı: ${q}`;
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
    return osascript(`tell application "Calendar"
  with timeout of 6 seconds
    set now to current date
    set later to now + (24 * 60 * 60)
    set n to 0
    set shown to {}
    repeat with c in calendars
      try
        set evs to (every event of c whose start date ≥ now and start date < later)
        set n to n + (count of evs)
        repeat with e in evs
          if (count of shown) < 3 then set end of shown to (summary of e as text)
        end repeat
      end try
      if (count of shown) ≥ 3 then exit repeat
    end repeat
    if n is 0 then return "${t("noEvents")}"
    set bits to shown as text
    return (n as text) & " ${t("eventsAre")} " & bits
  end timeout
end tell`);
  }
  if (plat === "win32") {
    return powershell(`$ol = New-Object -ComObject Outlook.Application
$cal = $ol.Session.GetDefaultFolder(9)
$start = Get-Date
$end = $start.AddHours(24)
$n = 0
foreach ($it in $cal.Items) { try { $s = [datetime]$it.Start; if ($s -ge $start -and $s -lt $end) { $n++ } } catch {} }
if ($n -eq 0) { "önümüzdeki 24 saatte toplantı yok" } else { "$n toplantı var (Outlook)." }`);
  }
  try {
    return await run("khal", ["list", "today", "tomorrow"]);
  } catch {
    return t("noEvents");
  }
}

async function calendarInsert(args) {
  const title = sanitize(args.title) || "DigiPet";
  const days = Number(args.days) === 0 ? 0 : 1;
  const plat = osKey();
  if (plat === "darwin") {
    return osascript(
      `tell application "Calendar"
  with timeout of 12 seconds
    set startDate to (current date) + (${days} * days)
    set hours of startDate to 10
    set minutes of startDate to 0
    set seconds of startDate to 0
    set endDate to startDate + (1 * hours)
    set cal to missing value
    try
      set cal to first calendar whose writable is true
    end try
    if cal is missing value then set cal to first calendar
    tell cal
      make new event with properties {summary:"${quote(title)}", start date:startDate, end date:endDate}
    end tell
    return "${t("eventAdded")} ${quote(title)}"
  end timeout
end tell`,
      15000,
    );
  }
  if (plat === "win32") {
    return powershell(`$ol = New-Object -ComObject Outlook.Application
$m = $ol.CreateItem(1)
$m.Subject = "${quote(title)}"
$m.Start = (Get-Date).Date.AddDays(${days}).AddHours(10)
$m.End = $m.Start.AddHours(1)
$m.Save()
"${t("eventAdded")} ${quote(title)}"`);
  }
  try {
    await run("khal", ["new", days === 0 ? "today 10:00" : "tomorrow 10:00", title]);
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
