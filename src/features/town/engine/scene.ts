// The things standing in the town, as a list to draw from the far corner to the near one. Rebuilt only when what is
// built, bought or on offer changes; people and the cat are merged in each frame (they move). Every thing is a
// rendered sprite (art/world.ts): its shadow is drawn on the ground first (`shadow`), its body in depth order.

import { worldFountain, worldTrees, type DecorationId, type PlaceId, type Tile, type TownWorld } from '../../../data/townWorld';
import { decorSpriteKey, fountainKey, lotNature, lotSpriteKey, placeAnchor, placeSpriteKey, propSpriteKey, spotAnchor, spriteDraw, treeKey, type WorldSpriteKey } from '../art/world';
import { hash, type G } from './draw/util';
import { depthOfFootprint, depthOfPoint, toWorld, type Pt } from './iso';
import type { StageState } from './sim';
import { drawSprite, drawSpriteShadow } from './sprites';

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

/**
 * How brightly a place's windows glow at night for the share of its lines understood (0..1): a faint glow from
 * the first day (a house is lived in), full when every line is understood.
 */
export function windowGlow(lit: number): number {
  return 0.35 + 0.65 * Math.max(0, Math.min(1, lit));
}

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
  /** Its shadow on the ground, drawn before anything stands (so a passer-by is never darkened). */
  shadow?: (g: G, f: FrameInfo) => void;
  /**
   * Where its picture is (world px): a thing standing in front of a person fades where it covers them, so nobody
   * disappears behind a tree, a lamp or a house.
   */
  box?: Box;
}

/** A rectangle in world px. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The world-px box of a sprite's body with its anchor at world (x, y), scaled by `k` round the anchor. */
export function spriteBox(key: WorldSpriteKey, x: number, y: number, flip = false, k = 1): Box | undefined {
  const d = spriteDraw(key, 'body', x, y, flip);
  if (!d) return undefined;
  return { x: x + (d.dx - x) * k, y: y + (d.dy - y) * k, w: d.dw * k, h: d.dh * k };
}

/** The bus is drawn this much bigger than its rendered size: a bus has to look like it holds people. */
export const BUS_SCALE = 1.3;

/**
 * Flags: the rendered pole carries a pennant and two strings of bunting pegged to the ground, which reads like a
 * fallen tent from afar. Only the pole and its pennant are drawn: a band round the pole, and the pennant's corner.
 */
function flagClip(g: G, x: number, y: number, draw: () => void): void {
  const { ctx } = g;
  ctx.save();
  ctx.beginPath();
  // the pole with its foot (world px from the anchor: the foot of the pole)
  ctx.rect(x - 3.4, y - 72, 6.8, 76);
  // the pennant, up and to the right of the pole's top
  ctx.rect(x - 3.4, y - 72, 30, 22);
  ctx.clip();
  draw();
  ctx.restore();
}

/** Stable sort by depth: far things first; equal depths keep their order. */
export function sortByDepth<T extends { depth: number }>(list: T[]): T[] {
  return list
    .map((item, i) => ({ item, i }))
    .sort((a, b) => a.item.depth - b.item.depth || a.i - b.i)
    .map((e) => e.item);
}

const tileDepth = (t: Tile) => depthOfPoint(t.x + 0.5, t.y + 0.5);

export function sceneKey(state: Pick<StageState, 'built' | 'decorations' | 'sites'>): string {
  const sites = state.sites ? [...state.sites].sort().join(',') : '*';
  return `${[...state.built].sort().join(',')}|${[...state.decorations].sort().join(',')}|${sites}`;
}

/** A sprite that just stands at a ground point (tile coordinates), with its shadow. */
function standing(key: WorldSpriteKey, at: { x: number; y: number }, depth: number, opts: { lit?: number; shadow?: boolean } = {}): Drawable {
  const w = toWorld(at.x, at.y);
  return {
    depth,
    draw: (g) => void drawSprite(g, key, w.x, w.y, { lit: opts.lit }),
    shadow: opts.shadow === false ? undefined : (g) => drawSpriteShadow(g, key, w.x, w.y),
    box: spriteBox(key, w.x, w.y),
  };
}

export function buildScene(world: TownWorld, state: Pick<StageState, 'built' | 'decorations' | 'sites'>): Drawable[] {
  const out: Drawable[] = [];
  const built = new Set(state.built);
  const sites = state.sites ? new Set(state.sites) : null;
  const has = (id: DecorationId) => state.decorations.includes(id);

  for (const p of world.places) {
    const depth = depthOfFootprint(p.x, p.y, p.w, p.d);
    const a = placeAnchor(p);
    const base = toWorld(a.x, a.y);
    const site = lotSpriteKey(p, 'site');
    if (built.has(p.id)) {
      const key = placeSpriteKey(p.id);
      out.push({
        depth,
        box: spriteBox(key, base.x, base.y),
        draw: (g, f) =>
          popped(
            g,
            f.pop?.(p.id) ?? 1,
            base,
            () => void drawSprite(g, key, base.x, base.y, { lit: windowGlow(f.lit[p.id] ?? 0), hover: f.hoverPlace === p.id }),
            () => void drawSprite(g, site, base.x, base.y, { lit: 1 }),
          ),
        shadow: (g, f) => {
          const k = f.pop?.(p.id) ?? 1;
          if (k < 0) drawSpriteShadow(g, site, base.x, base.y);
          else popped(g, k, base, () => drawSpriteShadow(g, key, base.x, base.y));
        },
      });
    } else if (!sites || sites.has(p.id)) {
      out.push({
        depth,
        box: spriteBox(site, base.x, base.y),
        draw: (g, f) => void drawSprite(g, site, base.x, base.y, { lit: 1, hover: f.hoverPlace === p.id }),
        shadow: (g) => drawSpriteShadow(g, site, base.x, base.y),
      });
    } else {
      // not on offer yet: a corner of nature, nothing to click
      for (const n of lotNature(p)) out.push(standing(n.key, n, depthOfPoint(n.x, n.y)));
    }
  }
  // the fixed trees' shadows are painted into the ground picture
  for (const t of worldTrees(world)) out.push(standing(treeKey(t.kind, t.x, t.y), { x: t.x + 0.5, y: t.y + 0.5 }, tileDepth(t), { shadow: false }));
  const fountain = worldFountain(world);
  if (fountain) {
    const big = has('fountain');
    const at = toWorld(fountain.x + 0.5, fountain.y + 0.5);
    const small = fountainKey(false);
    const key = fountainKey(big);
    out.push({
      depth: tileDepth(fountain),
      draw: (g, f) =>
        popped(
          g,
          big ? (f.pop?.('fountain') ?? 1) : 1,
          at,
          () => void drawSprite(g, key, at.x, at.y),
          () => void drawSprite(g, small, at.x, at.y),
        ),
      shadow: (g) => drawSpriteShadow(g, key, at.x, at.y),
      box: spriteBox(key, at.x, at.y),
    });
  }
  for (const prop of world.props) {
    const n = prop.tiles.length;
    const at = {
      x: prop.tiles.reduce((s, t) => s + t.x, 0) / n + 0.5,
      y: prop.tiles.reduce((s, t) => s + t.y, 0) / n + 0.5,
    };
    const t = prop.tiles[0];
    if (prop.kind === 'terrace') {
      // the parasol belongs to the café
      if (built.has('cafe')) out.push(standing(propSpriteKey('terrace'), at, tileDepth(t)));
    } else if (built.has('station')) {
      // the bus belongs to the bus stop: it pulls in with it
      const key = propSpriteKey('bus');
      const w = toWorld(at.x, at.y);
      const scaled = (g: G, draw: () => void) => {
        g.ctx.save();
        g.ctx.translate(w.x, w.y);
        g.ctx.scale(BUS_SCALE, BUS_SCALE);
        g.ctx.translate(-w.x, -w.y);
        draw();
        g.ctx.restore();
      };
      out.push({
        depth: depthOfFootprint(t.x, t.y, 1, n),
        draw: (g, f) => popped(g, f.pop?.('station') ?? 1, w, () => scaled(g, () => void drawSprite(g, key, w.x, w.y, { lit: 1 }))),
        shadow: (g, f) => {
          const k = f.pop?.('station') ?? 1;
          if (k >= 0) popped(g, k, w, () => scaled(g, () => drawSpriteShadow(g, key, w.x, w.y)));
        },
        box: spriteBox(key, w.x, w.y, false, BUS_SCALE),
      });
    }
  }
  const each = (id: DecorationId) => {
    if (!has(id)) return;
    world.decorations[id].forEach((s, i) => {
      const key = decorSpriteKey(id, i, s);
      if (!key) return;
      const depth = s.solid ? tileDepth(s) : depthOfPoint(s.x, s.y);
      const a = spotAnchor(s);
      const base = toWorld(a.x, a.y);
      const flip = s.flip ?? false;
      const body = id === 'flags' ? (g: G) => flagClip(g, base.x, base.y, () => void drawSprite(g, key, base.x, base.y, { flip })) : (g: G) => void drawSprite(g, key, base.x, base.y, { lit: 1, flip });
      out.push({
        depth,
        draw: (g, f) => popped(g, f.pop?.(id, i) ?? 1, base, () => body(g)),
        shadow: (g, f) => {
          const k = f.pop?.(id, i) ?? 1;
          // a flag's shadow would show the bunting that is not drawn
          if (k >= 0 && id !== 'flags') popped(g, k, base, () => drawSpriteShadow(g, key, base.x, base.y, flip));
        },
        box: id === 'flags' ? { x: base.x - 3.4, y: base.y - 72, w: 30, h: 76 } : spriteBox(key, base.x, base.y, flip),
      });
    });
  };
  for (const id of ['lamps1', 'lamps2', 'flowers', 'benches', 'blossom', 'lights', 'stall', 'balloons', 'flags'] as const) each(id);
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

/** A pool of warm light on the ground at night (world px): a street lamp, the stall, a lit string. */
export interface LampLight {
  x: number;
  y: number;
  /** Half-width of the pool, world px (it is half as tall: it lies on the ground). */
  r: number;
  /** How strong, 0..1. */
  k: number;
}

/** How far a lamp's bulb hangs out from its pole, world px on the screen (the arm reaches right; mirrored, left). */
const LAMP_ARM = 20;

/** Where light falls at night, for what is built and bought. */
export function lampLights(world: TownWorld, state: Pick<StageState, 'built' | 'decorations'>): LampLight[] {
  const out: LampLight[] = [];
  const has = (id: DecorationId) => state.decorations.includes(id);
  for (const id of ['lamps1', 'lamps2'] as const) {
    if (!has(id)) continue;
    for (const s of world.decorations[id]) {
      const a = toWorld(s.x + 0.5, s.y + 0.5);
      out.push({ x: a.x + (s.flip ? -LAMP_ARM : LAMP_ARM), y: a.y + 2, r: 58, k: 1 });
    }
  }
  if (has('stall')) for (const s of world.decorations.stall) out.push({ ...toWorld(s.x + 0.5, s.y + 0.5), r: 44, k: 0.7 });
  if (has('lights')) {
    const f = worldFountain(world);
    // many small bulbs: a wide, faint light over the middle of the plaza
    if (f) out.push({ ...toWorld(f.x + 0.5, f.y + 0.5), r: 110, k: 0.35 });
  }
  return out;
}
