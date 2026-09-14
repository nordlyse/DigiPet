import * as THREE from "three";
import { addPetModel } from "./pets/addPet";
import { SPECIES, SPECIES_ORDER } from "./pets/species";
import type { McpItem, SpeciesId } from "./engine/types";
import { agentLicenseSummary } from "./licenses";
import { lang, petName, setLang, t } from "../electron/i18n.mjs";

const preview = document.querySelector<HTMLCanvasElement>("#preview")!;
const stepPet = document.querySelector<HTMLElement>("#step-pet")!;
const stepMcp = document.querySelector<HTMLElement>("#step-mcp")!;
const mcpList = document.querySelector("#mcp-list")!;
const mcpTitle = document.querySelector("#mcp-title")!;
const mcpLead = document.querySelector("#mcp-lead")!;
const licenseNote = document.querySelector("#license-note")!;
let selected: SpeciesId = "cat";
let mcpItems: McpItem[] = [];
let mcpOnly = false;
let askedAlready = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 40);
camera.position.set(0, 1.1, 4.2);
const renderer = new THREE.WebGLRenderer({ canvas: preview, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 1.1));
const sun = new THREE.DirectionalLight(0xfff1d0, 1);
sun.position.set(2, 4, 3);
scene.add(sun);
const fill = new THREE.DirectionalLight(0xd5e7ff, 0.75);
fill.position.set(-2, 2, -4);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xfff1e0, 0.4);
rim.position.set(0, 1.4, 4);
scene.add(rim);
let model = addPetModel(selected);
scene.add(model.root);

const bootLang = new URLSearchParams(location.search).get("lang");
if (bootLang) setLang(bootLang);
document.documentElement.lang = lang();

function resize() {
  const w = preview.clientWidth || 280;
  const h = preview.clientHeight || 280;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
resize();

function show(id: SpeciesId) {
  scene.remove(model.root);
  selected = id;
  model = addPetModel(id);
  scene.add(model.root);
  document.querySelectorAll(".pet-card").forEach((el) => {
    el.classList.toggle("on", (el as HTMLElement).dataset.id === id);
  });
  const spec = SPECIES[id];
  document.querySelector("#blurb")!.textContent = `${spec.emoji} ${t(`blurb_${id}`)}`;
  document.querySelector("#next")!.textContent = askedAlready
    ? `${t("continueWith")} ${petName(id)}`
    : t("nextAgents");
  document.querySelector("#go")!.textContent = `${t("startWith")} ${petName(id)}`;
}

const grid = document.querySelector("#grid")!;

function fillGrid() {
  grid.innerHTML = "";
  for (const id of SPECIES_ORDER) {
    const s = SPECIES[id];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pet-card";
    btn.dataset.id = id;
    btn.innerHTML = `<span class="emoji">${s.emoji}</span><span class="name">${petName(id)}</span><span class="sound">“${s.sound}”</span><span class="move">${s.climb === "fly" ? t("fly") : t("jump")}</span>`;
    btn.addEventListener("click", () => show(id));
    grid.append(btn);
  }
}

let tick = 0;
const loop = () => {
  requestAnimationFrame(loop);
  tick += 0.016;
  model.root.rotation.y = tick * 0.7;
  model.wings.forEach((wing, i) => {
    wing.rotation.z = (i === 0 ? 1 : -1) * (0.2 + Math.sin(tick * 10) * 0.4);
  });
  renderer.render(scene, camera);
};
loop();

function selectedMcps() {
  return [...mcpList.querySelectorAll<HTMLInputElement>("input:checked")].map((el) => el.value);
}

function refreshLicense() {
  const note = agentLicenseSummary(mcpItems, selectedMcps());
  licenseNote.textContent = note.text;
  licenseNote.classList.toggle("multi", note.count > 1);
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

async function loadMcps() {
  if (!window.digipet?.mcpCatalog) return;
  const data = await window.digipet.mcpCatalog();
  mcpItems = data.items ?? [];
  const os = data.os || "OS";
  mcpTitle.textContent = `${os} ${t("mcpTitle")}`;
  mcpLead.textContent = t("mcpLead");
  renderMcps(data.enabled ?? []);
}

function showMcp() {
  mcpOnly = mcpOnly || new URLSearchParams(location.search).get("step") === "mcp";
  stepPet.hidden = true;
  stepMcp.hidden = false;
  document.querySelector<HTMLButtonElement>("#mcp-back")!.hidden = mcpOnly;
  void loadMcps();
}

function showPet() {
  stepMcp.hidden = true;
  stepPet.hidden = false;
  resize();
}

async function finish(mcps: string[]) {
  const bridge = window.digipet;
  if (!bridge) return;
  await bridge.completeOnboarding({ species: selected, mcps });
}

document.querySelector("#next")!.addEventListener("click", async () => {
  if (askedAlready) {
    const cfg = await window.digipet?.getConfig();
    await finish(cfg?.mcps ?? []);
    return;
  }
  showMcp();
});
document.querySelector("#mcp-back")!.addEventListener("click", () => showPet());
mcpList.addEventListener("change", () => refreshLicense());
document.querySelector("#go")!.addEventListener("click", async () => {
  const btn = document.querySelector<HTMLButtonElement>("#go")!;
  btn.disabled = true;
  btn.textContent = t("looking");
  try {
    await finish(selectedMcps());
  } finally {
    btn.disabled = false;
    btn.textContent = `${t("startWith")} ${petName(selected)}`;
  }
});
document.querySelector("#mcp-skip")!.addEventListener("click", async () => {
  const btn = document.querySelector<HTMLButtonElement>("#mcp-skip")!;
  btn.disabled = true;
  try {
    await finish([]);
  } finally {
    btn.disabled = false;
  }
});

window.digipet?.onOnboardingStep?.((step) => {
  if (step === "mcp") showMcp();
  else showPet();
});

function applyCopy() {
  document.documentElement.lang = lang();
  document.title = t("setupTitle");
  document.querySelector("#setup-title")!.textContent = t("setupTitle");
  document.querySelector("#setup-lead")!.textContent = t("setupLead");
  document.querySelector("#mcp-back")!.textContent = t("back");
  document.querySelector("#mcp-skip")!.textContent = t("skipHelpers");
}

void window.digipet?.getConfig().then((cfg) => {
  if (cfg.lang) setLang(cfg.lang);
  applyCopy();
  askedAlready = cfg.needsSetup === false;
  fillGrid();
  if (cfg.species) show(cfg.species);
  else show(selected);
  if (new URLSearchParams(location.search).get("step") === "mcp") {
    mcpOnly = true;
    showMcp();
  } else if (cfg.needsSetup !== false) {
    showPet();
  }
});
