import { Wllama, LoggerWithoutDebug } from "@wllama/wllama";
import wasmUrl from "@wllama/wllama/esm/wasm/wllama.wasm?url";
import { AI_MODEL, systemPrompt } from "./persona";
import { appLanguage, looksForeign } from "./locale";
import type { SpeciesId } from "../engine/types";

export type ProgressFn = (pct: number, label: string) => void;

let client: Wllama | null = null;
let ready = false;
const history: Array<{ role: "user" | "assistant"; content: string }> = [];

export async function ensureAi(progress: ProgressFn) {
  if (ready && client) return client;
  try {
    progress(2, "llama.cpp yükleniyor…");
    client = new Wllama(
      { default: wasmUrl },
      { logger: LoggerWithoutDebug, allowOffline: true },
    );
    progress(8, "SmolLM2-135M indiriliyor (~105 MB, bir kez)…");
    await client.loadModelFromHF(
      { repo: AI_MODEL.repo, file: AI_MODEL.file },
      {
        n_ctx: 512,
        n_threads: 2,
        n_batch: 128,
        n_gpu_layers: 0,
        progressCallback: ({ loaded, total }) => {
          const pct = total ? Math.min(95, Math.round((loaded / total) * 90) + 8) : 8;
          progress(pct, `Model ${Math.round((loaded / 1024 / 1024) * 10) / 10} MB`);
        },
      },
    );
    progress(100, "Hazır");
    ready = true;
    return client;
  } catch (err) {
    client = null;
    ready = false;
    throw err;
  }
}

export async function chatWithPet(species: SpeciesId, name: string, userText: string, progress: ProgressFn) {
  const llm = await ensureAi(progress);
  const lang = appLanguage();
  history.push({ role: "user", content: userText });
  if (history.length > 6) history.splice(0, history.length - 6);
  const ask = async (extra?: string) => {
    const res = await llm.createChatCompletion({
      messages: [
        { role: "system", content: systemPrompt(species, name, lang) + (extra ?? "") },
        ...history,
      ],
      max_tokens: 64,
      temperature: extra ? 0.4 : 0.8,
    });
    return (res.choices[0]?.message.content ?? "").trim() || "…";
  };
  let text = await ask();
  if (looksForeign(text, lang)) {
    text = await ask(` Repeat the same meaning strictly in ${lang === "tr" ? "Türkçe" : lang}.`);
  }
  history.push({ role: "assistant", content: text });
  return text;
}

export function resetChat() {
  history.length = 0;
}
