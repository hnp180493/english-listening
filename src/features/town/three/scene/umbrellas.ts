// Umbrellas in the rain (docs/town.md §24 "Umbrellas"): everybody out in it holds one up (chars/anim.ts C.umbrella:
// the right forearm up, the hand at the shaft), the anime bodies and the code-built ones alike. A body only says where
// its umbrella is (`Character3DPlus.umbrella()`: the grip, upright, one unit = the top of its head); they are all
// drawn here by ONE instanced mesh, so a wet street full of them costs one draw call (no shadow: under rain clouds the
// shadows are faint anyway). Made with the town, empty, so its shader is compiled with the rest and the first shower
// never waits on the driver.

import { BufferGeometry, Color, CylinderGeometry, DoubleSide, DynamicDrawUsage, Float32BufferAttribute, InstancedBufferAttribute, InstancedMesh, LatheGeometry, MeshStandardMaterial, Sphere, Vector2, Vector3, type Object3D } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** How many can show at once (more than the people ever drawn at once, Westbay's crowd included). */
const CAPACITY = 128;

/** Canopy colours, one per person by their id: a few calm ones and a few bright ones. */
const CANOPIES = ['#2f4a7a', '#c8463d', '#e8b83a', '#3f8a5c', '#2b2d33', '#3b9aa6', '#8c4fa0', '#f2efe8', '#e0794b', '#5d7fc2'];

function painted(g: BufferGeometry, c: Color): BufferGeometry {
  const n = g.getAttribute('position').count;
  const cols = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) cols.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new Float32BufferAttribute(cols, 3));
  return g;
}

/**
 * An umbrella in body heights, the grip at the origin, up along +y: the shaft from the hand to above the head, a
 * canopy of eight panels (white here: each one's own colour comes from the instance), a tip, a curved handle.
 */
function umbrellaGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  // the canopy: a shallow dome whose rim is a little above the head
  const dome = new LatheGeometry([new Vector2(0.001, 0.66), new Vector2(0.14, 0.645), new Vector2(0.25, 0.6), new Vector2(0.32, 0.545), new Vector2(0.35, 0.505)], 8);
  parts.push(painted(dome.toNonIndexed(), new Color('#ffffff')));
  // the shaft and the tip: dark (the instance's colour tints them a little; they stay dark)
  const shaft = new CylinderGeometry(0.011, 0.011, 0.72, 5, 1, true).translate(0, 0.32, 0);
  parts.push(painted(shaft.toNonIndexed(), new Color('#2a2622')));
  const tip = new CylinderGeometry(0.004, 0.012, 0.06, 5, 1).translate(0, 0.69, 0);
  parts.push(painted(tip.toNonIndexed(), new Color('#2a2622')));
  // the handle: a short bent piece under the hand
  const crook = new CylinderGeometry(0.016, 0.016, 0.08, 5, 1).rotateZ(Math.PI / 2).translate(0.035, -0.06, 0);
  parts.push(painted(crook.toNonIndexed(), new Color('#5a3b26')));
  for (const g of [dome, shaft, tip, crook]) g.dispose();
  const merged = mergeGeometries(parts, false)!;
  for (const g of parts) g.dispose();
  merged.computeVertexNormals();
  return merged;
}

const _c = new Color();

export class Umbrellas {
  readonly mesh: InstancedMesh;
  private n = 0;

  constructor() {
    const geo = umbrellaGeometry();
    const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0, side: DoubleSide });
    this.mesh = new InstancedMesh(geo, mat, CAPACITY);
    this.mesh.name = 'umbrellas';
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(CAPACITY * 3).fill(1), 3);
    this.mesh.instanceColor.setUsage(DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = true;
    // (instances anywhere in the town: never culled as a whole)
    this.mesh.frustumCulled = false;
    geo.boundingSphere = new Sphere(new Vector3(), Infinity);
  }

  /** Each frame, before the people's umbrellas are added. */
  begin(): void {
    this.n = 0;
  }

  /** One umbrella where a body holds it (`at`: its grip, from `umbrella()`), in the colour that is `id`'s. */
  add(at: Object3D, id: string): void {
    if (this.n >= CAPACITY) return;
    // (a body hidden while its avatar loads, or shown only as its avatar: the umbrella of what is not drawn is not)
    for (let o: Object3D | null = at; o; o = o.parent) if (!o.visible) return;
    at.updateWorldMatrix(true, false);
    this.mesh.setMatrixAt(this.n, at.matrixWorld);
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    this.mesh.setColorAt(this.n, _c.set(CANOPIES[h % CANOPIES.length]));
    this.n++;
  }

  /** After the last one: what was added this frame is what is drawn. */
  end(): void {
    if (this.mesh.count === 0 && this.n === 0) return;
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshStandardMaterial).dispose();
  }
}
