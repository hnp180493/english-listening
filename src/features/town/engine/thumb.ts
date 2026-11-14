// A small picture of one thing of the town (a place, a decoration) for the build panel: the same rendered sprite
// the world shows (art/world.ts), in daylight, fitted into the box.

import { worldImage } from '../art/world';
import { WORLD_ART, type WorldSpriteKey } from '../art/world.data';
import { PLACE_IDS, type DecorationId, type PlaceId } from '../../../data/townWorld';

const DECOR_THUMB: Readonly<Record<DecorationId, WorldSpriteKey>> = {
  lamps1: 'decor/lamp/0',
  lamps2: 'decor/lamp/1',
  flowers: 'decor/flowers',
  benches: 'decor/bench/s',
  blossom: 'decor/blossom',
  lights: 'decor/lights/0',
  lilies: 'decor/lily/0',
  stall: 'decor/stall',
  fountain: 'decor/fountain/1',
  balloons: 'decor/balloons',
  flags: 'decor/flag/0',
  cat: 'cat/sit/SE/0',
};

/** The sprite that pictures a place or a decoration; null for an unknown id. */
export function thumbKey(id: string): WorldSpriteKey | null {
  if ((PLACE_IDS as readonly string[]).includes(id)) return `place/${id as PlaceId}` as WorldSpriteKey;
  return DECOR_THUMB[id as DecorationId] ?? null;
}

/**
 * Paint the picture of a place or a decoration into a canvas of `cssW` × `cssH` CSS pixels. False when the id is
 * unknown, the art is not loaded yet or the canvas cannot be drawn on.
 */
export function paintThumb(canvas: HTMLCanvasElement, id: string, cssW: number, cssH: number): boolean {
  if (id === 'lights') return paintLights(canvas, cssW, cssH);
  const key = thumbKey(id);
  const ctx = canvas.getContext('2d');
  if (!key || !ctx) return false;
  const [atlas, sx, sy, sw, sh] = WORLD_ART.sprites[key];
  const img = worldImage(atlas);
  if (!img) return false;
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  // small things (a lily pad, the cat) are not blown up past their size in town at a close zoom
  const res = WORLD_ART.atlases[atlas].res;
  const k = Math.min((cssW - 2) / sw, (cssH - 2) / sh, 2.2 / res);
  const w = sw * k;
  const h = sh * k;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, sw, sh, (cssW - w) / 2, (cssH - h) / 2 + (cssH - h) * 0.15, w, h);
  return true;
}

/** The string's bulbs, as rendered in town (game art, like palette.ts). */
const BULBS = ['#f27aa6', '#7cc3f2', '#ffd45c', '#9ee07a'];
const CABLE = '#3d4256';

/**
 * String lights: the whole string is a long thin diagonal that shrinks to a dotted line in a small box, so the
 * thumbnail shows what it is: two of its poles with a sagging string of bulbs between them.
 */
function paintLights(canvas: HTMLCanvasElement, cssW: number, cssH: number): boolean {
  const ctx = canvas.getContext('2d');
  const pole = WORLD_ART.sprites['decor/lightPole'];
  if (!ctx || !pole) return false;
  const [atlas, sx, sy, sw, sh] = pole;
  const img = worldImage(atlas);
  if (!img) return false;
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  ctx.imageSmoothingQuality = 'high';
  const k = (cssH - 6) / sh;
  const w = sw * k;
  const h = sh * k;
  const left = 8;
  const right = cssW - 8;
  const top = 3 + h * 0.04;
  // the cable: from one pole's top to the other's, sagging in the middle
  const sag = cssH * 0.34;
  const at = (u: number) => ({ x: left + (right - left) * u, y: top + 4 * sag * u * (1 - u) });
  ctx.strokeStyle = CABLE;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) {
    const p = at(i / 20);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
  for (let i = 1; i < 8; i++) {
    const p = at(i / 8);
    ctx.fillStyle = BULBS[i % BULBS.length];
    ctx.beginPath();
    ctx.arc(p.x, p.y + 2.6, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const x of [left, right]) ctx.drawImage(img, sx, sy, sw, sh, x - w / 2, 3, w, h);
  return true;
}
