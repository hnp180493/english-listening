// Westbay, the city next to the town (docs/town.md §20, docs/city-proposal.md; owner, 2026-11-25: "mở rộng thêm khu
// bên cạnh dạng như thị xã thành phố có nhiều event và nhân vật khác"). A second map for the same 3D stage
// (features/town/three: the engine takes its world as a parameter), reached by bus no. 9 from Sam's stop.
//
// 48 × 48 tiles, laid out like the town's map (data/townWorld.ts): x runs to the lower right of the screen, y to the
// lower left, the viewer sees the +x and +y faces. So every door is on a +y face (the north side of a street) and
// nothing tall stands on the SOUTH side of a street, where it would hide the street behind it; the tall blocks of the
// skyline stand along the far edges (north and west). The near edges (south and east) are the bay.
//
// Three districts (docs/city-proposal.md §3, "đợt 2"):
//   - Ga & bến xe (west): the terminal plaza where bus no. 9 stops, Central Station, the taxi rank;
//   - Chợ cũ (north-east): Market Street's shops and the market square;
//   - Phố nghệ thuật (south-east): Arts Street with the Lumen cinema, the bookshop, Bay FM, the karaoke bar.
// Between them the Station Avenue; along the bay the seafront promenade.
//
// The people (data/city/people.ts) live here as "places" (one person per place, as in the town): six with a building
// of their own and a story, twelve with a stall, a booth or just a pitch on the pavement.

import type { ActivitySpot, DecorationId, DecorSpot, PlaceId, Seat, ThingId, Tile, TownWorld, WorldLife, WorldPlace, WorldProp, WorldScenery } from './townWorld';

export const CITY_SIZE = 48;

/** The eighteen people of Westbay's first three districts, by the id of their place. */
export const CITY_PLACE_IDS = ['rico', 'nora', 'frank', 'gianna', 'iris', 'claire', 'okafor', 'pete', 'tess', 'hal', 'amira', 'poppy', 'jonah', 'theo', 'bo', 'dana', 'wren', 'kit'] as const;
export type CityPlaceId = (typeof CITY_PLACE_IDS)[number];

export const isCityPlace = (id: string): id is CityPlaceId => (CITY_PLACE_IDS as readonly string[]).includes(id);

const T = (x: number, y: number): Tile => ({ x, y });

// ───────────────────────── the ground ─────────────────────────

/** '.' grass, '=' street, 'o' paved square, ':' sand, '~' the bay, 'T' / 't' a tree, 'p' a palm on the sand, 'F' the fountain. */
function buildRows(): string[] {
  const S = CITY_SIZE;
  const g: string[][] = Array.from({ length: S }, () => Array.from({ length: S }, () => '.'));
  const fill = (x0: number, y0: number, x1: number, y1: number, ch: string) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < S && y < S) g[y][x] = ch;
  };
  // the bay along the near edges: water, a strip of sand before it
  fill(0, 44, S - 1, S - 1, '~');
  fill(46, 0, S - 1, S - 1, '~');
  fill(0, 42, 45, 43, ':');
  fill(44, 0, 45, 43, ':');
  // the streets: three running east–west, two north–south, a lane through the market square, the promenade
  fill(0, 24, 43, 25, '='); // Station Avenue
  fill(14, 12, 43, 13, '='); // Market Street
  fill(14, 36, 43, 37, '='); // Arts Street
  fill(14, 0, 15, 41, '='); // Station Road
  fill(42, 0, 43, 41, '='); // Bay Road
  fill(30, 14, 31, 41, '='); // Fountain Lane
  fill(4, 40, 43, 41, '='); // the seafront promenade
  fill(8, 31, 9, 39, '='); // the path through Station Park, down to the promenade
  // the squares
  fill(3, 19, 13, 23, 'o'); // the terminal plaza, in front of the station
  fill(3, 26, 13, 30, 'o'); // the bus bay
  fill(24, 14, 37, 19, 'o'); // the market square
  g[17][30] = 'F';
  // trees: the avenue's south side, the two little gardens south of the market square, Station Park, the seafront
  const trees: [number, number, string][] = [];
  for (let x = 17; x <= 41; x += 3) if (x !== 29 && x !== 32) trees.push([x, 27, 'T']);
  for (const [x, y] of [
    [25, 21], [27, 22], [28, 21], [33, 21], [35, 22], [36, 21],
    [17, 16], [19, 18], [21, 15], [22, 19], [18, 20], [39, 16], [40, 19], [39, 21],
    [4, 33], [6, 35], [11, 33], [12, 36], [5, 38], [11, 38], [2, 32], [2, 36],
    [18, 30], [21, 32], [24, 30], [34, 30], [37, 31], [40, 30],
    [17, 39], [22, 38], [27, 39], [34, 38], [39, 39],
    [3, 3], [6, 5], [9, 2], [11, 6], [4, 9], [8, 10], [12, 11], [2, 12],
    [17, 2], [22, 6], [29, 7], [38, 7], [40, 4],
  ] as [number, number][]) trees.push([x, y, 'T']);
  for (const [x, y] of [[20, 29], [26, 31], [36, 29], [5, 11], [10, 8]] as [number, number][]) trees.push([x, y, 't']);
  for (const [x, y, ch] of trees) if (g[y][x] === '.') g[y][x] = ch;
  for (const [x, y] of [[6, 42], [13, 43], [19, 42], [26, 43], [33, 42], [39, 43], [44, 38], [45, 30], [44, 21], [45, 9], [44, 3]] as [number, number][]) if (g[y][x] === ':') g[y][x] = 'p';
  return g.map((r) => r.join(''));
}

export const CITY_ROWS: readonly string[] = buildRows();

// ───────────────────────── the eighteen places ─────────────────────────

const place = (id: CityPlaceId, name: string, resident: string, at: [number, number, number, number], door: [number, number], spot: [number, number]): WorldPlace => ({
  // a city place's id is not one of the town's thirteen: the stage only needs it to be a string that names a place
  id: id as unknown as PlaceId,
  name,
  resident,
  x: at[0],
  y: at[1],
  w: at[2],
  d: at[3],
  face: 'y',
  door: T(door[0], door[1]),
  spot: T(spot[0], spot[1]),
});

/** Names repeat data/city/people.ts (the ids are the contract between the two files). */
export const CITY_PLACES: readonly WorldPlace[] = [
  // Ga & bến xe
  place('okafor', 'Ga trung tâm', 'Mrs Okafor', [4, 14, 7, 5], [7, 19], [8, 19]),
  place('pete', 'Phòng đồ thất lạc', 'Pete', [11, 17, 2, 2], [11, 19], [12, 19]),
  place('tess', 'Xe cà phê', 'Tess', [10, 27, 1, 1], [10, 28], [11, 28]),
  place('rico', 'Bến taxi', 'Rico', [17, 22, 2, 2], [17, 24], [18, 24]),
  // Chợ cũ: the shops on Market Street's north side, the stalls on the square
  place('nora', 'Tiệm hoa Sunflower Corner', 'Nora', [18, 10, 3, 2], [19, 12], [20, 12]),
  place('theo', 'Xe đẩy của bé Maya', 'Theo', [22, 11, 1, 1], [22, 12], [23, 12]),
  place('frank', 'Sạp truyện tranh cũ', 'Frank', [25, 10, 2, 2], [25, 12], [26, 12]),
  place('poppy', 'Tiệm bánh Twin Ovens', 'Poppy', [28, 10, 2, 2], [28, 12], [29, 12]),
  place('gianna', "Quán Ý Gianna's", 'Gianna', [33, 9, 3, 3], [34, 12], [35, 12]),
  place('hal', 'Hàng cá', 'Hal', [26, 15, 2, 1], [26, 16], [27, 16]),
  place('amira', 'Hàng gia vị', 'Amira', [33, 15, 2, 1], [33, 16], [34, 16]),
  place('jonah', 'Góc hát rong', 'Jonah', [35, 18, 1, 1], [35, 19], [36, 19]),
  // Phố nghệ thuật: Arts Street's north side
  place('bo', "Karaoke Bo's", 'Bo', [17, 34, 3, 2], [18, 36], [19, 36]),
  place('dana', 'Bàn ngoài hiên', 'Dana', [21, 35, 1, 1], [21, 36], [22, 36]),
  place('iris', 'Rạp Lumen', 'Iris', [24, 33, 4, 3], [26, 36], [27, 36]),
  place('wren', 'Quầy vé', 'Wren', [28, 35, 1, 1], [28, 36], [29, 36]),
  place('claire', 'Nhà sách Harbour Press', 'Claire', [33, 34, 3, 2], [34, 36], [35, 36]),
  place('kit', 'Đài Bay FM', 'Kit', [38, 33, 3, 3], [39, 36], [40, 36]),
];

// ───────────────────────── fixed things ─────────────────────────

const bench = (x: number, y: number, dir: 'e' | 's' | 'w'): WorldProp => ({ kind: 'bench', tiles: [T(x, y)], dir });

/** The benches (each two seats, each a thing to sit and listen from, as in the town). */
const BENCHES: readonly WorldProp[] = [
  bench(3, 21, 'e'), // the terminal plaza
  bench(13, 27, 'w'), // the bus bay
  bench(27, 18, 's'), // the market square
  bench(33, 18, 's'),
  bench(19, 26, 's'), // along the avenue
  bench(34, 26, 's'),
  bench(7, 34, 'e'), // Station Park
  bench(10, 37, 'w'),
  bench(12, 39, 's'), // the seafront
  bench(24, 39, 's'),
  bench(36, 39, 's'),
  bench(32, 35, 's'), // Arts Street, by the bookshop
];

export const CITY_PROPS: readonly WorldProp[] = [
  // bus no. 9 waits in the bus bay (drawn when the state's `built` has 'station': the city always passes it)
  { kind: 'bus', tiles: [T(5, 29), T(6, 29)] },
  // the departures board on the plaza, in front of the station
  { kind: 'board', tiles: [T(10, 20)] },
  // Gianna's table on the pavement, beside her wall: Bay FM plays on it
  { kind: 'terrace', tiles: [T(36, 11)] },
  // the market's stalls
  { kind: 'market', tiles: [T(29, 15)], v: 0 },
  { kind: 'market', tiles: [T(36, 15)], v: 1 },
  { kind: 'market', tiles: [T(25, 18)], v: 1 },
  // planters by the florist's and along the square
  { kind: 'planter', tiles: [T(21, 11)] },
  { kind: 'planter', tiles: [T(17, 11)] },
  { kind: 'planter', tiles: [T(24, 20)] },
  { kind: 'planter', tiles: [T(37, 20)] },
  { kind: 'planter', tiles: [T(23, 35)] },
  { kind: 'planter', tiles: [T(36, 35)] },
  // lanterns along the seafront and on the squares
  { kind: 'lantern', tiles: [T(7, 39)] },
  { kind: 'lantern', tiles: [T(18, 39)] },
  { kind: 'lantern', tiles: [T(29, 39)] },
  { kind: 'lantern', tiles: [T(41, 39)] },
  { kind: 'lantern', tiles: [T(2, 26)] },
  // where the streets lead
  { kind: 'signpost', tiles: [T(13, 25)] },
  { kind: 'signpost', tiles: [T(32, 23)] },
  ...BENCHES,
];

// ───────────────────────── scenery: the skyline, the seafront ─────────────────────────

const area = (x: number, y: number, w: number, d: number): Tile[] => {
  const out: Tile[] = [];
  for (let j = y; j < y + d; j++) for (let i = x; i < x + w; i++) out.push(T(i, j));
  return out;
};
/** A block of flats or offices on these tiles, `h` storeys, in look `v` (three/scene/props3d.ts buildScenery 'block'). */
const block = (x: number, y: number, w: number, d: number, h: number, v: number): WorldScenery => ({ kind: 'block', tiles: area(x, y, w, d), h, v });

export const CITY_SCENERY: readonly WorldScenery[] = [
  // the skyline along the north edge, behind Market Street
  block(17, 3, 4, 4, 5, 0),
  block(23, 1, 5, 5, 7, 1),
  block(30, 2, 4, 4, 4, 2),
  block(35, 1, 5, 5, 6, 3),
  block(22, 7, 2, 3, 3, 2),
  block(31, 7, 1, 3, 2, 0),
  block(37, 8, 4, 3, 3, 1),
  // the west edge, round the station
  block(0, 0, 3, 5, 6, 3),
  block(0, 6, 2, 5, 4, 0),
  block(0, 13, 3, 5, 5, 1),
  block(5, 0, 4, 2, 4, 2),
  block(10, 0, 3, 4, 5, 0),
  // the taxi waits at the rank
  { kind: 'taxi', tiles: [T(20, 23), T(21, 23)], dir: 'x' },
  // the seafront: umbrellas on the sand, a jetty and boats on the bay
  { kind: 'umbrella', tiles: [T(10, 42)] },
  { kind: 'umbrella', tiles: [T(16, 43)] },
  { kind: 'umbrella', tiles: [T(23, 42)] },
  { kind: 'umbrella', tiles: [T(36, 42)] },
  { kind: 'jetty', tiles: [], at: T(30, 43), dir: 'y', len: 3 },
  { kind: 'boat', tiles: [], at: { x: 28.4, y: 45.6 }, dir: 'x' },
  { kind: 'boat', tiles: [], at: { x: 33.2, y: 46.2 }, dir: 'y' },
  { kind: 'boat', tiles: [], at: { x: 46.8, y: 28.5 }, dir: 'y' },
  { kind: 'duck', tiles: [], at: { x: 20.5, y: 45.2 } },
  { kind: 'hedge', tiles: [T(16, 28), T(17, 28), T(18, 28)], dir: 'x' },
  { kind: 'hedge', tiles: [T(38, 28), T(39, 28), T(40, 28)], dir: 'x' },
];

// ───────────────────────── things to use ─────────────────────────

/** Where the player stands in front of a bench (where a resident steps off it: the seats' `from`). */
const benchFront = (p: WorldProp): Tile => {
  const at = p.tiles[0];
  return p.dir === 'e' ? T(at.x + 1, at.y) : p.dir === 'w' ? T(at.x - 1, at.y) : T(at.x, at.y + 1);
};

/** The city's things: the bus back to the town, Gianna's radio, every bench. */
export const CITY_THINGS: Readonly<Record<ThingId, ActivitySpot>> = (() => {
  const out: Record<ThingId, ActivitySpot> = {};
  BENCHES.forEach((p, n) => {
    const at = p.tiles[0];
    out[`thing:bench-${n}`] = { stand: benchFront(p), look: { x: at.x + 0.5, y: at.y + 0.5 }, box: { x: at.x + 0.5, y: at.y + 0.5, w: 0.85, d: 0.85, h: 0.6 } };
  });
  out['thing:radio'] = { stand: T(36, 12), look: { x: 36.5, y: 11.5 }, box: { x: 36.5, y: 11.5, w: 0.9, d: 0.9, h: 1.0 } };
  out['thing:bus'] = { stand: T(5, 28), look: { x: 6, y: 29.5 }, box: { x: 6, y: 29.5, w: 1.9, d: 0.8, h: 1.3 } };
  return out;
})();

// ───────────────────────── everyday life ─────────────────────────

const SE = 0;
const SW = 2;
const NW = 4;
const NE = 6;

const SEATS: readonly Seat[] = BENCHES.flatMap((p): Seat[] => {
  const at = p.tiles[0];
  const from = benchFront(p);
  if (p.dir === 'e') return [0.33, 0.67].map((k) => ({ x: at.x + 0.5, y: at.y + k, oct: SE, from }));
  if (p.dir === 'w') return [0.33, 0.67].map((k) => ({ x: at.x + 0.5, y: at.y + k, oct: NW, from }));
  return [0.33, 0.67].map((k) => ({ x: at.x + k, y: at.y + 0.5, oct: SW, from }));
});

export const CITY_LIFE: WorldLife = {
  seats: SEATS,
  chats: [
    [T(7, 22), T(8, 21)],
    [T(28, 18), T(29, 17)],
    [T(36, 37), T(37, 36)],
    [T(20, 41), T(21, 40)],
    [T(39, 13), T(40, 12)],
    [T(22, 25), T(23, 24)],
  ],
  tend: [
    { at: T(21, 12), oct: NE },
    { at: T(17, 12), oct: NE },
  ],
  fish: [],
  read: [{ at: T(10, 21), oct: NE }],
  shop: [
    { at: T(29, 16), oct: NE },
    { at: T(36, 16), oct: NE },
    { at: T(25, 19), oct: NE },
  ],
  jog: [T(8, 32), T(8, 39), T(20, 40), T(31, 40), T(31, 26), T(14, 25)],
  ends: [T(0, 24), T(14, 0), T(42, 0)],
  via: [T(30, 18), T(8, 22), T(27, 37), T(20, 40), T(22, 13), T(36, 24)],
  // nobody lodges in the city (every place stands); the type wants a door and a yard all the same
  inn: { door: T(7, 19), yard: [T(6, 21), T(9, 22)] },
};

// ───────────────────────── what the town's "decorations" are here ─────────────────────────

const solid = (x: number, y: number, dir?: DecorSpot['dir']): DecorSpot => (dir ? { x, y, solid: true, dir } : { x, y, solid: true });
const lamp = (x: number, y: number, side: 'right' | 'left'): DecorSpot => (side === 'left' ? { x, y, solid: true, flip: true } : { x, y, solid: true });
const loose = (x: number, y: number): DecorSpot => ({ x, y, solid: false });

/**
 * The town's decorations are bought; the city's are simply there (CITY_DECOR_ON is what the page passes as bought):
 * street lamps along every street, flower beds, the fountain of the market square, strings of lights over it, flags.
 */
export const CITY_DECORATIONS: Readonly<Record<DecorationId, readonly DecorSpot[]>> = {
  lamps1: [lamp(16, 23, 'right'), lamp(24, 23, 'right'), lamp(33, 23, 'right'), lamp(41, 23, 'right'), lamp(2, 23, 'right'), lamp(12, 31, 'left')],
  lamps2: [lamp(16, 11, 'right'), lamp(24, 11, 'right'), lamp(32, 11, 'right'), lamp(41, 11, 'right'), lamp(16, 35, 'right'), lamp(29, 35, 'left'), lamp(37, 35, 'right'), lamp(13, 16, 'left'), lamp(13, 33, 'left'), lamp(41, 30, 'left')],
  flowers: [solid(23, 20), solid(38, 20), solid(16, 26), solid(41, 26), solid(6, 32)],
  benches: [],
  blossom: [solid(26, 20), solid(34, 20), solid(10, 35), solid(4, 36), solid(22, 30), solid(38, 30)],
  lights: [solid(26, 14), solid(37, 19)],
  lilies: [],
  stall: [solid(32, 15)],
  fountain: [solid(30, 17)],
  balloons: [loose(27.4, 36.5), loose(19.6, 12.5)],
  flags: [solid(3, 19), solid(13, 30), solid(23, 33), solid(37, 13)],
  cat: [loose(34.5, 17.5)],
};

/** What stands in the city of the decorations: all of it, always. */
export const CITY_DECOR_ON: readonly DecorationId[] = ['lamps1', 'lamps2', 'flowers', 'blossom', 'lights', 'stall', 'fountain', 'balloons', 'flags', 'cat'];

/** Where the bus puts the player down. */
export const CITY_ARRIVE: Tile = T(6, 27);

export const CITY_WORLD: TownWorld = {
  size: CITY_SIZE,
  rows: CITY_ROWS,
  places: CITY_PLACES,
  props: CITY_PROPS,
  decorations: CITY_DECORATIONS,
  // the town's own activities (the pier, the farm…) have no spot here: only the things
  activities: CITY_THINGS as TownWorld['activities'],
  life: CITY_LIFE,
  scenery: CITY_SCENERY,
  coast: true,
  // the roads out (owner, 2026-11-25: "bị bao quanh bởi núi và biển, đường đâu mà xe bus chạy"): Station Avenue runs on
  // west through a cutting in the range (the way to the town: the no. 9's road), Station Road and Bay Road north
  range: { north: [15, 43], west: [25], falls: false, roads: true },
  plaza: { x: 30.5, y: 17.5, r: 3.4 },
  start: CITY_ARRIVE,
};

/**
 * Where a town resident who is up in the city stands about (by their place id in the town), and the door they step
 * out of sight through: near whoever they came to see (docs/city.md §4).
 */
export const CITY_VISIT_SPOTS: Readonly<Record<string, { spot: Tile; door: Tile }>> = {
  station: { spot: T(8, 28), door: T(7, 19) }, // Sam, by the no. 9
  office: { spot: T(6, 22), door: T(7, 19) }, // Sarah, off the train to head office
  home: { spot: T(12, 21), door: T(11, 19) }, // Grace, by the lost property office
  park: { spot: T(12, 29), door: T(7, 19) }, // Lily, a coffee from Tess's cart before work
  clinic: { spot: T(19, 25), door: T(17, 24) }, // Kim, at the taxi rank
  square: { spot: T(20, 13), door: T(19, 12) }, // Leo, at his sister's
  shop: { spot: T(26, 13), door: T(25, 12) }, // Ben, at his dad's stall
  cafe: { spot: T(35, 14), door: T(34, 12) }, // Emma, at the market
  friend: { spot: T(19, 37), door: T(18, 36) }, // Mia, outside Bo's
  cinema: { spot: T(27, 37), door: T(26, 36) }, // Zoe, at the Lumen
  phone: { spot: T(29, 37), door: T(26, 36) }, // Max, at the ticket booth
  school: { spot: T(35, 37), door: T(34, 36) }, // Daniel, at the bookshop
  board: { spot: T(40, 37), door: T(39, 36) }, // Tom, at Bay FM
};

const WITH = new Map<string, TownWorld>();

/**
 * The city with these town residents up for the day (TownWorld.guests: no place of their own, they stand about where
 * CITY_VISIT_SPOTS says). The same object for the same guests, so the stage is not made again for nothing.
 */
export function cityWorldWith(guests: readonly { id: string; name: string }[]): TownWorld {
  const list = guests.filter((g) => Object.hasOwn(CITY_VISIT_SPOTS, g.id));
  if (list.length === 0) return CITY_WORLD;
  const key = list.map((g) => g.id).join(',');
  let world = WITH.get(key);
  if (!world) {
    world = {
      ...CITY_WORLD,
      guests: list.map((g): WorldPlace => {
        const at = CITY_VISIT_SPOTS[g.id];
        return { id: g.id as PlaceId, name: 'Westbay', resident: g.name, x: at.spot.x, y: at.spot.y, w: 0, d: 0, face: 'y', door: at.door, spot: at.spot };
      }),
    };
    WITH.set(key, world);
  }
  return world;
}

export function cityPlace(id: string): WorldPlace | undefined {
  return CITY_PLACES.find((p) => (p.id as string) === id);
}
