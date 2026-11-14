// The camera of the town: follows a target with easing and zooms smoothly. Pure numbers (no canvas), in CSS pixels.

import type { Pt } from './iso';

export interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** How fast the camera catches up (per second, exponential): after 1/RATE s it has covered ~63% of the way. */
const FOLLOW_RATE = 5;
const ZOOM_RATE = 4;

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
  /**
   * Screen pixels the picture is moved by, so that what the camera looks at sits in the middle of the part of the
   * stage a panel leaves free (a sheet on the right: negative x; a panel at the bottom: negative y).
   */
  shiftX = 0;
  shiftY = 0;
  targetShiftX = 0;
  targetShiftY = 0;

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
  }

  update(dt: number, instant = false): void {
    if (instant) {
      this.snap();
      return;
    }
    const kz = 1 - Math.exp(-dt * ZOOM_RATE);
    this.zoom += (this.targetZoom - this.zoom) * kz;
    if (Math.abs(this.targetZoom - this.zoom) < 0.0005) this.zoom = this.targetZoom;
    const k = 1 - Math.exp(-dt * FOLLOW_RATE);
    const goal = this.clamp(this.targetX, this.targetY, this.zoom);
    this.x += (goal.x - this.x) * k;
    this.y += (goal.y - this.y) * k;
    if (Math.abs(goal.x - this.x) < 0.01) this.x = goal.x;
    if (Math.abs(goal.y - this.y) < 0.01) this.y = goal.y;
    this.shiftX += (this.targetShiftX - this.shiftX) * k;
    this.shiftY += (this.targetShiftY - this.shiftY) * k;
    if (Math.abs(this.targetShiftX - this.shiftX) < 0.05) this.shiftX = this.targetShiftX;
    if (Math.abs(this.targetShiftY - this.shiftY) < 0.05) this.shiftY = this.targetShiftY;
  }

  /** Keep the view inside the world; a view larger than the world is centred on it. */
  clamp(x: number, y: number, zoom: number): Pt {
    const b = this.bounds;
    if (!b) return { x, y };
    const halfW = this.viewW / 2 / zoom;
    const halfH = this.viewH / 2 / zoom;
    const cx = b.x1 - b.x0 <= halfW * 2 ? (b.x0 + b.x1) / 2 : Math.min(b.x1 - halfW, Math.max(b.x0 + halfW, x));
    const cy = b.y1 - b.y0 <= halfH * 2 ? (b.y0 + b.y1) / 2 : Math.min(b.y1 - halfH, Math.max(b.y0 + halfH, y));
    return { x: cx, y: cy };
  }

  worldToScreen(p: Pt): Pt {
    return { x: (p.x - this.x) * this.zoom + this.viewW / 2 + this.shiftX, y: (p.y - this.y) * this.zoom + this.viewH / 2 + this.shiftY };
  }

  screenToWorld(p: Pt): Pt {
    return { x: (p.x - this.viewW / 2 - this.shiftX) / this.zoom + this.x, y: (p.y - this.viewH / 2 - this.shiftY) / this.zoom + this.y };
  }
}

/** The resting zoom for a view: a phone shows about nine tiles across, a wide stage about fifteen. */
export function baseZoom(viewW: number, viewH: number): number {
  const byWidth = viewW / 940;
  const byHeight = viewH / 560;
  return Math.max(0.62, Math.min(1.45, Math.max(byWidth, byHeight * 0.92)));
}
