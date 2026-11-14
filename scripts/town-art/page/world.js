// Runs inside headless Edge next to render.js: the WORLD of "Thị trấn" (the thirteen places, empty lots, trees,
// street furniture, the cat and the ground), rendered with the same camera, lights, outline and trimming as the
// people, so the town and its residents look like one picture.
//
// Every item is a three.js Group built by a recipe (recipes.js) from Kenney's city kits (art-src/kenney, CC0) and
// plain low-poly shapes in the kits' flat colours. One item gives up to three layers, each trimmed with its own
// anchor (the ground point under the item's origin):
//   body   the thing itself, outlined like the people;
//   lit    only what gives off light (windows, lamp heads, bulbs), with a soft halo: the game fades it in at night;
//   shadow its shadow on the ground (cast by the key light, plus a soft contact shadow straight down), drawn by
//          the game on the ground before anything stands on it.
// The ground (island, grass, paths, plaza, pond, the fixed trees' shadows) is one picture: renderGround.

import {
  THREE,
  lights,
  scene,
  camera,
  renderer,
  setLights,
  aimIso,
  snap,
  outlined,
  trim,
  canvas,
  state,
  PX_PER_UNIT,
  DIR_YAW,
  R,
  along,
  ELEVATION,
} from './render.js';
import { buildRecipe, buildGround, setRecipeLook } from './recipes.js';
import './places.js';
import './props.js';
import './ground.js';

/** Screen axes of the town camera, in three.js world space: right, and up the screen. */
const SR = R.clone();
const SU = new THREE.Vector3(-Math.sin(ELEVATION) / Math.SQRT2, Math.cos(ELEVATION), -Math.sin(ELEVATION) / Math.SQRT2);

/** Pixel offset (at 1 px per world px) of a three.js point from the ground origin: x right, y down. */
function screenOf(p) {
  return { x: p.dot(SR) * PX_PER_UNIT, y: -p.dot(SU) * PX_PER_UNIT };
}

/** The screen box (world px, relative to the origin) of a 3D box, grown by `pad` px. */
function screenBox(box, pad = 4) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        const s = screenOf(new THREE.Vector3(x, y, z));
        x0 = Math.min(x0, s.x);
        y0 = Math.min(y0, s.y);
        x1 = Math.max(x1, s.x);
        y1 = Math.max(y1, s.y);
      }
    }
  }
  return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
}

/** Aim the camera at a screen box (world px) at `res` px per world px; returns the canvas size and the anchor. */
function frame(sb, res, ss) {
  const W = Math.max(2, Math.ceil((sb.x1 - sb.x0) * res));
  const H = Math.max(2, Math.ceil((sb.y1 - sb.y0) * res));
  const ax = -sb.x0 * res;
  const ay = -sb.y0 * res;
  aimIso(W * ss, H * ss, ax * ss, ay * ss, PX_PER_UNIT * res * ss);
  return { W, H, ax, ay };
}

// ---- the lit layer -----------------------------------------------------------------------------------------------

const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false });
const hidden = new THREE.MeshBasicMaterial({ visible: false });

/** Swap every mesh's material(s) through `fn`; returns a function that puts the old ones back. */
function swapMaterials(root, fn) {
  const saved = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    saved.push([o, o.material]);
    o.material = Array.isArray(o.material) ? o.material.map(fn) : fn(o.material);
  });
  return () => {
    for (const [o, m] of saved) o.material = m;
  };
}

const glowMats = new Map();
function glowMaterial(color) {
  if (!glowMats.has(color)) {
    glowMats.set(
      color,
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    );
  }
  return glowMats.get(color);
}

/** What gives off light: materials with userData.glow (a colour). Hidden behind the item's own solid parts. */
function renderLit(obj, W, H, ss, res, look) {
  let any = false;
  obj.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m.userData.glow) any = true;
  });
  if (!any) return null;
  renderer.setSize(W * ss, H * ss, false);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  scene.overrideMaterial = depthOnly;
  renderer.render(scene, camera);
  scene.overrideMaterial = null;
  const restore = swapMaterials(obj, (m) => (m.userData.glow ? glowMaterial(m.userData.glow) : hidden));
  renderer.autoClear = false;
  renderer.render(scene, camera);
  renderer.autoClear = true;
  restore();
  const raw = canvas(W, H);
  const rctx = raw.getContext('2d');
  rctx.imageSmoothingQuality = 'high';
  rctx.drawImage(renderer.domElement, 0, 0, W, H);
  // a soft halo under the sharp light
  const out = canvas(W, H);
  const ctx = out.getContext('2d');
  ctx.filter = `blur(${(look.glowBlur * res).toFixed(1)}px)`;
  ctx.globalAlpha = look.glowHalo;
  ctx.drawImage(raw, 0, 0);
  ctx.drawImage(raw, 0, 0);
  ctx.filter = 'none';
  ctx.globalAlpha = 1;
  ctx.drawImage(raw, 0, 0);
  return out;
}

// ---- the shadow layer --------------------------------------------------------------------------------------------

let shadowRig = null;
function rig(look) {
  if (shadowRig) return shadowRig;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const mk = (dir, size, radius) => {
    const l = new THREE.DirectionalLight(0xffffff, 1);
    l.castShadow = true;
    l.shadow.mapSize.set(size, size);
    l.shadow.radius = radius;
    l.shadow.bias = -0.0008;
    l.shadow.normalBias = 0.01;
    l.userData.dir = dir;
    return l;
  };
  // the sun (the key light's direction) and a soft "sky" shadow straight down: dark at the foot of a wall
  const sun = mk(along(...look.sunDir).normalize(), 2048, 3);
  const sky = mk(new THREE.Vector3(0.05, 1, 0.08).normalize(), 1024, 10);
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.ShadowMaterial({ color: new THREE.Color(look.shadowColor), opacity: 1, transparent: true, depthWrite: false }),
  );
  plane.receiveShadow = true;
  plane.position.y = 0.002;
  shadowRig = { sun, sky, plane };
  return shadowRig;
}

/** Fit a directional light's shadow camera round a box. */
function aimShadow(light, box) {
  const c = box.getCenter(new THREE.Vector3());
  const r = box.getSize(new THREE.Vector3()).length() / 2 + 0.5;
  light.position.copy(c).addScaledVector(light.userData.dir, 30);
  light.target.position.copy(c);
  light.target.updateMatrixWorld();
  const cam = light.shadow.camera;
  cam.left = -r;
  cam.right = r;
  cam.top = r;
  cam.bottom = -r;
  cam.near = 0.1;
  cam.far = 80;
  cam.updateProjectionMatrix();
}

/** Where the shadow can reach on the ground: the box pushed along the sun to the ground. */
function shadowReach(box, look) {
  const d = along(...look.sunDir).normalize();
  const h = box.max.y;
  const reach = box.clone();
  const off = new THREE.Vector3(-d.x / d.y, 0, -d.z / d.y).multiplyScalar(h);
  reach.expandByPoint(new THREE.Vector3(box.min.x + off.x, 0, box.min.z + off.z));
  reach.expandByPoint(new THREE.Vector3(box.max.x + off.x, 0, box.max.z + off.z));
  reach.expandByScalar(0.3);
  reach.min.y = 0;
  reach.max.y = 0;
  return reach;
}

function renderShadowLayer(obj, box, res, ss, look) {
  const { sun, sky, plane } = rig(look);
  const reach = shadowReach(box, look);
  const size = reach.getSize(new THREE.Vector3());
  plane.scale.set(size.x + 1, 1, size.z + 1);
  plane.position.set((reach.min.x + reach.max.x) / 2, 0.002, (reach.min.z + reach.max.z) / 2);
  const all = box.clone().union(reach);
  aimShadow(sun, all);
  aimShadow(sky, all);
  const restore = swapMaterials(obj, (m) => {
    const c = m.clone();
    c.colorWrite = false;
    c.depthWrite = false;
    return c;
  });
  obj.traverse((o) => {
    if (o.isMesh) o.castShadow = !o.userData.noShadow;
  });
  const keep = [];
  for (const l of [...scene.children]) if (l.isLight) keep.push(l);
  for (const l of keep) scene.remove(l);
  scene.add(sun, sun.target, sky, sky.target, plane);
  plane.material.opacity = 1;
  // the two shadows at their own strengths: render each, then mix (a pixel in both is as dark as the darker)
  const pass = (light, alpha) => {
    sun.visible = light === sun;
    sky.visible = light === sky;
    const sb = screenBox(reach, 8);
    const f = frame(sb, res, ss);
    plane.material.opacity = alpha;
    renderer.setSize(f.W * ss, f.H * ss, false);
    renderer.setClearColor(0x000000, 0);
    renderer.render(scene, camera);
    const c = canvas(f.W, f.H);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(renderer.domElement, 0, 0, f.W, f.H);
    return { c, ...f };
  };
  const a = pass(sun, look.shadowAlpha);
  const b = pass(sky, look.contactAlpha);
  scene.remove(sun, sun.target, sky, sky.target, plane);
  for (const l of keep) scene.add(l);
  restore();
  obj.traverse((o) => {
    if (o.isMesh) o.castShadow = false;
  });
  const out = canvas(a.W, a.H);
  const ctx = out.getContext('2d');
  ctx.filter = `blur(${(look.shadowBlur * res).toFixed(1)}px)`;
  ctx.drawImage(a.c, 0, 0);
  ctx.globalCompositeOperation = 'lighten';
  ctx.drawImage(b.c, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  return { c: out, ax: a.ax, ay: a.ay };
}

// ---- items -------------------------------------------------------------------------------------------------------

/**
 * Render items. job = { res, ss, shadowRes, look, items: [{ key, recipe, args, layers?: ['body','lit','shadow'] }] }.
 * Returns [{ key, layer, w, h, ax, ay, res, info }] (anchor = the item's ground origin in the trimmed picture;
 * `info` = what the recipe reports, e.g. where string lights are tied, in world px from the origin).
 */
async function renderItems(job) {
  const { res, ss, look, items } = job;
  setRecipeLook(look);
  const out = [];
  for (const it of items) {
    setLights(look);
    const built = await buildRecipe(it.recipe, it.args ?? {});
    const obj = built.object;
    scene.add(obj);
    obj.updateMatrixWorld(true);
    const box = built.frameBox
      ? new THREE.Box3(new THREE.Vector3(-built.frameBox.r, 0, -built.frameBox.r), new THREE.Vector3(built.frameBox.r, built.frameBox.h, built.frameBox.r))
      : new THREE.Box3().setFromObject(obj);
    const layers = it.layers ?? ['body', 'lit', 'shadow'];
    const info = built.info ? Object.fromEntries(Object.entries(built.info).map(([k, v]) => [k, v.isVector3 ? { ...screenOf(v), p: v.toArray() } : v])) : undefined;
    for (const pose of built.poses ?? [null]) {
      if (pose) pose.apply();
      const suffix = pose ? `/${pose.key}` : '';
      if (layers.includes('body')) {
        const f = frame(screenBox(box, 6), res, ss);
        let c = snap(f.W, f.H, ss);
        if (!it.noOutline) c = outlined(c, look.outline * res, look.outlineColor, look.outlineAlpha);
        const t = trim(c);
        state.frames.set(`${it.key}${suffix}`, t.c);
        out.push({ key: `${it.key}${suffix}`, layer: 'body', w: t.c.width, h: t.c.height, ax: f.ax - t.x, ay: f.ay - t.y, res, info });
      }
      if (layers.includes('lit')) {
        const f = frame(screenBox(box, 12), res, ss);
        const c = renderLit(obj, f.W, f.H, ss, res, look);
        if (c) {
          const t = trim(c);
          state.frames.set(`${it.key}${suffix}:lit`, t.c);
          out.push({ key: `${it.key}${suffix}`, layer: 'lit', w: t.c.width, h: t.c.height, ax: f.ax - t.x, ay: f.ay - t.y, res });
        }
      }
      if (layers.includes('shadow') && !pose) {
        const sres = job.shadowRes ?? res;
        const s = renderShadowLayer(obj, box, sres, ss, look);
        const t = trim(s.c);
        state.frames.set(`${it.key}:shadow`, t.c);
        out.push({ key: it.key, layer: 'shadow', w: t.c.width, h: t.c.height, ax: s.ax - t.x, ay: s.ay - t.y, res: sres });
      }
    }
    scene.remove(obj);
    built.dispose?.();
  }
  return out;
}

/**
 * Rotate a built item to face a screen direction (the cat): DIR_YAW of render.js, the same as the people.
 * Exposed for recipes that render directions as poses.
 */
export function yawFor(dir) {
  return THREE.MathUtils.degToRad(DIR_YAW[dir]);
}

// ---- the ground --------------------------------------------------------------------------------------------------

/**
 * The whole ground as one picture. job = { res, ss, look, layout } (layout: rows, places, size, plaza, trees).
 * Rendered in strips when the picture is bigger than the GPU allows. The origin (tile (0,0), the far corner) is the
 * anchor.
 */
async function renderGround(job) {
  const { res, ss, look, layout } = job;
  setRecipeLook(look);
  setLights(look);
  const g = await buildGround(layout);
  scene.add(g.object);
  g.object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g.object);
  const sb = screenBox(box, 4);
  const W = Math.ceil((sb.x1 - sb.x0) * res);
  const H = Math.ceil((sb.y1 - sb.y0) * res);
  const ax = -sb.x0 * res;
  const ay = -sb.y0 * res;
  // the key light casts the shadows of the fixed trees (the trees themselves are sprites: cast, never drawn)
  const key = lights[1];
  key.userData.dir = key.position.clone().normalize();
  key.castShadow = true;
  key.shadow.mapSize.setScalar(Math.min(8192, renderer.capabilities.maxTextureSize));
  key.shadow.radius = 4;
  key.shadow.bias = -0.0005;
  key.shadow.normalBias = 0.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  aimShadow(key, box);
  const max = Math.min(renderer.capabilities.maxTextureSize, 8192);
  const out = canvas(W, H);
  const octx = out.getContext('2d');
  octx.imageSmoothingQuality = 'high';
  const stripH = Math.max(64, Math.floor(max / ss / 2));
  const stripW = Math.max(64, Math.floor(max / ss / 2));
  for (let y = 0; y < H; y += stripH) {
    for (let x = 0; x < W; x += stripW) {
      const w = Math.min(stripW, W - x);
      const h = Math.min(stripH, H - y);
      aimIso(w * ss, h * ss, (ax - x) * ss, (ay - y) * ss, PX_PER_UNIT * res * ss);
      const c = snap(w, h, ss);
      octx.drawImage(c, x, y);
    }
  }
  key.castShadow = false;
  scene.remove(g.object);
  g.dispose?.();
  state.frames.set('ground', out);
  return { key: 'ground', w: W, h: H, ax, ay, res, info: g.info };
}

/** For checking: put a frame (already rendered) into the frame store under another key. */
function alias(from, to) {
  state.frames.set(to, state.frames.get(from));
}

window.TA.world = { renderItems, renderGround, alias };
window.TA_WORLD_READY = true;
