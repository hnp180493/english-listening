// Town 'projects' decorations (built together over many days; their data and rules live with the game data, see
// docs/town.md §10 'Album, thành tích, danh hiệu, dự án'): the stage builds every id in StageState.extraDecor that
// this table knows (three/scene/props3d.ts buildProject), and skips the others. Each entry says where each piece stands.
//
// Where they stand (data/townWorld.ts): nothing here blocks a tile (the sim does not know them), so every piece is
// on a spot nobody walks: on the pond, at the pier's end over the water, on free grass away from paths and life spots.

import type { Tile } from '../../../data/townWorld';

export interface ExtraDecorPiece {
  /** Where it stands on the tile grid (its ground point). */
  at: Tile;
}

export const EXTRA_DECOR: Readonly<Record<string, readonly ExtraDecorPiece[]>> = {
  // Thắp đèn quanh hồ: lotus lanterns floating round the lake's edge (between the lilies), lit at night
  'proj-lake-lights': [
    { at: { x: 5.6, y: 14.2 } },
    { at: { x: 10.9, y: 15.6 } },
    { at: { x: 7.2, y: 18.5 } },
    { at: { x: 3.9, y: 15.4 } },
    { at: { x: 9.6, y: 13.2 } },
  ],
  // Lễ hội mùa thu: the stage on the open meadow south of the plaza, between the residential lane and the school
  'proj-festival': [{ at: { x: 23.3, y: 30.6 } }],
  // Bến cá mới: the pier goes on from its old end (WORLD_PROPS pier at 13.2, 15.5, 1.05 tiles long) over the water
  'proj-pier': [{ at: { x: 12.15, y: 15.5 } }],
  // Vườn cộng đồng: two by two tiles of beds on the grass behind the boarding house
  'proj-garden': [{ at: { x: 2, y: 29 } }],
  // Tháp đồng hồ: on the grass where the lake path comes in, beside Leo's pavilion, tall enough to be seen from the plaza
  'proj-clock-tower': [{ at: { x: 16.4, y: 17.6 } }],
};
