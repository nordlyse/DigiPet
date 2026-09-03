import { World } from "./engine/World";
import type { SpeciesId } from "./engine/types";

const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;
const labels = document.querySelector<HTMLElement>("#labels")!;
const bridge = window.digipet;

if (!bridge) {
  document.body.classList.add("web-fallback");
  document.body.innerHTML = `
    <main class="fallback">
      <h1>DigiPet masaüstünde yaşar</h1>
      <p>Tarayıcıda açılmaz. Terminalde şunu çalıştır:</p>
      <code>npm run desktop</code>
    </main>
  `;
} else {
  const world = new World(canvas, labels);
  world.setHitReporter((regions) => bridge.updateHitRegions(regions));
  world.sounds.setVolume(0.55);

  const boot = async () => {
    const cfg = await bridge.readyOverlay();
    world.sounds.setVolume(cfg.volume);
    if (cfg.overlay && cfg.workArea) world.setDesktop([], cfg.workArea, cfg.overlay);
    world.spawn(cfg.species);
  };

  bridge.onDesktop((data) => {
    world.setDesktop(data.windows, data.workArea, data.overlay);
  });
  bridge.onSpecies((id: SpeciesId) => world.spawn(id));
  bridge.onVolume((v) => world.sounds.setVolume(v));
  world.onChat = () => void bridge.openChat();
  bridge.onPetSay((text) => world.speak(text));
  void boot();
  window.addEventListener("pointerdown", () => void world.sounds.unlock(), { once: true });
}
