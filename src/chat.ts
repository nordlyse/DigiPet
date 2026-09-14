import { chatWithPet, resetChat } from "./ai/engine";
import { SPECIES } from "./pets/species";
import type { McpItem, SpeciesId } from "./engine/types";
import { agentLicenseSummary } from "./licenses";
import { lang, petName, setLang, t } from "../electron/i18n.mjs";

const log = document.querySelector("#log")!;
const form = document.querySelector<HTMLFormElement>("#form")!;
const input = document.querySelector<HTMLTextAreaElement>("#input")!;
const send = document.querySelector<HTMLButtonElement>("#send")!;
const status = document.querySelector("#status")!;
const title = document.querySelector("#title")!;
const closeBtn = document.querySelector<HTMLButtonElement>("#close")!;
const mcpPanel = document.querySelector<HTMLElement>("#mcp-panel")!;
const mcpList = document.querySelector("#mcp-list")!;
const mcpSave = document.querySelector<HTMLButtonElement>("#mcp-save")!;
const mcpSkip = document.querySelector<HTMLButtonElement>("#mcp-skip")!;
const mcpLicense = document.querySelector("#mcp-license")!;

function applyCopy() {
  document.documentElement.lang = lang();
  document.querySelector("#meta")!.textContent = t("chatMeta");
  document.querySelector("#mcp-heading")!.textContent = t("mcpHeading");
  document.querySelector("#mcp-intro")!.textContent = t("mcpIntro");
  status.textContent = t("chatStatus");
  closeBtn.textContent = t("close");
  send.textContent = t("send");
  input.placeholder = t("placeholder");
  mcpSave.textContent = t("mcpSave");
  mcpSkip.textContent = t("mcpSkip");
}

function add(role: "user" | "pet", text: string) {
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  const body = document.createElement("div");
  body.textContent = text;
  const copyBtn = document.createElement("button");
  copyBtn.type = "button";
  copyBtn.className = "copy";
  copyBtn.textContent = t("copy");
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = t("copied");
      setTimeout(() => {
        copyBtn.textContent = t("copy");
      }, 1200);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(body);
      const sel = getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      document.execCommand("copy");
    }
  });
  el.append(body, copyBtn);
  log.append(el);
  log.scrollTop = log.scrollHeight;
}

async function species(): Promise<{ id: SpeciesId; name: string }> {
  const cfg = await window.digipet?.getConfig();
  if (cfg?.lang) setLang(cfg.lang);
  applyCopy();
  const id = (cfg?.species ?? "cat") as SpeciesId;
  return { id, name: petName(id) };
}

let lastSpecies: SpeciesId | null = null;
let mcpItems: McpItem[] = [];

function refreshLicense() {
  const note = agentLicenseSummary(mcpItems, selectedMcps());
  mcpLicense.textContent = note.text;
  mcpLicense.classList.toggle("multi", note.count > 1);
}

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
  refreshLicense();
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
    status.textContent = t("mcpLoaded");
  } catch (err) {
    status.textContent = err instanceof Error ? err.message : t("unknownAgent");
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
mcpList.addEventListener("change", () => refreshLicense());

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    form.requestSubmit();
  }
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
    window.digipet?.petSay(reply, text);
    status.textContent = t("ready");
  } catch (err) {
    const message = err instanceof Error ? err.message : t("unknownAgent");
    status.textContent = message;
    add("pet", message);
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
