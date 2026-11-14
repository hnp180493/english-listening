// Small particle system of the town: confetti, coins that fly to a point of the screen, sparkles and petals.
// Positions are CSS pixels of the stage. Pure: `update(dt)` moves them, the renderer only reads the list.

import type { Pt } from './iso';

export type ParticleKind = 'confetti' | 'coin' | 'spark' | 'petal' | 'dust';

export interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Seconds lived, and seconds it lives. Negative age = waiting to appear. */
  age: number;
  life: number;
  rot: number;
  spin: number;
  size: number;
  /** Index into the renderer's colours for this kind. */
  tint: number;
  /** Coins: where it started, the top of its arc and where it lands. */
  from?: Pt;
  via?: Pt;
  to?: Pt;
}

const GRAVITY = 520;
/** Never more than this many at once: a burst on top of a burst drops the oldest. */
export const MAX_PARTICLES = 260;

export class Particles {
  list: Particle[] = [];
  private readonly rng: () => number;

  constructor(rng: () => number = Math.random) {
    this.rng = rng;
  }

  private add(p: Particle): void {
    this.list.push(p);
    if (this.list.length > MAX_PARTICLES) this.list.splice(0, this.list.length - MAX_PARTICLES);
  }

  /** Paper bits thrown up from a point, falling back down. */
  confetti(at: Pt, count = 46): void {
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (this.rng() - 0.5) * 2.2;
      const v = 160 + this.rng() * 260;
      this.add({
        kind: 'confetti',
        x: at.x,
        y: at.y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        age: -this.rng() * 0.12,
        life: 1.3 + this.rng() * 0.9,
        rot: this.rng() * Math.PI * 2,
        spin: (this.rng() - 0.5) * 14,
        size: 4 + this.rng() * 4,
        tint: Math.floor(this.rng() * 6),
      });
    }
  }

  /** Coins pop out of a point one after another and fly along an arc to `to` (e.g. the xu counter). */
  coins(from: Pt, to: Pt, count = 6): void {
    for (let i = 0; i < count; i++) {
      const start = { x: from.x + (this.rng() - 0.5) * 16, y: from.y + (this.rng() - 0.5) * 8 };
      const via = { x: start.x + (this.rng() - 0.5) * 90, y: Math.min(start.y, to.y) - 50 - this.rng() * 50 };
      this.add({
        kind: 'coin',
        x: start.x,
        y: start.y,
        vx: 0,
        vy: 0,
        age: -i * 0.07,
        life: 0.75 + this.rng() * 0.15,
        rot: 0,
        spin: 8 + this.rng() * 6,
        size: 7,
        tint: 0,
        from: start,
        via,
        to: { ...to },
      });
    }
  }

  /** Little stars drifting out of a point. */
  sparks(at: Pt, count = 12): void {
    for (let i = 0; i < count; i++) {
      const a = this.rng() * Math.PI * 2;
      const v = 30 + this.rng() * 80;
      this.add({
        kind: 'spark',
        x: at.x,
        y: at.y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 30,
        age: -this.rng() * 0.15,
        life: 0.6 + this.rng() * 0.5,
        rot: this.rng() * Math.PI,
        spin: (this.rng() - 0.5) * 4,
        size: 3 + this.rng() * 3,
        tint: Math.floor(this.rng() * 3),
      });
    }
  }

  /** Puffs of dust rolling out along the ground from a point (something is being built). `spread` = half its width. */
  dust(at: Pt, count = 12, spread = 30): void {
    for (let i = 0; i < count; i++) {
      const side = this.rng() - 0.5;
      this.add({
        kind: 'dust',
        x: at.x + side * spread * 2,
        y: at.y + (this.rng() - 0.5) * spread * 0.5,
        vx: side * 90,
        vy: -18 - this.rng() * 40,
        age: -this.rng() * 0.22,
        life: 0.55 + this.rng() * 0.45,
        rot: 0,
        spin: 0,
        size: 5 + this.rng() * 8,
        tint: Math.floor(this.rng() * 2),
      });
    }
  }

  /** One petal let go by a blossom tree. */
  petal(at: Pt): void {
    this.add({
      kind: 'petal',
      x: at.x,
      y: at.y,
      vx: 8 + this.rng() * 14,
      vy: 10 + this.rng() * 8,
      age: 0,
      life: 2.4 + this.rng() * 1.4,
      rot: this.rng() * Math.PI * 2,
      spin: (this.rng() - 0.5) * 3,
      size: 2.5 + this.rng() * 1.5,
      tint: Math.floor(this.rng() * 2),
    });
  }

  update(dt: number): void {
    if (this.list.length === 0) return;
    for (const p of this.list) {
      p.age += dt;
      if (p.age < 0) continue;
      p.rot += p.spin * dt;
      if (p.kind === 'coin' && p.from && p.via && p.to) {
        // ease in: slow out of the pocket, fast into the counter
        const t = Math.min(1, p.age / p.life);
        const e = t * t * (3 - 2 * t);
        const u = 1 - e;
        p.x = u * u * p.from.x + 2 * u * e * p.via.x + e * e * p.to.x;
        p.y = u * u * p.from.y + 2 * u * e * p.via.y + e * e * p.to.y;
        continue;
      }
      if (p.kind === 'confetti') {
        p.vy += GRAVITY * dt;
        p.vx *= 1 - Math.min(1, 1.6 * dt);
        p.vy *= 1 - Math.min(1, 0.9 * dt);
      } else if (p.kind === 'spark') {
        p.vx *= 1 - Math.min(1, 2.2 * dt);
        p.vy *= 1 - Math.min(1, 2.2 * dt);
      } else if (p.kind === 'dust') {
        p.vx *= 1 - Math.min(1, 2.4 * dt);
        p.vy *= 1 - Math.min(1, 1.6 * dt);
        p.size += 14 * dt;
      } else if (p.kind === 'petal') {
        p.vx += Math.sin(p.age * 3 + p.rot) * 16 * dt;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.list = this.list.filter((p) => p.age < p.life);
  }

  clear(): void {
    this.list = [];
  }
}

/** 0..1 opacity of a particle at its age: quick fade in, fade out over the last third. */
export function particleAlpha(p: Particle): number {
  if (p.age < 0) return 0;
  const t = p.age / p.life;
  if (p.kind === 'coin') return t < 0.9 ? 1 : Math.max(0, (1 - t) / 0.1);
  if (p.kind === 'dust') return 0.7 * (1 - t);
  return t < 0.66 ? 1 : Math.max(0, (1 - t) / 0.34);
}
