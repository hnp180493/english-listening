// A talk staged inside (engine/staging.ts, docs/town.md §7 "Staging"): one room of three/interiors with its people,
// in its own scene. The resident stands at the room's host anchor in its pose (behind the counter, standing, seated),
// the learner's character at the guest anchor (with their hat, outfit and pet), a neighbour who drops in at the
// visitor anchor, and two or three nameless people at the extras anchors doing small things (a sip, a page, a look
// round; pupils are children). The engine swaps the town's scene for this one at the dark of a fade, draws it with
// the room's own lights and shot, and hangs its bubbles, emotes and coins on these people's heads.

import { PerspectiveCamera, Scene, Vector3, type Object3D } from 'three';
import { createCharacter, createPet, passerLook, type Character3DPlus } from '../characters';
import type { CharAction, Character3D, Pet3D } from '../contracts';
import type { RoomAnchor, RoomShot } from '../interiors/contracts';
import { entryPath, gazePoint, headHeight, type RoomSet } from '../interiors/rooms';
import { basisOf, fitDistance, insetShift } from './cameraRig';
import type { SafeInsets } from '../../engine/stage';
import { angleDiff } from './coords';

/** Who is in the room as the town knows them: the resident by place id, 'player', a visitor by place id. */
export interface RoomCast {
  host: string;
  visitor: string | null;
  /** The player's pet (data/townGame.ts), sitting by them. */
  pet: string | null;
  /** Dress the player's character (hat, outfit). */
  dress: (ch: Character3D) => void;
  /** The visitor is in the room from the start (false: not until their first line: setVisitorIn). Default true. */
  visitorIn?: boolean;
}

/** How long a way in is (tiles). */
function wayLength(w: readonly { x: number; z: number }[]): number {
  let len = 0;
  for (let i = 1; i < w.length; i++) len += Math.hypot(w[i].x - w[i - 1].x, w[i].z - w[i - 1].z);
  return Math.max(0.05, len);
}

/** What the panels leave free is shorter than this (CSS px): the room's shot may come closer (aim). */
const SHORT_STRIP = 360;

/** A neighbour walking in: this fast (tiles/s, a brisk walk: in within about two seconds). */
const VISIT_SPEED = 1.5;

interface RoomPerson {
  id: string;
  ch: Character3DPlus;
  anchor: RoomAnchor;
  /** The loop it plays when nothing else is going on. */
  rest: CharAction;
  action: CharAction;
  oneShot: number;
  /** Extras: when it next changes what it does, and where it looks now. */
  nextAt: number;
  look: Vector3 | null;
}

/** What standing extras do in each room now and then (seated ones look round). */
const EXTRA_LOOPS: Readonly<Record<string, readonly CharAction[]>> = {
  cafe: ['drink', 'idle', 'drink'],
  shop: ['idle', 'read'],
  office: ['read', 'idle'],
  school: ['read', 'idle'],
  station: ['read', 'idle'],
  clinic: ['read', 'idle'],
  cinema: ['talk', 'idle', 'drink'],
  phone: ['idle', 'read'],
  park: ['idle', 'read'],
  board: ['read', 'idle'],
  inn: ['drink', 'read', 'idle'],
  square: ['read', 'idle'],
  friend: ['idle'],
  home: ['idle'],
};

/** Every mesh of a figure casts and takes shadows. */
function shade(o: Object3D): void {
  o.traverse((c) => {
    const m = c as unknown as { isMesh?: boolean; castShadow: boolean; receiveShadow: boolean };
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
}

/** A small seeded random (the same room looks the same each time; its life varies a little). */
function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class RoomStage {
  readonly scene = new Scene();
  readonly room: RoomSet;
  readonly camera = new PerspectiveCamera(32, 1, 0.05, 120);
  private readonly people = new Map<string, RoomPerson>();
  private readonly extras: RoomPerson[] = [];
  private pet: Pet3D | null = null;
  private readonly rng: () => number;
  private readonly v = new Vector3();
  private readonly w = new Vector3();
  /** The camera now and where it is going (eased: a panel opening moves it, never a jump). */
  private cam = { x: 0, y: 0, z: 0, tx: 0, ty: 0, tz: 0, sx: 0, sy: 0, fov: 32 };
  private camSet = false;
  readonly host: string;
  readonly visitor: string | null;
  /**
   * The neighbour who drops in (docs/town.md §7 "Staging"): 'out' of the room (not drawn) until their first line, then
   * walking in from outside the room's open side round the furniture ('enter', `k` 0 → 1 along `way`, interiors/rooms.ts
   * entryPath), 'in' at their spot; 'leave' walks back out.
   */
  private visit: { state: 'out' | 'enter' | 'in' | 'leave'; k: number; way: { x: number; z: number }[]; len: number } | null = null;
  /** The stage as the last aim saw it: its size and the right edge of what the panels leave free (CSS px). */
  private view = { w: 1, h: 1, freeRight: 1 };

  constructor(room: RoomSet, cast: RoomCast, seed = 1) {
    this.room = room;
    this.host = cast.host;
    this.visitor = cast.visitor;
    this.rng = seeded(seed * 7919 + room.id.length * 31);
    this.scene.add(room.root);
    const host = this.add(cast.host, createCharacter(cast.host) as Character3DPlus, room.host);
    const guest = this.add('player', createCharacter('player') as Character3DPlus, room.guest);
    cast.dress(guest.ch);
    void host;
    if (cast.visitor) {
      const v = this.add(cast.visitor, createCharacter(cast.visitor) as Character3DPlus, room.visitor);
      // in from the right of the picture, along the back of the room (from the left would be across the front, under
      // the lens); no way in round the furniture: they appear at their spot (a step from it)
      const er = { size: room.size, blocks: room.blocks, host: room.host, guest: room.guest, extras: room.extras, outdoor: room.id === 'park' };
      const way = entryPath(er, room.visitor, 'x') ?? entryPath(er, room.visitor) ?? [{ x: room.visitor.x + 0.01, z: room.visitor.z }, { x: room.visitor.x, z: room.visitor.z }];
      const out = cast.visitorIn === false;
      this.visit = { state: out ? 'out' : 'in', k: out ? 0 : 1, way, len: wayLength(way) };
      if (out) v.ch.root.visible = false;
    }
    const child = room.id === 'school';
    room.extras.slice(0, 3).forEach((a, i) => {
      const look = passerLook(41 + i * 13 + room.id.charCodeAt(0) * 3 + room.id.length * 7, child);
      const p = this.add(`extra${i}`, createCharacter(`extra${i}`, look) as Character3DPlus, a);
      p.nextAt = 0.4 + this.rng() * 2;
      this.extras.push(p);
    });
    if (cast.pet) {
      const pet = createPet(cast.pet);
      shade(pet.root);
      // by the player's side, a little towards the open side of the room (in front of them as seen)
      const g = room.guest;
      const side = g.heading - Math.PI / 2;
      pet.root.position.set(g.x + Math.cos(side) * 0.32 + 0.05, 0, g.z + Math.sin(side) * 0.32 + 0.22);
      pet.setHeading(g.heading, true);
      this.scene.add(pet.root);
      this.pet = pet;
    }
    // a moment of life before the first frame: everybody already settled in their pose (no sitting down on screen);
    // only the people (the room's own life starts with the first frame), in a few coarse steps
    for (let i = 0; i < 9; i++) for (const p of this.people.values()) p.ch.update(0.1, 0);
  }

  private add(id: string, ch: Character3DPlus, a: RoomAnchor): RoomPerson {
    shade(ch.root);
    ch.root.position.set(a.x, 0, a.z);
    ch.setHeading(a.heading, true);
    const rest: CharAction = a.pose === 'sit' ? 'sit' : 'idle';
    if (a.pose === 'sit') ch.setSeatHeight(a.seatY ?? 0.18);
    ch.setAction(rest);
    this.scene.add(ch.root);
    const p: RoomPerson = { id, ch, anchor: a, rest, action: rest, oneShot: 0, nextAt: Infinity, look: null };
    this.people.set(id, p);
    return p;
  }

  /** This person is in the room (by town id: a resident's place id, 'player'). */
  has(id: string): boolean {
    return this.people.has(id);
  }

  /** The top of somebody's head in the room's scene, or null (a neighbour not in the room yet). */
  head(id: string, out: Vector3): Vector3 | null {
    const p = this.people.get(id);
    if (!p || (id === this.visitor && this.visit?.state === 'out')) return null;
    return p.ch.headTop(out);
  }

  /**
   * The neighbour comes in (walking in from outside the room's open side; `instant`: there at once) or goes out (walks
   * back out, then is not drawn). Nothing without a visitor.
   */
  setVisitorIn(present: boolean, instant = false): void {
    const v = this.visit;
    const p = this.visitor ? this.people.get(this.visitor) : null;
    if (!v || !p) return;
    if (present) {
      if (v.state === 'in' || (v.state === 'enter' && !instant)) return;
      p.ch.root.visible = true;
      if (instant) {
        v.state = 'in';
        v.k = 1;
        this.walkTo(p, 1, true);
        p.ch.setAction(p.rest);
        p.action = p.rest;
        return;
      }
      if (v.k <= 0) v.k = this.hiddenPart();
      v.state = 'enter';
      this.walkTo(p, v.k, true);
    } else {
      if (v.state === 'out' || (v.state === 'leave' && !instant)) return;
      if (instant || v.k <= 0) {
        v.state = 'out';
        v.k = 0;
        p.ch.root.visible = false;
        return;
      }
      v.state = 'leave';
    }
  }

  /**
   * How much of the way in lies behind a panel docked at the right (a wide stage) or off the stage: it is skipped, so
   * the neighbour steps out from behind the panel's edge a moment after their line starts, not seconds later.
   */
  private hiddenPart(): number {
    const v = this.visit;
    if (!v) return 0;
    const cam = this.camera;
    cam.updateMatrixWorld();
    const p = this.visitor ? this.people.get(this.visitor) : null;
    if (!p) return 0;
    let last = 0;
    for (let s = 0; s <= v.len; s += 0.05) {
      const k = s / v.len;
      this.walkTo(p, k, true);
      this.v.copy(p.ch.root.position).setY(0.4).project(cam);
      const x = ((this.v.x + 1) / 2) * this.view.w;
      // (a body's half width past the edge: still hidden)
      if (x < this.view.freeRight - 30 && this.v.z < 1) break;
      last = k;
    }
    // step out from a little behind the edge
    return Math.max(0, last - 0.35 / v.len);
  }

  /** The neighbour at `k` (0 outside, 1 at their spot) along their way in, facing the way they go. */
  private walkTo(p: RoomPerson, k: number, instant: boolean): void {
    const v = this.visit!;
    const a = p.anchor;
    if (k >= 1) {
      p.ch.root.position.set(a.x, 0, a.z);
      p.ch.setHeading(a.heading, instant);
      return;
    }
    let s = Math.max(0, k) * v.len;
    for (let i = 1; i < v.way.length; i++) {
      const p0 = v.way[i - 1];
      const p1 = v.way[i];
      const seg = Math.hypot(p1.x - p0.x, p1.z - p0.z);
      if (s > seg && i < v.way.length - 1) {
        s -= seg;
        continue;
      }
      const t = seg > 0 ? Math.min(1, s / seg) : 1;
      p.ch.root.position.set(p0.x + (p1.x - p0.x) * t, 0, p0.z + (p1.z - p0.z) * t);
      const h = Math.atan2(p1.z - p0.z, p1.x - p0.x);
      p.ch.setHeading(v.state === 'leave' ? h + Math.PI : h, instant);
      return;
    }
  }

  /** The neighbour's walk in or out, one frame: true while they walk. */
  private stepVisit(dt: number, still: boolean): boolean {
    const v = this.visit;
    const p = this.visitor ? this.people.get(this.visitor) : null;
    if (!v || !p || (v.state !== 'enter' && v.state !== 'leave')) return false;
    const step = still ? 1 : (Math.max(0, dt) * VISIT_SPEED) / v.len;
    if (v.state === 'enter') {
      v.k = Math.min(1, v.k + step);
      if (v.k >= 1) {
        v.state = 'in';
        this.walkTo(p, 1, still);
        return false;
      }
    } else {
      v.k = Math.max(0, v.k - step);
      if (v.k <= 0) {
        v.state = 'out';
        p.ch.root.visible = false;
        return false;
      }
    }
    this.walkTo(p, v.k, still);
    return true;
  }

  /** Feet and head (with room for a bubble over it) of the ones who talk: what the shot must show whole. */
  private framePoints(bubble: number): Vector3[] {
    const pts: Vector3[] = [];
    for (const id of [this.host, 'player', this.visitor]) {
      const p = id ? this.people.get(id) : null;
      // (a neighbour not in the room yet is not framed: the shot widens to them as they come in)
      if (!p || (id === this.visitor && this.visit?.state === 'out')) continue;
      const a = p.anchor;
      // feet a body's half width round the spot (an arm is never cut by the edge), the head with room for a bubble
      for (const [dx, dz] of [[-0.2, 0], [0.2, 0], [0, -0.2], [0, 0.2]]) pts.push(new Vector3(a.x + dx, 0, a.z + dz));
      pts.push(new Vector3(a.x, headHeight(a) + bubble, a.z));
    }
    return pts;
  }

  /** A short animation once (a nod, a head shake, a wave); a seated person only nods or shakes from the seat. */
  act(id: string, anim: CharAction, t: number): void {
    const p = this.people.get(id);
    if (!p) return;
    if (p.rest === 'sit' && anim !== 'yes' && anim !== 'no') return;
    p.ch.setAction(anim);
    p.action = anim;
    p.oneShot = t + p.ch.actionDuration(anim);
  }

  /**
   * One frame: who speaks plays the talk loop (a seated speaker stays seated), the listeners look at the speaker (the
   * host and the player at each other otherwise, their faces kept towards the camera: gazePoint), the extras live.
   */
  update(dt: number, t: number, speaking: string | null, still: boolean, live = true): void {
    const shot = this.room.shot;
    const walking = this.stepVisit(dt, still);
    for (const p of this.people.values()) {
      // (a neighbour walking in walks, whatever else)
      const moving = walking && p.id === this.visitor;
      if (p.oneShot > t && !moving) continue;
      // (an extra's loop is its own life's; a seated speaker stays seated: the bubble says who talks)
      const extra = p.nextAt !== Infinity;
      const want: CharAction = moving ? 'walk' : extra ? p.action : speaking === p.id && p.rest !== 'sit' ? 'talk' : p.rest;
      if (want !== p.action || p.oneShot > 0) {
        p.oneShot = 0;
        p.action = want;
        p.ch.setAction(want);
      }
    }
    // gazes
    const host = this.people.get(this.host);
    const guest = this.people.get('player');
    const visitor = this.visitor ? this.people.get(this.visitor) : null;
    const speaker = speaking ? this.people.get(speaking) : null;
    const lookAtHead = (from: RoomPerson, to: RoomPerson) => {
      // (a neighbour walking in: where they are now)
      const at = to.id === this.visitor && this.visit && this.visit.state !== 'in' ? { ...to.anchor, x: to.ch.root.position.x, z: to.ch.root.position.z } : to.anchor;
      const g = gazePoint(at, shot);
      from.ch.lookAt(this.v.set(g[0], g[1], g[2]));
    };
    // (nobody looks at a neighbour who is not in the room; one walking in looks where they go)
    const heard = speaker && !(speaker.id === this.visitor && this.visit?.state === 'out') ? speaker : null;
    if (host && guest) {
      lookAtHead(host, heard && heard !== host ? heard : guest);
      lookAtHead(guest, heard && heard !== guest ? heard : host);
    }
    if (visitor && host && !walking) lookAtHead(visitor, heard && heard !== visitor ? heard : host);
    else if (visitor) visitor.ch.lookAt(null);
    // the extras: now and then a sip, a page, a look at somebody or round the room
    if (live) {
      const loops = EXTRA_LOOPS[this.room.id] ?? ['idle'];
      for (const e of this.extras) {
        if (t < e.nextAt) continue;
        e.nextAt = t + 2.5 + this.rng() * 4.5;
        const r = this.rng();
        if (e.rest !== 'sit') {
          const loop = loops[Math.floor(this.rng() * loops.length)] ?? 'idle';
          if (loop !== e.action) {
            e.action = loop;
            e.ch.setAction(loop);
          }
        }
        // where they look: the two who talk (curious), another extra, or nowhere in particular
        if (r < 0.35 && host) e.look = new Vector3(host.anchor.x, headHeight(host.anchor), host.anchor.z);
        else if (r < 0.55 && guest) e.look = new Vector3(guest.anchor.x, headHeight(guest.anchor), guest.anchor.z);
        else if (r < 0.75 && this.extras.length > 1) {
          const o = this.extras[(this.extras.indexOf(e) + 1) % this.extras.length].anchor;
          e.look = new Vector3(o.x, headHeight(o), o.z);
        } else e.look = null;
        // a look further round than the head turns goes nowhere (no owl heads)
        if (e.look) {
          const to = Math.atan2(e.look.z - e.anchor.z, e.look.x - e.anchor.x);
          if (Math.abs(angleDiff(e.anchor.heading, to)) > 1.3) e.look = null;
        }
        e.ch.lookAt(e.look);
      }
    }
    const k = still ? 0 : dt;
    for (const p of this.people.values()) p.ch.update(k, walking && p.id === this.visitor ? VISIT_SPEED : 0);
    this.pet?.update(k, 0);
    this.room.update(still ? 0 : dt);
  }

  setNight(k: number): void {
    this.room.setNight(k);
    for (const p of this.people.values()) p.ch.setNight(k);
  }

  /**
   * Where the camera stands for a stage of this size with these panels over it: the room's wide shot (or its tall one
   * when what the panels leave free is taller than wide), turned the same way, as close as keeps the ones who talk
   * whole with room for a bubble in the part the panels leave free (never further than the shot was made for, nor
   * much closer), centred there (a view offset, as in the town). `snap`: there at once (the fade's dark), else eased.
   */
  aim(viewW: number, viewH: number, inset: { right: number; bottom: number }, safe: SafeInsets, dt: number, snap: boolean): void {
    const freeW = Math.max(120, viewW - safe.left - Math.max(inset.right, safe.right));
    const freeH = Math.max(120, viewH - safe.top - Math.max(inset.bottom, safe.bottom));
    this.view = { w: viewW, h: viewH, freeRight: viewW - Math.max(inset.right, safe.right) };
    const aspect = freeW / freeH;
    const share = Math.max(0.25, freeH / Math.max(1, viewH));
    const base: RoomShot = aspect >= 1 ? this.room.shot : this.room.shotTall;
    const dx = base.position[0] - base.target[0];
    const dy = base.position[1] - base.target[1];
    const dz = base.position[2] - base.target[2];
    const baseDist = Math.hypot(dx, dy, dz);
    const yaw = Math.atan2(dz, dx);
    const pitch = Math.asin(dy / baseDist);
    // (a short strip over a panel keeps a little less room over the heads: the bubble may reach the counters)
    const pts = this.framePoints(freeH < SHORT_STRIP ? 0.3 : 0.42);
    const c = pts.reduce((s, p) => s.add(p), new Vector3()).multiplyScalar(1 / Math.max(1, pts.length));
    c.y = Math.max(0.42, c.y);
    const fit = fitDistance(
      pts.map((p) => ({ x: p.x, y: p.y, z: p.z })),
      { x: c.x, y: c.y, z: c.z },
      yaw,
      pitch,
      aspect,
      0.84 * share,
      base.fov,
    );
    // the room round them shows (the place at a glance: never closer than the shot was made for), the two never cut;
    // in a short strip over a panel (a phone) the shot comes in on the ones who talk, down to half its distance: the
    // wide shot there made them a thumb high
    const close = freeH < SHORT_STRIP ? Math.max(0.5, Math.min(1, (freeH - 100) / (SHORT_STRIP - 100))) : 1;
    const dist = Math.max(baseDist * close, fit);
    const b = basisOf(yaw, pitch);
    const goal = { x: c.x - b.fwd.x * dist, y: c.y - b.fwd.y * dist, z: c.z - b.fwd.z * dist, tx: c.x, ty: c.y, tz: c.z };
    const shift = insetShift(viewW, viewH, inset, safe);
    const s = this.cam;
    if (snap || !this.camSet || dt <= 0) {
      Object.assign(s, goal, { sx: shift.x, sy: shift.y, fov: base.fov });
      this.camSet = true;
    } else {
      const k = 1 - Math.exp(-dt * 6);
      s.x += (goal.x - s.x) * k;
      s.y += (goal.y - s.y) * k;
      s.z += (goal.z - s.z) * k;
      s.tx += (goal.tx - s.tx) * k;
      s.ty += (goal.ty - s.ty) * k;
      s.tz += (goal.tz - s.tz) * k;
      s.sx += (shift.x - s.sx) * k;
      s.sy += (shift.y - s.sy) * k;
      s.fov += (base.fov - s.fov) * k;
    }
    const cam = this.camera;
    cam.fov = s.fov;
    cam.aspect = viewW / Math.max(1, viewH);
    cam.position.set(s.x, s.y, s.z);
    cam.lookAt(this.w.set(s.tx, s.ty, s.tz));
    cam.setViewOffset(viewW, viewH, -s.sx, -s.sy, viewW, viewH);
    cam.updateProjectionMatrix();
  }

  /** The camera is still easing (a panel just opened). */
  get moving(): boolean {
    return !this.camSet;
  }

  /** The people (and the pet) go; the room stays in the engine's cache. */
  dispose(): void {
    for (const p of this.people.values()) {
      p.ch.root.removeFromParent();
      p.ch.dispose();
    }
    this.people.clear();
    if (this.pet) {
      this.pet.root.removeFromParent();
      this.pet.dispose();
      this.pet = null;
    }
    this.room.root.removeFromParent();
  }
}
