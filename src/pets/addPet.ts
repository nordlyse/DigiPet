import * as THREE from "three";
import type { SpeciesId } from "../engine/types";

export interface PetRig {
  root: THREE.Group;
  body: THREE.Object3D;
  head: THREE.Object3D;
  tail?: THREE.Object3D;
  trunk?: THREE.Object3D;
  mouth?: THREE.Object3D;
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

function mat(color: number, opts: { transparent?: boolean; opacity?: number; emissive?: number; side?: THREE.Side } = {}) {
  return new THREE.MeshToonMaterial({
    color,
    gradientMap,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    emissive: opts.emissive ?? color,
    emissiveIntensity: opts.transparent ? 0.25 : 0.16,
    side: opts.side ?? THREE.FrontSide,
    depthWrite: true,
  });
}

function plug(host: THREE.Mesh, color: number) {
  const lining = new THREE.Mesh(
    host.geometry,
    new THREE.MeshBasicMaterial({ color, side: THREE.BackSide, depthWrite: true }),
  );
  lining.scale.setScalar(0.96);
  lining.castShadow = false;
  lining.receiveShadow = false;
  lining.renderOrder = -1;
  host.add(lining);
}

function mesh(geo: THREE.BufferGeometry, color: number, extra?: THREE.MeshToonMaterial) {
  const material = extra ?? mat(color);
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  m.receiveShadow = true;
  if (!material.transparent && !(geo instanceof THREE.CircleGeometry)) plug(m, color);
  return m;
}

function sphere(r: number, color: number, squash: [number, number, number] = [1, 1, 1], extra?: THREE.MeshToonMaterial) {
  const geo = new THREE.SphereGeometry(r, 22, 18);
  if (squash[0] !== 1 || squash[1] !== 1 || squash[2] !== 1) {
    geo.scale(squash[0], squash[1], squash[2]);
    geo.computeVertexNormals();
  }
  return mesh(geo, color, extra);
}

function cone(r: number, h: number, color: number, segs = 10) {
  const m = mesh(new THREE.ConeGeometry(r, h, segs), color);
  const cap = mesh(new THREE.CircleGeometry(r, segs), color, mat(color, { side: THREE.DoubleSide }));
  cap.rotation.x = Math.PI / 2;
  cap.position.y = -h / 2;
  m.add(cap);
  return m;
}

function addMouth(head: THREE.Object3D, z: number, color = 0x3a2018) {
  const m = sphere(0.07, color, [1.2, 0.38, 0.58]);
  m.userData.baseY = -0.07;
  add(head, m, 0, m.userData.baseY, z);
  return m;
}

function add(parent: THREE.Object3D, child: THREE.Object3D, x = 0, y = 0, z = 0) {
  child.position.set(x, y, z);
  parent.add(child);
  return child;
}

export function addPetModel(id: SpeciesId): PetRig {
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
  const body = sphere(0.42, 0xe0893a, [1.15, 0.85, 0.9]);
  add(b.root, body, 0, 0.55, 0);
  const head = sphere(0.32, 0xe0893a);
  add(b.root, head, 0, 1.05, 0.12);
  for (const side of [-1, 1]) {
    const ear = cone(0.14, 0.22, 0xd46b28, 6);
    ear.rotation.z = side * 0.25;
    add(head, ear, side * 0.2, 0.28, -0.02);
    b.ears.push(ear);
  }
  const nose = sphere(0.05, 0xf3a6b8);
  add(head, nose, 0, -0.02, 0.3);
  const mouth = addMouth(head, 0.29);
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
  return { ...b, body, head, tail, mouth, pupils: eyes(head, 0.12, 0.06, 0.26) };
}

function dog(): PetRig {
  const b = baseRig();
  const body = sphere(0.44, 0xd4a056, [1.25, 0.8, 0.95]);
  add(b.root, body, 0, 0.52, 0);
  const head = sphere(0.3, 0xd4a056);
  add(b.root, head, 0, 1.0, 0.18);
  const snout = sphere(0.14, 0xe8c48a, [1, 0.7, 1.3]);
  add(head, snout, 0, -0.06, 0.28);
  const nose = sphere(0.05, 0x2a2118);
  add(snout, nose, 0, 0.02, 0.12);
  const mouth = addMouth(snout, 0.08, 0x4a3020);
  for (const side of [-1, 1]) {
    const ear = sphere(0.12, 0xb57a3a, [0.7, 1.3, 0.55]);
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
  return { ...b, body, head, tail, mouth, pupils: eyes(head, 0.11, 0.06, 0.24) };
}

function turtle(): PetRig {
  const b = baseRig();
  const body = sphere(0.48, 0x3f8f5a, [1.15, 0.55, 1.05]);
  add(b.root, body, 0, 0.42, 0);
  const shell = sphere(0.42, 0x2f6b44, [1.05, 0.55, 1]);
  add(b.root, shell, 0, 0.58, 0);
  const spots = [0x4aa366, 0x24603a];
  for (let i = 0; i < 5; i++) {
    const spot = sphere(0.1, spots[i % 2], [1, 0.35, 1]);
    add(shell, spot, (i - 2) * 0.14, 0.22, (i % 2 === 0 ? 0.08 : -0.1));
  }
  const head = sphere(0.2, 0x7cbc6a);
  add(b.root, head, 0.42, 0.42, 0.12);
  head.userData.restX = 0.42;
  const mouth = addMouth(head, 0.16, 0x245c32);
  for (const [x, z] of [[-0.18, 0.22], [0.18, 0.22], [-0.18, -0.22], [0.18, -0.22]] as const) {
    const l = leg(0x7cbc6a, 0.12, 0.1);
    add(b.root, l, x, 0.28, z);
    b.legs.push(l);
  }
  const tail = cone(0.07, 0.18, 0x7cbc6a, 8);
  tail.rotation.z = Math.PI / 2;
  add(b.root, tail, -0.5, 0.32, 0);
  return { ...b, body, head, tail, mouth, pupils: eyes(head, 0.08, 0.04, 0.16, 0.07) };
}

function elephant(): PetRig {
  const b = baseRig();
  const skin = 0x9aa3ad;
  const shade = 0x8b959f;
  const body = sphere(0.52, skin, [1.35, 0.95, 1.05]);
  add(b.root, body, 0, 0.72, 0);
  const rump = sphere(0.34, shade, [1.05, 0.9, 1]);
  add(b.root, rump, -0.48, 0.7, -0.02);
  const head = sphere(0.34, skin);
  add(b.root, head, 0.5, 1.02, 0.12);
  const crown = sphere(0.22, shade, [1, 0.7, 0.85]);
  add(head, crown, -0.02, 0.12, -0.16);
  for (const side of [-1, 1]) {
    const ear = sphere(0.3, shade, [0.55, 1.08, 0.88]);
    add(head, ear, side * 0.32, 0.04, -0.06);
    b.ears.push(ear);
  }
  const trunk = new THREE.Group();
  let y = 0;
  for (let i = 0; i < 4; i++) {
    const seg = sphere(0.1 - i * 0.012, shade);
    add(trunk, seg, 0.04 * i, y, 0.08 * i);
    y -= 0.12;
  }
  add(head, trunk, 0.08, -0.12, 0.28);
  const mouth = addMouth(head, 0.22, 0x5c646c);
  for (const [x, z] of [
    [-0.28, 0.22],
    [0.28, 0.22],
    [-0.28, -0.22],
    [0.28, -0.22],
  ] as const) {
    const l = leg(0x7d868f, 0.42, 0.14);
    add(b.root, l, x, 0.5, z);
    b.legs.push(l);
  }
  const tail = mesh(new THREE.CapsuleGeometry(0.045, 0.32, 3, 6), shade);
  tail.rotation.z = Math.PI / 2.6;
  add(b.root, tail, -0.72, 0.72, 0);
  return { ...b, body, head, tail, trunk, mouth, pupils: eyes(head, 0.12, 0.08, 0.3, 0.09) };
}

function bird(): PetRig {
  const b = baseRig();
  const body = sphere(0.28, 0xf2c14e, [1, 0.95, 1.15]);
  add(b.root, body, 0, 0.55, 0);
  const head = sphere(0.2, 0xf2c14e);
  add(b.root, head, 0.18, 0.82, 0.08);
  const beak = cone(0.06, 0.16, 0xe07a2f, 8);
  beak.rotation.x = Math.PI / 2;
  add(head, beak, 0.02, -0.02, 0.2);
  const mouth = beak;
  mouth.userData.kind = "beak";
  mouth.userData.baseRotX = beak.rotation.x;
  for (const side of [-1, 1]) {
    const wing = sphere(0.18, 0xe6b03d, [0.35, 0.7, 1.1]);
    add(body, wing, side * 0.28, 0.02, -0.02);
    b.wings.push(wing);
  }
  const tail = cone(0.1, 0.22, 0xe07a2f, 8);
  tail.rotation.x = Math.PI / 2.4;
  add(b.root, tail, -0.22, 0.5, -0.12);
  for (const side of [-1, 1]) {
    const l = leg(0xe07a2f, 0.16, 0.04);
    add(b.root, l, side * 0.08, 0.38, 0.04);
    b.legs.push(l);
  }
  return { ...b, body, head, tail, mouth, pupils: eyes(head, 0.07, 0.04, 0.16, 0.06) };
}

function eagle(): PetRig {
  const b = baseRig();
  const body = sphere(0.34, 0x6b4423, [1.1, 0.9, 1.2]);
  add(b.root, body, 0, 0.62, 0);
  const head = sphere(0.2, 0xf4efe6);
  add(b.root, head, 0.22, 0.92, 0.1);
  const beak = cone(0.07, 0.2, 0xf0b429, 8);
  beak.rotation.x = Math.PI / 1.7;
  add(head, beak, 0.04, -0.04, 0.18);
  const mouth = beak;
  mouth.userData.kind = "beak";
  mouth.userData.baseRotX = beak.rotation.x;
  for (const side of [-1, 1]) {
    const wing = sphere(0.28, 0x5a381c, [0.32, 0.55, 1.5]);
    add(body, wing, side * 0.36, 0.04, -0.06);
    b.wings.push(wing);
  }
  const tail = cone(0.14, 0.3, 0x4a2e16, 8);
  tail.rotation.x = Math.PI / 2.2;
  add(b.root, tail, -0.28, 0.52, -0.16);
  for (const side of [-1, 1]) {
    const l = leg(0xf0b429, 0.18, 0.05);
    add(b.root, l, side * 0.1, 0.42, 0.04);
    b.legs.push(l);
  }
  return { ...b, body, head, tail, mouth, pupils: eyes(head, 0.07, 0.03, 0.16, 0.055) };
}

function ghost(): PetRig {
  const b = baseRig();
  const cloth = mat(0xf4f7ff, { transparent: true, opacity: 0.88, emissive: 0x334466, side: THREE.DoubleSide });
  const body = sphere(0.42, 0xf4f7ff, [1, 1.15, 0.95], cloth);
  add(b.root, body, 0, 0.72, 0);
  const head = body;
  for (let i = 0; i < 5; i++) {
    const drip = sphere(0.12, 0xf4f7ff, [1, 1, 1], cloth.clone());
    add(body, drip, (i - 2) * 0.14, -0.42, 0.02 * ((i % 2) * 2 - 1));
  }
  const mouth = addMouth(body, 0.36, 0x1b2430);
  mouth.scale.set(1.2, 0.7, 0.8);
  return { ...b, body, head, mouth, pupils: eyes(body, 0.14, 0.12, 0.34, 0.1) };
}

function rabbit(): PetRig {
  const b = baseRig();
  const body = sphere(0.38, 0xf3eee6, [1.05, 0.9, 0.95]);
  add(b.root, body, 0, 0.5, 0);
  const head = sphere(0.28, 0xf3eee6);
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
  const nose = sphere(0.045, 0xf4b4c4);
  add(head, nose, 0, -0.02, 0.26);
  const mouth = addMouth(head, 0.24);
  const tail = sphere(0.12, 0xffffff);
  add(b.root, tail, -0.32, 0.42, -0.12);
  for (const [x, z] of [[-0.16, 0.14], [0.16, 0.14], [-0.16, -0.14], [0.16, -0.14]] as const) {
    const l = leg(0xe8e0d4, 0.22, 0.07);
    add(b.root, l, x, 0.32, z);
    b.legs.push(l);
  }
  return { ...b, body, head, tail, mouth, pupils: eyes(head, 0.1, 0.05, 0.24, 0.08) };
}
