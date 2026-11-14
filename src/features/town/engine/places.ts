// How each place looks, as data: its colours (daylight values, see palette.ts: game art) and how tall it stands.
// The drawing itself is in draw/buildings.ts; picking (pick.ts) only needs the height.

import type { PlaceId } from '../../../data/townWorld';

export type RoofKind = 'gableX' | 'gableY' | 'hip' | 'flat' | 'pavilion' | 'glass';

export interface PlaceLook {
  wall: string;
  roof: string;
  roofKind: RoofKind;
  /** Height of the walls, in world pixels. */
  wallH: number;
  /** Height of the roof above the walls. */
  roofH: number;
  door: string;
  /** Accent of the sign, the awning, the empty lot's signboard. */
  accent: string;
}

export const PLACE_LOOK: Readonly<Record<PlaceId, PlaceLook>> = {
  square: { wall: '#fbf1dc', roof: '#f2b24c', roofKind: 'pavilion', wallH: 34, roofH: 26, door: '#b07a4f', accent: '#f2b24c' },
  cafe: { wall: '#fbf1dc', roof: '#3fb7a6', roofKind: 'gableX', wallH: 36, roofH: 30, door: '#c9744a', accent: '#f58fb0' },
  friend: { wall: '#fff0e6', roof: '#f58fb0', roofKind: 'gableY', wallH: 34, roofH: 30, door: '#7a5cc0', accent: '#f58fb0' },
  home: { wall: '#fdf3e0', roof: '#8f73d6', roofKind: 'gableX', wallH: 34, roofH: 30, door: '#e0795b', accent: '#8f73d6' },
  shop: { wall: '#fff4d9', roof: '#f2a541', roofKind: 'hip', wallH: 36, roofH: 26, door: '#5aa469', accent: '#ef6b5b' },
  office: { wall: '#e9eff9', roof: '#5b8fd9', roofKind: 'flat', wallH: 64, roofH: 6, door: '#3f6fb8', accent: '#5b8fd9' },
  school: { wall: '#f8dcc0', roof: '#e0685a', roofKind: 'gableY', wallH: 38, roofH: 30, door: '#8a5a3a', accent: '#e0685a' },
  station: { wall: '#e6f2f5', roof: '#4f9fd8', roofKind: 'hip', wallH: 34, roofH: 20, door: '#2f6f9f', accent: '#f2b24c' },
  clinic: { wall: '#ffffff', roof: '#63c7b2', roofKind: 'hip', wallH: 36, roofH: 24, door: '#63c7b2', accent: '#ef5d7a' },
  cinema: { wall: '#8d6fd6', roof: '#6a51b5', roofKind: 'flat', wallH: 50, roofH: 6, door: '#3b2d6b', accent: '#ffcf6a' },
  phone: { wall: '#eaf4ff', roof: '#3f7fe0', roofKind: 'flat', wallH: 40, roofH: 6, door: '#3f7fe0', accent: '#3f7fe0' },
  park: { wall: '#d6f3ea', roof: '#a9e3d2', roofKind: 'glass', wallH: 26, roofH: 22, door: '#ffffff', accent: '#6fbf63' },
  board: { wall: '#f3ead2', roof: '#7ab66a', roofKind: 'gableX', wallH: 32, roofH: 26, door: '#8a5a3a', accent: '#c79a62' },
};

/** Top of a built place above the ground (walls + roof), in world pixels. */
export function placeHeight(id: PlaceId): number {
  const l = PLACE_LOOK[id];
  return l.wallH + l.roofH;
}

/** An empty lot is a fence and a signpost. */
export const LOT_HEIGHT = 30;
