import { describe, expect, it } from 'vitest';
import { MAX_PARTICLES, particleAlpha, Particles } from './particles';

function seeded(seed = 5): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('Particles', () => {
  it('confetti goes up, comes down and is gone', () => {
    const p = new Particles(seeded());
    p.confetti({ x: 100, y: 100 }, 30);
    expect(p.list).toHaveLength(30);
    for (let i = 0; i < 18; i++) p.update(1 / 60);
    expect(Math.min(...p.list.map((q) => q.y))).toBeLessThan(100);
    for (let i = 0; i < 60 * 4; i++) p.update(1 / 60);
    expect(p.list).toHaveLength(0);
  });

  it('coins start one after another and land on the target', () => {
    const p = new Particles(seeded());
    const to = { x: 400, y: 20 };
    p.coins({ x: 100, y: 300 }, to, 5);
    expect(p.list.every((c) => c.kind === 'coin')).toBe(true);
    // not all visible at once
    p.update(0.05);
    expect(p.list.filter((c) => c.age >= 0).length).toBeLessThan(5);
    // just before each coin's end it is at the target
    let landed = 0;
    for (let i = 0; i < 400; i++) {
      p.update(1 / 120);
      for (const c of p.list) {
        if (c.age / c.life > 0.99) {
          expect(Math.hypot(c.x - to.x, c.y - to.y)).toBeLessThan(6);
          landed++;
        }
      }
    }
    expect(landed).toBeGreaterThan(0);
    expect(p.list).toHaveLength(0);
  });

  it('never keeps more than the cap', () => {
    const p = new Particles(seeded());
    for (let i = 0; i < 10; i++) p.confetti({ x: 0, y: 0 }, 60);
    expect(p.list.length).toBe(MAX_PARTICLES);
    p.clear();
    expect(p.list).toHaveLength(0);
  });

  it('sparks and petals drift and fade', () => {
    const p = new Particles(seeded());
    p.sparks({ x: 50, y: 50 }, 8);
    p.petal({ x: 10, y: 10 });
    expect(p.list.map((q) => q.kind)).toContain('petal');
    p.update(0.5);
    const petal = p.list.find((q) => q.kind === 'petal')!;
    expect(petal.y).toBeGreaterThan(10);
    for (let i = 0; i < 60 * 5; i++) p.update(1 / 60);
    expect(p.list).toHaveLength(0);
  });

  it('alpha: nothing before it starts, full in the middle, fading at the end', () => {
    const base = { kind: 'confetti' as const, x: 0, y: 0, vx: 0, vy: 0, life: 1, rot: 0, spin: 0, size: 4, tint: 0 };
    expect(particleAlpha({ ...base, age: -0.1 })).toBe(0);
    expect(particleAlpha({ ...base, age: 0.3 })).toBe(1);
    expect(particleAlpha({ ...base, age: 0.9 })).toBeGreaterThan(0);
    expect(particleAlpha({ ...base, age: 0.9 })).toBeLessThan(1);
    expect(particleAlpha({ ...base, kind: 'coin', age: 0.85 })).toBe(1);
  });
});
