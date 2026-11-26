// What a Westbay job needs of the harbour's warehouses (data/city/warehouses.ts; docs/town.md §32), for the job engine
// (features/town/jobs/useCityJob.tsx calls these; nothing here knows about jobs):
//
//   enterWarehouse(stage, opts, ready): boolean
//     the learner goes into warehouse fifteen by one of its three doors, through the dark, with the job's people (a host,
//     a visitor, up to two more at the room's other anchors); `ready` once inside; stage.endTalk() brings them out at
//     the same door. False = no 3D stage (the list mode) or another talk is staged: the caller goes on without the room.
//
//   runBoat(stage, opts): { arrived: Promise<void>; stop: () => void } | null
//     a small boat runs from `from` to `to` over the bay's water (data/city/warehouses.ts boatRoute: open water only,
//     tested never to cross land), the learner aboard when `aboard`; `arrived` resolves at the end (at once under reduced
//     motion), when the learner (if aboard) is set down on the shore by `to`; the boat stays moored until `stop()`
//     (or the stage goes). Null = no 3D stage or no way over the water.

import { Mesh } from 'three';
import { prefersReducedMotion } from '../../../core/motion';
import type { Tile } from '../../../data/townWorld';
import { CITY_WORLD } from '../../../data/cityWorld';
import { alongRoute, boatRoute, JETTY_END, routeLength, W15_DOORS, W15_MOORING, type Pt } from '../../../data/city/warehouses';
import type { TownStageHandle } from '../engine/stage';
import { Merge, shapes } from '../three/scene/merge';
import { C } from '../three/scene/palette3d';
import { WATER_LEVEL } from '../three/scene/terrain';

export type WarehouseDoor = keyof typeof W15_DOORS;

/** The way out of each door, as a heading on the grid (the street side): front on the quay lane +x, back +y, water −x. */
const OUT: Readonly<Record<WarehouseDoor, number>> = { front: 0, back: Math.PI / 2, water: Math.PI };

export interface EnterWarehouseOptions {
  /** Which door (default the black front door on the quay lane). */
  door?: WarehouseDoor;
  /** Who is waiting inside by the shelves (Mrs Delaney): an id with a look (a city person, a job's cast). */
  host?: string;
  /** Who comes in with the learner (Jun, Mei). */
  visitor?: string;
  /** Up to two more at the water gate and the back door (Shona, Kemp). */
  more?: readonly string[];
}

/** Into warehouse fifteen through the dark (TownStageHandle.enterOwnRoom with the job's people). */
export function enterWarehouse(stage: TownStageHandle | null, opts: EnterWarehouseOptions, ready: () => void): boolean {
  if (!stage) return false;
  const door = opts.door ?? 'front';
  const cast = { ...(opts.host ? { host: opts.host } : {}), ...(opts.visitor ? { visitor: opts.visitor } : {}), ...(opts.more ? { more: opts.more.slice(0, 2) } : {}) };
  return stage.enterOwnRoom('warehouse15', W15_DOORS[door], OUT[door], ready, cast);
}

export interface RunBoatOptions {
  /** Where it starts (default the end of the seafront's jetty) and where it ends (default fifteen's water gate). */
  from?: Pt;
  to?: Pt;
  /** The learner rides in it (stands in it, the camera with them) and is set down on the shore at the end. */
  aboard?: boolean;
  /** Tiles a second (default 1.6: a little faster than walking). */
  speed?: number;
  /** Where the learner is set down at the end (default: the land tile nearest `to`, e.g. the water gate's slipway). */
  landing?: Tile;
}

/** A small harbour launch, its bow along +x: a hull, a deck, a little wheelhouse, a lamp. */
function boatGeometry() {
  const m = new Merge();
  m.add(shapes.box(1.0, 0.16, 0.42, 0.06, 2), '#2f4d6b', { y: -0.06 });
  m.add(shapes.cone(0.21, 0.3, 4), '#2f4d6b', { x: 0.62, y: -0.06, rz: -Math.PI / 2, ry: Math.PI / 4, s: [1, 1, 0.7] });
  m.add(shapes.box(1.02, 0.03, 0.44, 0.01, 1), C.trim, { y: 0.03 }, { ao: false });
  m.add(shapes.box(0.92, 0.02, 0.36, 0.01, 1), C.woodLight, { y: 0.035 }, { ao: false });
  m.add(shapes.box(0.26, 0.24, 0.3, 0.03, 2), C.cream, { x: -0.3, y: 0.16 });
  m.add(shapes.box(0.3, 0.04, 0.34, 0.01, 1), C.red, { x: -0.3, y: 0.3 }, { ao: false });
  m.add(shapes.sphere(0.035, 8, 6), C.mustard, { x: -0.3, y: 0.35 }, { ao: false });
  return m.build();
}

/** The land tile nearest a point on the water (where a passenger steps ashore). */
function shoreTile(p: Pt): Tile {
  let best: Tile = { x: Math.floor(p.x), y: Math.floor(p.y) };
  let bd = Infinity;
  for (let j = -3; j <= 3; j++)
    for (let i = -3; i <= 3; i++) {
      const x = Math.floor(p.x) + i;
      const y = Math.floor(p.y) + j;
      const ch = CITY_WORLD.rows[y]?.[x];
      if (ch === undefined || ch === '~' || ch === 'T' || ch === 't' || ch === 'p') continue;
      const d = Math.hypot(x + 0.5 - p.x, y + 0.5 - p.y);
      if (d < bd) {
        bd = d;
        best = { x, y };
      }
    }
  return best;
}

/** A boat over the bay's water for a job (see the head of this file). */
export function runBoat(stage: TownStageHandle | null, opts: RunBoatOptions = {}): { arrived: Promise<void>; stop: () => void } | null {
  if (!stage) return null;
  const from = opts.from ?? JETTY_END;
  const to = opts.to ?? W15_MOORING;
  const route = boatRoute(CITY_WORLD, from, to);
  if (!route) return null;
  const total = routeLength(route);
  const speed = opts.speed ?? 1.6;
  const landing = opts.landing ?? (to === W15_MOORING ? W15_DOORS.water : shoreTile(to));
  let finish: () => void = () => {};
  const arrived = new Promise<void>((res) => {
    finish = res;
  });
  let dist = 0;
  let done = false;
  let t = 0;
  const remove = stage.addExtra((ctx) => {
    const geo = boatGeometry();
    const mesh = geo ? new Mesh(geo, ctx.mats.std) : null;
    if (mesh) {
      // (the size of the people standing in it: an avatar is taller than the code-built body)
      mesh.scale.setScalar(1.35);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      ctx.scene.add(mesh);
    }
    const place = () => {
      const p = alongRoute(route, dist);
      if (mesh) {
        const bob = prefersReducedMotion() ? 0 : Math.sin(t * 2.2) * 0.012;
        mesh.position.set(p.x, WATER_LEVEL + 0.11 + bob, p.y);
        mesh.rotation.y = -p.heading;
        mesh.rotation.z = prefersReducedMotion() ? 0 : Math.sin(t * 1.7) * 0.02;
      }
      if (opts.aboard && !done) ctx.sim.placePlayer({ x: p.x - Math.cos(p.heading) * 0.1, y: p.y - Math.sin(p.heading) * 0.1 }, p.heading);
      return p;
    };
    place();
    return {
      update: (dt: number) => {
        t += dt;
        if (mesh) mesh.visible = !ctx.inRoom();
        if (done) {
          place();
          return;
        }
        dist = prefersReducedMotion() ? total : Math.min(total, dist + speed * dt);
        const p = place();
        if (dist >= total || p.done) {
          done = true;
          // ashore at the landing, facing the land
          if (opts.aboard) ctx.sim.placePlayer({ x: landing.x + 0.5, y: landing.y + 0.5 }, Math.atan2(landing.y + 0.5 - p.y, landing.x + 0.5 - p.x));
          finish();
        }
      },
      dispose: () => {
        if (mesh) mesh.removeFromParent();
        geo?.dispose();
        // a boat taken away before it got there: the job's wait ends all the same
        if (!done) {
          done = true;
          finish();
        }
      },
    };
  });
  if (!remove) return null;
  return { arrived, stop: remove };
}
