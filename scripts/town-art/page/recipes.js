// The recipes of the town's world: how each place, lot, tree, prop and the ground is put together from Kenney's
// city kits (art-src/kenney, CC0) and plain low-poly shapes in the same flat colours. Used by world.js.
//
// Units: one three.js unit = one tile edge; X = tile x, Z = tile y, Y = up. A place is built with its door on the
// +Z face (the 'y' face of townWorld.ts), `front` tiles wide along X and `deep` tiles along Z, centred on the
// origin; a place whose door is on the +X face is the same recipe turned a quarter (world.mjs passes face 'x').
// Signs carry symbols, never words.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

let LOOK = { roughness: 0.9 };
export function setRecipeLook(look) {
  LOOK = look;
}

// ---- materials and shapes ----------------------------------------------------------------------------------------

const mats = new Map();
/** A flat-coloured material (cached). o.glow = the colour it gives off at night (lit layer). */
export function mat(color, o = {}) {
  const key = JSON.stringify([color, o]);
  if (mats.has(key)) return mats.get(key);
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: o.rough ?? LOOK.roughness,
    metalness: 0,
    flatShading: o.flat ?? false,
    transparent: o.opacity !== undefined,
    opacity: o.opacity ?? 1,
    side: o.double ? THREE.DoubleSide : THREE.FrontSide,
    vertexColors: o.vertexColors ?? false,
  });
  if (o.glow) m.userData.glow = o.glow;
  mats.set(key, m);
  return m;
}

function place(mesh, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s } = {}) {
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, rz);
  if (s !== undefined) {
    if (Array.isArray(s)) mesh.scale.set(...s);
    else mesh.scale.setScalar(s);
  }
  return mesh;
}

/** A box standing on y (its bottom), centred on x, z. o.r rounds its edges. */
export function box(w, h, d, color, o = {}) {
  const geo = o.r ? new RoundedBoxGeometry(w, h, d, 2, Math.min(o.r, w / 2, h / 2, d / 2)) : new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(geo, typeof color === 'string' ? mat(color, o.m) : color);
  return place(m, { ...o, y: (o.y ?? 0) + h / 2 });
}

/** A cylinder standing on y. o.top = top radius (a cone when 0). */
export function cyl(r, h, color, o = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(o.top ?? r, r, h, o.seg ?? 20, 1, o.open ?? false), typeof color === 'string' ? mat(color, o.m) : color);
  return place(m, { ...o, y: (o.y ?? 0) + h / 2 });
}

/** A ball (icosphere) centred at y. */
export function ball(r, color, o = {}) {
  const geo = o.detail === undefined || o.detail > 2 ? new THREE.SphereGeometry(r, 20, 14) : new THREE.IcosahedronGeometry(r, o.detail);
  const m = new THREE.Mesh(geo, typeof color === 'string' ? mat(color, { flat: o.detail !== undefined && o.detail <= 2, ...o.m }) : color);
  return place(m, o);
}

export function group(...children) {
  const g = new THREE.Group();
  for (const c of children.flat()) if (c) g.add(c);
  return g;
}

/** A tube along points (a wire, a string, a pipe). */
export function tube(points, r, color, o = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, o.seg ?? 24, r, 6, false), typeof color === 'string' ? mat(color, o.m) : color);
  return m;
}

/** A flat shape (THREE.Shape in the XZ ground plane, y up) extruded `h` up from `y`. */
export function slab(shape, h, color, o = {}) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: !!o.bevel, bevelSize: o.bevel ?? 0, bevelThickness: o.bevel ?? 0, bevelSegments: 2, curveSegments: o.curve ?? 24 });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, h, 0);
  const m = new THREE.Mesh(geo, typeof color === 'string' ? mat(color, o.m) : color);
  return place(m, o);
}

// ---- Kenney kits -------------------------------------------------------------------------------------------------

const loader = new GLTFLoader();
const kitCache = new Map();
const KITS = {
  sub: '/kenney/city-kit-suburban/Models/GLTF format/',
  road: '/kenney/city-kit-roads/Models/GLTF format/',
};

/**
 * A Kenney model ("sub/house_type05", "road/light_curved"), as a fresh copy with its own materials. The roads kit
 * moves every model 0.75 along z inside the file: that is undone, so the origin is the model's own foot. o.center:
 * centre the footprint on the origin (the suburban houses have their origin at a corner). o.paint: { material
 * name: colour } recolours by Kenney's material names (_defaultMat = walls, roof, window, door, border, wood…).
 */
export async function kit(name, o = {}) {
  const [pack, file] = name.split('/');
  if (!kitCache.has(name)) kitCache.set(name, loader.loadAsync(KITS[pack] + file + '.glb'));
  const gltf = await kitCache.get(name);
  const root = gltf.scene.clone(true);
  root.traverse((n) => {
    if (n !== root && n.parent === root) n.position.set(0, 0, 0);
    if (n.parent && n.parent.parent === root && pack === 'road') n.position.set(0, 0, 0);
    if (!n.isMesh) return;
    n.material = Array.isArray(n.material) ? n.material.map((m) => repaint(m, o)) : repaint(n.material, o);
  });
  const g = new THREE.Group();
  g.add(root);
  if (o.center) {
    root.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(root);
    root.position.x -= (b.min.x + b.max.x) / 2;
    root.position.z -= (b.min.z + b.max.z) / 2;
    root.position.y -= b.min.y;
  }
  return place(g, o);
}

function repaint(m, o) {
  const c = new THREE.MeshStandardMaterial({ roughness: LOOK.roughness, metalness: 0, map: m.map ?? null });
  // the city kits' colours are meant as screen colours (Kenney's own previews): read the factors as sRGB
  if (m.map) c.color.copy(m.color);
  else c.color.setRGB(m.color.r, m.color.g, m.color.b, THREE.SRGBColorSpace);
  c.name = m.name;
  const p = o.paint?.[m.name];
  if (p) c.color = new THREE.Color(p);
  const glow = o.glow?.[m.name];
  if (glow) c.userData.glow = glow;
  return c;
}

/** Bounding box of an object, in its parent's space. */
export function bounds(obj) {
  obj.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(obj);
}

// ---- the recipe table --------------------------------------------------------------------------------------------

const RECIPES = {
  /** For looking at a kit model on its own. */
  async kit({ name, s = 1, ry = 0, paint }) {
    return { object: await kit(name, { s, ry, paint, center: true }) };
  },
};

export function addRecipes(table) {
  Object.assign(RECIPES, table);
}

export async function buildRecipe(name, args) {
  const r = RECIPES[name];
  if (!r) throw new Error(`no recipe ${name}`);
  const built = await r(args);
  return built.object ? built : { object: built };
}

let groundBuilder = null;
export function setGroundBuilder(fn) {
  groundBuilder = fn;
}
export async function buildGround(layout) {
  if (!groundBuilder) throw new Error('no ground builder');
  return groundBuilder(layout);
}

export { THREE };
