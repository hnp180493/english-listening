// The little living things drawn by code over the rendered town (art/world.ts): fireflies at night, the ducks on
// the pond, the ring where the player is walking to and the patch under the pointer. World
// pixels; colours are game art (palette.ts).

import { ART } from '../palette';
import { glow, oval, P, poly, sway, type G } from './util';

/** A drifting spark of a firefly at a tile-grid point: night only, called from the overlay pass. */
export function drawFirefly(g: G, tx: number, ty: number, n: number): void {
  const c = P(tx, ty, 14);
  const t = g.still ? n : g.t;
  const x = c.x + Math.sin(t * 0.5 + n * 1.9) * 16 + Math.sin(t * 0.21 + n) * 10;
  const y = c.y + Math.cos(t * 0.43 + n * 2.7) * 9 - 6;
  const blink = g.still ? 0.7 : Math.max(0, Math.sin(t * 1.4 + n * 2.1));
  if (blink <= 0.02) return;
  glow(g, x, y, 9, 9, 0.85 * blink, g.pal.firefly);
  g.ctx.globalAlpha = blink;
  oval(g.ctx, x, y, 1.1, 1.1, '#f4ffd0');
  g.ctx.globalAlpha = 1;
}

/** A duck paddling round the pond. (cx, cy): the middle of its round, on the tile grid. */
export function drawDuck(g: G, cx: number, cy: number, n: number): void {
  const { ctx, pal } = g;
  const speed = 0.16 + n * 0.03;
  const a = (g.still ? 0 : g.t * speed) + n * 2.6;
  const tx = cx + Math.cos(a) * (0.5 + n * 0.12);
  const ty = cy + Math.sin(a) * (0.42 + n * 0.1);
  // heading: along the round; on the screen x grows with (tile x - tile y)
  const f = -Math.sin(a) - Math.cos(a) >= 0 ? 1 : -1;
  const c = P(tx, ty);
  const bob = sway(g, 2.2, n * 3, 0.5);
  // the ripple it leaves
  ctx.globalAlpha = 0.5;
  oval(ctx, c.x - f * 3, c.y + 1.4, 9, 3.4, undefined, pal.ink(ART.waterShine), 1);
  ctx.globalAlpha = 1;
  const white = pal.ink(n % 2 === 0 ? '#ffffff' : '#fff3c4');
  oval(ctx, c.x, c.y - 2 + bob, 5.6, 3.6, white);
  poly(ctx, [{ x: c.x - f * 4.4, y: c.y - 3 + bob }, { x: c.x - f * 8, y: c.y - 5.4 + bob }, { x: c.x - f * 4.6, y: c.y - 0.6 + bob }], white);
  oval(ctx, c.x - f * 0.6, c.y - 1.6 + bob, 3, 1.8, pal.ink('#e8e2d2'));
  oval(ctx, c.x + f * 4.2, c.y - 6 + bob, 2.8, 2.7, white);
  poly(ctx, [{ x: c.x + f * 6.4, y: c.y - 6.6 + bob }, { x: c.x + f * 9.6, y: c.y - 5.4 + bob }, { x: c.x + f * 6.4, y: c.y - 4.4 + bob }], pal.ink('#ff9f43'));
  oval(ctx, c.x + f * 4.8, c.y - 6.6 + bob, 0.7, 0.7, pal.ink('#2b2a3a'));
}

/** The marker under the place the player is walking to: a ring that breathes. */
export function drawGoal(g: G, tx: number, ty: number): void {
  const { ctx, pal } = g;
  const c = P(tx + 0.5, ty + 0.5);
  const k = g.still ? 0.5 : (g.t * 1.2) % 1;
  ctx.globalAlpha = 0.9 - k * 0.6;
  oval(ctx, c.x, c.y, 10 + k * 9, 5 + k * 4.5, undefined, pal.night ? pal.lampOn : '#ffffff', 2);
  ctx.globalAlpha = 0.5;
  oval(ctx, c.x, c.y, 5, 2.5, pal.night ? pal.lampOn : '#ffffff');
  ctx.globalAlpha = 1;
}

/** A soft patch under the pointer: this tile can be walked to. */
export function drawHoverTile(g: G, tx: number, ty: number): void {
  const c = P(tx + 0.5, ty + 0.5);
  oval(g.ctx, c.x, c.y, 24, 12, g.pal.hover);
}

