// A job's car that really arrives and waits (core/town/jobDoc.ts `park` on a scene or an overhear step; gta-plan §17):
// drawn at the kerb in front of a place's door for the length of the step, driving in from up the street first. The
// model is the streets' car (three/scene/vehicles3d.ts vehicleGeometry, as three/scene/traffic.ts draws Westbay's
// traffic), one mesh per car, with a townsperson at the wheel (same ride='car' seat as traffic). Registered with the
// stage (engine3d addExtra) by the job engine when a step parks one; what is parked lives here, in memory.

import { Group, Mesh, type BufferGeometry } from 'three';
import { getTownUi } from '../townUi';
import { CITY_PLACES } from '../../../data/cityWorld';
import { createCharacter, passerLook, type Character3DPlus } from '../three/characters';
import { dressWhenNear, standInWhileBare, undressNow } from '../three/chars/vrmPeople';
import type { StageExtra, StageExtraCtx } from '../three/scene/stageExtra';
import { rideScaleOf, seatPlace, vehicleGeometry } from '../three/scene/vehicles3d';

/** How far up the street a car starts (tiles) and how long it takes to pull in (s). */
const ARRIVE_FROM = 8;
const ARRIVE_S = 2.5;
/** Same avatar-budget penalty as traffic drivers (three/scene/traffic.ts). */
const DRIVER_FAR = 1.7;
/** Parked cars face west along the street. */
const HEADING = Math.PI;

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
  private readonly cars = new Map<string, { mesh: Mesh; t: number; driver: Character3DPlus }>();
  private readonly ctx: StageExtraCtx;
  private readonly scale: number;

  constructor(ctx: StageExtraCtx) {
    this.ctx = ctx;
    this.scale = rideScaleOf();
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

  private makeDriver(seed: number): Character3DPlus {
    const ch = createCharacter(`job-car-${seed}`, passerLook(2000 + seed * 31)) as Character3DPlus;
    ch.ride = 'car';
    ch.setAction('sit');
    ch.update(1, 0);
    ch.root.visible = false;
    // (the code body at the wheel whenever the avatar is not on: never an empty seat)
    standInWhileBare(ch);
    this.ctx.scene.add(ch.root);
    return ch;
  }

  private seatDriver(ch: Character3DPlus, x: number, y: number, dt: number, night: number): void {
    const seat = seatPlace('car', HEADING);
    const px = x + seat.x;
    const py = y + seat.y;
    ch.root.visible = true;
    ch.root.position.set(px, this.ctx.lift(px, py), py);
    ch.setHeading(HEADING, true);
    ch.setSeatHeight(seat.h);
    ch.ride = 'car';
    ch.setAction('sit');
    ch.setNight(night);
    if (getTownUi().people === 'anime') {
      const p = this.ctx.sim.player;
      dressWhenNear(ch, (px - p.x) * DRIVER_FAR, (py - p.y) * DRIVER_FAR);
    } else undressNow(ch);
    ch.update(dt, 0);
  }

  update(dt: number, night = 0): void {
    this.group.visible = !this.ctx.inRoom();
    const want = new Set(parked.map((c) => `${c.at}:${c.look}`));
    for (const [k, c] of this.cars)
      if (!want.has(k)) {
        c.mesh.removeFromParent();
        c.driver.root.visible = false;
        c.driver.ride = null;
        undressNow(c.driver);
        c.driver.dispose();
        this.cars.delete(k);
      }
    if (this.ctx.inRoom()) {
      for (const c of this.cars.values()) {
        c.driver.root.visible = false;
        undressNow(c.driver);
      }
      return;
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
        car = { mesh, t: 0, driver: this.makeDriver(c.look + c.at.length * 17) };
        this.cars.set(k, car);
      }
      car.t = Math.min(ARRIVE_S, car.t + dt);
      const e = 1 - (1 - car.t / ARRIVE_S) ** 3;
      const x = spot.x + ARRIVE_FROM * (1 - e);
      car.mesh.position.set(x, this.ctx.lift(x, spot.y), spot.y);
      // driving west along the street, towards the spot
      car.mesh.rotation.y = -HEADING;
      this.seatDriver(car.driver, x, spot.y, dt, night);
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    for (const g of this.geos.values()) g.dispose();
    for (const c of this.cars.values()) {
      undressNow(c.driver);
      c.driver.dispose();
    }
    this.cars.clear();
  }
}

export const makeParkedLayer = (ctx: StageExtraCtx): StageExtra => new ParkedLayer(ctx);
