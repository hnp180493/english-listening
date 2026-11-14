// Drawing the rendered art (src/features/town/art) on the stage: the ground, the sprites of the world with their
// shadow and light layers, the people and the cat, by day and by night.
//
// The art is lit for daylight. NIGHT multiplies every picture by a dusk blue (game art, see palette.ts), a
// little lighter for the people so faces read, and lays back part of each picture's own colour. The "lit" layers (windows, lamp bulbs, string lights) are
// warmed to amber and laid over with a screen blend, so they glow; the engine adds pools of lamp light on the
// ground. The world's atlases are tinted whole, once, ahead of the first night frame when the browser is idle
// (prepareNight); a person's frame is tinted into a small canvas of its own the first time it is drawn (a few new
// ones per frame, beginSpriteFrame; past that in a shared scratch canvas, without allocating). Everything
// is dropped when the town goes back to day. The ground gets its night copy the same way, first in the queue.

import { CHARACTER_ART } from '../art/characters.data';
import { characterShadowImage, getFrame, type CharacterAnim, type CharacterId, type Dir8 } from '../art/characters';
import { groundImage, groundRect, spriteDraw, worldImage, type WorldLayer, type WorldSpriteKey } from '../art/world';
import { WORLD_ART } from '../art/world.data';
import type { G } from './draw/util';

/** Night multiplies the world by this: blue shadows, not a dark mud. */
export const NIGHT_TINT = '#5c70b4';
/** People get a lighter blue than the world, so a face still reads away from the lamps. */
export const PEOPLE_NIGHT_TINT = '#8290c8';
/**
 * After the blue, this much of the picture's own colour is laid back (a 'color' blend: its hue and saturation on the
 * night's brightness), so pink blossom stays pink and grass stays green instead of one lavender wash.
 */
const NIGHT_KEEP_COLOUR = 0.3;
/** Lit windows and bulbs are multiplied by this before they glow: warm lamplight, not a pale lilac. */
export const LIT_WARM = '#ffb35c';
/** How dark shadows stay at night (they fall on a ground that is already dark). */
const NIGHT_SHADOW_ALPHA = 0.55;

type Source = HTMLImageElement | ImageBitmap | HTMLCanvasElement;

const night = new WeakMap<Source, Map<string, Source>>();
const caches = new Set<Map<string, Source>>();
/** Whole atlases multiplied by a colour, by atlas and colour. */
const wholes = new Map<string, Source>();
/** The ground picture for the night (tinted once, like the atlases). */
let nightGround: Source | null = null;
/** The night ground with the pools of lamp light painted in (made again when the lamps change). */
let pooledGround: { key: string; c: Source } | null = null;
/**
 * The night copies are drawn on the CPU (a "software" canvas) and kept as bitmaps (freeze): the browser then uploads
 * each one to the graphics card once, with its smaller sizes for drawing it shrunk. A copy made on the graphics card
 * instead had to have those smaller sizes made again in every frame it was drawn shrunk (measured in headless Edge:
 * the night cost four times the day in graphics work, all of it there).
 */
const SOFT: CanvasRenderingContext2DSettings = { willReadFrequently: true };
/** Bumped when the night copies are dropped: a bitmap made for an older night is not kept (freeze). */
let generation = 0;

/**
 * Every night copy is drawn into a canvas, then kept as an ImageBitmap once the browser has made one: a canvas used
 * as a picture is copied to the graphics card again and again, which made each night frame several times as costly
 * as a day frame; a bitmap is uploaded once. Until the bitmap is there, the canvas is drawn.
 */
function freeze(c: HTMLCanvasElement, keep: (b: ImageBitmap) => void): void {
  if (typeof createImageBitmap !== 'function') return;
  const gen = generation;
  createImageBitmap(c).then(
    (b) => {
      if (gen === generation) keep(b);
      else b.close();
    },
    () => undefined,
  );
}
/**
 * A world sprite at night with its light layer already laid on (the dusk-blue body, the warm light over it, the
 * light once more added): one picture to draw instead of three, by sprite, mirroring and how lit (in 1/20 steps).
 */
const bakedLit = new Map<string, { c: Source; x: number; y: number; w: number; h: number }>();
let pending: number[] = [];
let gap = 0;
/** Time between two night copies (prepareNight). */
const JOB_GAP_MS = 60;

/** Drop every tinted copy (the town went back to day, or the stage closed). */
export function clearNightCache(): void {
  for (const m of caches) m.clear();
  caches.clear();
  wholes.clear();
  nightGround = null;
  pooledGround = null;
  bakedLit.clear();
  generation++;
  for (const id of pending) cancelIdle(id);
  pending = [];
  window.clearTimeout(gap);
}

/** `img` multiplied by `tint`, its own transparency kept. */
function multiplied(img: Source, tint: string): HTMLCanvasElement | null {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const x = c.getContext('2d', SOFT);
  if (!x) return null;
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'multiply';
  x.fillStyle = tint;
  x.fillRect(0, 0, c.width, c.height);
  if (tint !== LIT_WARM) {
    x.globalCompositeOperation = 'color';
    x.globalAlpha = NIGHT_KEEP_COLOUR;
    x.drawImage(img, 0, 0);
    x.globalAlpha = 1;
  }
  x.globalCompositeOperation = 'destination-in';
  x.drawImage(img, 0, 0);
  return c;
}

/** World atlas `atlas` multiplied by `tint` (made the first time it is asked for). */
function wholeTinted(atlas: number, tint: string): Source | null {
  const key = `${atlas}|${tint}`;
  const hit = wholes.get(key);
  if (hit) return hit;
  const img = worldImage(atlas);
  if (!img) return null;
  const c = multiplied(img, tint);
  if (c) {
    wholes.set(key, c);
    freeze(c, (b) => wholes.set(key, b));
  }
  return c;
}

type IdleWindow = Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
function idle(run: () => void): number {
  const w = window as IdleWindow;
  return w.requestIdleCallback ? w.requestIdleCallback(run, { timeout: 400 }) : window.setTimeout(run, 16);
}
function cancelIdle(id: number): void {
  const w = window as IdleWindow;
  if (w.cancelIdleCallback) w.cancelIdleCallback(id);
  else window.clearTimeout(id);
}

/**
 * Night is coming (or the town opens at night): tint the world's atlases one by one while the browser is idle, so
 * the first night frames do not stall on it. Harmless to call again.
 */
export function prepareNight(): void {
  if (pending.length > 0) return;
  const jobs: (() => void)[] = [() => void groundAtNight()];
  WORLD_ART.atlases.forEach((_, i) => {
    if (i === litAtlas()) jobs.push(() => void wholeTinted(i, LIT_WARM));
    else if (!isShadowAtlas(i)) jobs.push(() => void wholeTinted(i, NIGHT_TINT));
  });
  const next = () => {
    const job = jobs.shift();
    if (!job) {
      pending = [];
      return;
    }
    job();
    // one copy per frame or so: the GPU draws a new canvas the first time it is used, and all of them in one frame
    // made a visible hitch when night started
    pending = [idle(() => {
      gap = window.setTimeout(next, JOB_GAP_MS);
    })];
  };
  pending = [idle(next)];
}

/** Every night copy of the world is made (the ground and each atlas). */
export function nightArtReady(): boolean {
  if (!nightGround) return false;
  return WORLD_ART.atlases.every((_, i) => isShadowAtlas(i) || wholes.has(`${i}|${i === litAtlas() ? LIT_WARM : NIGHT_TINT}`));
}

/** The ground multiplied by the dusk blue (made the first time it is asked for). */
function groundAtNight(): Source | null {
  if (nightGround) return nightGround;
  const img = groundImage();
  if (!img) return null;
  const c = multiplied(img, NIGHT_TINT);
  nightGround = c;
  if (c) freeze(c, (b) => (nightGround = b));
  return nightGround;
}

/** The atlas that holds the lit layers, and the one with the shadows (neither is tinted blue). */
function litAtlas(): number {
  const r = Object.values(WORLD_ART.lit)[0];
  return r ? r[0] : -1;
}
function isShadowAtlas(i: number): boolean {
  const r = Object.values(WORLD_ART.shadows)[0];
  return !!r && r[0] === i;
}

/**
 * New night copies of people's frames made per drawn frame: a walk shows a new frame every few frames for each of
 * the 14 people, and making a copy allocates a canvas; past this budget a frame is tinted in a shared scratch canvas
 * (no allocation) and copied for good on a later frame.
 */
const NEW_TINTS_PER_FRAME = 3;
let newTints = 0;
let scratch: HTMLCanvasElement | null = null;

/** A new frame of the stage begins (resets the budget of new night copies). */
export function beginSpriteFrame(): void {
  newTints = 0;
}

/**
 * The rect (sx, sy, sw, sh) of `img` multiplied by `tint`, as its own canvas (cached), or for this frame only in the
 * shared scratch canvas once the budget of new copies is spent.
 */
function tinted(img: Source, sx: number, sy: number, sw: number, sh: number, tint: string): Source | null {
  let m = night.get(img);
  if (!m) {
    m = new Map();
    night.set(img, m);
  }
  caches.add(m);
  const key = `${sx},${sy},${sw},${sh}`;
  const hit = m.get(key);
  if (hit) return hit;
  const w = Math.max(1, Math.ceil(sw));
  const h = Math.max(1, Math.ceil(sh));
  let c: HTMLCanvasElement;
  const keep = newTints < NEW_TINTS_PER_FRAME;
  if (keep) {
    newTints++;
    c = document.createElement('canvas');
    c.width = w;
    c.height = h;
  } else {
    if (!scratch) scratch = document.createElement('canvas');
    if (scratch.width < w || scratch.height < h) {
      scratch.width = Math.max(scratch.width, w);
      scratch.height = Math.max(scratch.height, h);
    }
    c = scratch;
  }
  const x = c.getContext('2d', SOFT);
  if (!x) return null;
  if (!keep) {
    x.globalCompositeOperation = 'source-over';
    x.globalAlpha = 1;
    x.clearRect(0, 0, w, h);
  }
  x.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  x.globalCompositeOperation = 'multiply';
  x.fillStyle = tint;
  x.fillRect(0, 0, w, h);
  x.globalCompositeOperation = 'color';
  x.globalAlpha = NIGHT_KEEP_COLOUR;
  x.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  x.globalAlpha = 1;
  // multiply painted the transparent corners too: keep only the sprite's own pixels
  x.globalCompositeOperation = 'destination-in';
  x.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  x.globalCompositeOperation = 'source-over';
  if (keep) {
    m.set(key, c);
    const cache = m;
    freeze(c, (b) => cache.set(key, b));
  }
  return c;
}

function blit(ctx: CanvasRenderingContext2D, src: Source, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number, flip: boolean): void {
  if (!flip) {
    ctx.drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh);
    return;
  }
  ctx.save();
  ctx.translate(dx + dw, dy);
  ctx.scale(-1, 1);
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, dw, dh);
  ctx.restore();
}

/** One layer of a world sprite with its anchor at world (x, y); body layers are tinted at night. */
function layer(g: G, key: WorldSpriteKey, kind: WorldLayer, x: number, y: number, flip: boolean, tint: boolean): boolean {
  const d = spriteDraw(key, kind, x, y, flip);
  if (!d) return false;
  const img = worldImage(d.atlas);
  if (!img) return false;
  if (g.pal.night && (tint || kind === 'lit')) {
    // only a copy already made: making one takes a while, and the idle queue (prepareNight) does it; until then the
    // engine lays a plain dusk over the frame (nightArtReady)
    const c = wholes.get(`${d.atlas}|${kind === 'lit' ? LIT_WARM : NIGHT_TINT}`);
    if (c) {
      blit(g.ctx, c, d.sx, d.sy, d.sw, d.sh, d.dx, d.dy, d.dw, d.dh, d.flip);
      return true;
    }
    prepareNight();
  }
  blit(g.ctx, img, d.sx, d.sy, d.sw, d.sh, d.dx, d.dy, d.dw, d.dh, d.flip);
  return true;
}

export interface SpriteOptions {
  flip?: boolean;
  /** 0..1: how much of its light layer glows at night (windows of a place: the share of its lines understood). */
  lit?: number;
  /** Under the pointer: a little brighter. */
  hover?: boolean;
}

/** A world sprite standing with its anchor at world (x, y): the body, then (at night) its light. */
export function drawSprite(g: G, key: WorldSpriteKey, x: number, y: number, o: SpriteOptions = {}): boolean {
  const flip = o.flip ?? false;
  const { ctx } = g;
  const lit = o.lit ?? 0;
  if (g.pal.night && lit > 0.01 && WORLD_ART.lit[key]) {
    const b = litSprite(key, flip, lit);
    if (b) {
      ctx.drawImage(b.c, x + b.x, y + b.y, b.w, b.h);
      if (o.hover) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.22;
        layer(g, key, 'body', x, y, flip, true);
        ctx.restore();
      }
      return true;
    }
  }
  if (!layer(g, key, 'body', x, y, flip, true)) return false;
  if (o.hover) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = g.pal.night ? 0.22 : 0.16;
    layer(g, key, 'body', x, y, flip, true);
    ctx.restore();
  }
  if (g.pal.night && lit > 0.01 && WORLD_ART.lit[key]) {
    // (only until the night copies are made) the warm light painted over the dusk-blue glass, then added once more
    // so it glows
    const k = Math.min(1, lit);
    ctx.save();
    ctx.globalAlpha = 0.85 * k;
    layer(g, key, 'lit', x, y, flip, false);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35 * k;
    layer(g, key, 'lit', x, y, flip, false);
    ctx.restore();
  }
  return true;
}

/**
 * The night picture of a sprite with its light on (see bakedLit), its top-left (x, y) and size in world px from the
 * anchor; null while the night copies of its atlases are not made yet.
 */
function litSprite(key: WorldSpriteKey, flip: boolean, lit: number): { c: Source; x: number; y: number; w: number; h: number } | null {
  const k = Math.round(Math.min(1, lit) * 20) / 20;
  const id = `${key}|${flip ? 1 : 0}|${k}`;
  const hit = bakedLit.get(id);
  if (hit) return hit;
  const body = spriteDraw(key, 'body', 0, 0, flip);
  const light = spriteDraw(key, 'lit', 0, 0, flip);
  if (!body || !light) return null;
  const bodyImg = wholes.get(`${body.atlas}|${NIGHT_TINT}`);
  const lightImg = wholes.get(`${light.atlas}|${LIT_WARM}`);
  if (!bodyImg || !lightImg) return null;
  const x0 = Math.min(body.dx, light.dx);
  const y0 = Math.min(body.dy, light.dy);
  const x1 = Math.max(body.dx + body.dw, light.dx + light.dw);
  const y1 = Math.max(body.dy + body.dh, light.dy + light.dh);
  // the body's own resolution
  const res = body.sw / body.dw;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil((x1 - x0) * res));
  c.height = Math.max(1, Math.ceil((y1 - y0) * res));
  const x = c.getContext('2d', SOFT);
  if (!x) return null;
  x.setTransform(res, 0, 0, res, -x0 * res, -y0 * res);
  blit(x, bodyImg, body.sx, body.sy, body.sw, body.sh, body.dx, body.dy, body.dw, body.dh, body.flip);
  x.globalAlpha = 0.85 * k;
  blit(x, lightImg, light.sx, light.sy, light.sw, light.sh, light.dx, light.dy, light.dw, light.dh, light.flip);
  x.globalCompositeOperation = 'lighter';
  x.globalAlpha = 0.35 * k;
  blit(x, lightImg, light.sx, light.sy, light.sw, light.sh, light.dx, light.dy, light.dw, light.dh, light.flip);
  const out = { c, x: x0, y: y0, w: c.width / res, h: c.height / res };
  bakedLit.set(id, out);
  freeze(c, (b) => bakedLit.set(id, { ...out, c: b }));
  return out;
}

/** A pool of lamp light on the ground at night: centre and radius in world px, strength 0..1. */
export interface Pool {
  x: number;
  y: number;
  r: number;
  k: number;
}

/**
 * Warm light round every lamp, on the ground: colour-dodge by an amber undoes the dusk blue where the light falls (the
 * ground gets its own colours back, warmed, instead of a pale haze over the blue). `ctx` is in world px.
 */
export function paintPools(ctx: CanvasRenderingContext2D, pools: readonly Pool[], over: boolean): void {
  ctx.save();
  ctx.globalCompositeOperation = 'color-dodge';
  for (const l of pools) {
    const r = over ? l.r * 0.85 : l.r;
    ctx.save();
    ctx.translate(l.x, l.y - (over ? 24 : 0));
    ctx.scale(1, over ? 0.75 : 0.5);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    grad.addColorStop(0, `rgba(150,106,0,${(over ? 0.38 : 0.92) * l.k})`);
    grad.addColorStop(0.5, `rgba(150,106,0,${(over ? 0.18 : 0.5) * l.k})`);
    grad.addColorStop(1, 'rgba(150,106,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.restore();
  }
  ctx.restore();
}

/**
 * The night ground with the pools of lamp light painted in once (they never move): drawing it costs one picture a
 * frame instead of a colour-dodge gradient per lamp over the whole lit area.
 */
function groundWithPools(pools: readonly Pool[]): Source | null {
  const base = nightGround;
  if (!base) return null;
  const key = pools.map((l) => `${l.x},${l.y},${l.r},${l.k}`).join(';');
  if (pooledGround?.key === key) return pooledGround.c;
  const c = document.createElement('canvas');
  c.width = base.width;
  c.height = base.height;
  const x = c.getContext('2d', SOFT);
  if (!x) return null;
  x.drawImage(base, 0, 0);
  const r = groundRect();
  const res = base.width / r.w;
  x.setTransform(res, 0, 0, res, -r.x * res, -r.y * res);
  paintPools(x, pools, false);
  pooledGround = { key, c };
  freeze(c, (b) => {
    if (pooledGround?.key === key) pooledGround = { key, c: b };
  });
  return c;
}

/** The shadow a sprite casts on the ground (drawn right after the ground, under everything that stands). */
export function drawSpriteShadow(g: G, key: WorldSpriteKey, x: number, y: number, flip = false): void {
  if (!WORLD_ART.shadows[key]) return;
  if (!g.pal.night) {
    layer(g, key, 'shadow', x, y, flip, false);
    return;
  }
  const old = g.ctx.globalAlpha;
  g.ctx.globalAlpha = old * NIGHT_SHADOW_ALPHA;
  layer(g, key, 'shadow', x, y, flip, false);
  g.ctx.globalAlpha = old;
}

/** The soft round shadow under a person's feet at world (x, y); `scale` 0.6 for the cat. */
export function drawContactShadow(g: G, x: number, y: number, scale = 1): void {
  const img = characterShadowImage();
  if (!img) return;
  const s = CHARACTER_ART.shadow;
  const k = scale / CHARACTER_ART.res;
  const old = g.ctx.globalAlpha;
  if (g.pal.night) g.ctx.globalAlpha = old * NIGHT_SHADOW_ALPHA;
  g.ctx.drawImage(img, x - s.ax * k, y - s.ay * k, s.w * k, s.h * k);
  g.ctx.globalAlpha = old;
}

/**
 * A person with their feet at world (x, y): shadow, then the frame, `drop` world px lower (the walk coming down to the
 * idle's ground line as it slows to a stand: gait.ts walkDrop; the shadow stays at the feet). False while the art is
 * not loaded.
 */
export function drawPerson(g: G, id: CharacterId, anim: CharacterAnim, dir: Dir8, t: number, x: number, y: number, drop = 0): boolean {
  const f = getFrame(id, anim, dir, t);
  if (!f) return false;
  drawContactShadow(g, x, y);
  const k = f.scale;
  const src = g.pal.night ? tinted(f.image, f.sx, f.sy, f.sw, f.sh, PEOPLE_NIGHT_TINT) : null;
  // ax is already measured from the flipped side when mirrored
  const dx = x - f.ax * k;
  const dy = y + drop - f.ay * k;
  if (src) blit(g.ctx, src, 0, 0, f.sw, f.sh, dx, dy, f.sw * k, f.sh * k, f.flip);
  else blit(g.ctx, f.image, f.sx, f.sy, f.sw, f.sh, dx, dy, f.sw * k, f.sh * k, f.flip);
  return true;
}

/**
 * The ground picture (world space), on a canvas that is still empty there: at night multiplied by the dusk blue and
 * cut back to its own outline, so the sky drawn behind it later shows round the island; with the pools of lamp light
 * (`pools`) already in it.
 */
export function drawGroundArt(g: G, pools: readonly Pool[] = []): boolean {
  const img = groundImage();
  if (!img) return false;
  const r = groundRect();
  const night = g.pal.night ? groundWithPools(pools) : null;
  g.ctx.drawImage(night || img, r.x, r.y, r.w, r.h);
  return true;
}
