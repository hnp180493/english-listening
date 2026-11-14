// Drawing the rendered art (src/features/town/art) on the stage: the ground, the sprites of the world with their
// shadow and light layers, the people and the cat, by day and by night.
//
// The art is lit for daylight. NIGHT multiplies every picture by a dusk blue (game art, see palette.ts), a
// little lighter for the people so faces read, and lays back part of each picture's own colour. The "lit" layers (windows, lamp bulbs, string lights) are
// warmed to amber and laid over with a screen blend, so they glow; the engine adds pools of lamp light on the
// ground. The world's atlases are tinted whole, once, ahead of the first night frame when the browser is idle
// (prepareNight); a person's frame is tinted into a small canvas of its own the first time it is drawn. Everything
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

type Source = HTMLImageElement | HTMLCanvasElement;

const night = new WeakMap<Source, Map<string, HTMLCanvasElement>>();
const caches = new Set<Map<string, HTMLCanvasElement>>();
/** Whole atlases multiplied by a colour, by atlas and colour. */
const wholes = new Map<string, HTMLCanvasElement>();
/** The ground picture for the night (tinted once, like the atlases). */
let nightGround: HTMLCanvasElement | null = null;
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
  for (const id of pending) cancelIdle(id);
  pending = [];
  window.clearTimeout(gap);
}

/** `img` multiplied by `tint`, its own transparency kept. */
function multiplied(img: Source, tint: string): HTMLCanvasElement | null {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const x = c.getContext('2d');
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
function wholeTinted(atlas: number, tint: string): HTMLCanvasElement | null {
  const key = `${atlas}|${tint}`;
  const hit = wholes.get(key);
  if (hit) return hit;
  const img = worldImage(atlas);
  if (!img) return null;
  const c = multiplied(img, tint);
  if (c) wholes.set(key, c);
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
function groundAtNight(): HTMLCanvasElement | null {
  if (nightGround) return nightGround;
  const img = groundImage();
  if (!img) return null;
  nightGround = multiplied(img, NIGHT_TINT);
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

/** The rect (sx, sy, sw, sh) of `img` multiplied by `tint`, as its own canvas (cached). */
function tinted(img: Source, sx: number, sy: number, sw: number, sh: number, tint: string): HTMLCanvasElement | null {
  let m = night.get(img);
  if (!m) {
    m = new Map();
    night.set(img, m);
  }
  caches.add(m);
  const key = `${sx},${sy},${sw},${sh}`;
  const hit = m.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(sw));
  c.height = Math.max(1, Math.ceil(sh));
  const x = c.getContext('2d');
  if (!x) return null;
  x.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  x.globalCompositeOperation = 'multiply';
  x.fillStyle = tint;
  x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'color';
  x.globalAlpha = NIGHT_KEEP_COLOUR;
  x.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  x.globalAlpha = 1;
  // multiply painted the transparent corners too: keep only the sprite's own pixels
  x.globalCompositeOperation = 'destination-in';
  x.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  m.set(key, c);
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
  if (!layer(g, key, 'body', x, y, flip, true)) return false;
  const { ctx } = g;
  if (o.hover) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = g.pal.night ? 0.22 : 0.16;
    layer(g, key, 'body', x, y, flip, true);
    ctx.restore();
  }
  const lit = o.lit ?? 0;
  if (g.pal.night && lit > 0.01 && WORLD_ART.lit[key]) {
    // the warm light painted over the dusk-blue glass, then added once more so it glows
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

/** A person with their feet at world (x, y): shadow, then the frame. False while the art is not loaded. */
export function drawPerson(g: G, id: CharacterId, anim: CharacterAnim, dir: Dir8, t: number, x: number, y: number): boolean {
  const f = getFrame(id, anim, dir, t);
  if (!f) return false;
  drawContactShadow(g, x, y);
  const k = f.scale;
  const src = g.pal.night ? tinted(f.image, f.sx, f.sy, f.sw, f.sh, PEOPLE_NIGHT_TINT) : null;
  // ax is already measured from the flipped side when mirrored
  const dx = x - f.ax * k;
  const dy = y - f.ay * k;
  if (src) blit(g.ctx, src, 0, 0, f.sw, f.sh, dx, dy, f.sw * k, f.sh * k, f.flip);
  else blit(g.ctx, f.image, f.sx, f.sy, f.sw, f.sh, dx, dy, f.sw * k, f.sh * k, f.flip);
  return true;
}

/**
 * The ground picture (world space), on a canvas that is still empty there: at night multiplied by the dusk blue and
 * cut back to its own outline, so the sky drawn behind it later shows round the island.
 */
export function drawGroundArt(g: G): boolean {
  const img = groundImage();
  if (!img) return false;
  const r = groundRect();
  g.ctx.drawImage((g.pal.night && nightGround) || img, r.x, r.y, r.w, r.h);
  return true;
}
