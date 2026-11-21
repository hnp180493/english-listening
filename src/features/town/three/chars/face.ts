// Faces: one shared canvas atlas (every eye state × 4 eye styles, every mouth) and, per person, a small geometry of
// two patches that hug the front of the head (eyes + cheeks, mouth). Changing an expression rewrites a few UVs; all
// faces share one texture and one material (one draw call per face).

import { BufferAttribute, BufferGeometry, CanvasTexture, DataTexture, LinearMipmapLinearFilter, RGBAFormat, SRGBColorSpace, type Texture } from 'three';
import type { EyeState, MouthState } from './anim';
import { shell } from './build';

export const EYE_STATES: readonly EyeState[] = ['open', 'half', 'closed', 'happy', 'wide'];
export const MOUTH_STATES: readonly MouthState[] = ['smile', 'neutral', 'talkA', 'talkO', 'grin', 'o'];
/** Eye styles: plain, lashes, plain + freckles, lashes + freckles. */
export const EYE_STYLES = 4;

/** Where the patches sit on the head (polar angle from the crown, azimuth from the front), radians. */
export const EYE_PATCH = { thetaMin: 1.25, thetaMax: 2.0, phiMin: -0.75, phiMax: 0.75 } as const;
export const MOUTH_PATCH = { thetaMin: 1.93, thetaMax: 2.28, phiMin: -0.35, phiMax: 0.35 } as const;
/** Eye centres (for glasses): azimuth ±EYE_PHI, polar angle EYE_THETA. */
export const EYE_PHI = 0.4;
export const EYE_THETA = 1.64;

const W = 2048;
const H = 1024;
const EYE_W = 384;
const EYE_H = 192;
const MOUTH_W = 192;
const MOUTH_H = 96;
const MOUTH_Y = 4 * EYE_H;

export interface UvRect {
  u0: number;
  u1: number;
  v0: number;
  v1: number;
}

const rect = (x: number, y: number, w: number, h: number): UvRect => ({ u0: x / W, u1: (x + w) / W, v0: 1 - (y + h) / H, v1: 1 - y / H });

export function eyeRect(style: number, state: EyeState): UvRect {
  return rect(EYE_STATES.indexOf(state) * EYE_W, (style % EYE_STYLES) * EYE_H, EYE_W, EYE_H);
}
export function mouthRect(state: MouthState): UvRect {
  return rect(MOUTH_STATES.indexOf(state) * MOUTH_W, MOUTH_Y, MOUTH_W, MOUTH_H);
}

// ───────────────────────── the atlas ─────────────────────────

let atlas: Texture | null = null;

/** The shared face atlas (drawn once on first use). In node (tests) a 1×1 placeholder. */
export function faceAtlas(): Texture {
  if (atlas) return atlas;
  if (typeof document === 'undefined') {
    atlas = new DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1, RGBAFormat);
    atlas.needsUpdate = true;
    return atlas;
  }
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  if (!g) throw new Error('2d canvas');
  for (let style = 0; style < EYE_STYLES; style++) {
    for (const st of EYE_STATES) drawEyeCell(g, EYE_STATES.indexOf(st) * EYE_W, style * EYE_H, style, st);
  }
  for (const m of MOUTH_STATES) drawMouthCell(g, MOUTH_STATES.indexOf(m) * MOUTH_W, MOUTH_Y, m);
  const tex = new CanvasTexture(cv);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  atlas = tex;
  return tex;
}

/** Drawing in angle units (radians on the head) inside a cell. */
function cellPen(g: CanvasRenderingContext2D, x0: number, y0: number, w: number, h: number, patch: { thetaMin: number; thetaMax: number; phiMin: number; phiMax: number }) {
  const sx = w / (patch.phiMax - patch.phiMin);
  const sy = h / (patch.thetaMax - patch.thetaMin);
  return {
    x: (phi: number) => x0 + (phi - patch.phiMin) * sx,
    y: (theta: number) => y0 + (theta - patch.thetaMin) * sy,
    sx,
    sy,
    clip() {
      g.save();
      g.beginPath();
      g.rect(x0 + 1, y0 + 1, w - 2, h - 2);
      g.clip();
    },
  };
}

const EYE_DARK = '#2b1d2a';
const EYE_MID = '#5b3a4c';
const EYE_GLOW = '#9a6a7c';
const LINE = '#3a2630';

function drawEyeCell(g: CanvasRenderingContext2D, x0: number, y0: number, style: number, state: EyeState): void {
  const pen = cellPen(g, x0, y0, EYE_W, EYE_H, EYE_PATCH);
  const lashes = style === 1 || style === 3;
  const freckles = style >= 2;
  pen.clip();
  // blush
  for (const side of [-1, 1]) {
    const cx = pen.x(side * 0.56);
    const cy = pen.y(1.86);
    const rx = 0.15 * pen.sx;
    const ry = 0.075 * pen.sy;
    const grd = g.createRadialGradient(cx, cy, 0, cx, cy, rx);
    grd.addColorStop(0, 'rgba(255,128,150,0.55)');
    grd.addColorStop(0.55, 'rgba(255,140,160,0.3)');
    grd.addColorStop(1, 'rgba(255,150,170,0)');
    g.save();
    g.translate(cx, cy);
    g.scale(1, ry / rx);
    g.translate(-cx, -cy);
    g.fillStyle = grd;
    g.beginPath();
    g.arc(cx, cy, rx, 0, Math.PI * 2);
    g.fill();
    g.restore();
    if (freckles) {
      g.fillStyle = 'rgba(150,85,60,0.55)';
      for (const [dx, dy] of [
        [-0.06, -0.02],
        [0.0, 0.015],
        [0.06, -0.015],
      ]) {
        g.beginPath();
        g.ellipse(cx + dx * pen.sx * side, cy + dy * pen.sy - 0.02 * pen.sy, 0.012 * pen.sx, 0.012 * pen.sy, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  for (const side of [-1, 1]) {
    const cx = pen.x(side * EYE_PHI);
    const cy = pen.y(EYE_THETA);
    drawEye(g, cx, cy, pen.sx, pen.sy, state, lashes, side);
  }
  g.restore();
}

function drawEye(g: CanvasRenderingContext2D, cx: number, cy: number, sx: number, sy: number, state: EyeState, lashes: boolean, side: number): void {
  const big = state === 'wide' ? 1.12 : 1;
  const rx = 0.088 * sx * big;
  const ry = 0.135 * sy * big;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  if (state === 'closed') {
    // a soft lid line, bowing down
    g.strokeStyle = LINE;
    g.lineWidth = 0.032 * sy;
    g.beginPath();
    g.moveTo(cx - rx * 1.05, cy + ry * 0.05);
    g.quadraticCurveTo(cx, cy + ry * 0.55, cx + rx * 1.05, cy + ry * 0.05);
    g.stroke();
    if (lashes) lash(g, cx + side * rx * 1.0, cy + ry * 0.05, side, sx, sy, 0.6);
    return;
  }
  if (state === 'happy') {
    // ^ ^
    g.strokeStyle = LINE;
    g.lineWidth = 0.038 * sy;
    g.beginPath();
    g.moveTo(cx - rx * 1.05, cy + ry * 0.3);
    g.quadraticCurveTo(cx, cy - ry * 0.65, cx + rx * 1.05, cy + ry * 0.3);
    g.stroke();
    if (lashes) lash(g, cx + side * rx * 1.0, cy + ry * 0.22, side, sx, sy, 0.7);
    return;
  }
  g.save();
  if (state === 'half') {
    // the upper lid comes down to the middle
    g.beginPath();
    g.rect(cx - rx * 2, cy - ry * 0.12, rx * 4, ry * 3);
    g.clip();
  }
  // the eye: dark, a warm glow at the bottom
  const grd = g.createLinearGradient(cx, cy - ry, cx, cy + ry);
  grd.addColorStop(0, EYE_DARK);
  grd.addColorStop(0.55, EYE_MID);
  grd.addColorStop(1, EYE_GLOW);
  g.fillStyle = grd;
  g.beginPath();
  g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
  // a darker pupil and a lighter ring low in the iris
  g.fillStyle = 'rgba(25,14,24,0.75)';
  g.beginPath();
  g.ellipse(cx, cy - ry * 0.05, rx * 0.55, ry * 0.58, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(210,160,175,0.35)';
  g.beginPath();
  g.ellipse(cx, cy + ry * 0.55, rx * 0.6, ry * 0.25, 0, 0, Math.PI * 2);
  g.fill();
  // highlights (light from the upper left of the viewer)
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.ellipse(cx - rx * 0.32, cy - ry * 0.38, rx * 0.36, ry * 0.3, -0.3, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(cx + rx * 0.34, cy + ry * 0.36, rx * 0.16, ry * 0.13, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
  if (state === 'half') {
    g.strokeStyle = LINE;
    g.lineWidth = 0.03 * sy;
    g.beginPath();
    g.moveTo(cx - rx * 1.08, cy - ry * 0.08);
    g.quadraticCurveTo(cx, cy - ry * 0.28, cx + rx * 1.08, cy - ry * 0.08);
    g.stroke();
    if (lashes) lash(g, cx + side * rx * 1.0, cy - ry * 0.12, side, sx, sy, 0.7);
  } else if (lashes) {
    // a thicker upper lid and a little flick at the outer corner
    g.strokeStyle = LINE;
    g.lineWidth = 0.02 * sy;
    g.beginPath();
    g.ellipse(cx, cy - ry * 0.02, rx * 1.08, ry * 1.06, 0, Math.PI * 1.2, Math.PI * 1.8);
    g.stroke();
    lash(g, cx + side * rx * 0.92, cy - ry * 0.55, side, sx, sy, 1);
  }
}

function lash(g: CanvasRenderingContext2D, x: number, y: number, side: number, sx: number, sy: number, k: number): void {
  g.strokeStyle = LINE;
  g.lineWidth = 0.026 * sy;
  g.beginPath();
  g.moveTo(x, y);
  g.quadraticCurveTo(x + side * 0.04 * sx * k, y - 0.01 * sy, x + side * 0.06 * sx * k, y - 0.06 * sy * k);
  g.stroke();
}

function drawMouthCell(g: CanvasRenderingContext2D, x0: number, y0: number, m: MouthState): void {
  const pen = cellPen(g, x0, y0, MOUTH_W, MOUTH_H, MOUTH_PATCH);
  pen.clip();
  const cx = pen.x(0);
  const cy = pen.y(2.08);
  const sx = pen.sx;
  const sy = pen.sy;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const inside = '#7a2f3c';
  const tongue = '#e8828f';
  const stroke = (w: number) => {
    g.strokeStyle = '#5a2a30';
    g.lineWidth = w * sy;
  };
  const openShape = (w: number, top: number, bottom: number, flatTop: boolean) => {
    g.beginPath();
    g.moveTo(cx - w * sx, cy - top * sy);
    if (flatTop) g.quadraticCurveTo(cx, cy - top * sy * 1.25, cx + w * sx, cy - top * sy);
    else g.quadraticCurveTo(cx, cy - top * sy * 2.2, cx + w * sx, cy - top * sy);
    g.quadraticCurveTo(cx + w * sx * 0.9, cy + bottom * sy * 1.3, cx, cy + bottom * sy * 1.3);
    g.quadraticCurveTo(cx - w * sx * 0.9, cy + bottom * sy * 1.3, cx - w * sx, cy - top * sy);
    g.closePath();
    g.fillStyle = inside;
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = tongue;
    g.beginPath();
    g.ellipse(cx, cy + bottom * sy * 1.25, w * sx * 0.6, bottom * sy * 0.75, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };
  switch (m) {
    case 'smile':
      stroke(0.028);
      g.beginPath();
      g.moveTo(cx - 0.075 * sx, cy - 0.012 * sy);
      g.quadraticCurveTo(cx, cy + 0.06 * sy, cx + 0.075 * sx, cy - 0.012 * sy);
      g.stroke();
      break;
    case 'neutral':
      stroke(0.026);
      g.beginPath();
      g.moveTo(cx - 0.05 * sx, cy + 0.005 * sy);
      g.quadraticCurveTo(cx, cy + 0.02 * sy, cx + 0.05 * sx, cy + 0.005 * sy);
      g.stroke();
      break;
    case 'talkA':
      openShape(0.07, 0.015, 0.035, true);
      break;
    case 'talkO':
      g.fillStyle = inside;
      g.beginPath();
      g.ellipse(cx, cy + 0.01 * sy, 0.045 * sx, 0.048 * sy, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = tongue;
      g.beginPath();
      g.ellipse(cx, cy + 0.04 * sy, 0.03 * sx, 0.018 * sy, 0, 0, Math.PI * 2);
      g.fill();
      break;
    case 'grin':
      openShape(0.125, 0.022, 0.07, true);
      break;
    case 'o':
      g.fillStyle = inside;
      g.beginPath();
      g.ellipse(cx, cy + 0.005 * sy, 0.03 * sx, 0.034 * sy, 0, 0, Math.PI * 2);
      g.fill();
      break;
  }
  g.restore();
}

// ───────────────────────── per-person face geometry ─────────────────────────

export interface FaceGeometry {
  geometry: BufferGeometry;
  /** Show this expression (rewrites the UVs only when it changes). */
  set(eyes: EyeState, mouth: MouthState): void;
}

/**
 * The two patches of one face, in head space: centred on the head centre, radius `r`, stretched like the head
 * (`scale`). `style` = 0 plain, 1 lashes, 2 freckles, 3 both.
 */
export function faceGeometry(r: number, scale: readonly [number, number, number], style: number): FaceGeometry {
  const eyes = shell({ cols: 20, rows: 10, phiMin: EYE_PATCH.phiMin, phiMax: EYE_PATCH.phiMax, thetaMin: () => EYE_PATCH.thetaMin, thetaMax: () => EYE_PATCH.thetaMax, radius: () => r * 1.008 });
  const mouth = shell({ cols: 8, rows: 4, phiMin: MOUTH_PATCH.phiMin, phiMax: MOUTH_PATCH.phiMax, thetaMin: () => MOUTH_PATCH.thetaMin, thetaMax: () => MOUTH_PATCH.thetaMax, radius: () => r * 1.011 });
  const nE = eyes.getAttribute('position').count;
  const nM = mouth.getAttribute('position').count;
  const pos = new Float32Array((nE + nM) * 3);
  const nor = new Float32Array((nE + nM) * 3);
  const base = new Float32Array((nE + nM) * 2);
  const put = (g: BufferGeometry, off: number) => {
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    const uv = g.getAttribute('uv');
    for (let i = 0; i < p.count; i++) {
      pos[(off + i) * 3] = p.getX(i) * scale[0];
      pos[(off + i) * 3 + 1] = p.getY(i) * scale[1];
      pos[(off + i) * 3 + 2] = p.getZ(i) * scale[2];
      // normals of a stretched sphere: divide by the scale
      const nx = n.getX(i) / scale[0];
      const ny = n.getY(i) / scale[1];
      const nz = n.getZ(i) / scale[2];
      const l = Math.hypot(nx, ny, nz) || 1;
      nor[(off + i) * 3] = nx / l;
      nor[(off + i) * 3 + 1] = ny / l;
      nor[(off + i) * 3 + 2] = nz / l;
      base[(off + i) * 2] = uv.getX(i);
      base[(off + i) * 2 + 1] = uv.getY(i);
    }
  };
  put(eyes, 0);
  put(mouth, nE);
  const idx: number[] = [];
  const ie = eyes.index as BufferAttribute;
  const im = mouth.index as BufferAttribute;
  for (let i = 0; i < ie.count; i++) idx.push(ie.getX(i));
  for (let i = 0; i < im.count; i++) idx.push(im.getX(i) + nE);
  eyes.dispose();
  mouth.dispose();
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(pos, 3));
  geometry.setAttribute('normal', new BufferAttribute(nor, 3));
  const uvAttr = new BufferAttribute(new Float32Array(base.length), 2);
  geometry.setAttribute('uv', uvAttr);
  geometry.setIndex(idx);
  geometry.computeBoundingSphere();
  let curE = '';
  let curM = '';
  const apply = (from: number, count: number, rc: UvRect) => {
    const a = uvAttr.array as Float32Array;
    for (let i = from; i < from + count; i++) {
      a[i * 2] = rc.u0 + base[i * 2] * (rc.u1 - rc.u0);
      a[i * 2 + 1] = rc.v0 + base[i * 2 + 1] * (rc.v1 - rc.v0);
    }
    uvAttr.needsUpdate = true;
  };
  const face: FaceGeometry = {
    geometry,
    set(e, m) {
      if (e !== curE) {
        apply(0, nE, eyeRect(style, e));
        curE = e;
      }
      if (m !== curM) {
        apply(nE, nM, mouthRect(m));
        curM = m;
      }
    },
  };
  face.set('open', 'smile');
  return face;
}
