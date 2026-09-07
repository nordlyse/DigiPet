use crate::os::{osascript, platform, powershell, run};
use anyhow::Result;
use serde_json::Value;

pub fn upcoming(_args: &Value) -> Result<String> {
    match platform() {
        "darwin" => osascript(
            r#"tell application "Calendar"
  set now to current date
  set later to now + (24 * 60 * 60)
  set acc to {}
  repeat with c in calendars
    set evs to (every event of c whose start date ≥ now and start date < later)
    repeat with e in evs
      set end of acc to (summary of e) & " @ " & ((start date of e) as text)
    end repeat
  end repeat
  if (count of acc) is 0 then return "önümüzdeki 24 saatte toplantı yok"
  set AppleScript's text item delimiters to linefeed
  return "toplantılar:" & linefeed & (acc as text)
end tell"#,
        ),
        "win32" => powershell(
            r#"$ol = New-Object -ComObject Outlook.Application
$cal = $ol.Session.GetDefaultFolder(9)
$start = Get-Date
$end = $start.AddHours(24)
$acc = @()
foreach ($it in $cal.Items) {
  try {
    $s = [datetime]$it.Start
    if ($s -ge $start -and $s -lt $end) { $acc += ($it.Subject + " @ " + $s) }
  } catch {}
}
if ($acc.Count -eq 0) { "önümüzdeki 24 saatte toplantı yok" } else { "toplantılar:`n" + ($acc -join "`n") }"#,
        ),
        _ => {
            if run("which", &["khal"]).is_ok() {
                run("khal", &["list", "today", "tomorrow"])
            } else {
                Ok("Linux takvimi için khal yok. gnome-calendar MCP okuyamaz; khal kuruluysa listeler.".into())
            }
        }
    }
}
