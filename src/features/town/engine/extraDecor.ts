// Town 'projects' decorations (built together over many days; their data and rules live with the game data, see
// docs/town.md §10 'Album, thành tích, danh hiệu, dự án'): the stage builds every id in StageState.extraDecor that
// this table knows (three/scene/props3d.ts buildProject), and skips the others. Each entry says where each piece stands.
//
// Where they stand (data/townWorld.ts): nothing here blocks a tile (the sim does not know them), so every piece is
// on a spot nobody walks: on the pond, at the pier's end over the water, on free grass away from paths and life spots.

import type { Tile } from '../../../data/townWorld';
import { HIDEOUT_AT, HIDEOUT_HOME, HIDEOUT_LET } from '../../../data/city/hideout';

export interface ExtraDecorPiece {
  /** Where it stands on the tile grid (its ground point). */
  at: Tile;
}

export const EXTRA_DECOR: Readonly<Record<string, readonly ExtraDecorPiece[]>> = {
  // Thắp đèn quanh hồ: lotus lanterns floating round the lake's edge (between the lilies), lit at night
  'proj-lake-lights': [
    { at: { x: 21.6, y: 26.2 } },
    { at: { x: 26.9, y: 27.6 } },
    { at: { x: 23.2, y: 30.5 } },
    { at: { x: 19.9, y: 27.4 } },
    { at: { x: 25.6, y: 25.2 } },
  ],
  // Lễ hội mùa thu: the stage on the open meadow south of the plaza, between the residential lane and the school
  'proj-festival': [{ at: { x: 39.3, y: 42.6 } }],
  // Bến cá mới: the pier goes on from its old end (WORLD_PROPS pier at 29.2, 27.5, 1.05 tiles long) over the water
  'proj-pier': [{ at: { x: 28.15, y: 27.5 } }],
  // Vườn cộng đồng: two by two tiles of beds on the grass behind the boarding house
  'proj-garden': [{ at: { x: 18, y: 41 } }],
  // Tháp đồng hồ: on the grass where the lake path comes in, beside Leo's pavilion, tall enough to be seen from the plaza
  'proj-clock-tower': [{ at: { x: 32.4, y: 29.6 } }],
};

/**
 * Westbay's own pieces built the same way (not the town's projects): the learner's hideout behind Gus's hut, shut and
 * to let or lived in (data/city/hideout.ts; its model features/town/hideout/hideout3d.ts; it blocks the way:
 * engine/sim.ts PROJECT_HALF). In Westbay's coordinates.
 */
export const CITY_EXTRA_DECOR: Readonly<Record<string, readonly ExtraDecorPiece[]>> = {
  [HIDEOUT_LET]: [{ at: HIDEOUT_AT }],
  [HIDEOUT_HOME]: [{ at: HIDEOUT_AT }],
};

/** Where the pieces of a project stand: a town project's, or one of Westbay's own. */
export function extraDecorSpots(id: string): readonly ExtraDecorPiece[] | undefined {
  if (Object.hasOwn(EXTRA_DECOR, id)) return EXTRA_DECOR[id];
  return Object.hasOwn(CITY_EXTRA_DECOR, id) ? CITY_EXTRA_DECOR[id] : undefined;
}
