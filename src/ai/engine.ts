import { appLanguage } from "./locale";
import type { SpeciesId } from "../engine/types";

export type ProgressFn = (pct: number, label: string) => void;

export async function chatWithPet(species: SpeciesId, name: string, userText: string, progress: ProgressFn) {
  if (!window.digipet?.chatPet) throw new Error("Sohbet yalnızca masaüstü uygulamasında çalışır.");
  const off = window.digipet.onEngineProgress(progress);
  try {
    progress(4, "Candle motoru…");
    const text = await window.digipet.chatPet({
      species,
      name,
      text: userText,
      lang: appLanguage(),
    });
    progress(100, "Hazır");
    return (text ?? "").trim() || "…";
  } finally {
    off?.();
  }
}

export function resetChat() {
  void window.digipet?.chatPet({
    species: "cat",
    name: "Pet",
    text: "",
    reset: true,
  });
}
