// "Thị trấn": the layout of the isometric town. Pure data: what the ground is, where each place stands, where its
// resident waits, and the fixed spots of every decoration the learner can buy. The game rules (xu, lines, levels)
// live elsewhere (src/data/town.ts, src/core/town); the drawing lives in src/features/town/engine.
//
// The grid is 44 × 44 tiles, x = column, y = row, both from 0. On screen the tile (0,0) is the far (top) corner, x
// grows down-right and y grows down-left, so a building shows its +x and +y faces: every door is on one of those
// two faces and every resident stands in front of it, never behind a taller thing.
//
// The town (2026-11-21, after the owner found the 21 × 21 town "bé tí mà có một tỉ người"): a small valley with
// districts round a central plaza (WORLD_DISTRICTS): the plaza with Leo's pavilion, the café terrace and the egg kiosk;
// the market street to the north; the residential lane to the south-west (home, friend, the boarding house); the
// civic main road to the south-east (school, office, clinic, cinema) running out of town past the bus station; the
// park with its lake to the west; the farm in the north-east corner; the woods and the hill with a viewpoint in the
// far corner; an orchard to the east and a meadow to the south. Woods close the far edges, thinner trees the near ones.

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
  /** Footprint: tiles x..x+w-1, y..y+d-1. What stands on it blocks the way (core/town/colliders.ts): the house once built, the fenced site while on offer, else the lot's trees and stone. */
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

/**
 * Fixed things that are always there (not bought). 'terrace' / 'bus' belong to the café / bus stop; the others give
 * the town its everyday life (docs/town.md §7 "Life"): the boarding house where residents without a house of their
 * own lodge ('inn'), the activity spots ('pier', 'farm', 'kiosk' for the eggs, 'board' the notice board with the
 * album), a row of market stalls, benches people sit on, lanterns, planters and a signpost.
 */
export type PropKind = 'terrace' | 'bus' | 'inn' | 'pier' | 'farm' | 'kiosk' | 'board' | 'market' | 'bench' | 'lantern' | 'planter' | 'signpost';

/** A fixed thing that is always there (not bought): the tiles it stands on; its collider is as big as its model (core/town/colliders.ts). */
export interface WorldProp {
  kind: PropKind;
  tiles: readonly Tile[];
  /** Where its picture stands (tile coordinates) when that is not the middle of its tiles (the pier has none). */
  at?: Tile;
  /** Which way a bench looks. */
  dir?: 'e' | 's' | 'w';
  /** Which look of a kind (the two market stalls). */
  v?: number;
}

/** The five activities besides talking and building (src/features/town/activities/types.ts ActivityId). */
export type ActivitySpotId = 'fish' | 'farm' | 'eggs' | 'wardrobe' | 'album';

/** Where an activity is done: the player walks to `stand` and looks at `look`; clicking its `prop` goes there. */
export interface ActivitySpot {
  stand: Tile;
  look: Tile;
  prop: PropKind;
}

/** A seat on a bench or a stool: people sit at (x, y) facing octant `oct` (sim.ts OCTANTS), coming from `from`. */
export interface Seat {
  x: number;
  y: number;
  oct: number;
  from: Tile;
  /** The decoration that must be bought for the seat to be there (the benches the learner buys). */
  needs?: DecorationId;
}

/** A place to stand and do something, facing octant `oct`. */
export interface LifeStand {
  at: Tile;
  oct: number;
  needs?: DecorationId;
}

/**
 * Everyday life (docs/town.md §7 "Life"): where residents sit, chat in pairs, tend plants, fish, read the board, shop,
 * jog in the morning; where the townsfolk passing through come in and leave; the boarding house's door and yard.
 */
export interface WorldLife {
  seats: readonly Seat[];
  /** Two tiles side by side on the screen ((x, y) and (x + 1, y - 1)): the left one looks SE, the right one SW. */
  chats: readonly (readonly [Tile, Tile])[];
  tend: readonly LifeStand[];
  fish: readonly LifeStand[];
  read: readonly LifeStand[];
  shop: readonly LifeStand[];
  /** A loop round the plaza for a morning jog. */
  jog: readonly Tile[];
  /** Where passers-by come in and leave (the ends of the streets). */
  ends: readonly Tile[];
  /** Places passers-by walk past. */
  via: readonly Tile[];
  /** The boarding house: its door (lodgers go in and out there) and its yard, where they stand about. */
  inn: { door: Tile; yard: readonly Tile[] };
}

export interface DecorSpot extends Tile {
  /** Stands on the whole tile (integer x, y). Once bought it blocks as much as its model is big (core/town/colliders.ts); before that, nothing does. */
  solid: boolean;
  /** Which way a bench looks. */
  dir?: 'e' | 's' | 'w';
  /**
   * Drawn mirrored. A street lamp's arm reaches to the right on the screen (towards x+1, y-1); mirrored it reaches
   * left. Every lamp stands beside a path or the plaza with its arm over it.
   */
  flip?: boolean;
}

/**
 * Scenery the 3D town draws (three/scene/props3d.ts buildScenery): things that stand up and block as much as they are big ('barn', 'well', 'haybale',
 * 'fence' and 'hedge' runs, 'rock', 'bush') and loose ones ('hill': a bump of the ground, still walkable; 'duck': where
 * a duck paddles on the lake).
 */
export type SceneryKind = 'hill' | 'barn' | 'well' | 'haybale' | 'fence' | 'hedge' | 'rock' | 'bush' | 'duck';

export interface WorldScenery {
  kind: SceneryKind;
  /** The tiles it stands on (none for a hill or a duck). */
  tiles: readonly Tile[];
  /** Where it stands (tile coordinates) when that is not the middle of its tiles: a hill's top, a duck. */
  at?: Tile;
  /** Which way a fence or hedge runs: along x (a row) or along y (a column). */
  dir?: 'x' | 'y';
  /** A hill: its radius (tiles), the height of its top (tile edges) and the radius of its flat top (tiles). */
  r?: number;
  h?: number;
  top?: number;
}

/** A part of town: its name (the HUD's travel menu), the box it covers and a walkable tile to arrive at. */
export interface WorldDistrict {
  id: 'plaza' | 'market' | 'homes' | 'civic' | 'station' | 'park' | 'farm' | 'woods' | 'orchard' | 'meadow';
  /** Vietnamese name. */
  name: string;
  /** Tiles x..x+w-1, y..y+d-1 (rough; districts may overlap at their edges). */
  x: number;
  y: number;
  w: number;
  d: number;
  /** Where a quick trip there puts the player (walkable, on a street). */
  arrive: Tile;
}

export interface TownWorld {
  size: number;
  /** One string per row, one character per tile: '.' grass, '=' path, 'o' plaza, '~' water, 'T' / 't' a tree on grass, 'F' the fountain on the plaza. */
  rows: readonly string[];
  places: readonly WorldPlace[];
  props: readonly WorldProp[];
  decorations: Readonly<Record<DecorationId, readonly DecorSpot[]>>;
  /** Activity spots by id (left out in small test worlds). */
  activities?: Readonly<Record<ActivitySpotId, ActivitySpot>>;
  /** Everyday life's spots (left out in small test worlds: residents then only stroll by their door). */
  life?: WorldLife;
  /** Scenery the 3D town draws (three/scene/props3d.ts buildScenery); what stands up has a collider (core/town/colliders.ts). Left out in small test worlds. */
  scenery?: readonly WorldScenery[];
  /** The parts of town (left out in small test worlds). */
  districts?: readonly WorldDistrict[];
  /** The centre of the round plaza, on the tile grid. */
  plaza: { x: number; y: number; r: number };
  start: Tile;
  /**
   * What stands in town now (built places, sites, bought decorations, projects) as colliders, on a copy of the world
   * made by core/town/colliders.ts walkWorld. Left out = nothing built, every lot a site, nothing bought.
   */
  walk?: WorldWalk;
}

/**
 * What a body bumps into on the ground (core/town/colliders.ts): a circle (a post, a trunk, the fountain) or a box
 * along the grid (a house, a bench, a fence run), each as big as what the 3D town draws there. `what` names the
 * thing ('place:cafe', 'tree:3,4', 'decor:lamps1:2'…).
 */
export type Collider = ({ kind: 'circle'; x: number; y: number; r: number } | { kind: 'box'; x0: number; y0: number; x1: number; y1: number }) & { what: string };

/** What stands in town for one state (core/town/colliders.ts): its colliders and the state's key. */
export interface WorldWalk {
  key: string;
  colliders: readonly Collider[];
}

// Districts by their rows and columns (WORLD_DISTRICTS has the boxes): the woods and the hill at the top left, the
// market street and the farm along the top right, the lake on the left, the plaza in the middle (the fountain at
// 21,21), the orchard on the right, the homes at the bottom left, the main road with the civic buildings down to the
// bus station at the bottom right, the meadow and a copse at the bottom.
//                                       x: 0         1         2         3         4
//                                          01234567890123456789012345678901234567890123
export const WORLD_ROWS: readonly string[] = [
  /* y=0  */ 'TtTttttTtTtTtTTtTtTTttTTtTTTtT.TTTTT.=.TTT..',
  /* y=1  */ 'TTTtTTtt.T.TtTtttTtTtTtTtTtTTT.tT....=......',
  /* y=2  */ 'tTtttt......TTtTTtttTT.TT............=......',
  /* y=3  */ 'tttTTtt......tTttTtTTT..TT.T..T......==.....',
  /* y=4  */ 'tttttt......t.TtttTtTt.TTT..T.........=.....',
  /* y=5  */ 'TttTT......T...tTttTtT..TT.t...t......=.....',
  /* y=6  */ 'T..tt....====.TtTTtTTtT...............=.....',
  /* y=7  */ '..Ttt...==..===TTT....................=.....',
  /* y=8  */ '.....TT..==...==.....................==.....',
  /* y=9  */ 'T........T=.TtT==................======....T',
  /* y=10 */ '.T........==....==.......=========....==....',
  /* y=11 */ '......======.....===T..===.............=....',
  /* y=12 */ 'Tt...=~~~~.==..T...==.==...............=....',
  /* y=13 */ '....~~~~~~~~==....T.===...........T....=....',
  /* y=14 */ '...~~~~~~~~~~=.......=................==.T..',
  /* y=15 */ '...~~~~~~~~~~==....t.=................=.....',
  /* y=16 */ '==.~~~~~~~~~~.=......=...............==.T...',
  /* y=17 */ '.=.~~~~~~~~~~.=....ooooo............==.TT...',
  /* y=18 */ 'T==.~~~~~~~~..=...ooooooo..........==....TTt',
  /* y=19 */ '..=T..~~~~....=..ooooooooo.......===........',
  /* y=20 */ 'tt==..........=..ooooooooo.....===......TT..',
  /* y=21 */ 'tt.====......====ooooFoooo======.T..........',
  /* y=22 */ 'T.....========t..ooooooooo...............T..',
  /* y=23 */ 'T................ooooooooo..............t...',
  /* y=24 */ 'T.T.tt.......t....ooooooo...................',
  /* y=25 */ 'T.....t..........==ooooo.===......T......t.T',
  /* y=26 */ 'T...............==.....T..===......t...T....',
  /* y=27 */ '.T..T..........==..........===.....T...TT...',
  /* y=28 */ '.....TT........=......T.....===.........T...',
  /* y=29 */ 't...t.........==....T........===......T.....',
  /* y=30 */ 'T............==...............==.....T.TT...',
  /* y=31 */ 'T...........===.....T.........===.......T...',
  /* y=32 */ '...........==.===..............==...........',
  /* y=33 */ 'T........===....==.............===........TT',
  /* y=34 */ '........==.......====.........=====........T',
  /* y=35 */ '......===...........====...====..===........',
  /* y=36 */ 'T....==................=====......===......T',
  /* y=37 */ 'T...==.......T....T.........t......===......',
  /* y=38 */ 'T..==t......T...............TT......====....',
  /* y=39 */ '.===tTT..T.....t........T....t........===...',
  /* y=40 */ '==.tTT.......Tt.....TTT......T.........=====',
  /* y=41 */ '....ttt..T....T....T...Tt.......TT.....====.',
  /* y=42 */ '....T..........t.......T.T...t.....T..t.....',
  /* y=43 */ '..T...ttT............t.t....T....T......T..T',
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
 * Every door opens on a street or the plaza, on the side the viewer sees.
 */
export const WORLD_PLACES: readonly WorldPlace[] = [
  // the plaza: Leo's pavilion north-west of the fountain, the café on its north side by the market street
  place('square', 'Quảng trường', 'Leo', [17, 18, 2, 2], 'x', [19, 19], [19, 20]),
  place('cafe', 'Quán cà phê', 'Emma', [22, 15, 3, 2], 'y', [23, 17], [24, 17]),
  // the residential lane (south-west)
  place('friend', 'Nhà bạn', 'Mia', [9, 30, 2, 2], 'x', [11, 31], [11, 30]),
  place('home', 'Nhà', 'Grace', [12, 26, 2, 2], 'x', [14, 27], [14, 28]),
  // the market street (north): the shops face the street from its north side
  place('shop', 'Cửa hàng', 'Ben', [24, 7, 2, 2], 'y', [25, 9], [24, 9]),
  place('phone', 'Tiệm điện thoại', 'Max', [30, 7, 2, 2], 'y', [30, 9], [31, 9]),
  place('board', 'Bảng tin', 'Tom', [34, 6, 2, 2], 'y', [34, 8], [35, 8]),
  // the main road (south-east): doors on both sides of it, down to the bus station where it leaves town
  place('office', 'Văn phòng', 'Sarah', [30, 25, 3, 2], 'y', [30, 27], [31, 27]),
  place('school', 'Trường học', 'Daniel', [26, 29, 2, 3], 'x', [28, 29], [28, 30]),
  place('clinic', 'Phòng khám', 'Kim', [27, 33, 2, 2], 'x', [29, 34], [29, 33]),
  place('cinema', 'Rạp phim', 'Zoe', [36, 33, 3, 2], 'y', [36, 35], [37, 35]),
  place('station', 'Bến xe', 'Sam', [40, 36, 2, 2], 'y', [40, 38], [41, 38]),
  // the park by the lake (west)
  place('park', 'Công viên', 'Lily', [10, 19, 2, 2], 'y', [10, 21], [11, 21]),
];

const T = (x: number, y: number): Tile => ({ x, y });

export const WORLD_PROPS: readonly WorldProp[] = [
  // the café's table under a parasol, beside its side wall
  { kind: 'terrace', tiles: [T(25, 16)] },
  // the bus waits in a lay-by where the main road leaves town
  { kind: 'bus', tiles: [T(40, 41), T(41, 41)] },
  // the boarding house ("nhà trọ") at the far end of the residential lane: whoever has no house of their own yet lodges here
  { kind: 'inn', tiles: [T(3, 31), T(4, 31), T(5, 31), T(3, 32), T(4, 32), T(5, 32)] },
  // the notice board with the album, on the market street
  { kind: 'board', tiles: [T(32, 8)] },
  // the farm's two fields, four tiles of soil rows by two each, east of the farm lane (the first one is the activity's)
  { kind: 'farm', tiles: [T(39, 3), T(40, 3), T(41, 3), T(42, 3), T(39, 4), T(40, 4), T(41, 4), T(42, 4)] },
  { kind: 'farm', tiles: [T(39, 6), T(40, 6), T(41, 6), T(42, 6), T(39, 7), T(40, 7), T(41, 7), T(42, 7)] },
  // a wooden pier from the lake's east shore over the water (the water tiles are blocked already)
  { kind: 'pier', tiles: [], at: { x: 13.2, y: 15.5 } },
  // the egg kiosk on the plaza's east side, where the east lane leaves it
  { kind: 'kiosk', tiles: [T(25, 22)] },
  // the market stalls: two between the shop and the phone shop, one across the street
  { kind: 'market', tiles: [T(27, 8)], v: 0 },
  { kind: 'market', tiles: [T(28, 8)], v: 1 },
  { kind: 'market', tiles: [T(29, 12)], v: 0 },
  // benches anybody may sit on, from the first day
  { kind: 'bench', tiles: [T(17, 22)], dir: 'e' }, // the plaza, looking at the fountain
  { kind: 'bench', tiles: [T(7, 10)], dir: 's' }, // the lake's north shore, over the water
  { kind: 'bench', tiles: [T(1, 14)], dir: 'e' }, // the lake's west shore
  { kind: 'bench', tiles: [T(7, 6)], dir: 'e' }, // the hill's top: the view over the town
  { kind: 'bench', tiles: [T(8, 5)], dir: 's' },
  { kind: 'bench', tiles: [T(16, 29)], dir: 'e' }, // the residential lane
  { kind: 'bench', tiles: [T(38, 35)], dir: 's' }, // the bus stop
  { kind: 'bench', tiles: [T(36, 13)], dir: 's' }, // the orchard
  { kind: 'bench', tiles: [T(20, 37)], dir: 's' }, // the meadow, by the copse
  // lanterns by the boarding house, the pier and the bus stop; planters on the market street, by the boarding house
  // and in Grace's front garden; signposts where the hill path forks and where the east lane bends
  { kind: 'lantern', tiles: [T(2, 34)] },
  { kind: 'lantern', tiles: [T(14, 14)] },
  { kind: 'lantern', tiles: [T(39, 34)] },
  { kind: 'planter', tiles: [T(26, 9)] },
  { kind: 'planter', tiles: [T(7, 33)] },
  { kind: 'planter', tiles: [T(15, 26)] },
  { kind: 'signpost', tiles: [T(10, 7)] },
  { kind: 'signpost', tiles: [T(33, 18)] },
];

/** Scenery for the 3D town (what stands up blocks as much as it is big: core/town/colliders.ts). */
export const WORLD_SCENERY: readonly WorldScenery[] = [
  // the hill in the woods: its top is the viewpoint with the two benches
  { kind: 'hill', tiles: [], at: { x: 8, y: 6 }, r: 5.5, h: 1.6, top: 1.25 },
  // the farm: the barn west of the farm lane, a well, hay bales
  { kind: 'barn', tiles: [T(34, 2), T(35, 2), T(36, 2), T(34, 3), T(35, 3), T(36, 3)] },
  { kind: 'well', tiles: [T(41, 10)] },
  { kind: 'haybale', tiles: [T(33, 4)] },
  { kind: 'haybale', tiles: [T(36, 5)] },
  // the front gardens of the residential lane
  { kind: 'fence', tiles: [T(10, 28), T(11, 28)], dir: 'x' },
  { kind: 'fence', tiles: [T(8, 29)], dir: 'x' },
  { kind: 'hedge', tiles: [T(18, 28), T(18, 29), T(18, 30)], dir: 'y' },
  { kind: 'hedge', tiles: [T(7, 37), T(8, 37), T(9, 37)], dir: 'x' },
  // a few stones and bushes
  { kind: 'rock', tiles: [T(3, 9)] },
  { kind: 'rock', tiles: [T(26, 39)] },
  { kind: 'bush', tiles: [T(34, 23)] },
  { kind: 'bush', tiles: [T(12, 35)] },
  // ducks on the lake
  { kind: 'duck', tiles: [], at: { x: 6.5, y: 15.5 } },
  { kind: 'duck', tiles: [], at: { x: 9.4, y: 16.4 } },
  { kind: 'duck', tiles: [], at: { x: 8.2, y: 17.6 } },
];

/** The parts of town (the 3D HUD's travel menu). */
export const WORLD_DISTRICTS: readonly WorldDistrict[] = [
  { id: 'plaza', name: 'Quảng trường', x: 16, y: 15, w: 11, d: 12, arrive: T(22, 23) },
  { id: 'market', name: 'Phố chợ', x: 22, y: 5, w: 16, d: 9, arrive: T(27, 10) },
  { id: 'homes', name: 'Xóm nhà', x: 0, y: 24, w: 19, d: 17, arrive: T(13, 31) },
  { id: 'civic', name: 'Đường lớn', x: 25, y: 24, w: 15, d: 12, arrive: T(30, 30) },
  { id: 'station', name: 'Bến xe', x: 35, y: 35, w: 9, d: 9, arrive: T(39, 39) },
  { id: 'park', name: 'Công viên bên hồ', x: 0, y: 10, w: 16, d: 14, arrive: T(14, 21) },
  { id: 'farm', name: 'Nông trại', x: 32, y: 0, w: 12, d: 11, arrive: T(38, 5) },
  { id: 'woods', name: 'Đồi và rừng', x: 0, y: 0, w: 17, d: 10, arrive: T(9, 6) },
  { id: 'orchard', name: 'Vườn cây', x: 30, y: 12, w: 14, d: 12, arrive: T(34, 19) },
  { id: 'meadow', name: 'Bãi cỏ', x: 14, y: 27, w: 16, d: 17, arrive: T(24, 36) },
];

/** Where each activity is done (src/features/town/activities). */
export const WORLD_ACTIVITIES: Readonly<Record<ActivitySpotId, ActivitySpot>> = {
  fish: { stand: T(13, 15), look: { x: 12.2, y: 15.5 }, prop: 'pier' },
  farm: { stand: T(40, 2), look: { x: 40.5, y: 3.6 }, prop: 'farm' },
  eggs: { stand: T(25, 23), look: { x: 25.5, y: 22.5 }, prop: 'kiosk' },
  wardrobe: { stand: T(4, 33), look: { x: 4.5, y: 32.4 }, prop: 'inn' },
  album: { stand: T(32, 9), look: { x: 32.5, y: 8.5 }, prop: 'board' },
};

/** Octants (sim.ts OCTANTS): 0 = +x (SE on the screen), 2 = +y (SW), 4 = -x (NW), 6 = -y (NE). */
const SE = 0;
const SW = 2;
const NW = 4;
const NE = 6;

export const WORLD_LIFE: WorldLife = {
  seats: [
    // the fixed benches: two seats each
    { x: 17.5, y: 22.33, oct: SE, from: T(18, 22) },
    { x: 17.5, y: 22.67, oct: SE, from: T(18, 22) },
    { x: 7.33, y: 10.5, oct: SW, from: T(7, 11) },
    { x: 7.67, y: 10.5, oct: SW, from: T(7, 11) },
    { x: 1.5, y: 14.33, oct: SE, from: T(2, 14) },
    { x: 1.5, y: 14.67, oct: SE, from: T(2, 14) },
    { x: 7.5, y: 6.33, oct: SE, from: T(8, 6) },
    { x: 7.5, y: 6.67, oct: SE, from: T(8, 6) },
    { x: 8.33, y: 5.5, oct: SW, from: T(8, 6) },
    { x: 8.67, y: 5.5, oct: SW, from: T(8, 6) },
    { x: 16.5, y: 29.33, oct: SE, from: T(17, 29) },
    { x: 16.5, y: 29.67, oct: SE, from: T(17, 29) },
    { x: 38.33, y: 35.5, oct: SW, from: T(38, 36) },
    { x: 38.67, y: 35.5, oct: SW, from: T(38, 36) },
    { x: 36.33, y: 13.5, oct: SW, from: T(36, 14) },
    { x: 36.67, y: 13.5, oct: SW, from: T(36, 14) },
    { x: 20.33, y: 37.5, oct: SW, from: T(20, 38) },
    { x: 20.67, y: 37.5, oct: SW, from: T(20, 38) },
    // the café's stool facing its table
    { x: 25.22, y: 16.5, oct: SE, from: T(25, 17) },
    // the benches the learner buys
    { x: 20.33, y: 24.5, oct: SW, from: T(20, 25), needs: 'benches' },
    { x: 20.67, y: 24.5, oct: SW, from: T(20, 25), needs: 'benches' },
    { x: 9.33, y: 23.5, oct: SW, from: T(9, 24), needs: 'benches' },
    { x: 9.67, y: 23.5, oct: SW, from: T(9, 24), needs: 'benches' },
    { x: 24.33, y: 33.5, oct: SW, from: T(24, 34), needs: 'benches' },
    { x: 24.67, y: 33.5, oct: SW, from: T(24, 34), needs: 'benches' },
  ],
  // spread over the districts, so a chat can happen anywhere in town
  chats: [
    [T(23, 22), T(24, 21)],
    [T(19, 22), T(20, 21)],
    [T(28, 10), T(29, 9)],
    [T(12, 33), T(13, 32)],
    [T(16, 31), T(17, 30)],
    [T(7, 23), T(8, 22)],
    [T(35, 17), T(36, 16)],
    [T(32, 29), T(33, 28)],
    [T(37, 40), T(38, 39)],
    [T(35, 10), T(36, 9)],
    [T(22, 38), T(23, 37)],
    [T(9, 4), T(10, 3)],
  ],
  tend: [
    { at: T(39, 2), oct: SW },
    { at: T(42, 2), oct: SW },
    { at: T(40, 5), oct: SW },
    { at: T(7, 34), oct: NE },
    { at: T(15, 27), oct: NE },
    { at: T(26, 10), oct: NE },
    { at: T(19, 17), oct: SE, needs: 'flowers' },
    { at: T(12, 18), oct: SW, needs: 'flowers' },
    { at: T(11, 27), oct: NW, needs: 'flowers' },
    { at: T(7, 30), oct: NW, needs: 'flowers' },
  ],
  // on the lake's west and north shores, looking over the water towards the viewer
  fish: [
    { at: T(2, 15), oct: SE },
    { at: T(2, 17), oct: SE },
    { at: T(8, 11), oct: SW },
    { at: T(4, 12), oct: SW },
  ],
  read: [{ at: T(32, 9), oct: NE }],
  shop: [
    { at: T(27, 9), oct: NE },
    { at: T(28, 9), oct: NE },
    { at: T(29, 13), oct: NE },
  ],
  jog: [T(21, 18), T(24, 19), T(25, 21), T(24, 24), T(21, 25), T(18, 24), T(17, 21), T(19, 18)],
  // the town's ways out: the residential lane, the main road, the lake path, the farm lane
  ends: [T(0, 40), T(43, 40), T(0, 16), T(37, 0)],
  via: [T(27, 10), T(13, 31), T(24, 36), T(34, 19), T(8, 22), T(14, 17), T(31, 33), T(12, 11), T(39, 12), T(9, 7), T(36, 38)],
  inn: { door: T(4, 33), yard: [T(3, 33), T(5, 33), T(6, 34), T(2, 32), T(6, 31), T(2, 31), T(3, 34), T(5, 34)] },
};

const solid = (x: number, y: number, dir?: DecorSpot['dir']): DecorSpot => (dir ? { x, y, solid: true, dir } : { x, y, solid: true });
/** A street lamp: its arm over the path on its right on the screen, or (mirrored) on its left. */
const lamp = (x: number, y: number, side: 'right' | 'left'): DecorSpot => (side === 'left' ? { x, y, solid: true, flip: true } : { x, y, solid: true });
const loose = (x: number, y: number): DecorSpot => ({ x, y, solid: false });

/** Where each decoration appears once bought (and only then blocks the way, as much as its model is big). */
export const WORLD_DECORATIONS: Readonly<Record<DecorationId, readonly DecorSpot[]>> = {
  // round the plaza's rim
  // the start tile and its neighbours stay clear: nothing stands in front of the player when the page opens
  lamps1: [lamp(18, 17, 'right'), lamp(26, 19, 'left'), lamp(27, 22, 'right'), lamp(16, 23, 'right'), lamp(19, 26, 'right')],
  // flower beds: two framing the market street's way onto the plaza, the park, the front gardens, the school
  flowers: [solid(20, 17), solid(22, 17), solid(10, 27), solid(12, 19), solid(6, 30), solid(29, 32)],
  // one on the plaza, one by the lake path, one on the meadow (none beside the water)
  benches: [solid(20, 24, 's'), solid(9, 23, 's'), solid(24, 33, 's')],
  // blossom trees in the gardens, the orchard, by the lake and beside the café
  blossom: [solid(11, 25), solid(8, 27), solid(15, 33), solid(35, 15), solid(37, 21), solid(32, 23), solid(16, 15), solid(27, 17)],
  // along the streets, further out
  lamps2: [lamp(26, 11, 'right'), lamp(32, 11, 'right'), lamp(27, 28, 'right'), lamp(33, 31, 'left'), lamp(34, 37, 'right'), lamp(13, 29, 'right'), lamp(8, 33, 'right'), lamp(12, 21, 'left'), lamp(31, 22, 'right'), lamp(37, 6, 'right'), lamp(22, 34, 'left')],
  // two poles on the plaza; the strings run from the pavilion's roof to each pole and between the poles, over the fountain
  lights: [solid(23, 19), solid(19, 23)],
  // on the lake
  lilies: [loose(4.6, 14.4), loose(10.4, 13.6), loose(11.3, 17.2), loose(5.3, 18.1), loose(8.9, 12.6), loose(3.8, 16.6)],
  // on the plaza itself
  stall: [solid(24, 20)],
  fountain: [solid(21, 21)],
  // tied down next to things that are always there: the café, the park, the bus station
  balloons: [loose(24.4, 18.4), loose(13.6, 20.5), loose(39.6, 38.6)],
  // the school, the bus station, the market street, the plaza's south-west corner
  flags: [solid(29, 28), solid(42, 38), solid(30, 11), solid(16, 24)],
  // where the cat starts its walks: by the plaza's bench
  cat: [loose(18.5, 21.5)],
};

export const TOWN_WORLD: TownWorld = {
  size: 44,
  rows: WORLD_ROWS,
  places: WORLD_PLACES,
  props: WORLD_PROPS,
  decorations: WORLD_DECORATIONS,
  activities: WORLD_ACTIVITIES,
  life: WORLD_LIFE,
  scenery: WORLD_SCENERY,
  districts: WORLD_DISTRICTS,
  plaza: { x: 21.5, y: 21.5, r: 4.6 },
  start: { x: 22, y: 23 },
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

/**
 * How high the ground is at a point of the tile grid (tile edges; 0 almost everywhere): the hills of the scenery,
 * a smooth bump that is `h` on its flat top (`top` tiles round its middle: the viewpoint's benches stand level) and 0
 * from `r` tiles out. The 3D town raises its ground, trees, things and people by it; walking ignores it (a slope
 * blocks nothing).
 */
export function groundHeight(x: number, y: number, world: TownWorld = TOWN_WORLD): number {
  let h = 0;
  const list = world.scenery;
  if (!list) return 0;
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (s.kind !== 'hill' || !s.at || !s.r || !s.h) continue;
    const dx = x - (s.at.x + 0.5);
    const dy = y - (s.at.y + 0.5);
    if (dx * dx + dy * dy >= s.r * s.r) continue;
    const top = Math.min(s.top ?? 0, s.r * 0.9);
    const d = Math.max(0, (Math.hypot(dx, dy) - top) / (s.r - top));
    h = Math.max(h, (s.h * (1 + Math.cos(Math.PI * d))) / 2);
  }
  return h;
}
