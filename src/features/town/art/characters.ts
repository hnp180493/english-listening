// The people of "Thị trấn" as sprites: Kenney Mini Characters (CC0) rendered by scripts/town-art (`npm run art:town`)
// into one WebP atlas per person (characters/*.webp) and a manifest (characters.data.ts). This file picks the frame
// for a person, an animation, a direction on the screen and a time, and draws it. The pure part (directions, frame
// choice, portrait CSS) is tested in characters.test.ts; loading and drawing need a browser.
//
// Directions are SCREEN directions: S = towards the viewer, E = to the right… The walker steps along the tile grid,
// and each of its eight steps is one of them (dirFromTileVector). Five are rendered (S, SE, E, NE, N); SW, W and NW
// are SE, E and NE drawn mirrored, which is exact for these models (checked against real renders, the contact
// sheet's "-mirror" page). The anchor of every frame is the point between the feet, on the ground.

import { CAST, type CharacterId } from './cast';
import { CHARACTER_ART, type CharacterArtData } from './characters.data';

export type { CharacterId } from './cast';

export type Dir8 = 'S' | 'SE' | 'E' | 'NE' | 'N' | 'NW' | 'W' | 'SW';
/** idle and walk loop; yes (two nods), no (a head shake) and wave (the near arm up beside the head) play once. */
export type CharacterAnim = 'idle' | 'walk' | 'yes' | 'no' | 'wave';
export type PortraitMood = 'neutral' | 'happy';

/** The eight directions going round the screen, each 45° on the tile grid from the next. */
export const DIRS8: readonly Dir8[] = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW'];
/** The mirrored directions and the rendered direction each one flips. */
export const MIRRORED: Readonly<Partial<Record<Dir8, Dir8>>> = { SW: 'SE', W: 'E', NW: 'NE' };

/** By angle on the tile grid, starting along +x (a step to tile x+1 goes down-right on the screen: SE). */
const BY_TILE_ANGLE: readonly Dir8[] = ['SE', 'S', 'SW', 'W', 'NW', 'N', 'NE', 'E'];

/** The direction of a move on the tile grid (x runs down-right, y down-left, engine/iso.ts); null for no move. */
export function dirFromTileVector(dx: number, dy: number): Dir8 | null {
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return null;
  const turn = Math.atan2(dy, dx) / (Math.PI / 4);
  return BY_TILE_ANGLE[((Math.round(turn) % 8) + 8) % 8];
}

/** The direction of octant `k` of the tile grid (sim.ts OCTANTS: 0 = +x … by angle). */
export function dirFromOctant(k: number): Dir8 {
  return BY_TILE_ANGLE[((Math.round(k) % 8) + 8) % 8];
}

/** The direction of a move on the screen (world pixels, y down); null for no move. */
export function dirFromScreen(sx: number, sy: number): Dir8 | null {
  // world px → tile units: a tile is 64 × 32 px
  const a = sx / 32;
  const b = sy / 16;
  return dirFromTileVector((a + b) / 2, (b - a) / 2);
}

/** For the engine's left / right facing (sim.ts `facing`): three-quarter front views. */
export function dirFromFacing(facing: 1 | -1): Dir8 {
  return facing > 0 ? 'SE' : 'SW';
}

/** Steps between two directions round the ring (0…4). */
function ringDistance(a: Dir8, b: Dir8): number {
  const d = Math.abs(DIRS8.indexOf(a) - DIRS8.indexOf(b));
  return Math.min(d, 8 - d);
}

/**
 * Which rendered direction to draw for `dir`, and whether flipped. An animation rendered in fewer directions (the
 * emotes: SE only) uses the nearest it has, mirrored ones included; on a tie the one that shows more of the face.
 */
export function resolveDir(rendered: readonly string[], dir: Dir8): { dir: Dir8; flip: boolean } {
  const has = (d: Dir8) => rendered.includes(d);
  if (has(dir)) return { dir, flip: false };
  const m = MIRRORED[dir];
  if (m && has(m)) return { dir: m, flip: true };
  let best: { dir: Dir8; flip: boolean; score: number } | null = null;
  for (const d of DIRS8) {
    const src = has(d) ? d : MIRRORED[d] && has(MIRRORED[d]!) ? MIRRORED[d]! : null;
    if (!src) continue;
    const score = ringDistance(d, dir) * 10 + ringDistance(d, 'S');
    if (!best || score < best.score) best = { dir: src, flip: src !== d, score };
  }
  if (!best) throw new Error('animation without directions');
  return { dir: best.dir, flip: best.flip };
}

/**
 * Frame number at time `t` seconds. A loop's n frames are spread evenly over one cycle and wrap; a one-shot's run
 * from its first pose (t = 0) to its last (t = duration, the rest pose) and then hold it.
 */
export function frameAt(spec: { frames: number; duration: number; loop: boolean }, t: number): number {
  const n = spec.frames;
  if (spec.loop) {
    // (a hair over: a time that is a whole number of frames in exact maths is that frame, not the one before)
    const k = Math.floor((t / spec.duration) * n + 1e-6);
    return ((k % n) + n) % n;
  }
  return Math.max(0, Math.min(n - 1, Math.round((t / spec.duration) * (n - 1))));
}

/** A frame inside an atlas: source rect, and the feet (ax, ay) inside it as drawn (flipped when `flip`). */
export interface FrameRect {
  index: number;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  ax: number;
  ay: number;
  flip: boolean;
}

/** Where an animation's frames start in a person's frame list (manifest order: anim → direction → frame). */
function animOffset(data: CharacterArtData, anim: string): number {
  let at = 0;
  for (const [name, spec] of Object.entries(data.anims)) {
    if (name === anim) return at;
    at += spec.dirs.length * spec.frames;
  }
  throw new Error(`unknown animation ${anim}`);
}

/** Pure: the frame of person `id` playing `anim` towards `dir` at `t` seconds. */
export function frameRect(data: CharacterArtData, id: CharacterId, anim: CharacterAnim, dir: Dir8, t: number): FrameRect {
  const spec = data.anims[anim];
  if (!spec) throw new Error(`unknown animation ${anim}`);
  const r = resolveDir(spec.dirs, dir);
  const index = animOffset(data, anim) + spec.dirs.indexOf(r.dir) * spec.frames + frameAt(spec, t);
  const f = data.chars[id].frames;
  const o = index * 6;
  const sw = f[o + 2];
  const ax = f[o + 4];
  return { index, sx: f[o], sy: f[o + 1], sw, sh: f[o + 3], ax: r.flip ? sw - ax : ax, ay: f[o + 5], flip: r.flip };
}

/**
 * The engine plays each emote a little faster or slower, 1 ± this (a second head shake is never the very same one):
 * the emotes have frames enough for 15 a second at the slowest (characters.test.ts).
 */
export const ACT_TEMPO = 0.1;

/** How long one cycle (loop) or one play (emote) of an animation lasts, in seconds. */
export function animDuration(anim: CharacterAnim, data: CharacterArtData = CHARACTER_ART): number {
  return data.anims[anim].duration;
}

/**
 * The walk cycle in step with the engine's walk phase (sim.ts: `phase` grows with the distance walked, one cycle per
 * 2π = one stride, engine/gait.ts), so the feet do not slide: pass the result as `t` with anim 'walk'.
 */
export function walkTime(phase: number, data: CharacterArtData = CHARACTER_ART): number {
  // legs together (a multiple of π) a hair short of it in floating point is still that frame, not the one before
  const k = phase / Math.PI;
  const r = Math.round(k);
  const p = Math.abs(k - r) < 1e-6 ? r * Math.PI : phase;
  return (p / (Math.PI * 2)) * data.anims.walk.duration;
}

/**
 * CSS for a portrait as a background (DOM use, e.g. the conversation panel): `size` CSS px square. The atlas is
 * 2× (192 px per portrait), sharp at 96 px and below on a 2× screen.
 */
export function portraitStyle(
  id: CharacterId,
  mood: PortraitMood,
  size: number,
  data: CharacterArtData = CHARACTER_ART,
): { backgroundImage: string; backgroundSize: string; backgroundPosition: string; backgroundRepeat: string } {
  const col = data.portraits.order.indexOf(id);
  const row = Math.max(0, data.portraits.moods.indexOf(mood));
  return {
    backgroundImage: `url("${data.portraits.url}")`,
    backgroundSize: `${data.portraits.order.length * size}px ${data.portraits.moods.length * size}px`,
    backgroundPosition: `${-col * size}px ${-row * size}px`,
    backgroundRepeat: 'no-repeat',
  };
}

/** The name shown for a person ("Bạn" for the player). */
export function characterName(id: CharacterId): string {
  return CAST[id].name;
}

// ---- browser side: images ------------------------------------------------------------------------------------------

/** A decoded picture of the art: an ImageBitmap where the browser has them, else the image element. */
export type ArtImage = HTMLImageElement | ImageBitmap;

const images = new Map<string, ArtImage>();
let loading: Promise<void> | null = null;
/** Bumped by releaseCharacterArt: a load still on its way then is not kept. */
let generation = 0;

/** Free a decoded picture now (an ImageBitmap holds its pixels until closed; an image element is left to the browser). */
export function closeArtImage(img: ArtImage): void {
  if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap) img.close();
}

/**
 * Load and decode a picture of the art, kept as an ImageBitmap: an <img> is decoded lazily, and the canvas decoded the
 * whole WebP again (40–100 ms in one frame) whenever the browser had dropped its decoded copy or the zoom asked for a
 * new scale of it (the start of a conversation); a bitmap stays decoded.
 */
export function loadArtImage(url: string): Promise<ArtImage> {
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  return img.decode().then(() => (typeof createImageBitmap === 'function' ? createImageBitmap(img).catch(() => img) : img));
}

/**
 * Load every atlas once (about 7 MB of WebP, see LICENSE-kenney.txt). Resolves when all are decoded; until then
 * getFrame returns null, so the game can draw something simpler. A failed load can be retried by calling again.
 */
export function loadCharacterArt(data: CharacterArtData = CHARACTER_ART): Promise<void> {
  if (loading) return loading;
  const urls = [...Object.values(data.chars).map((c) => c.url), data.shadow.url, data.portraits.url];
  const gen = generation;
  loading = Promise.all(
    urls.map((u) =>
      images.has(u)
        ? undefined
        : loadArtImage(u).then((img) => {
            if (gen === generation) images.set(u, img);
            else closeArtImage(img);
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

/**
 * Let go of the decoded atlases (about 130 MB of pixels as bitmaps, which the browser cannot drop by itself under
 * memory pressure): the town page calls this a while after the learner leaves it (load.ts holdTownArt). The next
 * visit loads them again (from the browser's cache).
 */
export function releaseCharacterArt(): void {
  generation++;
  for (const img of images.values()) closeArtImage(img);
  images.clear();
  loading = null;
}

/** True once loadCharacterArt has finished (the images stay cached for the session, across visits of the page). */
export function characterArtReady(data: CharacterArtData = CHARACTER_ART): boolean {
  return images.has(data.shadow.url) && Object.values(data.chars).every((c) => images.has(c.url));
}

/** The shared contact shadow drawn under every person (and, smaller, under the cat); null until loaded. */
export function characterShadowImage(data: CharacterArtData = CHARACTER_ART): ArtImage | null {
  return images.get(data.shadow.url) ?? null;
}

export interface SpriteFrame extends FrameRect {
  image: ArtImage;
  /** World px per atlas px (1 / res): draw sw × scale wide at camera zoom 1. */
  scale: number;
}

/** The frame to draw, or null while the atlases are not loaded. */
export function getFrame(id: CharacterId, anim: CharacterAnim, dir: Dir8, t: number, data: CharacterArtData = CHARACTER_ART): SpriteFrame | null {
  const image = images.get(data.chars[id].url);
  if (!image) return null;
  return { ...frameRect(data, id, anim, dir, t), image, scale: 1 / data.res };
}

/**
 * Draw a person with their feet at (x, y) in world pixels (the context already set to world space): the contact
 * shadow, then the frame. Returns false (nothing drawn) while the atlases are not loaded.
 */
export function drawCharacterSprite(
  ctx: CanvasRenderingContext2D,
  id: CharacterId,
  anim: CharacterAnim,
  dir: Dir8,
  t: number,
  x: number,
  y: number,
  data: CharacterArtData = CHARACTER_ART,
): boolean {
  const f = getFrame(id, anim, dir, t, data);
  const shadow = images.get(data.shadow.url);
  if (!f || !shadow) return false;
  const k = f.scale;
  const s = data.shadow;
  ctx.drawImage(shadow, x - s.ax * k, y - s.ay * k, s.w * k, s.h * k);
  if (f.flip) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(-1, 1);
    // flipped: the anchor measured from the right edge becomes the left one again
    ctx.drawImage(f.image, f.sx, f.sy, f.sw, f.sh, -(f.sw - f.ax) * k, -f.ay * k, f.sw * k, f.sh * k);
    ctx.restore();
  } else {
    ctx.drawImage(f.image, f.sx, f.sy, f.sw, f.sh, x - f.ax * k, y - f.ay * k, f.sw * k, f.sh * k);
  }
  return true;
}
