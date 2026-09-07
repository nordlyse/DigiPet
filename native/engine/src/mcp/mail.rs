use crate::os::{osascript, platform, powershell, quote_as, run, sanitize_name};
use anyhow::{bail, Result};
use serde_json::Value;

pub fn call(kind: &str, args: &Value) -> Result<String> {
    match kind {
        "list" => list(args),
        "send" => send(args),
        "delete" => delete(args),
        _ => bail!("bilinmeyen mail aracı"),
    }
}

fn list(_args: &Value) -> Result<String> {
    match platform() {
        "darwin" => osascript(
            r#"tell application "Mail"
  set msgs to messages of inbox
  set n to (count of msgs)
  if n is 0 then return "Gelen kutusu boş."
  set acc to {}
  repeat with i from 1 to (n as integer)
    if i > 5 then exit repeat
    set m to item i of msgs
    set end of acc to (subject of m) & " — " & (sender of m)
  end repeat
  set AppleScript's text item delimiters to linefeed
  return (n as text) & " mail. Sonlar:" & linefeed & (acc as text)
end tell"#,
        ),
        "win32" => powershell(
            r#"$ol = New-Object -ComObject Outlook.Application
$inbox = $ol.Session.GetDefaultFolder(6)
$n = $inbox.Items.Count
$lines = @("$n mail.")
$i = 0
foreach ($it in $inbox.Items) {
  if ($i -ge 5) { break }
  $lines += ($it.Subject + " — " + $it.SenderName)
  $i++
}
$lines -join "`n""#,
        ),
        _ => Ok("Linux’ta gelen kutusu okumak için Mail MCP yerel istemciye bağlı. Thunderbird/Evolution otomatik okunmaz; gönderim xdg-email ile yapılır.".into()),
    }
}

fn send(args: &Value) -> Result<String> {
    let to = sanitize_name(args.get("to").and_then(Value::as_str).unwrap_or(""));
    let subject = args.get("subject").and_then(Value::as_str).unwrap_or("DigiPet");
    let body = args.get("body").and_then(Value::as_str).unwrap_or("");
    if to.is_empty() {
        bail!("kime?");
    }
    match platform() {
        "darwin" => {
            let script = format!(
                r#"tell application "Mail"
  set msg to make new outgoing message with properties {{subject:"{}", content:"{}", visible:true}}
  tell msg to make new to recipient at end of to recipients with properties {{address:"{}"}}
  send msg
end tell
return "gönderildi""#,
                quote_as(subject),
                quote_as(body),
                quote_as(&to)
            );
            osascript(&script)
        }
        "win32" => {
            let script = format!(
                r#"$ol = New-Object -ComObject Outlook.Application
$m = $ol.CreateItem(0)
$m.To = "{}"
$m.Subject = "{}"
$m.Body = "{}"
$m.Send()
"gönderildi""#,
                quote_as(&to),
                quote_as(subject),
                quote_as(body)
            );
            powershell(&script)
        }
        _ => {
            let mailto = format!(
                "mailto:{}?subject={}&body={}",
                urlencoding::encode(&to),
                urlencoding::encode(subject),
                urlencoding::encode(body)
            );
            run("xdg-email", &[&mailto]).or_else(|_| run("xdg-open", &[&mailto]))?;
            Ok("posta uygulaması açıldı".into())
        }
    }
}

fn delete(args: &Value) -> Result<String> {
    let query = args.get("query").and_then(Value::as_str).unwrap_or("");
    match platform() {
        "darwin" => {
            let script = if query.trim().is_empty() {
                r#"tell application "Mail"
  if (count of messages of inbox) is 0 then return "silinecek mail yok"
  delete (item 1 of (messages of inbox))
  return "son gelen mail silindi"
end tell"#
                    .to_string()
            } else {
                format!(
                    r#"tell application "Mail"
  set hits to (messages of inbox whose subject contains "{}")
  if (count of hits) is 0 then return "eşleşen mail yok"
  delete (item 1 of hits)
  return "eşleşen mail silindi"
end tell"#,
                    quote_as(query)
                )
            };
            osascript(&script)
        }
        "win32" => {
            let q = quote_as(query);
            let script = format!(
                r#"$ol = New-Object -ComObject Outlook.Application
$inbox = $ol.Session.GetDefaultFolder(6)
if ($inbox.Items.Count -eq 0) {{ "silinecek mail yok"; exit }}
$q = "{q}"
$it = $null
if ($q -ne "") {{ $it = $inbox.Items | Where-Object {{ $_.Subject -like "*$q*" }} | Select-Object -First 1 }}
if (-not $it) {{ $it = $inbox.Items.GetFirst() }}
$it.Delete()
"silindi""#
            );
            powershell(&script)
        }
        _ => bail!("Linux’ta mail silme desteklenmiyor"),
    }
}
