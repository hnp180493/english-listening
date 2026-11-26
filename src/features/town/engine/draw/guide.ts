// The quest being followed, drawn over the stage (owner, 2026-11-26: "hướng dẫn làm nhiệm vụ như GTA"): a dotted way
// on the ground from the player to it, a bouncing arrow over it while it is on the screen, an arrow at the stage's
// edge with how far it is while it is not. GAME ART: its own colour (a warm gold that reads on grass, stone and
// water, day and night), drawn on the overlay canvas in CSS pixels.

export interface ScreenPt {
  x: number;
  y: number;
}

export interface Area {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const GOLD = '#ffc83d';
const INK = '#3d2a00';

/** "35 m" for a distance in tiles (a tile is about two metres: a grown-up is a little under one tile high). */
export function metres(tiles: number): string {
  const m = tiles * 2;
  return m < 10 ? `${Math.max(1, Math.round(m))} m` : `${Math.round(m / 5) * 5} m`;
}

/**
 * Where the edge arrow goes: on the line from `from` (the player on the screen) towards `to` (the target, off the
 * screen), where it leaves `area` shrunk by `margin`; and which way it points (radians, screen). Null when `to` is in
 * the area (the target itself is seen).
 */
export function edgeArrow(from: ScreenPt, to: ScreenPt, area: Area, margin = 30): (ScreenPt & { angle: number }) | null {
  const a = { x0: area.x0 + margin, y0: area.y0 + margin, x1: area.x1 - margin, y1: area.y1 - margin };
  if (a.x1 <= a.x0 || a.y1 <= a.y0) return null;
  if (to.x >= area.x0 && to.x <= area.x1 && to.y >= area.y0 && to.y <= area.y1) return null;
  // (the player kept inside the shrunk area, so the ray starts inside it)
  const fx = Math.min(a.x1, Math.max(a.x0, from.x));
  const fy = Math.min(a.y1, Math.max(a.y0, from.y));
  const dx = to.x - fx;
  const dy = to.y - fy;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return null;
  let k = Infinity;
  if (dx > 0) k = Math.min(k, (a.x1 - fx) / dx);
  if (dx < 0) k = Math.min(k, (a.x0 - fx) / dx);
  if (dy > 0) k = Math.min(k, (a.y1 - fy) / dy);
  if (dy < 0) k = Math.min(k, (a.y0 - fy) / dy);
  if (!Number.isFinite(k)) return null;
  k = Math.max(0, Math.min(1, k));
  return { x: fx + dx * k, y: fy + dy * k, angle: Math.atan2(dy, dx) };
}

/**
 * Points every `step` tiles along a way (tile-grid points), starting `phase` in (0 ≤ phase < step): the dots of the
 * way on the ground. At most `max` of them (the near part of a long way is what helps).
 */
export function wayDots(way: readonly ScreenPt[], step: number, phase: number, max: number): ScreenPt[] {
  const out: ScreenPt[] = [];
  let carry = phase;
  for (let i = 1; i < way.length && out.length < max; i++) {
    const a = way[i - 1];
    const b = way[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    let s = carry;
    while (s < len && out.length < max) {
      out.push({ x: a.x + ((b.x - a.x) * s) / len, y: a.y + ((b.y - a.y) * s) / len });
      s += step;
    }
    carry = s - len;
  }
  return out;
}

/** The way's dots, already on the screen; `fade` 0..1 each (the first and last ones fade in and out). */
export function drawWay(ctx: CanvasRenderingContext2D, dots: readonly (ScreenPt & { fade: number })[]): void {
  ctx.save();
  for (const d of dots) {
    if (d.fade <= 0.02) continue;
    ctx.globalAlpha = 0.9 * d.fade;
    ctx.beginPath();
    ctx.ellipse(d.x, d.y, 5.2, 3.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = GOLD;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = INK;
    ctx.globalAlpha = 0.35 * d.fade;
    ctx.stroke();
  }
  ctx.restore();
}

/** A gold arrow pointing down at the target (over its head), bobbing unless `still`. */
export function drawTargetArrow(ctx: CanvasRenderingContext2D, at: ScreenPt, t: number, still: boolean): void {
  const y = at.y - 16 - (still ? 0 : Math.abs(Math.sin(t * 3.2)) * 6);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(at.x, y + 10);
  ctx.lineTo(at.x - 10, y - 4);
  ctx.lineTo(at.x - 4, y - 4);
  ctx.lineTo(at.x - 4, y - 13);
  ctx.lineTo(at.x + 4, y - 13);
  ctx.lineTo(at.x + 4, y - 4);
  ctx.lineTo(at.x + 10, y - 4);
  ctx.closePath();
  ctx.fillStyle = GOLD;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.restore();
}

/** The edge arrow: a gold disc with an arrow turned towards the target and the distance under it. */
export function drawEdgeArrow(ctx: CanvasRenderingContext2D, at: ScreenPt & { angle: number }, label: string, font: string, tagBg: string, tagText: string): void {
  ctx.save();
  ctx.translate(at.x, at.y);
  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, Math.PI * 2);
  ctx.fillStyle = GOLD;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.rotate(at.angle);
  ctx.beginPath();
  ctx.moveTo(9, 0);
  ctx.lineTo(-4, -7);
  ctx.lineTo(-1, 0);
  ctx.lineTo(-4, 7);
  ctx.closePath();
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.font = `600 13px ${font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = Math.ceil(ctx.measureText(label).width) + 12;
  // the label on the inner side of the disc (towards the middle of the stage)
  const ly = at.y + (Math.sin(at.angle) > 0.5 ? -28 : 28);
  ctx.fillStyle = tagBg;
  ctx.beginPath();
  ctx.roundRect(at.x - w / 2, ly - 10, w, 20, 10);
  ctx.fill();
  ctx.fillStyle = tagText;
  ctx.fillText(label, at.x, ly + 0.5);
  ctx.restore();
}
