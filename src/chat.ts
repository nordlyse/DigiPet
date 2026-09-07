import { chatWithPet, resetChat } from "./ai/engine";
import { SPECIES } from "./pets/species";
import type { McpItem, SpeciesId } from "./engine/types";

const log = document.querySelector("#log")!;
const form = document.querySelector("#form")!;
const input = document.querySelector<HTMLInputElement>("#input")!;
const send = document.querySelector<HTMLButtonElement>("#send")!;
const status = document.querySelector("#status")!;
const title = document.querySelector("#title")!;
const closeBtn = document.querySelector<HTMLButtonElement>("#close")!;
const mcpPanel = document.querySelector<HTMLElement>("#mcp-panel")!;
const mcpList = document.querySelector("#mcp-list")!;
const mcpSave = document.querySelector<HTMLButtonElement>("#mcp-save")!;
const mcpSkip = document.querySelector<HTMLButtonElement>("#mcp-skip")!;

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
let mcpItems: McpItem[] = [];

function renderMcps(enabled: string[]) {
  const on = new Set(enabled);
  mcpList.innerHTML = "";
  for (const item of mcpItems) {
    const row = document.createElement("label");
    row.className = "mcp-row";
    row.innerHTML = `<input type="checkbox" value="${item.id}" ${on.has(item.id) ? "checked" : ""} />
      <span>
        <strong>${item.title}</strong>
        <em>${item.license}</em>
        ${item.description}
      </span>`;
    mcpList.append(row);
  }
}

function selectedMcps() {
  return [...mcpList.querySelectorAll<HTMLInputElement>("input:checked")].map((el) => el.value);
}

async function loadMcpPanel(force = false) {
  if (!window.digipet?.mcpCatalog) return;
  const data = await window.digipet.mcpCatalog();
  mcpItems = data.items ?? [];
  renderMcps(data.enabled ?? []);
  const want = force || new URLSearchParams(location.search).has("mcp") || !data.asked;
  mcpPanel.hidden = !want;
}

mcpSave.addEventListener("click", async () => {
  mcpSave.disabled = true;
  try {
    await window.digipet?.setMcps(selectedMcps());
    mcpPanel.hidden = true;
    status.textContent = "MCP araçları yüklendi";
  } catch (err) {
    status.textContent = err instanceof Error ? err.message : "MCP yüklenemedi";
  } finally {
    mcpSave.disabled = false;
  }
});

mcpSkip.addEventListener("click", async () => {
  await window.digipet?.setMcps([]);
  mcpPanel.hidden = true;
});

void species().then((s) => {
  lastSpecies = s.id;
  title.textContent = `${SPECIES[s.id].emoji} ${s.name}`;
});

void loadMcpPanel();
window.digipet?.onShowMcp(() => void loadMcpPanel(true));

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
    window.digipet?.petSay(reply, text);
    status.textContent = "Candle · SmolLM2-135M · MCP";
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sohbet başarısız";
    status.textContent = message;
    add("pet", "Motor hazır değil. rustup kurup `npm run build:native` çalıştır.");
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
