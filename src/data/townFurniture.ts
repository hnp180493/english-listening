// Street furniture (docs/town.md §26; owner, 2026-11-26: "đồ đạc cũng đa dạng khác biệt lên"). Two things here:
//
//  - every district has its own bench and its own street lamp (DISTRICT_LOOKS), so a place can be told by its
//    furniture. A bench or a lamp keeps its spot (people sit there, the night's lights are placed there, saved data
//    holds only ids): what changes is which model is drawn there (three/scene/streetFurniture.ts);
//  - the small things of a street (bins, bike racks, post boxes, crates and barrels, flower pots, hydrants, newspaper
//    boxes, picnic tables) stand where they make sense: TOWN_FURNITURE, CITY_FURNITURE (Westbay's stretched map).
//    Each is solid as big as its model (core/town/colliders.ts furnitureColliders); none stands in a doorway, on a
//    street, on a spot people use or where a vehicle is parked (data/townFurniture.test.ts).
//
// Pure data and rules; the models are three/scene/furniture.ts.

import type { Tile, TownWorld, WorldDistrict } from './townWorld';

/** The small things of a street (their models: three/scene/furniture.ts, same ids). */
export type FurnitureKind = 'bins' | 'bike-rack' | 'postbox' | 'crates' | 'pots' | 'hydrant' | 'news-box' | 'bench-picnic';

/**
 * One of them, standing at (x, y) on the tile grid (its middle). `face`: which way its front looks, to +y (left out)
 * or to +x, both sides the viewer sees; its long side runs across that (a bike rack facing 'y' runs along x).
 */
export interface WorldFurniture {
  kind: FurnitureKind;
  x: number;
  y: number;
  face?: 'x' | 'y';
}

/** The bench drawn at a bench's spot: the old wood-and-iron one ('classic') or one of the new three. */
export type BenchLook = 'classic' | 'bench-park' | 'bench-stone' | 'bench-log';
/** The street lamp drawn at a lamp's spot: the old one with its arm ('classic'), the old-town lantern, the two globes. */
export type LampLook = 'classic' | 'lamp-lantern' | 'lamp-globes';

export interface DistrictLook {
  bench: BenchLook;
  lamp: LampLook;
}

/**
 * Each district's bench and lamp. The town: stone on the plaza under two-globe lamps, the old lantern on the market
 * street and in the park by the lake, iron-armed park benches by the water and in the homes' lane, log benches out in
 * the country, the wood-and-iron classic at the bus station and on the beach. Westbay: the old market under lanterns
 * on stone, the offices and the campus under two globes, the seafront's park benches.
 */
export const DISTRICT_LOOKS: Readonly<Record<WorldDistrict['id'], DistrictLook>> = {
  plaza: { bench: 'bench-stone', lamp: 'lamp-globes' },
  market: { bench: 'classic', lamp: 'lamp-lantern' },
  homes: { bench: 'bench-park', lamp: 'classic' },
  civic: { bench: 'classic', lamp: 'lamp-globes' },
  station: { bench: 'classic', lamp: 'classic' },
  park: { bench: 'bench-park', lamp: 'lamp-lantern' },
  farm: { bench: 'bench-log', lamp: 'lamp-lantern' },
  woods: { bench: 'bench-log', lamp: 'classic' },
  orchard: { bench: 'bench-log', lamp: 'classic' },
  meadow: { bench: 'bench-log', lamp: 'classic' },
  forest: { bench: 'bench-log', lamp: 'classic' },
  fields: { bench: 'bench-log', lamp: 'lamp-lantern' },
  lake: { bench: 'bench-park', lamp: 'lamp-lantern' },
  hills: { bench: 'bench-log', lamp: 'classic' },
  country: { bench: 'bench-log', lamp: 'lamp-lantern' },
  beach: { bench: 'classic', lamp: 'classic' },
  harbor: { bench: 'bench-stone', lamp: 'lamp-lantern' },
  cape: { bench: 'bench-stone', lamp: 'classic' },
  'w-station': { bench: 'classic', lamp: 'classic' },
  'w-market': { bench: 'bench-stone', lamp: 'lamp-lantern' },
  'w-arts': { bench: 'bench-park', lamp: 'classic' },
  'w-office': { bench: 'bench-stone', lamp: 'lamp-globes' },
  'w-campus': { bench: 'bench-park', lamp: 'lamp-globes' },
  'w-harbour': { bench: 'classic', lamp: 'lamp-lantern' },
  'w-bay': { bench: 'bench-park', lamp: 'classic' },
};

const CLASSIC: DistrictLook = { bench: 'classic', lamp: 'classic' };

/**
 * The district a point (tile grid) belongs to: of the districts whose box holds it, the one whose middle is nearest
 * (boxes overlap at their edges: the orchard's bench under the market's box is the orchard's); outside them all, the
 * nearest box. Null in a world without districts.
 */
export function districtAt(world: Pick<TownWorld, 'districts'>, x: number, y: number): WorldDistrict | null {
  const list = world.districts ?? [];
  let best: WorldDistrict | null = null;
  let bestD = Infinity;
  let inside = false;
  for (const d of list) {
    const dx = Math.max(d.x - x, 0, x - (d.x + d.w));
    const dy = Math.max(d.y - y, 0, y - (d.y + d.d));
    const holds = dx === 0 && dy === 0;
    // inside: by the distance to its middle; outside: by the distance to its box
    const dist = holds ? Math.hypot(x - (d.x + d.w / 2), y - (d.y + d.d / 2)) : Math.hypot(dx, dy);
    if (holds && !inside) {
      inside = true;
      best = d;
      bestD = dist;
    } else if (holds === inside && dist < bestD) {
      best = d;
      bestD = dist;
    }
  }
  return best;
}

/** The look of the furniture at a point (the classic bench and lamp in a world without districts). */
export function lookAt(world: Pick<TownWorld, 'districts'>, x: number, y: number): DistrictLook {
  const d = districtAt(world, x, y);
  return d ? DISTRICT_LOOKS[d.id] : CLASSIC;
}

/** The bench drawn on the tile (x, y) (a bench stands in its tile's middle). */
export const benchLookAt = (world: Pick<TownWorld, 'districts'>, tile: Tile): BenchLook => lookAt(world, tile.x + 0.5, tile.y + 0.5).bench;
/** The street lamp drawn on the tile (x, y). */
export const lampLookAt = (world: Pick<TownWorld, 'districts'>, tile: Tile): LampLook => lookAt(world, tile.x + 0.5, tile.y + 0.5).lamp;

/** A thing in the middle of tile (tx, ty), moved by (dx, dy) within it. */
const f = (kind: FurnitureKind, tx: number, ty: number, face?: 'x' | 'y', dx = 0, dy = 0): WorldFurniture => (face ? { kind, x: tx + 0.5 + dx, y: ty + 0.5 + dy, face } : { kind, x: tx + 0.5 + dx, y: ty + 0.5 + dy });

/** The town's (data/townWorld.ts coordinates). */
export const TOWN_FURNITURE: readonly WorldFurniture[] = [
  // the plaza: a bin at its east corner, a post box by the way east
  f('bins', 43, 32),
  f('postbox', 43, 36, 'x'),
  // the market street: crates behind the stalls and behind Ben's shop, a bin across the street, the post box by Tom's
  // notice board
  f('crates', 44, 19, 'y', 0, -0.2),
  f('crates', 40, 18),
  f('crates', 46, 24, 'y', 0.1, -0.1),
  f('bins', 49, 23),
  f('postbox', 49, 19, 'y', 0, 0.15),
  // the homes: pots by Grace's and Mia's doors, a bin in the lane
  f('pots', 30, 38, 'x', -0.15, 0),
  f('pots', 27, 41, 'x', -0.15, 0.1),
  f('bins', 25, 44, 'x'),
  // the main road: pots by Sarah's office, a hydrant by the clinic
  f('pots', 48, 39, 'y', 0, -0.15),
  f('hydrant', 49, 44),
  // the bus station: a newspaper box by the bench, a bike rack beside the shelter, a bin in the lay-by
  f('news-box', 55, 47, 'y', 0.05, 0),
  f('bike-rack', 58, 48, 'x', 0.05, 0),
  f('bins', 59, 51),
  // picnic tables in the park and by the lakes, on the meadow, on the grassy hill and by the pond; a bin by the lake
  f('bench-picnic', 20, 22),
  f('bins', 18, 22),
  f('bench-picnic', 15, 27),
  f('bench-picnic', 20, 34),
  f('bench-picnic', 12, 33),
  f('bench-picnic', 34, 47),
  f('bench-picnic', 26, 63),
  f('bench-picnic', 35, 61),
  // the farm: crates by the barns
  f('crates', 49, 14),
  f('crates', 63, 14),
  // the beach: bins along the promenade, a bike rack where the footpath comes down
  f('bins', 21, 75),
  f('bins', 35, 75),
  f('bins', 53, 75),
  f('bins', 66, 75),
  f('bike-rack', 30, 75),
  // the harbour: crates and barrels on the quay, a bin
  f('crates', 81, 50),
  f('crates', 81, 54),
  f('crates', 77, 54),
  f('bins', 73, 51),
];

/** Westbay's (data/cityWorld.ts CITY_WORLD, the stretched map's own coordinates). */
export const CITY_FURNITURE: readonly WorldFurniture[] = [
  // Ga & bến xe: the post box and a bike rack by Central Station, a bin on the terminal plaza and one at the bus bay, a
  // newspaper box and a hydrant on Station Road
  f('postbox', 7, 24, 'x'),
  f('bike-rack', 6, 26, 'x'),
  f('bins', 6, 28, 'x'),
  f('bins', 6, 34, 'x'),
  f('news-box', 17, 23, 'x'),
  f('hydrant', 17, 21),
  // Chợ cũ: crates by the stalls on the market square, bins at its edges, the post box across from Nora's, pots between
  // the shops on Market Street, hydrants along it
  f('crates', 40, 21, 'y', 0, -0.15),
  f('crates', 47, 21, 'y', 0, -0.1),
  f('crates', 34, 24, 'y', 0, -0.1),
  f('bins', 33, 20, 'x'),
  f('bins', 48, 22, 'x'),
  f('postbox', 25, 17),
  f('pots', 37, 14, 'y', 0, -0.15),
  f('pots', 41, 14, 'y', 0, -0.15),
  f('hydrant', 23, 17),
  f('hydrant', 53, 17),
  // Phố nghệ thuật: the newspaper box by Bay FM, a post box by the bookshop, a bin, a bike rack across from Bo's,
  // hydrants along Arts Street
  f('news-box', 52, 48),
  f('postbox', 42, 51),
  f('bins', 46, 51),
  f('bike-rack', 26, 51),
  f('hydrant', 21, 51),
  f('hydrant', 55, 51),
  // Khu văn phòng: a newspaper box by Mr Whitlock's stand, bins, the office workers' bike rack, a hydrant, pots by
  // FreshWay's and the computer room's doors
  f('news-box', 72, 13, 'x'),
  f('bins', 65, 17),
  f('bins', 79, 17),
  f('bike-rack', 61, 14),
  f('hydrant', 81, 17),
  f('pots', 63, 29, 'y', 0.1, -0.1),
  f('pots', 72, 29, 'y', -0.1, -0.1),
  // Đại học & bệnh viện: bike racks by the quad and the library, a bin, a hydrant and a post box across from the
  // hospital, a picnic table on the quad's lawn
  f('bike-rack', 77, 38),
  f('bike-rack', 68, 51),
  f('bins', 83, 33, 'x'),
  f('hydrant', 83, 29),
  f('postbox', 78, 32),
  f('bench-picnic', 80, 38),
  // Bến cảng: crates by Jun's, at the night market's stalls, by the ferry and on the pier road; a bin on the square, a
  // hydrant on Quay Street, a newspaper box by the Bay FM stage
  f('crates', 60, 77),
  f('crates', 68, 82),
  f('crates', 72, 83),
  f('crates', 63, 89),
  f('crates', 66, 92),
  f('bins', 75, 80),
  f('hydrant', 70, 77),
  f('news-box', 75, 76, 'x'),
  // Station Park and the seafront: picnic tables
  f('bench-picnic', 8, 44),
  f('bench-picnic', 2, 44),
  f('bench-picnic', 12, 59),
  f('bench-picnic', 24, 59),
];
