import { describe, expect, it } from 'vitest';
import { canStep, walkable } from '../../../core/town/map';
import { TOWN_WORLD, WORLD_PLACES, type Tile } from '../../../data/townWorld';
import { advance, face, gridDistance, keysToDelta, PLAYER_SPEED, slideStep, TownSim, type Actor, type Arrival } from './sim';

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

function actor(tile: Tile, speed = 100): Actor {
  return { id: 'a', kind: 'player', x: tile.x + 0.5, y: tile.y + 0.5, tile: { ...tile }, path: [], speed, facing: 1, moving: false, phase: 0 };
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
  it('follows the path tile by tile at a constant speed on the screen', () => {
    const a = actor({ x: 2, y: 2 });
    a.path = [{ x: 3, y: 2 }, { x: 3, y: 3 }];
    const step = gridDistance(2.5, 2.5, 3.5, 2.5);
    expect(advance(a, step / 2 / a.speed)).toBe(false);
    expect(a.moving).toBe(true);
    expect(a.x).toBeCloseTo(3, 6);
    expect(a.tile).toEqual({ x: 2, y: 2 });
    advance(a, step / 2 / a.speed + 1e-9);
    expect(a.tile).toEqual({ x: 3, y: 2 });
    expect(a.path).toEqual([{ x: 3, y: 3 }]);
    // a long frame carries over into the next tile and ends exactly on the last one
    expect(advance(a, 10)).toBe(true);
    expect([a.x, a.y]).toEqual([3.5, 3.5]);
    expect(a.moving).toBe(false);
    expect(advance(a, 1)).toBe(false);
  });

  it('a step across the screen takes twice as long as a step up it', () => {
    const across = actor({ x: 5, y: 5 });
    across.path = [{ x: 6, y: 4 }];
    const up = actor({ x: 5, y: 5 });
    up.path = [{ x: 4, y: 4 }];
    advance(across, 32 / across.speed);
    advance(up, 32 / up.speed + 1e-9);
    expect(up.path).toHaveLength(0);
    expect(across.path).toHaveLength(1);
    expect(across.x).toBeCloseTo(6, 6);
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

  it('residents wander a tile around their spot, never rest on a doorstep, and wait when the player is near', () => {
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
          expect(Math.max(Math.abs(r.tile.x - r.place.spot.x), Math.abs(r.tile.y - r.place.spot.y)), r.id).toBeLessThanOrEqual(1);
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

  it('the player walks at the speed it says', () => {
    const sim = new TownSim(TOWN_WORLD, seeded());
    sim.setState({ built: START, decorations: [] });
    const from = { x: sim.player.x, y: sim.player.y };
    sim.walkToTile({ x: 10, y: 17 });
    run(sim, 0.5);
    expect(gridDistance(from.x, from.y, sim.player.x, sim.player.y)).toBeCloseTo(PLAYER_SPEED * 0.5, -1);
  });
});
