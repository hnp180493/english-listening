// How tall each place stands, read from its rendered sprite (art/world.ts): picking (pick.ts), the name tag over a
// place and the camera's build show only need that height.

import { worldPlace, type PlaceId, type WorldPlace } from '../../../data/townWorld';
import { lotSpriteKey, placeSpriteKey, spriteTop } from '../art/world';
import { TILE_H } from './iso';

/**
 * A sprite's top above its anchor (the middle of the footprint) is the box's own height plus half the footprint's
 * depth on the screen: take that half away to get the height of the box standing on the footprint.
 */
function boxHeight(p: Pick<WorldPlace, 'w' | 'd'>, top: number): number {
  return Math.max(16, Math.round(top - ((p.w + p.d) * TILE_H) / 4));
}

/** Top of a built place above the ground, in world pixels (walls, roof and whatever stands on it). */
export function placeHeight(id: PlaceId): number {
  const p = worldPlace(id);
  if (!p) return 0;
  return boxHeight(p, spriteTop(placeSpriteKey(id)));
}

/** Top of an empty lot's construction site above the ground (its wooden frame). */
export function lotHeight(p: Pick<WorldPlace, 'w' | 'd'>): number {
  return boxHeight(p, spriteTop(lotSpriteKey(p, 'site')));
}
