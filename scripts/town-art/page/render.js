// Runs inside headless Edge (driven by ../render.mjs). Loads Kenney GLB models with three.js and renders them with
// the town's camera: orthographic, 2:1 dimetric (a ground tile is 64 × 32 world px, src/features/town/engine/iso.ts),
// tile x running down-right and tile y down-left. Frames stay in page memory (window.TA.frames) until Node asks for
// an atlas or a contact sheet, which come back as base64 (WebP / PNG).
//
// World axes: three.js X = tile x, three.js Z = tile y, Y = up. One three.js unit = one tile edge.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** 30°: a flat square seen from here is exactly twice as wide as it is tall (sin 30° = 1/2), like engine/iso.ts. */
const ELEVATION = Math.PI / 6;
const TILE_W = 64;
/** World px per three.js unit along the screen (horizontally and vertically, the camera is orthographic). */
const PX_PER_UNIT = TILE_W / Math.SQRT2;

/** Model yaw (degrees) per screen direction. Kenney characters face +Z (tile +y = screen down-left = SW). */
const DIR_YAW = { SW: 0, S: 45, SE: 90, E: 135, NE: 180, N: 225, NW: 270, W: 315 };

const loader = new GLTFLoader();
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);

// screen-relative helpers: R = screen right, F = towards the viewer (on the ground), U = up
const R = new THREE.Vector3(1, 0, -1).normalize();
const F = new THREE.Vector3(1, 0, 1).normalize();
const U = new THREE.Vector3(0, 1, 0);
const along = (r, f, u) => R.clone().multiplyScalar(r).add(F.clone().multiplyScalar(f)).add(U.clone().multiplyScalar(u));

let lights = [];
function setLights(look) {
  for (const l of lights) scene.remove(l);
  lights = [];
  const hemi = new THREE.HemisphereLight(look.sky, look.ground, look.hemi);
  const key = new THREE.DirectionalLight(look.keyColor, look.key);
  key.position.copy(along(-0.7, 1, 1.3));
  // the fill comes from the viewer, so faces (which look at the viewer) stay readable under hats and hair
  const fill = new THREE.DirectionalLight(look.fillColor, look.fill);
  fill.position.copy(along(0.5, 1, 0.25));
  const rim = new THREE.DirectionalLight(look.rimColor, look.rim);
  rim.position.copy(along(0.6, -1, 0.9));
  lights = [hemi, key, fill, rim];
  for (const l of lights) scene.add(l);
}

const state = {
  model: null,
  mixer: null,
  clips: new Map(),
  frames: new Map(),
};

function prepMaterials(root, look) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (m.map) {
        m.map.generateMipmaps = false;
        m.map.minFilter = THREE.LinearFilter;
        m.map.magFilter = THREE.LinearFilter;
        m.map.anisotropy = 4;
        m.map.needsUpdate = true;
      }
      m.metalness = 0;
      m.roughness = look.roughness;
      m.needsUpdate = true;
    }
  });
}

/**
 * Drop the separate pieces of a mesh that lie wholly at |x| >= `minAbsX` in the bind pose (out along the arms) and
 * use colour cell `cell` of the colormap: female-a's crutches are part of her body mesh. Pieces = triangles joined
 * by shared vertex positions.
 */
function stripPieces(mesh, { minAbsX, cell }) {
  const g = mesh.geometry;
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  const index = g.index.array;
  const keyOf = new Map();
  const id = new Int32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const k = `${pos.getX(i).toFixed(4)},${pos.getY(i).toFixed(4)},${pos.getZ(i).toFixed(4)}`;
    if (!keyOf.has(k)) keyOf.set(k, keyOf.size);
    id[i] = keyOf.get(k);
  }
  const parent = Array.from({ length: keyOf.size }, (_, i) => i);
  const find = (a) => (parent[a] === a ? a : (parent[a] = find(parent[a])));
  for (let t = 0; t < index.length; t += 3) {
    const a = find(id[index[t]]);
    parent[find(id[index[t + 1]])] = a;
    parent[find(id[index[t + 2]])] = a;
  }
  const near = new Set();
  const coloured = new Set();
  for (let i = 0; i < pos.count; i++) {
    const c = find(id[i]);
    if (Math.abs(pos.getX(i)) < minAbsX) near.add(c);
    if (Math.floor(uv.getX(i) * 16) === cell[0] && Math.floor(uv.getY(i) * 4) === cell[1]) coloured.add(c);
  }
  const wide = new Set([...coloured].filter((c) => !near.has(c)));
  const kept = [];
  for (let t = 0; t < index.length; t += 3) if (!wide.has(find(id[index[t]]))) kept.push(index[t], index[t + 1], index[t + 2]);
  g.setIndex(kept);
  return (index.length - kept.length) / 3;
}

/**
 * Repaint part of a mesh: every vertex at |x| >= `minAbsX` in the bind pose (out along the arms) that uses colour
 * cell `from` takes cell `to` instead. male-e's hands and shoes share one black cell; this gives him bare hands
 * (the skin cell) and keeps the shoes black.
 */
function paintCells(mesh, { minAbsX, from, to }) {
  const pos = mesh.geometry.attributes.position;
  const uv = mesh.geometry.attributes.uv;
  let n = 0;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i) * 16;
    const v = uv.getY(i) * 4;
    if (Math.floor(u) !== from[0] || Math.floor(v) !== from[1] || Math.abs(pos.getX(i)) < minAbsX) continue;
    uv.setXY(i, (to[0] + (u - Math.floor(u))) / 16, (to[1] + (v - Math.floor(v))) / 4);
    n++;
  }
  uv.needsUpdate = true;
  return n;
}

/**
 * Palette swaps: Kenney's colormap is a grid of 16 × 4 colour cells; a swap copies cell `to` over cell `from` in a
 * copy of the texture used by one mesh only (body-mesh or head-mesh), e.g. a green shirt instead of a yellow one.
 */
function recolor(model, swaps) {
  const byMesh = new Map();
  for (const s of swaps) byMesh.set(s.mesh, [...(byMesh.get(s.mesh) ?? []), s]);
  for (const [name, list] of byMesh) {
    const mesh = model.getObjectByName(name);
    if (!mesh?.material?.map) throw new Error(`no textured mesh ${name}`);
    const img = mesh.material.map.image;
    const c = canvas(img.width, img.height);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const cw = img.width / 16;
    const ch = img.height / 4;
    for (const s of list) ctx.drawImage(img, s.to[0] * cw, s.to[1] * ch, cw, ch, s.from[0] * cw, s.from[1] * ch, cw, ch);
    const tex = new THREE.CanvasTexture(c);
    tex.flipY = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = mesh.material.clone();
    mat.map = tex;
    mesh.material = mat;
  }
}

async function loadCharacter({ glb, props = [], look, strip, paint, swaps = [] }) {
  if (state.model) scene.remove(state.model);
  const gltf = await loader.loadAsync(glb);
  const model = gltf.scene;
  if (strip) {
    const mesh = model.getObjectByName(strip.mesh);
    const n = stripPieces(mesh, strip);
    console.log(`stripped ${n} triangles from ${strip.mesh}`);
  }
  if (paint) {
    const n = paintCells(model.getObjectByName(paint.mesh), paint);
    console.log(`repainted ${n} vertices of ${paint.mesh}`);
  }
  if (swaps.length) recolor(model, swaps);
  for (const p of props) {
    const pg = await loader.loadAsync(p.glb);
    const bone = model.getObjectByName(p.bone);
    if (!bone) throw new Error(`no bone ${p.bone}`);
    pg.scene.position.fromArray(p.offset);
    if (p.scale) pg.scene.scale.setScalar(p.scale);
    bone.add(pg.scene);
  }
  prepMaterials(model, look);
  state.model = model;
  state.mixer = new THREE.AnimationMixer(model);
  state.clips = new Map(gltf.animations.map((c) => [c.name, c]));
  scene.add(model);
  return gltf.animations.map((c) => ({ name: c.name, duration: c.duration }));
}

/**
 * A gait: Kenney's walk made calmer. `leg`, `arm`, `torso`, `head` scale each bone's swing (about its pose at
 * t = 0, legs together). The clip's own root bob (0.05, the body up twice a cycle: a hop of 3 px) is dropped: the
 * body rides at one height through the whole cycle (`lift`, see pose). Lifting it frame by frame by what keeps a
 * rocking box shoe's corner out of the ground (as this once did) put the body lowest with the legs together and
 * highest mid-stride, the wrong way round for a walk: a little hop at every step.
 */
function gaitClip(clip, g) {
  const key = `${clip.name}|${JSON.stringify(g)}`;
  let c = state.clips.get(key);
  if (c) return c;
  c = clip.clone();
  c.name = key;
  const scale = { 'leg-left': g.leg, 'leg-right': g.leg, 'arm-left': g.arm, 'arm-right': g.arm, torso: g.torso, head: g.head };
  const q0 = new THREE.Quaternion();
  const q = new THREE.Quaternion();
  for (const tr of c.tracks) {
    const [node, prop] = tr.name.split('.');
    if (prop === 'quaternion' && scale[node] !== undefined) {
      const v = tr.values;
      q0.fromArray(v, 0);
      for (let i = 0; i < v.length; i += 4) {
        q.fromArray(v, i);
        q0.clone().slerp(q, scale[node]).toArray(v, i);
      }
    } else if (prop === 'position' && node === 'root') {
      const v = tr.values;
      for (let i = 0; i < v.length; i += 3) v[i + 1] = v[1];
    }
  }
  state.clips.set(key, c);
  return c;
}

const _v = new THREE.Vector3();
/**
 * The vertices a mesh still draws: those its index uses. stripPieces drops triangles from the index only, so the
 * position buffer of female-a's body still holds her crutches; counted, they swung below the ground in the walk and
 * lifted her whole walk about 4 world px over her idle (she floated, and dropped at every stop).
 */
function drawnVertices(o) {
  const g = o.geometry;
  if (g.userData.drawn && g.userData.drawnFor === g.index) return g.userData.drawn;
  const n = g.attributes.position.count;
  // in vertex order (the stride measure takes the first of equally low sole vertices: the order matters)
  const used = g.index ? [...new Set(g.index.array)].sort((a, b) => a - b) : Array.from({ length: n }, (_, i) => i);
  g.userData.drawn = used;
  g.userData.drawnFor = g.index;
  return used;
}

/** The lowest point of the model (world y), skinning applied: only what is drawn. */
function lowestY() {
  state.model.updateMatrixWorld(true);
  let min = Infinity;
  state.model.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    o.skeleton.update();
    for (const i of drawnVertices(o)) {
      o.getVertexPosition(i, _v);
      _v.applyMatrix4(o.matrixWorld);
      if (_v.y < min) min = _v.y;
    }
  });
  return min;
}

/** The lowest skinned vertex of each leg's sole (world), for the stride measure. */
function feetNow() {
  state.model.updateMatrixWorld(true);
  const out = {};
  state.model.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    o.skeleton.update();
    const bones = o.skeleton.bones;
    const si = o.geometry.attributes.skinIndex;
    const sw = o.geometry.attributes.skinWeight;
    for (const i of drawnVertices(o)) {
      let best = -1;
      let bw = 0;
      for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(i, k);
        if (w > bw) {
          bw = w;
          best = si.getComponent(i, k);
        }
      }
      const name = bones[best]?.name;
      if (name !== 'leg-left' && name !== 'leg-right') continue;
      o.getVertexPosition(i, _v);
      _v.applyMatrix4(o.matrixWorld);
      if (!out[name] || _v.y < out[name].y) out[name] = { y: _v.y, z: _v.z };
    }
  });
  return out;
}

/**
 * Arms. Kenney's clips hold the arms 45° out from the body (an A-pose) and, in the walk, swing them sideways and up
 * towards the shoulders: from the front and the back that reads as a stiff "zombie" stance. Every pose made here
 * hangs them `ARM_REST` degrees down from the horizontal instead (about 17° off the body, clear of the torso box),
 * and the walk swings them forward and back from the shoulder, opposite to the legs.
 */
const ARM_REST = 73;
const deg = THREE.MathUtils.degToRad;
const smooth = (a, b, x) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
const bone = (name) => state.model.getObjectByName(name);

/**
 * Set one arm (`side` 'left' | 'right', the model's own sides): `down` = degrees below the horizontal, `swing` =
 * degrees forward (+) or back (−) from the shoulder, `twist` = degrees turned about the vertical (+ = hand inwards).
 */
function setArm(side, { down = ARM_REST, swing = 0, twist = 0 }) {
  const s = side === 'left' ? -1 : 1;
  // XYZ: lowered first (about z), then turned (y), then swung from the shoulder (about x); the model faces +z, and a
  // rotation of −x takes a hanging arm forward
  bone(`arm-${side}`).quaternion.setFromEuler(new THREE.Euler(deg(-swing), deg(-twist * s), deg(s * down), 'XYZ'));
}

const angleX = (name) => new THREE.Euler().setFromQuaternion(bone(name).quaternion, 'XYZ').x;

/**
 * The walk's arms (on a gait clip: legs, torso and head from Kenney, scaled): each arm swings opposite to the other
 * side's leg, up to `g.armSwing` degrees, and comes a little in towards the body as it goes forward (so the swing
 * reads from the front and the back too, not only from the side).
 */
function walkArms(g) {
  const legMax = deg(60 * g.leg);
  for (const [side, leg] of [['left', 'leg-right'], ['right', 'leg-left']]) {
    // a leg forward is a negative x rotation; the opposite arm goes forward with it
    const swing = g.armSwing * (-angleX(leg) / legMax);
    setArm(side, { down: ARM_REST + 0.25 * swing, swing });
  }
}

/**
 * Poses made here on top of Kenney's idle at t = 0 (legs together, body upright). `u` = 0..1 through the clip; each
 * starts on the rest pose (u = 0) and the loop / the one-shot ends on it (u = 1), so the idle, the emotes and walk
 * frame 0 meet without a pop.
 *
 * - idle (a loop of 2 s): breathing (the chest rises about a world pixel, the arms lift a touch with it), the weight
 *   going from one foot to the other a quarter of a loop later (the body rocks 1.4° on its feet, the head stays
 *   upright), the head looking a little to one side and back, the arms settling.
 * - yes: two nods (the head tips about 17°, the body bobs with them), from the first frame.
 * - no: two and a half quick head shakes (±24°), the shoulders turning against the head a little, the hands coming
 *   up in front.
 * - wave: the near arm (the right one, in SE) comes up beside the head, waves twice and comes down (Kenney's
 *   interact-right is a reach, not a wave).
 */
function procPose(name, u) {
  const torso = bone('torso');
  const head = bone('head');
  const root = bone('root');
  const TAU = Math.PI * 2;
  if (name === 'idle') {
    const breath = (1 - Math.cos(TAU * u)) / 2;
    const sway = Math.sin(TAU * u);
    const look = Math.sin(TAU * u) * 0.75 + Math.sin(TAU * 2 * u) * 0.25;
    root.quaternion.setFromEuler(new THREE.Euler(0, 0, deg(1.4 * sway)));
    torso.position.y += 0.012 * breath;
    torso.quaternion.setFromEuler(new THREE.Euler(deg(-1.5 * breath), deg(2 * look), deg(-0.8 * sway)));
    head.quaternion.setFromEuler(new THREE.Euler(deg(1.5 * breath), deg(8 * look), deg(-0.7 * sway)));
    const settle = 2.5 * (Math.sin(TAU * u + 0.6) - Math.sin(0.6));
    setArm('left', { down: ARM_REST - 3 * breath - 1.5 * sway, swing: settle });
    setArm('right', { down: ARM_REST - 3 * breath + 1.5 * sway, swing: -settle });
    return;
  }
  if (name === 'yes') {
    const bump = (a, b) => (u <= a || u >= b ? 0 : Math.sin((Math.PI * (u - a)) / (b - a)) ** 2);
    const nod = bump(0, 0.46) + 0.85 * bump(0.44, 0.94);
    head.quaternion.setFromEuler(new THREE.Euler(deg(17 * nod), 0, 0));
    torso.quaternion.setFromEuler(new THREE.Euler(deg(4 * nod), 0, 0));
    root.position.y += 0.01 * nod;
    setArm('left', { down: ARM_REST - 4 * nod, swing: 4 * nod });
    setArm('right', { down: ARM_REST - 4 * nod, swing: 4 * nod });
    return;
  }
  if (name === 'no') {
    const env = smooth(0, 0.1, u) * (1 - smooth(0.8, 1, u));
    const shake = Math.sin(TAU * 2.5 * u) * env;
    head.quaternion.setFromEuler(new THREE.Euler(deg(-3 * env), deg(24 * shake), 0));
    torso.quaternion.setFromEuler(new THREE.Euler(0, deg(-6 * shake), 0));
    const hands = smooth(0, 0.22, u) * (1 - smooth(0.7, 1, u));
    setArm('left', { down: ARM_REST - 14 * hands, swing: 26 * hands, twist: 15 * hands });
    setArm('right', { down: ARM_REST - 14 * hands, swing: 26 * hands, twist: 15 * hands });
    return;
  }
  if (name === 'wave') {
    const up = smooth(0, 0.24, u) * (1 - smooth(0.78, 1, u));
    const swing = Math.sin(((u - 0.24) / 0.54) * TAU * 2) * smooth(0.18, 0.3, u) * (1 - smooth(0.7, 0.8, u));
    // the right arm (the near one in SE, where the emotes are rendered) from hanging to raised beside the head (50°
    // above the horizontal, a little back so the hand is not over the face), waving about there
    setArm('right', { down: ARM_REST - (ARM_REST + 45) * up + 20 * swing * up, swing: 24 * up });
    setArm('left', { down: ARM_REST + 2 * up });
    torso.quaternion.setFromEuler(new THREE.Euler(0, deg(-6) * up, deg(-4) * up));
    head.quaternion.setFromEuler(new THREE.Euler(deg(-4) * up, deg(8) * up, deg(6) * up + deg(3) * swing * up));
    return;
  }
  throw new Error(`no pose ${name}`);
}

/**
 * Pose the model: `spec` = a clip name, { clip, gait } (a calmer grounded walk, gaitClip, with walkArms), or
 * { proc, duration } (a pose made here, procPose). `t` in seconds.
 */
function pose(spec, t) {
  const s = typeof spec === 'string' ? { clip: spec } : spec;
  const base = state.clips.get(s.proc ? 'idle' : s.clip);
  if (!base) throw new Error(`no clip ${s.clip}`);
  const clip = s.gait ? gaitClip(base, s.gait) : base;
  state.mixer.stopAllAction();
  // every bone back to its bind pose first: a clip leaves untouched what it does not animate, and the poses made
  // here move bones (root, torso) some clips never set
  state.model.traverse((o) => {
    if (!o.isBone) return;
    o.userData.bind ??= { p: o.position.clone(), q: o.quaternion.clone() };
    o.position.copy(o.userData.bind.p);
    o.quaternion.copy(o.userData.bind.q);
  });
  const action = state.mixer.clipAction(clip);
  action.reset();
  action.play();
  state.mixer.setTime(s.proc ? 0 : t);
  state.model.position.y = 0;
  if (s.proc) procPose(s.proc, t / s.duration);
  else if (s.gait) walkArms(s.gait);
  else {
    // a Kenney clip as it is (portraits): the arms hang all the same
    setArm('left', {});
    setArm('right', {});
  }
  // the walk rides at one height (gait.lift, the same in every frame: no hop at a step); the game lowers the sprite
  // by it as a walk slows to a stand (engine.ts walkDrop), so legs together on the spot meets the idle's ground
  if (s.gait) state.model.position.y = s.gait.lift ?? 0;
}

/**
 * How far the ground moves under a gait per cycle when the lower foot does not slide (three.js units = tiles,
 * model scale included): while one foot is the lower one, its travel backwards relative to the body adds up. With
 * the body at rest height (no lift), also: `dig` = how far the lowest corner of a rocking box shoe goes below the
 * ground at most (render.mjs lifts the walk by a share of it), and at each of `frames` evenly over the cycle `digs`
 * (that depth then) and `heads` (the head bone's height): what the frames will show, for the log.
 */
function measureStride({ clip, gait, scale, steps = 240, frames = 16 }) {
  state.model.scale.setScalar(scale);
  state.model.rotation.set(0, 0, 0);
  const base = state.clips.get(clip);
  const dur = base.duration;
  const flat = { ...gait, lift: 0 };
  let prev = null;
  let travel = 0;
  let dig = 0;
  for (let i = 0; i <= steps; i++) {
    pose({ clip, gait: flat }, (i / steps) * dur);
    dig = Math.max(dig, -lowestY());
    const f = feetNow();
    const low = f['leg-left'].y <= f['leg-right'].y ? 'leg-left' : 'leg-right';
    const z = f[low].z;
    if (prev && prev.low === low && z < prev.z) travel += prev.z - z;
    prev = { low, z };
  }
  // the second "legs together" (the legs cross again): Kenney's walk has it a little before half the clip, so walk
  // frame n / 2 (where the game stops on an odd multiple of π) would show a foot still swung; render.mjs times the
  // frames so that frame n / 2 falls exactly here
  pose({ clip, gait: flat }, 0);
  const cross0 = angleX('leg-left') - angleX('leg-right');
  let pass = dur / 2;
  let passOff = Infinity;
  for (let i = 0; i <= 400; i++) {
    const t = dur * (0.3 + (0.4 * i) / 400);
    pose({ clip, gait: flat }, t);
    const off = Math.abs(angleX('leg-left') - angleX('leg-right') - cross0);
    if (off < passOff) {
      passOff = off;
      pass = t;
    }
  }
  const digs = [];
  const heads = [];
  const at = new THREE.Vector3();
  for (let i = 0; i < frames; i++) {
    pose({ clip, gait: flat }, walkSampleTime(i, frames, dur, pass));
    digs.push(Math.max(0, -lowestY()));
    bone('head').getWorldPosition(at);
    heads.push(at.y);
  }
  state.model.position.y = 0;
  return { stride: travel, dig: Math.max(0, dig), digs, heads, duration: dur, pass };
}

/**
 * When walk frame i of n is taken: the first half of the frames evenly from legs together (t = 0) to the legs
 * crossing again (`pass`), the second half from there to the end of the cycle. Frames 0 and n / 2 are then both
 * legs together, where the game's walk stops (render.mjs uses the same mapping).
 */
function walkSampleTime(i, n, dur, pass) {
  const h = n / 2;
  return i < h ? (i / h) * pass : pass + ((i - h) / h) * (dur - pass);
}

/** Point the orthographic camera so that the ground point (0,0,0) lands at pixel (ax, ay) of a w × h px view. */
function aimIso(w, h, ax, ay, pxPerUnit, elevation = ELEVATION) {
  // the viewer stands on the +x +y side of the town (iso.ts: tile (0,0) is the far corner)
  const view = new THREE.Vector3(Math.cos(elevation) / Math.SQRT2, Math.sin(elevation), Math.cos(elevation) / Math.SQRT2);
  camera.left = -ax / pxPerUnit;
  camera.right = (w - ax) / pxPerUnit;
  camera.top = ay / pxPerUnit;
  camera.bottom = -(h - ay) / pxPerUnit;
  camera.position.copy(view.multiplyScalar(120));
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 0, 0);
  camera.near = 0.1;
  camera.far = 300;
  camera.updateProjectionMatrix();
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  // software canvases: about two thousand of them stay alive at once, too many for GPU canvases (toBlob stalls)
  c.getContext('2d', { willReadFrequently: true });
  return c;
}

/** Render the current pose into a W × H canvas (supersampled `ss` times, then scaled down). */
function snap(W, H, ss) {
  renderer.setSize(W * ss, H * ss, false);
  renderer.render(scene, camera);
  const out = canvas(W, H);
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (FILTER) ctx.filter = FILTER;
  if (ss >= 4) {
    // two halvings look cleaner than one big step
    const mid = canvas(W * 2, H * 2);
    const mctx = mid.getContext('2d');
    mctx.imageSmoothingQuality = 'high';
    mctx.drawImage(renderer.domElement, 0, 0, W * 2, H * 2);
    ctx.drawImage(mid, 0, 0, W, H);
  } else {
    ctx.drawImage(renderer.domElement, 0, 0, W, H);
  }
  return out;
}

/** A touch more colour than the raw render (Kenney's palette is soft): cosier, and it reads better on grass. */
let FILTER = 'saturate(1.06) contrast(1.04)';

/** A soft dark line around the silhouette, `r` px wide. */
function outlined(char, r, color, alpha) {
  if (r <= 0) return char;
  const W = char.width;
  const H = char.height;
  const o = canvas(W, H);
  const octx = o.getContext('2d');
  const steps = 16;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    octx.drawImage(char, Math.cos(a) * r, Math.sin(a) * r);
  }
  octx.globalCompositeOperation = 'source-in';
  octx.fillStyle = color;
  octx.fillRect(0, 0, W, H);
  const out = canvas(W, H);
  const ctx = out.getContext('2d');
  ctx.globalAlpha = alpha;
  ctx.drawImage(o, 0, 0);
  ctx.globalAlpha = 1;
  ctx.drawImage(char, 0, 0);
  return out;
}

function withShadow(char, ax, ay, rx, look) {
  const out = canvas(char.width, char.height);
  const ctx = out.getContext('2d');
  if (rx > 0) {
    ctx.save();
    ctx.translate(ax, ay);
    ctx.scale(1, 0.5);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, `rgba(${look.shadowRgb}, ${look.shadowAlpha})`);
    g.addColorStop(0.55, `rgba(${look.shadowRgb}, ${look.shadowAlpha * 0.7})`);
    g.addColorStop(1, `rgba(${look.shadowRgb}, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.drawImage(char, 0, 0);
  return out;
}

/** Crop to the opaque pixels. Returns the canvas and where its top-left was. */
function trim(c, pad = 1) {
  const { width: W, height: H } = c;
  const data = c.getContext('2d').getImageData(0, 0, W, H).data;
  let x0 = W;
  let y0 = H;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4 + 3] > 2) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return { c: canvas(1, 1), x: 0, y: 0 };
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(W - 1, x1 + pad);
  y1 = Math.min(H - 1, y1 + pad);
  const out = canvas(x1 - x0 + 1, y1 - y0 + 1);
  out.getContext('2d').drawImage(c, -x0, -y0);
  return { c: out, x: x0, y: y0 };
}

/**
 * Render a set of character frames. job = { prefix, scale, res, ss, cell: { w, h, foot }, items: [{ key, clip, dir,
 * t }], look }. Every frame is a cell of cell.w × cell.h world px with the feet at (cell.w / 2, cell.foot), at `res`
 * px per world px, then trimmed. Returns [{ key, w, h, ax, ay }] (anchor = the feet, inside the trimmed frame).
 */
function renderFrames(job) {
  const { prefix, scale, res, ss, cell, items, look } = job;
  setLights(look);
  state.model.scale.setScalar(scale);
  state.model.position.set(0, 0, 0);
  const W = Math.round(cell.w * res);
  const H = Math.round(cell.h * res);
  const ax = W / 2;
  const ay = cell.foot * res;
  aimIso(W * ss, H * ss, ax * ss, ay * ss, PX_PER_UNIT * res * ss);
  const out = [];
  for (const it of items) {
    state.model.rotation.set(0, THREE.MathUtils.degToRad(DIR_YAW[it.dir]), 0);
    pose(it.clip, it.t);
    let c = snap(W, H, ss);
    c = outlined(c, look.outline * res, look.outlineColor, look.outlineAlpha);
    const t = trim(c);
    state.frames.set(`${prefix}:${it.key}`, t.c);
    out.push({ key: it.key, w: t.c.width, h: t.c.height, ax: ax - t.x, ay: ay - t.y });
  }
  return out;
}

/**
 * Portraits: head and shoulders, three-quarter front, a little above eye level. job = { prefix, scale, size, ss,
 * items: [{ key, clip, t }], look, frame: { yaw, elevation, centerY, halfH } } (centerY / halfH in model units).
 */
function renderPortraits(job) {
  const { prefix, scale, size, ss, items, look, frame } = job;
  setLights(look);
  state.model.scale.setScalar(scale);
  const W = size;
  const ppu = size / 2 / (frame.halfH * scale);
  for (const it of items) {
    state.model.rotation.set(0, THREE.MathUtils.degToRad(frame.yaw), 0);
    pose(it.clip, it.t);
    // the camera aims at the ground under the model; lift the view so centerY sits in the middle
    const elev = THREE.MathUtils.degToRad(frame.elevation);
    const cy = frame.centerY * scale * Math.cos(elev) * ppu;
    aimIso(W * ss, W * ss, (W / 2 + (frame.shiftX ?? 0) * W) * ss, (W / 2 + cy) * ss, ppu * ss, elev);
    let c = snap(W, W, ss);
    c = outlined(c, look.outline * (size / 96), look.outlineColor, look.outlineAlpha);
    state.frames.set(`${prefix}:${it.key}`, c);
  }
  return items.map((it) => it.key);
}

async function blobBase64(c, type, quality) {
  const blob = await new Promise((res) => c.toBlob(res, type, quality));
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Draw stored frames into one picture. job = { width, height, bg?, items: [{ key, x, y, w?, h?, flip? }], labels?, type, quality }. */
async function compose(job) {
  const c = canvas(job.width, job.height);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  if (job.bg) {
    ctx.fillStyle = job.bg;
    ctx.fillRect(0, 0, job.width, job.height);
  }
  const rect = (r) => {
    ctx.globalCompositeOperation = r.op ?? 'source-over';
    ctx.fillStyle = r.color;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.globalCompositeOperation = 'source-over';
  };
  for (const r of job.rects ?? []) rect(r);
  for (const it of job.items) {
    if (it.rect) {
      rect(it.rect);
      continue;
    }
    const f = state.frames.get(it.key);
    if (!f) throw new Error(`no frame ${it.key}`);
    const w = it.w ?? f.width;
    const h = it.h ?? f.height;
    ctx.globalAlpha = it.alpha ?? 1;
    ctx.globalCompositeOperation = it.op ?? 'source-over';
    if (it.flip) {
      ctx.save();
      ctx.translate(it.x + w, it.y);
      ctx.scale(-1, 1);
      ctx.drawImage(f, 0, 0, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(f, it.x, it.y, w, h);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.font = '600 13px system-ui, sans-serif';
  for (const l of job.labels ?? []) {
    ctx.fillStyle = l.color ?? '#333';
    ctx.fillText(l.text, l.x, l.y);
  }
  return blobBase64(c, job.type ?? 'image/png', job.quality);
}

/**
 * The contact shadow under a person: a soft ellipse (2:1, it lies on the ground), the same for everyone, so it is
 * one small sprite the game draws before the character instead of being repeated in every frame.
 */
function renderShadow({ key, rx, res, look }) {
  const r = rx * PX_PER_UNIT * res;
  const W = Math.ceil(r * 2 + 4);
  const H = Math.ceil(r + 4);
  const c = withShadow(canvas(W, H), W / 2, H / 2, r, look);
  state.frames.set(key, c);
  return { w: W, h: H, ax: W / 2, ay: H / 2 };
}

function clearFrames(prefix) {
  for (const k of [...state.frames.keys()]) if (!prefix || k.startsWith(prefix + ':')) state.frames.delete(k);
}

/** For contact sheets: a frame cut from a picture on the server (e.g. a character atlas already rendered). */
async function loadFrame({ key, url, sx = 0, sy = 0, sw, sh }) {
  const img = new Image();
  img.src = url;
  await img.decode();
  const w = sw ?? img.width;
  const h = sh ?? img.height;
  const c = canvas(w, h);
  c.getContext('2d').drawImage(img, sx, sy, w, h, 0, 0, w, h);
  state.frames.set(key, c);
  return { w, h };
}

function frameSize(key) {
  const f = state.frames.get(key);
  return f ? { w: f.width, h: f.height } : null;
}

// shared with world.js (the buildings, props and ground use the same camera, lights, outline and atlases)
export { THREE, lights, scene, camera, renderer, loader, setLights, prepMaterials, aimIso, snap, outlined, trim, canvas, state, blobBase64, ELEVATION, PX_PER_UNIT, DIR_YAW, R, F, U, along };

window.TA = { loadCharacter, measureStride, renderFrames, renderPortraits, renderShadow, compose, clearFrames, frameSize, loadFrame, webgl: renderer.capabilities.isWebGL2 };
window.TA_READY = true;
