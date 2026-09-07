mod llm;
mod mcp;
mod os;
mod persona;
mod protocol;
mod router;

use anyhow::Result;
use llm::Llm;
use os::platform;
use protocol::{emit, Request, Response};
use serde_json::json;
use std::collections::HashSet;
use std::io::{self, BufRead};
use std::path::PathBuf;

struct Engine {
    llm: Option<Llm>,
    mcps: HashSet<String>,
    history: Vec<(String, String)>,
    cache: PathBuf,
}

impl Engine {
    fn new() -> Self {
        Self {
            llm: None,
            mcps: HashSet::new(),
            history: Vec::new(),
            cache: std::env::temp_dir().join("digipet-engine"),
        }
    }

    fn init(&mut self, req: &Request) -> Result<()> {
        if let Some(dir) = &req.cache_dir {
            self.cache = PathBuf::from(dir);
        }
        self.mcps = req.mcps.iter().cloned().collect();
        std::fs::create_dir_all(&self.cache)?;
        let id = req.id.clone();
        emit(&Response::progress(&id, 4, "Candle (Apache-2.0) açılıyor…"));
        match Llm::load(&self.cache, |pct, label| {
            emit(&Response::progress(&id, pct, label));
        }) {
            Ok(llm) => {
                self.llm = Some(llm);
                emit(&Response::ready(&id));
            }
            Err(err) => {
                emit(&Response::progress(
                    &id,
                    90,
                    &format!("model yok ({err}); MCP araçları çalışır"),
                ));
                emit(&Response::ready(&id));
            }
        }
        Ok(())
    }

    fn chat(&mut self, req: &Request) -> Result<()> {
        let text = req.text.clone().unwrap_or_default();
        let species = req.species.clone().unwrap_or_else(|| "cat".into());
        let name = req.name.clone().unwrap_or_else(|| "Pet".into());
        let lang = req.lang.clone().unwrap_or_else(|| "tr".into());
        let mut user_for_model = text.clone();
        if let Some(intent) = router::parse(&text) {
            match mcp::call_tool(&self.mcps, intent.server, intent.tool, &intent.args) {
                Ok(result) => {
                    user_for_model = format!(
                        "{text}\n\n[MCP {}.{} sonucu]: {result}\nBunu kısa hayvan cümlesiyle özetle.",
                        intent.server, intent.tool
                    );
                }
                Err(err) => {
                    user_for_model = format!(
                        "{text}\n\n[MCP {}.{} hata]: {err}\nKullanıcıya nazikçe söyle.",
                        intent.server, intent.tool
                    );
                }
            }
        }
        let system = format!(
            "{} {}",
            persona::voice(&species, &name, &lang),
            mcp::tool_hint(&self.mcps)
        );
        let prompt = llm::chat_prompt(&system, &self.history, &user_for_model);
        let reply = if let Some(llm) = self.llm.as_mut() {
            let mut text = llm.complete(&prompt, 72)?;
            if persona::looks_foreign(&text, &lang) {
                let retry = format!("{user_for_model}\nYalnızca Türkçe yaz.");
                text = llm.complete(&llm::chat_prompt(&system, &self.history, &retry), 72)?;
            }
            if text.is_empty() {
                format!("{} …", persona::sound(&species))
            } else {
                text
            }
        } else {
            fallback_reply(&species, &user_for_model)
        };
        self.history.push((text, reply.clone()));
        if self.history.len() > 6 {
            self.history.remove(0);
        }
        emit(&Response::reply(&req.id, &reply));
        Ok(())
    }
}

fn fallback_reply(species: &str, user: &str) -> String {
    let sound = persona::sound(species);
    if let Some(note) = user.split("[MCP ").nth(1) {
        let body = note.split("]: ").nth(1).unwrap_or(note);
        return format!("{sound}! {}", body.lines().next().unwrap_or(body));
    }
    format!("{sound}! Şu an model yok ama MCP araçlarını deneyebilirsin.")
}

fn main() {
    let mut engine = Engine::new();
    let stdin = io::stdin();
    for line in stdin.lock().lines() {
        let Ok(line) = line else { break };
        if line.trim().is_empty() {
            continue;
        }
        let req: Request = match serde_json::from_str(&line) {
            Ok(r) => r,
            Err(err) => {
                emit(&Response::error("-", &format!("istek okunamadı: {err}")));
                continue;
            }
        };
        let result = match req.cmd.as_str() {
            "init" => engine.init(&req),
            "chat" => engine.chat(&req),
            "set-mcps" => {
                engine.mcps = req.mcps.iter().cloned().collect();
                emit(&Response::ready(&req.id));
                Ok(())
            }
            "catalog" => {
                emit(&Response::catalog(
                    &req.id,
                    json!(mcp::for_platform(platform())),
                ));
                Ok(())
            }
            "reset" => {
                engine.history.clear();
                emit(&Response::ready(&req.id));
                Ok(())
            }
            other => {
                emit(&Response::error(&req.id, &format!("bilinmeyen komut: {other}")));
                Ok(())
            }
        };
        if let Err(err) = result {
            emit(&Response::error(&req.id, &format!("{err:#}")));
        }
    }
}
