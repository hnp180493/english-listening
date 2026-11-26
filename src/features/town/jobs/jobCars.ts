// A job's car that really arrives and waits (core/town/jobDoc.ts `park` on a scene or an overhear step; gta-plan §17):
// drawn at the kerb in front of a place's door for the length of the step, driving in from up the street first. The
// model is the streets' car (three/scene/vehicles3d.ts vehicleGeometry, as three/scene/traffic.ts draws Westbay's
// traffic), one mesh per car. Registered with the stage (engine3d addExtra) by the job engine when a step parks one;
// what is parked lives here, in memory.

import { Group, Mesh, type BufferGeometry } from 'three';
import { getTownUi } from '../townUi';
import { CITY_PLACES } from '../../../data/cityWorld';
import type { StageExtra, StageExtraCtx } from '../three/scene/stageExtra';
import { vehicleGeometry } from '../three/scene/vehicles3d';

/** How far up the street a car starts (tiles) and how long it takes to pull in (s). */
const ARRIVE_FROM = 8;
const ARRIVE_S = 2.5;

export interface ParkedCar {
  at: string;
  look: number;
}

let parked: readonly ParkedCar[] = [];
/** The cars a step parks now (an empty list: none). */
export function setParked(cars: readonly ParkedCar[]): void {
  parked = cars;
}
export const parkedNow = (): readonly ParkedCar[] => parked;

/** Where a car waits for a place: in the westbound lane of the street its door opens on (Westbay drives on the left). */
export function kerbOf(placeId: string): { x: number; y: number } | null {
  const p = CITY_PLACES.find((q) => (q.id as string) === placeId);
  return p ? { x: p.door.x + 2.6, y: p.door.y + 1.5 } : null;
}

class ParkedLayer implements StageExtra {
  private readonly group = new Group();
  private readonly geos = new Map<number, BufferGeometry>();
  private readonly cars = new Map<string, { mesh: Mesh; t: number }>();
  private readonly ctx: StageExtraCtx;
  private readonly scale: number;

  constructor(ctx: StageExtraCtx) {
    this.ctx = ctx;
    this.scale = getTownUi().people === 'anime' ? 1.2 : 1;
    ctx.scene.add(this.group);
  }

  private geo(look: number): BufferGeometry | null {
    const v = ((look % 3) + 3) % 3;
    if (!this.geos.has(v)) {
      const g = vehicleGeometry('car', v);
      if (!g) return null;
      this.geos.set(v, g);
    }
    return this.geos.get(v)!;
  }

  update(dt: number): void {
    this.group.visible = !this.ctx.inRoom();
    const want = new Set(parked.map((c) => `${c.at}:${c.look}`));
    for (const [k, c] of this.cars)
      if (!want.has(k)) {
        c.mesh.removeFromParent();
        this.cars.delete(k);
      }
    for (const c of parked) {
      const k = `${c.at}:${c.look}`;
      const spot = kerbOf(c.at);
      if (!spot) continue;
      let car = this.cars.get(k);
      if (!car) {
        const g = this.geo(c.look);
        if (!g) continue;
        const mesh = new Mesh(g, this.ctx.mats.std);
        mesh.castShadow = true;
        mesh.scale.setScalar(this.scale);
        this.group.add(mesh);
        car = { mesh, t: 0 };
        this.cars.set(k, car);
      }
      car.t = Math.min(ARRIVE_S, car.t + dt);
      const e = 1 - (1 - car.t / ARRIVE_S) ** 3;
      const x = spot.x + ARRIVE_FROM * (1 - e);
      car.mesh.position.set(x, this.ctx.lift(x, spot.y), spot.y);
      // driving west along the street, towards the spot
      car.mesh.rotation.y = -Math.PI;
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    for (const g of this.geos.values()) g.dispose();
  }
}

export const makeParkedLayer = (ctx: StageExtraCtx): StageExtra => new ParkedLayer(ctx);
