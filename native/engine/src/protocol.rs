use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Deserialize)]
pub struct Request {
    pub id: String,
    pub cmd: String,
    #[serde(default)]
    #[serde(rename = "cacheDir")]
    pub cache_dir: Option<String>,
    #[serde(default)]
    pub mcps: Vec<String>,
    #[serde(default)]
    pub species: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default)]
    pub lang: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct Response {
    pub id: String,
    pub ok: bool,
    pub event: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pct: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub items: Option<Value>,
}

impl Response {
    pub fn progress(id: &str, pct: u32, label: &str) -> Self {
        Self {
            id: id.to_string(),
            ok: true,
            event: "progress".into(),
            pct: Some(pct),
            label: Some(label.into()),
            text: None,
            items: None,
        }
    }

    pub fn ready(id: &str) -> Self {
        Self {
            id: id.to_string(),
            ok: true,
            event: "ready".into(),
            pct: Some(100),
            label: Some("Hazır".into()),
            text: None,
            items: None,
        }
    }

    pub fn reply(id: &str, text: &str) -> Self {
        Self {
            id: id.to_string(),
            ok: true,
            event: "reply".into(),
            pct: None,
            label: None,
            text: Some(text.into()),
            items: None,
        }
    }

    pub fn catalog(id: &str, items: Value) -> Self {
        Self {
            id: id.to_string(),
            ok: true,
            event: "catalog".into(),
            pct: None,
            label: None,
            text: None,
            items: Some(items),
        }
    }

    pub fn error(id: &str, text: &str) -> Self {
        Self {
            id: id.to_string(),
            ok: false,
            event: "error".into(),
            pct: None,
            label: None,
            text: Some(text.into()),
            items: None,
        }
    }
}

pub fn emit(res: &Response) {
    if let Ok(line) = serde_json::to_string(res) {
        println!("{line}");
        let _ = std::io::Write::flush(&mut std::io::stdout());
    }
}
