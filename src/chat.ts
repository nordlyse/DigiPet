import { chatWithPet, resetChat } from "./ai/engine";
import { SPECIES } from "./pets/species";
import type { SpeciesId } from "./engine/types";

const log = document.querySelector("#log")!;
const form = document.querySelector("#form")!;
const input = document.querySelector<HTMLInputElement>("#input")!;
const send = document.querySelector<HTMLButtonElement>("#send")!;
const status = document.querySelector("#status")!;
const title = document.querySelector("#title")!;
const closeBtn = document.querySelector<HTMLButtonElement>("#close")!;

function add(role: "user" | "pet", text: string) {
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  el.textContent = text;
  log.append(el);
  log.scrollTop = log.scrollHeight;
}

async function species(): Promise<{ id: SpeciesId; name: string }> {
  const cfg = await window.digipet?.getConfig();
  const id = (cfg?.species ?? "cat") as SpeciesId;
  return { id, name: SPECIES[id].nameTr };
}

let lastSpecies: SpeciesId | null = null;

void species().then((s) => {
  lastSpecies = s.id;
  title.textContent = `${SPECIES[s.id].emoji} ${s.name}`;
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || send.disabled) return;
  input.value = "";
  add("user", text);
  send.disabled = true;
  try {
    const s = await species();
    if (lastSpecies && lastSpecies !== s.id) resetChat();
    lastSpecies = s.id;
    title.textContent = `${SPECIES[s.id].emoji} ${s.name}`;
    const reply = await chatWithPet(s.id, s.name, text, (pct, label) => {
      status.textContent = `${label} (${pct}%)`;
    });
    add("pet", reply);
    window.digipet?.petSay(reply);
    status.textContent = "llama.cpp · SmolLM2-135M · çevrimdışı";
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sohbet başarısız";
    status.textContent = message;
    add("pet", "Şu an konuşamıyorum. İnternet ilk indirme için gerekir.");
  } finally {
    send.disabled = false;
    input.focus();
  }
});

closeBtn.addEventListener("click", () => {
  if (window.digipet?.closeChat) void window.digipet.closeChat();
  else window.close();
});

input.focus();
