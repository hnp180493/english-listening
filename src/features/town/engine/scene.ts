// The things standing in the town, as a list to draw from the far corner to the near one. Rebuilt only when what is
// built or bought changes; people and the cat are merged in each frame (they move).

import { worldFountain, worldTrees, type DecorationId, type PlaceId, type Tile, type TownWorld } from '../../../data/townWorld';
import { drawLot, drawPlace } from './draw/buildings';
import {
  drawBalloons,
  drawBench,
  drawBus,
  drawFlagPole,
  drawFlowerBed,
  drawFountain,
  drawLamp,
  drawLightPole,
  drawStall,
  drawTerrace,
  drawTree,
} from './draw/props';
import { hash, type G } from './draw/util';
import { depthOfFootprint, depthOfPoint, toWorld, type Pt } from './iso';
import type { StageState } from './sim';

/** What changes from frame to frame for the standing things. */
export interface FrameInfo {
  lit: Readonly<Record<string, number>>;
  hoverPlace: PlaceId | null;
  /**
   * A thing just built or bought (place id / decoration id, and which of its spots): 1 = standing as usual,
   * 0..1 = popping out of the ground, below 0 = not there yet. Left out = everything stands.
   */
  pop?: (id: string, index?: number) => number;
}

/** How long a new thing takes to pop out of the ground, and the delay between the spots of one decoration. */
export const POP_SECONDS = 0.5;
export const POP_STAGGER = 0.11;

/** Overshoots a little past 1 before settling: the "pop". */
function easeOutBack(k: number): number {
  const c = 1.9;
  const u = k - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
}

/**
 * Draw something that may be popping out of the ground at `base` (world pixels, on the ground): squashed flat at
 * first, a little too tall, then itself. `before` is drawn while it is not there yet.
 */
export function popped(g: G, k: number, base: Pt, draw: () => void, before?: () => void): void {
  if (k >= 1 || g.still) {
    draw();
    return;
  }
  if (k < 0) {
    before?.();
    return;
  }
  const e = easeOutBack(k);
  const { ctx } = g;
  ctx.save();
  ctx.translate(base.x, base.y);
  ctx.scale(1 + (1 - Math.min(1, e)) * 0.3, Math.max(0.02, e));
  ctx.translate(-base.x, -base.y);
  draw();
  ctx.restore();
}

export interface Drawable {
  depth: number;
  draw: (g: G, f: FrameInfo) => void;
}

/** Stable sort by depth: far things first; equal depths keep their order. */
export function sortByDepth<T extends { depth: number }>(list: T[]): T[] {
  return list
    .map((item, i) => ({ item, i }))
    .sort((a, b) => a.item.depth - b.item.depth || a.i - b.i)
    .map((e) => e.item);
}

const tileDepth = (t: Tile) => depthOfPoint(t.x + 0.5, t.y + 0.5);

export function sceneKey(state: Pick<StageState, 'built' | 'decorations'>): string {
  return `${[...state.built].sort().join(',')}|${[...state.decorations].sort().join(',')}`;
}

export function buildScene(world: TownWorld, state: Pick<StageState, 'built' | 'decorations'>): Drawable[] {
  const out: Drawable[] = [];
  const built = new Set(state.built);
  const has = (id: DecorationId) => state.decorations.includes(id);

  for (const p of world.places) {
    const depth = depthOfFootprint(p.x, p.y, p.w, p.d);
    const base = toWorld(p.x + p.w / 2, p.y + p.d / 2);
    if (built.has(p.id)) {
      out.push({
        depth,
        draw: (g, f) =>
          popped(
            g,
            f.pop?.(p.id) ?? 1,
            base,
            () => drawPlace(g, p, f.lit[p.id] ?? 0, f.hoverPlace === p.id),
            () => drawLot(g, p, false),
          ),
      });
    }
    else out.push({ depth, draw: (g, f) => drawLot(g, p, f.hoverPlace === p.id) });
  }
  for (const t of worldTrees(world)) out.push({ depth: tileDepth(t), draw: (g) => drawTree(g, t.x, t.y, t.kind) });
  const fountain = worldFountain(world);
  if (fountain) {
    const big = has('fountain');
    const base = toWorld(fountain.x + 0.5, fountain.y + 0.5);
    out.push({
      depth: tileDepth(fountain),
      draw: (g, f) =>
        popped(
          g,
          big ? (f.pop?.('fountain') ?? 1) : 1,
          base,
          () => drawFountain(g, fountain.x, fountain.y, big),
          () => drawFountain(g, fountain.x, fountain.y, false),
        ),
    });
  }
  for (const prop of world.props) {
    const t = prop.tiles[0];
    if (prop.kind === 'terrace') {
      // the parasol belongs to the café
      if (built.has('cafe')) out.push({ depth: tileDepth(t), draw: (g) => drawTerrace(g, t.x, t.y) });
    } else {
      out.push({ depth: depthOfFootprint(t.x, t.y, 1, prop.tiles.length), draw: (g) => drawBus(g, t.x, t.y) });
    }
  }
  const each = (id: DecorationId, draw: (g: G, s: (typeof world.decorations)[DecorationId][number], i: number) => void, lift = 0) => {
    if (!has(id)) return;
    world.decorations[id].forEach((s, i) => {
      const depth = (s.solid ? tileDepth(s) : depthOfPoint(s.x, s.y)) + lift;
      const base = s.solid ? toWorld(s.x + 0.5, s.y + 0.5) : toWorld(s.x, s.y);
      out.push({ depth, draw: (g, f) => popped(g, f.pop?.(id, i) ?? 1, base, () => draw(g, s, i)) });
    });
  };
  each('lamps1', (g, s) => drawLamp(g, s.x, s.y));
  each('lamps2', (g, s) => drawLamp(g, s.x, s.y));
  each('flowers', (g, s) => drawFlowerBed(g, s.x, s.y));
  each('benches', (g, s) => drawBench(g, s.x, s.y, s.dir ?? 's'));
  each('blossom', (g, s) => drawTree(g, s.x, s.y, 'blossom'));
  each('lights', (g, s) => void drawLightPole(g, s.x, s.y));
  each('stall', (g, s) => drawStall(g, s.x, s.y));
  each('balloons', (g, s) => drawBalloons(g, s.x, s.y));
  each('flags', (g, s, i) => drawFlagPole(g, s.x, s.y, i));
  return sortByDepth(out);
}

/** Where the fireflies drift at night: a fixed handful of grass tiles away from the plaza. */
export function fireflySpots(world: TownWorld, count = 26): Tile[] {
  const grass: Tile[] = [];
  for (let y = 0; y < world.size; y++) {
    for (let x = 0; x < world.size; x++) {
      if (world.rows[y][x] === '.') grass.push({ x: x + 0.5, y: y + 0.5 });
    }
  }
  const out: Tile[] = [];
  for (let i = 0; i < count && grass.length > 0; i++) {
    out.push(grass[Math.floor(hash(i, 17) * grass.length)]);
  }
  return out;
}
