// Where each courtship scene happens in the town (docs/town.md §15): the stage takes the two there before the scene
// plays (a dip, then the one courted beside the player), so a date at the pier happens at the pier ("mày làm game
// cũng phải logic tí chứ"). A scene at a place that is still an empty lot waits until it is built. Daily life and the
// children's scenes happen at home (no move).

/** A place's door (data/town TOWN_PLACES id), an activity's spot, or a part of town (data/townWorld WORLD_DISTRICTS). */
export type SceneSpot = { kind: 'place'; id: string } | { kind: 'activity'; id: 'fish' | 'farm' } | { kind: 'district'; id: string };

const place = (id: string): SceneSpot => ({ kind: 'place', id });
const district = (id: string): SceneSpot => ({ kind: 'district', id });
const PIER: SceneSpot = { kind: 'activity', id: 'fish' };
const FARM: SceneSpot = { kind: 'activity', id: 'farm' };
const PLAZA = district('plaza');

export const SCENE_SPOTS: Readonly<Record<string, SceneSpot>> = {
  'cafe-confess': place('cafe'),
  'cafe-date-1': PIER,
  'cafe-date-2': place('cinema'),
  'cafe-date-3': PLAZA,
  'cafe-proposal': place('cafe'),
  'friend-confess': place('friend'),
  'friend-date-1': place('cinema'),
  'friend-date-2': district('woods'),
  'friend-date-3': place('station'),
  'friend-proposal': place('friend'),
  'office-confess': place('office'),
  'office-date-1': district('park'),
  'office-date-2': PIER,
  'office-date-3': district('fields'),
  'office-proposal': place('office'),
  'clinic-confess': place('clinic'),
  'clinic-date-1': district('park'),
  'clinic-date-2': place('cinema'),
  'clinic-date-3': district('orchard'),
  'clinic-proposal': place('clinic'),
  'park-confess': district('park'),
  'park-date-1': place('cafe'),
  'park-date-2': PIER,
  'park-date-3': PLAZA,
  'park-proposal': district('park'),
  'cinema-confess': place('cinema'),
  'cinema-date-1': district('park'),
  'cinema-date-2': PIER,
  'cinema-date-3': place('cinema'),
  'cinema-proposal': place('cinema'),
  'square-confess': PLAZA,
  'square-date-1': place('cafe'),
  'square-date-2': PLAZA,
  'square-date-3': place('cinema'),
  'square-proposal': PLAZA,
  'shop-confess': place('shop'),
  'shop-date-1': place('shop'),
  'shop-date-2': PIER,
  'shop-date-3': place('cinema'),
  'shop-proposal': place('shop'),
  'station-confess': place('station'),
  'station-date-1': district('park'),
  'station-date-2': place('station'),
  'station-date-3': PIER,
  'station-proposal': place('station'),
  'board-confess': place('board'),
  'board-date-1': FARM,
  'board-date-2': place('cafe'),
  'board-date-3': district('park'),
  'board-proposal': place('board'),
  'school-confess': place('school'),
  'school-date-1': place('cafe'),
  'school-date-2': place('school'),
  'school-date-3': place('cinema'),
  'school-proposal': place('school'),
};

/** Every wedding is on the plaza, with the town round it. */
export const WEDDING_SPOT: SceneSpot = PLAZA;

/** Where a scene happens (null: at home, nowhere to go). Vows are on the plaza. */
export function sceneSpot(sceneId: string): SceneSpot | null {
  if (sceneId.endsWith('-vows')) return WEDDING_SPOT;
  return SCENE_SPOTS[sceneId] ?? null;
}
