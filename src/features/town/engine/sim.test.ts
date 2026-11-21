import { describe, expect, it } from 'vitest';
import { walkable } from '../../../core/town/map';
import { TOWN_WORLD, WORLD_PLACES, type Tile, type TownWorld } from '../../../data/townWorld';
import {
  advance,
  closeTarget,
  face,
  gridDistance,
  keysToDelta,
  moveCircle,
  PLAYER_ACCEL,
  PLAYER_RADIUS,
  lineClear,
  octantOf,
  octantSticky,
  octAngle,
  faceIfFar,
  passes,
  PLAYER_RUN,
  PLAYER_SPEED,
  RESIDENT_SPEED,
  seatFront,
  SETTLE_AFTER,
  settle,
  smoothPath,
  standTick,
  START_TIME,
  talkSpotCost,
  TALK_SPOTS,
  TownSim,
  type Cat,
  TURN_STEP,
  turn,
  type Actor,
  type Arrival,
  wayAlong,
} from './sim';
import { findPath } from '../../../core/town/map';

/** A seeded generator: the same town every run. */
function seeded(seed = 7): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const START = ['square', 'cafe', 'friend'];
const NO_KEYS = { up: false, down: false, left: false, right: false };

function actor(tile: Tile, speed = 2): Actor {
  return {
    id: 'a',
    kind: 'player',
    x: tile.x + 0.5,
    y: tile.y + 0.5,
    tile: { ...tile },
    path: [],
    speed,
    v: 0,
    stride: 0.8,
    heading: { x: 1, y: 1 },
    facing: 1,
    oct: 1,
    want: 1,
    turnIn: 0,
    pend: 1,
    pendFor: 0,
    moving: false,
    stepping: false,
    phase: 0,
    land: null,
    starting: false,
    waited: 0,
    rest: 0,
    restSince: 0,
    autoSettle: false,
  };
}

function run(sim: TownSim, seconds: number, dt = 1 / 60): Arrival[] {
  const out: Arrival[] = [];
  for (let t = 0; t < seconds; t += dt) {
    const a = sim.update(dt);
    if (a) out.push(a);
  }
  return out;
}

describe('advance', () => {
  it('follows the path at ground speed, easing in and out, and ends exactly on the last tile', () => {
    const a = actor({ x: 2, y: 2 });
    a.oct = a.want = 0;
    a.path = [{ x: 3, y: 2 }, { x: 4, y: 2 }, { x: 5, y: 2 }, { x: 6, y: 2 }];
    const speeds: number[] = [];
    let done = false;
    for (let i = 0; i < 600 && !done; i++) {
      const x0 = a.x;
      done = advance(a, 1 / 60);
      speeds.push((a.x - x0) * 60);
      expect(a.moving).toBe(!done);
    }
    expect(done).toBe(true);
    expect([a.x, a.y]).toEqual([6.5, 2.5]);
    expect(a.tile).toEqual({ x: 6, y: 2 });
    // eases in, reaches full pace on the way, slows down before the end
    expect(speeds[0]).toBeLessThan(a.speed * 0.3);
    expect(Math.max(...speeds)).toBeCloseTo(a.speed, 5);
    expect(speeds[speeds.length - 2]).toBeLessThan(a.speed * 0.6);
    // from rest to full pace in START_TIME
    const full = speeds.findIndex((v) => v > a.speed - 1e-6);
    expect(full / 60).toBeLessThanOrEqual(START_TIME + 1 / 60);
    expect(advance(a, 1)).toBe(false);
  });

  it('measures speed on the ground: a step up the screen and a step across take the same time', () => {
    const across = actor({ x: 5, y: 5 });
    across.path = [{ x: 6, y: 4 }];
    across.oct = across.want = 7;
    const up = actor({ x: 5, y: 5 });
    up.path = [{ x: 4, y: 4 }];
    up.oct = up.want = 5;
    let ta = 0;
    let tu = 0;
    while (!advance(across, 1 / 120)) ta++;
    while (!advance(up, 1 / 120)) tu++;
    expect(ta).toBe(tu);
  });

  it('drives the walk cycle by the distance walked (one cycle per stride) and closes the step after stopping', () => {
    const a = actor({ x: 2, y: 2 });
    a.oct = a.want = 0;
    a.path = [{ x: 7, y: 2 }];
    let steps = 0;
    while (!advance(a, 1 / 60)) steps++;
    expect(steps).toBeGreaterThan(10);
    // 5 tiles walked
    const cycles = 5 / a.stride;
    expect(a.phase / (Math.PI * 2)).toBeGreaterThanOrEqual(cycles - 0.05);
    for (let i = 0; i < 60; i++) standTick(a, 1 / 60, i / 60);
    expect(a.stepping).toBe(false);
    // legs together: a multiple of π
    expect(Math.abs(a.phase / Math.PI - Math.round(a.phase / Math.PI))).toBeLessThan(1e-6);
  });

  it('turns before walking off the other way, one octant at a time', () => {
    const a = actor({ x: 5, y: 5 });
    a.oct = a.want = 1; // looking at the viewer
    a.path = [{ x: 4, y: 4 }]; // straight up the screen: half a turn
    const seen: number[] = [a.oct];
    let moved = -1;
    for (let i = 0; i < 60; i++) {
      const x0 = a.x;
      advance(a, 1 / 60);
      if (a.oct !== seen[seen.length - 1]) seen.push(a.oct);
      if (moved < 0 && a.x !== x0) moved = i;
    }
    // S → … → N through one side, each step 45°
    expect(seen[seen.length - 1]).toBe(5);
    for (let i = 1; i < seen.length; i++) expect(Math.min((seen[i] - seen[i - 1] + 8) % 8, (seen[i - 1] - seen[i] + 8) % 8)).toBe(1);
    // it set off only once it faced within 90° of the way
    expect(moved).toBeGreaterThanOrEqual(Math.floor((TURN_STEP * 60) * 1));
  });

  it('faces the way it walks on the screen', () => {
    const a = actor({ x: 5, y: 5 });
    a.path = [{ x: 5, y: 6 }];
    advance(a, 0.01);
    expect(a.facing).toBe(-1); // y+1 = down-left
    a.path = [{ x: 6, y: 6 }];
    advance(a, 10);
    expect(a.facing).toBe(1); // x+1 = down-right
    a.path = [{ x: 7, y: 7 }];
    advance(a, 10);
    expect(a.facing).toBe(1); // straight down the screen: keeps looking where it looked
    face(a, 0, 20);
    expect(a.facing).toBe(-1);
  });
});

  it('keeps the heading of its step (the sprite direction); standing, it turns three-quarters to the viewer', () => {
    const a = actor({ x: 5, y: 5 });
    expect(a.heading).toEqual({ x: 1, y: 1 });
    a.path = [{ x: 5, y: 4 }];
    advance(a, 0.01);
    expect(Math.sign(a.heading.x)).toBe(0);
    expect(Math.sign(a.heading.y)).toBe(-1);
    advance(a, 10);
    // the step is over: it still looks the way it went
    expect(Math.sign(a.heading.y)).toBe(-1);
    face(a, a.x + 3, a.y);
    expect(a.heading).toEqual({ x: 1, y: 0 });
    face(a, a.x, a.y + 3);
    expect(a.heading).toEqual({ x: 0, y: 1 });
    face(a, a.x + 2, a.y + 2);
    expect(a.heading).toEqual({ x: 1, y: 1 });
  });

describe('keys', () => {
  it('mean screen directions', () => {
    expect(keysToDelta({ ...NO_KEYS, up: true })).toEqual({ x: -1, y: -1 });
    expect(keysToDelta({ ...NO_KEYS, down: true })).toEqual({ x: 1, y: 1 });
    expect(keysToDelta({ ...NO_KEYS, right: true })).toEqual({ x: 1, y: -1 });
    expect(keysToDelta({ ...NO_KEYS, left: true })).toEqual({ x: -1, y: 1 });
    expect(keysToDelta({ ...NO_KEYS, up: true, right: true })).toEqual({ x: 0, y: -1 });
    expect(keysToDelta({ ...NO_KEYS, down: true, left: true })).toEqual({ x: 0, y: 1 });
    expect(keysToDelta({ ...NO_KEYS, up: true, down: true })).toEqual({ x: 0, y: 0 });
    expect(keysToDelta(NO_KEYS)).toEqual({ x: 0, y: 0 });
  });

  it('mean a way relative to the screen; keys.hold steers that way and {0,0} lets go', () => {
    const sim = new TownSim(room(OPEN), seeded(), { x: 3, y: 6 });
    sim.setState({ built: [], decorations: [] });
    sim.hold({ x: 1, y: -1 });
    expect(sim.steering!.x).toBeCloseTo(Math.SQRT1_2, 9);
    expect(sim.steering!.y).toBeCloseTo(-Math.SQRT1_2, 9);
    sim.hold({ x: 0, y: 0 });
    expect(sim.steering).toBeNull();
  });
});

/** A walled room: '.' open, '#' a wall (a whole tile, as the water: a tree would be a trunk). */
const NO_DECOR: TownWorld['decorations'] = { lamps1: [], flowers: [], benches: [], blossom: [], lamps2: [], lights: [], lilies: [], stall: [], fountain: [], balloons: [], flags: [], cat: [] };
function room(rows: readonly string[], decorations: TownWorld['decorations'] = NO_DECOR): TownWorld {
  return { size: rows.length, rows, places: [], props: [], decorations, plaza: { x: 1, y: 1, r: 0 }, start: { x: 1, y: 1 } };
}
const OPEN = ['##############', ...Array.from({ length: 12 }, () => '#............#'), '##############'];

/** Frame by frame at 60 Hz: the player's pace (from where they really went) and direction of travel. */
function drive(sim: TownSim, seconds: number, each?: (k: { t: number; v: number; dx: number; dy: number }) => void): void {
  for (let t = 0; t < seconds - 1e-9; t += 1 / 60) {
    const { x, y } = sim.player;
    sim.update(1 / 60);
    const dx = sim.player.x - x;
    const dy = sim.player.y - y;
    each?.({ t: t + 1 / 60, v: Math.hypot(dx, dy) * 60, dx, dy });
  }
}

/** The circle of the player overlaps no blocked tile. */
function clearOfWalls(world: TownWorld, x: number, y: number): boolean {
  for (let ty = Math.floor(y - 1); ty <= Math.floor(y + 1); ty++) {
    for (let tx = Math.floor(x - 1); tx <= Math.floor(x + 1); tx++) {
      if (walkable({ x: tx, y: ty }, world)) continue;
      const cx = Math.max(tx, Math.min(tx + 1, x));
      const cy = Math.max(ty, Math.min(ty + 1, y));
      if (Math.hypot(x - cx, y - cy) < PLAYER_RADIUS - 1e-6) return false;
    }
  }
  return true;
}

describe('the player under direct control (docs/town.md §7 "Moving about")', () => {
  it('sets off at once, goes the way asked without tile steps, and stops where it is when let go', () => {
    const world = room(OPEN);
    const sim = new TownSim(world, seeded(), { x: 3, y: 6 });
    sim.setState({ built: [], decorations: [] });
    // facing the way already (no turn first)
    sim.player.yaw = 0;
    sim.steer({ x: 1, y: 0 });
    let half = Infinity;
    let full = Infinity;
    drive(sim, 1, ({ t, v, dy }) => {
      if (v > PLAYER_SPEED * 0.5 && half === Infinity) half = t;
      if (v > PLAYER_SPEED * 0.99 && full === Infinity) full = t;
      expect(Math.abs(dy)).toBeLessThan(1e-9);
    });
    expect(half).toBeLessThanOrEqual(0.12);
    expect(full).toBeLessThanOrEqual(PLAYER_ACCEL + 0.02);
    sim.steer(null);
    let still = Infinity;
    drive(sim, 0.5, ({ t, v }) => {
      if (v < PLAYER_SPEED * 0.1 && still === Infinity) still = t;
    });
    expect(still).toBeLessThanOrEqual(0.12);
    // where it stopped: no walking on to a tile's centre
    const { x } = sim.player;
    expect(Math.abs(x - Math.floor(x) - 0.5)).toBeGreaterThan(0.02);
    drive(sim, 1, ({ v }) => expect(v).toBe(0));
    expect(sim.player.moving).toBe(false);
  });

  it('turns to a new way in about a tenth of a second, going on that way (any angle, not only eight)', () => {
    const sim = new TownSim(room(OPEN), seeded(), { x: 2, y: 2 });
    sim.setState({ built: [], decorations: [] });
    sim.player.yaw = 0;
    sim.steer({ x: 1, y: 0 });
    drive(sim, 0.6);
    // a quarter turn: the body within 3° of the new way in 0.12 s, the walk going that way by 0.15 s
    sim.steer({ x: 0, y: 1 });
    let faced = Infinity;
    let going = Infinity;
    drive(sim, 0.6, ({ t, v, dx, dy }) => {
      if (Math.abs(angleOf(sim.player.yaw!) - Math.PI / 2) < 0.05 && faced === Infinity) faced = t;
      if (v > PLAYER_SPEED * 0.5 && dy / Math.hypot(dx, dy) > Math.cos(Math.PI / 6) && going === Infinity) going = t;
      // the walk goes the way the body faces (no crab walk)
      if (v > 0.05) expect(Math.abs(Math.atan2(dy, dx) - sim.player.yaw!)).toBeLessThan(0.3);
    });
    expect(faced).toBeLessThanOrEqual(0.12);
    expect(going).toBeLessThanOrEqual(0.15);
    // a way between the octants is taken as it is
    const a = Math.atan2(0.3, 1);
    sim.steer({ x: 1, y: 0.3 });
    drive(sim, 0.5);
    expect(sim.player.yaw).toBeCloseTo(a, 6);
  });

  it('a half turn: it turns (round on the spot, a little arc at most) and never walks backwards', () => {
    const sim = new TownSim(room(OPEN), seeded(), { x: 6, y: 6 });
    sim.setState({ built: [], decorations: [] });
    sim.player.yaw = 0;
    sim.steer({ x: 1, y: 0 });
    drive(sim, 0.6);
    sim.steer({ x: -1, y: 0 });
    let back = Infinity;
    drive(sim, 0.8, ({ t, v, dx }) => {
      if (v > PLAYER_SPEED * 0.5 && dx < 0 && back === Infinity) back = t;
    });
    expect(back).toBeLessThanOrEqual(0.3);
  });

  it('slides along a wall and round a corner, never into anything blocked', () => {
    // a wall along y = 5 with a gap at x = 9; a pillar at (4, 9)
    const rows = OPEN.map((r, y) => (y === 5 ? '#########.####' : y === 9 ? '#...#........#' : r));
    const world = room(rows);
    const sim = new TownSim(world, seeded(), { x: 3, y: 6 });
    sim.setState({ built: [], decorations: [] });
    // up and right into the wall: it goes along the wall (at a good pace), then up through the gap
    sim.steer({ x: 1, y: -1 });
    let along = 0;
    drive(sim, 6, ({ v, dx }) => {
      expect(clearOfWalls(world, sim.player.x, sim.player.y)).toBe(true);
      if (sim.player.y > 5.5 && dx > 0 && v > PLAYER_SPEED * 0.6) along++;
    });
    expect(along).toBeGreaterThan(30);
    expect(sim.player.y).toBeLessThan(5);
    // straight at a pillar's corner (the body's middle 0.1 inside its edge): round it without stopping
    const p = sim.player;
    Object.assign(p, { x: 2.5, y: 9.1, tile: { x: 2, y: 9 }, yaw: 0 });
    sim.steer({ x: 1, y: 0 });
    let slow = 0;
    drive(sim, 2.5, ({ t, v }) => {
      expect(clearOfWalls(world, p.x, p.y)).toBe(true);
      if (t > 0.15 && v < PLAYER_SPEED * 0.3) slow++;
    });
    expect(p.x).toBeGreaterThan(5.5);
    expect(slow).toBeLessThanOrEqual(2);
  });

  it('head-on into a wall it stands (never shoots off along it); a gate just beside it is found', () => {
    const rows = OPEN.map((r, y) => (y === 5 ? '#########.####' : r));
    const world = room(rows);
    const sim = new TownSim(world, seeded(), { x: 5, y: 8 });
    sim.setState({ built: [], decorations: [] });
    sim.player.yaw = -Math.PI / 2;
    sim.steer({ x: 0, y: -1 });
    drive(sim, 2);
    expect(sim.player.y).toBeCloseTo(6 + PLAYER_RADIUS, 2);
    expect(sim.player.x).toBeCloseTo(5.5, 6);
    expect(sim.player.v).toBe(0);
    // a little to the side of the gate (its edge 0.3 off the body's middle): a sidestep and through
    Object.assign(sim.player, { x: 9.1 + 0.2 + 0.85, y: 7.5, tile: { x: 10, y: 7 } });
    drive(sim, 2);
    expect(sim.player.y).toBeLessThan(5);
  });

  it('a key cancels a click walk at once', () => {
    const sim = new TownSim(room(OPEN), seeded(), { x: 2, y: 6 });
    sim.setState({ built: [], decorations: [] });
    expect(sim.walkToTile({ x: 11, y: 6 })).toBe(true);
    drive(sim, 0.6);
    expect(sim.goal).not.toBeNull();
    sim.steer({ x: 0, y: 1 });
    expect(sim.goal).toBeNull();
    let going = Infinity;
    drive(sim, 0.5, ({ t, dx, dy }) => {
      if (dy > Math.abs(dx) && dy * 60 > PLAYER_SPEED * 0.5 && going === Infinity) going = t;
    });
    expect(going).toBeLessThanOrEqual(0.15);
  });

  it('Shift runs; a click walk starts as quickly and stops exactly on its end', () => {
    const sim = new TownSim(room(OPEN), seeded(), { x: 2, y: 6 });
    sim.setState({ built: [], decorations: [] });
    sim.player.yaw = 0;
    sim.setRun(true);
    sim.steer({ x: 1, y: 0 });
    let most = 0;
    drive(sim, 1, ({ v }) => (most = Math.max(most, v)));
    expect(most).toBeCloseTo(PLAYER_RUN, 6);
    sim.steer(null);
    sim.setRun(false);
    drive(sim, 0.3);
    const to = { x: Math.floor(sim.player.x) - 4, y: 6 };
    sim.walkToTile(to);
    let half = Infinity;
    drive(sim, 4, ({ t, v }) => {
      if (v > PLAYER_SPEED * 0.5 && half === Infinity) half = t;
    });
    expect(half).toBeLessThanOrEqual(0.3);
    expect(sim.goal).toBeNull();
    expect(sim.player.x).toBe(to.x + 0.5);
    expect(sim.player.y).toBe(to.y + 0.5);
  });

  it('never into anybody: round somebody in the way without slowing much; somebody standing in a narrow way makes room', () => {
    const cat = { ...NO_DECOR, cat: [{ x: 7.5, y: 6.5, solid: false }] };
    const world = room(OPEN, cat);
    const sim = new TownSim(world, () => 0.5, { x: 2, y: 6 });
    sim.setState({ built: [], decorations: ['cat'] });
    const c = sim.cat!;
    c.sitFor = 99;
    sim.player.yaw = 0;
    sim.player.y = 6.45;
    sim.steer({ x: 1, y: 0 });
    let closest = Infinity;
    let slowest = Infinity;
    drive(sim, 5, ({ t, v }) => {
      closest = Math.min(closest, Math.hypot(c.x - sim.player.x, c.y - sim.player.y));
      if (t > 0.2 && sim.player.x < 9) slowest = Math.min(slowest, v);
    });
    expect(closest).toBeGreaterThanOrEqual(0.5 - 1e-6);
    expect(sim.player.x).toBeGreaterThan(9);
    expect(slowest).toBeGreaterThan(PLAYER_SPEED * 0.4);
    // a corridor one tile wide with the cat sitting in it: pushing on, it makes way
    const rows = OPEN.map((r, y) => (y === 5 || y === 7 ? '##############' : r));
    const narrow = room(rows, cat);
    const s2 = new TownSim(narrow, () => 0.5, { x: 2, y: 6 });
    s2.setState({ built: [], decorations: ['cat'] });
    s2.cat!.sitFor = 99;
    s2.player.yaw = 0;
    s2.steer({ x: 1, y: 0 });
    let near = Infinity;
    drive(s2, 8, () => (near = Math.min(near, Math.hypot(s2.cat!.x - s2.player.x, s2.cat!.y - s2.player.y))));
    expect(near).toBeGreaterThanOrEqual(0.5 - 1e-6);
    expect(s2.player.x).toBeGreaterThan(8);
  });
});

describe('only what you can see blocks (core/town/colliders.ts)', () => {
  it('a decoration spot does not stop the keys until it is bought; then the body goes round the post, not a tile', () => {
    const lamp = TOWN_WORLD.decorations.lamps1[0];
    const sim = new TownSim(TOWN_WORLD, seeded(), { x: lamp.x - 2, y: lamp.y });
    sim.setState({ built: [], sites: [], decorations: [] });
    // nothing bought: straight across the lamp's spot
    sim.player.yaw = 0;
    sim.steer({ x: 1, y: 0 });
    drive(sim, 2.4);
    expect(sim.player.x).toBeGreaterThan(lamp.x + 1);
    // bought: a post of 0.11 in the way, the body (0.22) passes it within half a tile, on its own tile
    sim.steer(null);
    drive(sim, 0.5);
    sim.setState({ built: [], sites: [], decorations: ['lamps1'] });
    Object.assign(sim.player, { x: lamp.x - 1.5, y: lamp.y + 0.62, tile: { x: lamp.x - 2, y: lamp.y }, yaw: 0 });
    sim.steer({ x: 1, y: 0 });
    let nearest = Infinity;
    drive(sim, 2.4, () => {
      const d = Math.hypot(sim.player.x - lamp.x - 0.5, sim.player.y - lamp.y - 0.5);
      nearest = Math.min(nearest, d);
      expect(d).toBeGreaterThanOrEqual(0.11 + PLAYER_RADIUS - 1e-6);
    });
    expect(sim.player.x).toBeGreaterThan(lamp.x + 1);
    expect(nearest).toBeLessThan(0.5);
  });

  it('something bought or built where somebody stands: they step out to the nearest free spot', () => {
    const f = TOWN_WORLD.decorations.fountain[0];
    const sim = new TownSim(TOWN_WORLD, seeded(), { x: f.x, y: f.y });
    sim.setState({ built: ['cafe'], sites: [], decorations: [] });
    Object.assign(sim.player, { x: f.x + 0.6, y: f.y + 0.5, tile: { x: f.x, y: f.y } });
    sim.setState({ built: ['cafe'], sites: [], decorations: ['fountain'] });
    const d = Math.hypot(sim.player.x - f.x - 0.5, sim.player.y - f.y - 0.5);
    expect(d).toBeGreaterThanOrEqual(0.66 + PLAYER_RADIUS - 1e-6);
    expect(d).toBeLessThan(0.66 + PLAYER_RADIUS + 0.1);
    // and walks on from there
    sim.steer({ x: 0, y: 1 });
    const y0 = sim.player.y;
    drive(sim, 0.6);
    expect(sim.player.y).toBeGreaterThan(y0 + 0.5);
    // a resident on a lot that is built: out to an open tile beside it
    const r = sim.residents.get('cafe')!;
    const home = TOWN_WORLD.places.find((p) => p.id === 'home')!;
    Object.assign(r, { x: home.x + 0.5, y: home.y + 0.5, tile: { x: home.x, y: home.y }, path: [] });
    sim.setState({ built: ['cafe', 'home'], sites: [], decorations: ['fountain'] });
    expect(walkable(r.tile, sim.world)).toBe(true);
    expect(Math.abs(r.x - r.tile.x - 0.5) + Math.abs(r.y - r.tile.y - 0.5)).toBeLessThan(1e-9);
  });

  it('a click walk starts beside a post on a closed tile (the body may stand there)', () => {
    const lamp = TOWN_WORLD.decorations.lamps1[0];
    const sim = new TownSim(TOWN_WORLD, seeded(), TOWN_WORLD.start);
    sim.setState({ built: [], sites: [], decorations: ['lamps1'] });
    Object.assign(sim.player, { x: lamp.x + 0.85, y: lamp.y + 0.5, tile: { x: lamp.x, y: lamp.y } });
    expect(walkable(sim.player.tile, sim.world)).toBe(false);
    expect(sim.walkToTile(TOWN_WORLD.start)).toBe(true);
    run(sim, 12);
    expect(sim.player.tile).toEqual(TOWN_WORLD.start);
  });
});

describe('moveCircle and wayAlong', () => {
  it('slide along walls, stop head-on, never end inside a wall or nearer a person than their gap', () => {
    const world = room(OPEN.map((r, y) => (y === 5 ? '##############' : r)));
    // head-on: stops at the wall
    const a = moveCircle(5.5, 6.3, 0, -0.2, PLAYER_RADIUS, world);
    expect(a.y).toBeCloseTo(6 + PLAYER_RADIUS, 6);
    expect(a.x).toBeCloseTo(5.5, 9);
    // a slant: along it
    const b = moveCircle(5.5, 6.25, 0.1, -0.1, PLAYER_RADIUS, world);
    expect(b.x).toBeGreaterThan(5.55);
    expect(b.y).toBeCloseTo(6 + PLAYER_RADIUS, 6);
    // somebody in the way: round them at their gap
    const people = [{ x: 7, y: 8, gap: 0.5 }];
    let at = { x: 6, y: 8.25 };
    for (let i = 0; i < 40; i++) {
      at = moveCircle(at.x, at.y, 0.05, 0, PLAYER_RADIUS, world, people);
      expect(Math.hypot(at.x - 7, at.y - 8)).toBeGreaterThanOrEqual(0.5 - 1e-6);
    }
    expect(at.x).toBeGreaterThan(7.4);
    // head on into them: wayAlong goes round (not a stand)
    const round = wayAlong(6.45, 8.02, { x: 1, y: 0 }, PLAYER_RADIUS, world, people);
    expect(round.blocked).toBe(false);
    expect(round.move.y).toBeGreaterThan(0.5);
    // wayAlong: head-on blocked, a slant slides, beside a gate it sidesteps (half turned into it)
    expect(wayAlong(5.5, 6.25, { x: 0, y: -1 }, PLAYER_RADIUS, world).blocked).toBe(true);
    const s = wayAlong(5.5, 6 + PLAYER_RADIUS, { x: Math.SQRT1_2, y: -Math.SQRT1_2 }, PLAYER_RADIUS, world);
    expect(s.blocked).toBe(false);
    expect(s.move.y).toBeCloseTo(0, 6);
    const gated = room(OPEN.map((r, y) => (y === 5 ? '#####.########' : r)));
    const g = wayAlong(6.1, 6.25, { x: 0, y: -1 }, PLAYER_RADIUS, gated);
    expect(g.blocked).toBe(false);
    // the body turned half way into the sidestep, still mostly ahead
    expect(g.face.y).toBeLessThan(-0.7);
    expect(g.face.x).toBeLessThan(0);
    expect(g.move.x).toBeLessThan(0);
  });
});

/** An angle on (−π, π]. */
function angleOf(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

describe('TownSim', () => {
  it('starts on the start tile, or where it is told when that is walkable', () => {
    expect(new TownSim(TOWN_WORLD, seeded()).player.tile).toEqual(TOWN_WORLD.start);
    expect(new TownSim(TOWN_WORLD, seeded(), { x: 14, y: 21 }).player.tile).toEqual({ x: 14, y: 21 });
    expect(new TownSim(TOWN_WORLD, seeded(), { x: 6, y: 13 }).player.tile).toEqual(TOWN_WORLD.start);
  });

  it('residents are in town only for built places; the cat comes when bought', () => {
    const sim = new TownSim(TOWN_WORLD, seeded());
    sim.setState({ built: START, decorations: [] });
    expect([...sim.residents.keys()].sort()).toEqual([...START].sort());
    expect(sim.cat).toBeNull();
    for (const r of sim.residents.values()) expect(r.tile).toEqual(r.place.spot);
    sim.setState({ built: [...START, 'shop'], decorations: ['cat'] });
    expect(sim.residents.has('shop')).toBe(true);
    expect(sim.cat).not.toBeNull();
    expect(sim.actor('cat')).toBe(sim.cat);
    expect(sim.actor('shop')?.id).toBe('shop');
    expect(sim.actor('player')).toBe(sim.player);
    expect(sim.actor('office')).toBeNull();
    sim.setState({ built: START, decorations: [] });
    expect(sim.residents.has('shop')).toBe(false);
    expect(sim.cat).toBeNull();
  });

  it('walks to a tile along the path and reports the arrival once', () => {
    const sim = new TownSim(TOWN_WORLD, seeded());
    sim.setState({ built: START, decorations: [] });
    let called = 0;
    expect(sim.walkToTile({ x: 18, y: 24 }, () => called++)).toBe(true);
    expect(sim.goal).toEqual({ x: 18, y: 24 });
    const arrivals = run(sim, 8);
    expect(arrivals).toEqual([{ kind: 'tile', tile: { x: 18, y: 24 } }]);
    expect(called).toBe(1);
    expect(sim.player.tile).toEqual({ x: 18, y: 24 });
    expect(sim.goal).toBeNull();
  });

  it('a click on something blocked walks to the nearest free tile', () => {
    const sim = new TownSim(TOWN_WORLD, seeded());
    sim.setState({ built: START, decorations: [] });
    expect(sim.walkToTile({ x: 21, y: 21 })).toBe(true); // the fountain
    run(sim, 8);
    expect(walkable(sim.player.tile)).toBe(true);
    expect(gridDistance(sim.player.x, sim.player.y, 21.5, 21.5)).toBeLessThan(90);
  });

  it('walks up to a resident, who waits; both look at each other; the callback runs once', () => {
    const sim = new TownSim(TOWN_WORLD, seeded());
    sim.setState({ built: START, decorations: [] });
    const talked: string[] = [];
    expect(sim.walkToResident('cafe', () => talked.push('cafe'))).toBe(true);
    const emma = sim.residents.get('cafe')!;
    expect(emma.engaged).toBe(true);
    const arrivals = run(sim, 12);
    expect(arrivals).toEqual([{ kind: 'talk', placeId: 'cafe' }]);
    expect(talked).toEqual(['cafe']);
    // one tile apart, and she has not walked off
    expect(Math.max(Math.abs(sim.player.tile.x - emma.tile.x), Math.abs(sim.player.tile.y - emma.tile.y))).toBe(1);
    expect(emma.path).toHaveLength(0);
    const playerSide = sim.player.x - sim.player.y - (emma.x - emma.y);
    if (Math.abs(playerSide) > 0.05) {
      expect(sim.player.facing).toBe(playerSide < 0 ? 1 : -1);
      expect(emma.facing).toBe(playerSide < 0 ? -1 : 1);
    }
    // already beside her: at once
    expect(sim.walkToResident('cafe', () => talked.push('again'))).toBe(true);
    sim.update(1 / 60);
    expect(talked).toEqual(['cafe', 'again']);
  });

  it('a resident who is not in town cannot be walked to; the gate of the lot can', () => {
    const sim = new TownSim(TOWN_WORLD, seeded());
    sim.setState({ built: START, decorations: [] });
    expect(sim.walkToResident('office')).toBe(false);
    let opened = 0;
    expect(sim.walkToDoor('home', () => opened++)).toBe(true);
    const arrivals = run(sim, 12);
    expect(arrivals).toEqual([{ kind: 'lot', placeId: 'home' }]);
    expect(opened).toBe(1);
    expect(sim.player.tile).toEqual(WORLD_PLACES.find((p) => p.id === 'home')!.door);
  });

  it('a new order replaces the old one: the first callback never runs', () => {
    const sim = new TownSim(TOWN_WORLD, seeded());
    sim.setState({ built: START, decorations: [] });
    let first = 0;
    let second = 0;
    sim.walkToResident('friend', () => first++);
    run(sim, 0.3);
    sim.walkToTile({ x: 18, y: 24 }, () => second++);
    expect(sim.residents.get('friend')!.engaged).toBe(false);
    run(sim, 10);
    expect([first, second]).toEqual([0, 1]);
    // keys cancel a click walk too
    let third = 0;
    sim.walkToTile({ x: 23, y: 20 }, () => third++);
    run(sim, 0.2);
    sim.hold({ x: 1, y: 1 });
    run(sim, 0.5);
    sim.hold({ x: 0, y: 0 });
    run(sim, 5);
    expect(third).toBe(0);
    expect(sim.goal).toBeNull();
  });

  it('residents stroll a few tiles round their spot, never rest on a doorstep, and wait when the player is near', () => {
    const sim = new TownSim(TOWN_WORLD, seeded(3));
    sim.setState({ built: WORLD_PLACES.map((p) => p.id), decorations: ['cat'] });
    // keep the player far from everybody: the hill in the woods
    sim.walkToTile({ x: 7, y: 3 });
    const doors = WORLD_PLACES.map((p) => `${p.door.x},${p.door.y}`);
    let moved = 0;
    for (let i = 0; i < 60 * 90; i++) {
      sim.update(1 / 60);
      for (const r of sim.residents.values()) {
        expect(walkable(r.tile, sim.world), r.id).toBe(true);
        if (r.moving) moved++;
        else {
          expect(Math.max(Math.abs(r.tile.x - r.place.spot.x), Math.abs(r.tile.y - r.place.spot.y)), r.id).toBeLessThanOrEqual(3);
          expect(doors).not.toContain(`${r.tile.x},${r.tile.y}`);
        }
      }
      expect(walkable(sim.cat!.tile, sim.world)).toBe(true);
    }
    expect(moved).toBeGreaterThan(0);

    // standing next to Leo: he stays put
    const leo = sim.residents.get('square')!;
    sim.walkToResident('square');
    run(sim, 30);
    const at = { ...leo.tile };
    sim.release();
    run(sim, 20);
    expect(leo.tile).toEqual(at);
  });

  it('nobody rests with their back to the viewer: standing, a person turns three-quarters to the front', () => {
    const a = actor({ x: 5, y: 5 });
    // straight up the screen: the back of the head... no, three-quarters on the side they looked to
    a.facing = -1;
    face(a, a.x - 2, a.y - 2);
    expect(a.heading).toEqual({ x: 0, y: 1 });
    a.facing = 1;
    settle(a);
    expect(a.heading).toEqual({ x: 1, y: 0 });

    const sim = new TownSim(TOWN_WORLD, seeded(5));
    sim.setState({ built: WORLD_PLACES.map((p) => p.id), decorations: [] });
    sim.walkToTile({ x: 7, y: 3 });
    const away = (h: { x: number; y: number }) => h.x + h.y < 0 || (h.x < 0 && h.y <= 0) || (h.y < 0 && h.x <= 0);
    // once they have stood a moment (the turn back to the front takes up to four steps), a face: SE, S or SW
    const settled = SETTLE_AFTER + 4 * TURN_STEP + 0.05;
    for (let i = 0; i < 60 * 60; i++) {
      sim.update(1 / 60);
      for (const r of sim.residents.values()) if (!r.moving && !r.stepping && r.rest > settled) expect([0, 1, 2], r.id).toContain(r.oct);
    }
    // the player too, once they stop
    expect(sim.player.moving).toBe(false);
    expect(away(sim.player.heading)).toBe(false);
  });

  it('walking up to a resident, the player never stops where somebody else stands', () => {
    for (const id of ['clinic', 'square', 'cafe', 'station'] as const) {
      const sim = new TownSim(TOWN_WORLD, seeded(9));
      sim.setState({ built: WORLD_PLACES.map((p) => p.id), decorations: [] });
      expect(sim.walkToResident(id)).toBe(true);
      run(sim, 20);
      const p = sim.player.tile;
      for (const r of sim.residents.values()) {
        if (r.place.id === id) continue;
        expect(Math.max(Math.abs(r.tile.x - p.x), Math.abs(r.tile.y - p.y)), `${id}: ${r.id}`).toBeGreaterThan(0);
      }
    }
  });

  it('during a conversation the others keep two tiles clear of the pair and stop strolling; afterwards they go home', () => {
    const sim = new TownSim(TOWN_WORLD, seeded(4));
    sim.setState({ built: WORLD_PLACES.map((p) => p.id), decorations: [] });
    // Kim at the clinic on the main road, Daniel's school next door
    sim.walkToResident('clinic');
    run(sim, 20);
    sim.engage('clinic');
    const kim = sim.residents.get('clinic')!;
    run(sim, 25);
    const gap = (a: Tile, b: Tile) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
    const still = new Map([...sim.residents.values()].map((r) => [r.id, { ...r.tile }]));
    run(sim, 20);
    for (const r of sim.residents.values()) {
      if (r === kim) continue;
      expect(r.moving, r.id).toBe(false);
      expect(r.tile, r.id).toEqual(still.get(r.id));
      expect(Math.min(gap(r.tile, kim.tile), gap(r.tile, sim.player.tile)), r.id).toBeGreaterThan(2);
    }
    sim.engage(null);
    sim.walkToTile({ x: 7, y: 3 });
    run(sim, 60);
    for (const r of sim.residents.values()) expect(gap(r.tile, r.place.spot), r.id).toBeLessThanOrEqual(3);
  });

  it('the player walks at the ground speed it says', () => {
    const sim = new TownSim(TOWN_WORLD, seeded());
    sim.setState({ built: START, decorations: [] });
    sim.walkToTile({ x: 22, y: 27 });
    let top = 0;
    for (let i = 0; i < 120; i++) {
      const { x, y } = sim.player;
      sim.update(1 / 60);
      top = Math.max(top, Math.hypot(sim.player.x - x, sim.player.y - y) * 60);
    }
    expect(top).toBeCloseTo(PLAYER_SPEED, 5);
  });

  it('a held key walks on without a hitch at each tile (the distance left in a frame carries over)', () => {
    const sim = new TownSim(TOWN_WORLD, seeded());
    sim.setState({ built: START, decorations: [] });
    sim.player.oct = sim.player.want = 1;
    sim.hold(keysToDelta({ ...NO_KEYS, down: true }));
    const v: number[] = [];
    for (let i = 0; i < 70; i++) {
      const { x, y } = sim.player;
      sim.update(1 / 60);
      v.push(Math.hypot(sim.player.x - x, sim.player.y - y) * 60);
    }
    // after the start, a steady pace while the way is free (a frame that turns a corner is a chord: a little less)
    const steady = v.slice(12, 60).filter((s) => s > 0);
    expect(steady.length).toBeGreaterThan(30);
    expect(Math.min(...steady)).toBeGreaterThan(PLAYER_SPEED * 0.9);
    expect(steady.filter((s) => s < PLAYER_SPEED - 1e-6).length).toBeLessThanOrEqual(2);
  });

  it('a person standing near the player turns to them now and then, never back and forth every frame', () => {
    const sim = new TownSim(TOWN_WORLD, seeded(2));
    sim.setState({ built: START, decorations: [] });
    const r = sim.residents.get('cafe')!;
    let changes = 0;
    let last = r.want;
    for (let i = 0; i < 600; i++) {
      // the player paces left and right just below them
      sim.player.x = r.x + 0.6 + Math.sin(i / 7) * 0.8;
      sim.player.y = r.y + 0.6 - Math.sin(i / 7) * 0.8;
      sim.update(1 / 60);
      if (r.want !== last) changes++;
      last = r.want;
    }
    expect(changes).toBeLessThan(600 / (0.35 * 60) + 2);
  });
});

describe('paths and turns', () => {
  it('pulls a tile path straight wherever the way is clear, never through anything blocked', () => {
    const pairs: [Tile, Tile][] = [
      [TOWN_WORLD.start, { x: 18, y: 24 }],
      [TOWN_WORLD.start, { x: 26, y: 16 }],
      [{ x: 14, y: 21 }, { x: 27, y: 23 }],
      [{ x: 2, y: 15 }, { x: 40, y: 38 }],
      [{ x: 8, y: 6 }, { x: 39, y: 2 }],
    ];
    for (const [from, to] of pairs) {
      if (!walkable(from) || !walkable(to)) continue;
      const tiles = findPath(from, to);
      if (tiles.length === 0) continue;
      const pts = smoothPath(from.x + 0.5, from.y + 0.5, tiles);
      expect(pts.length).toBeLessThanOrEqual(tiles.length);
      expect(pts[pts.length - 1]).toEqual(to);
      let ax = from.x + 0.5;
      let ay = from.y + 0.5;
      for (const p of pts) {
        expect(lineClear(ax, ay, p.x + 0.5, p.y + 0.5)).toBe(true);
        ax = p.x + 0.5;
        ay = p.y + 0.5;
      }
    }
    // across open ground: one straight line
    const open = findPath({ x: 20, y: 23 }, { x: 23, y: 23 });
    expect(open.length).toBeGreaterThan(0);
    expect(lineClear(20.5, 23.5, 23.5, 23.5)).toBe(true);
    expect(smoothPath(20.5, 23.5, open)).toEqual([{ x: 23, y: 23 }]);
  });

  it('keeps the sprite direction until a new one leads clearly (no flicker on a path near an octant edge)', () => {
    expect(octantOf(1, 0)).toBe(0);
    expect(octantOf(1, 1)).toBe(1);
    expect(octantOf(0, -1)).toBe(6);
    // 30° from +x: past the 22.5° edge, but within the hysteresis: stays 0
    const a30 = { x: Math.cos(Math.PI / 6), y: Math.sin(Math.PI / 6) };
    expect(octantOf(a30.x, a30.y)).toBe(1);
    expect(octantSticky(a30.x, a30.y, 0)).toBe(0);
    // 40°: clearly the next one
    expect(octantSticky(Math.cos((40 * Math.PI) / 180), Math.sin((40 * Math.PI) / 180), 0)).toBe(1);
  });

  it('a half turn goes round through the front (the face), a step of 45° at a time', () => {
    const a = actor({ x: 5, y: 5 });
    a.oct = 7; // E
    a.want = 3; // W
    const seen = [a.oct];
    for (let i = 0; i < 30; i++) {
      turn(a, 1 / 60);
      if (a.oct !== seen[seen.length - 1]) seen.push(a.oct);
    }
    expect(seen).toEqual([7, 0, 1, 2, 3]);
  });

  it('walking along a line between two octants, the sprite takes the nearest one after a moment (no crab walk)', () => {
    // 31° from +x: within the hysteresis band of octant 0, but octant 1 (45°) is the nearest
    const a = actor({ x: 3, y: 3 });
    a.oct = a.want = 0;
    a.path = [{ x: 13, y: 9 }];
    const at: number[] = [];
    for (let i = 0; i < 60; i++) {
      advance(a, 1 / 60);
      at.push(a.want);
    }
    // not at once (a short wobble does not turn the sprite) …
    expect(at[3]).toBe(0);
    // … but within a quarter of a second it walks the way it looks
    expect(at.slice(15).every((w) => w === 1)).toBe(true);
    expect(a.oct).toBe(1);
  });

  it('the last step lands as the body stops: no legs scissoring after the stop, no snap', () => {
    for (const len of [1, 2, 3, 5]) {
      const a = actor({ x: 2, y: 2 });
      a.stride = 0.51;
      a.speed = 0.8;
      a.oct = a.want = 0;
      a.path = [{ x: 2 + len, y: 2 }];
      const steps: number[] = [];
      let done = false;
      for (let i = 0; i < 1200 && !done; i++) {
        const ph = a.phase;
        done = advance(a, 1 / 60);
        steps.push(a.phase - ph);
      }
      expect(done).toBe(true);
      // legs together at the very moment the body stops
      expect(a.stepping, `${len} tiles`).toBe(false);
      expect(Math.abs(a.phase / Math.PI - Math.round(a.phase / Math.PI))).toBeLessThan(1e-6);
      // and the legs never run much faster than the walk to get there
      const walk = (a.speed / 60 / a.stride) * Math.PI * 2;
      expect(Math.max(...steps), `${len} tiles`).toBeLessThanOrEqual(walk * 1.65);
    }
  });

  it('setting off, the first step lifts as the body starts to move (no gliding on closed legs)', () => {
    const a = actor({ x: 2, y: 2 });
    a.stride = 0.51;
    a.speed = 0.8;
    a.oct = a.want = 0;
    a.path = [{ x: 8, y: 2 }];
    for (let i = 0; i < 6; i++) advance(a, 1 / 60);
    // a sixteenth of a cycle is one frame of the walk
    expect(a.phase / (Math.PI * 2)).toBeGreaterThan(1 / 16);
  });

  it('a resident waits for somebody standing in the way instead of walking through them', () => {
    const sim = new TownSim(TOWN_WORLD, seeded(3));
    sim.setState({ built: START, decorations: [] });
    const r = sim.residents.get('friend')!;
    // a straight walk of 4 tiles, the player standing on it half way
    const to = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }]
      .map((d) => ({ x: r.tile.x + d.x * 4, y: r.tile.y + d.y * 4 }))
      .find((t) => walkable(t) && lineClear(r.x, r.y, t.x + 0.5, t.y + 0.5));
    expect(to).toBeDefined();
    sim.player.x = (r.x + to!.x + 0.5) / 2;
    sim.player.y = (r.y + to!.y + 0.5) / 2;
    sim.player.tile = { x: Math.floor(sim.player.x), y: Math.floor(sim.player.y) };
    r.path = [to!];
    let closest = Infinity;
    for (let i = 0; i < 60 * 9; i++) {
      sim.update(1 / 60);
      closest = Math.min(closest, Math.hypot(r.x - sim.player.x, r.y - sim.player.y));
    }
    // it came up to them (it did walk) and stopped short
    expect(closest).toBeLessThan(1);
    expect(closest).toBeGreaterThan(0.3);
    // after a moment it went round them on a curve (or gave the walk up), and stands, legs together
    expect(r.moving).toBe(false);
  });

  it('walking up to talk, the two stand apart on the screen: side by side first, never straight in front', () => {
    expect(talkSpotCost({ x: 1, y: -1 })).toBe(0);
    expect(talkSpotCost({ x: -1, y: 1 })).toBe(0);
    expect(talkSpotCost({ x: 1, y: 0 })).toBeLessThan(talkSpotCost({ x: -1, y: 0 }));
    expect(talkSpotCost({ x: 0, y: -1 })).toBeLessThan(talkSpotCost({ x: 1, y: 1 }));
    expect(talkSpotCost({ x: -1, y: -1 })).toBe(talkSpotCost({ x: 1, y: 1 }));
  });

  it('nobody ever turns more than 45° in one frame, walking, strolling or standing', () => {
    const sim = new TownSim(TOWN_WORLD, seeded(11));
    sim.setState({ built: WORLD_PLACES.map((p) => p.id), decorations: ['cat'] });
    const rng = seeded(12);
    const all = () => [sim.player, ...sim.residents.values(), sim.cat!];
    let last = new Map(all().map((a) => [a.id, a.oct]));
    for (let i = 0; i < 60 * 120; i++) {
      if (i % 150 === 0) sim.walkToTile({ x: Math.floor(rng() * TOWN_WORLD.size), y: Math.floor(rng() * TOWN_WORLD.size) });
      sim.update(1 / 60);
      for (const a of all()) {
        const d = Math.abs(a.oct - (last.get(a.id) ?? a.oct));
        expect(Math.min(d, 8 - d), a.id).toBeLessThanOrEqual(1);
      }
      last = new Map(all().map((a) => [a.id, a.oct]));
    }
  });

  it('a click walk through a tile where somebody stands goes round them (or they step aside), at least half a tile off', () => {
    let tested = 0;
    for (const id of ['square', 'cafe', 'friend', 'school', 'shop'] as const) {
      const sim = new TownSim(TOWN_WORLD, seeded(21));
      sim.setState({ built: WORLD_PLACES.map((p) => p.id), decorations: [] });
      const r = sim.residents.get(id)!;
      const at = { ...r.tile };
      // walks whose shortest way goes over the tile they stand on, from one side of them to the other
      const tries: [Tile, Tile][] = [];
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const a = { x: at.x + dx, y: at.y + dy };
          const b = { x: at.x - dx, y: at.y - dy };
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 2 || !walkable(a) || !walkable(b)) continue;
          // nobody else standing at either end
          if ([...sim.residents.values()].some((o) => o !== r && [a, b].some((t) => Math.hypot(o.x - t.x - 0.5, o.y - t.y - 0.5) < 1.5))) continue;
          const way = findPath(a, b);
          if (way.length <= 7 && way.some((t) => t.x === at.x && t.y === at.y)) tries.push([a, b]);
        }
      }
      for (const [from, to] of tries.slice(0, 2)) {
        for (const o of sim.residents.values()) o.wanderIn = 99;
        Object.assign(sim.player, { x: from.x + 0.5, y: from.y + 0.5, tile: { ...from }, path: [] });
        Object.assign(r, { x: at.x + 0.5, y: at.y + 0.5, tile: { ...at }, path: [] });
        expect(sim.walkToTile(to)).toBe(true);
        let closest = Infinity;
        for (let i = 0; i < 60 * 12 && sim.goal; i++) {
          sim.update(1 / 60);
          for (const o of sim.residents.values()) closest = Math.min(closest, Math.hypot(o.x - sim.player.x, o.y - sim.player.y));
        }
        const what = `${id}: ${JSON.stringify(from)} → ${JSON.stringify(to)}`;
        expect(sim.goal, what).toBeNull();
        expect(closest, what).toBeGreaterThanOrEqual(0.5);
        tested++;
      }
    }
    expect(tested).toBeGreaterThan(2);
  });

  it('walking about the town, the player never walks through anybody (clicks and keys)', () => {
    const sim = new TownSim(TOWN_WORLD, seeded(8));
    sim.setState({ built: WORLD_PLACES.map((p) => p.id), decorations: ['cat'] });
    const rng = seeded(9);
    let closest = Infinity;
    const keys = [
      { x: 1, y: 1 },
      { x: -1, y: -1 },
      { x: 1, y: -1 },
      { x: -1, y: 1 },
    ];
    for (let i = 0; i < 60 * 150; i++) {
      if (i % 240 === 0) {
        if (rng() < 0.5) sim.walkToTile({ x: Math.floor(rng() * TOWN_WORLD.size), y: Math.floor(rng() * TOWN_WORLD.size) });
        else sim.hold(keys[Math.floor(rng() * 4)]);
      }
      if (i % 240 === 200) sim.hold({ x: 0, y: 0 });
      sim.update(1 / 60);
      for (const r of sim.residents.values()) closest = Math.min(closest, Math.hypot(r.x - sim.player.x, r.y - sim.player.y));
    }
    // two figures about 0.45 tile wide: half a tile apart they only touch
    expect(closest).toBeGreaterThanOrEqual(0.45);
  });

  it('somebody who waits for a person in the way stands legs together, then goes round them (or gives up and leaves that way alone)', () => {
    const sim = new TownSim(TOWN_WORLD, seeded(3));
    sim.setState({ built: START, decorations: [] });
    const r = sim.residents.get('friend')!;
    const to = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }]
      .map((d) => ({ x: r.tile.x + d.x * 4, y: r.tile.y + d.y * 4 }))
      .find((t) => walkable(t) && lineClear(r.x, r.y, t.x + 0.5, t.y + 0.5));
    sim.player.x = (r.x + to!.x + 0.5) / 2;
    sim.player.y = (r.y + to!.y + 0.5) / 2;
    sim.player.tile = { x: Math.floor(sim.player.x), y: Math.floor(sim.player.y) };
    r.path = [to!];
    let stoppedAt = -1;
    let closedAt = -1;
    let gapAtStop = 0;
    for (let i = 0; i < 60 * 3 && r.path.length > 0; i++) {
      sim.update(1 / 60);
      if (stoppedAt < 0 && r.moving && r.v === 0) {
        stoppedAt = i;
        gapAtStop = Math.hypot(r.x - sim.player.x, r.y - sim.player.y);
      }
      if (stoppedAt >= 0 && closedAt < 0 && Math.abs(r.phase / Math.PI - Math.round(r.phase / Math.PI)) < 1e-6) closedAt = i;
    }
    expect(stoppedAt).toBeGreaterThanOrEqual(0);
    // the legs close within a quarter of a second of the stop: never a stride held mid-air
    expect(closedAt).toBeGreaterThanOrEqual(0);
    expect((closedAt - stoppedAt) / 60).toBeLessThanOrEqual(0.25);
    // behind somebody standing, soon: a way round them clear of them, or the walk given up and that heading left alone
    if (r.path.length > 0) expect(passes(r, r.path, sim.player)).toBeGreaterThanOrEqual(0.5);
    else expect(r.avoid).not.toBeNull();
    // it stopped short of them, by more than half a tile
    expect(gapAtStop).toBeGreaterThan(0.7);
  });

  it('a stride stopped just after it began goes back down; one well under way finishes (never a whole step on the spot)', () => {
    expect(closeTarget(0.1 * Math.PI)).toBe(0);
    expect(closeTarget(0.6 * Math.PI)).toBeCloseTo(Math.PI, 12);
    expect(closeTarget(2.2 * Math.PI)).toBeCloseTo(2 * Math.PI, 12);
    expect(closeTarget(2.9 * Math.PI)).toBeCloseTo(3 * Math.PI, 12);
    // standing, the legs get there and stop
    const a = actor({ x: 4, y: 4 });
    a.phase = 0.15 * Math.PI;
    a.stepping = true;
    for (let i = 0; i < 30; i++) standTick(a, 1 / 60, i / 60);
    expect(a.stepping).toBe(false);
    expect(a.phase).toBe(0);
  });

  it('setting off the other way, a person turns on the spot first and walks once within 45° of the way', () => {
    const a = actor({ x: 5, y: 5 });
    a.oct = a.want = 1;
    a.path = [{ x: 3, y: 3 }];
    for (let i = 0; i < 60; i++) {
      const x0 = a.x;
      const y0 = a.y;
      advance(a, 1 / 60);
      if (a.x !== x0 || a.y !== y0) {
        const d = Math.abs(((a.want - a.oct + 12) % 8) - 4);
        expect(d).toBeLessThanOrEqual(1);
        return;
      }
    }
    throw new Error('never set off');
  });

  it('the cat sits down and gets up through the in-between poses, turns only standing, and sits with room round it', () => {
    const sim = new TownSim(TOWN_WORLD, seeded(13));
    sim.setState({ built: WORLD_PLACES.map((p) => p.id), decorations: ['cat'] });
    sim.walkToTile({ x: 7, y: 3 });
    const cat = sim.cat as Cat;
    let lastSit = cat.sit;
    let lastOct = cat.oct;
    let between = 0;
    let crowdedFor = 0;
    let worst = 0;
    for (let i = 0; i < 60 * 120; i++) {
      sim.update(1 / 60);
      // never from standing to seated (or back) in one frame
      expect(Math.abs(cat.sit - lastSit)).toBeLessThan(0.05);
      if (cat.sit > 0 && cat.sit < 1) between++;
      // never turning while seated or sitting down
      if (lastSit > 0 && cat.sit > 0) expect(cat.oct).toBe(lastOct);
      // a seated cat is not at somebody's feet for long
      const near = [...sim.residents.values()].some((r) => !r.moving && Math.hypot(r.x - cat.x, r.y - cat.y) < 0.8);
      crowdedFor = cat.sit >= 1 && near ? crowdedFor + 1 / 60 : 0;
      worst = Math.max(worst, crowdedFor);
      lastSit = cat.sit;
      lastOct = cat.oct;
    }
    expect(between).toBeGreaterThan(0);
    expect(worst).toBeLessThan(2.5);
  });

  it('walking up to talk, the player ends side by side with the resident on the screen whenever there is room', () => {
    for (const id of ['clinic', 'square', 'cafe', 'station', 'friend', 'shop'] as const) {
      const sim = new TownSim(TOWN_WORLD, seeded(9));
      sim.setState({ built: WORLD_PLACES.map((p) => p.id), decorations: [] });
      expect(sim.walkToResident(id)).toBe(true);
      run(sim, 20);
      const r = sim.residents.get(id)!;
      const d = { x: Math.round(sim.player.x - r.x), y: Math.round(sim.player.y - r.y) };
      expect(TALK_SPOTS.some((s) => s.x === d.x && s.y === d.y), id).toBe(true);
      // on the screen: apart across (the figures are about 29 world px wide), about a tile apart on the ground (TALK_GAP)
      expect(Math.abs((sim.player.x - r.x - (sim.player.y - r.y)) * 32), id).toBeGreaterThanOrEqual(40);
      expect(Math.hypot(sim.player.x - r.x, sim.player.y - r.y), id).toBeLessThan(1.6);
    }
    // costs: across first, never one tile along a row or straight in front
    expect(talkSpotCost({ x: 2, y: -1 })).toBeLessThan(talkSpotCost({ x: 1, y: 0 }));
    expect(talkSpotCost({ x: 2, y: 0 })).toBeLessThan(talkSpotCost({ x: 0, y: 1 }));
  });

  it('the last corner of a walk is cut when the way is clear (no walking along a row, then a sharp turn)', () => {
    // open plaza ground: a path along a row and then one tile up the column
    const tiles = [{ x: 22, y: 22 }, { x: 23, y: 22 }, { x: 24, y: 22 }, { x: 24, y: 21 }];
    expect(tiles.every((t) => walkable(t))).toBe(true);
    const pts = smoothPath(21.5, 22.5, tiles);
    expect(pts[pts.length - 1]).toEqual({ x: 24, y: 21 });
    // either one straight line, or a corner point before the last tile of the row
    if (pts.length > 1) expect(pts[pts.length - 2].x).toBeLessThan(23.5);
  });
  it('on open ground a click walk goes round somebody standing in its way (they are not shoved aside)', () => {
    // the plaza: the player at (20,22), somebody standing at (22,22), a walk to (24,22) straight through their tile
    for (const t of [{ x: 20, y: 22 }, { x: 22, y: 22 }, { x: 24, y: 22 }, { x: 22, y: 21 }, { x: 22, y: 23 }]) expect(walkable(t)).toBe(true);
    const sim = new TownSim(TOWN_WORLD, seeded(7), { x: 20, y: 22 });
    sim.setState({ built: ['square'], decorations: [] });
    const r = sim.residents.get('square')!;
    Object.assign(r, { x: 22.5, y: 22.5, tile: { x: 22, y: 22 }, path: [], wanderIn: 1e9 });
    let arrived = -1;
    let t = 0;
    let closest = Infinity;
    expect(sim.walkToTile({ x: 24, y: 22 }, () => (arrived = t))).toBe(true);
    for (; t < 6; t += 1 / 60) {
      sim.update(1 / 60);
      closest = Math.min(closest, Math.hypot(sim.player.x - r.x, sim.player.y - r.y));
    }
    // round them in one go: no wait behind them, no shove (four tiles at the walk's pace, a little longer for the bend:
    // the time of 5.1 tiles at most)
    expect(arrived).toBeGreaterThan(0);
    expect(arrived).toBeLessThan(5.1 / PLAYER_SPEED);
    expect(Math.hypot(r.x - 22.5, r.y - 22.5)).toBeLessThan(0.01);
    expect(closest).toBeGreaterThanOrEqual(0.5);
  });

  it('a resident called to talk early in a diagonal step finishes it forwards (no about-face)', () => {
    for (const frac of [0.02, 0.08, 0.14, 0.2]) {
      const sim = new TownSim(TOWN_WORLD, seeded(), { x: 14, y: 21 });
      sim.setState({ built: ['square'], decorations: [] });
      const r = sim.residents.get('square')!;
      Object.assign(r, { x: 22.5 + frac, y: 22.5 + frac, tile: { x: 22, y: 22 }, path: [{ x: 23, y: 23 }], moving: true, v: 0.8, oct: 1, want: 1 });
      sim.engage('square');
      const c = r.path[0];
      expect(c.x + 0.5 - r.x + (c.y + 0.5 - r.y), `${frac}`).toBeGreaterThan(0);
    }
  });

  it('a click walk never stays stuck behind somebody who cannot make way (one-tile roads, the cat)', { timeout: 30000 }, () => {
    // every place built and the cat: random walks and talks; these seeds once boxed the player in for good in the
    // old west road (row 10 of the 21-tile town) behind residents and the cat getting up and sitting down again
    for (const [hz, seed] of [
      [60, 2],
      [60, 9],
      [30, 1],
    ] as const) {
      const rng = seeded(seed * 31 + hz);
      const sim = new TownSim(TOWN_WORLD, seeded(seed));
      sim.setState({ built: WORLD_PLACES.map((p) => p.id), decorations: ['cat'] });
      const ids = WORLD_PLACES.map((p) => p.id);
      for (let walk = 0; walk < 12; walk++) {
        const talk = rng() < 0.4;
        const id = ids[Math.floor(rng() * ids.length)];
        let done = false;
        const ok = talk ? sim.walkToResident(id, () => (done = true)) : sim.walkToTile({ x: Math.floor(rng() * TOWN_WORLD.size), y: Math.floor(rng() * TOWN_WORLD.size) }, () => (done = true));
        if (!ok) continue;
        // (a walk across the island takes about 21 s at the calm paces: 25 s was the budget at 1.5 / 2.6 tiles/s)
        for (let t = 0; t < 32 && !done; t += 1 / hz) sim.update(1 / hz);
        expect(done, `${hz} Hz seed ${seed} walk ${walk}`).toBe(true);
        if (talk) {
          // they stand apart, not one in the other
          const r = sim.residents.get(id)!;
          expect(Math.hypot(sim.player.x - r.x, sim.player.y - r.y), `${hz} Hz seed ${seed} walk ${walk}`).toBeGreaterThanOrEqual(0.85);
          sim.engage(id);
          for (let k = 0; k < hz * 3; k++) sim.update(1 / hz);
          sim.engage(null);
        }
      }
    }
  });
});

describe('motion of the 3D town (planted feet need a body that goes where it faces)', () => {
  it('a long click walk is run, a short one walked; the run turns back into a walk before the end; Shift runs', () => {
    const sim = new TownSim(TOWN_WORLD, seeded(), { x: 12, y: 22 });
    sim.setState({ built: [], decorations: [] });
    const top = (tile: Tile, seconds: number) => {
      sim.walkToTile(tile);
      let most = 0;
      let lastStretch = 0;
      for (let t = 0; t < seconds && sim.goal; t += 1 / 60) {
        const { x, y } = sim.player;
        sim.update(1 / 60);
        const v = Math.hypot(sim.player.x - x, sim.player.y - y) * 60;
        most = Math.max(most, v);
        if (sim.goal && Math.hypot(sim.goal.x + 0.5 - sim.player.x, sim.goal.y + 0.5 - sim.player.y) < 1.5) lastStretch = Math.max(lastStretch, v);
      }
      return { most, lastStretch };
    };
    const far = top({ x: 30, y: 24 }, 20);
    // (sliding round a corner the body may go a hair faster than its pace for a frame)
    expect(far.most).toBeGreaterThan(PLAYER_RUN * 0.99);
    expect(far.most).toBeLessThan(PLAYER_RUN * 1.01);
    expect(far.lastStretch).toBeLessThanOrEqual(PLAYER_SPEED + 1e-6);
    const near = top({ x: sim.player.tile.x - 3, y: sim.player.tile.y }, 10);
    expect(near.most).toBeLessThanOrEqual(PLAYER_SPEED + 1e-6);
    sim.setRun(true);
    expect(top({ x: sim.player.tile.x + 3, y: sim.player.tile.y }, 10).most).toBeGreaterThan(PLAYER_RUN * 0.99);
  });

  it('round a corner the walk is an arc: the body faces the way it goes (no crab walk), the pace never drops to a stand', () => {
    const a = actor({ x: 20, y: 22 });
    a.speed = 1.5;
    a.oct = a.want = 0;
    a.yaw = 0;
    // along the plaza row, then a right-angle turn down the column (open ground)
    a.path = [{ x: 24, y: 22 }, { x: 24, y: 26 }];
    let worst = 0;
    let slowest = Infinity;
    let done = false;
    for (let i = 0; i < 600 && !done; i++) {
      const { x, y } = a;
      done = advance(a, 1 / 60);
      const d = Math.hypot(a.x - x, a.y - y);
      if (d * 60 > 0.3) {
        const off = Math.abs(Math.atan2(Math.sin(Math.atan2(a.y - y, a.x - x) - a.yaw!), Math.cos(Math.atan2(a.y - y, a.x - x) - a.yaw!)));
        worst = Math.max(worst, off);
      }
      if (i > 15 && !done && a.path.length === 1 && Math.hypot(a.x - 24.5, a.y - 26.5) > 1.2) slowest = Math.min(slowest, d * 60);
    }
    expect(done).toBe(true);
    expect([a.x, a.y]).toEqual([24.5, 26.5]);
    expect((worst * 180) / Math.PI).toBeLessThan(15);
    // it slows into the bend, never to a halt
    expect(slowest).toBeGreaterThan(0.5);
  });

  it('a seat is sat on from right in front of it, never from its own tile; standing near somebody turns the head first', () => {
    for (const seat of TOWN_WORLD.life!.seats) {
      const f = seatFront(seat);
      expect(Math.floor(f.x) === seat.from.x && Math.floor(f.y) === seat.from.y).toBe(true);
      // in front of the seat, the way it faces
      const o = { x: Math.cos(octAngle(seat.oct)), y: Math.sin(octAngle(seat.oct)) };
      expect((f.x - seat.x) * o.x + (f.y - seat.y) * o.y).toBeGreaterThan(0.25);
    }
    const a = actor({ x: 5, y: 5 });
    a.oct = a.want = 0;
    // 45° round: the head does it, the body stays
    faceIfFar(a, a.x + 2, a.y + 2);
    expect(a.want).toBe(0);
    // behind them: the body turns
    faceIfFar(a, a.x - 2, a.y + 0.5);
    expect(a.want).not.toBe(0);
  });

  it('two walkers kept apart by the gap rule stand a moment, then go round; nobody creeps at a crawl', () => {
    const sim = new TownSim(TOWN_WORLD, seeded(5), { x: 14, y: 21 });
    sim.setState({ built: ['square', 'cafe'], decorations: [] });
    const [r, q] = ['square', 'cafe'].map((id) => sim.residents.get(id as 'square' | 'cafe')!);
    for (const o of [r, q]) o.wanderIn = 1e9;
    // head on along the plaza row
    Object.assign(r, { x: 20.5, y: 23.5, tile: { x: 20, y: 23 }, path: [{ x: 25, y: 23 }], moving: false, v: 0 });
    Object.assign(q, { x: 25.5, y: 23.5, tile: { x: 25, y: 23 }, path: [{ x: 20, y: 23 }], moving: false, v: 0 });
    // the longest run of frames at a crawl (above a standstill, under a quarter of a stroll's pace), per walker
    const run = [0, 0];
    let crawl = 0;
    let closest = Infinity;
    for (let i = 0; i < 60 * 12; i++) {
      const before = [r.x, r.y, q.x, q.y];
      sim.update(1 / 60);
      closest = Math.min(closest, Math.hypot(r.x - q.x, r.y - q.y));
      for (const [o, k] of [[r, 0], [q, 2]] as const) {
        const v = Math.hypot(o.x - before[k], o.y - before[k + 1]) * 60;
        run[k / 2] = v > 0.01 && v < 0.25 * RESIDENT_SPEED ? run[k / 2] + 1 : 0;
        crawl = Math.max(crawl, run[k / 2]);
      }
    }
    expect(closest).toBeGreaterThanOrEqual(0.5 - 1e-9);
    // (a start or a stop passes through a crawl in a frame or two; never a creep)
    expect(crawl).toBeLessThanOrEqual(3);
  });
});

describe('staging a talk (engine/staging.ts, docs/town.md §7 "Staging")', () => {
  it('gather: both walk to their exact points, the resident briskly; arrival runs once; the end frees them', () => {
    const sim = new TownSim(TOWN_WORLD, seeded());
    sim.setState({ built: START, decorations: [] });
    const emma = sim.residents.get('cafe')!;
    const pace = emma.speed;
    let arrived = 0;
    const residentAt = { x: 24.5, y: 17.5 };
    const playerAt = { x: 23.75, y: 18.25 };
    expect(sim.gather('cafe', residentAt, playerAt, () => arrived++)).toBe(true);
    expect(emma.engaged).toBe(true);
    expect(emma.speed).toBeGreaterThanOrEqual(1.25);
    run(sim, 12);
    expect(arrived).toBe(1);
    expect(Math.hypot(sim.player.x - playerAt.x, sim.player.y - playerAt.y)).toBeLessThan(0.05);
    expect(Math.hypot(emma.x - residentAt.x, emma.y - residentAt.y)).toBeLessThan(0.05);
    sim.endGather();
    expect(emma.engaged).toBe(false);
    expect(emma.speed).toBe(pace);
  });

  it('gather refuses a spot nobody can stand on, and changes nothing then', () => {
    const sim = new TownSim(TOWN_WORLD, seeded());
    sim.setState({ built: START, decorations: [] });
    expect(sim.gather('cafe', null, { x: 6.5, y: 14.5 })).toBe(false); // the lake
    expect(sim.residents.get('cafe')!.engaged).toBe(false);
    expect(sim.goal).toBeNull();
  });

  it('a resident goes into a room with the player and comes out of that door later; the player is put out of it', () => {
    const sim = new TownSim(TOWN_WORLD, seeded(), undefined, { clock: () => 10 * 60 });
    sim.setState({ built: START, decorations: [] });
    const door = { x: 23, y: 17 };
    sim.goInside('cafe', door, 2);
    expect(sim.actor('cafe')).toBeNull();
    sim.placePlayer({ x: 30.5, y: 30.5 }, Math.PI / 2);
    expect(sim.player.tile).toEqual({ x: 30, y: 30 });
    expect(sim.player.yaw).toBeCloseTo(Math.PI / 2);
    run(sim, 3);
    // (out of the same door: no stepping out of a wall)
    expect(sim.actor('cafe')).not.toBeNull();
  });

  it('a resident put further along their walk keeps the rest of it, and halt stops the player where they are', () => {
    const sim = new TownSim(TOWN_WORLD, seeded());
    sim.setState({ built: START, decorations: [] });
    sim.jumpResident('cafe', { x: 22.5, y: 19.5 }, [{ x: 24, y: 19 }]);
    expect(sim.residents.get('cafe')!.tile).toEqual({ x: 22, y: 19 });
    expect(sim.pathOf('cafe')).toEqual([{ x: 24, y: 19 }]);
    sim.walkToTile({ x: 14, y: 24 });
    run(sim, 0.5);
    sim.halt();
    run(sim, 1);
    expect(sim.goal).toBeNull();
    expect(sim.player.moving).toBe(false);
  });
});
