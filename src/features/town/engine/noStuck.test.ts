// "Nhìn thoáng mà đi vào lại bị kẹt" (owner, 2026-11-25): a held key must never leave the player standing against a
// thing in the open, or shut in among trees. Before the fix a walk straight at a tree stood still one time in five
// (1,788 of 8,086 tries), a boulder every time, and 140 spots in the woods let a body in and not out.
import { describe, expect, it } from 'vitest';
import { BODY_RADIUS, distanceTo, treesOf, TREE_R, walkWorld } from '../../../core/town/colliders';
import { shoreDistance, shoreOf, SHORE_STAND } from '../../../core/town/map';
import { DECORATION_IDS, PLACE_IDS, TOWN_WORLD, type Collider, type TownWorld } from '../../../data/townWorld';
import { bodyFits, moveCircle, TownSim, wayAlong } from './sim';

const R = BODY_RADIUS;

/** Hold a key along `u` from (x, y) for `steps` steps of 0.05 (as TownSim.move does: the side of a way round is kept). */
function hold(world: TownWorld, x: number, y: number, u: { x: number; y: number }, steps: number): { x: number; y: number } {
  let side = 0;
  for (let i = 0; i < steps; i++) {
    const way = wayAlong(x, y, u, R, world, [], side);
    side = way.round ?? 0;
    if (way.blocked) continue;
    const to = moveCircle(x, y, way.move.x * 0.05, way.move.y * 0.05, R, world, []);
    x = to.x;
    y = to.y;
  }
  return { x, y };
}

/** The map's edge or the drawn water within a step of (x, y): there a walk may rightly end. */
function byWater(x: number, y: number): boolean {
  if (shoreDistance(TOWN_WORLD, x, y) < 0.45) return true;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (TOWN_WORLD.rows[Math.floor(y + dy * 0.6)]?.[Math.floor(x + dx * 0.6)] === undefined) return true;
  return false;
}

/**
 * A wall (a house, a fence, anything big: sim.ts isWall) within reach of a body at (x, y): pressed into the nook
 * between a wall and a pot beside it, a walker stands, as at any wall.
 */
function atWall(world: TownWorld, x: number, y: number): boolean {
  return world.walk!.colliders.some((c) => (c.kind === 'circle' ? c.r > 0.8 && Math.hypot(c.x - x, c.y - y) - c.r < R + 0.25 : Math.max(c.x1 - c.x0, c.y1 - c.y0) > 1.25 && Math.hypot(Math.max(c.x0 - x, 0, x - c.x1), Math.max(c.y0 - y, 0, y - c.y1)) < R + 0.25));
}

const middleOf = (c: Collider) => (c.kind === 'circle' ? { x: c.x, y: c.y } : { x: (c.x0 + c.x1) / 2, y: (c.y0 + c.y1) / 2 });

describe('a held key never leaves the player stuck in the open (docs/town.md §7 "Moving about")', () => {
  // every lot left to nature (a tree or two, a bush, a stone close together): the hardest ground
  const world = walkWorld(TOWN_WORLD, { built: [], sites: [], decorations: [] });
  const cols = world.walk!.colliders;

  it('a walk straight at a small thing with open ground behind it gets past it', { timeout: 60000 }, () => {
    const stuck: string[] = [];
    let tries = 0;
    cols.forEach((c, n) => {
      const small = c.kind === 'circle' ? c.r <= 0.8 : Math.max(c.x1 - c.x0, c.y1 - c.y0) <= 1.2;
      // every thing that is not a map tree, and every third tree (there are 1,700 of them)
      if (!small || (c.what.startsWith('tree:') && n % 3 !== 0)) return;
      const m = middleOf(c);
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        const u = { x: Math.cos(ang), y: Math.sin(ang) };
        for (const off of [0, 0.08, -0.15]) {
          const sx = m.x - u.x * 1.4 - u.y * off;
          const sy = m.y - u.y * 1.4 + u.x * off;
          // open before it and open behind it
          if (!bodyFits(sx, sy, R, world) || !bodyFits(m.x + u.x * 1.4 - u.y * off, m.y + u.y * 1.4 + u.x * off, R, world)) continue;
          tries++;
          const end = hold(world, sx, sy, u, 120);
          if ((end.x - sx) * u.x + (end.y - sy) * u.y >= 2 || byWater(end.x, end.y) || atWall(world, end.x, end.y)) continue;
          stuck.push(`${c.what} from ${a * 45}° off ${off}: stopped at ${end.x.toFixed(2)},${end.y.toFixed(2)}`);
        }
      }
    });
    expect(tries).toBeGreaterThan(3000);
    expect(stuck).toEqual([]);
  });

  // lots left to nature; and a town with every house built and every decoration bought
  it.each([
    ['nature', { built: [], sites: [], decorations: [] }, 1500],
    ['everything built', { built: [...PLACE_IDS], decorations: [...DECORATION_IDS] }, 800],
  ] as const)('the game itself (TownSim: the body turns, speeds up, keeps its side) gets past them with a key held: %s', { timeout: 120000 }, (_name, state, least) => {
    const sim = new TownSim(TOWN_WORLD, () => 0.5, TOWN_WORLD.start, { life: false });
    sim.setState({ ...state, built: [...state.built], decorations: [...state.decorations] });
    const w = sim.world;
    const stuck: string[] = [];
    let tries = 0;
    w.walk!.colliders.forEach((c, n) => {
      const small = c.kind === 'circle' ? c.r <= 0.8 : Math.max(c.x1 - c.x0, c.y1 - c.y0) <= 1.2;
      // every thing that is not a map tree, and one tree in twelve
      if (!small || (c.what.startsWith('tree:') && n % 12 !== 0)) return;
      const m = middleOf(c);
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        const u = { x: Math.cos(ang), y: Math.sin(ang) };
        for (const off of [0, -0.15]) {
          const sx = m.x - u.x * 1.4 - u.y * off;
          const sy = m.y - u.y * 1.4 + u.x * off;
          if (!bodyFits(sx, sy, R, w) || !bodyFits(m.x + u.x * 1.4 - u.y * off, m.y + u.y * 1.4 + u.x * off, R, w)) continue;
          // (somebody standing there is rounded or waited for, which is another matter: only things are tried)
          if ([...sim.residents.values()].some((o) => Math.hypot(o.x - m.x, o.y - m.y) < 3)) continue;
          tries++;
          sim.placePlayer({ x: sx, y: sy }, ang);
          sim.steer(u);
          // four seconds of a held key, 30 frames a second
          for (let i = 0; i < 120; i++) sim.update(1 / 30);
          sim.steer(null);
          const end = sim.player;
          if ((end.x - sx) * u.x + (end.y - sy) * u.y >= 2 || byWater(end.x, end.y) || atWall(w, end.x, end.y)) continue;
          stuck.push(`${c.what} from ${a * 45}° off ${off}: stopped at ${end.x.toFixed(2)},${end.y.toFixed(2)}`);
        }
      }
    });
    expect(tries).toBeGreaterThan(least);
    expect(stuck).toEqual([]);
  });

  it('no spot lets a body in and not out', { timeout: 60000 }, () => {
    const shutIn: string[] = [];
    for (let y = 2; y < 82; y += 0.5) {
      for (let x = 2; x < 82; x += 0.5) {
        if (!bodyFits(x, y, R, world)) continue;
        let ways = 0;
        for (let a = 0; a < 8 && ways < 3; a++) {
          const ang = (a / 8) * Math.PI * 2;
          const end = hold(world, x, y, { x: Math.cos(ang), y: Math.sin(ang) }, 12);
          if (Math.hypot(end.x - x, end.y - y) >= 0.25) ways++;
        }
        if (ways < 3) shutIn.push(`${x},${y}`);
      }
    }
    expect(shutIn).toEqual([]);
  });

  // the bank is drawn up to 0.6 of a tile over the water's tiles: until 2026-11-25 a body was stopped by the tiles,
  // on grass and sand it could plainly see ("tao có thấy cái gì cản đường đâu")
  it('the water stops a body where the water is drawn: it stands anywhere on the bank, never in the water', { timeout: 60000 }, () => {
    const shore = shoreOf(world)!;
    const clear = (x: number, y: number) => cols.every((c) => distanceTo(c, x, y) > R + 0.05);
    let bank = 0;
    const walled: string[] = [];
    const wetFeet: string[] = [];
    for (let y = 1; y < 83; y += 0.2) {
      for (let x = 1; x < 83; x += 0.2) {
        const s = shore.signed(x, y, 1);
        // within a tile of the waterline: on the land side nothing unseen may stop a body; in the water none stands
        if (Math.abs(s) >= 1) continue;
        if (s >= SHORE_STAND + 0.04 && clear(x, y)) {
          bank++;
          if (!bodyFits(x, y, R, world)) walled.push(`${x.toFixed(1)},${y.toFixed(1)} (${s.toFixed(2)} from the water)`);
        } else if (s <= SHORE_STAND - 0.04 && bodyFits(x, y, R, world)) wetFeet.push(`${x.toFixed(1)},${y.toFixed(1)} (${s.toFixed(2)})`);
      }
    }
    expect(bank).toBeGreaterThan(5000);
    expect(walled.slice(0, 10)).toEqual([]);
    expect(wetFeet.slice(0, 10)).toEqual([]);
  });

  it('a body passes between any two trees of the map', () => {
    const trees = treesOf(TOWN_WORLD);
    const byTile = new Map<string, (typeof trees)[number]>();
    for (const t of trees) byTile.set(`${Math.floor(t.x)},${Math.floor(t.y)}`, t);
    let tight = Infinity;
    for (const t of trees) {
      for (const [dx, dy] of [
        [1, 0],
        [0, 1],
        [1, 1],
        [1, -1],
      ]) {
        const o = byTile.get(`${Math.floor(t.x) + dx},${Math.floor(t.y) + dy}`);
        if (!o) continue;
        tight = Math.min(tight, Math.hypot(o.x - t.x, o.y - t.y) - TREE_R[t.kind] * t.scale - TREE_R[o.kind] * o.scale);
      }
    }
    expect(tight).toBeGreaterThan(R * 2);
  });
});
