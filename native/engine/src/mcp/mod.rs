mod apps;
mod calendar;
mod catalog;
mod mail;
mod messages;
mod weather;

pub use catalog::{for_platform, McpItem};

use anyhow::{bail, Result};
use serde_json::Value;
use std::collections::HashSet;

pub fn call_tool(enabled: &HashSet<String>, server: &str, tool: &str, args: &Value) -> Result<String> {
    if !enabled.contains(server) {
        bail!("{server} MCP yüklü değil");
    }
    match (server, tool) {
        ("weather", "current") => weather::current(args),
        ("mail", kind) => mail::call(kind, args),
        ("calendar", "upcoming") => calendar::upcoming(args),
        ("apps", kind) => apps::call(kind, args),
        ("messages", kind) => messages::call(kind, args),
        _ => bail!("bilinmeyen MCP aracı: {server}.{tool}"),
    }
}

pub fn tool_hint(enabled: &HashSet<String>) -> String {
    let mut names = enabled.iter().cloned().collect::<Vec<_>>();
    names.sort();
    if names.is_empty() {
        "yüklü MCP yok".into()
    } else {
        format!("yüklü MCP: {}", names.join(", "))
    }
}
