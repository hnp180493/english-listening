// Shared drawing helpers of the town (Canvas 2D). Everything here draws in WORLD pixels: the caller has already
// applied the camera.

import { toWorld, type Pt } from '../iso';
import type { TownPalette } from '../palette';

export interface G {
  ctx: CanvasRenderingContext2D;
  pal: TownPalette;
  /** Seconds since the stage started (animations are functions of it). */
  t: number;
  /** Reduced motion: no sway, no drifting, no particles. */
  still: boolean;
}

export const P = toWorld;

/** Stable 0..1 noise for a pair of numbers (tufts, pebbles, phases): the same town every time. */
export function hash(a: number, b: number, seed = 0): number {
  const s = Math.sin(a * 127.1 + b * 311.7 + seed * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

export function poly(ctx: CanvasRenderingContext2D, pts: readonly Pt[], fill?: string, stroke?: string, lineWidth = 1): void {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

export function line(ctx: CanvasRenderingContext2D, pts: readonly Pt[], stroke: string, lineWidth = 1): void {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

export function oval(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill?: string, stroke?: string, lineWidth = 1): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), 0, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** A circle lying on the ground at a tile-grid point, `r` in tiles: an isometric ellipse. */
export function groundDisc(ctx: CanvasRenderingContext2D, tx: number, ty: number, r: number, fill: string, z = 0): void {
  const c = P(tx, ty, z);
  oval(ctx, c.x, c.y, r * 45.25, r * 22.63, fill);
}

/**
 * A box standing on the tile grid from (x0,y0) to (x1,y1), from height z0 to z1. Light comes from the top-left:
 * the top is the lightest, the +y face (left on the screen) plain, the +x face (right) in shade.
 */
export function isoBox(g: G, x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, color: string, topColor?: string): void {
  const { ctx, pal } = g;
  poly(ctx, [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], pal.ink(color));
  poly(ctx, [P(x1, y1, z0), P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1)], pal.ink(color, -0.22));
  poly(ctx, [P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], pal.ink(topColor ?? color, topColor ? 0 : 0.28));
}

/** A point on a wall: face 'y' is the +y wall (left on the screen), 'x' the +x wall (right). u runs left → right. */
export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function onFace(b: Box, f: 'x' | 'y', u: number, z: number): Pt {
  return f === 'y' ? P(b.x0 + u * (b.x1 - b.x0), b.y1, z) : P(b.x1, b.y1 - u * (b.y1 - b.y0), z);
}

export function faceQuad(b: Box, f: 'x' | 'y', u0: number, u1: number, z0: number, z1: number): Pt[] {
  return [onFace(b, f, u0, z0), onFace(b, f, u1, z0), onFace(b, f, u1, z1), onFace(b, f, u0, z1)];
}

// ───────────────────────── light ─────────────────────────

const GLOWS = new Map<string, HTMLCanvasElement>();

function glowSprite(color: string): HTMLCanvasElement {
  let c = GLOWS.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 96;
  const x = c.getContext('2d')!;
  const grad = x.createRadialGradient(48, 48, 0, 48, 48, 48);
  grad.addColorStop(0, color);
  grad.addColorStop(0.25, color.replace(/[\d.]+\)$/, '0.55)'));
  grad.addColorStop(0.6, color.replace(/[\d.]+\)$/, '0.16)'));
  grad.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
  x.fillStyle = grad;
  x.fillRect(0, 0, 96, 96);
  GLOWS.set(color, c);
  return c;
}

/**
 * A soft light added onto what is already drawn (night only makes sense). `color` must be an `rgba(r,g,b,1)` string.
 * rx / ry in world pixels.
 */
export function glow(g: G, x: number, y: number, rx: number, ry: number, strength: number, color = g.pal.glow): void {
  if (strength <= 0.01) return;
  const { ctx } = g;
  const prevOp = ctx.globalCompositeOperation;
  const prevA = ctx.globalAlpha;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = Math.min(1, strength);
  ctx.drawImage(glowSprite(color), x - rx, y - ry, rx * 2, ry * 2);
  ctx.globalAlpha = prevA;
  ctx.globalCompositeOperation = prevOp;
}

/** Soft sway for leaves, flags, balloons: 0 under reduced motion. */
export function sway(g: G, speed: number, phase: number, amount: number): number {
  return g.still ? 0 : Math.sin(g.t * speed + phase) * amount;
}

/** A small heart, centred, `s` = half its width. */
export function heartPath(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.5, y - s * 0.1, x - s * 0.8, y - s * 1.2, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.8, y - s * 1.2, x + s * 1.5, y - s * 0.1, x, y + s * 0.9);
  ctx.closePath();
}

/** A four-point sparkle. */
export function sparkPath(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    const r = i % 2 === 0 ? s : s * 0.34;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** A five-point star. */
export function starPath(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? s : s * 0.45;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}
