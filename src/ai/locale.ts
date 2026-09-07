/** UI language the app was shipped/loaded with (`<html lang>`). */
export function appLanguage() {
  const lang = (document.documentElement.lang || "tr").slice(0, 2).toLowerCase();
  return lang || "tr";
}

export function languageName(lang = appLanguage()) {
  const names: Record<string, string> = {
    tr: "Türkçe",
    en: "English",
    de: "Deutsch",
    fr: "Français",
    es: "Español",
    it: "Italiano",
    pt: "Português",
    ru: "Русский",
    ja: "日本語",
    zh: "中文",
    ar: "العربية",
    nl: "Nederlands",
    pl: "Polski",
  };
  return names[lang] ?? "Türkçe";
}

export function looksForeign(text: string, lang = appLanguage()) {
  if (lang !== "tr") return false;
  if (/[çğıöşüÇĞİÖŞÜ]/.test(text)) return false;
  return /\b(the|you|your|hello|hi there|sure|what|i am|i'm|yes|okay|ok|please|thanks)\b/i.test(text);
}
