// Westbay's traffic drawn (docs/town.md §28): the cars of core/town/traffic.ts as three instanced meshes (one a
// colour), a real townsperson (chars/person.ts, a passer-by look) seated at each wheel with ride='car' (hands on the
// wheel, legs out — same pose as the player), anime mode wearing their avatar through dressWhenNear (classic body
// stays hidden when the avatar is off), the traffic lights of core/town/streets.ts, and the patrol car of
// core/town/police.ts with its blue and red lamps. Drawing only: what moves where is decided elsewhere
// (features/town/streets/streetsWorld.ts).

import { Color, Euler, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Quaternion, SphereGeometry, Vector3, type BufferGeometry } from 'three';
import { carAngle, type TrafficCar } from '../../../../core/town/traffic';
import { lightAt, type Light, type RoadNet } from '../../../../core/town/streets';
import { getTownUi } from '../../townUi';
import { createCharacter, passerLook, type Character3DPlus } from '../characters';
import { dressWhenNear, hideCodeWhenBare, undressNow } from '../chars/vrmPeople';
import { Merge, shapes } from './merge';
import type { StageExtraCtx } from './stageExtra';
import { rideScaleOf, seatPlace, vehicleGeometry } from './vehicles3d';

const MAX_CARS = 16;
/** Where a post stands from its box's corner (tiles, out onto the pavement), its height and its head's. */
const POST_OUT = 0.22;
const POST_H = 1.6;
/**
 * How much further a traffic driver must be than a walker to keep an avatar slot (dressWhenNear d2 × this²): residents
 * win the budget; cars still dress when they are clearly next to the player.
 */
const DRIVER_FAR = 1.7;

/** The colour of a bulb lit, and dim. */
const LIT: Readonly<Record<Light, string>> = { red: '#ff3b30', amber: '#ffb31a', green: '#2fe07a' };
const DIM = '#2c2f36';
const BULBS: readonly Light[] = ['red', 'amber', 'green'];

interface Head {
  x: number;
  y: number;
  /** Which way it looks (map radians) and which traffic it is for. */
  face: number;
  axis: 'ew' | 'ns';
  junction: number;
}

export class TrafficLayer {
  private readonly group = new Group();
  private readonly cars: InstancedMesh[] = [];
  /** One townsperson a traffic car (passer-by looks), seated at the wheel. */
  private readonly drivers: Character3DPlus[] = [];
  private readonly posts: Mesh | null;
  private readonly bulbs: InstancedMesh | null;
  private readonly heads: Head[] = [];
  private readonly patrol: Group;
  private readonly patrolDriver: Character3DPlus;
  private readonly lamps: [Mesh, Mesh];
  private lastPhase = '';
  private t = 0;
  private readonly m = new Matrix4();
  private readonly q = new Quaternion();
  private readonly e = new Euler();
  private readonly v = new Vector3();
  private readonly s = new Vector3();
  private readonly geos: BufferGeometry[] = [];

  private readonly ctx: StageExtraCtx;
  private readonly net: RoadNet;
  /** How much bigger than their models vehicles are drawn (vehicles3d rideScaleOf). */
  private readonly scale: number;

  constructor(ctx: StageExtraCtx, net: RoadNet, scale = rideScaleOf()) {
    this.ctx = ctx;
    this.net = net;
    this.scale = scale;
    for (let v = 0; v < 3; v++) {
      const geo = vehicleGeometry('car', v);
      if (!geo) continue;
      this.geos.push(geo);
      const mesh = new InstancedMesh(geo, ctx.mats.std, MAX_CARS);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.count = 0;
      mesh.frustumCulled = false;
      this.cars.push(mesh);
      this.group.add(mesh);
    }
    // the lights: four posts round each crossing's box, each head looking at the traffic it stops
    const m = new Merge();
    net.junctions.forEach((j, i) => {
      if (!j.lights) return;
      const corners: [number, number, number, 'ew' | 'ns'][] = [
        // north-west: for the eastbound (looks west); south-east: the westbound (looks east)
        [j.x - POST_OUT, j.y - POST_OUT, Math.PI, 'ew'],
        [j.x + 2 + POST_OUT, j.y + 2 + POST_OUT, 0, 'ew'],
        // north-east: for the southbound (looks north); south-west: the northbound (looks south)
        [j.x + 2 + POST_OUT, j.y - POST_OUT, -Math.PI / 2, 'ns'],
        [j.x - POST_OUT, j.y + 2 + POST_OUT, Math.PI / 2, 'ns'],
      ];
      for (const [x, y, face, axis] of corners) {
        const g = ctx.lift(x, y);
        m.add(shapes.cyl(0.035, 0.045, POST_H, 8), '#3a3d45', { x, y: g + POST_H / 2, z: y });
        const hx = x + Math.cos(face) * 0.07;
        const hy = y + Math.sin(face) * 0.07;
        m.add(shapes.box(0.12, 0.36, 0.12, 0.03, 1), '#24262d', { x: hx, y: g + POST_H + 0.1, z: hy, ry: -face });
        this.heads.push({ x: hx, y: hy, face, axis, junction: i });
      }
    });
    const geo = m.build();
    this.posts = geo ? new Mesh(geo, ctx.mats.std) : null;
    if (this.posts) {
      this.posts.castShadow = true;
      this.group.add(this.posts);
    }
    if (this.heads.length > 0) {
      const sphere = new SphereGeometry(0.045, 10, 8);
      this.geos.push(sphere);
      this.bulbs = new InstancedMesh(sphere, new MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), this.heads.length * 3);
      this.heads.forEach((h, k) => {
        const g = ctx.lift(h.x, h.y);
        BULBS.forEach((_, b) => {
          const out = 0.065;
          this.v.set(h.x + Math.cos(h.face) * out, g + POST_H + 0.21 - b * 0.11, h.y + Math.sin(h.face) * out);
          this.m.makeTranslation(this.v.x, this.v.y, this.v.z);
          this.bulbs!.setMatrixAt(k * 3 + b, this.m);
          this.bulbs!.setColorAt(k * 3 + b, new Color(DIM));
        });
      });
      this.group.add(this.bulbs);
    } else this.bulbs = null;
    const anime = getTownUi().people === 'anime';
    // a pool of townspeople for the traffic (one look a car id); settle the sit pose so the first frame is not standing
    for (let i = 0; i < MAX_CARS; i++) {
      const ch = createCharacter(`traffic-${i}`, passerLook(1000 + i * 17)) as Character3DPlus;
      ch.ride = 'car';
      ch.setAction('sit');
      ch.update(1, 0);
      ch.root.visible = false;
      if (anime) hideCodeWhenBare(ch);
      ctx.scene.add(ch.root);
      this.drivers.push(ch);
    }
    // the patrol car: a blue car with a bar of lamps on its windscreen, and an officer in the seat
    this.patrol = new Group();
    const pgeo = vehicleGeometry('car', 1);
    if (pgeo) {
      this.geos.push(pgeo);
      const body = new Mesh(pgeo, ctx.mats.std);
      body.castShadow = true;
      this.patrol.add(body);
    }
    const lampGeo = shapes.box(0.12, 0.05, 0.16, 0.02, 1);
    const blue = new Mesh(lampGeo, new MeshBasicMaterial({ color: '#2f6dff', toneMapped: false }));
    const red = new Mesh(lampGeo, new MeshBasicMaterial({ color: '#ff3040', toneMapped: false }));
    blue.position.set(0.12, 0.62, -0.1);
    red.position.set(0.12, 0.62, 0.1);
    this.lamps = [blue, red];
    this.patrol.add(blue, red);
    this.patrol.scale.setScalar(scale);
    this.patrol.visible = false;
    this.group.add(this.patrol);
    this.patrolDriver = createCharacter('traffic-patrol', passerLook(42)) as Character3DPlus;
    this.patrolDriver.ride = 'car';
    this.patrolDriver.setAction('sit');
    this.patrolDriver.update(1, 0);
    this.patrolDriver.root.visible = false;
    if (anime) hideCodeWhenBare(this.patrolDriver);
    ctx.scene.add(this.patrolDriver.root);
    ctx.scene.add(this.group);
  }

  /** Seat a driver in a car at (x, y) facing `heading` (ride='car': wheel reach + RIDE_GROW like the player). */
  private putDriver(ch: Character3DPlus, x: number, y: number, heading: number, dt: number, night: number): void {
    const seat = seatPlace('car', heading);
    const px = x + seat.x;
    const py = y + seat.y;
    const g = this.ctx.lift(px, py);
    ch.root.visible = true;
    ch.root.position.set(px, g, py);
    ch.setHeading(heading, true);
    ch.setSeatHeight(seat.h);
    ch.ride = 'car';
    ch.setAction('sit');
    ch.setNight(night);
    const anime = getTownUi().people === 'anime';
    if (anime) {
      const p = this.ctx.sim.player;
      // (penalise distance so walkers keep the avatar budget; near cars still dress)
      dressWhenNear(ch, (px - p.x) * DRIVER_FAR, (py - p.y) * DRIVER_FAR);
    }
    ch.update(dt, 0);
  }

  /** Hide a driver that is not in a car this frame (and free their avatar slot). */
  private parkDriver(ch: Character3DPlus): void {
    ch.root.visible = false;
    ch.ride = null;
    undressNow(ch, getTownUi().people === 'anime');
  }

  /** Draw the cars where they are, each with a townsperson at the wheel. */
  setCars(cars: readonly TrafficCar[], dt: number, night: number): void {
    const counts = this.cars.map(() => 0);
    const seen = new Set<number>();
    for (const c of cars) {
      const k = c.v % this.cars.length;
      const mesh = this.cars[k];
      if (counts[k] >= MAX_CARS) continue;
      const heading = carAngle(c.dir);
      this.e.set(0, -heading, 0);
      this.q.setFromEuler(this.e);
      this.v.set(c.x, this.ctx.lift(c.x, c.y), c.y);
      this.s.setScalar(this.scale);
      this.m.compose(this.v, this.q, this.s);
      mesh.setMatrixAt(counts[k]++, this.m);
      const di = ((c.id % this.drivers.length) + this.drivers.length) % this.drivers.length;
      if (!seen.has(di)) {
        seen.add(di);
        this.putDriver(this.drivers[di], c.x, c.y, heading, dt, night);
      }
    }
    this.cars.forEach((mesh, k) => {
      mesh.count = counts[k];
      mesh.instanceMatrix.needsUpdate = true;
    });
    for (let i = 0; i < this.drivers.length; i++) if (!seen.has(i)) this.parkDriver(this.drivers[i]);
  }

  /** The patrol car (null: no search), its lamps taking turns, an officer in the seat. */
  setPatrol(p: { x: number; y: number; heading: number } | null, dt: number, night: number): void {
    this.patrol.visible = !!p && !this.ctx.inRoom();
    if (!p) {
      this.parkDriver(this.patrolDriver);
      return;
    }
    this.t += dt;
    this.patrol.position.set(p.x, this.ctx.lift(p.x, p.y), p.y);
    this.patrol.rotation.y = -p.heading;
    const on = Math.floor(this.t * 4) % 2 === 0;
    this.lamps[0].visible = on;
    this.lamps[1].visible = !on;
    this.putDriver(this.patrolDriver, p.x, p.y, p.heading, dt, night);
  }

  /** The lights as the clock has them (the bulbs are written only when a phase changes). */
  setLights(nowMs: number): void {
    if (!this.bulbs) return;
    const phases = this.net.junctions.map((j) => (j.lights ? lightAt(this.net, j, nowMs) : null));
    const key = phases.map((p) => (p ? p.ew[0] + p.ns[0] : '-')).join('');
    if (key === this.lastPhase) return;
    this.lastPhase = key;
    const c = new Color();
    this.heads.forEach((h, k) => {
      const p = phases[h.junction];
      const now = p ? (h.axis === 'ew' ? p.ew : p.ns) : 'red';
      BULBS.forEach((b, i) => this.bulbs!.setColorAt(k * 3 + i, c.set(b === now ? LIT[b] : DIM)));
    });
    if (this.bulbs.instanceColor) this.bulbs.instanceColor.needsUpdate = true;
  }

  setVisible(on: boolean): void {
    this.group.visible = on;
    if (!on) {
      for (const d of this.drivers) this.parkDriver(d);
      this.parkDriver(this.patrolDriver);
    }
  }

  dispose(): void {
    this.group.removeFromParent();
    for (const g of this.geos) g.dispose();
    this.posts?.geometry.dispose();
    for (const c of this.cars) c.dispose();
    this.bulbs?.dispose();
    for (const d of this.drivers) d.dispose();
    this.patrolDriver.dispose();
  }

  /** Draw calls this layer adds (for the report): the car meshes, each driver (~2), the posts, the bulbs, the patrol. */
  drawCalls(): number {
    const driving = this.drivers.filter((d) => d.root.visible).length + (this.patrolDriver.root.visible ? 1 : 0);
    return this.cars.filter((c) => c.count > 0).length + driving * 2 + (this.posts ? 1 : 0) + (this.bulbs ? 1 : 0) + (this.patrol.visible ? 2 : 0);
  }

  /** The posts' feet, for the sim (a walker goes round them). */
  postFeet(): { x: number; y: number }[] {
    const seen = new Set<string>();
    const out: { x: number; y: number }[] = [];
    for (const h of this.heads) {
      const x = h.x - Math.cos(h.face) * 0.07;
      const y = h.y - Math.sin(h.face) * 0.07;
      const k = `${x.toFixed(2)},${y.toFixed(2)}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ x, y });
    }
    return out;
  }
}
