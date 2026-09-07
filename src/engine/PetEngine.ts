import * as THREE from "three";
import type { SoundEngine } from "../audio/SoundEngine";
import { addPetModel, type PetRig } from "../pets/addPet";
import { SPECIES } from "../pets/species";
import { detectMood, moodSound, type Mood } from "../pets/mood";
import { FLOOR, platformAt } from "./Platforms";
import type { IdleAct, PetState, Platform, Rect, Species, SpeciesId } from "./types";

export interface PetTarget {
  x: number;
  y: number;
  depth: number;
  platform: Platform;
  mode: "walk" | "fly" | "jump";
}

let nextId = 1;

export class PetActor {
  readonly id = nextId++;
  readonly species: Species;
  readonly group: THREE.Group;
  readonly rig: PetRig;
  state: PetState = "idle";
  x: number;
  y: number;
  depth = 0.72;
  vx = 0;
  vy = 0;
  facing = 1;
  platform: Platform = FLOOR;
  target: PetTarget | null = null;
  idleUntil = 0;
  age = Math.random() * 10;
  hopPhase = 0;
  grabbed = false;
  label: HTMLDivElement;
  bubble: HTMLDivElement;
  bubbleUntil = 0;
  mood: Mood = "neutral";
  moodUntil = 0;
  act: IdleAct | null = null;
  actUntil = 0;
  private pendingAct: IdleAct | null = null;
  private lastSoundAt = -10;
  private motionT = 0;
  private motionDur = 1;
  private fromX = 0;
  private fromY = 0;
  private fromDepth = 0;
  private lift = 0;
  private dragTrail: Array<{ x: number; y: number; t: number }> = [];

  constructor(
    speciesId: SpeciesId,
    spawn: { x: number; y: number },
    private sounds: SoundEngine,
    labelsRoot: HTMLElement,
  ) {
    this.species = SPECIES[speciesId];
    this.rig = addPetModel(speciesId);
    this.group = new THREE.Group();
    this.group.add(this.rig.root);
    this.x = spawn.x;
    this.y = spawn.y;
    this.group.userData.petId = this.id;
    this.label = document.createElement("div");
    this.label.className = "pet-label";
    this.label.textContent = `${this.species.emoji} ${this.species.nameTr}`;
    this.bubble = document.createElement("div");
    this.bubble.className = "pet-bubble hidden";
    labelsRoot.append(this.label, this.bubble);
  }

  get pixelSize() {
    return 78 * this.species.scale * (0.62 + this.depth * 0.78);
  }

  get speed() {
    return this.species.speed * 92;
  }

  hitRect(): Rect {
    const s = this.pixelSize;
    return { x: this.x - s * 0.55, y: this.y - s * 1.35, w: s * 1.1, h: s * 1.45 };
  }

  dispose() {
    this.label.remove();
    this.bubble.remove();
  }

  say(text: string, seconds = 1.4) {
    this.bubble.textContent = text;
    this.bubble.classList.remove("hidden");
    this.bubbleUntil = this.age + seconds;
  }

  emote(text: string, prompt?: string, seconds = 4.2) {
    this.mood = detectMood(prompt, text);
    this.moodUntil = this.age + 3.4;
    this.lastSoundAt = this.age;
    void this.sounds.emote(this.species.id, this.mood);
    this.say(`${moodSound(this.species.id, this.mood)}\n${text}`, seconds);
  }

  cry(force = false) {
    if (!force && this.age - this.lastSoundAt < 1.6) return;
    this.lastSoundAt = this.age;
    void this.sounds.play(this.species.id);
    this.say(this.species.sound);
  }

  get acting() {
    return !!this.act && this.age < this.actUntil;
  }

  startAct(kind: IdleAct, seconds?: number) {
    if (this.grabbed) return;
    this.target = null;
    this.pendingAct = null;
    this.act = kind;
    this.actUntil = this.age + (seconds ?? actDuration(kind));
    this.idleUntil = this.actUntil + 0.35;
    this.state = kind === "sleep" ? "sleep" : "sit";
  }

  grab() {
    this.grabbed = true;
    this.state = "drag";
    this.target = null;
    this.act = null;
    this.pendingAct = null;
    this.vy = 0;
    this.dragTrail = [];
  }

  release() {
    this.grabbed = false;
    const recent = this.dragTrail.slice(-6);
    if (recent.length >= 2) {
      const a = recent[0];
      const b = recent[recent.length - 1];
      const dt = Math.max(0.016, b.t - a.t);
      this.vx = (b.x - a.x) / dt;
      this.vy = (b.y - a.y) / dt;
    }
    this.state = "fall";
    this.platform = FLOOR;
  }

  dragTo(x: number, y: number, time: number) {
    this.x = x;
    this.y = y;
    this.dragTrail.push({ x, y, t: time });
    if (this.dragTrail.length > 10) this.dragTrail.shift();
  }

  goTo(target: PetTarget, thenAct?: IdleAct) {
    this.act = null;
    this.pendingAct = thenAct ?? null;
    this.target = target;
    this.state = target.mode === "walk" ? "walk" : target.mode;
    if (this.state === "fly" || this.state === "jump") {
      this.motionT = 0;
      this.fromX = this.x;
      this.fromY = this.y;
      this.fromDepth = this.depth;
      const dist = Math.hypot(target.x - this.x, target.y - this.y);
      this.motionDur =
        this.state === "fly"
          ? 0.7 + dist / 900
          : 0.42 + dist / 1100 + (this.species.mass > 1.8 ? 0.18 : 0);
      this.lift = this.state === "fly" ? 90 + this.species.scale * 40 : 55 + Math.min(140, dist * 0.18);
      this.cry();
      if (this.state === "fly") void this.sounds.flap();
    }
  }

  fall() {
    if (this.grabbed || this.state === "fall" || this.state === "drag") return;
    this.target = null;
    this.act = null;
    this.pendingAct = null;
    this.state = "fall";
    this.vy = Math.max(this.vy, 40);
    this.platform = FLOOR;
  }

  update(dt: number, platforms: Platform[], bounds: { minX: number; maxX: number; floorY: number; height: number }) {
    this.age += dt;
    if (this.age > this.bubbleUntil) this.bubble.classList.add("hidden");
    if (this.act && this.age >= this.actUntil) {
      this.act = null;
      if (this.state === "sleep") this.state = "idle";
    }

    if (this.state === "drag") {
      this.animate(dt);
      this.syncTransform(bounds.height);
      this.project();
      return;
    }

    if ((this.state === "fly" || this.state === "jump") && this.target) this.stepAir(dt);
    else if (this.state === "walk" && this.target) this.stepWalk(dt);
    else if (this.state === "fall") this.stepFall(dt, platforms);
    else this.stepIdle(dt);

    this.x = THREE.MathUtils.clamp(this.x, bounds.minX, bounds.maxX);
    this.y = THREE.MathUtils.clamp(this.y, 24, bounds.floorY + 8);
    this.depth = THREE.MathUtils.clamp(this.depth, 0.05, 1);
    this.animate(dt);
    this.syncTransform(bounds.height);
    this.project();
  }

  private stepIdle(dt: number) {
    const hover = this.species.floatIdle ? 10 + Math.sin(this.age * 2.2) * 6 : 0;
    this.y = THREE.MathUtils.damp(this.y, this.platform.topY - hover, 8, dt);
    if (this.age > this.idleUntil && Math.random() < 0.0018) this.cry();
  }

  private stepWalk(dt: number) {
    const target = this.target!;
    const dx = target.x - this.x;
    const dd = target.depth - this.depth;
    const dist = Math.abs(dx);
    if (dist < 4 && Math.abs(dd) < 0.03) {
      this.x = target.x;
      this.depth = target.depth;
      this.platform = target.platform;
      this.y = target.platform.topY;
      this.finishMove("idle");
      return;
    }
    this.facing = dx === 0 ? this.facing : Math.sign(dx);
    const step = this.speed * dt;
    if (dist > 0) this.x += Math.sign(dx) * Math.min(dist, step);
    this.depth += Math.sign(dd) * Math.min(Math.abs(dd), dt * 0.35);

    if (this.species.hopWalk) {
      this.hopPhase += dt * 8;
      this.y = this.platform.topY - Math.max(0, Math.sin(this.hopPhase)) * 18;
    } else if (this.species.floatIdle) {
      this.y = this.platform.topY - 12 - Math.sin(this.age * 8) * 4;
    } else {
      this.y = this.platform.topY;
    }

    if (!this.platform.isFloor && (this.x < this.platform.minX - 10 || this.x > this.platform.maxX + 10)) {
      this.fall();
    }
  }

  private stepAir(dt: number) {
    const target = this.target!;
    this.motionT += dt;
    const u = Math.min(1, this.motionT / this.motionDur);
    const ease = u * u * (3 - 2 * u);
    const hop = Math.sin(Math.PI * u) * this.lift;
    this.x = THREE.MathUtils.lerp(this.fromX, target.x, ease);
    this.y = THREE.MathUtils.lerp(this.fromY, target.y, ease) - hop;
    this.depth = THREE.MathUtils.lerp(this.fromDepth, target.depth, ease);
    this.facing = target.x >= this.fromX ? 1 : -1;
    if (u >= 1) {
      this.x = target.x;
      this.y = target.y;
      this.depth = target.depth;
      this.platform = target.platform;
      void this.sounds.land(this.species.mass > 1.6);
      this.finishMove("sit");
    }
  }

  private stepFall(dt: number, platforms: Platform[]) {
    this.vy += (2200 / Math.max(0.7, this.species.mass * 0.55)) * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 0.985;
    const hit = platformAt(platforms, this.x, this.y);
    const ground = hit ?? FLOOR;
    if (this.vy > 0 && this.y >= ground.topY - 2) {
      this.y = ground.topY;
      this.platform = ground;
      this.vx = 0;
      this.vy = 0;
      void this.sounds.land(this.species.mass > 1.6 || this.vy > 900);
      this.finishMove("idle");
    }
  }

  private finishMove(next: PetState) {
    this.target = null;
    if (this.pendingAct) {
      const follow = this.pendingAct;
      this.pendingAct = null;
      this.startAct(follow);
      return;
    }
    this.state = next;
    this.idleUntil = this.age + 1.1 + Math.random() * 2.4;
  }

  private animate(dt: number) {
    const t = this.age;
    const walk = this.state === "walk" || this.state === "jump";
    const fly = this.state === "fly" || (this.species.floatIdle && (this.state === "idle" || this.state === "sit"));
    const cadence = walk ? 9 : fly ? 14 : 2.4;
    this.rig.legs.forEach((leg, i) => {
      const swing = walk || this.state === "jump" ? Math.sin(t * cadence + i * Math.PI) * 0.7 : Math.sin(t * 2 + i) * 0.06;
      leg.rotation.x = swing;
    });
    this.rig.wings.forEach((wing, i) => {
      const flap = fly || this.state === "fly" ? Math.sin(t * 16 + i) * 0.7 : Math.sin(t * 3) * 0.12;
      wing.rotation.z = (i === 0 ? 1 : -1) * (0.2 + flap);
    });
    if (this.rig.tail) this.rig.tail.rotation.y = Math.sin(t * (walk ? 8 : 2.2)) * 0.45;
    if (this.rig.trunk) this.rig.trunk.rotation.x = 0.3 + Math.sin(t * 2.1) * 0.2;
    this.rig.ears.forEach((ear, i) => {
      const flop = this.moodPose("sad") ? 0.55 : this.moodPose("happy") ? -0.12 : this.moodPose("scared") ? 0.35 : 0;
      ear.rotation.x = flop + Math.sin(t * 3 + i) * 0.08;
    });
    const headTurn = Math.sin(t * 1.3) * 0.12;
    this.rig.head.rotation.y = headTurn + (this.moodPose("curious") ? 0.18 : 0);
    this.rig.head.rotation.x = this.moodPose("sad") ? 0.22 : this.moodPose("scared") ? -0.12 : this.moodPose("curious") ? -0.08 : 0;
    this.rig.head.rotation.z = this.moodPose("curious") ? 0.18 : this.moodPose("angry") ? 0.06 : 0;
    this.rig.body.scale.set(1, 1 + Math.sin(t * 2.6) * 0.03, 1);
    this.applyAct(dt, t);
    this.applyFace(t);
    if (this.state === "sleep" || this.act === "sleep") this.group.rotation.z = this.facing * 0.9;
    else if (this.act === "ghostPeek") this.group.rotation.z = Math.sin(t * 6) * 0.18;
    else if (this.act === "sway") this.group.rotation.z = Math.sin(t * 3.2) * 0.22;
    else this.group.rotation.z = THREE.MathUtils.damp(this.group.rotation.z, 0, 8, dt);
    this.rig.root.position.y = this.state === "sit" || this.acting ? -0.08 : this.moodPose("sad") ? -0.04 : 0;
  }

  private applyAct(dt: number, t: number) {
    const restX = this.rig.head.userData.restX;
    if (typeof restX === "number") {
      const hide = this.act === "turtleHide";
      this.rig.head.position.x = THREE.MathUtils.damp(this.rig.head.position.x, hide ? restX * 0.14 : restX, 7, dt);
    }
    if (!this.acting) return;
    const kind = this.act!;
    if (kind === "yawn") {
      this.rig.head.rotation.x = -0.38;
      this.rig.head.rotation.z = 0;
    } else if (kind === "stretch") {
      this.rig.body.scale.set(1.08, 0.92, 1.22);
      this.rig.legs.forEach((leg, i) => {
        leg.rotation.x = i < 2 ? -0.55 : 0.7;
      });
    } else if (kind === "trunkUp" && this.rig.trunk) {
      this.rig.trunk.rotation.x = -1.05 + Math.sin(t * 3) * 0.08;
    } else if (kind === "earWiggle") {
      this.rig.ears.forEach((ear, i) => {
        ear.rotation.z = (i === 0 ? -1 : 1) * (0.25 + Math.sin(t * 18 + i) * 0.42);
        ear.rotation.x = Math.sin(t * 16 + i * 1.7) * 0.28;
      });
    } else if (kind === "preen") {
      this.rig.head.rotation.z = 0.55;
      this.rig.head.rotation.y = 0.35;
      if (this.rig.wings[0]) this.rig.wings[0].rotation.z = 1.15;
    } else if (kind === "ruffle") {
      this.rig.body.scale.setScalar(1 + Math.sin(t * 14) * 0.06);
      this.rig.wings.forEach((wing, i) => {
        wing.rotation.z = (i === 0 ? 1 : -1) * (0.55 + Math.sin(t * 12 + i) * 0.55);
      });
    } else if (kind === "watch") {
      this.rig.head.rotation.x = -0.06 + Math.sin(t * 0.8) * 0.05;
      this.rig.head.rotation.y = Math.sin(t * 0.55) * 0.12;
    } else if (kind === "read") {
      this.rig.head.rotation.x = 0.42 + Math.sin(t * 1.4) * 0.08;
      this.rig.head.rotation.y = Math.sin(t * 0.9) * 0.18;
    } else if (kind === "ghostPeek") {
      this.rig.head.rotation.y = 0.45;
      this.rig.pupils.forEach((p) => p.scale.setScalar(1.45));
    } else if (kind === "sleep") {
      this.rig.head.rotation.x = 0.18;
      this.rig.pupils.forEach((p) => p.scale.set(1, 0.12, 1));
    }
  }

  private moodPose(mood: Mood) {
    return this.age < this.moodUntil && this.mood === mood;
  }

  private applyFace(t: number) {
    const talking = this.age < this.bubbleUntil;
    const yawning = this.act === "yawn";
    const pupil =
      this.act === "sleep"
        ? 0.2
        : this.act === "ghostPeek"
          ? 1.45
          : this.moodPose("scared")
          ? 1.55
          : this.moodPose("happy")
            ? 1.18
            : this.moodPose("sad")
              ? 0.72
              : this.moodPose("angry")
                ? 0.85
                : 1;
    const lookY = this.moodPose("sad") ? -0.03 : this.moodPose("curious") ? 0.02 : 0;
    this.rig.pupils.forEach((p) => {
      if (this.act === "sleep") p.scale.set(1, 0.12, 1);
      else p.scale.set(pupil, this.moodPose("angry") ? 0.45 : pupil, pupil);
      p.position.y = lookY;
    });
    const mouth = this.rig.mouth;
    if (!mouth) return;
    if (mouth.userData.kind === "beak") {
      const rest = typeof mouth.userData.baseRotX === "number" ? mouth.userData.baseRotX : mouth.rotation.x;
      mouth.rotation.x =
        rest +
        (yawning ? 0.35 : 0) +
        (this.moodPose("sad") ? 0.18 : 0) +
        (talking ? Math.abs(Math.sin(t * 16)) * 0.2 : 0);
      return;
    }
    const baseY = typeof mouth.userData.baseY === "number" ? mouth.userData.baseY : mouth.position.y;
    const open = yawning ? 1.15 : talking ? 0.45 + Math.abs(Math.sin(t * 16)) * 0.7 : this.moodPose("sad") ? 0.28 : 0.38;
    const wide = yawning ? 1.45 : this.moodPose("happy") ? 1.7 : this.moodPose("sad") ? 0.72 : this.moodPose("scared") ? 1.35 : 1;
    mouth.scale.set(wide, open, 1);
    mouth.position.y = baseY + (this.moodPose("sad") ? -0.02 : this.moodPose("happy") ? 0.012 : 0);
    mouth.rotation.z = this.moodPose("sad") ? Math.PI : 0;
  }

  private syncTransform(overlayHeight: number) {
    const s = this.pixelSize;
    this.group.scale.setScalar(s);
    this.group.position.set(this.x, overlayHeight - this.y, this.depth * 8);
    if (this.act === "watch") this.group.rotation.y = Math.PI;
    else this.group.rotation.y = this.facing >= 0 ? 0.35 : Math.PI - 0.35;
  }

  private project() {
    const s = this.pixelSize;
    this.label.style.transform = `translate(-50%, 6px) translate(${this.x}px, ${this.y}px)`;
    this.bubble.style.transform = `translate(-50%, -100%) translate(${this.x}px, ${this.y - s * 1.05}px)`;
  }
}

function actDuration(kind: IdleAct) {
  switch (kind) {
    case "yawn":
      return 1.5 + Math.random() * 0.4;
    case "sleep":
      return 5.5 + Math.random() * 4;
    case "stretch":
      return 2.1 + Math.random() * 0.6;
    case "trunkUp":
      return 2.6 + Math.random() * 1.1;
    case "earWiggle":
      return 2.2 + Math.random() * 1.2;
    case "preen":
      return 3 + Math.random() * 1.4;
    case "ruffle":
      return 2.4 + Math.random() * 1;
    case "watch":
      return 9 + Math.random() * 8;
    case "read":
      return 7 + Math.random() * 7;
    case "sway":
      return 6 + Math.random() * 5;
    case "turtleHide":
      return 3.2 + Math.random() * 1.6;
    case "ghostPeek":
      return 2.4 + Math.random() * 1.2;
  }
}
