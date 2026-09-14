import { World } from "./engine/World";
import type { SpeciesId } from "./engine/types";
import { setLang } from "../electron/i18n.mjs";

const canvas = document.querySelector<HTMLCanvasElement>("#scene")!;
const labels = document.querySelector<HTMLElement>("#labels")!;
const bridge = window.digipet;

if (!bridge) {
  document.body.classList.add("web-fallback");
  document.body.innerHTML = `
    <main class="fallback">
      <h1>DigiPet lives on the desktop</h1>
      <p>It does not open in a browser. In a terminal run:</p>
      <code>npm run desktop</code>
    </main>
  `;
} else {
  const world = new World(canvas, labels);
  world.setHitReporter((regions) => bridge.updateHitRegions(regions));
  world.sounds.setVolume(0.55);

  const boot = async () => {
    const cfg = await bridge.readyOverlay();
    if (cfg.lang) {
      setLang(cfg.lang);
      document.documentElement.lang = cfg.lang;
    }
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
  bridge.onPetSay((data) => {
    if (typeof data === "string") world.speak(data);
    else world.speak(data.text, data.prompt);
  });
  void boot();
  window.addEventListener("pointerdown", () => void world.sounds.unlock(), { once: true });
}
