import { execFile } from "node:child_process";
import { promisify } from "node:util";

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
      title: "Hava durumu",
      description: "Open-Meteo ile şehir hava raporu (anahtar gerekmez).",
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
      description: "Önümüzdeki 24 saatte toplantı / etkinlik var mı bak.",
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

export function parseIntent(text) {
  const t = (text || "").toLowerCase();
  if (!t.trim()) return null;
  if (has(t, ["mail", "e-posta", "eposta"]) && has(t, ["sil", "delete"])) {
    return { server: "mail", tool: "delete", args: { query: after(t, ["sil", "delete"]) } };
  }
  if (has(t, ["mail", "e-posta", "eposta", "email"]) && has(t, ["gönder", "gonder", "send"])) {
    return { server: "mail", tool: "send", args: { to: emailOf(text) || "", subject: "DigiPet", body: text } };
  }
  if (has(t, ["mesaj", "imessage", "sms"]) && has(t, ["sil", "delete"])) {
    return { server: "messages", tool: "delete", args: { query: after(t, ["sil", "delete"]) } };
  }
  if (has(t, ["mesaj", "imessage", "sms"]) && has(t, ["gönder", "gonder", "yolla", "send", "mesaj at"])) {
    return { server: "messages", tool: "send", args: { to: after(t, ["mesaj", "sms"]), body: text } };
  }
  if (has(t, ["takvim", "toplantı", "toplanti", "meeting", "calendar", "randevu", "ajanda"])) {
    return { server: "calendar", tool: "upcoming", args: {} };
  }
  if (has(t, ["hava", "weather", "sıcaklık", "sicaklik", "yağmur", "yagmur", "forecast"])) {
    return { server: "weather", tool: "current", args: { city: cityOf(text) } };
  }
  const quit = appAfter(t, ["kapat ", "kapa ", "quit ", "close "], [" kapat", " kapa", " quit", " close"]);
  if (quit) return { server: "apps", tool: "quit", args: { app: quit } };
  const open = appAfter(t, ["aç ", "ac ", "open "], [" aç", " ac", " open"]);
  if (open) return { server: "apps", tool: "open", args: { app: open } };
  if (has(t, ["mail", "e-posta", "eposta", "inbox", "gelen kutusu"])) {
    return { server: "mail", tool: "list", args: {} };
  }
  return null;
}

export async function runMcp(intent) {
  const { server, tool, args } = intent;
  if (server === "weather" && tool === "current") return weather(args.city);
  if (server === "mail") return mail(tool, args);
  if (server === "calendar") return calendar();
  if (server === "apps") return apps(tool, args.app);
  if (server === "messages") return messages(tool, args);
  throw new Error("bilinmeyen ajan");
}

export function petReply(species, name, userText, toolText) {
  const sound = SOUND[species] || "Miyav";
  if (toolText) return `${sound}! ${toolText}`.slice(0, 500);
  const q = (userText || "").trim();
  if (!q) return `${sound}!`;
  return `${sound}! ${name} dinledi: “${q.slice(0, 120)}”. Hava, mail, takvim veya uygulama sor; seçtiğin ajanlarla bakabilirim.`.slice(0, 500);
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
  const cities = [
    "istanbul",
    "ankara",
    "izmir",
    "bursa",
    "antalya",
    "adana",
    "berlin",
    "paris",
    "london",
    "tokyo",
  ];
  const lower = text.toLowerCase();
  const hit = cities.find((c) => lower.includes(c));
  if (hit) return hit;
  const tok = text
    .split(/\s+/)
    .reverse()
    .find((w) => /^[A-ZÇĞİÖŞÜ]/.test(w) && w.length > 2);
  return (tok || "").replace(/[^A-Za-zÇĞİÖŞÜçğıöşü-]/g, "");
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

async function run(cmd, args) {
  const { stdout, stderr } = await execFileAsync(cmd, args, { timeout: 12000, maxBuffer: 1024 * 1024 });
  return String(stdout || stderr || "").trim();
}

async function osascript(script) {
  return run("osascript", ["-e", script]);
}

async function powershell(script) {
  return run("powershell", ["-NoProfile", "-NonInteractive", "-Command", script]);
}

async function weather(city) {
  const q = (city || "").trim();
  if (!q) return "Hangi şehir? Örneğin: İstanbul hava nasıl?";
  const geoRes = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=tr`,
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
  set now to current date
  set later to now + (24 * 60 * 60)
  set n to 0
  repeat with c in calendars
    set n to n + (count of (every event of c whose start date ≥ now and start date < later))
  end repeat
  if n is 0 then return "önümüzdeki 24 saatte toplantı yok"
  return (n as text) & " toplantı / etkinlik var (Calendar)."
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
    return "Linux takvimi için khal yok.";
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
