// What stands where in the 3D town, worked out from the world (data/townWorld.ts) and the stage state, without any
// three.js: which lots are built, construction sites or nature, the trees, the tufts and flowers on free grass, the
// lamps that light the night, the fireflies. Pure and tested; the scene builders only turn it into meshes.

import { lotNature, lotOf, treesOf } from '../../../../core/town/colliders';
import type { DecorationId, PlaceId, Tile, TownWorld, WorldPlace } from '../../../../data/townWorld';
import type { StageState } from '../../engine/sim';
import { hash2, middleOf } from './coords';

export type LotState = 'built' | 'site' | 'nature';

/** A place's lot: built, a construction site on offer (`sites`, all empty lots when left out), or plain nature. */
export function lotState(id: string, state: Pick<StageState, 'built' | 'sites'>): LotState {
  return lotOf(id, state);
}

/** What changes the town's buildings and decorations (a new key = rebuild those layers). */
export function layoutKey(state: Pick<StageState, 'built' | 'decorations' | 'sites' | 'extraDecor' | 'farm'>): string {
  return [[...state.built].sort().join(','), state.sites ? [...state.sites].sort().join(',') : '*', [...state.decorations].sort().join(','), [...(state.extraDecor ?? [])].sort().join(','), cropsKey(state.farm)].join('|');
}

/** The farm field's look as a short key ('' = not known yet). */
export function cropsKey(farm: StageState['farm']): string {
  return farm ? farm.map((s) => s[0]).join('') : '';
}

export interface TreeSpot {
  x: number;
  z: number;
  kind: 'round' | 'pine' | 'blossom' | 'bush' | 'palm';
  /** 0.7..1.3 */
  scale: number;
  /** 0..1, a stable random of its own (colour, turn). */
  seed: number;
}

/**
 * The trees of the map ('T' round, 't' pine), a little off their tile centres so they do not stand in rows. Where
 * they stand comes from core/town/colliders.ts (its trunks block the way there: one source, never two).
 */
export function mapTrees(world: TownWorld): TreeSpot[] {
  return treesOf(world).map((t) => ({ x: t.x, z: t.y, kind: t.kind, scale: t.scale, seed: t.seed }));
}

/** A lot not on offer: a corner of nature (a tree or two, a bush, a stone), the same every time for the same lot (core/town/colliders.ts). */
export function natureOf(p: Pick<WorldPlace, 'id' | 'x' | 'y' | 'w' | 'd'>): { trees: TreeSpot[]; stones: { x: number; z: number; s: number }[] } {
  const n = lotNature(p);
  return { trees: n.trees.map((t) => ({ x: t.x, z: t.y, kind: t.kind, scale: t.scale, seed: t.seed })), stones: n.stones.map((s) => ({ x: s.x, z: s.y, s: s.s })) };
}

/** Tiles where nothing stands (no place, prop or solid decoration), as a set of "x,y". */
export function occupiedTiles(world: TownWorld): Set<string> {
  const out = new Set<string>();
  const add = (t: Tile) => out.add(`${Math.floor(t.x)},${Math.floor(t.y)}`);
  for (const p of world.places) for (let y = p.y; y < p.y + p.d; y++) for (let x = p.x; x < p.x + p.w; x++) add({ x, y });
  for (const prop of world.props) prop.tiles.forEach(add);
  for (const spots of Object.values(world.decorations)) for (const s of spots) if (s.solid) add(s);
  if (world.activities) for (const a of Object.values(world.activities)) add(a.stand);
  return out;
}

export interface Tuft {
  x: number;
  z: number;
  /** 'grass' a tuft; 'flower' a small flower of colour `c` (index into FLOWERS). */
  kind: 'grass' | 'flower';
  c: number;
  s: number;
  rot: number;
}

/**
 * Grass tufts and little flowers on free grass ('.' tiles nothing stands on), a few per tile, sparser on a big
 * map; none on a tile somebody stands at for an activity.
 */
export function tufts(world: TownWorld, density = 1): Tuft[] {
  const busy = occupiedTiles(world);
  const life = world.life;
  if (life) {
    for (const s of life.seats) busy.add(`${Math.floor(s.x)},${Math.floor(s.y)}`);
  }
  const out: Tuft[] = [];
  const per = Math.max(0.6, Math.min(2.2, (2.2 * 21 * 21) / (world.size * world.size))) * density;
  for (let y = 0; y < world.size; y++) {
    const row = world.rows[y] ?? '';
    for (let x = 0; x < world.size; x++) {
      if (row[x] !== '.' || busy.has(`${x},${y}`)) continue;
      const n = Math.floor(per + hash2(x, y, 21));
      for (let i = 0; i < n; i++) {
        const flower = hash2(x, y, 30 + i) < 0.28;
        out.push({
          x: x + 0.12 + hash2(x, y, 40 + i) * 0.76,
          z: y + 0.12 + hash2(x, y, 50 + i) * 0.76,
          kind: flower ? 'flower' : 'grass',
          c: Math.floor(hash2(x, y, 60 + i) * 6),
          s: 0.75 + hash2(x, y, 70 + i) * 0.5,
          rot: hash2(x, y, 80 + i) * Math.PI * 2,
        });
      }
    }
  }
  return out;
}

export interface Lamp {
  x: number;
  y: number;
  z: number;
  /** How strong its light is, 0..1. */
  k: number;
}

/** How far a street lamp's head hangs out over the path (tiles). */
export const LAMP_ARM = 0.42;
/** A street lamp's head stands this high. */
export const LAMP_HEIGHT = 1.55;

/** The direction a street lamp's arm reaches (on the grid): right on the 2D screen (+x −y), or mirrored. */
export function lampArm(flip: boolean | undefined): { x: number; y: number } {
  const k = Math.SQRT1_2;
  return flip ? { x: -k, y: k } : { x: k, y: -k };
}

/** Where light comes from at night, for what is built and bought (the scene keeps a few real lights at the nearest). */
export function lamps(world: TownWorld, state: Pick<StageState, 'built' | 'decorations'>): Lamp[] {
  const out: Lamp[] = [];
  const has = (id: DecorationId) => state.decorations.includes(id);
  for (const id of ['lamps1', 'lamps2'] as const) {
    if (!has(id)) continue;
    for (const s of world.decorations[id] ?? []) {
      const a = lampArm(s.flip);
      out.push({ x: s.x + 0.5 + a.x * LAMP_ARM, y: LAMP_HEIGHT - 0.1, z: s.y + 0.5 + a.y * LAMP_ARM, k: 1 });
    }
  }
  if (has('stall')) for (const s of world.decorations.stall ?? []) out.push({ x: s.x + 0.5, y: 1.1, z: s.y + 0.5, k: 0.6 });
  for (const p of world.props) {
    const at = p.at ?? middleOf(p.tiles);
    if (!at) continue;
    if (p.kind === 'lantern') out.push({ x: at.x, y: 0.9, z: at.y, k: 0.75 });
    else if (p.kind === 'market' || p.kind === 'kiosk') out.push({ x: at.x, y: 1.2, z: at.y, k: 0.55 });
    else if (p.kind === 'inn') out.push({ x: at.x + 0.2, y: 1.0, z: at.y + 1.3, k: 0.5 });
  }
  return out;
}

/** The lamps nearest a point (the real lights go there; the others glow without lighting). */
export function nearestLamps(list: readonly Lamp[], x: number, z: number, count: number): Lamp[] {
  return [...list]
    .map((l) => ({ l, d: (l.x - x) ** 2 + (l.z - z) ** 2 - l.k * 4 }))
    .sort((a, b) => a.d - b.d)
    .slice(0, count)
    .map((e) => e.l);
}

/** Where fireflies drift at night: free grass tiles, a fixed handful (more on a bigger map). */
export function fireflySpots(world: TownWorld): { x: number; z: number }[] {
  const grass: { x: number; z: number }[] = [];
  for (let y = 0; y < world.size; y++) for (let x = 0; x < world.size; x++) if (world.rows[y]?.[x] === '.') grass.push({ x: x + 0.5, z: y + 0.5 });
  const count = Math.round((26 * world.size * world.size) / (21 * 21));
  const out: { x: number; z: number }[] = [];
  for (let i = 0; i < count && grass.length > 0; i++) out.push(grass[Math.floor(hash2(i, 17, 2) * grass.length)]);
  return out;
}

/** The ids of the places in the world (a place's resident is a character id). */
export function placeIds(world: TownWorld): PlaceId[] {
  return world.places.map((p) => p.id);
}
