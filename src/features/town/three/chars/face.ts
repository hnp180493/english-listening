// Faces: one shared canvas atlas, a row per face (FACE_PRESETS: its eyes, brows, nose and cheeks in every eye state,
// its mouth in every mouth state) and, per person, a small geometry of two patches that hug the front of the head
// (eyes + cheeks, mouth). Changing an expression rewrites a few UVs; all faces share one texture and one material (one
// draw call per face).
//
// Until 2026-11-26 every face was the same four (plain, lashes, freckles, both): owner, "thấy mặt nhân vật nào nhân vật
// nấy y chang nhau". The first four presets are those four, unchanged (a look without `face` keeps its old one); the
// rest give people eyes of their own shape and colour, brows, a nose, lines of age, a moustache, fuller lips.

import { BufferAttribute, BufferGeometry, CanvasTexture, DataTexture, LinearMipmapLinearFilter, RGBAFormat, SRGBColorSpace, type Texture } from 'three';
import type { EyeState, MouthState } from './anim';
import { shell } from './build';

export const EYE_STATES: readonly EyeState[] = ['open', 'half', 'closed', 'happy', 'wide'];
export const MOUTH_STATES: readonly MouthState[] = ['smile', 'neutral', 'talkA', 'talkO', 'grin', 'o'];
/** How one face is drawn. */
export interface FacePreset {
  eyes: 'round' | 'almond' | 'small' | 'sleepy' | 'sharp';
  /** The colour of the iris (the old faces: a dark plum). */
  iris: string;
  brows: 'none' | 'thin' | 'thick' | 'arched' | 'straight';
  browColor: string;
  nose: 'none' | 'dot' | 'button' | 'long';
  mouth: 'plain' | 'full' | 'wide' | 'small' | 'moustache';
  lashes: boolean;
  freckles: boolean;
  /** Lines of age at the eyes' corners and under them. */
  wrinkles: boolean;
  /** 0..1.2 */
  blush: number;
}

const OLD = '#2b1d2a';
const F = (eyes: FacePreset['eyes'], iris: string, brows: FacePreset['brows'], browColor: string, nose: FacePreset['nose'], mouth: FacePreset['mouth'], o: Partial<Pick<FacePreset, 'lashes' | 'freckles' | 'wrinkles' | 'blush'>> = {}): FacePreset => ({
  eyes,
  iris,
  brows,
  browColor,
  nose,
  mouth,
  lashes: !!o.lashes,
  freckles: !!o.freckles,
  wrinkles: !!o.wrinkles,
  blush: o.blush ?? 1,
});

/**
 * The faces (a look's `face`: an index). 0–3 are the old four (plain, lashes, freckles, lashes + freckles); a look
 * without `face` takes one of them from its lashes / freckles as before.
 */
export const FACE_PRESETS: readonly FacePreset[] = [
  F('round', OLD, 'none', '#4a3428', 'none', 'plain'),
  F('round', OLD, 'none', '#4a3428', 'none', 'plain', { lashes: true }),
  F('round', OLD, 'none', '#4a3428', 'none', 'plain', { freckles: true }),
  F('round', OLD, 'none', '#4a3428', 'none', 'plain', { lashes: true, freckles: true }),
  // 4: almond brown eyes, thin arched brows, a dot nose, full lips (a young woman)
  F('almond', '#5a3a26', 'arched', '#3a2820', 'dot', 'full', { lashes: true, blush: 0.8 }),
  // 5: sharp grey-blue eyes, straight brows, a long nose (a sharp woman of fifty)
  F('sharp', '#5d7590', 'straight', '#6f6a68', 'long', 'small', { lashes: true, wrinkles: true, blush: 0.4 }),
  // 6: small kind eyes, thick brows, a button nose, a moustache (a big friendly man)
  F('small', '#4a3020', 'thick', '#3a2a22', 'button', 'moustache', { blush: 0.6 }),
  // 7: sleepy green eyes, thin brows, freckles (a quiet young man)
  F('sleepy', '#4f7a52', 'thin', '#7a4a2a', 'dot', 'plain', { freckles: true, blush: 0.5 }),
  // 8: round blue eyes, arched light brows, a button nose (a bright girl)
  F('round', '#3f6fae', 'arched', '#b8904a', 'button', 'small', { lashes: true, freckles: true, blush: 1.1 }),
  // 9: almond dark eyes, thick straight brows, a long nose, a wide mouth (a lean man)
  F('almond', '#2e2020', 'straight', '#1f1818', 'long', 'wide', { blush: 0.3 }),
  // 10: small eyes with lines, thin grey brows, a dot nose (an old man)
  F('small', '#5a4636', 'thin', '#c9c2ba', 'dot', 'plain', { wrinkles: true, blush: 0.5 }),
  // 11: round hazel eyes with lines, arched grey brows, full lips (an old woman)
  F('round', '#7a5a2e', 'arched', '#cfc9c2', 'button', 'full', { lashes: true, wrinkles: true, blush: 0.7 }),
  // 12: sharp brown eyes, thick brows, a moustache, lines (a tough older man)
  F('sharp', '#4a3020', 'thick', '#5a4636', 'long', 'moustache', { wrinkles: true, blush: 0.3 }),
  // 13: sleepy brown eyes, arched brows, full lips (a calm woman)
  F('sleepy', '#5a3a26', 'arched', '#2e2220', 'dot', 'full', { lashes: true, blush: 0.7 }),
  // 14: round green eyes, thin red brows, freckles, a wide grin (a cheerful redhead)
  F('round', '#4f8a5b', 'thin', '#b8492e', 'button', 'wide', { freckles: true, lashes: true, blush: 1 }),
  // 15: almond blue eyes, straight brows, a small mouth (a reserved man)
  F('almond', '#456d9a', 'straight', '#4a3428', 'dot', 'small', { blush: 0.4 }),
];

/** Rows of the atlas: one a face. */
export const EYE_STYLES = FACE_PRESETS.length;

/** Where the patches sit on the head (polar angle from the crown, azimuth from the front), radians. */
export const EYE_PATCH = { thetaMin: 1.25, thetaMax: 2.0, phiMin: -0.75, phiMax: 0.75 } as const;
export const MOUTH_PATCH = { thetaMin: 1.93, thetaMax: 2.28, phiMin: -0.35, phiMax: 0.35 } as const;
/** Eye centres (for glasses): azimuth ±EYE_PHI, polar angle EYE_THETA. */
export const EYE_PHI = 0.4;
export const EYE_THETA = 1.64;

const W = 2048;
const H = 2048;
/** A row a face: its eyes in every eye state, then its mouths in every mouth state (top half of the row). */
const EYE_W = 256;
const EYE_H = 128;
const MOUTH_W = 96;
const MOUTH_H = 64;
const MOUTH_X = EYE_W * 5;

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
export function mouthRect(state: MouthState, style = 0): UvRect {
  return rect(MOUTH_X + MOUTH_STATES.indexOf(state) * MOUTH_W, (style % EYE_STYLES) * EYE_H, MOUTH_W, MOUTH_H);
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
    const f = FACE_PRESETS[style];
    for (const st of EYE_STATES) drawEyeCell(g, EYE_STATES.indexOf(st) * EYE_W, style * EYE_H, f, st);
    for (const m of MOUTH_STATES) drawMouthCell(g, MOUTH_X + MOUTH_STATES.indexOf(m) * MOUTH_W, style * EYE_H, m, f);
  }
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

function drawEyeCell(g: CanvasRenderingContext2D, x0: number, y0: number, f: FacePreset, state: EyeState): void {
  const pen = cellPen(g, x0, y0, EYE_W, EYE_H, EYE_PATCH);
  const lashes = f.lashes;
  const freckles = f.freckles;
  pen.clip();
  // blush
  for (const side of [-1, 1]) {
    const cx = pen.x(side * 0.56);
    const cy = pen.y(1.86);
    const rx = 0.15 * pen.sx;
    const ry = 0.075 * pen.sy;
    const grd = g.createRadialGradient(cx, cy, 0, cx, cy, rx);
    grd.addColorStop(0, `rgba(255,128,150,${0.55 * f.blush})`);
    grd.addColorStop(0.55, `rgba(255,140,160,${0.3 * f.blush})`);
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
    drawEye(g, cx, cy, pen.sx, pen.sy, state, lashes, side, f);
    drawBrow(g, cx, cy, pen.sx, pen.sy, side, f, state);
    if (f.wrinkles) drawLines(g, cx, cy, pen.sx, pen.sy, side);
  }
  drawNose(g, pen.x(0), pen.y(1.9), pen.sx, pen.sy, f);
  g.restore();
}

/** The eye's size by its shape (radians on the head, × the cell's scale). */
function eyeSize(f: FacePreset): { rx: number; ry: number } {
  switch (f.eyes) {
    case 'almond':
      return { rx: 0.1, ry: 0.105 };
    case 'small':
      return { rx: 0.062, ry: 0.085 };
    case 'sleepy':
      return { rx: 0.09, ry: 0.12 };
    case 'sharp':
      return { rx: 0.1, ry: 0.095 };
    default:
      return { rx: 0.088, ry: 0.135 };
  }
}

function drawBrow(g: CanvasRenderingContext2D, cx: number, cy: number, sx: number, sy: number, side: number, f: FacePreset, state: EyeState): void {
  if (f.brows === 'none') return;
  const lift = state === 'wide' ? -0.03 : state === 'happy' ? -0.015 : 0;
  const by = cy - (0.2 + lift) * sy;
  const w = f.brows === 'thin' ? 0.075 : 0.095;
  const thick = f.brows === 'thick' ? 0.05 : f.brows === 'thin' ? 0.022 : 0.032;
  g.strokeStyle = f.browColor;
  g.lineCap = 'round';
  g.lineWidth = thick * sy;
  g.beginPath();
  const inner = cx - side * w * sx;
  const outer = cx + side * w * sx;
  if (f.brows === 'straight') {
    g.moveTo(inner, by + 0.005 * sy);
    g.lineTo(outer, by - 0.008 * sy);
  } else {
    // a soft arch, higher for 'arched'
    const arch = f.brows === 'arched' ? 0.06 : 0.035;
    g.moveTo(inner, by + 0.012 * sy);
    g.quadraticCurveTo(cx + side * 0.01 * sx, by - arch * sy, outer, by + 0.01 * sy);
  }
  g.stroke();
}

/** Lines of age: a little fan at the outer corner, a soft line under the eye. */
function drawLines(g: CanvasRenderingContext2D, cx: number, cy: number, sx: number, sy: number, side: number): void {
  g.strokeStyle = 'rgba(120,70,60,0.45)';
  g.lineWidth = 0.012 * sy;
  g.lineCap = 'round';
  const ox = cx + side * 0.13 * sx;
  for (const a of [-0.35, 0, 0.35]) {
    g.beginPath();
    g.moveTo(ox, cy + a * 0.06 * sy);
    g.lineTo(ox + side * 0.035 * sx, cy + a * 0.11 * sy);
    g.stroke();
  }
  g.beginPath();
  g.moveTo(cx - 0.06 * sx, cy + 0.17 * sy);
  g.quadraticCurveTo(cx, cy + 0.2 * sy, cx + 0.06 * sx, cy + 0.17 * sy);
  g.stroke();
}

function drawNose(g: CanvasRenderingContext2D, cx: number, cy: number, sx: number, sy: number, f: FacePreset): void {
  if (f.nose === 'none') return;
  g.lineCap = 'round';
  if (f.nose === 'dot') {
    g.fillStyle = 'rgba(160,85,75,0.4)';
    g.beginPath();
    g.ellipse(cx, cy, 0.022 * sx, 0.016 * sy, 0, 0, Math.PI * 2);
    g.fill();
    return;
  }
  g.strokeStyle = 'rgba(140,72,62,0.55)';
  g.lineWidth = 0.016 * sy;
  g.beginPath();
  if (f.nose === 'button') {
    g.moveTo(cx - 0.03 * sx, cy - 0.005 * sy);
    g.quadraticCurveTo(cx, cy + 0.03 * sy, cx + 0.03 * sx, cy - 0.005 * sy);
  } else {
    // long: down the middle, then a small turn
    g.moveTo(cx + 0.005 * sx, cy - 0.1 * sy);
    g.quadraticCurveTo(cx + 0.02 * sx, cy - 0.02 * sy, cx + 0.03 * sx, cy + 0.01 * sy);
    g.quadraticCurveTo(cx + 0.005 * sx, cy + 0.03 * sy, cx - 0.025 * sx, cy + 0.01 * sy);
  }
  g.stroke();
}

function drawEye(g: CanvasRenderingContext2D, cx: number, cy: number, sx: number, sy: number, state: EyeState, lashes: boolean, side: number, f: FacePreset): void {
  const big = state === 'wide' ? 1.12 : 1;
  const size = eyeSize(f);
  const rx = size.rx * sx * big;
  const ry = size.ry * sy * big;
  // a sleepy face's open eyes are half under the lid
  if (f.eyes === 'sleepy' && state === 'open') state = 'half';
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
  // the eye: dark, a warm glow at the bottom (the old faces); a face of its own has its iris colour in the middle.
  // An almond or sharp eye is cut by two arcs into a pointed shape, the sharp one tilted up at its outer corner.
  if (f.eyes === 'almond' || f.eyes === 'sharp') {
    const tilt = f.eyes === 'sharp' ? 0.12 * ry : 0;
    g.beginPath();
    g.moveTo(cx - side * rx * 1.05, cy + tilt * 0.4);
    g.quadraticCurveTo(cx, cy - ry * 1.55, cx + side * rx * 1.05, cy - tilt);
    g.quadraticCurveTo(cx, cy + ry * 1.45, cx - side * rx * 1.05, cy + tilt * 0.4);
    g.closePath();
    g.clip();
  }
  const own = f.iris !== OLD;
  const grd = g.createLinearGradient(cx, cy - ry, cx, cy + ry);
  grd.addColorStop(0, EYE_DARK);
  grd.addColorStop(0.55, own ? f.iris : EYE_MID);
  grd.addColorStop(1, own ? f.iris : EYE_GLOW);
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

function drawMouthCell(g: CanvasRenderingContext2D, x0: number, y0: number, m: MouthState, f: FacePreset): void {
  const pen = cellPen(g, x0, y0, MOUTH_W, MOUTH_H, MOUTH_PATCH);
  pen.clip();
  const cx = pen.x(0);
  const cy = pen.y(2.08);
  // a wide or small mouth: the same strokes, wider or narrower
  const k = f.mouth === 'wide' ? 1.3 : f.mouth === 'small' ? 0.72 : 1;
  const sx = pen.sx * k;
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
  if (f.mouth === 'full' && (m === 'smile' || m === 'neutral')) {
    // a soft lower lip
    g.fillStyle = 'rgba(225,110,125,0.55)';
    g.beginPath();
    g.ellipse(cx, cy + 0.035 * sy, 0.045 * sx, 0.018 * sy, 0, 0, Math.PI * 2);
    g.fill();
  }
  if (f.mouth === 'moustache') {
    // over the mouth, in two curls
    g.fillStyle = f.browColor;
    for (const side of [-1, 1]) {
      g.beginPath();
      g.moveTo(cx, cy - 0.035 * sy);
      g.quadraticCurveTo(cx + side * 0.06 * pen.sx, cy - 0.065 * sy, cx + side * 0.11 * pen.sx, cy - 0.01 * sy);
      g.quadraticCurveTo(cx + side * 0.06 * pen.sx, cy - 0.025 * sy, cx, cy - 0.012 * sy);
      g.closePath();
      g.fill();
    }
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
 * (`scale`). `style` = the face (FACE_PRESETS index; 0 plain, 1 lashes, 2 freckles, 3 both: the old four).
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
        apply(nE, nM, mouthRect(m, style));
        curM = m;
      }
    },
  };
  face.set('open', 'smile');
  return face;
}
