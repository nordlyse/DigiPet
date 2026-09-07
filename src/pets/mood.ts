import type { SpeciesId } from "../engine/types";

export type Mood = "happy" | "sad" | "scared" | "angry" | "curious" | "neutral";

const RULES: Array<{ mood: Mood; re: RegExp }> = [
  {
    mood: "sad",
    re: /üzgün|üzül|ağla|agla|öldü|ölüm|hasta|kaybet|özled|yaln[iı]z|mutsuz|keder|keşke|ağlıyor|miss you|sad|cry|died?|death|lonely|sorry|heartbroken|depressed/i,
  },
  {
    mood: "scared",
    re: /kork|öcü|korkunç|ürper|kaç\b|scary|afraid|fear|spook|terror|panic/i,
  },
  {
    mood: "angry",
    re: /kızgın|öfke|nefret|aptal|sinir|kötü adam|angry|hate|stupid|furious|mad at/i,
  },
  {
    mood: "happy",
    re: /mutlu|seviyor|aşığım|harika|süper|tebrik|güld|sevinç|oyun|öpücük|yaşasın|happy|love|yay|haha|great|awesome|good boy|good girl|cute/i,
  },
  {
    mood: "curious",
    re: /\?|neden|ni[cç]in|niye|nasıl|nerede|kim\b|ne zaman|why|how|what|where|who/i,
  },
];

export function detectMood(...parts: Array<string | undefined>) {
  const text = parts.filter(Boolean).join(" ");
  if (!text.trim()) return "neutral" as const;
  for (const rule of RULES) {
    if (rule.re.test(text)) return rule.mood;
  }
  return "neutral" as const;
}

export function moodSound(id: SpeciesId, mood: Mood) {
  const table: Record<SpeciesId, Record<Mood, string>> = {
    cat: { happy: "miyav miyav", sad: "mrrrr", scared: "hssss", angry: "mıyyav", curious: "miyav?", neutral: "miyav" },
    dog: { happy: "hav hav hav", sad: "huuuu", scared: "vırrr", angry: "hav!", curious: "hav?", neutral: "hav hav" },
    turtle: { happy: "tok tok tok", sad: "tok…", scared: "tok!", angry: "tok tok", curious: "tok?", neutral: "tok tok" },
    elephant: { happy: "büüü bü", sad: "büüüü", scared: "büü!", angry: "bü", curious: "bü?", neutral: "büüü" },
    bird: { happy: "cik cik cik", sad: "ciiik ciik", scared: "ciii", angry: "cik!", curious: "cik?", neutral: "cik cik" },
    eagle: { happy: "kriii kri", sad: "krııı", scared: "kreee", angry: "kri!", curious: "kri?", neutral: "kriii" },
    ghost: { happy: "buggg", sad: "buuugg", scared: "BUGGG", angry: "bugg", curious: "bugg?", neutral: "buggg" },
    rabbit: { happy: "piy piy piy", sad: "piiii", scared: "piy!", angry: "piy", curious: "piy?", neutral: "piy piy" },
  };
  return table[id][mood];
}
