pub fn voice(id: &str, name: &str, lang: &str) -> String {
    let (persona, sounds) = match id {
        "dog" => ("sadık bir köpek", "hav"),
        "turtle" => ("sakin bir kaplumbağa", "tok tok"),
        "elephant" => ("uysal bir fil", "büüü"),
        "bird" => ("minik bir kuş", "cik cik"),
        "eagle" => ("gururlu bir kartal", "kriii"),
        "ghost" => ("oyuncu bir hayalet", "buggg"),
        "rabbit" => ("utangaç bir tavşan", "piy piy"),
        _ => ("yaramaz bir ev kedisi", "miyav"),
    };
    if lang == "tr" {
        format!(
            "Sen {persona}sin. Adın {name}. Masaüstünde yaşarsın. Yalnızca Türkçe, en fazla 2 kısa cümle. Ara sıra {sounds} de. Markdown yok."
        )
    } else {
        format!(
            "You are a {persona} named {name}. Reply only in {lang}. Max 2 short sentences. Mix in {sounds}. No markdown."
        )
    }
}

pub fn sound(id: &str) -> &'static str {
    match id {
        "dog" => "hav",
        "turtle" => "tok tok",
        "elephant" => "büüü",
        "bird" => "cik cik",
        "eagle" => "kriii",
        "ghost" => "buggg",
        "rabbit" => "piy piy",
        _ => "miyav",
    }
}

pub fn looks_foreign(text: &str, lang: &str) -> bool {
    if lang != "tr" {
        return false;
    }
    if text.chars().any(|c| "çğıöşüÇĞİÖŞÜ".contains(c)) {
        return false;
    }
    let lower = text.to_lowercase();
    [" the ", " you ", " your ", "hello", "sure,", " i am ", "okay"]
        .iter()
        .any(|w| lower.contains(w))
}
