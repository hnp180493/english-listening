// The camera of the town: follows a target with easing and zooms smoothly. Pure numbers (no canvas), in CSS pixels.

import type { Pt } from './iso';

export interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** The island's top as a diamond in world px: its centre and half-diagonals. */
export interface Island {
  cx: number;
  cy: number;
  hw: number;
  hh: number;
}

/**
 * How far the corners of the view may reach past the island's diamond, as a share of the view (0 = never any sky,
 * 1 = the island's edge may sit in the middle of the view).
 */
const ISLAND_SLACK = 0.45;
/** Whatever the island says, the target (or the `keep` point) stays this far inside the view (share of the half view). */
const TARGET_KEEP = 0.62;
/**
 * The `keep` point (the player) never comes nearer an edge of the view than this share of the half view, whatever
 * the island, the world's edges or a blended aim ask; the camera itself (while easing) keeps a thinner margin.
 */
const KEEP_MARGIN = 0.15;
const KEEP_MARGIN_NOW = 0.06;

/**
 * How the camera catches up: a critically damped spring (no overshoot) whose speed starts at zero, so a new thing to
 * look at (a conversation, its end, a build) eases in AND out; an exponential ease started at full speed in the very
 * first frame, and a slow first frame made that lurch show. About 0.6 s to settle (FOLLOW_W = 8: half the way after
 * 0.2 s, 97% after 0.6 s); the zoom a little softer. While it follows somebody walking (`carry`) it moves with them
 * as well, so a walker is not left behind at a start and the world does not keep sliding after a stop; only a change
 * of what it looks at is eased. The pan never runs faster than PAN_MAX screen px per second.
 */
const FOLLOW_W = 8;
const ZOOM_W = 7;
const PAN_MAX = 1200;

/**
 * One step of a critically damped spring towards `goal` (exact for any dt): the new value and speed.
 * x(t) = goal + (x0 − goal + (v0 + w(x0 − goal)) t) e^(−wt).
 */
export function springStep(x: number, v: number, goal: number, w: number, dt: number): [number, number] {
  const d = x - goal;
  const k = (v + w * d) * dt;
  const e = Math.exp(-w * dt);
  return [goal + (d + k) * e, (v - w * k) * e];
}

export class Camera {
  /** World point at the centre of the view. */
  x = 0;
  y = 0;
  zoom = 1;
  targetX = 0;
  targetY = 0;
  targetZoom = 1;
  viewW = 1;
  viewH = 1;
  bounds: Bounds | null = null;
  /** Set: the view keeps to the island (little sky round the corners), while the target stays in sight. */
  island: Island | null = null;
  /**
   * True: the target is put exactly where asked, island and world edges aside (a conversation frames its two people
   * precisely; a corner of sky behind them is the lesser evil).
   */
  loose = false;
  /**
   * Screen pixels the picture is moved by, so that what the camera looks at sits in the middle of the part of the
   * stage a panel leaves free (a sheet on the right: negative x; a panel at the bottom: negative y).
   */
  shiftX = 0;
  shiftY = 0;
  targetShiftX = 0;
  targetShiftY = 0;
  /**
   * True while the target is one thing moving on (the player walking): the camera takes over the target's own
   * movement every frame (no lag behind a walker), and eases only what is left over. Set it again every frame.
   */
  carry = false;
  /**
   * Somebody who must stay in the picture (the player, feet at (x, y) and `up` world px tall), whatever the camera
   * looks at: the aim may lie between them and somebody else, and the island and the world's edges pull the view
   * in, but never so far that they leave it. Null = nobody (an overview, a build). Set it again every frame.
   */
  keep: { x: number; y: number; up: number } | null = null;
  private last: { goal: Pt; carry: boolean } | null = null;
  /** The springs' speeds: world px per second (pan), zoom per second, screen px per second (shift). */
  private vx = 0;
  private vy = 0;
  private vz = 0;
  private vsx = 0;
  private vsy = 0;

  setView(w: number, h: number): void {
    this.viewW = Math.max(1, w);
    this.viewH = Math.max(1, h);
  }

  lookAt(p: Pt, zoom = this.targetZoom): void {
    this.targetX = p.x;
    this.targetY = p.y;
    this.targetZoom = zoom;
  }

  /** Move the picture on the screen (see shiftX): eased like everything else. */
  shiftTo(x: number, y: number): void {
    this.targetShiftX = x;
    this.targetShiftY = y;
  }

  /** Jump to the target (first frame, resize, reduced motion). */
  snap(): void {
    this.zoom = this.targetZoom;
    this.shiftX = this.targetShiftX;
    this.shiftY = this.targetShiftY;
    const c = this.clamp(this.targetX, this.targetY, this.zoom);
    this.x = c.x;
    this.y = c.y;
    this.last = { goal: c, carry: this.carry };
    this.vx = this.vy = this.vz = this.vsx = this.vsy = 0;
  }

  /**
   * (x, y) moved just as far as needed for the `keep` point to be `margin` (share of the half view) inside the view
   * at `zoom`, with the picture moved by (sx, sy) (see shiftX).
   */
  private keepIn(x: number, y: number, zoom: number, margin: number, sx: number, sy: number): Pt {
    const k = this.keep;
    if (!k || this.loose) return { x, y };
    const halfW = this.viewW / 2;
    const halfH = this.viewH / 2;
    const mx = margin * halfW;
    const my = margin * halfH;
    const fit = (v: number, lo: number, hi: number) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
    // on the screen: k.x at (k.x − x)·zoom + halfW + sx, which must lie in [mx, viewW − mx]
    const nx = fit(x, k.x - (halfW - mx - sx) / zoom, k.x + (halfW - mx + sx) / zoom);
    // the feet above the bottom margin, the head below the top one
    const ny = fit(y, k.y - (halfH - my - sy) / zoom, k.y - k.up + (halfH - my + sy) / zoom);
    return { x: nx, y: ny };
  }

  update(dt: number, instant = false): void {
    if (instant) {
      this.snap();
      return;
    }
    [this.zoom, this.vz] = springStep(this.zoom, this.vz, this.targetZoom, ZOOM_W, dt);
    if (Math.abs(this.targetZoom - this.zoom) < 0.0005 && Math.abs(this.vz) < 0.01) {
      this.zoom = this.targetZoom;
      this.vz = 0;
    }
    const goal = this.clamp(this.targetX, this.targetY, this.zoom);
    if (this.carry && this.last?.carry) {
      // the walker's own step this frame (a jump of the target, e.g. a new thing to look at, is eased instead)
      const dx = goal.x - this.last.goal.x;
      const dy = goal.y - this.last.goal.y;
      if (Math.hypot(dx, dy) * this.zoom < 40) {
        this.x += dx;
        this.y += dy;
      }
    }
    this.last = { goal, carry: this.carry };
    const x0 = this.x;
    const y0 = this.y;
    let nx: number;
    let ny: number;
    [nx, this.vx] = springStep(this.x, this.vx, goal.x, FOLLOW_W, dt);
    [ny, this.vy] = springStep(this.y, this.vy, goal.y, FOLLOW_W, dt);
    // never faster than PAN_MAX on the screen
    const move = Math.hypot(nx - x0, ny - y0) * this.zoom;
    const most = PAN_MAX * dt;
    if (move > most && dt > 0) {
      const k = most / move;
      nx = x0 + (nx - x0) * k;
      ny = y0 + (ny - y0) * k;
      this.vx = (nx - x0) / dt;
      this.vy = (ny - y0) / dt;
    }
    this.x = nx;
    this.y = ny;
    if (Math.abs(goal.x - this.x) < 0.01 && Math.abs(this.vx) < 0.5) {
      this.x = goal.x;
      this.vx = 0;
    }
    if (Math.abs(goal.y - this.y) < 0.01 && Math.abs(this.vy) < 0.5) {
      this.y = goal.y;
      this.vy = 0;
    }
    [this.shiftX, this.vsx] = springStep(this.shiftX, this.vsx, this.targetShiftX, FOLLOW_W, dt);
    [this.shiftY, this.vsy] = springStep(this.shiftY, this.vsy, this.targetShiftY, FOLLOW_W, dt);
    if (Math.abs(this.targetShiftX - this.shiftX) < 0.05 && Math.abs(this.vsx) < 1) {
      this.shiftX = this.targetShiftX;
      this.vsx = 0;
    }
    if (Math.abs(this.targetShiftY - this.shiftY) < 0.05 && Math.abs(this.vsy) < 1) {
      this.shiftY = this.targetShiftY;
      this.vsy = 0;
    }
    // while it eases (a new thing to look at, a zoom), the one it must keep never leaves the picture either
    const now = this.keepIn(this.x, this.y, this.zoom, KEEP_MARGIN_NOW, this.shiftX, this.shiftY);
    this.x = now.x;
    this.y = now.y;
  }

  /** Keep the view inside the world; a view larger than the world is centred on it. */
  clamp(tx: number, ty: number, zoom: number): Pt {
    if (this.loose) return { x: tx, y: ty };
    const halfW = this.viewW / 2 / zoom;
    const halfH = this.viewH / 2 / zoom;
    let x = tx;
    let y = ty;
    const isl = this.island;
    if (isl) {
      // pull the centre in towards the island's middle until the view's corners are mostly over land…
      const room = 1 - (1 - ISLAND_SLACK) * (halfW / isl.hw + halfH / isl.hh);
      const dx = (x - isl.cx) / isl.hw;
      const dy = (y - isl.cy) / isl.hh;
      const l1 = Math.abs(dx) + Math.abs(dy);
      const k = room <= 0 ? 0 : l1 > room ? room / l1 : 1;
      x = isl.cx + dx * k * isl.hw;
      y = isl.cy + dy * k * isl.hh;
      // …but never so far that what the camera follows (the one it keeps, when set) leaves the view
      const kx = this.keep ? this.keep.x : tx;
      const ky = this.keep ? this.keep.y - this.keep.up / 2 : ty;
      const kw = halfW * TARGET_KEEP;
      const kh = halfH * TARGET_KEEP;
      x = Math.min(kx + kw, Math.max(kx - kw, x));
      y = Math.min(ky + kh, Math.max(ky - kh, y));
    }
    const b = this.bounds;
    if (b) {
      x = b.x1 - b.x0 <= halfW * 2 ? (b.x0 + b.x1) / 2 : Math.min(b.x1 - halfW, Math.max(b.x0 + halfW, x));
      y = b.y1 - b.y0 <= halfH * 2 ? (b.y0 + b.y1) / 2 : Math.min(b.y1 - halfH, Math.max(b.y0 + halfH, y));
    }
    // last: the one it keeps stays well inside the view (a strip of sky is the lesser evil)
    return this.keepIn(x, y, zoom, KEEP_MARGIN, this.targetShiftX, this.targetShiftY);
  }

  worldToScreen(p: Pt): Pt {
    return { x: (p.x - this.x) * this.zoom + this.viewW / 2 + this.shiftX, y: (p.y - this.y) * this.zoom + this.viewH / 2 + this.shiftY };
  }

  screenToWorld(p: Pt): Pt {
    return { x: (p.x - this.viewW / 2 - this.shiftX) / this.zoom + this.x, y: (p.y - this.viewH / 2 - this.shiftY) / this.zoom + this.y };
  }
}

/**
 * The resting zoom for a view: people stand about a ninth of the stage tall (big enough to read a face on a phone),
 * and a wide stage is not zoomed so far that only a corner of the town is left.
 */
/**
 * The camera's time for a frame of `dt` seconds, `typical` = the display's usual frame time (smoothed). A frame the
 * browser is late with (the panel's first paint, a garbage collection) shows as a short pause, never as the camera
 * jumping ahead: it gets at most 1.5 usual frames (and never less than 1/50 s). A steady slow display (30 Hz, a phone
 * saving battery) still gets real time: a cap of a flat 1/50 s once ran every eased move there in slow motion.
 */
export function cameraDt(dt: number, typical: number): number {
  return Math.min(dt, Math.max(1 / 50, typical * 1.5));
}

export function baseZoom(viewW: number, viewH: number): number {
  const byWidth = viewW / 940;
  const byHeight = viewH / 460;
  // a tall phone screen (full screen) would zoom in on a strip of the town: its width bounds it too
  return Math.max(0.8, Math.min(1.8, Math.max(byWidth, Math.min(byHeight, viewW / 270))));
}
