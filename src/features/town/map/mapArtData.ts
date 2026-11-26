// The town map's small game pictures as data (features/town/map): their colours (GAME ART: the overlay's, passed
// inline, never in CSS; docs/design-system.md "Thị trấn: game art") and the activities' icons.

import { BookOpen, Coffee, Ear, Search, Package, Egg, Heart, UserRound, Fish, Gift, Shirt, Sprout, Trophy, type LucideIcon } from 'lucide-react';
import type { ActivityId } from '../activities/types';
import type { Marker } from '../engine/stage';

export const MAP_ART = {
  /** "!": lines not understood yet (the overlay's amber bubble). */
  fresh: '#ffb020',
  freshInk: '#3a2500',
  /** An episode to hear (violet) / due for its re-listen (green). */
  story: '#6d6af0',
  relisten: '#1f9d6b',
  rim: '#ffffff',
  /** The player's arrow. */
  me: '#6d6af0',
  meRim: '#ffffff',
  /** Residents on the minimap and the ring of a picked thing. */
  dotRim: '#ffffff',
  /** The way to the quest followed (engine/draw/guide.ts: the same gold as on the ground). */
  guide: '#ffc83d',
  guideRim: '#3d2a00',
} as const;

/** The icon of each activity on the map (as in the HUD's "Chơi" menu). */
export const MAP_ACTIVITY_ICONS: Readonly<Record<ActivityId, LucideIcon>> = { fish: Fish, farm: Sprout, eggs: Egg, wardrobe: Shirt, album: Trophy, gifts: Gift, journal: BookOpen, love: Heart, character: UserRound, cafe: Coffee, case: Search, delivery: Package, listen: Ear, season: BookOpen };

/** A resident's marker colour on the minimap ring (null: no ring). */
export function markerColor(marker: Marker | null): string | null {
  if (marker === 'new') return MAP_ART.fresh;
  if (marker === 'story') return MAP_ART.story;
  if (marker === 'relisten') return MAP_ART.relisten;
  return null;
}
