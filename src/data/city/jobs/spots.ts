// Places a job goes to that are not a person's place (core/town/jobDoc.ts header §5, §9): warehouse fifteen's three
// doors, the far end of the warehouse row (where the false "warehouse fifty" sends people), the hideout's door, the end
// of the seafront jetty (where a boat sets off). A step's place may be one of these ids as well as a place of
// data/cityWorld.ts; the engine walks to the tile and checks the learner is near it.

import type { Tile } from '../../townWorld';
import { HIDEOUT_DOOR } from '../hideout';
import { JETTY_END, QUAY_LANE_X, ROW_FAR_END, W15_DOORS, warehouse } from '../warehouses';

export const JOB_SPOTS: Readonly<Record<string, Tile>> = {
  'w15-front': W15_DOORS.front,
  'w15-back': W15_DOORS.back,
  'w15-water': W15_DOORS.water,
  'row-end': ROW_FAR_END,
  // warehouse fourteen's front door, on the quay lane (a "fourteen" heard for "fifteen" goes here)
  'w14-front': { x: QUAY_LANE_X, y: warehouse(14)!.y + 1 },
  // the crossing of Quay Street and East Road (the corner where the talkback link is loudest: job "Đường truyền ngoài trời")
  'quay-east': { x: 90, y: 78 },
  hideout: HIDEOUT_DOOR,
  // the front of Twin Ovens, Poppy's bakery, right of its door: job "Phòng ghép băng" overhears Lyle rehearsing there,
  // by the shop's window and not out in Market Street (docs/gta-plan.md §20). Not a whole tile: a gather stands its
  // two round the point half a tile on (engine3d.gather), Lyle against the front under the window, Shona beside him
  // past the shop's corner, both clear of the doorstep (core/town/colliders.ts PORCH) and of Poppy at her door.
  'poppy-window': { x: 39.45, y: 15.1 },
  jetty: { x: Math.floor(JETTY_END.x), y: Math.floor(JETTY_END.y) },
};

export const isJobSpot = (id: string): boolean => Object.hasOwn(JOB_SPOTS, id);
