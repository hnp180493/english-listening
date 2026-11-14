import { describe, expect, it } from 'vitest';
import { canStep, walkable } from '../../../core/town/map';
import { TOWN_WORLD, WORLD_PLACES, type Tile } from '../../../data/townWorld';
import {
  advance,
  closeTarget,
  face,
  gridDistance,
  keysToDelta,
  lineClear,
  octantOf,
  octantSticky,
  PLAYER_SPEED,
  SETTLE_AFTER,
  settle,
  slideStep,
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

  it('a blocked diagonal slides along the free side; a blocked straight step stays', () => {
    // (9,11) is plaza, the fountain is at (10,10): "right" (x+1, y-1) is blocked, x+1 and y-1 are free
    expect(canStep({ x: 9, y: 11 }, { x: 1, y: -1 })).toBe(false);
    expect(slideStep({ x: 9, y: 11 }, { x: 1, y: -1 })).toEqual({ x: 1, y: 0 });
    expect(slideStep({ x: 9, y: 11 }, { x: 1, y: 1 })).toEqual({ x: 1, y: 1 });
    expect(slideStep({ x: 9, y: 10 }, { x: 1, y: 0 })).toBeNull();
    expect(slideStep({ x: 9, y: 10 }, { x: 0, y: 0 })).toBeNull();
  });

  it('holding a key walks tile after tile, only over walkable tiles, and stops when let go', () => {
    const sim = new TownSim(TOWN_WORLD, seeded());
    sim.setState({ built: START, decorations: [] });
    const from = { ...sim.player.tile };
    sim.hold(keysToDelta({ ...NO_KEYS, down: true }));
    for (let i = 0; i < 240; i++) {
      sim.update(1 / 60);
      expect(walkable(sim.player.tile)).toBe(true);
    }
    expect(sim.player.tile).not.toEqual(from);
    sim.hold({ x: 0, y: 0 });
    run(sim, 1);
    const rest = { ...sim.player.tile };
    expect(sim.player.moving).toBe(false);
    expect(sim.player.x).toBe(rest.x + 0.5);
    run(sim, 1);
    expect(sim.player.tile).toEqual(rest);
  });
});

describe('TownSim', () => {
  it('starts on the start tile, or where it is told when that is walkable', () => {
    expect(new TownSim(TOWN_WORLD, seeded()).player.tile).toEqual(TOWN_WORLD.start);
    expect(new TownSim(TOWN_WORLD, seeded(), { x: 4, y: 10 }).player.tile).toEqual({ x: 4, y: 10 });
    expect(new TownSim(TOWN_WORLD, seeded(), { x: 10, y: 10 }).player.tile).toEqual(TOWN_WORLD.start);
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
    expect(sim.walkToTile({ x: 6, y: 12 }, () => called++)).toBe(true);
    expect(sim.goal).toEqual({ x: 6, y: 12 });
    const arrivals = run(sim, 8);
    expect(arrivals).toEqual([{ kind: 'tile', tile: { x: 6, y: 12 } }]);
    expect(called).toBe(1);
    expect(sim.player.tile).toEqual({ x: 6, y: 12 });
    expect(sim.goal).toBeNull();
  });

  it('a click on something blocked walks to the nearest free tile', () => {
    const sim = new TownSim(TOWN_WORLD, seeded());
    sim.setState({ built: START, decorations: [] });
    expect(sim.walkToTile({ x: 13, y: 13 })).toBe(true); // the pond
    run(sim, 8);
    expect(walkable(sim.player.tile)).toBe(true);
    expect(gridDistance(sim.player.x, sim.player.y, 13.5, 13.5)).toBeLessThan(90);
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
    sim.walkToTile({ x: 8, y: 12 }, () => second++);
    expect(sim.residents.get('friend')!.engaged).toBe(false);
    run(sim, 10);
    expect([first, second]).toEqual([0, 1]);
    // keys cancel a click walk too
    let third = 0;
    sim.walkToTile({ x: 12, y: 9 }, () => third++);
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
    // keep the player far from everybody: the top corner of the island
    sim.walkToTile({ x: 0, y: 1 });
    const doors = WORLD_PLACES.map((p) => `${p.door.x},${p.door.y}`);
    let moved = 0;
    for (let i = 0; i < 60 * 90; i++) {
      sim.update(1 / 60);
      for (const r of sim.residents.values()) {
        expect(walkable(r.tile), r.id).toBe(true);
        if (r.moving) moved++;
        else {
          expect(Math.max(Math.abs(r.tile.x - r.place.spot.x), Math.abs(r.tile.y - r.place.spot.y)), r.id).toBeLessThanOrEqual(3);
          expect(doors).not.toContain(`${r.tile.x},${r.tile.y}`);
        }
      }
      expect(walkable(sim.cat!.tile)).toBe(true);
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
    sim.walkToTile({ x: 0, y: 1 });
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
    // Kim at the clinic: Grace's spot is right next to where the player stands
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
    sim.walkToTile({ x: 0, y: 1 });
    run(sim, 60);
    for (const r of sim.residents.values()) expect(gap(r.tile, r.place.spot), r.id).toBeLessThanOrEqual(3);
  });

  it('the player walks at the ground speed it says', () => {
    const sim = new TownSim(TOWN_WORLD, seeded());
    sim.setState({ built: START, decorations: [] });
    sim.walkToTile({ x: 10, y: 17 });
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
      [TOWN_WORLD.start, { x: 6, y: 12 }],
      [TOWN_WORLD.start, { x: 15, y: 5 }],
      [{ x: 4, y: 10 }, { x: 16, y: 12 }],
      [{ x: 2, y: 2 }, { x: 17, y: 17 }],
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
    const open = findPath({ x: 9, y: 12 }, { x: 12, y: 12 });
    if (open.length > 0 && lineClear(9.5, 12.5, 12.5, 12.5)) expect(smoothPath(9.5, 12.5, open)).toEqual([{ x: 12, y: 12 }]);
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
    const r = sim.residents.get('cafe')!;
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
    for (let i = 0; i < 60 * 6; i++) {
      sim.update(1 / 60);
      closest = Math.min(closest, Math.hypot(r.x - sim.player.x, r.y - sim.player.y));
    }
    // it came up to them (it did walk) and stopped short
    expect(closest).toBeLessThan(1);
    expect(closest).toBeGreaterThan(0.3);
    // gave the walk up after a while and stands, legs together
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
      if (i % 150 === 0) sim.walkToTile({ x: Math.floor(rng() * 21), y: Math.floor(rng() * 21) });
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
        if (rng() < 0.5) sim.walkToTile({ x: Math.floor(rng() * 21), y: Math.floor(rng() * 21) });
        else sim.hold(keys[Math.floor(rng() * 4)]);
      }
      if (i % 240 === 200) sim.hold({ x: 0, y: 0 });
      sim.update(1 / 60);
      for (const r of sim.residents.values()) closest = Math.min(closest, Math.hypot(r.x - sim.player.x, r.y - sim.player.y));
    }
    // two figures about 0.45 tile wide: half a tile apart they only touch
    expect(closest).toBeGreaterThanOrEqual(0.45);
  });

  it('somebody who waits for a person in the way stands legs together, then gives up and does not try that way again at once', () => {
    const sim = new TownSim(TOWN_WORLD, seeded(3));
    sim.setState({ built: START, decorations: [] });
    const r = sim.residents.get('cafe')!;
    const to = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }]
      .map((d) => ({ x: r.tile.x + d.x * 4, y: r.tile.y + d.y * 4 }))
      .find((t) => walkable(t) && lineClear(r.x, r.y, t.x + 0.5, t.y + 0.5));
    sim.player.x = (r.x + to!.x + 0.5) / 2;
    sim.player.y = (r.y + to!.y + 0.5) / 2;
    sim.player.tile = { x: Math.floor(sim.player.x), y: Math.floor(sim.player.y) };
    r.path = [to!];
    let stoppedAt = -1;
    let closedAt = -1;
    for (let i = 0; i < 60 * 3 && r.path.length > 0; i++) {
      sim.update(1 / 60);
      if (stoppedAt < 0 && r.moving && r.v === 0) stoppedAt = i;
      if (stoppedAt >= 0 && closedAt < 0 && Math.abs(r.phase / Math.PI - Math.round(r.phase / Math.PI)) < 1e-6) closedAt = i;
    }
    expect(stoppedAt).toBeGreaterThanOrEqual(0);
    // the legs close within a quarter of a second of the stop: never a stride held mid-air
    expect(closedAt).toBeGreaterThanOrEqual(0);
    expect((closedAt - stoppedAt) / 60).toBeLessThanOrEqual(0.25);
    // gave the walk up (behind somebody standing: soon), and that heading is left alone a while
    expect(r.path).toHaveLength(0);
    expect(r.avoid).not.toBeNull();
    // it stopped short of them, by more than half a tile
    expect(Math.hypot(r.x - sim.player.x, r.y - sim.player.y)).toBeGreaterThan(0.7);
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
    sim.walkToTile({ x: 0, y: 1 });
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
      // on the screen: at least 64 world px apart across (the figures are about 29 px wide)
      expect(Math.abs((sim.player.x - r.x - (sim.player.y - r.y)) * 32), id).toBeGreaterThanOrEqual(63);
    }
    // costs: across first, never one tile along a row or straight in front
    expect(talkSpotCost({ x: 2, y: -1 })).toBeLessThan(talkSpotCost({ x: 1, y: 0 }));
    expect(talkSpotCost({ x: 2, y: 0 })).toBeLessThan(talkSpotCost({ x: 0, y: 1 }));
  });

  it('the last corner of a walk is cut when the way is clear (no walking along a row, then a sharp turn)', () => {
    // open plaza ground: a path along a row and then one tile up the column
    const tiles = [{ x: 9, y: 12 }, { x: 10, y: 12 }, { x: 11, y: 12 }, { x: 11, y: 11 }];
    if (!tiles.every((t) => walkable(t))) return;
    const pts = smoothPath(8.5, 12.5, tiles);
    expect(pts[pts.length - 1]).toEqual({ x: 11, y: 11 });
    // either one straight line, or a corner point before the last tile of the row
    if (pts.length > 1) expect(pts[pts.length - 2].x).toBeLessThan(10.5);
  });
  it('on open ground a click walk goes round somebody standing in its way (they are not shoved aside)', () => {
    // the plaza: the player at (8,12), somebody standing at (10,12), a walk to (12,12) straight through their tile
    for (const t of [{ x: 8, y: 12 }, { x: 10, y: 12 }, { x: 12, y: 12 }, { x: 10, y: 11 }, { x: 10, y: 13 }]) expect(walkable(t)).toBe(true);
    const sim = new TownSim(TOWN_WORLD, seeded(7), { x: 8, y: 12 });
    sim.setState({ built: ['square'], decorations: [] });
    const r = sim.residents.get('square')!;
    Object.assign(r, { x: 10.5, y: 12.5, tile: { x: 10, y: 12 }, path: [], wanderIn: 1e9 });
    let arrived = -1;
    let t = 0;
    let closest = Infinity;
    expect(sim.walkToTile({ x: 12, y: 12 }, () => (arrived = t))).toBe(true);
    for (; t < 6; t += 1 / 60) {
      sim.update(1 / 60);
      closest = Math.min(closest, Math.hypot(sim.player.x - r.x, sim.player.y - r.y));
    }
    // round them in one go: no wait behind them, no shove (four tiles at 2.2 a second, a little longer for the bend)
    expect(arrived).toBeGreaterThan(0);
    expect(arrived).toBeLessThan(2.5);
    expect(Math.hypot(r.x - 10.5, r.y - 12.5)).toBeLessThan(0.01);
    expect(closest).toBeGreaterThanOrEqual(0.5);
  });

  it('cutting a walk short never turns back to the tile being left (keys changing early in a diagonal step)', () => {
    for (const lag of [0.03, 0.06, 0.09, 0.12]) {
      const sim = new TownSim(TOWN_WORLD, () => 0.5, { x: 9, y: 7 });
      sim.setState({ built: [], decorations: [] });
      const p = sim.player;
      sim.hold(keysToDelta({ up: false, down: true, left: false, right: false }));
      for (let t = 0; t < lag; t += 1 / 60) sim.update(1 / 60);
      const before = p.x + p.y;
      // down + right: the step under way is finished first (to the tile centre ahead), then the keys' way
      sim.hold(keysToDelta({ up: false, down: true, left: false, right: true }));
      expect(p.path[0].x + 0.5 + p.path[0].y + 0.5, `${lag}`).toBeGreaterThan(before);
      let least = before;
      for (let k = 0; k < 60; k++) {
        sim.update(1 / 60);
        least = Math.min(least, p.x + p.y);
        // never faces away from the way it was going (S): at most 45° off it
        expect([0, 1, 2], `${lag} oct`).toContain(p.oct);
      }
      expect(before - least, `${lag}`).toBeLessThan(1e-9);
    }
  });

  it('a resident called to talk early in a diagonal step finishes it forwards (no about-face)', () => {
    for (const frac of [0.02, 0.08, 0.14, 0.2]) {
      const sim = new TownSim(TOWN_WORLD, seeded(), { x: 3, y: 3 });
      sim.setState({ built: ['square'], decorations: [] });
      const r = sim.residents.get('square')!;
      Object.assign(r, { x: 8.5 + frac, y: 8.5 + frac, tile: { x: 8, y: 8 }, path: [{ x: 9, y: 9 }], moving: true, v: 0.8, oct: 1, want: 1 });
      sim.engage('square');
      const c = r.path[0];
      expect(c.x + 0.5 - r.x + (c.y + 0.5 - r.y), `${frac}`).toBeGreaterThan(0);
    }
  });

  it('a click walk never stays stuck behind somebody who cannot make way (one-tile roads, the cat)', { timeout: 30000 }, () => {
    // every place built and the cat: random walks and talks; these seeds once boxed the player in for good in the
    // west road (row 10) behind residents and the cat getting up and sitting down again
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
        const ok = talk ? sim.walkToResident(id, () => (done = true)) : sim.walkToTile({ x: Math.floor(rng() * 21), y: Math.floor(rng() * 21) }, () => (done = true));
        if (!ok) continue;
        for (let t = 0; t < 25 && !done; t += 1 / hz) sim.update(1 / hz);
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
