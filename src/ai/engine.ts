import { appLanguage } from "./locale";
import type { SpeciesId } from "../engine/types";
import { t } from "../../electron/i18n.mjs";

export type ProgressFn = (pct: number, label: string) => void;

export async function chatWithPet(species: SpeciesId, name: string, userText: string, progress: ProgressFn) {
  if (!window.digipet?.chatPet) throw new Error(t("talk"));
  const off = window.digipet.onEngineProgress(progress);
  try {
    progress(8, t("looking"));
    const text = await window.digipet.chatPet({
      species,
      name,
      text: userText,
      lang: appLanguage(),
    });
    progress(100, t("ready"));
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
