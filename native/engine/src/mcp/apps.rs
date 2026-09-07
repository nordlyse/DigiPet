use crate::os::{osascript, platform, powershell, quote_as, run, sanitize_name};
use anyhow::{bail, Result};
use serde_json::Value;

pub fn call(kind: &str, args: &Value) -> Result<String> {
    let app = sanitize_name(args.get("app").and_then(Value::as_str).unwrap_or(""));
    if app.is_empty() {
        bail!("hangi uygulama?");
    }
    match kind {
        "open" => open(&app),
        "quit" => quit(&app),
        _ => bail!("bilinmeyen uygulama aracı"),
    }
}

fn open(app: &str) -> Result<String> {
    match platform() {
        "darwin" => {
            run("open", &["-a", app])?;
            Ok(format!("{app} açıldı"))
        }
        "win32" => {
            powershell(&format!("Start-Process \"{}\"; \"açıldı\"", quote_as(app)))
        }
        _ => {
            if run("gtk-launch", &[app]).is_ok() || run("xdg-open", &[app]).is_ok() {
                Ok(format!("{app} açıldı"))
            } else {
                run(app, &[])?;
                Ok(format!("{app} açıldı"))
            }
        }
    }
}

fn quit(app: &str) -> Result<String> {
    match platform() {
        "darwin" => {
            osascript(&format!(
                r#"tell application "{}" to quit
return "kapatıldı""#,
                quote_as(app)
            ))
        }
        "win32" => powershell(&format!(
            r#"Get-Process | Where-Object {{ $_.ProcessName -like "*{}*" -or $_.MainWindowTitle -like "*{}*" }} | Stop-Process -Force
"kapatıldı""#,
            quote_as(app),
            quote_as(app)
        )),
        _ => {
            run("pkill", &["-x", app]).or_else(|_| run("pkill", &["-f", app]))?;
            Ok("kapatıldı".into())
        }
    }
}
