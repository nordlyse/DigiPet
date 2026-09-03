import * as THREE from "three";
import { createPetModel } from "./pets/createPet";
import { SPECIES, SPECIES_ORDER } from "./pets/species";
import type { SpeciesId } from "./engine/types";

const preview = document.querySelector<HTMLCanvasElement>("#preview")!;
let selected: SpeciesId = "cat";

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
let model = createPetModel(selected);
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
  model = createPetModel(id);
  scene.add(model.root);
  document.querySelectorAll(".pet-card").forEach((el) => {
    el.classList.toggle("on", (el as HTMLElement).dataset.id === id);
  });
  const spec = SPECIES[id];
  document.querySelector("#blurb")!.textContent = `${spec.emoji} ${spec.blurb}`;
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

document.querySelector("#go")!.addEventListener("click", async () => {
  const bridge = window.digipet;
  if (!bridge) return;
  await bridge.completeOnboarding(selected);
});

void window.digipet?.getConfig().then((cfg) => {
  if (cfg.species) show(cfg.species);
});
