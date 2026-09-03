import * as THREE from "three";
import type { SpeciesId } from "../engine/types";

export interface PetRig {
  root: THREE.Group;
  body: THREE.Object3D;
  head: THREE.Object3D;
  tail?: THREE.Object3D;
  trunk?: THREE.Object3D;
  ears: THREE.Object3D[];
  legs: THREE.Object3D[];
  wings: THREE.Object3D[];
  pupils: THREE.Object3D[];
}

const gradientMap = (() => {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 1;
  const ctx = canvas.getContext("2d")!;
  const stops = ["#3a3a3a", "#7a7a7a", "#bcbcbc", "#ffffff"];
  stops.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(i, 0, 1, 1);
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  return tex;
})();

function mat(color: number, opts: { transparent?: boolean; opacity?: number; emissive?: number } = {}) {
  return new THREE.MeshToonMaterial({
    color,
    gradientMap,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    emissive: opts.emissive ?? 0x000000,
  });
}

function mesh(geo: THREE.BufferGeometry, color: number, extra?: THREE.MeshToonMaterial) {
  const m = new THREE.Mesh(geo, extra ?? mat(color));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function add(parent: THREE.Object3D, child: THREE.Object3D, x = 0, y = 0, z = 0) {
  child.position.set(x, y, z);
  parent.add(child);
  return child;
}

export function createPetModel(id: SpeciesId): PetRig {
  switch (id) {
    case "cat":
      return cat();
    case "dog":
      return dog();
    case "turtle":
      return turtle();
    case "elephant":
      return elephant();
    case "bird":
      return bird();
    case "eagle":
      return eagle();
    case "ghost":
      return ghost();
    case "rabbit":
      return rabbit();
  }
}

function baseRig(): { root: THREE.Group; ears: THREE.Object3D[]; legs: THREE.Object3D[]; wings: THREE.Object3D[]; pupils: THREE.Object3D[] } {
  const root = new THREE.Group();
  return { root, ears: [], legs: [], wings: [], pupils: [] };
}

function eyes(head: THREE.Object3D, spacing: number, y: number, z: number, size = 0.11) {
  const pupils: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const white = mesh(new THREE.SphereGeometry(size, 10, 8), 0xf7f3ea);
    const pupil = mesh(new THREE.SphereGeometry(size * 0.48, 8, 6), 0x1a1410);
    add(white, pupil, 0, 0, size * 0.55);
    add(head, white, side * spacing, y, z);
    pupils.push(pupil);
  }
  return pupils;
}

function leg(color: number, h: number, r = 0.1) {
  const pivot = new THREE.Group();
  const m = mesh(new THREE.CapsuleGeometry(r, h, 4, 8), color);
  m.position.y = -h / 2 - r * 0.2;
  pivot.add(m);
  return pivot;
}

function cat(): PetRig {
  const b = baseRig();
  const body = mesh(new THREE.SphereGeometry(0.42, 16, 12), 0xe0893a);
  body.scale.set(1.15, 0.85, 0.9);
  add(b.root, body, 0, 0.55, 0);
  const head = mesh(new THREE.SphereGeometry(0.32, 16, 12), 0xe0893a);
  add(b.root, head, 0, 1.05, 0.12);
  const earGeo = new THREE.ConeGeometry(0.14, 0.22, 4);
  for (const side of [-1, 1]) {
    const ear = mesh(earGeo, 0xd46b28);
    ear.rotation.z = side * 0.25;
    add(head, ear, side * 0.2, 0.28, -0.02);
    b.ears.push(ear);
  }
  const nose = mesh(new THREE.SphereGeometry(0.05, 6, 6), 0xf3a6b8);
  add(head, nose, 0, -0.02, 0.3);
  const tail = new THREE.Group();
  const tailMesh = mesh(new THREE.CapsuleGeometry(0.07, 0.55, 4, 8), 0xe0893a);
  tailMesh.rotation.z = 0.8;
  tail.add(tailMesh);
  add(b.root, tail, -0.35, 0.7, -0.2);
  for (const [x, z] of [[-0.22, 0.18], [0.22, 0.18], [-0.22, -0.18], [0.22, -0.18]] as const) {
    const l = leg(0xd46b28, 0.28, 0.08);
    add(b.root, l, x, 0.38, z);
    b.legs.push(l);
  }
  return { ...b, body, head, tail, pupils: eyes(head, 0.12, 0.06, 0.26) };
}

function dog(): PetRig {
  const b = baseRig();
  const body = mesh(new THREE.SphereGeometry(0.44, 16, 12), 0xd4a056);
  body.scale.set(1.25, 0.8, 0.95);
  add(b.root, body, 0, 0.52, 0);
  const head = mesh(new THREE.SphereGeometry(0.3, 16, 12), 0xd4a056);
  add(b.root, head, 0, 1.0, 0.18);
  const snout = mesh(new THREE.SphereGeometry(0.14, 10, 8), 0xe8c48a);
  snout.scale.set(1, 0.7, 1.3);
  add(head, snout, 0, -0.06, 0.28);
  const nose = mesh(new THREE.SphereGeometry(0.05, 6, 6), 0x2a2118);
  add(snout, nose, 0, 0.02, 0.12);
  for (const side of [-1, 1]) {
    const ear = mesh(new THREE.SphereGeometry(0.12, 8, 6), 0xb57a3a);
    ear.scale.set(0.7, 1.3, 0.4);
    ear.rotation.z = side * 0.5;
    add(head, ear, side * 0.22, 0.08, -0.02);
    b.ears.push(ear);
  }
  const tail = new THREE.Group();
  const tailMesh = mesh(new THREE.CapsuleGeometry(0.06, 0.35, 4, 8), 0xd4a056);
  tailMesh.rotation.z = -0.4;
  tail.add(tailMesh);
  add(b.root, tail, -0.42, 0.7, -0.15);
  for (const [x, z] of [[-0.22, 0.18], [0.22, 0.18], [-0.22, -0.18], [0.22, -0.18]] as const) {
    const l = leg(0xb57a3a, 0.32, 0.09);
    add(b.root, l, x, 0.38, z);
    b.legs.push(l);
  }
  return { ...b, body, head, tail, pupils: eyes(head, 0.11, 0.06, 0.24) };
}

function turtle(): PetRig {
  const b = baseRig();
  const body = mesh(new THREE.SphereGeometry(0.48, 16, 12), 0x3f8f5a);
  body.scale.set(1.15, 0.55, 1.05);
  add(b.root, body, 0, 0.42, 0);
  const shell = mesh(new THREE.SphereGeometry(0.42, 12, 10), 0x2f6b44);
  shell.scale.set(1.05, 0.55, 1);
  add(b.root, shell, 0, 0.58, 0);
  const spots = [0x4aa366, 0x24603a];
  for (let i = 0; i < 5; i++) {
    const spot = mesh(new THREE.CircleGeometry(0.1, 6), spots[i % 2]);
    spot.rotation.x = -Math.PI / 2.4;
    add(shell, spot, (i - 2) * 0.14, 0.28, (i % 2 === 0 ? 0.08 : -0.1));
  }
  const head = mesh(new THREE.SphereGeometry(0.2, 12, 10), 0x7cbc6a);
  add(b.root, head, 0.42, 0.42, 0.12);
  for (const [x, z] of [[-0.18, 0.22], [0.18, 0.22], [-0.18, -0.22], [0.18, -0.22]] as const) {
    const l = leg(0x7cbc6a, 0.12, 0.1);
    add(b.root, l, x, 0.28, z);
    b.legs.push(l);
  }
  const tail = mesh(new THREE.ConeGeometry(0.07, 0.18, 6), 0x7cbc6a);
  tail.rotation.z = Math.PI / 2;
  add(b.root, tail, -0.5, 0.32, 0);
  return { ...b, body, head, tail, pupils: eyes(head, 0.08, 0.04, 0.16, 0.07) };
}

function elephant(): PetRig {
  const b = baseRig();
  const body = mesh(new THREE.SphereGeometry(0.55, 16, 12), 0x9aa3ad);
  body.scale.set(1.25, 0.95, 1);
  add(b.root, body, 0, 0.72, 0);
  const head = mesh(new THREE.SphereGeometry(0.36, 16, 12), 0x9aa3ad);
  add(b.root, head, 0.38, 1.05, 0.08);
  for (const side of [-1, 1]) {
    const ear = mesh(new THREE.SphereGeometry(0.28, 10, 8), 0x8b959f);
    ear.scale.set(0.25, 1, 0.85);
    add(head, ear, side * 0.32, 0.05, -0.05);
    b.ears.push(ear);
  }
  const trunk = new THREE.Group();
  let y = 0;
  for (let i = 0; i < 4; i++) {
    const seg = mesh(new THREE.SphereGeometry(0.1 - i * 0.012, 8, 6), 0x8b959f);
    add(trunk, seg, 0.04 * i, y, 0.08 * i);
    y -= 0.12;
  }
  add(head, trunk, 0.08, -0.12, 0.28);
  for (const [x, z] of [[-0.28, 0.22], [0.28, 0.22], [-0.28, -0.22], [0.28, -0.22]] as const) {
    const l = leg(0x7d868f, 0.42, 0.14);
    add(b.root, l, x, 0.5, z);
    b.legs.push(l);
  }
  const tail = mesh(new THREE.CapsuleGeometry(0.04, 0.28, 3, 6), 0x8b959f);
  add(b.root, tail, -0.6, 0.7, 0);
  return { ...b, body, head, tail, trunk, pupils: eyes(head, 0.12, 0.08, 0.3, 0.09) };
}

function bird(): PetRig {
  const b = baseRig();
  const body = mesh(new THREE.SphereGeometry(0.28, 14, 10), 0xf2c14e);
  body.scale.set(1, 0.95, 1.15);
  add(b.root, body, 0, 0.55, 0);
  const head = mesh(new THREE.SphereGeometry(0.2, 12, 10), 0xf2c14e);
  add(b.root, head, 0.18, 0.82, 0.08);
  const beak = mesh(new THREE.ConeGeometry(0.06, 0.16, 6), 0xe07a2f);
  beak.rotation.x = Math.PI / 2;
  add(head, beak, 0.02, -0.02, 0.2);
  for (const side of [-1, 1]) {
    const wing = mesh(new THREE.SphereGeometry(0.18, 10, 8), 0xe6b03d);
    wing.scale.set(0.25, 0.7, 1.1);
    add(body, wing, side * 0.28, 0.02, -0.02);
    b.wings.push(wing);
  }
  const tail = mesh(new THREE.ConeGeometry(0.1, 0.22, 5), 0xe07a2f);
  tail.rotation.x = Math.PI / 2.4;
  add(b.root, tail, -0.22, 0.5, -0.12);
  for (const side of [-1, 1]) {
    const l = leg(0xe07a2f, 0.16, 0.04);
    add(b.root, l, side * 0.08, 0.38, 0.04);
    b.legs.push(l);
  }
  return { ...b, body, head, tail, pupils: eyes(head, 0.07, 0.04, 0.16, 0.06) };
}

function eagle(): PetRig {
  const b = baseRig();
  const body = mesh(new THREE.SphereGeometry(0.34, 14, 10), 0x6b4423);
  body.scale.set(1.1, 0.9, 1.2);
  add(b.root, body, 0, 0.62, 0);
  const head = mesh(new THREE.SphereGeometry(0.2, 12, 10), 0xf4efe6);
  add(b.root, head, 0.22, 0.92, 0.1);
  const beak = mesh(new THREE.ConeGeometry(0.07, 0.2, 6), 0xf0b429);
  beak.rotation.x = Math.PI / 1.7;
  add(head, beak, 0.04, -0.04, 0.18);
  for (const side of [-1, 1]) {
    const wing = mesh(new THREE.SphereGeometry(0.28, 10, 8), 0x5a381c);
    wing.scale.set(0.22, 0.55, 1.5);
    add(body, wing, side * 0.36, 0.04, -0.06);
    b.wings.push(wing);
  }
  const tail = mesh(new THREE.ConeGeometry(0.14, 0.3, 6), 0x4a2e16);
  tail.rotation.x = Math.PI / 2.2;
  add(b.root, tail, -0.28, 0.52, -0.16);
  for (const side of [-1, 1]) {
    const l = leg(0xf0b429, 0.18, 0.05);
    add(b.root, l, side * 0.1, 0.42, 0.04);
    b.legs.push(l);
  }
  return { ...b, body, head, tail, pupils: eyes(head, 0.07, 0.03, 0.16, 0.055) };
}

function ghost(): PetRig {
  const b = baseRig();
  const cloth = mat(0xf4f7ff, { transparent: true, opacity: 0.72, emissive: 0x334466 });
  const body = mesh(new THREE.SphereGeometry(0.42, 16, 12), 0xf4f7ff, cloth);
  body.scale.set(1, 1.15, 0.9);
  add(b.root, body, 0, 0.72, 0);
  const head = body;
  for (let i = 0; i < 5; i++) {
    const drip = mesh(new THREE.SphereGeometry(0.12, 8, 6), 0xf4f7ff, cloth.clone());
    add(body, drip, (i - 2) * 0.14, -0.42, 0.02 * ((i % 2) * 2 - 1));
  }
  const mouth = mesh(new THREE.SphereGeometry(0.08, 8, 6), 0x1b2430, mat(0x1b2430, { transparent: true, opacity: 0.8 }));
  mouth.scale.set(1.2, 0.55, 0.6);
  add(body, mouth, 0, -0.02, 0.36);
  return { ...b, body, head, pupils: eyes(body, 0.14, 0.12, 0.34, 0.1) };
}

function rabbit(): PetRig {
  const b = baseRig();
  const body = mesh(new THREE.SphereGeometry(0.38, 16, 12), 0xf3eee6);
  body.scale.set(1.05, 0.9, 0.95);
  add(b.root, body, 0, 0.5, 0);
  const head = mesh(new THREE.SphereGeometry(0.28, 16, 12), 0xf3eee6);
  add(b.root, head, 0, 0.95, 0.12);
  for (const side of [-1, 1]) {
    const ear = mesh(new THREE.CapsuleGeometry(0.07, 0.42, 4, 8), 0xf3eee6);
    ear.rotation.z = side * 0.18;
    add(head, ear, side * 0.12, 0.38, -0.04);
    const inner = mesh(new THREE.CapsuleGeometry(0.04, 0.28, 3, 6), 0xf4b4c4);
    inner.position.y = 0.02;
    inner.position.z = 0.02;
    ear.add(inner);
    b.ears.push(ear);
  }
  const nose = mesh(new THREE.SphereGeometry(0.045, 6, 6), 0xf4b4c4);
  add(head, nose, 0, -0.02, 0.26);
  const tail = mesh(new THREE.SphereGeometry(0.12, 10, 8), 0xffffff);
  add(b.root, tail, -0.32, 0.42, -0.12);
  for (const [x, z] of [[-0.16, 0.14], [0.16, 0.14], [-0.16, -0.14], [0.16, -0.14]] as const) {
    const l = leg(0xe8e0d4, 0.22, 0.07);
    add(b.root, l, x, 0.32, z);
    b.legs.push(l);
  }
  return { ...b, body, head, tail, pupils: eyes(head, 0.1, 0.05, 0.24, 0.08) };
}
