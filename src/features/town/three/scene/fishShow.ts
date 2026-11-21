// "Câu cá" in the world (docs/town.md §10): while the fishing panel is open the player walks out to the end of the
// pier, faces the water and holds the rod; a cast puts a float on the water, a bite makes it dip and splash, a catch
// pulls a fish out of the water (in its tier's colour) up to the player, an escape leaves a splash. Driven by the
// panel's own phases (FishPanel → ActivityHost → TownStageHandle.fishing → engine3d), never by itself.

import { Group, Mesh, MeshBasicMaterial, RingGeometry, type BufferGeometry, type Material } from 'three';
import type { TownWorld } from '../../../../data/townWorld';
import { Merge, shapes } from './merge';
import { WATER_LEVEL } from './terrain';

/** The panel's phases (activities/fish/PondScene.tsx PondPhase). */
export type FishPhase = 'idle' | 'waiting' | 'bite' | 'listening' | 'caught' | 'escaped';

/** Walking pace out along the pier and back (tiles a second). */
const PIER_PACE = 1.3;
/** A caught fish's leap from the float to the player's hands (s). */
const LEAP_SECONDS = 0.9;

/** The colour of a fish of each tier (the day colours of activities/fish/fishArt.ts TIER_ART). */
const TIER_COLOUR: Readonly<Record<string, { body: string; belly: string; fin: string; scale: number }>> = {
  thuong: { body: '#7f97ad', belly: '#dfe8ef', fin: '#5d7489', scale: 0.82 },
  hiem: { body: '#2f8fd8', belly: '#d5ecfb', fin: '#1f6aa6', scale: 1 },
  quy: { body: '#9a5ae0', belly: '#efe2fd', fin: '#7238b6', scale: 1.16 },
  'huyen-thoai': { body: '#f0a90c', belly: '#fff3cf', fin: '#c9780a', scale: 1.34 },
};

export interface FishPose {
  x: number;
  y: number;
  heading: number;
  /** Tiles a second (the legs' pace); 0 standing. */
  speed: number;
  /** 'walk' out or back, 'fish' at the end (rod in hand). */
  action: 'walk' | 'fish';
  /** Where the line runs to (the float), or null (it hangs from the rod). */
  line: { x: number; y: number; z: number } | null;
}

/** Where on the pier: from the activity's spot out to the end over the water, and the float a little further out. */
export function pierWalk(world: TownWorld): { from: { x: number; y: number }; to: { x: number; y: number }; float: { x: number; y: number }; heading: number } | null {
  const spot = world.activities?.fish;
  const pier = world.props.find((p) => p.kind === 'pier');
  if (!spot || !pier?.at) return null;
  const from = { x: spot.stand.x + 0.5, y: spot.stand.y + 0.5 };
  // the planks run from the shore along −x (props3d.ts 'pier'); the end is a step short of the last post
  const to = { x: pier.at.x - 0.78, y: pier.at.y };
  const heading = Math.atan2(spot.look.y - from.y, spot.look.x - from.x);
  const float = { x: to.x + Math.cos(heading) * 1.15, y: to.y + Math.sin(heading) * 1.15 + 0.08 };
  return { from, to, float, heading };
}

export class FishShow {
  readonly group = new Group();
  private readonly geos: BufferGeometry[] = [];
  private readonly mats: Material[] = [];
  private readonly way: NonNullable<ReturnType<typeof pierWalk>>;
  private phase: FishPhase = 'idle';
  private tier: string | null = null;
  private k = 0;
  private leaving = false;
  private t = 0;
  private phaseAt = 0;
  private readonly float: Group;
  private readonly rings: { m: Mesh; mat: MeshBasicMaterial; at: number }[] = [];
  private fish: Group | null = null;
  private fishFrom = 0;
  private readonly std: Material;

  constructor(way: NonNullable<ReturnType<typeof pierWalk>>, std: Material) {
    this.way = way;
    this.std = std;
    this.group.name = 'fishing';
    // the float: red over white
    const fm = new Merge();
    fm.add(shapes.sphere(0.06, 10, 8), '#e8574f', { y: 0.025, s: [1, 0.8, 1] }, { ao: false });
    fm.add(shapes.sphere(0.058, 10, 8), '#fafafa', { y: -0.02, s: [1, 0.8, 1] }, { ao: false });
    fm.add(shapes.cyl(0.008, 0.008, 0.08, 5), '#2b2f45', { y: 0.09 }, { ao: false });
    const fg = fm.build();
    this.float = new Group();
    if (fg) {
      this.geos.push(fg);
      this.float.add(new Mesh(fg, std));
    }
    this.float.visible = false;
    this.float.position.set(way.float.x, WATER_LEVEL, way.float.y);
    this.group.add(this.float);
    // two rings of ripples on the water
    const rg = new RingGeometry(0.7, 1, 28);
    rg.rotateX(-Math.PI / 2);
    this.geos.push(rg);
    for (let i = 0; i < 2; i++) {
      const mat = new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false });
      this.mats.push(mat);
      const m = new Mesh(rg, mat);
      m.renderOrder = 3;
      m.visible = false;
      this.group.add(m);
      this.rings.push({ m, mat, at: -10 });
    }
  }

  /** The phase shown now. */
  get current(): FishPhase {
    return this.phase;
  }

  /** The panel's phase now (and the tier of the fish on the line, if any). */
  set(phase: FishPhase, tier: string | null): void {
    this.leaving = false;
    if (phase === this.phase && tier === this.tier) return;
    const was = this.phase;
    this.phase = phase;
    this.tier = tier;
    this.phaseAt = this.t;
    if (phase === 'waiting' && was !== 'waiting') this.splash(0.5);
    if (phase === 'bite') this.splash(0.8);
    if (phase === 'caught') {
      this.splash(1);
      this.leap();
    }
    if (phase === 'escaped') this.splash(1);
  }

  /** The panel closed: back along the pier, then the show ends (done()). */
  leave(): void {
    this.leaving = true;
  }

  /** It is over: walked back to the spot after leave(). */
  done(): boolean {
    return this.leaving && this.k <= 0;
  }

  /** The player is out on the pier with the rod (the camera frames the water then). */
  out(): boolean {
    return this.k >= 1 && !this.leaving;
  }

  /** The point between the player and the float the camera looks at. */
  middle(): { x: number; y: number } {
    const p = this.pose();
    const f = this.way.float;
    const w = this.k * this.k;
    return { x: p.x + (f.x - p.x) * 0.5 * w, y: p.y + (f.y - p.y) * 0.5 * w };
  }

  pose(): FishPose {
    const { from, to } = this.way;
    const e = this.k * this.k * (3 - 2 * this.k);
    const x = from.x + (to.x - from.x) * e;
    const y = from.y + (to.y - from.y) * e;
    const moving = this.leaving ? this.k > 0 : this.k < 1;
    const heading = moving && this.leaving ? Math.atan2(from.y - to.y, from.x - to.x) : this.way.heading;
    const cast = !this.leaving && this.k >= 1 && (this.phase === 'waiting' || this.phase === 'bite' || this.phase === 'listening');
    const fp = this.float.position;
    return { x, y, heading, speed: moving ? PIER_PACE : 0, action: moving ? 'walk' : 'fish', line: cast ? { x: fp.x, y: fp.y + 0.06, z: fp.z } : null };
  }

  update(dt: number): void {
    this.t += dt;
    const dk = (dt * PIER_PACE) / Math.max(0.1, Math.hypot(this.way.to.x - this.way.from.x, this.way.to.y - this.way.from.y));
    this.k = this.leaving ? Math.max(0, this.k - dk) : Math.min(1, this.k + dk);
    // the float: out on the water while a fish is on its way or on the line
    const on = !this.leaving && this.k >= 1 && (this.phase === 'waiting' || this.phase === 'bite' || this.phase === 'listening');
    this.float.visible = on;
    if (on) {
      const since = this.t - this.phaseAt;
      let dip = Math.sin(this.t * 2.2) * 0.008;
      // a bite: it jerks under and bobs back, again and again; while the fish talks it stays pulled low
      if (this.phase === 'bite') dip = -0.05 - Math.abs(Math.sin(since * 9)) * 0.05;
      else if (this.phase === 'listening') dip = -0.035 + Math.sin(this.t * 5) * 0.012;
      this.float.position.y = WATER_LEVEL + dip;
      this.float.rotation.z = this.phase === 'bite' ? Math.sin(since * 13) * 0.25 : Math.sin(this.t * 1.3) * 0.05;
      if (this.phase === 'bite' && Math.floor(since / 0.7) !== Math.floor((since - dt) / 0.7)) this.splash(0.45);
    }
    for (const r of this.rings) {
      const age = this.t - r.at;
      const life = 1.1;
      r.m.visible = age >= 0 && age < life;
      if (!r.m.visible) continue;
      const s = 0.08 + age * 0.45;
      r.m.scale.set(s, 1, s);
      r.mat.opacity = 0.55 * (1 - age / life);
    }
    // the caught fish: a leap from the water up into the player's hands, then gone
    if (this.fish) {
      const k = (this.t - this.fishFrom) / LEAP_SECONDS;
      if (k >= 1.25) {
        this.group.remove(this.fish);
        this.fish = null;
      } else {
        const a = Math.min(1, k);
        const f = this.way.float;
        const to = this.way.to;
        const hx = to.x + Math.cos(this.way.heading) * 0.3;
        const hz = to.y + Math.sin(this.way.heading) * 0.3;
        this.fish.position.set(f.x + (hx - f.x) * a, WATER_LEVEL + 0.1 + Math.sin(a * Math.PI) * 0.9 + a * 0.75, f.y + (hz - f.y) * a);
        this.fish.rotation.set(0, -this.way.heading, Math.sin(this.t * 22) * 0.35 + (1 - a) * 1.2);
        const pop = Math.min(1, k * 4);
        const gone = k > 1 ? Math.max(0.01, 1 - (k - 1) * 4) : 1;
        this.fish.scale.setScalar(pop * gone);
      }
    }
  }

  private splash(strength: number): void {
    const free = this.rings.reduce((a, b) => (a.at < b.at ? a : b));
    free.at = this.t;
    free.m.position.set(this.way.float.x, WATER_LEVEL + 0.01, this.way.float.y);
    free.m.userData.strength = strength;
  }

  /** A fish in its tier's colours, out of the water at the float. */
  private leap(): void {
    const c = TIER_COLOUR[this.tier ?? 'thuong'] ?? TIER_COLOUR.thuong;
    const m = new Merge();
    m.add(shapes.sphere(0.1, 12, 10), c.body, { s: [1.9, 0.95, 0.7] }, { ao: false });
    m.add(shapes.sphere(0.08, 10, 8), c.belly, { y: -0.035, x: 0.02, s: [1.8, 0.55, 0.6] }, { ao: false });
    m.add(shapes.cone(0.09, 0.14, 4), c.fin, { x: -0.22, rz: Math.PI / 2, s: [1, 1, 0.3] }, { ao: false });
    m.add(shapes.cone(0.05, 0.08, 4), c.fin, { y: 0.09, rz: 0.3, s: [1.4, 1, 0.3] }, { ao: false });
    m.add(shapes.sphere(0.018, 6, 4), '#2b2f45', { x: 0.13, y: 0.025, z: 0.05 }, { ao: false });
    m.add(shapes.sphere(0.018, 6, 4), '#2b2f45', { x: 0.13, y: 0.025, z: -0.05 }, { ao: false });
    const g = m.build();
    if (!g) return;
    this.geos.push(g);
    if (this.fish) this.group.remove(this.fish);
    const fish = new Group();
    const mesh = new Mesh(g, this.std);
    mesh.scale.setScalar(c.scale * 0.9);
    fish.add(mesh);
    fish.scale.setScalar(0.01);
    this.fish = fish;
    this.fishFrom = this.t;
    this.group.add(fish);
  }

  dispose(): void {
    this.group.removeFromParent();
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
  }
}
