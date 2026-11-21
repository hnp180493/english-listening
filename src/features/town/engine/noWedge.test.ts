import { describe, expect, it } from 'vitest';
import { BODY_RADIUS, distanceTo } from '../../../core/town/colliders';
import { lineFits, solidsNear } from '../../../core/town/map';
import { DECORATION_IDS, PLACE_IDS, TOWN_WORLD } from '../../../data/townWorld';
import { TownSim } from './sim';

/**
 * QA (2026-11-21): the player could walk in between the trunks of a wood (by the hill, at the island's south edge)
 * and stay wedged there for seconds. Every spot a body can walk to from the start must let it walk away again: held
 * keys in most directions move it, as anywhere in the open.
 */
describe('no wedges', () => {
  for (const [name, built, decorations] of [['a town with everything', PLACE_IDS, DECORATION_IDS]] as const) {
    it(`every spot the body reaches lets it walk away (${name})`, () => {
      const sim = new TownSim(TOWN_WORLD, () => 0.5, TOWN_WORLD.start, { life: false });
      sim.setState({ built: [...built], decorations: [...decorations] });
      const world = sim.world;
      const step = 0.25;
      const n = Math.round(TOWN_WORLD.size / step);
      const free = (i: number, j: number) => {
        const x = (i + 0.5) * step;
        const y = (j + 0.5) * step;
        let ok = true;
        solidsNear(world, x - 0.3, y - 0.3, x + 0.3, y + 0.3, (c) => {
          if (ok && distanceTo(c, x, y) < BODY_RADIUS + 0.005) ok = false;
        });
        return ok;
      };
      // every point of a fine lattice a body walks to from the start in straight steps
      const seen = new Uint8Array(n * n);
      const si = Math.floor((TOWN_WORLD.start.x + 0.5) / step);
      const sj = Math.floor((TOWN_WORLD.start.y + 0.5) / step);
      const queue = [si + sj * n];
      seen[queue[0]] = 1;
      for (let q = 0; q < queue.length; q++) {
        const i = queue[q] % n;
        const j = Math.floor(queue[q] / n);
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const a = i + di;
          const b = j + dj;
          if (a < 0 || b < 0 || a >= n || b >= n || seen[a + b * n] || !free(a, b)) continue;
          if (!lineFits(world, (i + 0.5) * step, (j + 0.5) * step, (a + 0.5) * step, (b + 0.5) * step, BODY_RADIUS)) continue;
          seen[a + b * n] = 1;
          queue.push(a + b * n);
        }
      }
      expect(queue.length).toBeGreaterThan(10000);
      // from each, keys held for a second in each of 8 directions: a wedge lets the body move in few of them
      const wedged: string[] = [];
      const tree = (tx: number, ty: number) => /[Tt]/.test(TOWN_WORLD.rows[ty]?.[tx] ?? '');
      for (const k of queue) {
        // every other point of the lattice each way (half a tile apart) is plenty
        if ((k % n) % 2 === 0 || Math.floor(k / n) % 2 === 0) continue;
        const x = ((k % n) + 0.5) * step;
        const y = (Math.floor(k / n) + 0.5) * step;
        // (in the open nothing wedges a body: the woods and their edges are what is checked)
        let wood = false;
        for (let dy = -1; dy <= 1 && !wood; dy++) for (let dx = -1; dx <= 1; dx++) if (tree(Math.floor(x) + dx, Math.floor(y) + dy)) wood = true;
        if (!wood) continue;
        let stuck = 0;
        let moved = 0;
        for (let d = 0; d < 8 && stuck < 4 && moved < 5; d++) {
          sim.placePlayer({ x, y }, 0);
          sim.steer({ x: Math.cos((d / 8) * Math.PI * 2), y: Math.sin((d / 8) * Math.PI * 2) });
          for (let t = 0; t < 6; t++) sim.update(0.15);
          sim.steer(null);
          if (Math.hypot(sim.player.x - x, sim.player.y - y) < 0.25) stuck++;
          else moved++;
        }
        if (stuck >= 4) wedged.push(`${x},${y}`);
      }
      expect(wedged).toEqual([]);
    }, 60000);
  }
});
