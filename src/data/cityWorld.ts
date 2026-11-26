// Westbay, the city next to the town (docs/town.md §20, docs/city-proposal.md; owner, 2026-11-25: "mở rộng thêm khu
// bên cạnh dạng như thị xã thành phố có nhiều event và nhân vật khác"). A second map for the same 3D stage
// (features/town/three: the engine takes its world as a parameter), reached by bus no. 9 from Sam's stop.
//
// 72 × 72 tiles, laid out like the town's map (data/townWorld.ts): x runs to the lower right of the screen, y to the
// lower left, the viewer sees the +x and +y faces. So every door is on a +y face (the north side of a street) and
// nothing tall stands on the SOUTH side of a street, where it would hide the street behind it; the tall blocks of the
// skyline stand along the far edges (north and west). The bay is an inlet in the south-west; the harbour is the
// peninsula east of it; the sea lies past the near edges.
//
// Six districts (docs/city-proposal.md §3). The first three opened first and keep their coordinates:
//   - Ga & bến xe (west): the terminal plaza where bus no. 9 stops, Central Station, the taxi rank;
//   - Chợ cũ (north, middle): Market Street's shops and the market square;
//   - Phố nghệ thuật (south, middle): Arts Street with the Lumen cinema, the bookshop, Bay FM, the karaoke bar;
//   - Khu văn phòng (north-east): the head office, the design studio, FreshWay's office;
//   - Đại học & bệnh viện (east): Westbay Hospital on the avenue, the campus on Arts Street's east end;
//   - Bến cảng (the peninsula, south-east): the electronics market, the ferry, the night market, the big wheel.
// Three streets run east–west (Market Street, Station Avenue, Arts Street) and four north–south (Station Road, Bay
// Road, College Road, East Road), with the seafront promenade along the bay and two more streets on the peninsula.
//
// The people (core/town/cityPeople.ts) live here as "places" (one person per place, as in the town): the main people
// with a building of their own and a story, the people known with a stall, a booth or just a pitch on the pavement.

import { axisMap, stretchWorld, type Cut } from './stretchWorld';
import { CITY_FURNITURE } from './townFurniture';
import { quayLane, warehouseScenery } from './city/warehouses';
import type { ActivitySpot, DecorationId, DecorSpot, PlaceId, Seat, ThingId, Tile, TownWorld, WorldDistrict, WorldLife, WorldPlace, WorldProp, WorldScenery } from './townWorld';

/** The map as first laid out (every coordinate below); RAW_WORLD is it stretched (CITY_CUTS_X / _Y). */
const RAW_SIZE = 72;

/** The people of Westbay, by the id of their place: the first eighteen (three districts), then the later districts'. */
export const CITY_PLACE_IDS = [
  'rico', 'nora', 'frank', 'gianna', 'iris', 'claire', 'okafor', 'pete', 'tess', 'hal', 'amira', 'poppy', 'jonah', 'theo', 'bo', 'dana', 'wren', 'kit',
  'priya', 'vivian', 'whitlock', 'hana', 'colin', 'dev',
  'osei', 'adeyemi', 'bridget', 'nell', 'yuki', 'finch',
  'jun', 'marcus', 'odile', 'gus', 'mei', 'sol', 'fay',
] as const;
export type CityPlaceId = (typeof CITY_PLACE_IDS)[number];

export const isCityPlace = (id: string): id is CityPlaceId => (CITY_PLACE_IDS as readonly string[]).includes(id);

const T = (x: number, y: number): Tile => ({ x, y });

// ───────────────────────── the ground ─────────────────────────

/** '.' grass, '=' street, 'o' paved square, ':' sand, '~' water, 'T' / 't' a tree, 'p' a palm on the sand, 'F' the fountain. */
function buildRows(): string[] {
  const S = RAW_SIZE;
  const g: string[][] = Array.from({ length: S }, () => Array.from({ length: S }, () => '.'));
  const fill = (x0: number, y0: number, x1: number, y1: number, ch: string) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (x >= 0 && y >= 0 && x < S && y < S) g[y][x] = ch;
  };
  // the water: the bay (an inlet in the south-west) and the map's two near rims; sand along every shore
  fill(0, 44, 35, S - 1, '~');
  fill(0, 70, S - 1, S - 1, '~');
  fill(70, 0, S - 1, S - 1, '~');
  fill(0, 42, 35, 43, ':'); // the seafront
  fill(36, 44, 37, 69, ':'); // the peninsula's beach on the bay
  fill(38, 68, 69, 69, ':'); // its south shore
  fill(68, 0, 69, 69, ':'); // the east shore
  // the streets: three running east–west, four north–south, a lane through the market square, the promenade, and
  // the peninsula's two
  fill(0, 24, 67, 25, '='); // Station Avenue
  fill(14, 12, 67, 13, '='); // Market Street
  fill(14, 36, 67, 37, '='); // Arts Street
  fill(14, 0, 15, 41, '='); // Station Road
  fill(42, 0, 43, 67, '='); // Bay Road
  fill(54, 0, 55, 67, '='); // College Road
  fill(66, 12, 67, 67, '='); // East Road
  fill(30, 14, 31, 41, '='); // Fountain Lane
  fill(4, 40, 67, 41, '='); // the seafront promenade
  fill(8, 31, 9, 39, '='); // the path through Station Park, down to the promenade
  fill(38, 54, 67, 55, '='); // Quay Street
  fill(38, 66, 67, 67, '='); // Pier Road
  // the squares
  fill(3, 19, 13, 23, 'o'); // the terminal plaza, in front of the station
  fill(3, 26, 13, 30, 'o'); // the bus bay
  fill(24, 14, 37, 19, 'o'); // the market square
  fill(56, 27, 63, 31, 'o'); // the campus quad
  fill(44, 56, 53, 61, 'o'); // the harbour square (the night market)
  g[17][30] = 'F';
  // trees: the avenue's south side, the two little gardens south of the market square, Station Park, the seafront,
  // then the office park, the hospital garden, the campus and the peninsula
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
    // the office park, the hospital garden
    [46, 15], [48, 17], [51, 15], [52, 18], [47, 19], [57, 15], [60, 16], [63, 15], [65, 17], [53, 8], [51, 4],
    // the campus
    [46, 27], [49, 29], [52, 27], [47, 30], [51, 31], [65, 28], [65, 33], [63, 33], [57, 33],
    // along the promenade's east end and the peninsula (none on the bay's shore, where the warehouses stand:
    // data/city/warehouses.ts)
    [46, 38], [50, 39], [58, 38], [62, 39], [65, 38], [40, 43], [47, 42], [52, 43], [59, 42], [64, 43],
    [46, 46], [50, 47], [58, 46], [62, 46], [65, 47], [57, 58], [60, 60], [63, 57], [65, 62], [58, 62], [62, 63],
  ] as [number, number][]) trees.push([x, y, 'T']);
  for (const [x, y] of [[20, 29], [26, 31], [36, 29], [5, 11], [10, 8], [64, 30], [50, 44], [61, 44]] as [number, number][]) trees.push([x, y, 't']);
  for (const [x, y, ch] of trees) if (g[y][x] === '.') g[y][x] = ch;
  for (const [x, y] of [[6, 42], [13, 43], [19, 42], [26, 43], [33, 42], [37, 56], [36, 64], [44, 69], [56, 68], [69, 20], [68, 40], [69, 58]] as [number, number][]) if (g[y][x] === ':') g[y][x] = 'p';
  return g.map((r) => r.join(''));
}

const RAW_ROWS: readonly string[] = buildRows();

// ───────────────────────── the places ─────────────────────────

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

/** Names repeat core/town/cityPeople.ts (the ids are the contract between the two files). */
const RAW_PLACES: readonly WorldPlace[] = [
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
  // Khu văn phòng: Market Street's east end, and the avenue's
  place('priya', 'Trụ sở Meridian', 'Priya', [45, 7, 6, 5], [47, 12], [48, 12]),
  place('whitlock', 'Sạp báo', 'Mr Whitlock', [52, 11, 1, 1], [52, 12], [53, 12]),
  place('vivian', 'Xưởng thiết kế Loom', 'Vivian', [57, 9, 4, 3], [58, 12], [59, 12]),
  place('hana', 'Quầy thông tin', 'Hana', [62, 11, 1, 1], [62, 12], [63, 12]),
  place('colin', 'Văn phòng FreshWay', 'Colin', [45, 20, 4, 4], [46, 24], [47, 24]),
  place('dev', 'Phòng máy', 'Dev', [50, 22, 2, 2], [50, 24], [51, 24]),
  // Đại học & bệnh viện
  place('osei', 'Bệnh viện Westbay', 'Dr Osei', [57, 18, 7, 6], [60, 24], [61, 24]),
  place('bridget', 'Trạm điều dưỡng', 'Bridget', [64, 23, 1, 1], [64, 24], [65, 24]),
  place('adeyemi', 'Phòng thí nghiệm ngữ âm', 'Prof Adeyemi', [45, 32, 4, 4], [46, 36], [47, 36]),
  place('finch', 'Thư viện', 'Mr Finch', [50, 33, 3, 3], [51, 36], [52, 36]),
  place('yuki', 'Bàn học ngoài sân', 'Yuki', [56, 35, 1, 1], [56, 36], [57, 36]),
  place('nell', 'Nhà thuốc', 'Nell', [59, 34, 2, 2], [59, 36], [60, 36]),
  // Bến cảng: the peninsula
  place('jun', 'Sạp sửa đồ điện tử', 'Jun', [45, 51, 3, 3], [46, 54], [47, 54]),
  place('marcus', 'Sân khấu Bay FM', 'Marcus', [57, 51, 4, 3], [58, 54], [59, 54]),
  place('fay', 'Vòng đu quay', 'Fay', [61, 50, 3, 4], [62, 54], [63, 54]),
  place('odile', 'Bến phà', 'Captain Odile', [45, 62, 5, 4], [47, 66], [48, 66]),
  place('gus', 'Chòi gác cảng', 'Gus', [52, 65, 1, 1], [52, 66], [53, 66]),
  place('mei', 'Sạp há cảo', 'Mei', [57, 65, 2, 1], [57, 66], [58, 66]),
  place('sol', 'Sạp lồng đèn', 'Sol', [60, 65, 2, 1], [60, 66], [61, 66]),
];

// ───────────────────────── fixed things ─────────────────────────

const bench = (x: number, y: number, dir: 'e' | 's' | 'w'): WorldProp => ({ kind: 'bench', tiles: [T(x, y)], dir });

/** The benches (each two seats, each a thing to sit and listen from, as in the town). New ones go at the END: a bench's number is its place in this list. */
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
  bench(49, 18, 's'), // the office park
  bench(59, 28, 's'), // the campus quad
  bench(48, 39, 's'), // the promenade's east end
  bench(60, 39, 's'),
  bench(46, 60, 's'), // the harbour square
  bench(51, 57, 's'),
];

const RAW_PROPS: readonly WorldProp[] = [
  // bus no. 9 waits in the bus bay (drawn when the state's `built` has 'station': the city always passes it)
  { kind: 'bus', tiles: [T(5, 29), T(6, 29)] },
  // the departures board on the plaza, in front of the station
  { kind: 'board', tiles: [T(10, 20)] },
  // Gianna's table on the pavement, beside her wall: Bay FM plays on it
  { kind: 'terrace', tiles: [T(36, 11)] },
  // the market's stalls, and the night market's on the harbour square
  { kind: 'market', tiles: [T(29, 15)], v: 0 },
  { kind: 'market', tiles: [T(36, 15)], v: 1 },
  { kind: 'market', tiles: [T(25, 18)], v: 1 },
  { kind: 'market', tiles: [T(48, 57)], v: 0 },
  { kind: 'market', tiles: [T(50, 59)], v: 1 },
  // planters by the florist's and along the square
  { kind: 'planter', tiles: [T(21, 11)] },
  { kind: 'planter', tiles: [T(17, 11)] },
  { kind: 'planter', tiles: [T(24, 20)] },
  { kind: 'planter', tiles: [T(37, 20)] },
  { kind: 'planter', tiles: [T(23, 35)] },
  { kind: 'planter', tiles: [T(36, 35)] },
  { kind: 'planter', tiles: [T(51, 11)] },
  { kind: 'planter', tiles: [T(56, 23)] },
  // lanterns along the seafront and on the squares
  { kind: 'lantern', tiles: [T(7, 39)] },
  { kind: 'lantern', tiles: [T(18, 39)] },
  { kind: 'lantern', tiles: [T(29, 39)] },
  { kind: 'lantern', tiles: [T(41, 39)] },
  { kind: 'lantern', tiles: [T(2, 26)] },
  { kind: 'lantern', tiles: [T(53, 39)] },
  { kind: 'lantern', tiles: [T(45, 56)] },
  { kind: 'lantern', tiles: [T(53, 61)] },
  // where the streets lead
  { kind: 'signpost', tiles: [T(13, 25)] },
  { kind: 'signpost', tiles: [T(32, 23)] },
  { kind: 'signpost', tiles: [T(44, 39)] },
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

const RAW_SCENERY: readonly WorldScenery[] = [
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
  // the office district's towers, behind the head office and the studio
  block(45, 1, 4, 5, 8, 1),
  block(50, 0, 3, 3, 6, 3),
  block(56, 1, 5, 6, 9, 0),
  block(62, 1, 4, 7, 7, 2),
  // the taxi waits at the rank
  { kind: 'taxi', tiles: [T(20, 23), T(21, 23)], dir: 'x' },
  // the seafront: umbrellas on the sand, a jetty and boats on the bay
  // (an umbrella and a palm stood where the harbour's warehouses now back onto the bay: data/city/warehouses.ts)
  { kind: 'umbrella', tiles: [T(10, 42)] },
  { kind: 'umbrella', tiles: [T(16, 43)] },
  { kind: 'umbrella', tiles: [T(23, 42)] },
  { kind: 'umbrella', tiles: [T(34, 43)] },
  { kind: 'jetty', tiles: [], at: T(30, 43), dir: 'y', len: 3 },
  { kind: 'boat', tiles: [], at: { x: 28.4, y: 45.6 }, dir: 'x' },
  { kind: 'boat', tiles: [], at: { x: 33.2, y: 46.2 }, dir: 'y' },
  { kind: 'boat', tiles: [], at: { x: 24.5, y: 52.5 }, dir: 'x' },
  { kind: 'boat', tiles: [], at: { x: 31.5, y: 60.5 }, dir: 'y' },
  { kind: 'duck', tiles: [], at: { x: 20.5, y: 45.2 } },
  { kind: 'duck', tiles: [], at: { x: 33.5, y: 55.5 } },
  { kind: 'hedge', tiles: [T(16, 28), T(17, 28), T(18, 28)], dir: 'x' },
  { kind: 'hedge', tiles: [T(38, 28), T(39, 28), T(40, 28)], dir: 'x' },
  { kind: 'hedge', tiles: [T(56, 26), T(57, 26), T(58, 26)], dir: 'x' },
  { kind: 'hedge', tiles: [T(61, 26), T(62, 26), T(63, 26)], dir: 'x' },
];

// ───────────────────────── things to use ─────────────────────────

/** Where the player stands in front of a bench (where a resident steps off it: the seats' `from`). */
const benchFront = (p: WorldProp): Tile => {
  const at = p.tiles[0];
  return p.dir === 'e' ? T(at.x + 1, at.y) : p.dir === 'w' ? T(at.x - 1, at.y) : T(at.x, at.y + 1);
};

/** The city's things: the bus back to the town, Gianna's radio, every bench. */
const RAW_THINGS: Readonly<Record<ThingId, ActivitySpot>> = (() => {
  const out: Record<ThingId, ActivitySpot> = {};
  BENCHES.forEach((p, n) => {
    const at = p.tiles[0];
    out[`thing:bench-${n}`] = { stand: benchFront(p), look: { x: at.x + 0.5, y: at.y + 0.5 }, box: { x: at.x + 0.5, y: at.y + 0.5, w: 0.85, d: 0.85, h: 0.6 } };
  });
  out['thing:radio'] = { stand: T(36, 12), look: { x: 36.5, y: 11.5 }, box: { x: 36.5, y: 11.5, w: 0.9, d: 0.9, h: 1.0 } };
  out['thing:bus'] = { stand: T(5, 28), look: { x: 6, y: 29.5 }, box: { x: 6, y: 29.5, w: 1.9, d: 0.8, h: 1.3 } };
  // the learner's hideout behind Gus's hut (data/city/hideout.ts, in the stretched map's coordinates: its lot 69–71 ×
  // 86–87, the door's tile 70, 88; here before the stretch, cityWorld.test checks they agree)
  out['thing:hideout'] = { stand: T(51, 64), look: { x: 51.5, y: 63.5 }, box: { x: 51.5, y: 63, w: 2.9, d: 1.9, h: 1.4 } };
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

const RAW_LIFE: WorldLife = {
  seats: SEATS,
  chats: [
    [T(7, 22), T(8, 21)],
    [T(28, 18), T(29, 17)],
    [T(36, 37), T(37, 36)],
    [T(20, 41), T(21, 40)],
    [T(39, 13), T(40, 12)],
    [T(22, 25), T(23, 24)],
    [T(58, 30), T(59, 29)],
    [T(46, 58), T(47, 57)],
    [T(50, 13), T(51, 12)],
    [T(62, 37), T(63, 36)],
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
    { at: T(48, 58), oct: NE },
    { at: T(50, 60), oct: NE },
  ],
  jog: [T(8, 32), T(8, 39), T(20, 40), T(31, 40), T(31, 26), T(14, 25)],
  ends: [T(0, 24), T(14, 0), T(42, 0), T(54, 0)],
  via: [T(30, 18), T(8, 22), T(27, 37), T(20, 40), T(22, 13), T(36, 24), T(55, 30), T(49, 25), T(54, 60), T(60, 40)],
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
const RAW_DECORATIONS: Readonly<Record<DecorationId, readonly DecorSpot[]>> = {
  lamps1: [
    lamp(16, 23, 'right'), lamp(24, 23, 'right'), lamp(33, 23, 'right'), lamp(41, 23, 'right'), lamp(2, 23, 'right'), lamp(12, 31, 'left'),
    lamp(49, 23, 'right'), lamp(56, 22, 'right'), lamp(44, 53, 'right'), lamp(56, 53, 'right'), lamp(51, 65, 'right'), lamp(63, 65, 'right'),
  ],
  lamps2: [
    lamp(16, 11, 'right'), lamp(24, 11, 'right'), lamp(32, 11, 'right'), lamp(41, 11, 'right'), lamp(16, 35, 'right'), lamp(29, 35, 'left'), lamp(37, 35, 'right'), lamp(13, 16, 'left'),
    lamp(13, 33, 'left'), lamp(41, 30, 'left'), lamp(53, 11, 'right'), lamp(61, 11, 'right'), lamp(49, 35, 'right'), lamp(58, 35, 'right'), lamp(65, 35, 'right'),
  ],
  flowers: [solid(23, 20), solid(38, 20), solid(16, 26), solid(41, 26), solid(6, 32), solid(53, 15), solid(64, 27), solid(41, 57)],
  benches: [],
  blossom: [solid(26, 20), solid(34, 20), solid(10, 35), solid(4, 36), solid(22, 30), solid(38, 30), solid(50, 28), solid(60, 33), solid(64, 59)],
  lights: [solid(26, 14), solid(37, 19), solid(44, 56), solid(53, 60)],
  lilies: [],
  stall: [solid(32, 15)],
  fountain: [solid(30, 17)],
  balloons: [loose(27.4, 36.5), loose(19.6, 12.5), loose(63.5, 54.6)],
  flags: [solid(3, 19), solid(13, 30), solid(23, 33), solid(37, 13), solid(56, 32), solid(44, 62)],
  cat: [loose(34.5, 17.5)],
};

/** What stands in the city of the decorations: all of it, always. */
export const CITY_DECOR_ON: readonly DecorationId[] = ['lamps1', 'lamps2', 'flowers', 'blossom', 'lights', 'stall', 'fountain', 'balloons', 'flags', 'cat'];

/** The six districts and the seafront: the map's labels, and "đang ở …" on a person's card. */
const RAW_DISTRICTS: readonly WorldDistrict[] = [
  { id: 'w-station', name: 'Ga & bến xe', x: 0, y: 0, w: 14, d: 31, arrive: T(6, 27) },
  { id: 'w-market', name: 'Chợ cũ', x: 14, y: 0, w: 30, d: 24, arrive: T(30, 20) },
  { id: 'w-arts', name: 'Phố nghệ thuật', x: 14, y: 26, w: 30, d: 14, arrive: T(27, 37) },
  { id: 'w-office', name: 'Khu văn phòng', x: 44, y: 0, w: 24, d: 24, arrive: T(49, 13) },
  { id: 'w-campus', name: 'Đại học & bệnh viện', x: 44, y: 24, w: 24, d: 16, arrive: T(58, 30) },
  { id: 'w-harbour', name: 'Bến cảng', x: 38, y: 44, w: 32, d: 26, arrive: T(48, 58) },
  { id: 'w-bay', name: 'Bờ vịnh', x: 0, y: 31, w: 38, d: 13, arrive: T(20, 40) },
];

/** Where the bus puts the player down. */
const RAW_ARRIVE: Tile = T(6, 27);

const RAW_WORLD: TownWorld = {
  size: RAW_SIZE,
  rows: RAW_ROWS,
  places: RAW_PLACES,
  props: RAW_PROPS,
  decorations: RAW_DECORATIONS,
  // the town's own activities (the pier, the farm…) have no spot here: only the things
  activities: RAW_THINGS as TownWorld['activities'],
  life: RAW_LIFE,
  scenery: RAW_SCENERY,
  districts: RAW_DISTRICTS,
  coast: true,
  // the roads out (owner, 2026-11-25: "bị bao quanh bởi núi và biển, đường đâu mà xe bus chạy"): Station Avenue runs on
  // west through a cutting in the range (the way to the town: the no. 9's road), Station Road, Bay Road and College
  // Road north
  range: { north: [15, 43, 55], west: [25], falls: false, roads: true },
  plaza: { x: 30.5, y: 17.5, r: 3.4 },
  // a city: asphalt streets with road markings (three/scene/terrain.ts)
  roads: 'asphalt',
  start: RAW_ARRIVE,
};

/**
 * Where a town resident who is up in the city stands about (by their place id in the town), and the door they step
 * out of sight through: near whoever they came to see (docs/city.md §4).
 */
const RAW_VISIT_SPOTS: Readonly<Record<string, { spot: Tile; door: Tile }>> = {
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

// ───────────────────────── stretched: a city, not a village ─────────────────────────

/**
 * Where the first layout is stretched (data/stretchWorld.ts; owner, 2026-11-26: "thành phố quái gì mà bé như lỗ mũi
 * vậy? mật độ dân số quá đông không hợp lí"): land put in between the blocks, every house the same size, streets
 * running on. 72 × 72 becomes 96 × 96 (1.78 × the ground for the same people).
 */
export const CITY_CUTS_X: readonly Cut[] = [
  { at: 2, by: 4 }, // west of the station
  { at: 16, by: 6 }, // between Station Road and the market
  { at: 41, by: 5 }, // the market's east end
  { at: 44, by: 4 }, // the office park's west side
  { at: 64, by: 5 }, // East Road's side
];
export const CITY_CUTS_Y: readonly Cut[] = [
  { at: 4, by: 3 }, // the skyline behind Market Street
  { at: 14, by: 3 }, // the market square
  { at: 32, by: 7 }, // between the avenue and Arts Street
  { at: 39, by: 4 }, // between Arts Street and the promenade
  { at: 46, by: 4 }, // the bay, the peninsula
  { at: 50, by: 3 }, // the peninsula
];

const mapX = axisMap(CITY_CUTS_X);
const mapY = axisMap(CITY_CUTS_Y);
const STRETCHED = stretchWorld(RAW_WORLD, CITY_CUTS_X, CITY_CUTS_Y);

/**
 * Low blocks of flats and shops on the open ground the stretch made, so it reads as a city and not as lawns: only on
 * bare grass, one tile clear of every street, square, house, door, seat, prop and spot people use (a walk is never
 * shut off), two or three storeys (a tall one south of a street would hide it), one tile apart. Deterministic.
 */
function fillers(w: TownWorld, reserved: readonly Tile[] = []): WorldScenery[] {
  const S = w.size;
  const used = new Set<number>();
  const key = (x: number, y: number) => y * S + x;
  const mark = (x: number, y: number) => {
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) used.add(key(x + i, y + j));
  };
  for (const p of [...w.places, ...(w.guests ?? [])]) {
    for (let y = p.y; y < p.y + Math.max(1, p.d); y++) for (let x = p.x; x < p.x + Math.max(1, p.w); x++) mark(x, y);
    mark(p.door.x, p.door.y);
    mark(p.spot.x, p.spot.y);
  }
  for (const v of Object.values(RAW_VISIT_SPOTS)) {
    mark(mapX(v.spot.x), mapY(v.spot.y));
    mark(mapX(v.door.x), mapY(v.door.y));
  }
  for (const p of w.props) for (const t of p.tiles) mark(t.x, t.y);
  for (const t of reserved) mark(t.x, t.y);
  for (const s of w.scenery ?? []) {
    for (const t of s.tiles) mark(t.x, t.y);
    if (s.at) mark(Math.floor(s.at.x), Math.floor(s.at.y));
  }
  for (const list of Object.values(w.decorations)) for (const d of list) mark(Math.floor(d.x), Math.floor(d.y));
  for (const a of Object.values(w.activities ?? {})) mark(a.stand.x, a.stand.y);
  const L = w.life;
  if (L) {
    for (const s of L.seats) mark(s.from.x, s.from.y);
    for (const c of L.chats) for (const t of c) mark(t.x, t.y);
    for (const s of [...L.tend, ...L.fish, ...L.read, ...L.shop]) mark(s.at.x, s.at.y);
    for (const t of [...L.jog, ...L.ends, ...L.via, L.inn.door, ...L.inn.yard]) mark(t.x, t.y);
  }
  for (const d of w.districts ?? []) mark(d.arrive.x, d.arrive.y);
  mark(w.start.x, w.start.y);
  // bare grass with grass all round it (a street, a square, sand or a tree next to it keeps it open)
  const open = (x: number, y: number): boolean => {
    if (x < 1 || y < 1 || x >= S - 1 || y >= S - 1 || used.has(key(x, y))) return false;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (w.rows[y + j][x + i] !== '.') return false;
    return true;
  };
  const out: WorldScenery[] = [];
  let n = 0;
  for (let y = 1; y < S - 1; y++) {
    for (let x = 1; x < S - 1; x++) {
      // the biggest of a few sizes that fits here
      const size = ([[4, 3], [3, 3], [3, 2], [2, 2]] as const).find(([bw, bd]) => {
        for (let j = 0; j < bd; j++) for (let i = 0; i < bw; i++) if (!open(x + i, y + j)) return false;
        return true;
      });
      if (!size) continue;
      const [bw, bd] = size;
      out.push(block(x, y, bw, bd, 2 + (n % 2), n % 4));
      n++;
      // one tile clear round it for the next
      for (let j = -1; j <= bd; j++) for (let i = -1; i <= bw; i++) used.add(key(x + i, y + j));
    }
  }
  return out;
}

/** The harbour's warehouses on the bay (data/city/warehouses.ts, docs/town.md §32), in the stretched map's coordinates. */
const WITH_WAREHOUSES: TownWorld = { ...STRETCHED, scenery: [...(STRETCHED.scenery ?? []), ...warehouseScenery()] };

export const CITY_WORLD: TownWorld = {
  ...WITH_WAREHOUSES,
  // (the quay lane in front of the warehouses stays open ground)
  scenery: [...(WITH_WAREHOUSES.scenery ?? []), ...fillers(WITH_WAREHOUSES, quayLane())],
  // to ride (the stretched map's own coordinates): a car at the taxi rank and one on the harbour, scooters on Market
  // Street and Arts Street, a bike by the station (data/vehicles.test.ts: open ground, clear of what people use)
  vehicles: [
    { kind: 'car', at: T(30, 31), heading: 0 },
    { kind: 'car', at: T(69, 80), heading: 0 },
    { kind: 'scooter', at: T(47, 19), heading: 0 },
    { kind: 'scooter', at: T(34, 50), heading: 0 },
    { kind: 'bike', at: T(18, 32), heading: Math.PI / 2 },
  ],
  // bins, post boxes, crates, hydrants… (data/townFurniture.ts, in the stretched map's coordinates)
  furniture: CITY_FURNITURE,
};
export const CITY_SIZE = CITY_WORLD.size;
export const CITY_ROWS: readonly string[] = CITY_WORLD.rows;
export const CITY_PLACES: readonly WorldPlace[] = CITY_WORLD.places;
export const CITY_ARRIVE: Tile = CITY_WORLD.start;
const at = (t: Tile): Tile => ({ x: mapX(t.x), y: mapY(t.y) });
export const CITY_VISIT_SPOTS: Readonly<Record<string, { spot: Tile; door: Tile }>> = Object.fromEntries(
  Object.entries(RAW_VISIT_SPOTS).map(([id, v]) => [id, { spot: at(v.spot), door: at(v.door) }]),
);

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
