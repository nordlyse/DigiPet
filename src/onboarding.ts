import * as THREE from "three";
import { addPetModel } from "./pets/addPet";
import { SPECIES, SPECIES_ORDER } from "./pets/species";
import type { McpItem, SpeciesId } from "./engine/types";

const preview = document.querySelector<HTMLCanvasElement>("#preview")!;
const stepPet = document.querySelector<HTMLElement>("#step-pet")!;
const stepMcp = document.querySelector<HTMLElement>("#step-mcp")!;
const mcpList = document.querySelector("#mcp-list")!;
const mcpTitle = document.querySelector("#mcp-title")!;
const mcpLead = document.querySelector("#mcp-lead")!;
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
  document.querySelector("#blurb")!.textContent = `${spec.emoji} ${spec.blurb}`;
  document.querySelector("#next")!.textContent = askedAlready
    ? `${spec.nameTr} ile devam`
    : "Devam — ajanları seç";
  document.querySelector("#go")!.textContent = `${spec.nameTr} ile başla`;
}

const grid = document.querySelector("#grid")!;
for (const id of SPECIES_ORDER) {
  const s = SPECIES[id];
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "pet-card";
  btn.dataset.id = id;
  btn.innerHTML = `<span class="emoji">${s.emoji}</span><span class="name">${s.nameTr}</span><span class="sound">“${s.sound}”</span><span class="move">${s.climb === "fly" ? "uçar" : "zıplar"}</span>`;
  btn.addEventListener("click", () => show(id));
  grid.append(btn);
}

let t = 0;
const loop = () => {
  requestAnimationFrame(loop);
  t += 0.016;
  model.root.rotation.y = t * 0.7;
  model.wings.forEach((wing, i) => {
    wing.rotation.z = (i === 0 ? 1 : -1) * (0.2 + Math.sin(t * 10) * 0.4);
  });
  renderer.render(scene, camera);
};
loop();
show("cat");

function selectedMcps() {
  return [...mcpList.querySelectorAll<HTMLInputElement>("input:checked")].map((el) => el.value);
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
}

async function loadMcps() {
  if (!window.digipet?.mcpCatalog) return;
  const data = await window.digipet.mcpCatalog();
  mcpItems = data.items ?? [];
  const os = data.os || "OS";
  mcpTitle.textContent = `${os} ajanları`;
  mcpLead.textContent = `${os} için yardımcıları seç. Pet sohbette yalnızca işaretlediklerini kullanır (hava, mail, takvim, uygulama, mesaj).`;
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
document.querySelector("#go")!.addEventListener("click", async () => {
  await finish(selectedMcps());
});
document.querySelector("#mcp-skip")!.addEventListener("click", async () => {
  await finish([]);
});

window.digipet?.onOnboardingStep?.((step) => {
  if (step === "mcp") showMcp();
  else showPet();
});

void window.digipet?.getConfig().then((cfg) => {
  askedAlready = cfg.mcpAsked === true;
  if (cfg.species) show(cfg.species);
  else show(selected);
  if (new URLSearchParams(location.search).get("step") === "mcp" || (cfg.onboarded && !cfg.mcpAsked)) {
    mcpOnly = true;
    showMcp();
  }
});
