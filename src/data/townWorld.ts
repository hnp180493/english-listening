// "Thị trấn": the layout of the isometric town. Pure data: what the ground is, where each place stands, where its
// resident waits, and the fixed spots of every decoration the learner can buy. The game rules (xu, lines, levels)
// live elsewhere (src/data/town.ts, src/core/town); the drawing lives in src/features/town/engine.
//
// The grid is 21 × 21 tiles, x = column, y = row, both from 0. On screen the tile (0,0) is the far (top) corner, x
// grows down-right and y grows down-left, so a building shows its +x and +y faces: every door is on one of those
// two faces and every resident stands in front of it, never behind a taller thing.

export type PlaceId =
  | 'square'
  | 'cafe'
  | 'friend'
  | 'home'
  | 'shop'
  | 'office'
  | 'school'
  | 'station'
  | 'clinic'
  | 'cinema'
  | 'phone'
  | 'park'
  | 'board';

export type DecorationId =
  | 'lamps1'
  | 'flowers'
  | 'benches'
  | 'blossom'
  | 'lamps2'
  | 'lights'
  | 'lilies'
  | 'stall'
  | 'fountain'
  | 'balloons'
  | 'flags'
  | 'cat';

/** A tile (integers) or a point on the tile grid (the centre of tile (3,4) is (3.5, 4.5)). */
export interface Tile {
  x: number;
  y: number;
}

export type Ground = 'grass' | 'path' | 'plaza' | 'water';
export type TreeKind = 'round' | 'pine';

export interface WorldPlace {
  id: PlaceId;
  /** Vietnamese name (the sign of the place, the empty lot's signpost). */
  name: string;
  /** Who you meet there (the name tag). */
  resident: string;
  /** Footprint: tiles x..x+w-1, y..y+d-1. Blocked whether the place is built or still an empty lot. */
  x: number;
  y: number;
  w: number;
  d: number;
  /** The face the door is on: 'x' = the +x face (door tile at x+w), 'y' = the +y face (door tile at y+d). */
  face: 'x' | 'y';
  /** The walkable tile in front of the door. */
  door: Tile;
  /** The walkable tile where the resident stands. */
  spot: Tile;
}

export interface WorldTree extends Tile {
  kind: TreeKind;
}

/** A fixed thing that is always there (not bought): blocked tiles. */
export interface WorldProp {
  kind: 'terrace' | 'bus';
  tiles: readonly Tile[];
}

export interface DecorSpot extends Tile {
  /** Takes the whole tile (integer x, y): nobody walks there, bought or not. */
  solid: boolean;
  /** Which way a bench looks. */
  dir?: 'e' | 's' | 'w';
  /**
   * Drawn mirrored. A street lamp's arm reaches to the right on the screen (towards x+1, y-1); mirrored it reaches
   * left. Every lamp stands beside a path or the plaza with its arm over it.
   */
  flip?: boolean;
}

export interface TownWorld {
  size: number;
  /** One string per row, one character per tile: '.' grass, '=' path, 'o' plaza, '~' water, 'T' / 't' a tree on grass, 'F' the fountain on the plaza. */
  rows: readonly string[];
  places: readonly WorldPlace[];
  props: readonly WorldProp[];
  decorations: Readonly<Record<DecorationId, readonly DecorSpot[]>>;
  /** The centre of the round plaza, on the tile grid. */
  plaza: { x: number; y: number; r: number };
  start: Tile;
}

//                                    x: 0         1         2
//                                       012345678901234567890
export const WORLD_ROWS: readonly string[] = [
  /* y=0  */ 'T.t..T.T....T...t.T..',
  /* y=1  */ '....t.....=...t......',
  /* y=2  */ 't..T..t...=........T.',
  /* y=3  */ '.....t.T..=.........t',
  /* y=4  */ '.T.t......=======..t.',
  /* y=5  */ 'T.........=.....=....',
  /* y=6  */ '...t.T....=.....=....',
  /* y=7  */ '.T.......ooo....=...t',
  /* y=8  */ '........ooooo...=....',
  /* y=9  */ '.T.....ooooooo..=....',
  /* y=10 */ '.======oooFooo======.',
  /* y=11 */ 'T.t.=..ooooooo...=...',
  /* y=12 */ '....=...ooooo~~..=...',
  /* y=13 */ 'T...=....ooo~~~..=...',
  /* y=14 */ '....=.....=.~~...=..T',
  /* y=15 */ 'tT..=.....========..T',
  /* y=16 */ '....=.....=..........',
  /* y=17 */ 'T...=======........T.',
  /* y=18 */ '..........=.....t....',
  /* y=19 */ '.t.T......=...T....T.',
  /* y=20 */ '......T...=......t...',
];

const place = (
  id: PlaceId,
  name: string,
  resident: string,
  at: [number, number, number, number],
  face: 'x' | 'y',
  door: [number, number],
  spot: [number, number],
): WorldPlace => ({
  id,
  name,
  resident,
  x: at[0],
  y: at[1],
  w: at[2],
  d: at[3],
  face,
  door: { x: door[0], y: door[1] },
  spot: { x: spot[0], y: spot[1] },
});

/**
 * The 13 places. Names and residents repeat src/data/town.ts (the ids are the contract between the two files).
 * The eight along the two main streets form a V open towards the viewer; the others sit on the side lanes.
 */
export const WORLD_PLACES: readonly WorldPlace[] = [
  place('square', 'Quảng trường', 'Leo', [7, 7, 2, 2], 'y', [8, 9], [9, 8]),
  place('cafe', 'Quán cà phê', 'Emma', [3, 8, 3, 2], 'y', [4, 10], [6, 10]),
  place('friend', 'Nhà bạn', 'Mia', [14, 8, 2, 2], 'y', [14, 10], [15, 11]),
  place('home', 'Nhà', 'Grace', [8, 4, 2, 2], 'x', [10, 5], [11, 5]),
  place('shop', 'Cửa hàng', 'Ben', [8, 14, 2, 2], 'x', [10, 14], [11, 16]),
  place('office', 'Văn phòng', 'Sarah', [17, 8, 3, 2], 'y', [18, 10], [19, 11]),
  place('school', 'Trường học', 'Daniel', [2, 12, 2, 3], 'x', [4, 13], [5, 13]),
  place('station', 'Bến xe', 'Sam', [8, 18, 2, 2], 'x', [10, 18], [11, 18]),
  place('clinic', 'Phòng khám', 'Kim', [8, 1, 2, 2], 'x', [10, 2], [11, 3]),
  place('cinema', 'Rạp phim', 'Zoe', [15, 2, 3, 2], 'y', [16, 4], [17, 5]),
  place('phone', 'Tiệm điện thoại', 'Max', [2, 16, 2, 2], 'x', [4, 16], [5, 18]),
  place('park', 'Công viên', 'Lily', [15, 13, 2, 2], 'y', [15, 15], [16, 16]),
  place('board', 'Bảng tin', 'Tom', [12, 2, 2, 2], 'y', [12, 4], [13, 5]),
];

export const WORLD_PROPS: readonly WorldProp[] = [
  // the café's table under a parasol, beside its side wall
  { kind: 'terrace', tiles: [{ x: 6, y: 9 }] },
  // the bus waits where the south road ends
  { kind: 'bus', tiles: [{ x: 10, y: 19 }, { x: 10, y: 20 }] },
];

const solid = (x: number, y: number, dir?: DecorSpot['dir']): DecorSpot => (dir ? { x, y, solid: true, dir } : { x, y, solid: true });
/** A street lamp: its arm over the path on its right on the screen, or (mirrored) on its left. */
const lamp = (x: number, y: number, side: 'right' | 'left'): DecorSpot => (side === 'left' ? { x, y, solid: true, flip: true } : { x, y, solid: true });
const loose = (x: number, y: number): DecorSpot => ({ x, y, solid: false });

/** Where each decoration appears once bought. Solid spots are kept free (blocked) from the start. */
export const WORLD_DECORATIONS: Readonly<Record<DecorationId, readonly DecorSpot[]>> = {
  // around the plaza
  // the start tile and its neighbours stay clear: nothing stands in front of the player when the page opens
  lamps1: [lamp(13, 8, 'left'), lamp(14, 11, 'left'), lamp(18, 12, 'left'), lamp(7, 12, 'right')],
  flowers: [solid(9, 6), solid(13, 7), solid(5, 11), solid(19, 12), solid(5, 15)],
  // one looks over the pond from the plaza (a bench on the pond's rim would stand in the water)
  benches: [solid(12, 11, 's'), solid(12, 6, 's'), solid(6, 13, 'e')],
  blossom: [solid(6, 6), solid(15, 6), solid(6, 16), solid(13, 17), solid(18, 13), solid(2, 6)],
  // along the streets, further out
  lamps2: [lamp(11, 1, 'left'), lamp(17, 6, 'left'), lamp(3, 11, 'right'), lamp(9, 16, 'right'), lamp(18, 14, 'left'), lamp(12, 16, 'right')],
  // two poles; the strings run from the pavilion's roof to each pole and between the poles, over the fountain
  lights: [solid(12, 7), solid(8, 13)],
  // on the pond
  lilies: [loose(13.35, 12.6), loose(13.7, 13.75), loose(12.75, 14.3), loose(14.45, 13.2)],
  // on the plaza itself
  stall: [solid(12, 8)],
  fountain: [solid(10, 10)],
  // tied down next to things that are always there
  // (the one at the top of the plaza stays clear of the fountain: from the camera its strings would run into the spire)
  balloons: [loose(10.25, 7.55), loose(6.55, 9.92), loose(12.95, 8.98)],
  flags: [solid(11, 6), solid(6, 11), solid(16, 11)],
  // where the cat starts its walks
  cat: [loose(11.5, 12.5)],
};

export const TOWN_WORLD: TownWorld = {
  size: 21,
  rows: WORLD_ROWS,
  places: WORLD_PLACES,
  props: WORLD_PROPS,
  decorations: WORLD_DECORATIONS,
  plaza: { x: 10.5, y: 10.5, r: 3.45 },
  start: { x: 10, y: 12 },
};

export const PLACE_IDS: readonly PlaceId[] = WORLD_PLACES.map((p) => p.id);
export const DECORATION_IDS = Object.keys(WORLD_DECORATIONS) as DecorationId[];

export function worldPlace(id: string, world: TownWorld = TOWN_WORLD): WorldPlace | undefined {
  return world.places.find((p) => p.id === id);
}

/** The ground under a tile (a tree or the fountain stands on grass / plaza); null outside the map. */
export function groundAt(t: Tile, world: TownWorld = TOWN_WORLD): Ground | null {
  if (!Number.isInteger(t.x) || !Number.isInteger(t.y)) return null;
  const ch = world.rows[t.y]?.[t.x];
  if (ch === undefined) return null;
  if (ch === '=') return 'path';
  if (ch === 'o' || ch === 'F') return 'plaza';
  if (ch === '~') return 'water';
  return 'grass';
}

export function worldTrees(world: TownWorld = TOWN_WORLD): WorldTree[] {
  const out: WorldTree[] = [];
  world.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === 'T') out.push({ x, y, kind: 'round' });
      else if (row[x] === 't') out.push({ x, y, kind: 'pine' });
    }
  });
  return out;
}

export function worldFountain(world: TownWorld = TOWN_WORLD): Tile | null {
  for (let y = 0; y < world.rows.length; y++) {
    const x = world.rows[y].indexOf('F');
    if (x >= 0) return { x, y };
  }
  return null;
}

/** The tiles a place covers. */
export function footprintTiles(p: Pick<WorldPlace, 'x' | 'y' | 'w' | 'd'>): Tile[] {
  const out: Tile[] = [];
  for (let y = p.y; y < p.y + p.d; y++) for (let x = p.x; x < p.x + p.w; x++) out.push({ x, y });
  return out;
}
