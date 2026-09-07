use crate::os::{osascript, platform, quote_as, run, sanitize_name};
use anyhow::{bail, Result};
use serde_json::Value;

pub fn call(kind: &str, args: &Value) -> Result<String> {
    match kind {
        "send" => send(args),
        "delete" => delete(args),
        _ => bail!("bilinmeyen mesaj aracı"),
    }
}

fn send(args: &Value) -> Result<String> {
    let to = sanitize_name(args.get("to").and_then(Value::as_str).unwrap_or(""));
    let body = args.get("body").and_then(Value::as_str).unwrap_or("");
    if to.is_empty() || body.is_empty() {
        bail!("kime ve mesaj metni gerekir");
    }
    match platform() {
        "darwin" => osascript(&format!(
            r#"tell application "Messages"
  set t to buddy "{}" of (1st service whose service type is iMessage)
  send "{}" to t
end tell
return "mesaj gönderildi""#,
            quote_as(&to),
            quote_as(body)
        )),
        _ => {
            let mail = format!(
                "sms:{}?body={}",
                urlencoding::encode(&to),
                urlencoding::encode(body)
            );
            let _ = run("xdg-open", &[&mail]);
            Ok("bu platformda iMessage yok; SMS/mailto denendi".into())
        }
    }
}

fn delete(args: &Value) -> Result<String> {
    if platform() != "darwin" {
        bail!("mesaj silme yalnızca macOS Messages ile");
    }
    let query = args.get("query").and_then(Value::as_str).unwrap_or("");
    osascript(&format!(
        r#"tell application "Messages"
  -- Messages AppleScript silme sınırlıdır; sohbeti açmak yerine bilgi döner
  return "Messages silme sistem tarafından kısıtlı. Aranan: {}"
end tell"#,
        quote_as(query)
    ))
}
