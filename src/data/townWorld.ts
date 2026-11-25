// "Thị trấn": the layout of the isometric town. Pure data: what the ground is, where each place stands, where its
// resident waits, and the fixed spots of every decoration the learner can buy. The game rules (xu, lines, levels)
// live elsewhere (src/data/town.ts, src/core/town); the drawing lives in src/features/town/engine.
//
// The grid is 84 × 84 tiles, x = column, y = row, both from 0. On screen the tile (0,0) is the far (top) corner, x
// grows down-right and y grows down-left, so a building shows its +x and +y faces: every door is on one of those
// two faces and every resident stands in front of it, never behind a taller thing.
//
// The town (2026-11-21, after the owner found the 21 × 21 town "bé tí mà có một tỉ người"): a small valley with
// districts round a central plaza (WORLD_DISTRICTS): the plaza with Leo's pavilion, the café terrace and the egg kiosk;
// the market street to the north; the residential lane to the south-west (home, friend, the boarding house); the
// civic main road to the south-east (school, office, clinic, cinema) running out of town past the bus station; the
// park with its lake to the west; the farm in the north-east corner; the woods and the hill with a viewpoint in the
// far corner; an orchard to the east and a meadow to the south.
//
// The countryside round it (2026-11-22, after the camera moved out and the owner found the 44 × 44 town "nhỏ nhỏ"):
// the town keeps its 44 × 44 tiles in the middle (every coordinate of it moved by (16, 12)), and a ring of open land
// with no new buildings goes round it, joined by one loop of lanes: the pine forest with a bigger hill and a lookout in
// the far corner, the fields along the top right (the farm lane goes on through them), the big lake on the left (the
// lake path goes on down its shore to the residential lane), the grassy hills with a lotus pond at the near side, and
// the country road on the right with a fruit orchard and a stall, which meets the main road where it leaves the map.
// Woods close the far edges, thinner trees the near ones.
//
// The coast (2026-11-24, docs/town.md §7 "The coast and the mountains"): the island grew to 84 × 84 on its two near
// sides only (x and y 72..83; nothing else moved): dunes with palms, a sandy beach with a promenade, the harbour at the
// end of the main road, the lighthouse on the cape in the near corner, the sea at the map's edge. The sea round the
// island and the mountains behind its far sides are seen only (three/scene/backdrop.ts).

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

export type Ground = 'grass' | 'path' | 'plaza' | 'water' | 'sand';
export type TreeKind = 'round' | 'pine' | 'palm';

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

/**
 * A thing of the scenery that can be used (docs/town.md §19, 2026-11-25: "cảnh vật chỉ cho có, không tương tác được
 * gì"): a bench to sit and listen from, the café's radio. They are activity spots like the pier or the egg kiosk
 * (clicked, walked to, E beside them, a name over them), with ids of their own; WORLD_THINGS below.
 */
export type ThingId = `thing:${string}`;

/** The five activities besides talking and building (src/features/town/activities/types.ts ActivityId), and the things. */
export type ActivitySpotId = 'fish' | 'farm' | 'eggs' | 'wardrobe' | 'album' | ThingId;

/**
 * Where an activity is done: the player walks to `stand` and looks at `look`; clicking its `prop` (the first of
 * that kind) goes there, or, for a thing, clicking its `box` (its middle on the grid, how wide, deep and high).
 */
export interface ActivitySpot {
  stand: Tile;
  look: Tile;
  prop?: PropKind;
  box?: { x: number; y: number; w: number; d: number; h: number };
}

export type ThingKind = 'bench' | 'radio';

/** A thing's kind from its id ('thing:bench-3' → 'bench'), or null for an activity's own spot. */
export function thingKind(id: string): ThingKind | null {
  const m = /^thing:(bench|radio)(?:-[0-9]+)?$/.exec(id);
  return m ? (m[1] as ThingKind) : null;
}

/** Which bench a bench's id names ('thing:bench-3' → 3), or -1. */
export function benchNumber(id: string): number {
  const m = /^thing:bench-([0-9]+)$/.exec(id);
  return m ? Number(m[1]) : -1;
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
 * a duck paddles on the lake). The coast (2026-11-24, docs/town.md §7 "The coast and the mountains"): 'lighthouse'
 * (on 2 × 2 tiles, about 4.5 tall, its lamp lit at night), 'hut' (a beach hut on 2 × 2 tiles, its door on the +y side),
 * 'umbrella' (a beach umbrella with a lounger, one tile), 'boulder' (a big rock on 2 × 2 tiles), and loose ones: 'boat'
 * (a rowing boat bobbing at `at` on the water, lying along `dir`), 'jetty' (a plank walk from `at` out over the
 * water `len` tiles along `dir`, towards +x or +y; seen only, not walked on).
 */
export type SceneryKind = 'hill' | 'barn' | 'well' | 'haybale' | 'fence' | 'hedge' | 'rock' | 'bush' | 'duck' | 'lighthouse' | 'hut' | 'umbrella' | 'boulder' | 'boat' | 'jetty';

export interface WorldScenery {
  kind: SceneryKind;
  /** The tiles it stands on (none for a hill or a duck). */
  tiles: readonly Tile[];
  /** Where it stands (tile coordinates) when that is not the middle of its tiles: a hill's top, a duck. */
  at?: Tile;
  /** Which way a fence or hedge runs: along x (a row) or along y (a column); a jetty goes out, a boat lies. */
  dir?: 'x' | 'y';
  /** A jetty's length out over the water (tiles). */
  len?: number;
  /** A hill: its radius (tiles), the height of its top (tile edges) and the radius of its flat top (tiles). */
  r?: number;
  h?: number;
  top?: number;
}

/** A part of town: its name (the HUD's travel menu), the box it covers and a walkable tile to arrive at. */
export interface WorldDistrict {
  id: 'plaza' | 'market' | 'homes' | 'civic' | 'station' | 'park' | 'farm' | 'woods' | 'orchard' | 'meadow' | 'forest' | 'fields' | 'lake' | 'hills' | 'country' | 'beach' | 'harbor' | 'cape';
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
  /** One string per row, one character per tile: '.' grass, '=' path, 'o' plaza, '~' water, ':' sand, 'T' / 't' a tree on grass, 'p' a palm on sand, 'F' the fountain on the plaza. */
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
  /** The sea lies past the map's near edges (x or y from `size` on): the coast's shore runs on out there (three/scene/shore.ts seaShore). Left out in small test worlds. */
  coast?: boolean;
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

// Districts by their rows and columns (WORLD_DISTRICTS has the boxes). The town (x 16..59, y 12..55): the woods and
// the hill at its top left, the market street and the farm along its top right, the lake on its left, the plaza in
// the middle (the fountain at 37,33), the orchard on its right, the homes at its bottom left, the main road with the
// civic buildings down to the bus station at its bottom right, the meadow and a copse at its bottom. Round it: the
// pine forest and the big hill (x 0..15 and y 0..11 on the left), the fields (y 0..11 on the right and down the
// right edge), the big lake (x 0..15 below the forest), the grassy hills and the lotus pond (y 56..71), the country
// road with the orchard (x 60..71).
//                                       x: 0         1         2         3         4         5         6         7         8
//                                          012345678901234567890123456789012345678901234567890123456789012345678901234567890123
export const WORLD_ROWS: readonly string[] = [
  /* y=0  */ 'ttttttTtttTtttttTttttttttTttt.tttt..T.T..ttTT..TT....=.TT...tttttttT.T.t.......:~~~~',
  /* y=1  */ 'tttttttttttttTTttttTttttttTtt......................t.=.......TTttTT..T.........:~~~~',
  /* y=2  */ 'tttTtttTttttttttttTtttTTttttT......................T.=.........t....T..T.......:~~~~',
  /* y=3  */ 'ttttTtTtttttttttTttTtttTttttT........................=.......TT...T....T......:~~~~~',
  /* y=4  */ 'TttTtttt...tt..ttTTtT..t..Ttt........................=.......T........Tt.....:~~~~~~',
  /* y=5  */ 'tTttttt...t.t...tTTt.t...............................=................tt.....:~~~~~~',
  /* y=6  */ 'tttTt...T.....t........=============.......===================.........T.....:~~~~~~',
  /* y=7  */ 'tTtt.t......t....=======...........=========.........=.......=====....tT......:~~~~~',
  /* y=8  */ 'tTtt..T....tt.====.......TttTtttt............T.......=...........=....Tt...t..:~~~~~',
  /* y=9  */ 'Tttt..........=....ttt.tTtttttttt..TT................=...........=....tt...t..:~~~~~',
  /* y=10 */ 'tttt..t.......=.ttttttTtttTtTtttT....................=...........=.....T.......:~~~~',
  /* y=11 */ 'ttt........====..TttttttttTtTTTtt...t................=...........=....TT........:~~~',
  /* y=12 */ 'ttT...........=.TtTttttTtTtTtTTtTtTTttTTtTTTtT.TTTTT.=.TTT.......=..........p::::~~~',
  /* y=13 */ 'tttt.t......t.=.TTTtTTtt.T.TtTtttTtTtTtTtTtTTT.tT....=...........=....T.....:::::~~~',
  /* y=14 */ 'ttTT....T.....=.tTtttt......TTtTTtttTT.TT............=...........=....Tt....:p:::~~~',
  /* y=15 */ 'tttTt.........=.tttTTtt......tTttTtTTT..TT.T..T......==..........=.....TT...p::::~~~',
  /* y=16 */ 'ttttt.....t...=.tttttt......t.TtttTtTt.TTT..T.........=..........=.....t..TTpp:::~~~',
  /* y=17 */ 'tttTT.tt.TtT..=.TttTT......T...tTttTtT..TT.t...t......=..........=....TT....:::::~~~',
  /* y=18 */ 'TtTtt.ttttttt.=.T..tt....====.TtTTtTTtT...............=..........=....T....Tp::::~~~',
  /* y=19 */ 'ttttT..ttTtT..=...Ttt...==..===TTT....................=..........=......T...:::::~~~',
  /* y=20 */ 'Ttttt.TTtTttt.=......TT..==...==.....................==.........==.........T:::::~~~',
  /* y=21 */ 'ttTtttttttttT.=.T........T=.TtT==................======....T....=.......T..T:::::~~~',
  /* y=22 */ 'ttttttttTtTTt.===T........==....==.......=========....==........=.....TT....:p:::~~~',
  /* y=23 */ 'tttttTTtttttT...============.....===T..===.............=........=.....tt.T.p:::::~~~',
  /* y=24 */ 'ttttttTtttTtt.t.Tt...=~~~~.==..T...==.==...............=======..=.....Tt....:p:::~~~',
  /* y=25 */ 'TtTTttttttttt.tt....~~~~~~~~==....T.===...........T....=.....====.T...tT.T..:p:::~~~',
  /* y=26 */ 'TttTtTttt.tt.t.....~~~~~~~~~~=.......=................==.T......=...T.TtT..T.p::::~~',
  /* y=27 */ 'tT....t...t........~~~~~~~~~~==....t.=................=.........=...TT.TT....:::::~~',
  /* y=28 */ 'T...T..T.Tt....===.~~~~~~~~~~.=......=...............==.T.......==.Tt........p::::~~',
  /* y=29 */ 't.T............=.=.~~~~~~~~~~.=....ooooo............==.TT........=....TT...T.:::::~~',
  /* y=30 */ 'T.T...t........=T==.~~~~~~~~..=...ooooooo..........==....TTtT.T..============:::::~~',
  /* y=31 */ '...............=..=T..~~~~....=..ooooooooo.......===.............=.....T..TT.:::::~~',
  /* y=32 */ '================tt==..........=..ooooooooo.....===......TT..T.T..=....Tt.....:::::~~',
  /* y=33 */ '...............=tt.====......====ooooFoooo======.T...............=.....T.TT..:p:::~~',
  /* y=34 */ '.t.....~~......=T.....========t..ooooooooo...............T..T.T..=........TT.:p:::~~',
  /* y=35 */ 't....~~~~~~..t.=T................ooooooooo..............t........=...........:::::~~',
  /* y=36 */ 't...~~~~~~~~...=T.T.tt.......t....ooooooo...................T....=..T........:::::~~',
  /* y=37 */ 't...~~~~~~~~...=T.....t..........==ooooo.===......T......t.T.....=..T.tT.....:::::~~',
  /* y=38 */ '...~~~~~~~~~~..=T...............==.....T..===......t...T....T....=..TtTt.....:::::~~',
  /* y=39 */ '...~~~~~~~~~~..=.T..T..........==..........===.....T...TT........=..T.tTT...:::::~~~',
  /* y=40 */ '~~~~~~~~~~~~~..=.....TT........=......T.....===.........T...T.T.==.t........pp:::~~~',
  /* y=41 */ '~~~~~~~~~~~~~..=t...t.........==....T........===......T.........=..t..tT...p::::~~~~',
  /* y=42 */ 'tt.~~~~~~~~~~..=T............==...............==.....T.TT...T.T.=.....T..T.:p:::~~~~',
  /* y=43 */ 'tt.~~~~~~~~~~..=T...........===.....T.........===.......T.......=..........:::::~~~~',
  /* y=44 */ 'tt.~~~~~~~~~~..=...........==.===..............==...........T.T.=.....Tt....:::::~~~',
  /* y=45 */ 'T..~~~~~~~~~~..=T........===....==.............===........TT....=....TTT.T.T.:::::~~',
  /* y=46 */ '.T..~~~~~~~~...=........==.......====.........=====........TT.T.=.......TT...p::::~~',
  /* y=47 */ '....~~~~~~~~...=......===...........====...====..===............==....TT.T...:::::~~',
  /* y=48 */ 't....~~~~~~....=T....==................=====......===......T.....=....Tt...T.:::::~~',
  /* y=49 */ 't..............=T...==.......T....T.........t......===.......Tt..=....tt...T.:::::~~',
  /* y=50 */ 'tt...t.........=T..==t......T...............TT......====....Tt...=.....t....p:===:~~',
  /* y=51 */ 'ttT............=.===tTT..T.....t........T....t........===........=...........:===:~~',
  /* y=52 */ 'tt.............===.tTT.......Tt.....TTT......T.........==========================:~~',
  /* y=53 */ 'Tt...........t.=....ttt..T....T....T...Tt.......TT.....====...............=.T:===:~~',
  /* y=54 */ 'TtT....t...T...=....T..........t.......T.T...t.....T..t...=...........Tt..=..:===:~~',
  /* y=55 */ 'Tt.......T.....=..T...ttT............t.t....T....T......T.=Tt..........t..=.p::::~~~',
  /* y=56 */ 'T.......tTT....=..TT..........T.T...............t........==.T.........tt..=T:::::~~~',
  /* y=57 */ 'T.t....ttttt...==.tT...........T.T.........T.............=............ttTT=.:::::~~~',
  /* y=58 */ 'tTt.....Tt.t....=..t.tT.T..t..T..........................=.tT..TT......T..=.:::::~~~',
  /* y=59 */ 'TT.......T....t.=......t..TT.t.....==============....=====..T.Ttt.........=.:::::~~~',
  /* y=60 */ 'TtT.....Ttttt...======.........=====............======......Tt.TT......t..=.:p:::~~~',
  /* y=61 */ 'ttT......Tt..........===========.......~~~~................tT..TT.....Tt..=.:::::~~~',
  /* y=62 */ 'ttt.......Tt...............=..........~~~~~~...................T........T.=.:::::~~~',
  /* y=63 */ 'tttTt.TT.TT................=.T.Tt.....~~~~~~...................Tt..T..t.T.=:::::~~~~',
  /* y=64 */ 'ttTT..t.t.TT...............=..tTTT....~~~~~~...................T..........=:::::~~~~',
  /* y=65 */ 'T..t....t...t....T.........=..TtTT.....~~~~...........................t...=:::::~~~~',
  /* y=66 */ 'T...T....T....T.T..........=..........................................T...=p::::~~~~',
  /* y=67 */ '........ttttT.T............=........................................T.....=:::::~~~~',
  /* y=68 */ 't.t..t...T.tT..............=....t...TT.............t.TTt.t................=:::::~~~~',
  /* y=69 */ 'Tt..tTT.tt.t.......T.t.....=.t......T................TtTTT.......T........=:::::~~~~',
  /* y=70 */ 'Ttt.tttttt.tTt.t.T..T.T....=.....TTT..TTT...........Ttt.......T.T.TTT..t..=:::::~~~~',
  /* y=71 */ 'ttT..tTttT........T.t......=..tT.TtT...TT....ttT.....T..T..T......TTTT.T..=::::~~~~~',
  /* y=72 */ '....t......t............T..=.........T.......T............T.T.............=p::::~~~~',
  /* y=73 */ '......t.......T....T.......=..............................T..........T...T=.::::~~~~',
  /* y=74 */ '============================================================================..:~~~~~',
  /* y=75 */ '..tt...........T......::p:::::::Tp......p......T......p..T..p..............==..:~~~~',
  /* y=76 */ '..t.t....t..........p:::::p::::p::......p::::.....T.:::p:::::::::p..T:::::..==..:~~~',
  /* y=77 */ '.......t....::::::p::::::::::::::pp::::::::::::p:::p::::::::pp::::ppp:::::...==..:~~',
  /* y=78 */ '............:::::pp::::::::::::::::p:::p:::::::::::::::::::::::::::::::::::..t....:~',
  /* y=79 */ '::..........::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::~:......:~',
  /* y=80 */ '~~:::::::...::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::::~~:.....~~',
  /* y=81 */ '~~~~~~~~~:::::::::::::::::::::::::::::::~~~~~:::::::~~~~~~~~~~~~~~:::~~~~~~~~:..~~~~',
  /* y=82 */ '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  /* y=83 */ '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
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
  place('square', 'Quảng trường', 'Leo', [33, 30, 2, 2], 'x', [35, 31], [35, 32]),
  place('cafe', 'Quán cà phê', 'Emma', [38, 27, 3, 2], 'y', [39, 29], [40, 29]),
  // the residential lane (south-west)
  place('friend', 'Nhà bạn', 'Mia', [25, 42, 2, 2], 'x', [27, 43], [27, 42]),
  place('home', 'Nhà', 'Grace', [28, 38, 2, 2], 'x', [30, 39], [30, 40]),
  // the market street (north): the shops face the street from its north side
  place('shop', 'Cửa hàng', 'Ben', [40, 19, 2, 2], 'y', [41, 21], [40, 21]),
  place('phone', 'Tiệm điện thoại', 'Max', [46, 19, 2, 2], 'y', [46, 21], [47, 21]),
  place('board', 'Bảng tin', 'Tom', [50, 18, 2, 2], 'y', [50, 20], [51, 20]),
  // the main road (south-east): doors on both sides of it, down to the bus station where it leaves town
  place('office', 'Văn phòng', 'Sarah', [46, 37, 3, 2], 'y', [46, 39], [47, 39]),
  place('school', 'Trường học', 'Daniel', [42, 41, 2, 3], 'x', [44, 41], [44, 42]),
  place('clinic', 'Phòng khám', 'Kim', [43, 45, 2, 2], 'x', [45, 46], [45, 45]),
  place('cinema', 'Rạp phim', 'Zoe', [52, 45, 3, 2], 'y', [52, 47], [53, 47]),
  place('station', 'Bến xe', 'Sam', [56, 48, 2, 2], 'y', [56, 50], [57, 50]),
  // the park by the lake (west)
  place('park', 'Công viên', 'Lily', [26, 31, 2, 2], 'y', [26, 33], [27, 33]),
];

const T = (x: number, y: number): Tile => ({ x, y });
/** The tiles of a box: x..x+w-1, y..y+d-1. */
const area = (x: number, y: number, w: number, d: number): Tile[] => {
  const out: Tile[] = [];
  for (let j = y; j < y + d; j++) for (let i = x; i < x + w; i++) out.push(T(i, j));
  return out;
};

export const WORLD_PROPS: readonly WorldProp[] = [
  // the café's table under a parasol, beside its side wall
  { kind: 'terrace', tiles: [T(41, 28)] },
  // the bus waits in a lay-by where the main road leaves town
  { kind: 'bus', tiles: [T(56, 53), T(57, 53)] },
  // the boarding house ("nhà trọ") at the far end of the residential lane: whoever has no house of their own yet lodges here
  { kind: 'inn', tiles: [T(19, 43), T(20, 43), T(21, 43), T(19, 44), T(20, 44), T(21, 44)] },
  // the notice board with the album, on the market street
  { kind: 'board', tiles: [T(48, 20)] },
  // the farm's two fields, four tiles of soil rows by two each, east of the farm lane (the first one is the activity's)
  { kind: 'farm', tiles: [T(55, 15), T(56, 15), T(57, 15), T(58, 15), T(55, 16), T(56, 16), T(57, 16), T(58, 16)] },
  { kind: 'farm', tiles: [T(55, 18), T(56, 18), T(57, 18), T(58, 18), T(55, 19), T(56, 19), T(57, 19), T(58, 19)] },
  // a wooden pier from the lake's east shore over the water (the water tiles are blocked already)
  { kind: 'pier', tiles: [], at: { x: 29.2, y: 27.5 } },
  // the egg kiosk on the plaza's east side, where the east lane leaves it
  { kind: 'kiosk', tiles: [T(41, 34)] },
  // the market stalls: two between the shop and the phone shop, one across the street
  { kind: 'market', tiles: [T(43, 20)], v: 0 },
  { kind: 'market', tiles: [T(44, 20)], v: 1 },
  { kind: 'market', tiles: [T(45, 24)], v: 0 },
  // benches anybody may sit on, from the first day
  { kind: 'bench', tiles: [T(33, 34)], dir: 'e' }, // the plaza, looking at the fountain
  { kind: 'bench', tiles: [T(23, 22)], dir: 's' }, // the lake's north shore, over the water
  { kind: 'bench', tiles: [T(17, 26)], dir: 'e' }, // the lake's west shore
  { kind: 'bench', tiles: [T(23, 18)], dir: 'e' }, // the hill's top: the view over the town
  { kind: 'bench', tiles: [T(24, 17)], dir: 's' },
  { kind: 'bench', tiles: [T(32, 41)], dir: 'e' }, // the residential lane
  { kind: 'bench', tiles: [T(54, 47)], dir: 's' }, // the bus stop
  { kind: 'bench', tiles: [T(52, 25)], dir: 's' }, // the orchard
  { kind: 'bench', tiles: [T(36, 49)], dir: 's' }, // the meadow, by the copse
  // lanterns by the boarding house, the pier and the bus stop; planters on the market street, by the boarding house
  // and in Grace's front garden; signposts where the hill path forks and where the east lane bends
  { kind: 'lantern', tiles: [T(18, 46)] },
  { kind: 'lantern', tiles: [T(30, 26)] },
  { kind: 'lantern', tiles: [T(55, 46)] },
  { kind: 'planter', tiles: [T(42, 21)] },
  { kind: 'planter', tiles: [T(23, 45)] },
  { kind: 'planter', tiles: [T(31, 38)] },
  { kind: 'signpost', tiles: [T(26, 19)] },
  { kind: 'signpost', tiles: [T(49, 30)] },
  // ── the countryside (2026-11-22) ──
  // the fields along the track north of the town: the town's own, always in leaf
  { kind: 'farm', tiles: area(37, 2, 4, 3) },
  { kind: 'farm', tiles: area(44, 2, 4, 3) },
  { kind: 'farm', tiles: area(56, 2, 4, 3) },
  { kind: 'farm', tiles: area(38, 9, 4, 2) },
  { kind: 'farm', tiles: area(57, 9, 4, 2) },
  { kind: 'farm', tiles: area(67, 14, 2, 4) },
  // a fruit stall under the orchard on the country road
  { kind: 'market', tiles: [T(63, 37)], v: 1 },
  // benches: the big hill's lookout (two, like the old hill's), the big lake's north shore and east shore, the
  // grassy hill, the pond, the rest stop where the country road meets the main road
  { kind: 'bench', tiles: [T(8, 11)], dir: 'e' },
  { kind: 'bench', tiles: [T(9, 10)], dir: 's' },
  { kind: 'bench', tiles: [T(10, 31)], dir: 's' },
  { kind: 'bench', tiles: [T(14, 41)], dir: 'w' },
  { kind: 'bench', tiles: [T(23, 66)], dir: 'e' },
  { kind: 'bench', tiles: [T(46, 60)], dir: 's' },
  { kind: 'bench', tiles: [T(66, 50)], dir: 'w' },
  // lanterns where the lake road meets the shore walk and at the rest stop; signposts at the forks
  { kind: 'lantern', tiles: [T(14, 31)] },
  { kind: 'lantern', tiles: [T(66, 51)] },
  { kind: 'signpost', tiles: [T(16, 29)] },
  { kind: 'signpost', tiles: [T(54, 7)] },
  { kind: 'signpost', tiles: [T(13, 21)] },
  { kind: 'signpost', tiles: [T(14, 53)] },
  // ── the coast (2026-11-24) ──
  // benches along the beach promenade and the coast lane, looking out to sea; one under the lighthouse
  { kind: 'bench', tiles: [T(18, 75)], dir: 's' },
  { kind: 'bench', tiles: [T(37, 75)], dir: 's' },
  { kind: 'bench', tiles: [T(49, 75)], dir: 's' },
  { kind: 'bench', tiles: [T(58, 75)], dir: 's' },
  { kind: 'bench', tiles: [T(75, 43)], dir: 'e' },
  { kind: 'bench', tiles: [T(75, 58)], dir: 'e' },
  { kind: 'bench', tiles: [T(76, 77)], dir: 's' },
  // lanterns where the footpath comes down to the beach, on the promenade and on the quay; signposts at the forks
  { kind: 'lantern', tiles: [T(26, 73)] },
  { kind: 'lantern', tiles: [T(45, 75)] },
  { kind: 'lantern', tiles: [T(77, 51)] },
  { kind: 'lantern', tiles: [T(77, 53)] },
  { kind: 'signpost', tiles: [T(28, 73)] },
  { kind: 'signpost', tiles: [T(75, 73)] },
  { kind: 'signpost', tiles: [T(66, 29)] },
  // the fish stall on the harbour's quay
  { kind: 'market', tiles: [T(77, 50)], v: 0 },
];

/** Scenery for the 3D town (what stands up blocks as much as it is big: core/town/colliders.ts). */
export const WORLD_SCENERY: readonly WorldScenery[] = [
  // the hill in the woods: its top is the viewpoint with the two benches
  { kind: 'hill', tiles: [], at: { x: 24, y: 18 }, r: 5.5, h: 1.6, top: 1.25 },
  // the farm: the barn west of the farm lane, a well, hay bales
  { kind: 'barn', tiles: [T(50, 14), T(51, 14), T(52, 14), T(50, 15), T(51, 15), T(52, 15)] },
  { kind: 'well', tiles: [T(57, 22)] },
  { kind: 'haybale', tiles: [T(49, 16)] },
  { kind: 'haybale', tiles: [T(52, 17)] },
  // the front gardens of the residential lane
  { kind: 'fence', tiles: [T(26, 40), T(27, 40)], dir: 'x' },
  { kind: 'fence', tiles: [T(24, 41)], dir: 'x' },
  { kind: 'hedge', tiles: [T(34, 40), T(34, 41), T(34, 42)], dir: 'y' },
  { kind: 'hedge', tiles: [T(23, 49), T(24, 49), T(25, 49)], dir: 'x' },
  // a few stones and bushes
  { kind: 'rock', tiles: [T(19, 21)] },
  { kind: 'rock', tiles: [T(42, 51)] },
  { kind: 'bush', tiles: [T(50, 35)] },
  { kind: 'bush', tiles: [T(28, 47)] },
  // ducks on the lake
  { kind: 'duck', tiles: [], at: { x: 22.5, y: 27.5 } },
  { kind: 'duck', tiles: [], at: { x: 25.4, y: 28.4 } },
  { kind: 'duck', tiles: [], at: { x: 24.2, y: 29.6 } },
  // ── the countryside (2026-11-22) ──
  // the big hill in the pine forest (its top the lookout), two grassy hills at the near side
  { kind: 'hill', tiles: [], at: { x: 9, y: 11 }, r: 6.5, h: 1.9, top: 1.5 },
  { kind: 'hill', tiles: [], at: { x: 24, y: 66 }, r: 5.5, h: 1.2, top: 1 },
  { kind: 'hill', tiles: [], at: { x: 49, y: 66 }, r: 5, h: 1.1, top: 1 },
  // the fields: a second barn by the country road with its well, hay bales by the fields, a fence between the country road and its field
  { kind: 'barn', tiles: area(60, 14, 3, 2) },
  { kind: 'well', tiles: [T(63, 17)] },
  { kind: 'haybale', tiles: [T(30, 3)] },
  { kind: 'haybale', tiles: [T(32, 4)] },
  { kind: 'haybale', tiles: [T(50, 3)] },
  { kind: 'haybale', tiles: [T(43, 10)] },
  { kind: 'fence', tiles: area(66, 14, 1, 4), dir: 'y' },
  // a few stones and bushes in the countryside
  { kind: 'rock', tiles: [T(5, 8)] },
  { kind: 'rock', tiles: [T(2, 37)] },
  { kind: 'rock', tiles: [T(52, 63)] },
  { kind: 'bush', tiles: [T(13, 46)] },
  { kind: 'bush', tiles: [T(36, 62)] },
  { kind: 'bush', tiles: [T(67, 45)] },
  // ducks on the big lake and the pond
  { kind: 'duck', tiles: [], at: { x: 7.5, y: 40.5 } },
  { kind: 'duck', tiles: [], at: { x: 9.8, y: 43.6 } },
  { kind: 'duck', tiles: [], at: { x: 6.2, y: 45.2 } },
  { kind: 'duck', tiles: [], at: { x: 40.5, y: 63.4 } },
  { kind: 'duck', tiles: [], at: { x: 42.6, y: 64.2 } },
  // ── the coast (2026-11-24) ──
  // the lighthouse on its knoll at the cape's tip
  { kind: 'hill', tiles: [], at: { x: 79, y: 79 }, r: 4.4, h: 1, top: 1.5 },
  { kind: 'lighthouse', tiles: area(79, 79, 2, 2) },
  // beach huts in the dunes, umbrellas on the sand
  { kind: 'hut', tiles: area(41, 77, 2, 2) },
  { kind: 'hut', tiles: area(44, 77, 2, 2) },
  { kind: 'hut', tiles: area(56, 77, 2, 2) },
  { kind: 'umbrella', tiles: [T(14, 79)] },
  { kind: 'umbrella', tiles: [T(19, 80)] },
  { kind: 'umbrella', tiles: [T(35, 80)] },
  { kind: 'umbrella', tiles: [T(38, 79)] },
  { kind: 'umbrella', tiles: [T(48, 80)] },
  { kind: 'umbrella', tiles: [T(60, 79)] },
  { kind: 'umbrella', tiles: [T(64, 80)] },
  { kind: 'umbrella', tiles: [T(79, 21)] },
  { kind: 'umbrella', tiles: [T(79, 36)] },
  { kind: 'umbrella', tiles: [T(78, 62)] },
  // the rocky shores: boulders and stones
  { kind: 'boulder', tiles: area(73, 2, 2, 2) },
  { kind: 'boulder', tiles: area(4, 78, 2, 2) },
  { kind: 'rock', tiles: [T(75, 78)] },
  { kind: 'rock', tiles: [T(77, 81)] },
  { kind: 'rock', tiles: [T(76, 6)] },
  { kind: 'rock', tiles: [T(9, 80)] },
  // the harbour's jetty and boats on the sea
  { kind: 'jetty', tiles: [], at: { x: 81.6, y: 52.5 }, dir: 'x', len: 7 },
  { kind: 'boat', tiles: [], at: { x: 84.2, y: 50.4 }, dir: 'x' },
  { kind: 'boat', tiles: [], at: { x: 83.4, y: 54.8 }, dir: 'y' },
  { kind: 'boat', tiles: [], at: { x: 30.5, y: 82.6 }, dir: 'x' },
  { kind: 'boat', tiles: [], at: { x: 57.5, y: 83.2 }, dir: 'y' },
];

/** The parts of town (the 3D HUD's travel menu). */
export const WORLD_DISTRICTS: readonly WorldDistrict[] = [
  { id: 'plaza', name: 'Quảng trường', x: 32, y: 27, w: 11, d: 12, arrive: T(38, 35) },
  { id: 'market', name: 'Phố chợ', x: 38, y: 17, w: 16, d: 9, arrive: T(43, 22) },
  { id: 'homes', name: 'Xóm nhà', x: 16, y: 36, w: 19, d: 17, arrive: T(29, 43) },
  { id: 'civic', name: 'Đường lớn', x: 41, y: 36, w: 15, d: 12, arrive: T(46, 42) },
  { id: 'station', name: 'Bến xe', x: 51, y: 47, w: 9, d: 9, arrive: T(55, 51) },
  { id: 'park', name: 'Công viên bên hồ', x: 16, y: 22, w: 16, d: 14, arrive: T(30, 33) },
  { id: 'farm', name: 'Nông trại', x: 48, y: 12, w: 12, d: 11, arrive: T(54, 17) },
  { id: 'woods', name: 'Đồi và rừng', x: 16, y: 12, w: 17, d: 10, arrive: T(25, 18) },
  { id: 'orchard', name: 'Vườn cây', x: 46, y: 24, w: 14, d: 12, arrive: T(50, 31) },
  { id: 'meadow', name: 'Bãi cỏ', x: 30, y: 39, w: 16, d: 17, arrive: T(40, 48) },
  // the countryside round the town (2026-11-22)
  { id: 'forest', name: 'Rừng thông', x: 0, y: 0, w: 33, d: 27, arrive: T(14, 15) },
  { id: 'fields', name: 'Cánh đồng', x: 33, y: 0, w: 39, d: 12, arrive: T(50, 6) },
  { id: 'lake', name: 'Hồ lớn', x: 0, y: 27, w: 16, d: 29, arrive: T(15, 40) },
  { id: 'hills', name: 'Đồi cỏ', x: 0, y: 56, w: 60, d: 16, arrive: T(40, 59) },
  { id: 'country', name: 'Đường quê', x: 60, y: 12, w: 12, d: 60, arrive: T(65, 30) },
  // the coast round the island's near sides (2026-11-24)
  { id: 'beach', name: 'Bãi biển', x: 0, y: 72, w: 72, d: 12, arrive: T(40, 74) },
  { id: 'harbor', name: 'Bến cảng', x: 72, y: 0, w: 12, d: 64, arrive: T(78, 52) },
  { id: 'cape', name: 'Mũi hải đăng', x: 72, y: 64, w: 12, d: 20, arrive: T(77, 77) },
];

/** Where each activity is done (src/features/town/activities). */
/**
 * The things that can be used: every bench that is there from the first day (the player stands in front of it, where
 * a resident steps off it: WORLD_LIFE.seats `from`), and the radio on the café's terrace table.
 */
export const WORLD_THINGS: Readonly<Record<ThingId, ActivitySpot>> = (() => {
  const out: Record<ThingId, ActivitySpot> = {};
  let n = 0;
  for (const p of WORLD_PROPS) {
    if (p.kind !== 'bench') continue;
    const at = p.tiles[0];
    const stand = p.dir === 'e' ? T(at.x + 1, at.y) : p.dir === 'w' ? T(at.x - 1, at.y) : T(at.x, at.y + 1);
    out[`thing:bench-${n++}`] = { stand, look: { x: at.x + 0.5, y: at.y + 0.5 }, box: { x: at.x + 0.5, y: at.y + 0.5, w: 0.85, d: 0.85, h: 0.6 } };
  }
  out['thing:radio'] = { stand: T(41, 29), look: { x: 41.5, y: 28.5 }, box: { x: 41.5, y: 28.5, w: 0.9, d: 0.9, h: 1.0 } };
  return out;
})();

export const WORLD_ACTIVITIES: Readonly<Record<ActivitySpotId, ActivitySpot>> = {
  fish: { stand: T(29, 27), look: { x: 28.2, y: 27.5 }, prop: 'pier' },
  farm: { stand: T(56, 14), look: { x: 56.5, y: 15.6 }, prop: 'farm' },
  eggs: { stand: T(41, 35), look: { x: 41.5, y: 34.5 }, prop: 'kiosk' },
  wardrobe: { stand: T(20, 45), look: { x: 20.5, y: 44.4 }, prop: 'inn' },
  album: { stand: T(48, 21), look: { x: 48.5, y: 20.5 }, prop: 'board' },
  ...WORLD_THINGS,
};

/** Octants (sim.ts OCTANTS): 0 = +x (SE on the screen), 2 = +y (SW), 4 = -x (NW), 6 = -y (NE). */
const SE = 0;
const SW = 2;
const NW = 4;
const NE = 6;

export const WORLD_LIFE: WorldLife = {
  seats: [
    // the fixed benches: two seats each
    { x: 33.5, y: 34.33, oct: SE, from: T(34, 34) },
    { x: 33.5, y: 34.67, oct: SE, from: T(34, 34) },
    { x: 23.33, y: 22.5, oct: SW, from: T(23, 23) },
    { x: 23.67, y: 22.5, oct: SW, from: T(23, 23) },
    { x: 17.5, y: 26.33, oct: SE, from: T(18, 26) },
    { x: 17.5, y: 26.67, oct: SE, from: T(18, 26) },
    { x: 23.5, y: 18.33, oct: SE, from: T(24, 18) },
    { x: 23.5, y: 18.67, oct: SE, from: T(24, 18) },
    { x: 24.33, y: 17.5, oct: SW, from: T(24, 18) },
    { x: 24.67, y: 17.5, oct: SW, from: T(24, 18) },
    { x: 32.5, y: 41.33, oct: SE, from: T(33, 41) },
    { x: 32.5, y: 41.67, oct: SE, from: T(33, 41) },
    { x: 54.33, y: 47.5, oct: SW, from: T(54, 48) },
    { x: 54.67, y: 47.5, oct: SW, from: T(54, 48) },
    { x: 52.33, y: 25.5, oct: SW, from: T(52, 26) },
    { x: 52.67, y: 25.5, oct: SW, from: T(52, 26) },
    { x: 36.33, y: 49.5, oct: SW, from: T(36, 50) },
    { x: 36.67, y: 49.5, oct: SW, from: T(36, 50) },
    // the countryside's benches
    { x: 8.5, y: 11.33, oct: SE, from: T(9, 11) },
    { x: 8.5, y: 11.67, oct: SE, from: T(9, 11) },
    { x: 9.33, y: 10.5, oct: SW, from: T(9, 11) },
    { x: 9.67, y: 10.5, oct: SW, from: T(9, 11) },
    { x: 10.33, y: 31.5, oct: SW, from: T(10, 32) },
    { x: 10.67, y: 31.5, oct: SW, from: T(10, 32) },
    { x: 14.5, y: 41.33, oct: NW, from: T(13, 41) },
    { x: 14.5, y: 41.67, oct: NW, from: T(13, 41) },
    { x: 23.5, y: 66.33, oct: SE, from: T(24, 66) },
    { x: 23.5, y: 66.67, oct: SE, from: T(24, 66) },
    { x: 46.33, y: 60.5, oct: SW, from: T(46, 61) },
    { x: 46.67, y: 60.5, oct: SW, from: T(46, 61) },
    { x: 66.5, y: 50.33, oct: NW, from: T(65, 50) },
    { x: 66.5, y: 50.67, oct: NW, from: T(65, 50) },
    // the coast's benches (2026-11-24)
    { x: 18.33, y: 75.5, oct: SW, from: T(18, 76) },
    { x: 18.67, y: 75.5, oct: SW, from: T(18, 76) },
    { x: 37.33, y: 75.5, oct: SW, from: T(37, 76) },
    { x: 37.67, y: 75.5, oct: SW, from: T(37, 76) },
    { x: 49.33, y: 75.5, oct: SW, from: T(49, 76) },
    { x: 49.67, y: 75.5, oct: SW, from: T(49, 76) },
    { x: 58.33, y: 75.5, oct: SW, from: T(58, 76) },
    { x: 58.67, y: 75.5, oct: SW, from: T(58, 76) },
    { x: 75.5, y: 43.33, oct: SE, from: T(76, 43) },
    { x: 75.5, y: 43.67, oct: SE, from: T(76, 43) },
    { x: 75.5, y: 58.33, oct: SE, from: T(76, 58) },
    { x: 75.5, y: 58.67, oct: SE, from: T(76, 58) },
    { x: 76.33, y: 77.5, oct: SW, from: T(76, 78) },
    { x: 76.67, y: 77.5, oct: SW, from: T(76, 78) },
    // the café's stool facing its table
    { x: 41.22, y: 28.5, oct: SE, from: T(41, 29) },
    // the benches the learner buys
    { x: 36.33, y: 36.5, oct: SW, from: T(36, 37), needs: 'benches' },
    { x: 36.67, y: 36.5, oct: SW, from: T(36, 37), needs: 'benches' },
    { x: 25.33, y: 35.5, oct: SW, from: T(25, 36), needs: 'benches' },
    { x: 25.67, y: 35.5, oct: SW, from: T(25, 36), needs: 'benches' },
    { x: 40.33, y: 45.5, oct: SW, from: T(40, 46), needs: 'benches' },
    { x: 40.67, y: 45.5, oct: SW, from: T(40, 46), needs: 'benches' },
  ],
  // spread over the districts, so a chat can happen anywhere in town
  chats: [
    [T(39, 34), T(40, 33)],
    [T(35, 34), T(36, 33)],
    [T(44, 22), T(45, 21)],
    [T(28, 45), T(29, 44)],
    [T(32, 43), T(33, 42)],
    [T(23, 35), T(24, 34)],
    [T(51, 29), T(52, 28)],
    [T(48, 41), T(49, 40)],
    [T(53, 52), T(54, 51)],
    [T(51, 22), T(52, 21)],
    [T(38, 50), T(39, 49)],
    [T(25, 16), T(26, 15)],
    // the countryside: the fields' track, the forest trail, the lake road, the hills' lane, the country road
    [T(50, 7), T(51, 6)],
    [T(13, 15), T(14, 14)],
    [T(14, 36), T(15, 35)],
    [T(30, 62), T(31, 61)],
    [T(64, 33), T(65, 32)],
    // the coast: the beach, the quay, the dunes
    [T(24, 76), T(25, 75)],
    [T(78, 51), T(79, 50)],
    [T(62, 77), T(63, 76)],
  ],
  tend: [
    { at: T(55, 14), oct: SW },
    { at: T(58, 14), oct: SW },
    { at: T(56, 17), oct: SW },
    { at: T(23, 46), oct: NE },
    { at: T(31, 39), oct: NE },
    { at: T(42, 22), oct: NE },
    { at: T(35, 29), oct: SE, needs: 'flowers' },
    { at: T(28, 30), oct: SW, needs: 'flowers' },
    { at: T(27, 39), oct: NW, needs: 'flowers' },
    { at: T(23, 42), oct: NW, needs: 'flowers' },
    // the fields along the track
    { at: T(39, 5), oct: NE },
    { at: T(46, 5), oct: NE },
    { at: T(58, 5), oct: NE },
    { at: T(40, 8), oct: SW },
    { at: T(59, 8), oct: SW },
  ],
  // on the lake's west and north shores, looking over the water towards the viewer
  fish: [
    { at: T(18, 27), oct: SE },
    { at: T(18, 29), oct: SE },
    { at: T(24, 23), oct: SW },
    { at: T(20, 24), oct: SW },
    // the big lake's east shore, looking west over it
    { at: T(13, 39), oct: NW },
    { at: T(13, 44), oct: NW },
    // where the jetty leaves the harbour's quay, looking out to sea
    { at: T(81, 52), oct: SE },
  ],
  read: [{ at: T(48, 21), oct: NE }],
  shop: [
    { at: T(43, 21), oct: NE },
    { at: T(44, 21), oct: NE },
    { at: T(45, 25), oct: NE },
    { at: T(63, 38), oct: NE },
    { at: T(78, 50), oct: NW },
  ],
  jog: [T(37, 30), T(40, 31), T(41, 33), T(40, 36), T(37, 37), T(34, 36), T(33, 33), T(35, 30)],
  // the ways in and out: the harbour (by boat), the farm lane north and the lake's shore walk west into the mountains'
  // passes, the coast road west along the beach
  ends: [T(80, 52), T(53, 0), T(0, 32), T(0, 74)],
  via: [T(43, 22), T(29, 43), T(40, 48), T(50, 31), T(24, 34), T(30, 29), T(47, 45), T(28, 23), T(55, 24), T(25, 19), T(52, 50), T(50, 6), T(14, 15), T(11, 11), T(15, 40), T(6, 32), T(40, 59), T(27, 66), T(65, 30), T(62, 25), T(65, 52), T(27, 74), T(50, 74), T(74, 62), T(79, 52), T(77, 77), T(72, 30)],
  inn: { door: T(20, 45), yard: [T(19, 45), T(21, 45), T(22, 46), T(18, 44), T(22, 43), T(18, 43), T(19, 46), T(21, 46)] },
};

const solid = (x: number, y: number, dir?: DecorSpot['dir']): DecorSpot => (dir ? { x, y, solid: true, dir } : { x, y, solid: true });
/** A street lamp: its arm over the path on its right on the screen, or (mirrored) on its left. */
const lamp = (x: number, y: number, side: 'right' | 'left'): DecorSpot => (side === 'left' ? { x, y, solid: true, flip: true } : { x, y, solid: true });
const loose = (x: number, y: number): DecorSpot => ({ x, y, solid: false });

/** Where each decoration appears once bought (and only then blocks the way, as much as its model is big). */
export const WORLD_DECORATIONS: Readonly<Record<DecorationId, readonly DecorSpot[]>> = {
  // round the plaza's rim
  // the start tile and its neighbours stay clear: nothing stands in front of the player when the page opens
  lamps1: [lamp(34, 29, 'right'), lamp(42, 31, 'left'), lamp(43, 34, 'right'), lamp(32, 35, 'right'), lamp(35, 38, 'right')],
  // flower beds: two framing the market street's way onto the plaza, the park, the front gardens, the school
  flowers: [solid(36, 29), solid(38, 29), solid(26, 39), solid(28, 31), solid(22, 42), solid(45, 44)],
  // one on the plaza, one by the lake path, one on the meadow (none beside the water)
  benches: [solid(36, 36, 's'), solid(25, 35, 's'), solid(40, 45, 's')],
  // blossom trees in the gardens, the orchard, by the lake and beside the café
  blossom: [solid(27, 37), solid(24, 39), solid(31, 45), solid(51, 27), solid(53, 33), solid(48, 35), solid(32, 27), solid(43, 29)],
  // along the streets, further out
  lamps2: [lamp(42, 23, 'right'), lamp(48, 23, 'right'), lamp(43, 40, 'right'), lamp(49, 43, 'left'), lamp(50, 49, 'right'), lamp(29, 41, 'right'), lamp(24, 45, 'right'), lamp(28, 33, 'left'), lamp(47, 34, 'right'), lamp(53, 18, 'right'), lamp(38, 46, 'left')],
  // two poles on the plaza; the strings run from the pavilion's roof to each pole and between the poles, over the fountain
  lights: [solid(39, 31), solid(35, 35)],
  // on the lake
  lilies: [loose(20.6, 26.4), loose(26.4, 25.6), loose(27.3, 29.2), loose(21.3, 30.1), loose(24.9, 24.6), loose(19.8, 28.6)],
  // on the plaza itself
  stall: [solid(40, 32)],
  fountain: [solid(37, 33)],
  // tied down next to things that are always there: the café, the park, the bus station
  balloons: [loose(40.4, 30.4), loose(29.6, 32.5), loose(55.6, 50.6)],
  // the school, the bus station, the market street, the plaza's south-west corner
  flags: [solid(45, 40), solid(58, 50), solid(46, 23), solid(32, 36)],
  // where the cat starts its walks: by the plaza's bench
  cat: [loose(34.5, 33.5)],
};

export const TOWN_WORLD: TownWorld = {
  size: 84,
  rows: WORLD_ROWS,
  places: WORLD_PLACES,
  props: WORLD_PROPS,
  decorations: WORLD_DECORATIONS,
  activities: WORLD_ACTIVITIES,
  life: WORLD_LIFE,
  scenery: WORLD_SCENERY,
  districts: WORLD_DISTRICTS,
  coast: true,
  plaza: { x: 37.5, y: 33.5, r: 4.6 },
  start: { x: 38, y: 35 },
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
  if (ch === ':' || ch === 'p') return 'sand';
  return 'grass';
}

export function worldTrees(world: TownWorld = TOWN_WORLD): WorldTree[] {
  const out: WorldTree[] = [];
  world.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (row[x] === 'T') out.push({ x, y, kind: 'round' });
      else if (row[x] === 't') out.push({ x, y, kind: 'pine' });
      else if (row[x] === 'p') out.push({ x, y, kind: 'palm' });
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

type Hill = WorldScenery & { at: Tile; r: number; h: number };
const HILLS = new WeakMap<readonly WorldScenery[], readonly Hill[]>();
const NO_HILLS: readonly Hill[] = [];

/** The hills among the scenery (kept per list: the ground's height is asked for every vertex of the 3D ground). */
function hillsOf(list: readonly WorldScenery[] | undefined): readonly Hill[] {
  if (!list) return NO_HILLS;
  let hills = HILLS.get(list);
  if (!hills) HILLS.set(list, (hills = list.filter((s): s is Hill => s.kind === 'hill' && !!s.at && !!s.r && !!s.h)));
  return hills;
}

/**
 * How high the ground is at a point of the tile grid (tile edges; 0 almost everywhere): the hills of the scenery,
 * a smooth bump that is `h` on its flat top (`top` tiles round its middle: the viewpoint's benches stand level) and 0
 * from `r` tiles out. The 3D town raises its ground, trees, things and people by it; walking ignores it (a slope
 * blocks nothing).
 */
export function groundHeight(x: number, y: number, world: TownWorld = TOWN_WORLD): number {
  let h = 0;
  const list = hillsOf(world.scenery);
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    const dx = x - (s.at.x + 0.5);
    const dy = y - (s.at.y + 0.5);
    if (dx * dx + dy * dy >= s.r * s.r) continue;
    const top = Math.min(s.top ?? 0, s.r * 0.9);
    const d = Math.max(0, (Math.hypot(dx, dy) - top) / (s.r - top));
    h = Math.max(h, (s.h * (1 + Math.cos(Math.PI * d))) / 2);
  }
  return h;
}
