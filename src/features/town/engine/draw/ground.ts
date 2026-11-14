// The pond's moving light: a few pale streaks drifting across the water of the ground picture (art/world.ts),
// clipped to the water tiles. Everything else on the ground is in the rendered picture.

import type { TownWorld } from '../../../../data/townWorld';
import { groundTransform } from '../iso';
import { ART } from '../palette';
import { hash, type G } from './util';

/** The pond for clipping: one round blob per water tile, in tile units. */
function pondPath(ctx: CanvasRenderingContext2D, world: TownWorld, r: number): void {
  ctx.beginPath();
  for (let y = 0; y < world.size; y++) {
    for (let x = 0; x < world.size; x++) {
      if (world.rows[y][x] !== '~') continue;
      ctx.moveTo(x + 0.5 + r, y + 0.5);
      ctx.arc(x + 0.5, y + 0.5, r, 0, Math.PI * 2);
    }
  }
}

/** Moving light on the pond: a few pale streaks drifting across, clipped to the water. */
export function drawPondShimmer(g: G, world: TownWorld): void {
  const { ctx, pal } = g;
  ctx.save();
  groundTransform(ctx);
  pondPath(ctx, world, 0.66);
  ctx.clip();
  let n = 0;
  for (let y = 0; y < world.size; y++) {
    for (let x = 0; x < world.size; x++) {
      if (world.rows[y][x] !== '~') continue;
      n++;
      for (let i = 0; i < 2; i++) {
        const speed = g.still ? 0 : 0.11 + hash(n, i) * 0.06;
        const drift = (g.t * speed + hash(n, i, 3)) % 1;
        const cx = x + drift;
        const cy = y + 0.25 + i * 0.4 + Math.sin(g.t * 0.8 + n + i) * (g.still ? 0 : 0.03);
        ctx.globalAlpha = Math.sin(drift * Math.PI) * (pal.night ? 0.32 : 0.6);
        ctx.beginPath();
        // a streak along the screen's horizontal: x up, y down on the tile grid
        ctx.moveTo(cx - 0.13, cy + 0.13);
        ctx.lineTo(cx + 0.13, cy - 0.13);
        ctx.lineWidth = 0.05;
        ctx.lineCap = 'round';
        ctx.strokeStyle = pal.ink(ART.waterShine, pal.night ? 0.2 : 0);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}
