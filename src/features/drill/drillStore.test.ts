import { describe, expect, it } from 'vitest';
import { DAY, MAX_INTERVAL_DAYS, MIN_EASE, newCard } from '../../core/srs';
import { localDay } from '../../core/stats';
import { KEYS, STORAGE_PREFIX } from '../../core/storage';
import { applyGrade, emptyDrillStore, gradeBase, isDrillStorageKey, parseDrillStore, rollDaily } from './drillStore';

const NOW = new Date(2026, 10, 5, 10, 0, 0).getTime(); // local time
const TODAY = localDay(NOW);

describe('parseDrillStore', () => {
  it('returns an empty valid store for missing or non-object data', () => {
    for (const raw of [null, undefined, 42, 'oops', true, [], [1, 2]]) {
      const s = parseDrillStore(raw, NOW);
      expect(s.cards).toEqual({});
      expect(s.newPerDay).toBe(10);
      expect(s.daily).toEqual({ day: TODAY, newIntroduced: 0, extraNew: 0, reviews: 0, studiedIds: [] });
    }
  });

  it('drops corrupt cards and clamps bad numbers', () => {
    const s = parseDrillStore(
      {
        newPerDay: 7,
        cards: {
          ok: { due: NOW + DAY, interval: 3, ease: 2.2, reps: 2, lapses: 1, lastGrade: 'good' },
          junk: 'x',
          nul: null,
          arr: [1, 2],
          bad: { due: 'soon', interval: -4, ease: 99, reps: 2.7, lapses: -1, lastGrade: 'perfect' },
          huge: { due: NOW, interval: 1e12, ease: 0.1 },
        },
      },
      NOW,
    );
    expect(Object.keys(s.cards).sort()).toEqual(['bad', 'huge', 'ok']);
    expect(s.cards.ok).toEqual({ id: 'ok', due: NOW + DAY, interval: 3, ease: 2.2, reps: 2, lapses: 1, lastGrade: 'good' });
    expect(s.cards.bad).toEqual({ id: 'bad', due: NOW, interval: 0, ease: 5, reps: 2, lapses: 0 });
    expect(s.cards.huge.interval).toBe(MAX_INTERVAL_DAYS);
    expect(s.cards.huge.ease).toBe(MIN_EASE);
    expect(s.newPerDay).toBe(10); // 7 is not an allowed option
  });

  it('cards stored as an array are ignored', () => {
    expect(parseDrillStore({ cards: [{ due: NOW }] }, NOW).cards).toEqual({});
  });

  it('keeps today counters but resets them on a new local day', () => {
    const raw = {
      newPerDay: 20,
      cards: {},
      daily: { day: TODAY, newIntroduced: 4, extraNew: 5, reviews: 9, studiedIds: ['a', 'a', 3, 'b'] },
    };
    const same = parseDrillStore(raw, NOW);
    expect(same.newPerDay).toBe(20);
    expect(same.daily).toEqual({ day: TODAY, newIntroduced: 4, extraNew: 5, reviews: 9, studiedIds: ['a', 'b'] });

    const tomorrow = parseDrillStore(raw, NOW + DAY);
    expect(tomorrow.daily.day).toBe(localDay(NOW + DAY));
    expect(tomorrow.daily.newIntroduced).toBe(0);
    expect(tomorrow.daily.extraNew).toBe(0);
  });

  it('survives a corrupt daily block', () => {
    const s = parseDrillStore({ daily: { day: TODAY, newIntroduced: 'x', studiedIds: 'nope' } }, NOW);
    expect(s.daily).toEqual({ day: TODAY, newIntroduced: 0, extraNew: 0, reviews: 0, studiedIds: [] });
  });
});

describe('rollDaily / applyGrade', () => {
  it('rollDaily returns the same object on the same day and resets after local midnight', () => {
    const s = emptyDrillStore(NOW);
    expect(rollDaily(s, NOW + 1000)).toBe(s);
    const late = new Date(2026, 10, 5, 23, 59, 0).getTime();
    const afterMidnight = new Date(2026, 10, 6, 0, 1, 0).getTime();
    const used = applyGrade(emptyDrillStore(late), 'c1', newCard('c1', late), true, late);
    expect(used.daily.newIntroduced).toBe(1);
    const next = rollDaily(used, afterMidnight);
    expect(next.daily.newIntroduced).toBe(0);
    expect(next.daily.day).toBe(localDay(afterMidnight));
    expect(next.cards.c1).toBeDefined();
  });

  it('applyGrade counts a new card once and studied ids distinctly', () => {
    let s = emptyDrillStore(NOW);
    s = applyGrade(s, 'c1', newCard('c1', NOW), true, NOW);
    s = applyGrade(s, 'c1', newCard('c1', NOW), false, NOW);
    expect(s.daily.newIntroduced).toBe(1);
    expect(s.daily.reviews).toBe(2);
    expect(s.daily.studiedIds).toEqual(['c1']);
  });
});

describe('isDrillStorageKey', () => {
  it('matches the drill key and a full clear, nothing else', () => {
    expect(isDrillStorageKey(STORAGE_PREFIX + KEYS.drill)).toBe(true);
    expect(isDrillStorageKey(null)).toBe(true);
    expect(isDrillStorageKey(KEYS.drill)).toBe(false);
    expect(isDrillStorageKey(STORAGE_PREFIX + 'other')).toBe(false);
    expect(isDrillStorageKey('')).toBe(false);
  });
});

describe('gradeBase', () => {
  it('grades on top of the freshly read store, not stale memory', () => {
    const memory = emptyDrillStore(NOW);
    const fresh = applyGrade(emptyDrillStore(NOW), 'other-tab', newCard('other-tab', NOW), true, NOW);
    let reads = 0;
    const base = gradeBase(memory, true, () => (reads++, fresh), NOW);
    expect(reads).toBe(1);
    expect(base.cards['other-tab']).toBeDefined();
    expect(base.daily.studiedIds).toEqual(['other-tab']);
  });

  it('keeps memory when the last save failed (storage is behind)', () => {
    const memory = applyGrade(emptyDrillStore(NOW), 'mine', newCard('mine', NOW), true, NOW);
    let reads = 0;
    const base = gradeBase(memory, false, () => (reads++, emptyDrillStore(NOW)), NOW);
    expect(reads).toBe(0);
    expect(base).toBe(memory);
  });

  it('rolls the day over on the chosen base', () => {
    const yesterday = NOW - DAY;
    const stale = applyGrade(emptyDrillStore(yesterday), 'a', newCard('a', yesterday), true, yesterday);
    const base = gradeBase(stale, true, () => stale, NOW);
    expect(base.daily.day).toBe(TODAY);
    expect(base.daily.studiedIds).toEqual([]);
    expect(base.cards.a).toBeDefined();
  });
});
