// The economy's properties (docs/town.md §31 "Kinh tế"), pinned so a later change that breaks one fails here. Not the
// exact numbers: every rate in the model is a guess until real play.
import { describe, expect, it } from 'vitest';
import { HIDEOUT_COST } from '../../data/city/hideout';
import { TOWN_DECORATIONS, TOWN_PLACES } from '../../data/town';
import { GARAGE } from '../../data/townGarage';
import { EGG_COST } from '../../data/townGame';
import { TOWN_GIFTS } from '../../data/townGifts';
import { gradeOdds, LEARNERS, perMinute, simulate, SOURCES, sourceShares, type Learner } from './economyModel';
import { jobLevelPay, JOBS_PAID_A_DAY } from './job';
import { OFFICE_UPGRADES, officeTakings, wordPay } from './office';
import { FINE_SHARE_MAX, fineFor } from './police';

const learner = (id: string): Learner => LEARNERS.find((l) => l.id === id)!;
const LOTS = TOWN_PLACES.filter((p) => p.cost > 0).map((p) => p.id);
const lotsDone = (b: Record<string, number>): number => Math.max(...LOTS.map((id) => b[id] ?? Infinity));

describe('the economy: what a learner can afford, and when', () => {
  it('the ten lots of the town take about as long as before the rebalance (9 days at 20 minutes, 15–16 at 10, 5 at 40)', () => {
    expect(lotsDone(simulate(learner('twenty')).boughtOn)).toBeGreaterThanOrEqual(7);
    expect(lotsDone(simulate(learner('twenty')).boughtOn)).toBeLessThanOrEqual(11);
    expect(lotsDone(simulate(learner('ten')).boughtOn)).toBeGreaterThanOrEqual(12);
    expect(lotsDone(simulate(learner('ten')).boughtOn)).toBeLessThanOrEqual(19);
    expect(lotsDone(simulate(learner('forty')).boughtOn)).toBeGreaterThanOrEqual(4);
    expect(lotsDone(simulate(learner('forty')).boughtOn)).toBeLessThanOrEqual(7);
  });

  it('the hideout is one to two weeks of a 20-minute learner once the town has what it needs', () => {
    const sim = simulate(learner('twenty'));
    const town = Math.max(lotsDone(sim.boughtOn), ...TOWN_DECORATIONS.map((d) => sim.boughtOn[d.id] ?? Infinity));
    expect(sim.boughtOn.hideout - town).toBeGreaterThanOrEqual(7);
    expect(sim.boughtOn.hideout - town).toBeLessThanOrEqual(16);
    // and in days of the city's income alone
    const daily = sourceShares(sim, 15, 30).total;
    expect(HIDEOUT_COST / daily).toBeGreaterThanOrEqual(7);
    expect(HIDEOUT_COST / daily).toBeLessThanOrEqual(14);
  });

  it('the office’s upgrades are a sink that does not run out quickly: the 20-minute learner has not bought them all in 60 days', () => {
    const sim = simulate(learner('twenty'));
    expect(OFFICE_UPGRADES.some((u) => sim.boughtOn[u.id] !== undefined)).toBe(true);
    expect(OFFICE_UPGRADES.every((u) => sim.boughtOn[u.id] !== undefined)).toBe(false);
    // each dearer than the one before, the dearest more than the hideout
    for (let i = 1; i < OFFICE_UPGRADES.length; i++) expect(OFFICE_UPGRADES[i].cost).toBeGreaterThan(OFFICE_UPGRADES[i - 1].cost);
    expect(OFFICE_UPGRADES[OFFICE_UPGRADES.length - 1].cost).toBeGreaterThan(HIDEOUT_COST);
  });
});

describe('the economy: no source dominates, listening pays', () => {
  it('no source is above 40% of the 20-minute learner’s day, in any stretch of the 60 days', () => {
    const sim = simulate(learner('twenty'));
    for (const [a, z] of [
      [1, 14],
      [15, 30],
      [31, 60],
    ]) {
      const sh = sourceShares(sim, a, z);
      for (const [id, v] of Object.entries(sh.by)) expect((v ?? 0) / sh.total, `${id} on days ${a}–${z}`).toBeLessThanOrEqual(0.4);
    }
  });

  it('a job pays more than the same minutes of quick chats, more for a better grade and for a harder job', () => {
    const minutes = SOURCES.find((s) => s.id === 'job')!.minutes;
    // clean beats quick chats with fresh lines; messy beats quick chats with lines already known
    for (const level of [1, 2, 3] as const) {
      expect(jobLevelPay('clean', level) / minutes).toBeGreaterThan(perMinute('chat', 0.8));
      expect(jobLevelPay('messy', level) / minutes).toBeGreaterThan(perMinute('chat', 0.8, { freshLines: 0 }));
      expect(jobLevelPay('clean', level)).toBeGreaterThan(jobLevelPay('messy', level));
      expect(jobLevelPay('messy', level)).toBeGreaterThan(jobLevelPay('broken', level));
    }
    expect(jobLevelPay('clean', 3)).toBeGreaterThan(jobLevelPay('clean', 2));
    expect(jobLevelPay('clean', 2)).toBeGreaterThan(jobLevelPay('clean', 1));
    // replays are not a living
    expect(JOBS_PAID_A_DAY).toBeLessThanOrEqual(3);
    // more understood, more expected
    const exp = (p: number) => {
      const o = gradeOdds(p);
      return o.clean * jobLevelPay('clean') + o.messy * jobLevelPay('messy') + o.broken * jobLevelPay('broken');
    };
    expect(exp(0.9)).toBeGreaterThan(exp(0.7));
  });

  it('every source pays more to a learner who understands more', () => {
    const s = { freshLines: 300, episodesLeft: 60, chaptersLeft: 15, cityLeft: 160, upgrades: [] };
    for (const src of SOURCES) expect(src.xu(0.9, s), src.id).toBeGreaterThan(src.xu(0.5, s));
  });

  it('the manager’s word: a misheard number loses part of the takings, never all; upgrades raise the takings', () => {
    expect(wordPay(10, false)).toBeLessThan(wordPay(10, true));
    expect(wordPay(10, false)).toBeGreaterThan(0);
    expect(officeTakings(OFFICE_UPGRADES.map((u) => u.id))).toBeGreaterThan(officeTakings([]));
  });
});

describe('the economy: fines and what is held', () => {
  it('a fine hurts but never empties: at most 40% of what the learner has, at least something when they have enough', () => {
    for (const heat of [0, 3, 6, 10])
      for (const balance of [0, 5, 17, 80, 200, 999, 5000])
        for (const answered of [true, false]) {
          const f = fineFor(heat, answered, balance);
          expect(f).toBeLessThanOrEqual(balance * FINE_SHARE_MAX);
          if (balance > 0) expect(f).toBeLessThan(balance);
          if (balance >= 300) expect(f).toBeGreaterThanOrEqual(30);
        }
    // the 10-minute learner, fined every few days in the model, never goes to zero
    for (const l of LEARNERS) {
      const sim = simulate(l);
      for (const d of sim.days) if (d.fine > 0) expect(d.balance + d.fine, `${l.id} day ${d.day}`).toBeGreaterThan(d.fine);
    }
  });

  it('nothing already bought costs more than it did (a price raised would lower what a learner holds)', () => {
    // the prices on 2026-11-27, before the rebalance: a price may go down, never up
    const before: Record<string, number> = {
      home: 20, shop: 30, office: 40, school: 50, station: 60, clinic: 70, cinema: 80, phone: 90, park: 100, board: 110,
      lamps1: 10, flowers: 8, benches: 12, blossom: 15, lamps2: 15, lights: 25, lilies: 20, stall: 30, fountain: 40, balloons: 12, flags: 18, cat: 35,
      'garage-roadbike': 60, 'garage-vespa': 150, 'garage-whitehorse': 250, 'garage-motorbike': 400, 'garage-convertible': 600, 'garage-supercar': 1000,
    };
    for (const p of TOWN_PLACES) if (before[p.id] !== undefined) expect(p.cost, p.id).toBeLessThanOrEqual(before[p.id]);
    for (const d of TOWN_DECORATIONS) if (before[d.id] !== undefined) expect(d.cost, d.id).toBeLessThanOrEqual(before[d.id]);
    for (const g of GARAGE) if (before[g.id] !== undefined) expect(g.cost, g.id).toBeLessThanOrEqual(before[g.id]);
    expect(HIDEOUT_COST).toBeLessThanOrEqual(800);
    expect(EGG_COST).toBeLessThanOrEqual(40);
    for (const g of TOWN_GIFTS) expect(g.cost, g.id).toBeLessThanOrEqual(g.id === 'ring' ? 150 : g.id === 'bouquet' ? 30 : 18);
  });
});
