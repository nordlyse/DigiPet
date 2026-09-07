use serde_json::{json, Value};

pub struct Intent {
    pub server: &'static str,
    pub tool: &'static str,
    pub args: Value,
}

pub fn parse(text: &str) -> Option<Intent> {
    let t = text.to_lowercase();
    if is_mail_delete(&t) {
        return Some(Intent {
            server: "mail",
            tool: "delete",
            args: json!({ "query": extract_after(&t, &["sil", "delete"]) }),
        });
    }
    if is_mail_send(&t) {
        return Some(Intent {
            server: "mail",
            tool: "send",
            args: json!({
                "to": extract_email(text).unwrap_or_default(),
                "subject": "DigiPet",
                "body": text,
            }),
        });
    }
    if is_msg_delete(&t) {
        return Some(Intent {
            server: "messages",
            tool: "delete",
            args: json!({ "query": extract_after(&t, &["sil", "delete"]) }),
        });
    }
    if is_msg_send(&t) {
        return Some(Intent {
            server: "messages",
            tool: "send",
            args: json!({
                "to": extract_after(&t, &["mesaj", "imessage", "sms"]),
                "body": text,
            }),
        });
    }
    if has_any(&t, &["takvim", "toplantı", "toplanti", "meeting", "calendar", "randevu", "ajanda"]) {
        return Some(Intent {
            server: "calendar",
            tool: "upcoming",
            args: json!({}),
        });
    }
    if has_any(&t, &["hava", "weather", "sıcaklık", "sicaklik", "yağmur", "yagmur", "forecast"]) {
        return Some(Intent {
            server: "weather",
            tool: "current",
            args: json!({ "city": extract_city(text) }),
        });
    }
    if let Some(app) = extract_app_quit(&t) {
        return Some(Intent {
            server: "apps",
            tool: "quit",
            args: json!({ "app": app }),
        });
    }
    if let Some(app) = extract_app_open(&t) {
        return Some(Intent {
            server: "apps",
            tool: "open",
            args: json!({ "app": app }),
        });
    }
    if has_any(&t, &["mail", "e-posta", "eposta", "inbox", "gelen kutusu"]) {
        return Some(Intent {
            server: "mail",
            tool: "list",
            args: json!({}),
        });
    }
    None
}

fn has_any(t: &str, words: &[&str]) -> bool {
    words.iter().any(|w| t.contains(w))
}

fn is_mail_delete(t: &str) -> bool {
    has_any(t, &["mail", "e-posta", "eposta"]) && has_any(t, &["sil", "delete"])
}

fn is_mail_send(t: &str) -> bool {
    has_any(t, &["mail", "e-posta", "eposta", "email"]) && has_any(t, &["gönder", "gonder", "send"])
}

fn is_msg_delete(t: &str) -> bool {
    has_any(t, &["mesaj", "imessage", "sms"]) && has_any(t, &["sil", "delete"])
}

fn is_msg_send(t: &str) -> bool {
    has_any(t, &["mesaj", "imessage", "sms"])
        && has_any(t, &["gönder", "gonder", "yolla", "send", "mesaj at", "sms at"])
}

fn extract_email(text: &str) -> Option<String> {
    text.split_whitespace()
        .find(|w| w.contains('@') && w.contains('.'))
        .map(|w| {
            w.trim_matches(|c: char| !c.is_ascii_alphanumeric() && c != '@' && c != '.' && c != '_' && c != '-' && c != '+')
                .to_string()
        })
}

fn extract_city(text: &str) -> String {
    const CITIES: &[&str] = &[
        "istanbul", "ankara", "izmir", "bursa", "antalya", "adana", "konya", "trabzon",
        "berlin", "paris", "london", "madrid", "roma", "vienna", "oslo", "stockholm",
        "amsterdam", "zurich", "tokyo", "seoul", "new york", "los angeles",
    ];
    let lower = text.to_lowercase();
    if let Some(city) = CITIES.iter().find(|c| lower.contains(*c)) {
        return city.to_string();
    }
    text.split_whitespace()
        .rev()
        .find(|w| w.chars().next().map(|c| c.is_uppercase()).unwrap_or(false) && w.len() > 2)
        .unwrap_or("")
        .trim_matches(|c: char| !c.is_alphabetic())
        .to_string()
}

fn extract_after<'a>(t: &'a str, keys: &[&str]) -> String {
    for k in keys {
        if let Some(i) = t.find(k) {
            return t[i + k.len()..].trim().trim_matches(|c: char| matches!(c, ':' | '-' | ',')).to_string();
        }
    }
    String::new()
}

fn extract_app_open(t: &str) -> Option<String> {
    for prefix in ["aç ", "ac ", "open "] {
        if let Some(rest) = t.strip_prefix(prefix) {
            let name = rest.trim();
            if !name.is_empty() {
                return Some(name.to_string());
            }
        }
    }
    for suffix in [" aç", " ac", " open"] {
        if let Some(rest) = t.strip_suffix(suffix) {
            let name = rest.trim();
            if !name.is_empty() && name.split_whitespace().count() <= 3 {
                return Some(name.to_string());
            }
        }
    }
    None
}

fn extract_app_quit(t: &str) -> Option<String> {
    for prefix in ["kapat ", "kapa ", "quit ", "close "] {
        if let Some(rest) = t.strip_prefix(prefix) {
            let name = rest.trim();
            if !name.is_empty() {
                return Some(name.to_string());
            }
        }
    }
    for suffix in [" kapat", " kapa", " quit", " close"] {
        if let Some(rest) = t.strip_suffix(suffix) {
            let name = rest.trim();
            if !name.is_empty() && name.split_whitespace().count() <= 3 {
                return Some(name.to_string());
            }
        }
    }
    None
}
