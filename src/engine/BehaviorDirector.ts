import { PetActor, type PetTarget } from "./PetEngine";
import { FLOOR } from "./Platforms";
import { findScene } from "./scene";
import type { IdleAct, Platform, SpeciesId } from "./types";

export class BehaviorDirector {
  private nextThink = 0.4;

  update(dt: number, pets: PetActor[], platforms: Platform[]) {
    this.nextThink -= dt;
    if (this.nextThink > 0) return;
    this.nextThink = 0.28 + Math.random() * 0.35;

    const windows = platforms.filter((p) => !p.isFloor && p.maxX - p.minX > 80);
    for (const pet of pets) {
      if (pet.grabbed || pet.acting) continue;
      if (pet.state !== "idle" && pet.state !== "sit" && pet.state !== "sleep") continue;
      if (pet.age < pet.idleUntil) continue;
      if (Math.random() > 0.62) continue;
      const action = pickAction(pet, windows);
      applyAction(action, pet, windows);
    }
  }
}

type Action = "depth" | "stroll" | "climb" | "descend" | "nap" | "trick" | "watch" | "read" | "sway";

const TRICKS: Record<SpeciesId, IdleAct[]> = {
  cat: ["yawn", "stretch", "earWiggle", "sleep"],
  dog: ["earWiggle", "yawn", "stretch", "sleep"],
  turtle: ["turtleHide", "yawn", "sleep", "stretch"],
  elephant: ["trunkUp", "yawn", "sleep", "earWiggle"],
  bird: ["preen", "ruffle", "yawn", "sleep"],
  eagle: ["ruffle", "preen", "yawn", "sleep"],
  ghost: ["ghostPeek", "yawn", "sleep"],
  rabbit: ["earWiggle", "yawn", "stretch", "sleep"],
};

function pickTrick(id: SpeciesId): IdleAct {
  const pool = TRICKS[id];
  return pool[Math.floor(Math.random() * pool.length)];
}

function pickAction(pet: PetActor, windows: Platform[]): Action {
  const video = findScene(windows, "video");
  const mail = findScene(windows, "mail");
  const music = findScene(windows, "music");
  if (video && Math.random() < 0.78) return "watch";
  if (mail && Math.random() < 0.62) return "read";
  if (music && Math.random() < 0.48) return "sway";
  if (Math.random() < 0.34) return "trick";

  if (pet.platform.isFloor) {
    const near = windows.some((w) => pet.x >= w.minX - 90 && pet.x <= w.maxX + 90);
    const roll = Math.random();
    if (windows.length && near && roll < 0.78) return "climb";
    if (windows.length && roll < 0.42) return "climb";
    if (roll < 0.55) return "depth";
    if (roll < 0.86) return "stroll";
    return "nap";
  }
  const roll = Math.random();
  if (roll < 0.42) return "stroll";
  if (roll < 0.82) return "descend";
  return "nap";
}

function applyAction(action: Action, pet: PetActor, windows: Platform[]) {
  if (action === "trick") {
    pet.startAct(pickTrick(pet.species.id));
    return;
  }
  if (action === "nap") {
    pet.startAct(Math.random() < 0.55 ? "sleep" : "yawn");
    return;
  }
  if (action === "watch" || action === "read" || action === "sway") {
    attend(action, pet, windows);
    return;
  }

  const target = makeTarget(action, pet, windows);
  if (target) pet.goTo(target);
  else pet.idleUntil = pet.age + 0.8 + Math.random() * 1.8;
}

function attend(kind: "watch" | "read" | "sway", pet: PetActor, windows: Platform[]) {
  const scene = kind === "watch" ? "video" : kind === "read" ? "mail" : "music";
  const win = findScene(windows, scene);
  if (!win || pet.platform.id === win.id) {
    pet.startAct(kind);
    return;
  }
  const x = win.minX + 24 + Math.random() * Math.max(20, win.maxX - win.minX - 48);
  if (pet.species.climb === "jump" && pet.platform.isFloor && Math.abs(pet.x - x) > 160) {
    pet.goTo({
      x: THREE_CLAMP(x, FLOOR.minX, FLOOR.maxX),
      y: FLOOR.topY,
      depth: pet.depth,
      platform: FLOOR,
      mode: "walk",
    });
    return;
  }
  pet.goTo(
    {
      x,
      y: win.topY,
      depth: Math.min(0.92, pet.depth + 0.08),
      platform: win,
      mode: pet.species.climb,
    },
    kind,
  );
}

function makeTarget(action: Action, pet: PetActor, windows: Platform[]): PetTarget | null {
  if (action === "depth") {
    const depth = Math.random() < 0.5 ? 0.12 + Math.random() * 0.22 : 0.78 + Math.random() * 0.2;
    const x = THREE_CLAMP(pet.x + (Math.random() * 420 - 210), FLOOR.minX, FLOOR.maxX);
    return {
      x,
      y: FLOOR.topY,
      depth,
      platform: FLOOR,
      mode: pet.species.climb === "fly" && Math.random() < 0.4 ? "fly" : "walk",
    };
  }

  if (action === "stroll") {
    if (pet.platform.isFloor) {
      return {
        x: THREE_CLAMP(FLOOR.minX + 40 + Math.random() * Math.max(80, FLOOR.maxX - FLOOR.minX - 80), FLOOR.minX, FLOOR.maxX),
        y: FLOOR.topY,
        depth: pet.depth + (Math.random() * 0.3 - 0.15),
        platform: FLOOR,
        mode: "walk",
      };
    }
    const span = pet.platform.maxX - pet.platform.minX;
    return {
      x: pet.platform.minX + 20 + Math.random() * Math.max(30, span - 40),
      y: pet.platform.topY,
      depth: pet.depth,
      platform: pet.platform,
      mode: "walk",
    };
  }

  if (action === "climb" && windows.length) {
    const win = pickClimbable(pet, windows);
    const x = win.minX + 24 + Math.random() * Math.max(20, win.maxX - win.minX - 48);
    if (pet.species.climb === "jump" && Math.abs(pet.x - x) > 160) {
      return {
        x: THREE_CLAMP(x, FLOOR.minX, FLOOR.maxX),
        y: FLOOR.topY,
        depth: pet.depth,
        platform: FLOOR,
        mode: "walk",
      };
    }
    return {
      x,
      y: win.topY,
      depth: Math.min(0.92, pet.depth + 0.08),
      platform: win,
      mode: pet.species.climb,
    };
  }

  if (action === "descend") {
    return {
      x: THREE_CLAMP(pet.x + (Math.random() * 180 - 90), FLOOR.minX, FLOOR.maxX),
      y: FLOOR.topY,
      depth: 0.35 + Math.random() * 0.5,
      platform: FLOOR,
      mode: pet.species.climb === "fly" ? "fly" : "jump",
    };
  }

  return null;
}

function pickClimbable(pet: PetActor, windows: Platform[]) {
  const nearby = windows.filter((w) => Math.abs((w.minX + w.maxX) / 2 - pet.x) < 520);
  const pool = nearby.length ? nearby : windows;
  return pool[Math.floor(Math.random() * pool.length)];
}

function THREE_CLAMP(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}
