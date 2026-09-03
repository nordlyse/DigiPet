import * as THREE from "three";
import { SoundEngine } from "../audio/SoundEngine";
import type { NativeWindow, Rect, SpeciesId, WorkArea } from "./types";
import { BehaviorDirector } from "./BehaviorDirector";
import { PetActor } from "./PetEngine";
import { FLOOR, platformsFromWindows } from "./Platforms";

export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  readonly sounds = new SoundEngine();
  readonly pets: PetActor[] = [];
  readonly director = new BehaviorDirector();
  platforms = [FLOOR];
  private clock = new THREE.Clock();
  private dragging: PetActor | null = null;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private overlay = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
  private hitNotify: ((regions: Rect[]) => void) | null = null;
  private hitAcc = 0;
  private press: { x: number; y: number; pet: PetActor } | null = null;
  onChat?: () => void;

  constructor(
    private canvas: HTMLCanvasElement,
    private labels: HTMLElement,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      premultipliedAlpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera = new THREE.OrthographicCamera(0, 1, 1, 0, -50, 50);
    this.camera.position.z = 16;
    this.scene.background = null;
    this.lights();
    this.resize();
    window.addEventListener("resize", () => this.resize());
    this.bindPointer();
    this.loop();
  }

  setHitReporter(fn: (regions: Rect[]) => void) {
    this.hitNotify = fn;
  }

  setDesktop(windows: NativeWindow[], workArea: WorkArea, overlay = this.overlay) {
    this.overlay.x = overlay.x;
    this.overlay.y = overlay.y;
    const next = platformsFromWindows(windows, workArea, overlay);
    this.platforms = next;
    for (const pet of this.pets) {
      if (pet.grabbed) continue;
      const found = next.find((p) => p.id === pet.platform.id);
      if (!found) {
        pet.fall();
        continue;
      }
      if (!found.isFloor && Math.abs(found.topY - pet.platform.topY) > 14) pet.fall();
      else pet.platform = found;
    }
  }

  spawn(id: SpeciesId) {
    this.clearPets();
    const x = (FLOOR.minX + FLOOR.maxX) / 2;
    const pet = new PetActor(id, { x, y: FLOOR.topY }, this.sounds, this.labels);
    pet.depth = 0.82;
    this.pets.push(pet);
    this.scene.add(pet.group);
    pet.cry(true);
  }

  speak(text: string) {
    this.pets[0]?.say(text, 4.2);
  }

  private clearPets() {
    for (const pet of this.pets) {
      this.scene.remove(pet.group);
      pet.dispose();
    }
    this.pets.length = 0;
  }

  private lights() {
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x334455, 1.05));
    const sun = new THREE.DirectionalLight(0xfff4e5, 0.9);
    sun.position.set(-4, 10, 12);
    this.scene.add(sun);
  }

  private resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.overlay.width = w;
    this.overlay.height = h;
    this.renderer.setSize(w, h, false);
    this.camera.left = 0;
    this.camera.right = w;
    this.camera.top = h;
    this.camera.bottom = 0;
    this.camera.updateProjectionMatrix();
  }

  private bindPointer() {
    const el = this.canvas;
    el.addEventListener("pointerdown", (e) => {
      void this.sounds.unlock();
      this.setPointer(e);
      const pet = this.hitPet() ?? this.petNear(e.clientX, e.clientY);
      if (!pet) return;
      e.preventDefault();
      this.press = { x: e.clientX, y: e.clientY, pet };
    });
    el.addEventListener("pointermove", (e) => {
      if (this.press && !this.dragging) {
        const dist = Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y);
        if (dist > 10) {
          this.dragging = this.press.pet;
          this.dragging.grab();
          el.setPointerCapture(e.pointerId);
        }
      }
      if (!this.dragging) return;
      this.dragging.dragTo(e.clientX, e.clientY + this.dragging.pixelSize * 0.25, this.clock.elapsedTime);
    });
    const end = (e: PointerEvent) => {
      this.press = null;
      if (!this.dragging) return;
      this.dragging.release();
      this.dragging = null;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    el.addEventListener("click", (e) => {
      if (this.dragging) return;
      const pet = this.petNear(e.clientX, e.clientY);
      if (pet) pet.cry(true);
    });
    el.addEventListener("dblclick", (e) => {
      const pet = this.petNear(e.clientX, e.clientY);
      if (pet) this.onChat?.();
    });
  }

  private setPointer(e: PointerEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }

  private petNear(x: number, y: number): PetActor | null {
    for (const pet of this.pets) {
      const r = pet.hitRect();
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return pet;
    }
    return null;
  }

  private hitPet(): PetActor | null {
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const meshes: THREE.Object3D[] = [];
    this.pets.forEach((p) => p.group.traverse((o) => meshes.push(o)));
    const hits = this.raycaster.intersectObjects(meshes, false);
    if (!hits.length) return null;
    let obj: THREE.Object3D | null = hits[0].object;
    while (obj && obj.userData.petId == null) obj = obj.parent;
    const id = obj?.userData.petId as number | undefined;
    return this.pets.find((p) => p.id === id) ?? null;
  }

  private loop = () => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.033, this.clock.getDelta());
    this.director.update(dt, this.pets, this.platforms);
    const bounds = {
      minX: FLOOR.minX,
      maxX: FLOOR.maxX,
      floorY: FLOOR.topY,
      height: this.overlay.height,
    };
    for (const pet of this.pets) pet.update(dt, this.platforms, bounds);
    this.hitAcc += dt;
    if (this.hitAcc > 0.03) {
      this.hitAcc = 0;
      this.hitNotify?.(this.pets.map((p) => p.hitRect()));
    }
    this.renderer.render(this.scene, this.camera);
  };
}
