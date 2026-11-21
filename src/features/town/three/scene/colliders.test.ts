// Only what you can see blocks, and only as much as it is big (core/town/colliders.ts, docs/town.md §7 "Moving
// about"): the colliders of a state against what the 3D scene builds for it. Every solid thing the scene puts up has
// colliders, and their box matches the model's footprint at body height; every collider belongs to something the
// scene shows; the things left loose (lilies, balloons, the pier over the water, ducks…) have none. Then, from the
// first day's town, every tile a body fits on can be reached, and keys walking across the plaza and along the
// streets only ever stop at something there.

import { describe, expect, it } from 'vitest';
import type { BufferGeometry } from 'three';
import { boundsOfCollider, collidersOf, distanceTo, TREE_R, walkWorld, type WalkState } from '../../../../core/town/colliders';
import { canStep, NEIGHBOURS, walkable } from '../../../../core/town/map';
import { DECORATION_IDS, PLACE_IDS, TOWN_WORLD, type Collider, type TownWorld } from '../../../../data/townWorld';
import { EXTRA_DECOR } from '../../engine/extraDecor';
import { bodyFits, moveCircle, PLAYER_RADIUS, projectColliders, TownSim } from '../../engine/sim';
import { lotState, mapTrees, natureOf } from './layout';
import { buildInn, buildPlace, buildSite, type Thing } from './places3d';
import { buildDecorations, buildProject, buildProps, buildScenery, type Piece } from './props3d';

const W = TOWN_WORLD;
/** People are about 0.8 tile tall (chars/person.ts): what is higher (eaves, awnings, a crown) is over their heads. */
const BODY_TOP = 0.8;
/** What lies flatter than this is walked over (a doorstep, the curb, a lot's soil). */
const FLAT = 0.04;
/** How far a collider's box may differ from its model's footprint, each side (tiles). */
const TOL = 0.26;

/** Things the scene builds that nobody bumps into: on the water, over the water, too thin and light to matter. */
const LOOSE = new Set(['decor:lilies', 'decor:balloons', 'decor:strings', 'prop:pier', 'proj:proj-lake-lights', 'proj:proj-pier', 'scenery:duck']);

interface Solid {
  what: string;
  /** The group it is checked as (LOOSE). */
  group: string;
  box: { x0: number; y0: number; x1: number; y1: number } | null;
}

/** The footprint at body height of a model's geometries, in the town (tile grid: x, y). */
function footprint(t: { x: number; z: number; ry: number }, geos: (BufferGeometry | null | undefined)[]): Solid['box'] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const c = Math.cos(t.ry);
  const s = Math.sin(t.ry);
  for (const g of geos) {
    if (!g) continue;
    const a = g.getAttribute('position').array;
    for (let i = 0; i < a.length; i += 3) {
      const lx = a[i];
      const ly = a[i + 1];
      const lz = a[i + 2];
      if (ly <= FLAT || ly >= BODY_TOP) continue;
      const x = t.x + lx * c + lz * s;
      const y = t.z - lx * s + lz * c;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  return x0 === Infinity ? null : { x0, y0, x1, y1 };
}

const geosOf = (t: Thing | Piece) => [t.body, t.glass, t.bulbs, (t as Piece).sway];

/** Everything the scene builds for a state (world3d.ts setLayout), named as the colliders name it. */
function sceneSolids(world: TownWorld, state: WalkState): Solid[] {
  const out: Solid[] = [];
  for (const p of world.places) {
    const s = lotState(p.id, state);
    if (s === 'built') {
      const t = buildPlace(p);
      out.push({ what: 'place:' + p.id, group: 'place', box: footprint(t, geosOf(t)) });
    } else if (s === 'site') {
      const t = buildSite(p);
      out.push({ what: 'site:' + p.id, group: 'site', box: footprint(t, geosOf(t)) });
    } else {
      const n = natureOf(p);
      n.trees.forEach((_, i) => out.push({ what: `lot:${p.id}:${i}`, group: 'tree', box: null }));
      n.stones.forEach((_, i) => out.push({ what: `stone:${p.id}:${i}`, group: 'stone', box: null }));
    }
  }
  for (const t of mapTrees(world)) out.push({ what: `tree:${Math.floor(t.x)},${Math.floor(t.z)}`, group: 'tree', box: null });
  const innAt = world.props.findIndex((q) => q.kind === 'inn');
  if (innAt >= 0) {
    const inn = buildInn(world.props[innAt].tiles, world.life?.inn.door)!;
    out.push({ what: `prop:${innAt}:inn`, group: 'prop:inn', box: footprint(inn, geosOf(inn)) });
  }
  for (const pc of buildProps(world, state.built.includes('station'))) {
    const kind = world.props[pc.index].kind;
    out.push({ what: `prop:${pc.index}:${kind}`, group: 'prop:' + kind, box: footprint(pc, geosOf(pc)) });
  }
  for (const pc of buildDecorations(world, state.decorations, state.built.includes('square'))) {
    if (pc.strings) {
      out.push({ what: 'decor:strings', group: 'decor:strings', box: null });
      continue;
    }
    // a blossom tree's crown hangs over the body (checked as a tree, below)
    out.push({ what: `decor:${pc.pop}:${pc.index}`, group: 'decor:' + pc.pop, box: pc.pop === 'blossom' ? null : footprint(pc, geosOf(pc)) });
  }
  for (const id of state.extraDecor ?? []) {
    const spots = EXTRA_DECOR[id] ?? [];
    buildProject(id, spots.map((s) => s.at)).forEach((pc, i) => out.push({ what: `proj:${id}:${i}`, group: 'proj:' + id, box: footprint(pc, geosOf(pc)) }));
  }
  for (const pc of buildScenery(world)) {
    const kind = world.scenery![pc.index].kind;
    out.push({ what: `scenery:${pc.index}:${kind}`, group: 'scenery:' + kind, box: footprint(pc, geosOf(pc)) });
  }
  return out;
}

const ALL: WalkState = { built: [...PLACE_IDS], decorations: [...DECORATION_IDS], extraDecor: Object.keys(EXTRA_DECOR) };
const STATES: [string, WalkState][] = [
  ['the first day (every lot a site)', { built: [], decorations: [] }],
  ['the first day (three sites, the rest nature)', { built: [], sites: ['square', 'cafe', 'friend'], decorations: [] }],
  ['half built, some decorations', { built: ['square', 'cafe', 'friend', 'home', 'shop'], sites: ['office', 'park'], decorations: ['lamps1', 'flowers', 'benches', 'stall'] }],
  ['everything built and bought', ALL],
];

function unionBox(cs: readonly Collider[]): Solid['box'] {
  if (cs.length === 0) return null;
  const bs = cs.map(boundsOfCollider);
  return { x0: Math.min(...bs.map((b) => b.x0)), y0: Math.min(...bs.map((b) => b.y0)), x1: Math.max(...bs.map((b) => b.x1)), y1: Math.max(...bs.map((b) => b.y1)) };
}

describe('colliders = what the 3D town shows (docs/town.md §7 "Moving about")', () => {
  for (const [name, state] of STATES) {
    it(`${name}: every solid model has colliders as big as it is, every collider has a model`, () => {
      const cs = collidersOf(W, state, projectColliders(state.extraDecor));
      const byWhat = new Map<string, Collider[]>();
      for (const c of cs) byWhat.set(c.what, [...(byWhat.get(c.what) ?? []), c]);
      const solids = sceneSolids(W, state);
      const seen = new Set<string>();
      const bad: string[] = [];
      for (const s of solids) {
        seen.add(s.what);
        const mine = byWhat.get(s.what) ?? [];
        if (LOOSE.has(s.group) || LOOSE.has(s.what.replace(/:\d+$/, ''))) {
          if (mine.length > 0) bad.push(`${s.what}: loose, but has a collider`);
          continue;
        }
        if (mine.length === 0) {
          bad.push(`${s.what}: drawn, no collider`);
          continue;
        }
        if (!s.box) continue;
        const b = unionBox(mine)!;
        const d = [b.x0 - s.box.x0, b.y0 - s.box.y0, s.box.x1 - b.x1, s.box.y1 - b.y1];
        if (d.some((v) => Math.abs(v) > TOL)) bad.push(`${s.what}: collider ${fmt(b)} vs model ${fmt(s.box)}`);
      }
      for (const what of byWhat.keys()) if (!seen.has(what)) bad.push(`${what}: a collider with nothing drawn there`);
      expect(bad).toEqual([]);
    });
  }

  it('a tree stops a body past its trunk, under its lowest branches', () => {
    const trunk = { round: 0.1, blossom: 0.1, pine: 0.09, bush: 0 };
    const crown = { round: 0.44, blossom: 0.44, pine: 0.46, bush: 0.4 };
    for (const k of ['round', 'blossom', 'pine', 'bush'] as const) {
      expect(TREE_R[k]).toBeGreaterThan(trunk[k] + 0.1);
      expect(TREE_R[k]).toBeLessThanOrEqual(crown[k]);
    }
    // and stands where the scene draws it
    const cs = collidersOf(W);
    for (const t of mapTrees(W)) {
      const c = cs.find((q) => q.what === `tree:${Math.floor(t.x)},${Math.floor(t.z)}`)!;
      expect(c.kind).toBe('circle');
      if (c.kind === 'circle') {
        expect(c.x).toBeCloseTo(t.x, 9);
        expect(c.y).toBeCloseTo(t.z, 9);
        expect(c.r).toBeCloseTo(TREE_R[t.kind] * t.scale, 9);
      }
    }
  });
});

const fmt = (b: NonNullable<Solid['box']>) => `[${b.x0.toFixed(2)},${b.y0.toFixed(2)} → ${b.x1.toFixed(2)},${b.y1.toFixed(2)}]`;

/** The points of a 0.1 lattice where the player's body fits, and those reached from the start. */
function bodyFlood(world: TownWorld): { fits: Uint8Array; reached: Uint8Array; n: number } {
  const n = world.size * 10;
  const fits = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) fits[j * n + i] = bodyFits((i + 0.5) / 10, (j + 0.5) / 10, PLAYER_RADIUS, world) ? 1 : 0;
  const reached = new Uint8Array(n * n);
  const s = (world.start.y * 10 + 5) * n + world.start.x * 10 + 5;
  const queue = [s];
  reached[s] = 1;
  while (queue.length > 0) {
    const k = queue.pop()!;
    const i = k % n;
    const j = (k - i) / n;
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const a = i + di;
      const b = j + dj;
      if (a < 0 || b < 0 || a >= n || b >= n) continue;
      const q = b * n + a;
      if (fits[q] && !reached[q]) {
        reached[q] = 1;
        queue.push(q);
      }
    }
  }
  return { fits, reached, n };
}

describe('nothing invisible in the way', () => {
  const REACH_STATES: [string, WalkState][] = [
    ...STATES,
    // the park lot left to nature beside the garden project (the pockets of 2026-11-21: 10,19 and 0,27–0,28)
    ['three sites, the rest nature, every town project', { built: [], sites: ['square', 'cafe', 'friend'], decorations: [], extraDecor: Object.keys(EXTRA_DECOR) }],
  ];
  for (const [name, state] of REACH_STATES) {
    it(`${name}: the path finder reaches exactly the open tiles the body reaches`, () => {
      const world = walkWorld(W, state, projectColliders(state.extraDecor));
      // the path finder, from the start
      const key = (x: number, y: number) => y * world.size + x;
      const seen = new Set([key(world.start.x, world.start.y)]);
      const todo = [world.start];
      while (todo.length > 0) {
        const t = todo.pop()!;
        for (const d of NEIGHBOURS) {
          const u = { x: t.x + d.x, y: t.y + d.y };
          if (!canStep(t, d, world) || seen.has(key(u.x, u.y))) continue;
          seen.add(key(u.x, u.y));
          todo.push(u);
        }
      }
      // the body, from the start
      const f = bodyFlood(world);
      const bodyGets = (x: number, y: number) => {
        for (let j = 0; j < 10; j++) for (let i = 0; i < 10; i++) if (f.reached[(y * 10 + j) * f.n + x * 10 + i] === 1) return true;
        return false;
      };
      const cs = world.walk!.colliders;
      // a corner shut in by real things: trees, a lot's trees and stone, a project's beds, the water
      const shutIn = (x: number, y: number) => cs.some((c) => /^(tree|lot|stone|proj):/.test(c.what) && distanceTo(c, x + 0.5, y + 0.5) < 1);
      const gridOnly: string[] = [];
      const bodyOnly: string[] = [];
      const bodyCut: string[] = [];
      for (let y = 0; y < world.size; y++) {
        for (let x = 0; x < world.size; x++) {
          if (!walkable({ x, y }, world)) continue;
          const body = bodyGets(x, y);
          const grid = seen.has(key(x, y));
          if (body && !grid) bodyOnly.push(`${x},${y}`);
          if (grid && !body) gridOnly.push(`${x},${y}`);
          // what the body cannot get to is shut in by something there, and never a street or the plaza
          if (!body && (!shutIn(x, y) || W.rows[y][x] === '=' || W.rows[y][x] === 'o')) bodyCut.push(`${x},${y}`);
        }
      }
      expect({ bodyOnly, gridOnly }).toEqual({ bodyOnly: [], gridOnly: [] });
      expect(bodyCut).toEqual([]);
    });
  }

  it('keys walking across the plaza and along the streets stop only at something there', () => {
    // the first day: nothing bought, three lots on offer (the shell's usual start)
    const sim = new TownSim(W, () => 0.5);
    sim.setState({ built: [], sites: ['square', 'cafe', 'friend'], decorations: [] });
    const world = sim.world;
    const dirs = Array.from({ length: 8 }, (_, k) => ({ x: Math.cos((k * Math.PI) / 4), y: Math.sin((k * Math.PI) / 4) }));
    const starts: { x: number; y: number }[] = [];
    for (let y = 0; y < W.size; y++) for (let x = 0; x < W.size; x++) if (walkable({ x, y }, world) && 'o='.includes(W.rows[y][x]) && (x + y) % 2 === 0) starts.push({ x: x + 0.5, y: y + 0.5 });
    const invisible: string[] = [];
    for (const s of starts) {
      for (const d of dirs) {
        const at = walkInto(world, s, d);
        if (at.why) invisible.push(`${s.x},${s.y} → (${d.x.toFixed(2)},${d.y.toFixed(2)}) stopped at ${at.x.toFixed(2)},${at.y.toFixed(2)}`);
      }
    }
    expect(starts.length).toBeGreaterThan(100);
    expect(invisible).toEqual([]);
  });
});

/**
 * Hold one way from `s` until the body stops: where it stopped, and `why` when nothing solid touches the body there
 * (an invisible wall). Moves as TownSim.move does, by moveCircle via its exported wrapper.
 */
function walkInto(world: TownWorld, s: { x: number; y: number }, d: { x: number; y: number }): { x: number; y: number; why: boolean } {
  let x = s.x;
  let y = s.y;
  for (let k = 0; k < 400; k++) {
    const to = stepBody(world, x, y, d);
    const moved = Math.hypot(to.x - x, to.y - y);
    x = to.x;
    y = to.y;
    if (moved < 0.005) {
      // stopped: something solid must touch the body (within a hair)
      const touching = collidersNear(world, x, y).some((c) => distanceTo(c, x, y) < PLAYER_RADIUS + 0.03) || !inside(world, x, y);
      return { x, y, why: !touching };
    }
  }
  return { x, y, why: false };
}


function stepBody(world: TownWorld, x: number, y: number, d: { x: number; y: number }) {
  return moveCircle(x, y, d.x * 0.05, d.y * 0.05, PLAYER_RADIUS, world);
}

function collidersNear(world: TownWorld, x: number, y: number): Collider[] {
  return (world.walk?.colliders ?? collidersOf(world)).filter((c) => distanceTo(c, x, y) < 1);
}

/** Near water or the map's edge (a closed ground tile within reach of the body). */
function inside(world: TownWorld, x: number, y: number): boolean {
  for (let ty = Math.floor(y - 0.3); ty <= Math.floor(y + 0.3); ty++) {
    for (let tx = Math.floor(x - 0.3); tx <= Math.floor(x + 0.3); tx++) {
      const ch = world.rows[ty]?.[tx];
      if (ch === undefined || ch === '~') {
        const cx = Math.max(tx, Math.min(tx + 1, x));
        const cy = Math.max(ty, Math.min(ty + 1, y));
        if (Math.hypot(cx - x, cy - y) < PLAYER_RADIUS + 0.03) return false;
      }
    }
  }
  return true;
}
