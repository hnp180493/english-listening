// The rooms of the town (contracts.ts): every conversation happens in its place. buildInterior(id) builds one room in
// code (a few merged meshes, its own lights, small life) with the anchors and shots of the conversation.

import type { InteriorId, InteriorsModule, RoomAnchor, RoomShot } from './contracts';
import { finish, Room, type Cast, type RoomSet, type RoomSpec } from './build';
import { cafe, friend, home, shop } from './recipes/a';
import { clinic, office, phone, school } from './recipes/b';
import { cinema, station } from './recipes/c';
import { board, inn, park, square } from './recipes/d';
import { hideout } from './recipes/hideout';

export type { RoomSet } from './build';
export type { InteriorId } from './contracts';

/** Every room, in the order of the town (the 13 places, then the boarding house). */
export const INTERIOR_IDS: readonly InteriorId[] = ['square', 'cafe', 'friend', 'home', 'shop', 'office', 'school', 'station', 'clinic', 'cinema', 'phone', 'park', 'board', 'inn'];

/** Rooms of the learner's own, entered alone (no resident hosts them): the hideout in Westbay. */
export const OWN_ROOMS: readonly InteriorId[] = ['hideout'];

/** The standard room: 5.4 × 4.2 tiles, walls 1.7 high (a grown-up is 0.79). */
const STD = { W: 5.4, D: 4.2, H: 1.7 };

const RECIPES: Readonly<Record<InteriorId, { spec: Omit<RoomSpec, 'id'>; build: (r: Room) => Cast }>> = {
  square: { spec: STD, build: square },
  cafe: { spec: STD, build: cafe },
  friend: { spec: STD, build: friend },
  home: { spec: STD, build: home },
  shop: { spec: STD, build: shop },
  office: { spec: STD, build: office },
  school: { spec: STD, build: school },
  station: { spec: STD, build: station },
  clinic: { spec: STD, build: clinic },
  cinema: { spec: STD, build: cinema },
  phone: { spec: STD, build: phone },
  park: { spec: { W: 6.2, D: 5.0, H: 1.7, outdoor: true }, build: park },
  board: { spec: STD, build: board },
  inn: { spec: STD, build: inn },
  // a small lock-up: smaller and lower than a place's room
  hideout: { spec: { W: 4.4, D: 3.6, H: 1.6 }, build: hideout },
};

export function isInteriorId(id: string): id is InteriorId {
  return (INTERIOR_IDS as readonly string[]).includes(id) || (OWN_ROOMS as readonly string[]).includes(id);
}

export function buildInterior(id: InteriorId): RoomSet {
  const t0 = performance.now();
  const recipe = RECIPES[id];
  const room = new Room({ id, ...recipe.spec });
  const cast = recipe.build(room);
  return finish(room, cast, t0);
}

export const interiors: InteriorsModule = { buildInterior };

/** About where a person's eyes are above their anchor (standing; seated: the seat plus the body above the hips). */
export function headHeight(a: RoomAnchor): number {
  return a.pose === 'sit' ? (a.seatY ?? 0.18) + 0.42 : 0.62;
}

/**
 * Where a speaker should look during the conversation: the other's head, pulled `pull` of the way towards the camera, so
 * both faces stay readable in the shot (looking straight at each other turns the player's face away from the camera).
 * Feed it to Character3D.lookAt.
 */
export function gazePoint(to: RoomAnchor, shot: RoomShot, pull = 0.22): [number, number, number] {
  const ty = headHeight(to);
  return [to.x + (shot.position[0] - to.x) * pull, ty + (shot.position[1] - ty) * pull * 0.3, to.z + (shot.position[2] - to.z) * pull];
}


/** What a walk-in needs to know of a room. */
export type EntryRoom = Pick<RoomSet, 'size' | 'blocks' | 'host' | 'guest' | 'extras'> & { outdoor?: boolean };

/** How far a walk-in keeps from furniture (a body's half width) and from where somebody stands. */
const ENTRY_CLEAR = 0.17;
const ENTRY_PEOPLE = 0.38;
/** A walk-in starts this far outside the room's open side (a step in from the edge of the diorama). */
const ENTRY_OUT = 0.35;
/** How far to the side of the picture (room units across the camera's view) the way in starts. */
const ENTRY_SIDE = 2.6;
/** The grid the way in is found on (room units). */
const ENTRY_STEP = 0.1;

/**
 * The way a neighbour who drops in (an episode's visitor) walks in to their anchor: from just outside one of the
 * room's open sides (+X: the right of the picture, +Z: the left; `side` keeps to one; never through a back wall), round the furniture and
 * the people standing in the room, the shortest such way, pulled straight where the floor is clear. The points go
 * from outside to the anchor (the anchor last). Null when there is no way (the stage then lets them appear).
 */
export function entryPath(r: EntryRoom, a: RoomAnchor, side?: 'x' | 'z'): { x: number; z: number }[] | null {
  const { W, D } = r.size;
  const x0 = -W / 2;
  const z0 = -D / 2;
  const nx = Math.round((W + 1.2) / ENTRY_STEP);
  const nz = Math.round((D + 1.2) / ENTRY_STEP);
  const at = (i: number, j: number) => ({ x: x0 + (i + 0.5) * ENTRY_STEP, z: z0 + (j + 0.5) * ENTRY_STEP });
  const others = [r.host, r.guest, ...r.extras];
  const free = (x: number, z: number) => {
    if (!r.outdoor && (x < x0 + 0.2 || z < z0 + 0.2)) return false;
    for (const b of r.blocks) {
      const dx = Math.max(b.x0 - x, 0, x - b.x1);
      const dz = Math.max(b.z0 - z, 0, z - b.z1);
      if (Math.hypot(dx, dz) < ENTRY_CLEAR) return false;
    }
    for (const o of others) if (Math.hypot(o.x - x, o.z - z) < ENTRY_PEOPLE) return false;
    return true;
  };
  // outside an open side, and off to the side of the picture (the camera looks in from +X+Z at 45°: a way in from the
  // middle of the front would come from under the lens)
  // (`side`: only through that open side: 'x' the right of the picture, 'z' the left)
  const out = (x: number, z: number) => (side !== 'z' && x > W / 2 + ENTRY_OUT ? true : side !== 'x' && z > D / 2 + ENTRY_OUT) && Math.abs(x - z) * Math.SQRT1_2 >= ENTRY_SIDE;
  // (round the anchor itself only the furniture counts: they stand beside somebody)
  const nearBlock = (x: number, z: number) => r.blocks.some((b) => Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.z0 - z, 0, z - b.z1)) < ENTRY_CLEAR);
  const open = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const c = at(i, j);
      open[j * nx + i] = free(c.x, c.z) || (Math.hypot(c.x - a.x, c.z - a.z) < ENTRY_PEOPLE && !nearBlock(c.x, c.z)) ? 1 : 0;
    }
  }
  const si = Math.max(0, Math.min(nx - 1, Math.floor((a.x - x0) / ENTRY_STEP)));
  const sj = Math.max(0, Math.min(nz - 1, Math.floor((a.z - z0) / ENTRY_STEP)));
  // Dijkstra from the anchor (its own cell is open whatever stands near it) to the first cell outside
  const dist = new Float64Array(nx * nz).fill(Infinity);
  const prev = new Int32Array(nx * nz).fill(-1);
  const start = sj * nx + si;
  dist[start] = 0;
  const queue: [number, number][] = [[0, start]];
  let goal = -1;
  while (queue.length > 0) {
    let m = 0;
    for (let q = 1; q < queue.length; q++) if (queue[q][0] < queue[m][0]) m = q;
    const [d, k] = queue[m];
    queue[m] = queue[queue.length - 1];
    queue.pop();
    if (d > dist[k]) continue;
    const i = k % nx;
    const j = (k - i) / nx;
    const c = at(i, j);
    if (out(c.x, c.z)) {
      goal = k;
      break;
    }
    for (let dj = -1; dj <= 1; dj++) {
      for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const a2 = i + di;
        const b2 = j + dj;
        if (a2 < 0 || b2 < 0 || a2 >= nx || b2 >= nz) continue;
        const n = b2 * nx + a2;
        if (!open[n] || (di && dj && (!open[j * nx + a2] || !open[b2 * nx + i]))) continue;
        const nd = d + Math.hypot(di, dj);
        if (nd < dist[n]) {
          dist[n] = nd;
          prev[n] = k;
          queue.push([nd, n]);
        }
      }
    }
  }
  if (goal < 0) return null;
  // the cells from the anchor out, then pulled straight (a point is skipped when the floor to the next is clear)
  const cells: { x: number; z: number }[] = [];
  for (let k = goal; k >= 0; k = prev[k]) {
    const i = k % nx;
    cells.push(at(i, (k - i) / nx));
  }
  cells.reverse();
  cells[0] = { x: a.x, z: a.z };
  const clear = (p: { x: number; z: number }, q: { x: number; z: number }) => {
    const n = Math.ceil(Math.hypot(q.x - p.x, q.z - p.z) / 0.04);
    for (let s = 1; s <= n; s++) {
      const x = p.x + ((q.x - p.x) * s) / n;
      const z = p.z + ((q.z - p.z) * s) / n;
      if (Math.hypot(x - a.x, z - a.z) > ENTRY_PEOPLE && !free(x, z)) return false;
    }
    return true;
  };
  const way = [cells[0]];
  let from = 0;
  while (from < cells.length - 1) {
    let to = cells.length - 1;
    while (to > from + 1 && !clear(cells[from], cells[to])) to--;
    way.push(cells[to]);
    from = to;
  }
  return way.reverse();
}
