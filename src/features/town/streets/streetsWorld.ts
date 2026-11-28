// Westbay's streets at play (docs/town.md §28; docs/gta-plan.md M2): one controller driven by the 3D stage each frame
// (engine3d addExtra). It moves the traffic (core/town/traffic.ts), tells the sim what stands in the player's way
// (the cars, the patrol, the posts of the lights), notices an offence while the learner rides (a red light run, a car
// or a thing of the street hit), raises the heat (the jobs' heat: ../jobs/heatStore.ts), runs a search when the heat
// is high (core/town/police.ts) and says what the police know on the scanner (core/town/scanner.ts → ./streetsStore).
// Everything lives in memory: a reload forgets it (nothing stored, nothing synced; a fine is paid through town-progress).

import { CITY_PLACES, CITY_ROWS, CITY_WORLD } from '../../../data/cityWorld';
import { dispatchPlace } from '../../../data/city/dispatch/places';
import { placeVi } from '../../../data/city/dispatch/names';
import { FURNITURE_SIZE } from '../../../core/town/colliders';
import { makeRoutes } from '../../../core/town/dispatchRoads';
import { COOL_EVERY, heatAfterLost, heatAfterOffence, PATROL_AT, patrolStart, policeStep, sameLook, startSearch, UNITS, type Look, type Offence, type Search, type Seen } from '../../../core/town/police';
import { outfitColour, scanLines, vehicleColour, type ScanFacts, type ScanKind } from '../../../core/town/scanner';
import { compassOf, junctionAt, lightAt, ranRed, streetAt, westbayNet, type RoadNet } from '../../../core/town/streets';
import { blockersFor, CAR_BODY_GAP, carCircles, seedTraffic, stepTraffic, type TrafficCar } from '../../../core/town/traffic';
import { loadTownProgress } from '../../../core/town/store';
import { lookView } from '../../../core/town/wardrobe';
import type { Body } from '../engine/sim';
import { TrafficLayer } from '../three/scene/traffic';
import type { StageExtra, StageExtraCtx } from '../three/scene/stageExtra';
import { getTownUi } from '../townUi';
import { getHeat, setHeat } from '../jobs/heatStore';
import { coolStep, jobPatrolStep, patrolPath, startJobPatrol, type JobPatrolRun } from '../../../core/town/jobPatrol';
import type { Pt } from '../../../core/town/traffic';
import { linesDue, settleJobPatrol, takeJobPatrol, type JobScanLine } from './jobPolice';
import { streets } from './streetsStore';
import { trafficPace } from '../../../core/town/skyRules';
import { wetSoon } from '../../../core/town/skyNow';
import { releaseTrafficSource, setTrafficSource, type TrafficSnapshot } from '../../../core/town/radioTraffic';

/** How many cars drive Westbay (a guess: enough to meet some, few enough for the frame). */
export const TRAFFIC_CARS = 10;
/** A walker's gap from a post of the lights (tiles, centre to centre). */
const POST_GAP = 0.3;
/** Riding faster than this (tiles/s) a moment ago, touching something counts as hitting it. */
const HIT_SPEED = 1.8;
/** The same offence at the same thing is counted again only after this long (s). */
const AGAIN_AFTER = 8;

const placeNames = CITY_PLACES.filter((p) => dispatchPlace(p.id as string)).map((p) => ({ id: p.id as string, x: p.door.x + 0.5, y: p.door.y + 0.5 }));

/** The place with a spoken name nearest a point (within 12 tiles). */
function nearPlace(x: number, y: number): string | null {
  let best: string | null = null;
  let bd = 12;
  for (const p of placeNames) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < bd) {
      bd = d;
      best = p.id;
    }
  }
  return best;
}

export class StreetsWorld implements StageExtra {
  readonly net: RoadNet = westbayNet();
  private cars: TrafficCar[];
  private readonly layer: TrafficLayer;
  private readonly route = makeRoutes(CITY_ROWS);
  private readonly posts: Body[];
  private prev: { x: number; y: number } | null = null;
  private speed = 0;
  private fastUntil = -1;
  private t = 0;
  private cool = 0;
  private look: Look = { on: 'foot', colour: null, outfit: null };
  private lookIn = 0;
  private readonly marks = new Map<string, number>();
  private seed = 1;
  private turn = 0;
  /** A panel is over the stage (a talk, the stop): the police wait, the traffic does not. */
  frozen = false;
  /** The police car out at the last frame (a search's or a job's), for Bay FM's traffic. */
  private patrolSeen: Pt | null = null;
  private readonly source = (): TrafficSnapshot => this.trafficNow();

  private readonly ctx: StageExtraCtx;

  constructor(ctx: StageExtraCtx) {
    this.ctx = ctx;
    const anime = getTownUi().people === 'anime';
    this.cars = seedTraffic(this.net, TRAFFIC_CARS, Math.floor(Date.now() / 1000));
    this.layer = new TrafficLayer(ctx, this.net, anime ? 1.2 : 1);
    this.posts = this.layer.postFeet().map((p) => ({ ...p, gap: POST_GAP }));
    streets.attach(this);
    setTrafficSource(this.source);
  }

  /** Westbay's roads as Bay FM reads them now (core/town/radioTraffic.ts): the cars, the patrol's street, the wet. */
  trafficNow(): TrafficSnapshot {
    const p = this.patrolSeen;
    return {
      streets: this.net.streets.filter((s) => s.cars).map((s) => ({ id: s.id, name: s.name })),
      cars: this.cars.map((c) => ({ street: c.street, dir: c.dir, speed: c.speed })),
      ...(p ? { patrol: streetAt(this.net, p.x, p.y)?.name ?? null } : {}),
      wet: wetSoon(Date.now()),
    };
  }

  private rnd = (): number => (this.seed = (this.seed * 48271) % 2147483647) / 2147483647;

  /** How the learner looks now (the vehicle ridden and its colour, the top worn: read every second). */
  private lookNow(): Look {
    if (this.lookIn <= 0) {
      this.lookIn = 1;
      const ride = this.ctx.rideLook();
      let outfit: string | null = null;
      try {
        outfit = outfitColour(lookView(loadTownProgress()).outfit?.id);
      } catch {
        outfit = null;
      }
      this.look = ride ? { on: ride.kind, colour: vehicleColour(ride.kind, ride.v), outfit } : { on: 'foot', colour: null, outfit };
    }
    return this.look;
  }

  /** The learner as the police would put it. */
  seen(): Seen {
    const p = this.ctx.sim.player;
    const heading = this.prev && this.speed > 0.3 ? compassOf(p.x - this.prev.x, p.y - this.prev.y) : null;
    const road = streetAt(this.net, p.x, p.y, heading);
    return { x: p.x, y: p.y, look: this.lookNow(), road: road ? road.name : null, heading, near: nearPlace(p.x, p.y) };
  }

  facts(s: Seen, offence: Offence, thing: string | null, unit: number): ScanFacts {
    const near = s.near ? (dispatchPlace(s.near)?.en ?? null) : null;
    return { unit, look: s.look, road: s.road, heading: s.heading, near, nearVi: s.near ? placeVi(s.near) : null, offence, thing };
  }

  private say(kind: ScanKind, f: ScanFacts): void {
    streets.bulletin(scanLines(kind, f, this.turn++));
  }

  /** An offence: the heat goes up, and over the line a patrol sets out (or the search starts again from here). */
  offence(o: Offence, thing: string | null = null): void {
    const heat = heatAfterOffence(getHeat(), o);
    setHeat(heat);
    streets.noteOffence(o);
    const me = this.seen();
    const search = streets.search();
    if (search) {
      const s: Search = { ...search, look: me.look, offence: o, thing, last: me, unseen: 0 };
      streets.setSearch(s);
      this.say('start', this.facts(me, o, thing, s.unit));
      return;
    }
    if (heat < PATROL_AT) return;
    const from = patrolStart(
      me,
      this.net.junctions.filter((j) => j.lights).map((j) => ({ x: j.x + 1, y: j.y + 1 })),
      Math.floor(this.rnd() * 100),
    );
    const unit = UNITS[Math.floor(this.rnd() * UNITS.length) % UNITS.length];
    streets.setSearch(startSearch(me, o, thing, from, unit));
    this.say('start', this.facts(me, o, thing, unit));
  }

  /** Somewhere to cool down (a hideout): the search is called off and the heat is gone. */
  coolDown(): void {
    const s = streets.search();
    if (s) this.say('lost', this.facts(s.last, s.offence, s.thing, s.unit));
    streets.setSearch(null);
    setHeat(0);
  }

  private once(key: string): boolean {
    const last = this.marks.get(key);
    if (last !== undefined && this.t - last < AGAIN_AFTER) return false;
    this.marks.set(key, this.t);
    return true;
  }

  /** A job's patrol (./jobPolice.ts): it drives even while the learner is in a room, where it never sees them. */
  private jobRun: { run: JobPatrolRun; lines: readonly JobScanLine[]; said: number } | null = null;

  private stepJobPatrol(dt: number): Pt | null {
    if (!this.jobRun) {
      const take = takeJobPatrol();
      if (!take) return null;
      const path = patrolPath(this.net, take.spec);
      if (!path) {
        settleJobPatrol(false);
        return null;
      }
      this.jobRun = { run: startJobPatrol(path, take.spec.seconds), lines: take.spec.lines ?? [], said: 0 };
      streets.setJobPatrol(true);
    }
    const p = this.ctx.sim.player;
    const step = jobPatrolStep(this.jobRun.run, dt, { x: p.x, y: p.y, indoors: this.ctx.inRoom() });
    const due = linesDue(this.jobRun.lines, this.jobRun.said, step.run.t);
    if (due.due.length > 0) void streets.say(due.due, { force: true, open: true });
    this.jobRun = { ...this.jobRun, run: step.run, said: due.next };
    if (step.done) {
      const seen = step.run.seen;
      this.jobRun = null;
      streets.setJobPatrol(false);
      settleJobPatrol(seen);
      return null;
    }
    return step.at;
  }

  update(dt: number, night = 0): void {
    const jobAt = this.stepJobPatrol(dt);
    const jobHeading = this.jobRun ? this.jobRun.run.path.heading : 0;
    if (this.ctx.inRoom()) {
      this.layer.setVisible(false);
      return;
    }
    this.layer.setVisible(true);
    this.t += dt;
    this.lookIn -= dt;
    const now = Date.now();
    const p = this.ctx.sim.player;
    if (this.prev && dt > 0) {
      const v = Math.hypot(p.x - this.prev.x, p.y - this.prev.y) / dt;
      this.speed += (v - this.speed) * Math.min(1, dt * 8);
    }
    if (this.speed > HIT_SPEED) this.fastUntil = this.t + 0.4;
    const riding = !!this.ctx.rideLook();
    // while a job's patrol drives, the heat and the ordinary search wait (and its car is not drawn)
    const paused = !!jobAt;
    const search = paused ? null : streets.search();
    // the traffic: it stops for the player, the residents and the patrol
    const patrolNow = jobAt ?? (search ? search.patrol : null);
    this.patrolSeen = patrolNow ? { x: patrolNow.x, y: patrolNow.y } : null;
    const bodies = [{ x: p.x, y: p.y }, ...[...this.ctx.sim.residents.values()].map((r) => ({ x: r.x, y: r.y })), ...(patrolNow ? [patrolNow] : [])];
    // (slower on wet roads: core/town/skyRules.ts trafficPace)
    this.cars = stepTraffic(this.cars, dt, { net: this.net, nowMs: now, bodies, rnd: this.rnd, pace: trafficPace(wetSoon(now)) });
    // what stands in the player's way: never anything they are already inside (a car turning across them, the patrol
    // pulling up), so nothing that moves can shut them in (core/town/traffic.ts blockersFor)
    this.ctx.sim.extraBodies = blockersFor(p, this.cars, patrolNow, this.posts);
    // offences, riding: a red light; a car or a thing of the street hit at speed
    if (riding && this.prev && !paused) {
      const j = ranRed(this.net, this.prev, p, now);
      if (j && this.once(`red:${j.id}`)) this.offence('red');
      if (this.t < this.fastUntil) {
        for (const c of this.cars)
          if (carCircles(c).some((q) => Math.hypot(q.x - p.x, q.y - p.y) < CAR_BODY_GAP + 0.12) && this.once(`car:${c.id}`)) {
            this.offence('car');
            break;
          }
        ;(CITY_WORLD.furniture ?? []).forEach((f, i) => {
          const s = FURNITURE_SIZE[f.kind];
          const r = 'r' in s ? s.r : Math.max(s.x1 - s.x0, s.z1 - s.z0) / 2;
          if (Math.hypot(f.x - p.x, f.y - p.y) < r + 0.42 && this.once(`thing:${i}`)) this.offence('thing', f.kind);
        });
      }
    }
    this.prev = { x: p.x, y: p.y };
    // the search
    const s = paused ? null : streets.search();
    if (s && !this.frozen) {
      const me = this.seen();
      const r = policeStep(s, dt, me, (a, b) => this.route(a, b));
      for (const e of r.events) {
        if (e === 'bulletin' && r.search) this.say('update', this.facts(r.search.last, r.search.offence, r.search.thing, r.search.unit));
        if (e === 'spotted') this.say('spotted', this.facts(me, s.offence, s.thing, s.unit));
        if (e === 'lost') {
          const looksElse = !sameLook(s.look, me.look) && Math.hypot(me.x - s.patrol.x, me.y - s.patrol.y) < 12;
          this.say(looksElse ? 'lostLook' : 'lost', this.facts({ ...s.last, look: s.look }, s.offence, s.thing, s.unit));
          setHeat(heatAfterLost(getHeat()));
          streets.gotAway();
        }
        if (e === 'caught') streets.caught(s, this.facts(me, s.offence, s.thing, s.unit));
      }
      streets.setSearch(r.search);
    }
    // without a search the heat cools (held still while a job's patrol drives)
    const cooled = coolStep(getHeat(), this.cool, dt, !!streets.search(), paused, COOL_EVERY);
    this.cool = cooled.cool;
    if (cooled.heat !== getHeat()) setHeat(cooled.heat);
    // draw (each car a townsperson at the wheel)
    this.layer.setCars(this.cars, dt, night);
    const sNow = streets.search();
    this.layer.setPatrol(jobAt ? { ...jobAt, heading: jobHeading } : sNow ? sNow.patrol : null, dt, night);
    this.layer.setLights(now);
  }

  /** For the headless checks: the lights of a junction now. */
  lightOf(id: string) {
    const j = this.net.junctions.find((x) => x.id === id);
    return j ? lightAt(this.net, j, Date.now()) : null;
  }

  /** For the headless checks (window.__streets in dev). */
  debug() {
    const p = this.ctx.sim.player;
    return { cars: this.cars.map((c) => ({ x: +c.x.toFixed(2), y: +c.y.toFixed(2), dir: c.dir, speed: +c.speed.toFixed(2) })), player: { x: p.x, y: p.y }, inJunction: junctionAt(this.net, p.x, p.y)?.id ?? null, drawCalls: this.layer.drawCalls(), heat: getHeat(), search: streets.search(), bulletin: streets.lastBulletin(), stop: streets.stopNow() };
  }

  dispose(): void {
    // the page left during a job's patrol: it is over, and nobody was seen
    if (this.jobRun) {
      this.jobRun = null;
      streets.setJobPatrol(false);
      settleJobPatrol(false);
    }
    this.ctx.sim.extraBodies = [];
    this.layer.dispose();
    streets.detach(this);
    releaseTrafficSource(this.source);
  }
}
