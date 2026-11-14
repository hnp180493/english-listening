// The living part of the town, without any drawing: where the player, the residents and the cat are, how they walk
// along a path, when a resident wanders, and "walk there, then call back". Plain TypeScript; time comes in as `dt`
// seconds and randomness as a function, so tests can run it step by step.

import { canStep, findPath, nearestWalkable, NEIGHBOURS, sameTile, walkable } from '../../../core/town/map';
import { TOWN_WORLD, type PlaceId, type Tile, type TownWorld, type WorldPlace } from '../../../data/townWorld';
import type { TownTheme } from './palette';

export type Marker = 'new' | 'repeat' | 'heart';

/** Everything the stage is told from outside: plain data the game shell computes. */
export interface StageState {
  /** Ids of the places that are built (the others are empty lots, and their residents are not in town). */
  built: readonly string[];
  /**
   * Empty lots shown as construction sites (with their price): the next ones the learner works toward. The others
   * are plain nature until they come up. Left out = every empty lot is a site.
   */
  sites?: readonly string[];
  /** Ids of the decorations bought. */
  decorations: readonly string[];
  /** Per place, 0..1: how much of its windows glow (the share of its lines understood). */
  lit: Readonly<Record<string, number>>;
  /** Per place: what floats over its resident's head. */
  marker: Readonly<Record<string, Marker>>;
  theme: TownTheme;
}

export type ActorKind = 'player' | 'resident' | 'cat';

export interface Actor {
  id: string;
  kind: ActorKind;
  /** Position on the tile grid (the centre of tile (3,4) is (3.5, 4.5)). */
  x: number;
  y: number;
  /** The tile it stands on, or the one it last left. */
  tile: Tile;
  /** Tiles still to walk through, in order. */
  path: Tile[];
  /** World pixels per second. */
  speed: number;
  /** Which way it looks, as a step on the tile grid (any length): (1, 1) = towards the viewer. */
  heading: Tile;
  /** 1 = looks right on the screen, -1 = left. */
  facing: 1 | -1;
  moving: boolean;
  /** Grows while walking: drives the walk cycle. */
  phase: number;
}

export interface Resident extends Actor {
  kind: 'resident';
  place: WorldPlace;
  /** Seconds until the next little walk. */
  wanderIn: number;
  /** Held in place (the player is coming to talk, or is talking). */
  engaged: boolean;
}

export interface Cat extends Actor {
  kind: 'cat';
  /** Seconds it keeps sitting. */
  sitFor: number;
}

export type Arrival = { kind: 'talk'; placeId: PlaceId } | { kind: 'lot'; placeId: PlaceId } | { kind: 'tile'; tile: Tile };

interface Errand {
  target: Tile;
  arrival: Arrival;
  then?: () => void;
}

export const PLAYER_SPEED = 150;
export const RESIDENT_SPEED = 42;
export const CAT_SPEED = 64;

const centre = (t: Tile) => ({ x: t.x + 0.5, y: t.y + 0.5 });

/** Screen distance (world pixels) between two points of the tile grid. */
export function gridDistance(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.hypot((dx - dy) * 32, (dx + dy) * 16);
}

function makeActor(id: string, kind: ActorKind, tile: Tile, speed: number): Actor {
  return { id, kind, ...centre(tile), tile: { ...tile }, path: [], speed, heading: { x: 1, y: 1 }, facing: 1, moving: false, phase: 0 };
}

/**
 * Move an actor along its path for `dt` seconds at its speed (constant on the SCREEN, so a step across the screen
 * takes longer than a step up it). Returns true when it reached the end of its path during this call.
 */
export function advance(a: Actor, dt: number): boolean {
  if (a.path.length === 0) {
    a.moving = false;
    return false;
  }
  let left = a.speed * dt;
  a.moving = true;
  while (a.path.length > 0 && left > 0) {
    const next = a.path[0];
    const goal = centre(next);
    const dist = gridDistance(a.x, a.y, goal.x, goal.y);
    const sdx = goal.x - a.x - (goal.y - a.y);
    if (sdx > 1e-6) a.facing = 1;
    else if (sdx < -1e-6) a.facing = -1;
    if (Math.abs(goal.x - a.x) + Math.abs(goal.y - a.y) > 1e-6) a.heading = { x: goal.x - a.x, y: goal.y - a.y };
    if (dist <= left) {
      a.x = goal.x;
      a.y = goal.y;
      a.tile = { ...next };
      a.path.shift();
      left -= dist;
    } else {
      const k = left / dist;
      a.x += (goal.x - a.x) * k;
      a.y += (goal.y - a.y) * k;
      left = 0;
    }
  }
  a.phase += dt * (a.speed / 14);
  if (a.path.length === 0) {
    a.moving = false;
    return true;
  }
  return false;
}

/** Look at a point of the tile grid (`facing` does not change when it is straight above or below on the screen). */
export function face(a: Actor, x: number, y: number): void {
  const sdx = x - a.x - (y - a.y);
  // standing, a person turns three-quarters towards the viewer on that side (a step of +x or +y on the grid):
  // a straight side view hides the face behind the hair
  if (sdx > 0.05) {
    a.facing = 1;
    a.heading = { x: 1, y: 0 };
  } else if (sdx < -0.05) {
    a.facing = -1;
    a.heading = { x: 0, y: 1 };
  } else if (x + y > a.x + a.y + 0.05) {
    a.heading = { x: 1, y: 1 };
  } else {
    // straight above on the screen: never the back of the head, three-quarters on the side it already looks to
    settle(a);
  }
}

/**
 * Standing still, a person turns three-quarters towards the viewer on the side they look to (SE or SW): with these
 * blocky heads a back view is a box of hair, so nobody rests with their back to the camera.
 */
export function settle(a: Actor): void {
  a.heading = a.facing === 1 ? { x: 1, y: 0 } : { x: 0, y: 1 };
}

/**
 * Arrow keys / WASD → a step on the tile grid. The keys mean SCREEN directions: up = away from the viewer
 * (x-1, y-1), right = across the screen (x+1, y-1). Two keys give a step along a row or a column.
 */
export function keysToDelta(k: { up: boolean; down: boolean; left: boolean; right: boolean }): Tile {
  const v = (k.down ? 1 : 0) - (k.up ? 1 : 0);
  const h = (k.right ? 1 : 0) - (k.left ? 1 : 0);
  return { x: Math.sign(v + h), y: Math.sign(v - h) };
}

/**
 * The step actually taken for a held direction: the direction itself when free; for a blocked diagonal, sliding
 * along the side that is free (so holding "up" against a house walks along its wall). Null = stay.
 */
export function slideStep(from: Tile, delta: Tile, world: TownWorld = TOWN_WORLD): Tile | null {
  if (delta.x === 0 && delta.y === 0) return null;
  if (canStep(from, delta, world)) return delta;
  if (delta.x !== 0 && delta.y !== 0) {
    const a = { x: delta.x, y: 0 };
    const b = { x: 0, y: delta.y };
    if (canStep(from, a, world)) return a;
    if (canStep(from, b, world)) return b;
  }
  return null;
}

export class TownSim {
  readonly world: TownWorld;
  private readonly rng: () => number;
  readonly player: Actor;
  /** Residents in town (built places only), by place id. */
  readonly residents = new Map<PlaceId, Resident>();
  cat: Cat | null = null;
  private built = new Set<string>();
  private sites: Set<string> | null = null;
  private errand: Errand | null = null;
  private held: Tile = { x: 0, y: 0 };
  /** Where the player is walking to (for the marker on the ground), if anywhere. */
  goal: Tile | null = null;
  /** The resident in a conversation with the player: the others keep their distance and stop strolling. */
  private talking: PlaceId | null = null;

  constructor(world: TownWorld = TOWN_WORLD, rng: () => number = Math.random, start?: Tile) {
    this.world = world;
    this.rng = rng;
    const at = start && walkable(start, world) ? start : world.start;
    this.player = makeActor('player', 'player', at, PLAYER_SPEED);
  }

  /** Residents appear with their place and leave with it; the cat comes when bought. */
  setState(state: Pick<StageState, 'built' | 'decorations' | 'sites'>): void {
    this.built = new Set(state.built);
    this.sites = state.sites ? new Set(state.sites) : null;
    for (const p of this.world.places) {
      const has = this.residents.has(p.id);
      if (this.built.has(p.id) && !has) {
        const r: Resident = {
          ...makeActor(p.id, 'resident', p.spot, RESIDENT_SPEED),
          kind: 'resident',
          place: p,
          wanderIn: 3 + this.rng() * 8,
          engaged: false,
        };
        // look towards the middle of town
        face(r, this.world.plaza.x, this.world.plaza.y);
        this.residents.set(p.id, r);
      } else if (!this.built.has(p.id) && has) {
        this.residents.delete(p.id);
      }
    }
    const wantsCat = state.decorations.includes('cat');
    if (wantsCat && !this.cat) {
      const spot = this.world.decorations.cat[0] ?? centre(this.world.start);
      const tile = nearestWalkable({ x: Math.floor(spot.x), y: Math.floor(spot.y) }, this.world) ?? this.world.start;
      this.cat = { ...makeActor('cat', 'cat', tile, CAT_SPEED), kind: 'cat', sitFor: 2 };
    } else if (!wantsCat) {
      this.cat = null;
    }
  }

  isBuilt(id: string): boolean {
    return this.built.has(id);
  }

  /** An empty lot shown as a construction site (one of the next to build): it can be clicked and built from the world. */
  isSite(id: string): boolean {
    return !this.built.has(id) && (this.sites === null || this.sites.has(id));
  }

  actor(id: string): Actor | null {
    if (id === 'player') return this.player;
    if (id === 'cat') return this.cat;
    return this.residents.get(id as PlaceId) ?? null;
  }

  // ───────────────────────── the player ─────────────────────────

  /** Walk to a tile (or to the nearest walkable one). False when there is no way. */
  walkToTile(tile: Tile, then?: () => void): boolean {
    const target = nearestWalkable(tile, this.world, this.player.tile);
    if (!target) return false;
    this.release();
    return this.send(target, { kind: 'tile', tile: target }, then);
  }

  /**
   * Walk up to a resident and stop beside them. The resident waits. `then` runs once, on arrival (at once when the
   * player already stands next to them). False when the resident is not in town or cannot be reached.
   */
  walkToResident(id: PlaceId, then?: () => void): boolean {
    const r = this.residents.get(id);
    if (!r) return false;
    this.release();
    r.engaged = true;
    // the resident finishes the step it is in and stays there
    if (r.path.length > 1) r.path.length = 1;
    const at = r.path[0] ?? r.tile;
    const from = this.from();
    let best: Tile | null = null;
    let bestLen = Infinity;
    for (const d of NEIGHBOURS) {
      const c = { x: at.x + d.x, y: at.y + d.y };
      if (!walkable(c, this.world)) continue;
      const steps = sameTile(c, from) ? 0 : findPath(from, c, this.world).length || Infinity;
      // straight above or below on the screen the two would overlap: stand beside them unless that is much further;
      // and never on top of somebody else (two people in one spot read as one with two heads)
      const len = steps + (d.x === d.y ? 2.5 : 0) + (this.crowded(c, id) ? 6 : 0);
      if (len < bestLen) {
        best = c;
        bestLen = len;
      }
    }
    if (!best) {
      r.engaged = false;
      return false;
    }
    return this.send(best, { kind: 'talk', placeId: id }, then);
  }

  /** Walk to the door of a place (an empty lot's gate). */
  walkToDoor(id: PlaceId, then?: () => void): boolean {
    const p = this.world.places.find((q) => q.id === id);
    if (!p) return false;
    this.release();
    return this.send(p.door, { kind: this.built.has(id) ? 'talk' : 'lot', placeId: id }, then);
  }

  /** Keys held: a step on the tile grid (see keysToDelta), {0,0} = none. Taking the keys cancels a click walk. */
  hold(delta: Tile): void {
    this.held = { x: Math.sign(delta.x), y: Math.sign(delta.y) };
    if (this.held.x !== 0 || this.held.y !== 0) {
      this.cancelErrand();
      // finish the current step, then follow the keys
      if (this.player.path.length > 1) this.player.path.length = 1;
    }
  }

  /** Let go of the resident being talked to: they wander again. */
  release(): void {
    for (const r of this.residents.values()) r.engaged = false;
  }

  /** Another resident (not `except`) stands on or next to this tile. */
  private crowded(t: Tile, except: PlaceId): boolean {
    for (const o of this.residents.values()) {
      if (o.place.id === except) continue;
      const at = o.path[o.path.length - 1] ?? o.tile;
      if (Math.abs(at.x - t.x) <= 1 && Math.abs(at.y - t.y) <= 1) return true;
    }
    return false;
  }

  /**
   * Hold a resident where they are (a conversation is open; null = it closed). While it lasts nobody else strolls,
   * and whoever stands close to the two steps aside, so the pair is never crowded.
   */
  engage(id: PlaceId | null): void {
    this.release();
    const r = id ? this.residents.get(id) : null;
    this.talking = r ? r.place.id : null;
    if (!r) return;
    r.engaged = true;
    if (r.path.length > 1) r.path.length = 1;
    face(r, this.player.x, this.player.y);
    face(this.player, r.x, r.y);
  }

  private from(): Tile {
    // mid-step, the walk continues from the tile being entered
    return this.player.path[0] ?? this.player.tile;
  }

  private cancelErrand(): void {
    this.errand = null;
    this.goal = null;
    this.release();
  }

  private send(target: Tile, arrival: Arrival, then?: () => void): boolean {
    const from = this.from();
    const keep = this.player.path.slice(0, 1);
    if (sameTile(from, target)) {
      this.player.path = keep;
    } else {
      const path = findPath(from, target, this.world);
      if (path.length === 0) {
        if (arrival.kind === 'talk') this.release();
        return false;
      }
      this.player.path = [...keep, ...path];
    }
    this.errand = { target, arrival, then };
    this.goal = target;
    this.held = { x: 0, y: 0 };
    return true;
  }

  // ───────────────────────── time ─────────────────────────

  /** Advance everything by `dt` seconds. Returns what the player reached during this step (at most one thing). */
  update(dt: number): Arrival | null {
    const p = this.player;
    // keys: queue the next step as the current one ends, so a held key walks without a hitch
    if ((this.held.x !== 0 || this.held.y !== 0) && p.path.length === 0) {
      const d = slideStep(p.tile, this.held, this.world);
      if (d) p.path.push({ x: p.tile.x + d.x, y: p.tile.y + d.y });
      else face(p, p.x + this.held.x, p.y + this.held.y);
    }
    const stopped = advance(p, dt);
    if ((this.held.x !== 0 || this.held.y !== 0) && p.path.length === 0) {
      const d = slideStep(p.tile, this.held, this.world);
      if (d) {
        p.path.push({ x: p.tile.x + d.x, y: p.tile.y + d.y });
        p.moving = true;
      }
    }

    // stopped with no key held: turn to the viewer (an errand to talk turns them to the resident just below)
    if (stopped && p.path.length === 0 && this.held.x === 0 && this.held.y === 0) settle(p);
    let arrived: Arrival | null = null;
    if (this.errand && p.path.length === 0 && sameTile(p.tile, this.errand.target)) {
      const e = this.errand;
      this.errand = null;
      this.goal = null;
      arrived = e.arrival;
      if (e.arrival.kind === 'talk') {
        const r = this.residents.get(e.arrival.placeId);
        if (r) {
          face(p, r.x, r.y);
          face(r, p.x, p.y);
        }
      }
      e.then?.();
    }

    for (const r of this.residents.values()) this.updateResident(r, dt);
    if (this.cat) this.updateCat(this.cat, dt);
    return arrived;
  }

  private updateResident(r: Resident, dt: number): void {
    if (r.path.length > 0) {
      // the end of a little walk: they turn back to the viewer
      if (advance(r, dt)) settle(r);
      return;
    }
    r.moving = false;
    if (this.talking && this.talking !== r.place.id) {
      if (r.wanderIn > 0 && r.wanderIn < 1) r.wanderIn = Math.max(0, r.wanderIn - dt);
      this.keepClear(r);
      return;
    }
    const near = gridDistance(r.x, r.y, this.player.x, this.player.y) < 78;
    if (r.engaged || near) {
      // somebody is close: look at them and wait
      if (near) face(r, this.player.x, this.player.y);
      return;
    }
    r.wanderIn -= dt;
    if (r.wanderIn > 0) return;
    // most of the time they stand by their door; a stroll is short and brings them back
    r.wanderIn = 6 + this.rng() * 8;
    const home = r.place.spot;
    // (sent further off during a conversation, they come all the way back)
    const away = Math.max(Math.abs(r.tile.x - home.x), Math.abs(r.tile.y - home.y)) > 1;
    if (!sameTile(r.tile, home) && (away || this.rng() < 0.7)) {
      const back = findPath(r.tile, home, this.world);
      if (back.length > 0 && (back.length <= 2 || away)) {
        r.path = back;
        return;
      }
    }
    // a tile around the spot where they wait, never onto a doorstep
    const options: Tile[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const c = { x: home.x + dx, y: home.y + dy };
        if (sameTile(c, r.tile) || !walkable(c, this.world)) continue;
        if (this.world.places.some((q) => sameTile(q.door, c))) continue;
        options.push(c);
      }
    }
    if (options.length === 0) return;
    const to = options[Math.min(options.length - 1, Math.floor(this.rng() * options.length))];
    const path = findPath(r.tile, to, this.world);
    if (path.length > 0 && path.length <= 2) r.path = path;
  }

  /**
   * A conversation is going on: a resident within two tiles of either speaker walks off to the nearest tile at
   * least three away from both (home when that is far enough), then waits there facing the viewer.
   */
  private keepClear(r: Resident): void {
    const other = this.talking ? this.residents.get(this.talking) : null;
    if (!other) return;
    const pair = [this.player.path[this.player.path.length - 1] ?? this.player.tile, other.path[other.path.length - 1] ?? other.tile];
    const gap = (t: Tile) => Math.min(...pair.map((p) => Math.max(Math.abs(p.x - t.x), Math.abs(p.y - t.y))));
    if (gap(r.tile) > 2) return;
    // nowhere to go last time: look again in a moment, not every frame
    if (r.wanderIn > 0 && r.wanderIn < 1) return;
    let best: Tile[] | null = null;
    const home = r.place.spot;
    if (gap(home) >= 3) {
      const back = findPath(r.tile, home, this.world);
      if (back.length > 0) best = back;
    }
    if (!best) {
      for (let dy = -4; dy <= 4; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
          const c = { x: r.tile.x + dx, y: r.tile.y + dy };
          if (gap(c) < 3 || !walkable(c, this.world)) continue;
          if (this.world.places.some((q) => sameTile(q.door, c))) continue;
          const path = findPath(r.tile, c, this.world);
          if (path.length > 0 && (!best || path.length < best.length)) best = path;
        }
      }
    }
    if (best) {
      r.path = best;
      r.wanderIn = 3 + this.rng() * 4;
    } else {
      r.wanderIn = 0.9;
    }
  }

  private updateCat(c: Cat, dt: number): void {
    if (c.path.length > 0) {
      if (advance(c, dt)) c.sitFor = 2 + this.rng() * 5;
      return;
    }
    c.moving = false;
    c.sitFor -= dt;
    if (c.sitFor > 0) return;
    // somewhere on or around the plaza
    const { plaza } = this.world;
    const a = this.rng() * Math.PI * 2;
    const d = 1.2 + this.rng() * (plaza.r + 0.6);
    const want = { x: Math.floor(plaza.x + Math.cos(a) * d), y: Math.floor(plaza.y + Math.sin(a) * d) };
    const to = nearestWalkable(want, this.world, c.tile);
    const path = to ? findPath(c.tile, to, this.world) : [];
    if (path.length > 0) c.path = path;
    else c.sitFor = 1;
  }
}
