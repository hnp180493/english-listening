// The world of "Thị trấn" as sprites: the thirteen places, the empty lots, trees, decorations, the bus, the café's
// terrace, string lights, the cat and the ground, rendered by scripts/town-art (`npm run art:town`) from Kenney's
// city kits (CC0) and shapes in the same style, with the same camera and light as the people (characters.ts).
// This file says which sprite stands where and draws it. The pure part is tested in world.test.ts; loading and
// drawing need a browser.
//
// Every sprite has an ANCHOR: the ground point it stands on. In tile coordinates that is
//   a place or an empty lot      the centre of its footprint (x + w / 2, y + d / 2);
//   a tree, a solid decoration   the centre of its tile (x + 0.5, y + 0.5);
//   a loose decoration (lilies,  the spot itself (x, y);
//     balloons, the cat)
//   the terrace, the bus         the centre of the tiles they cover;
//   a string of lights           its `at` point (WORLD_ART.strings), the ground under its middle;
//   the ground picture           tile (0, 0), the far corner.
// Up to three layers per sprite: 'body' (the thing), 'lit' (what gives off light, for the night: draw it over the
// body with the place's lit amount as alpha) and 'shadow' (on the ground: draw every shadow right after the ground,
// before anything that stands, so a person walking past is never darkened).

import type { DecorationId, DecorSpot, PlaceId, WorldPlace } from '../../../data/townWorld';
import { frameAt, resolveDir, type Dir8 } from './characters';
import { WORLD_ART, type WorldArtData, type WorldRect, type WorldSpriteKey } from './world.data';
import { tileHash, treeSpriteKey, type TreeKindArt } from './worldPick';

export type { WorldSpriteKey } from './world.data';
export type WorldLayer = 'body' | 'lit' | 'shadow';
export type LotLook = 'site' | 'grass';
export type CatAnim = 'walk' | 'sit';

const isKey = (data: WorldArtData, key: string): key is WorldSpriteKey => key in data.sprites;

function need(data: WorldArtData, key: string): WorldSpriteKey {
  if (!isKey(data, key)) throw new Error(`Thị trấn: không có hình "${key}"`);
  return key;
}

/** The sprite of a built place. */
export function placeSpriteKey(id: PlaceId, data: WorldArtData = WORLD_ART): WorldSpriteKey {
  return need(data, `place/${id}`);
}

/** The sprite of a place not built yet: 'site' = a construction site (on offer next), 'grass' = a grass patch. */
export function lotSpriteKey(p: Pick<WorldPlace, 'w' | 'd'>, look: LotLook, data: WorldArtData = WORLD_ART): WorldSpriteKey {
  return need(data, `lot/${look}/${p.w}x${p.d}`);
}

/**
 * What grows on an empty lot that is not on offer yet: a tree or two, a bush and a stone, the same every time for
 * a lot (a stable hash of its corner). Anchors in tile coordinates, inside the footprint. No fence, no sign: it is
 * just a corner of nature until the lot comes up as one of the next to build (shellModel lotsOnOffer).
 */
export function lotNature(p: Pick<WorldPlace, 'x' | 'y' | 'w' | 'd'>, data: WorldArtData = WORLD_ART): { key: WorldSpriteKey; x: number; y: number }[] {
  const h = (salt: number) => tileHash(p.x, p.y, salt);
  const pick = (kinds: readonly string[], salt: number) => kinds[Math.min(kinds.length - 1, Math.floor(h(salt) * kinds.length))];
  const out: { key: WorldSpriteKey; x: number; y: number }[] = [];
  out.push({ key: need(data, pick(['tree/round/0', 'tree/round/1', 'tree/round/2', 'tree/poplar/0'], 1)), x: p.x + 0.55, y: p.y + 0.55 });
  if (p.w > 2) out.push({ key: need(data, pick(['tree/poplar/0', 'tree/poplar/1', 'tree/round/1'], 2)), x: p.x + p.w - 0.5, y: p.y + 0.45 });
  if (p.d > 2) out.push({ key: need(data, pick(['tree/poplar/1', 'tree/round/2', 'tree/round/0'], 2)), x: p.x + 0.45, y: p.y + p.d - 0.5 });
  out.push({ key: need(data, pick(['bush/0', 'bush/1'], 3)), x: p.x + p.w - 0.55, y: p.y + p.d - 0.6 });
  out.push({ key: need(data, pick(['rock/0', 'rock/1', 'bush/1'], 4)), x: p.x + (p.d > 2 ? 1.4 : 0.6), y: p.y + p.d - 0.3 });
  return out;
}

/** The sprite of a tree of the layout ('round' = 'T', 'pine' = 't'), the same variant the ground's shadow was baked for. */
export function treeKey(kind: TreeKindArt, x: number, y: number, data: WorldArtData = WORLD_ART): WorldSpriteKey {
  return need(data, treeSpriteKey(kind, x, y));
}

/**
 * The sprite of spot `index` of a decoration once bought. Null for the cat (it walks: catFrame) and for 'lights',
 * whose spots are the poles: the strings between them are WORLD_ART.strings (stringLights).
 */
export function decorSpriteKey(id: DecorationId, index: number, spot: DecorSpot, data: WorldArtData = WORLD_ART): WorldSpriteKey | null {
  switch (id) {
    case 'lamps1':
      return need(data, 'decor/lamp/0');
    case 'lamps2':
      return need(data, 'decor/lamp/1');
    case 'flowers':
      return need(data, 'decor/flowers');
    case 'benches':
      return need(data, `decor/bench/${spot.dir ?? 's'}`);
    case 'blossom':
      return need(data, 'decor/blossom');
    case 'lights':
      return need(data, 'decor/lightPole');
    case 'lilies':
      return need(data, `decor/lily/${index % 2}`);
    case 'stall':
      return need(data, 'decor/stall');
    case 'fountain':
      return need(data, 'decor/fountain/1');
    case 'balloons':
      return need(data, 'decor/balloons');
    case 'flags':
      return need(data, `decor/flag/${index % 3}`);
    case 'cat':
      return null;
  }
}

/** The plaza's fountain: the small one always stands there, the big one once bought. */
export function fountainKey(big: boolean, data: WorldArtData = WORLD_ART): WorldSpriteKey {
  return need(data, big ? 'decor/fountain/1' : 'decor/fountain/0');
}

/** Sprites of the fixed props of the layout (townWorld.ts WORLD_PROPS). */
export function propSpriteKey(kind: 'terrace' | 'bus', data: WorldArtData = WORLD_ART): WorldSpriteKey {
  return need(data, `prop/${kind}`);
}

/** The ground point (tile coordinates) a decoration spot's sprite stands on. */
export function spotAnchor(s: DecorSpot): { x: number; y: number } {
  return s.solid ? { x: s.x + 0.5, y: s.y + 0.5 } : { x: s.x, y: s.y };
}

/** The ground point (tile coordinates) of a place's or lot's sprite: the centre of its footprint. */
export function placeAnchor(p: Pick<WorldPlace, 'x' | 'y' | 'w' | 'd'>): { x: number; y: number } {
  return { x: p.x + p.w / 2, y: p.y + p.d / 2 };
}

/**
 * The strings of lights to draw: every string once the decoration is bought, except the ones tied to the square's
 * pavilion while the square is not built.
 */
export function stringLights(squareBuilt: boolean, data: WorldArtData = WORLD_ART): WorldArtData['strings'] {
  return data.strings.filter((s) => squareBuilt || (s.from !== 'square' && s.to !== 'square'));
}

/** The cat's frame: walk (in step with sim.ts `phase`, like the people) or sit (the tail sways). */
export function catFrame(anim: CatAnim, dir: Dir8, t: number, data: WorldArtData = WORLD_ART): { key: WorldSpriteKey; flip: boolean } {
  const spec = data.cat.anims[anim];
  if (!spec) throw new Error(`Thị trấn: con mèo không có "${anim}"`);
  const r = resolveDir(spec.dirs, dir);
  return { key: need(data, `cat/${anim}/${r.dir}/${frameAt(spec, t)}`), flip: r.flip };
}

/** Where to draw one layer of a sprite whose anchor is at world (x, y): source rect and destination, world px. */
export interface SpriteDraw {
  atlas: number;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
  flip: boolean;
}

function layerRect(data: WorldArtData, key: WorldSpriteKey, layer: WorldLayer): WorldRect | undefined {
  if (layer === 'body') return data.sprites[key];
  return layer === 'lit' ? data.lit[key] : data.shadows[key];
}

/** Pure: where a layer of a sprite goes, or null when the sprite has no such layer. `flip` mirrors it round its anchor. */
export function spriteDraw(key: WorldSpriteKey, layer: WorldLayer, x: number, y: number, flip = false, data: WorldArtData = WORLD_ART): SpriteDraw | null {
  const r = layerRect(data, key, layer);
  if (!r) return null;
  const [atlas, sx, sy, sw, sh, ax, ay] = r;
  const k = 1 / data.atlases[atlas].res;
  const left = flip ? sw - ax : ax;
  return { atlas, sx, sy, sw, sh, dx: x - left * k, dy: y - ay * k, dw: sw * k, dh: sh * k, flip };
}

/** The ground picture's place in world px (tile (0, 0) at world (0, 0), engine/iso.ts). */
export function groundRect(data: WorldArtData = WORLD_ART): { x: number; y: number; w: number; h: number } {
  const g = data.ground;
  return { x: -g.ax / g.res, y: -g.ay / g.res, w: g.w / g.res, h: g.h / g.res };
}

/** How high the top of a sprite stands above its anchor, in world px (for name tags and picking). */
export function spriteTop(key: WorldSpriteKey, data: WorldArtData = WORLD_ART): number {
  const [atlas, , , , , , ay] = data.sprites[key];
  return ay / data.atlases[atlas].res;
}

// ---- browser side: images ------------------------------------------------------------------------------------------

const images = new Map<string, HTMLImageElement>();
let loading: Promise<void> | null = null;

function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  return img.decode().then(() => img);
}

/**
 * Load the ground and every atlas once (about 1 MB of WebP). Until it resolves, the draw functions return false,
 * so the game can draw something simpler. A failed load can be retried by calling again.
 */
export function loadWorldArt(data: WorldArtData = WORLD_ART): Promise<void> {
  if (loading) return loading;
  const urls = [data.ground.url, ...data.atlases.map((a) => a.url)];
  loading = Promise.all(
    urls.map((u) =>
      images.has(u)
        ? undefined
        : loadImage(u).then((img) => {
            images.set(u, img);
          }),
    ),
  ).then(
    () => undefined,
    (e: unknown) => {
      loading = null;
      throw e;
    },
  );
  return loading;
}

/** The decoded image of atlas `index` (world.data.ts `atlases`), null until loaded. */
export function worldImage(index: number, data: WorldArtData = WORLD_ART): HTMLImageElement | null {
  const a = data.atlases[index];
  return a ? (images.get(a.url) ?? null) : null;
}

/** The decoded ground picture, null until loaded. */
export function groundImage(data: WorldArtData = WORLD_ART): HTMLImageElement | null {
  return images.get(data.ground.url) ?? null;
}

/** True once loadWorldArt has finished. */
export function worldArtReady(data: WorldArtData = WORLD_ART): boolean {
  return images.has(data.ground.url) && data.atlases.every((a) => images.has(a.url));
}

/**
 * Draw one layer of a sprite with its anchor at world (x, y), the context already in world space. Returns false
 * (nothing drawn) while the atlases are not loaded or when the sprite has no such layer.
 */
export function drawWorldSprite(
  ctx: CanvasRenderingContext2D,
  key: WorldSpriteKey,
  layer: WorldLayer,
  x: number,
  y: number,
  { alpha = 1, flip = false }: { alpha?: number; flip?: boolean } = {},
  data: WorldArtData = WORLD_ART,
): boolean {
  const d = spriteDraw(key, layer, x, y, flip, data);
  if (!d || alpha <= 0) return false;
  const img = images.get(data.atlases[d.atlas].url);
  if (!img) return false;
  const old = ctx.globalAlpha;
  ctx.globalAlpha = old * alpha;
  if (d.flip) {
    ctx.save();
    ctx.translate(d.dx + d.dw, d.dy);
    ctx.scale(-1, 1);
    ctx.drawImage(img, d.sx, d.sy, d.sw, d.sh, 0, 0, d.dw, d.dh);
    ctx.restore();
  } else {
    ctx.drawImage(img, d.sx, d.sy, d.sw, d.sh, d.dx, d.dy, d.dw, d.dh);
  }
  ctx.globalAlpha = old;
  return true;
}

/** Draw the ground picture (world space). False while it is not loaded. */
export function drawGround(ctx: CanvasRenderingContext2D, data: WorldArtData = WORLD_ART): boolean {
  const img = images.get(data.ground.url);
  if (!img) return false;
  const r = groundRect(data);
  ctx.drawImage(img, r.x, r.y, r.w, r.h);
  return true;
}
