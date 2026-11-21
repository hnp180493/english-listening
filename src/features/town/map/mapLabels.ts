// Where the names go on the town map (features/town/map): each name tries a few spots round its anchor, the most
// important names first, and a name that would cover another one (or a control, or leave the box) is left out.
// Zooming in makes room, and the names left out come back. Pure.

import type { Box } from './mapView';

export type LabelSide = 'above' | 'below' | 'right' | 'left' | 'center';

export interface LabelCandidate {
  id: string;
  /** The anchor in the box (CSS px): a roof's top, a district's middle. */
  x: number;
  y: number;
  /** The label's size (CSS px). */
  w: number;
  h: number;
  /** Higher goes first. */
  priority: number;
  /** The spots to try, in order (default: above, below, right, left). */
  sides?: readonly LabelSide[];
}

export interface Rect {
  left: number;
  top: number;
  w: number;
  h: number;
}

export interface PlacedLabel extends Rect {
  id: string;
  side: LabelSide;
}

const DEFAULT_SIDES: readonly LabelSide[] = ['above', 'below', 'right', 'left'];

/** The box of a label of size w × h put on `side` of (x, y), `gap` px off. */
export function labelRect(x: number, y: number, w: number, h: number, side: LabelSide, gap = 4): Rect {
  switch (side) {
    case 'above':
      return { left: x - w / 2, top: y - h - gap, w, h };
    case 'below':
      return { left: x - w / 2, top: y + gap, w, h };
    case 'right':
      return { left: x + gap, top: y - h / 2, w, h };
    case 'left':
      return { left: x - w - gap, top: y - h / 2, w, h };
    default:
      return { left: x - w / 2, top: y - h / 2, w, h };
  }
}

/** Two boxes overlap (with `pad` px kept between them). */
export function overlaps(a: Rect, b: Rect, pad = 0): boolean {
  return a.left < b.left + b.w + pad && b.left < a.left + a.w + pad && a.top < b.top + b.h + pad && b.top < a.top + a.h + pad;
}

/**
 * The names that fit, each on the first of its sides that stays `margin` px inside the box and clear (by `pad` px)
 * of the names placed before it and of `blocked` (the map's own buttons). Highest priority first; among equals the
 * earlier candidate first. Candidates may share an id (other anchors for the same name): the first that fits wins.
 */
export function placeLabels(cands: readonly LabelCandidate[], box: Box, blocked: readonly Rect[] = [], opts: { gap?: number; pad?: number; margin?: number } = {}): PlacedLabel[] {
  const gap = opts.gap ?? 4;
  const pad = opts.pad ?? 3;
  const margin = opts.margin ?? 4;
  const order = cands.map((c, i) => ({ c, i })).sort((a, b) => b.c.priority - a.c.priority || a.i - b.i);
  const placed: PlacedLabel[] = [];
  const done = new Set<string>();
  for (const { c } of order) {
    if (done.has(c.id)) continue;
    for (const side of c.sides ?? DEFAULT_SIDES) {
      const r = labelRect(c.x, c.y, c.w, c.h, side, gap);
      if (r.left < margin || r.top < margin || r.left + r.w > box.w - margin || r.top + r.h > box.h - margin) continue;
      if (blocked.some((b) => overlaps(r, b, pad)) || placed.some((p) => overlaps(r, p, pad))) continue;
      placed.push({ ...r, id: c.id, side });
      done.add(c.id);
      break;
    }
  }
  return placed;
}
