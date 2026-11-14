// The ground of the town, painted once into an off-screen canvas (per theme and resolution): the little island,
// grass with soft variation, sandy paths with round edges, the cobbled round plaza and the pond's bed. What moves
// (the pond's shimmer) is drawn each frame by `drawPondShimmer`.

import { footprintTiles, groundAt, worldTrees, type TownWorld } from '../../../../data/townWorld';
import { groundTransform } from '../iso';
import { ART, type TownPalette } from '../palette';
import { hash, oval, P, type G } from './util';

const ISLAND_MARGIN = 0.9;
const ISLAND_RADIUS = 3.6;
const CLIFF = 46;

/** The island's outline, in tile units (call under groundTransform). */
function islandPath(ctx: CanvasRenderingContext2D, size: number): void {
  const a = -ISLAND_MARGIN;
  const b = size + ISLAND_MARGIN;
  const r = ISLAND_RADIUS;
  ctx.beginPath();
  ctx.moveTo(a + r, a);
  ctx.arcTo(b, a, b, b, r);
  ctx.arcTo(b, b, a, b, r);
  ctx.arcTo(a, b, a, a, r);
  ctx.arcTo(a, a, b, a, r);
  ctx.closePath();
}

/** The pond as one smooth shape: a fat round line through the water tiles, `width` tiles wide (tile units). */
function strokePond(ctx: CanvasRenderingContext2D, world: TownWorld, width: number, style: string): void {
  ctx.beginPath();
  for (let y = 0; y < world.size; y++) {
    for (let x = 0; x < world.size; x++) {
      if (world.rows[y][x] !== '~') continue;
      ctx.moveTo(x + 0.5, y + 0.5);
      ctx.lineTo(x + 0.5, y + 0.5);
      for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]] as const) {
        if (world.rows[y + dy]?.[x + dx] !== '~') continue;
        ctx.moveTo(x + 0.5, y + 0.5);
        ctx.lineTo(x + 0.5 + dx, y + 0.5 + dy);
      }
    }
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = width;
  ctx.strokeStyle = style;
  ctx.stroke();
}

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

const isPathLike = (ch: string | undefined) => ch === '=' || ch === 'o' || ch === 'F';

/** Paint the static ground. `ctx` is already in world pixels (scaled and moved by the caller). */
export function paintGround(ctx: CanvasRenderingContext2D, world: TownWorld, pal: TownPalette): void {
  const size = world.size;
  const ink = pal.ink;

  // ── the island's side: earth, with a darker foot ──
  for (let dz = CLIFF; dz >= 2; dz -= 2) {
    ctx.save();
    ctx.translate(0, dz);
    groundTransform(ctx);
    islandPath(ctx, size);
    const k = dz / CLIFF;
    ctx.fillStyle = dz <= 6 ? ink(ART.grassEdge, -0.12) : ink(ART.earth, -0.42 * k);
    ctx.fill();
    ctx.restore();
  }

  // ── grass ──
  ctx.save();
  groundTransform(ctx);
  islandPath(ctx, size);
  ctx.fillStyle = ink(ART.grass);
  ctx.fill();
  ctx.clip();
  // big soft patches, lighter and darker: no tile edges anywhere
  for (let i = 0; i < 90; i++) {
    const x = hash(i, 1.3) * (size + 1) - 0.5;
    const y = hash(i, 7.7) * (size + 1) - 0.5;
    const r = 0.8 + hash(i, 4.1) * 2.2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.globalAlpha = 0.16 + hash(i, 9.9) * 0.2;
    ctx.fillStyle = ink(i % 2 === 0 ? ART.grassLight : ART.grassDark);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // a darker rim where the island ends
  islandPath(ctx, size);
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = ink(ART.grassEdge);
  ctx.globalAlpha = 0.7;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // ── tree shadows (static) ──
  ctx.fillStyle = pal.shadow;
  for (const t of worldTrees(world)) {
    ctx.beginPath();
    ctx.arc(t.x + 0.5 + 0.3, t.y + 0.5 - 0.08, 0.44, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── paths: round strokes through the tile centres, a darker edge under a lighter middle ──
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const tracePaths = () => {
    ctx.beginPath();
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (world.rows[y][x] !== '=') continue;
        const cx = x + 0.5;
        const cy = y + 0.5;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, cy);
        for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]] as const) {
          if (!isPathLike(world.rows[y + dy]?.[x + dx])) continue;
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + dx, cy + dy);
        }
      }
    }
    // a doorstep from the street to each front door
    for (const p of world.places) {
      const cx = p.door.x + 0.5;
      const cy = p.door.y + 0.5;
      ctx.moveTo(cx, cy);
      if (p.face === 'x') ctx.lineTo(cx - 0.62, cy);
      else ctx.lineTo(cx, cy - 0.62);
    }
  };
  tracePaths();
  ctx.lineWidth = 0.98;
  ctx.strokeStyle = ink(ART.pathEdge);
  ctx.stroke();
  tracePaths();
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = ink(ART.path);
  ctx.stroke();
  tracePaths();
  ctx.lineWidth = 0.36;
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = ink(ART.path, 0.5);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // ── the plaza: a round cobbled square ──
  const { plaza } = world;
  ctx.beginPath();
  ctx.arc(plaza.x, plaza.y, plaza.r + 0.16, 0, Math.PI * 2);
  ctx.fillStyle = ink(ART.plazaEdge);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(plaza.x, plaza.y, plaza.r, 0, Math.PI * 2);
  ctx.fillStyle = ink(ART.plaza);
  ctx.fill();
  ctx.lineCap = 'butt';
  let ring = 0;
  for (let r = 0.86; r < plaza.r - 0.12; r += 0.31) {
    // each ring is a dashed circle: every dash is one stone
    const stones = Math.max(8, Math.round((2 * Math.PI * r) / 0.4));
    const dash = (2 * Math.PI * r) / stones;
    ctx.setLineDash([dash * 0.84, dash * 0.16]);
    ctx.lineDashOffset = hash(ring, 3) * dash;
    ctx.beginPath();
    ctx.arc(plaza.x, plaza.y, r, 0, Math.PI * 2);
    ctx.lineWidth = 0.24;
    ctx.strokeStyle = ink(ring % 2 === 0 ? ART.cobbleA : ART.cobbleB);
    ctx.globalAlpha = ring % 2 === 0 ? 0.85 : 0.7;
    ctx.stroke();
    ring++;
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  // the round step the fountain stands on
  ctx.beginPath();
  ctx.arc(plaza.x, plaza.y, 0.98, 0, Math.PI * 2);
  ctx.fillStyle = ink(ART.plazaEdge, 0.1);
  ctx.fill();

  // ── the pond: a sandy bank, then water ──
  strokePond(ctx, world, 1.7, ink(ART.grassEdge, -0.05));
  strokePond(ctx, world, 1.56, ink(ART.bank));
  strokePond(ctx, world, 1.36, ink(ART.water));
  ctx.globalAlpha = 0.5;
  strokePond(ctx, world, 0.8, ink(ART.waterDeep));
  ctx.globalAlpha = 1;
  ctx.restore();

  // ── small things, in world pixels ──
  const covered = new Set<string>();
  for (const p of world.places) for (const t of footprintTiles(p)) covered.add(`${t.x},${t.y}`);
  const flowerInks = ['#ffffff', '#ffd76b', '#f7a8c6', '#c9b1ff'];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const kind = groundAt({ x, y }, world);
      if (kind === 'path') {
        for (let i = 0; i < 2; i++) {
          const c = P(x + 0.28 + hash(x, y, i) * 0.44, y + 0.28 + hash(y, x, i + 5) * 0.44);
          oval(ctx, c.x, c.y, 2.1, 1.1, ink(ART.pebble));
        }
        continue;
      }
      if (kind !== 'grass' || covered.has(`${x},${y}`)) continue;
      const n = Math.floor(hash(x, y, 11) * 3);
      for (let i = 0; i < n; i++) {
        const c = P(x + 0.12 + hash(x, y, 20 + i) * 0.76, y + 0.12 + hash(y, x, 30 + i) * 0.76);
        ctx.beginPath();
        ctx.moveTo(c.x - 2.4, c.y - 3.4);
        ctx.lineTo(c.x - 0.6, c.y);
        ctx.lineTo(c.x, c.y - 4.6);
        ctx.lineTo(c.x + 0.6, c.y);
        ctx.lineTo(c.x + 2.4, c.y - 3.4);
        ctx.strokeStyle = ink(hash(x, y, 40 + i) > 0.5 ? ART.tuft : ART.grassLight, 0.1);
        ctx.lineWidth = 1.1;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();
      }
      if (hash(x, y, 50) < 0.2) {
        const c = P(x + 0.2 + hash(x, y, 51) * 0.6, y + 0.2 + hash(y, x, 52) * 0.6);
        const col = flowerInks[Math.floor(hash(x, y, 53) * flowerInks.length)];
        for (let i = 0; i < 3; i++) {
          const ox = (hash(x, y, 60 + i) - 0.5) * 9;
          const oy = (hash(y, x, 70 + i) - 0.5) * 5;
          oval(ctx, c.x + ox, c.y + oy, 1.7, 1.5, ink(col));
          oval(ctx, c.x + ox, c.y + oy, 0.6, 0.6, ink('#f2a541'));
        }
      }
    }
  }
}

/** Night: the ground sinks into the dark, so lamps and windows have something to light. */
export function paintDusk(ctx: CanvasRenderingContext2D, world: TownWorld): void {
  ctx.save();
  groundTransform(ctx);
  islandPath(ctx, world.size);
  ctx.fillStyle = 'rgba(12,16,50,0.34)';
  ctx.fill();
  ctx.restore();
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
