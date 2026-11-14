// A thing standing in front of a person goes see-through where it covers them. Pure box maths plus the clip that
// draws it (tested in cover.test.ts with a stand-in context).

import type { Box } from './scene';

/** How much of a person's box (0..1) a thing's box covers. */
export function coverShare(person: Box, thing: Box): number {
  const w = Math.min(person.x + person.w, thing.x + thing.w) - Math.max(person.x, thing.x);
  const h = Math.min(person.y + person.h, thing.y + thing.h) - Math.max(person.y, thing.y);
  return w <= 0 || h <= 0 ? 0 : (w * h) / (person.w * person.h);
}

/** A box made bigger: `side` world px left and right and at the top, `below` at the bottom. */
export function grow(b: Box, side: number, below: number): Box {
  return { x: b.x - side, y: b.y - side, w: b.w + side * 2, h: b.h + side + below };
}

type ClipCtx = Pick<CanvasRenderingContext2D, 'beginPath' | 'rect' | 'clip'>;

/**
 * Clip to `outer` minus every one of `holes`. Each hole is cut by a clip of its own (successive clips intersect),
 * never by one even-odd path of all of them: there a spot covered by two holes would count as inside again, and
 * the thing would be drawn solid exactly where two people overlap behind it.
 */
export function clipOutside(ctx: ClipCtx, outer: Box, holes: readonly Box[]): void {
  ctx.beginPath();
  ctx.rect(outer.x, outer.y, outer.w, outer.h);
  ctx.clip();
  if (holes.length === 0) return;
  // a frame round the outer box and every hole: each hole lies inside it, so frame-with-hole (even-odd) = frame \ hole
  let x0 = outer.x;
  let y0 = outer.y;
  let x1 = outer.x + outer.w;
  let y1 = outer.y + outer.h;
  for (const h of holes) {
    x0 = Math.min(x0, h.x);
    y0 = Math.min(y0, h.y);
    x1 = Math.max(x1, h.x + h.w);
    y1 = Math.max(y1, h.y + h.h);
  }
  for (const h of holes) {
    ctx.beginPath();
    ctx.rect(x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2);
    ctx.rect(h.x, h.y, h.w, h.h);
    ctx.clip('evenodd');
  }
}

/** Clip to the union of `boxes` (one path, non-zero: a spot under two boxes is inside). */
export function clipInside(ctx: ClipCtx, boxes: readonly Box[]): void {
  ctx.beginPath();
  for (const b of boxes) ctx.rect(b.x, b.y, b.w, b.h);
  ctx.clip();
}
