import { describe, expect, it } from 'vitest';
import type { CardId, ReviewEntry, ReviewKind } from '../review/types';
import { DAY } from '../srs';
import { applyHarvest, FARM_DAILY_CARDS, FARM_GOLDEN_XU, FARM_LOOK_SLOTS, FARM_XU_PER_CARD, farmFieldLook, farmHarvest, farmPlots, fieldLook, WILT_DAYS } from './farm';
import { dailyCount, dailySum, earnedTotal, emptyTownProgress, mergeTownProgress } from './progress';

const DEV = 'd-aaaa0001';
const OTHER = 'd-bbbb0002';
const NOW = new Date(2026, 10, 20, 15).getTime();
const TODAY = '2026-11-20';
const HOUR = 3_600_000;

function entry(kind: ReviewKind, ref: string, availableAt: number, interval = 3, last?: number): ReviewEntry {
  const id = `${kind}:${ref}` as CardId;
  return {
    id,
    kind,
    ref,
    state: { id, due: availableAt, interval, ease: 2.5, reps: 2, lapses: 0 },
    ...(last !== undefined ? { last } : {}),
    availableAt,
    touchedToday: false,
  };
}

describe('farmPlots: the review schedule as a field', () => {
  it('ripe = due now, wilting = due for more than WILT_DAYS days, growing = due later today or tomorrow, seedling = created today', () => {
    const entries = [
      entry('dict', 's001', NOW - HOUR),
      entry('dict', 's002', NOW - 2 * DAY),
      entry('dict', 's003', NOW - (WILT_DAYS + 1) * DAY),
      entry('pair', 'can-cant', NOW - 10),
      entry('dict', 's004', NOW + 2 * HOUR, 4, NOW - 2 * DAY), // last seen two days ago, due in two hours
      entry('chunk', 'c001', NOW + DAY),
      entry('dict', 's005', NOW + 3 * DAY), // resting
      entry('talk', 'cafe-1-03', NOW + 20 * HOUR, 0),
    ];
    const store = { cards: { 'talk:cafe-1-03': { ...entries[7].state, last: NOW - HOUR, born: NOW - HOUR } } };
    const f = farmPlots({ entries, store }, NOW);
    expect(f.plots.map((p) => [p.id, p.count])).toEqual([
      ['dict-wilting', 1],
      ['dict-ripe', 2],
      ['pair-ripe', 1],
      ['dict-growing', 1],
      ['chunk-growing', 1],
      ['talk-seedling', 1],
    ]);
    expect(f).toMatchObject({ ripe: 3, wilting: 1, growing: 2, seedlings: 1, resting: 1 });
    const by = Object.fromEntries(f.plots.map((p) => [p.id, p]));
    expect(by['dict-ripe']).toMatchObject({ label: 'Câu', growth: 1, readyAt: null, cards: ['dict:s002', 'dict:s001'] });
    expect(by['dict-growing'].growth).toBeCloseTo(48 / 50, 5);
    expect(by['dict-growing'].readyAt).toBe(NOW + 2 * HOUR);
    expect(by['talk-seedling'].readyAt).toBe(NOW + 20 * HOUR);
    for (const p of f.plots) {
      expect(p.growth).toBeGreaterThanOrEqual(0);
      expect(p.growth).toBeLessThanOrEqual(1);
    }
  });

  it('an empty review: an empty field', () => {
    expect(farmPlots({ entries: [] }, NOW)).toEqual({ plots: [], ripe: 0, wilting: 0, growing: 0, seedlings: 0, resting: 0 });
  });
});

describe('the harvest: pay for the reviews of today', () => {
  it('pays FARM_XU_PER_CARD per card reviewed today, once, and the golden crop when today is done', () => {
    const p0 = emptyTownProgress();
    expect(farmHarvest(p0, { reviewedToday: 0, dueToday: 4 }, NOW)).toMatchObject({ payable: 0, xu: 0, cleared: false, goldenXu: 0 });
    const half = applyHarvest(p0, { reviewedToday: 3, dueToday: 4 }, NOW, DEV);
    expect(half).toMatchObject({ cards: 3, xu: 3 * FARM_XU_PER_CARD, golden: false });
    expect(dailyCount(half.progress, TODAY, DEV).harvest).toBe(3);
    // claimed again with nothing new: nothing
    expect(applyHarvest(half.progress, { reviewedToday: 3, dueToday: 4 }, NOW + 1, DEV).progress).toBe(half.progress);
    const done = applyHarvest(half.progress, { reviewedToday: 7, dueToday: 0 }, NOW + 2, DEV);
    expect(done).toMatchObject({ cards: 4, xu: 4 + FARM_GOLDEN_XU, golden: true });
    expect(done.progress.farmDays).toEqual([TODAY]);
    expect(earnedTotal(done.progress)).toBe(7 + FARM_GOLDEN_XU);
    // the golden crop is paid once a day
    expect(farmHarvest(done.progress, { reviewedToday: 9, dueToday: 0 }, NOW + 3)).toMatchObject({ payable: 2, goldenPaid: true, goldenXu: 0 });
    // nothing reviewed: today is not "done", even with nothing due
    expect(farmHarvest(p0, { reviewedToday: 0, dueToday: 0 }, NOW).cleared).toBe(false);
  });

  it(`pays at most ${FARM_DAILY_CARDS} cards a day over every browser, and a merge never pays a card twice`, () => {
    const laptop = applyHarvest(emptyTownProgress(), { reviewedToday: 15, dueToday: 5 }, NOW, DEV);
    // the phone sees the same reviews after a sync: they are paid already
    const synced = mergeTownProgress(emptyTownProgress(), laptop.progress);
    const phone = applyHarvest(synced, { reviewedToday: 30, dueToday: 0 }, NOW + 1, OTHER);
    expect(phone.cards).toBe(FARM_DAILY_CARDS - 15);
    expect(dailySum(phone.progress, TODAY, 'harvest')).toBe(FARM_DAILY_CARDS);
    expect(applyHarvest(phone.progress, { reviewedToday: 40, dueToday: 0 }, NOW + 2, DEV)).toMatchObject({ cards: 0, xu: 0, golden: false });
    // the next day starts again
    expect(farmHarvest(phone.progress, { reviewedToday: 5, dueToday: 3 }, NOW + DAY).payable).toBe(5);
  });

  it('a bad browser id is paid nothing', () => {
    const r = applyHarvest(emptyTownProgress(), { reviewedToday: 3, dueToday: 2 }, NOW, 'constructor');
    expect(r).toMatchObject({ cards: 0, xu: 0 });
    expect(earnedTotal(r.progress)).toBe(0);
  });
});

describe('farmFieldLook: the field in the world follows the same data as the panel', () => {
  const look = (wilting: number, ripe: number, growing: number, seedlings: number, slots = 10) => fieldLook({ wilting, ripe, growing, seedlings }, slots);

  it('nothing due: no ripe crop in the world (QA 2026-11-21: ripe crops shown while the panel had none)', () => {
    const entries = [entry('dict', 's001', NOW + 2 * HOUR, 4, NOW - 2 * DAY), entry('dict', 's002', NOW + 3 * DAY)];
    const l = farmFieldLook({ entries }, NOW);
    expect(l.ripe).toBe(false);
    expect(l.slots).toHaveLength(FARM_LOOK_SLOTS);
    expect(l.slots.filter((x) => x === 'ripe' || x === 'wilting')).toEqual([]);
    expect(l.counts).toMatchObject({ ripe: 0, wilting: 0, growing: 1, seedling: 0 });
    // an empty review: bare soil
    expect(farmFieldLook({ entries: [] }, NOW).slots.every((x) => x === 'empty')).toBe(true);
  });

  it('agrees with farmPlots: the same counts, and a ripe crop exactly when the panel has one', () => {
    const entries = [entry('dict', 's001', NOW - HOUR), entry('dict', 's003', NOW - (WILT_DAYS + 1) * DAY), entry('chunk', 'c001', NOW + DAY)];
    const f = farmPlots({ entries }, NOW);
    const l = farmFieldLook({ entries }, NOW, 8);
    expect(l.counts).toEqual({ wilting: f.wilting, ripe: f.ripe, growing: f.growing, seedling: f.seedlings, empty: 5 });
    expect(l.ripe).toBe(f.ripe + f.wilting > 0);
    expect(l.slots).toEqual(['wilting', 'ripe', 'growing', 'empty', 'empty', 'empty', 'empty', 'empty']);
  });

  it('more cards than spots: shared in proportion, every stage with a card keeps a spot', () => {
    const l = look(0, 1, 100, 0, 10);
    expect(l.slots).toHaveLength(10);
    expect(l.slots.filter((x) => x === 'ripe')).toHaveLength(1); // one ripe card still shows
    expect(l.slots.filter((x) => x === 'growing')).toHaveLength(9);
    const m = look(30, 30, 30, 10, 10);
    expect(m.slots.filter((x) => x === 'seedling').length).toBeGreaterThanOrEqual(1);
    expect(m.slots.includes('empty')).toBe(false);
    // fewer spots than stages: the harvestable first
    expect(look(5, 5, 5, 5, 2).slots).toEqual(['wilting', 'ripe']);
    expect(look(5, 5, 5, 5, 0).slots).toEqual([]);
  });

  it('always exactly `slots` spots, never more crops of a stage than its cards, junk in = calm out', () => {
    for (const [w, r, g, s, n] of [[0, 0, 0, 0, 5], [1, 2, 3, 4, 3], [7, 0, 13, 2, 9], [100, 50, 1, 0, 48], [3, 3, 3, 3, 13]]) {
      const l = look(w, r, g, s, n);
      expect(l.slots).toHaveLength(n);
      const c = (k: string) => l.slots.filter((x) => x === k).length;
      expect(c('wilting')).toBeLessThanOrEqual(w);
      expect(c('ripe')).toBeLessThanOrEqual(r);
      expect(c('growing')).toBeLessThanOrEqual(g);
      expect(c('seedling')).toBeLessThanOrEqual(s);
    }
    expect(look(Number.NaN, -3, 2, 0, Number.NaN).slots).toEqual([]);
    expect(fieldLook({ wilting: 0, ripe: Number.NaN, growing: 2, seedlings: 0 }, 3)).toMatchObject({ slots: ['growing', 'growing', 'empty'], ripe: false });
  });
});
