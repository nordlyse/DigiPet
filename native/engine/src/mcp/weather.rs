use anyhow::{bail, Result};
use serde_json::Value;
use std::time::Duration;

fn agent() -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout(Duration::from_secs(10))
        .build()
}

pub fn current(args: &Value) -> Result<String> {
    let city = args
        .get("city")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("");
    if city.is_empty() {
        bail!("hangi şehir?");
    }
    let geo_url = format!(
        "https://geocoding-api.open-meteo.com/v1/search?name={}&count=1&language=tr",
        urlencoding::encode(city)
    );
    let geo: Value = agent().get(&geo_url).call()?.into_json()?;
    let place = geo
        .get("results")
        .and_then(Value::as_array)
        .and_then(|a| a.first())
        .cloned()
        .ok_or_else(|| anyhow::anyhow!("şehir bulunamadı: {city}"))?;
    let lat = place.get("latitude").and_then(Value::as_f64).unwrap_or(0.0);
    let lon = place.get("longitude").and_then(Value::as_f64).unwrap_or(0.0);
    let name = place
        .get("name")
        .and_then(Value::as_str)
        .unwrap_or(city);
    let fx_url = format!(
        "https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true&timezone=auto"
    );
    let fx: Value = agent().get(&fx_url).call()?.into_json()?;
    let cw = fx.get("current_weather").cloned().unwrap_or(Value::Null);
    let temp = cw.get("temperature").and_then(Value::as_f64).unwrap_or(0.0);
    let wind = cw.get("windspeed").and_then(Value::as_f64).unwrap_or(0.0);
    Ok(format!(
        "{name}: {temp:.0}°C, rüzgar {wind:.0} km/s (Open-Meteo)"
    ))
}
