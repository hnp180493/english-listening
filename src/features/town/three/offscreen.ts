// The 3D pictures the page shows OUTSIDE the stage (a resident's portrait, a building's thumbnail in the build panel,
// what an egg hatched, the wardrobe's preview) are drawn with ONE shared offscreen WebGL renderer and copied onto 2D
// canvases: a browser keeps only a handful of WebGL contexts, so the page never makes one per picture. Two small
// studios light them: `charStudio` like a photo (soft key, fill and rim light on the toon-shaded people and pets),
// `townStudio` like the town at noon (the stage's daylight rig, the same tone mapping), so a thumbnail looks like the
// thing in town.

import {
  ACESFilmicToneMapping,
  AmbientLight,
  Box3,
  DirectionalLight,
  HemisphereLight,
  NoToneMapping,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from 'three';
import { nightTint, setNightTint } from './chars/materials';
import { DAY_RIG } from './scene/palette3d';

let renderer: WebGLRenderer | null = null;
/** The shared drawing buffer starts this big (px a side): every portrait and thumbnail fits without a resize. */
const MIN_SIDE = 320;
/** WebGL could not be made at all here: every picture falls back to its plain stand-in. */
let broken = false;

/** The shared renderer, made on first use; null when this browser has no WebGL. */
function offscreen(): WebGLRenderer | null {
  if (renderer) return renderer;
  if (broken || typeof document === 'undefined') return null;
  try {
    const cv = document.createElement('canvas');
    const r = new WebGLRenderer({ canvas: cv, alpha: true, antialias: true, preserveDrawingBuffer: true });
    r.outputColorSpace = SRGBColorSpace;
    r.setClearColor(0x000000, 0);
    r.setPixelRatio(1);
    // a lost context (the stage took the GPU's last one, a driver reset): the next picture makes a new renderer
    cv.addEventListener('webglcontextlost', () => {
      if (renderer === r) renderer = null;
    });
    renderer = r;
  } catch {
    broken = true;
    return null;
  }
  return renderer;
}

/** Can this browser draw the 3D pictures at all? (Tried once; false = show the plain stand-ins.) */
export function canDraw3d(): boolean {
  return offscreen() !== null;
}

export interface Studio {
  scene: Scene;
  camera: PerspectiveCamera;
  tone: 'aces' | 'none';
}

let chars: Studio | null = null;
let town: Studio | null = null;

/** People and pets, lit like a portrait photo. */
export function charStudio(): Studio {
  if (chars) return chars;
  const scene = new Scene();
  scene.add(new HemisphereLight(0xfff6ea, 0xc9b8d8, 1.15));
  scene.add(new AmbientLight(0xffffff, 0.2));
  const key = new DirectionalLight(0xfff1dc, 1.7);
  key.position.set(2, 3, 3);
  scene.add(key);
  const rim = new DirectionalLight(0xd7e6ff, 1.0);
  rim.position.set(-2.5, 1.5, -2);
  scene.add(rim);
  chars = { scene, camera: new PerspectiveCamera(24, 1, 0.05, 50), tone: 'none' };
  return chars;
}

/** Places and decorations, lit like the town at noon (scene/palette3d DAY_RIG; the sun from the viewer's left). */
export function townStudio(): Studio {
  if (town) return town;
  const scene = new Scene();
  scene.add(new HemisphereLight(DAY_RIG.hemiSky, DAY_RIG.hemiGround, DAY_RIG.hemi));
  const sun = new DirectionalLight(DAY_RIG.sunColor, DAY_RIG.sun);
  sun.position.set(-4.2, 7.8, 4.6);
  scene.add(sun);
  town = { scene, camera: new PerspectiveCamera(28, 1, 0.05, 200), tone: 'aces' };
  return town;
}

const _box = new Box3();
const _c = new Vector3();
const _s = new Vector3();

/**
 * Aim the studio's camera at `obj` (or several things together) from a yaw (radians, from +X towards +Z: π/2 looks from the front, +Z) and a pitch
 * (radians down), as close as fits its bounding box in `fill` of the view. The object is not moved.
 */
export function frame(st: Studio, obj: Object3D | readonly Object3D[], o: { yaw?: number; pitch?: number; fill?: number; aspect?: number; lift?: number } = {}): void {
  const yaw = o.yaw ?? Math.PI / 2 - 0.62;
  const pitch = o.pitch ?? 0.5;
  const aspect = o.aspect ?? 1;
  _box.makeEmpty();
  for (const one of Array.isArray(obj) ? obj : [obj]) {
    one.updateMatrixWorld(true);
    _box.expandByObject(one, true);
  }
  if (_box.isEmpty()) return;
  _box.getCenter(_c);
  _box.getSize(_s);
  _c.y += (o.lift ?? 0) * _s.y;
  const cam = st.camera;
  cam.aspect = aspect;
  const half = Math.tan((cam.fov * Math.PI) / 360) * (o.fill ?? 0.86);
  // every corner of the box must fit: exact enough for small things (the distance from the centre to a corner)
  const dir = new Vector3(Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch), Math.sin(yaw) * Math.cos(pitch));
  const right = new Vector3(-dir.z, 0, dir.x).normalize();
  const up = new Vector3().crossVectors(right, dir).negate().normalize();
  let need = 0;
  for (let i = 0; i < 8; i++) {
    const p = new Vector3(i & 1 ? _box.max.x : _box.min.x, i & 2 ? _box.max.y : _box.min.y, i & 4 ? _box.max.z : _box.min.z).sub(_c);
    const depth = p.dot(dir);
    need = Math.max(need, Math.abs(p.dot(up)) / half + depth, Math.abs(p.dot(right)) / (half * aspect) + depth);
  }
  cam.position.copy(_c).addScaledVector(dir, need);
  cam.near = Math.max(0.01, need * 0.05);
  cam.far = need * 4 + 10;
  cam.lookAt(_c);
  cam.updateProjectionMatrix();
}

/**
 * Draw the studio into `target` (its own pixel size; transparent around the subject). The shared toon materials of
 * people are shown without the town's night tint. False when there is no WebGL (the canvas is left clear).
 */
export function paint(st: Studio, target: HTMLCanvasElement): boolean {
  const ctx = target.getContext('2d');
  if (!ctx) return false;
  ctx.clearRect(0, 0, target.width, target.height);
  const r = offscreen();
  if (!r) return false;
  const w = Math.max(1, target.width);
  const h = Math.max(1, target.height);
  const cv = r.domElement;
  // the drawing buffer only ever grows (a new size reallocates it, a stall): a smaller picture is drawn in its
  // bottom-left corner (WebGL's origin) and copied from there
  if (cv.width < w || cv.height < h) r.setSize(Math.max(cv.width, w, MIN_SIDE), Math.max(cv.height, h, MIN_SIDE), false);
  r.setViewport(0, 0, w, h);
  r.toneMapping = st.tone === 'aces' ? ACESFilmicToneMapping : NoToneMapping;
  r.toneMappingExposure = 1;
  const tint = nightTint();
  if (tint) setNightTint(0);
  // a model put in the studio only to compile its shaders (portrait.ts warmPortraitShaders) is never in a picture
  const hidden = st.scene.children.filter((o) => o.userData.warmOnly && o.visible);
  for (const o of hidden) o.visible = false;
  try {
    r.render(st.scene, st.camera);
  } catch {
    return false;
  } finally {
    if (tint) setNightTint(tint);
    for (const o of hidden) o.visible = true;
  }
  ctx.drawImage(cv, 0, cv.height - h, w, h, 0, 0, w, h);
  return true;
}

/**
 * Compile a studio's shaders in the background (the driver's parallel compile) before its first picture: that first
 * draw then never waits on a program's link (it once took a quarter of a second in one go).
 */
export async function compileStudio(st: Studio): Promise<void> {
  const r = offscreen();
  if (!r) return;
  r.toneMapping = st.tone === 'aces' ? ACESFilmicToneMapping : NoToneMapping;
  try {
    await r.compileAsync(st.scene, st.camera);
  } catch {
    // compiled on the first picture then
  }
}

/** A canvas of `w` × `h` device pixels. */
export function canvasOf(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Free the shared renderer (the town page closed; the next picture makes it again). */
export function disposeOffscreen(): void {
  renderer?.dispose();
  if (renderer && !renderer.getContext().isContextLost()) renderer.forceContextLoss();
  renderer = null;
}
