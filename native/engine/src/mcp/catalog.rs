use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct McpItem {
    pub id: &'static str,
    pub title: &'static str,
    pub description: &'static str,
    pub license: &'static str,
    pub platforms: &'static [&'static str],
}

pub const CATALOG: &[McpItem] = &[
    McpItem {
        id: "weather",
        title: "Hava durumu",
        description: "Open-Meteo (açık veri) ile şehir hava raporu. Anahtar gerekmez.",
        license: "MIT (araç) · Open-Meteo CC BY 4.0 (veri)",
        platforms: &["darwin", "win32", "linux"],
    },
    McpItem {
        id: "mail",
        title: "Mail",
        description: "Gelen kutusu oku, gönder, sil. macOS Mail, Windows Outlook, Linux xdg-email.",
        license: "MIT",
        platforms: &["darwin", "win32", "linux"],
    },
    McpItem {
        id: "calendar",
        title: "Takvim",
        description: "Bugünkü toplantı / etkinlik var mı bak.",
        license: "MIT",
        platforms: &["darwin", "win32", "linux"],
    },
    McpItem {
        id: "apps",
        title: "Uygulamalar",
        description: "Uygulama aç / kapat (Safari, Mail, Notepad, …).",
        license: "MIT",
        platforms: &["darwin", "win32", "linux"],
    },
    McpItem {
        id: "messages",
        title: "Mesajlar",
        description: "Mesaj gönder / son eşleşeni sil. macOS Messages; diğerlerinde sınırlı.",
        license: "MIT",
        platforms: &["darwin", "win32", "linux"],
    },
];

pub fn for_platform(os: &str) -> Vec<McpItem> {
    CATALOG
        .iter()
        .filter(|item| item.platforms.contains(&os))
        .cloned()
        .collect()
}
