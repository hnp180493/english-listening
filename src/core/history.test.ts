import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildBase,
  countLearnedWords,
  dayOf,
  emptyHistory,
  gradeTotals,
  historyDays,
  lessonsPassedByWeek,
  mergeHistoryStores,
  parseHistory,
  practiceDays,
  practiceTotals,
  retentionByWeek,
  reviewRetention,
  weeklyModuleAccuracy,
  wordsLearnedCumulative,
  wordsLearnedTotal,
  type HistoryStore,
  type WeekRef,
} from './history';
import { STORAGE_PREFIX } from './storage';
import { mergeProgressHistory, mergeValue } from './syncMerge';

const P = STORAGE_PREFIX;
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
const NOW = at(2026, 11, 6, 20);
const att = (ts: number, module = 'dictation', correct = true, itemId = 's' + ts) => ({ at: ts, module, itemId, correct, seen: [], missed: [] });
const week = (key: string, end: string): WeekRef => ({ key, end, label: key.slice(8) + '/' + key.slice(5, 7) });

function stubWindow() {
  const map = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    },
    addEventListener: () => {},
  });
  return map;
}

async function fresh() {
  vi.resetModules();
  const history = await import('./history');
  const stats = await import('./stats');
  return { history, stats };
}

describe('backfill', () => {
  it('counts attempts before `until` per day and module, deduped, plus learned words', () => {
    const base = buildBase(
      [att(at(2026, 11, 1)), att(at(2026, 11, 1), 'dictation', false, 'x'), att(at(2026, 11, 1)), att(at(2026, 11, 2), 'pairs'), att(NOW), { at: 'x' }, att(at(2026, 11, 3), 'nope')],
      {
        cards: {
          'word:a~a': { reps: 1, interval: 1, lapses: 0 },
          'word:b~b': { reps: 0, interval: 0, lapses: 1 }, // graduated once, then forgotten
          'word:c~c': { reps: 0, interval: 0, lapses: 0 },
          'dict:s1': { reps: 3, interval: 10, lapses: 0 },
        },
      },
      NOW,
    );
    expect(base.until).toBe(NOW);
    expect(base.days['2026-11-01'].mod).toEqual({ dictation: { n: 2, ok: 1 } });
    expect(base.days['2026-11-02'].mod).toEqual({ pairs: { n: 1, ok: 1 } });
    expect(base.days['2026-11-06']).toBeUndefined(); // at === until: counted live, not here
    expect(base.wordsLearned).toBe(2);
    expect(countLearnedWords(null)).toBe(0);
    expect(buildBase('junk', 'junk', NOW)).toEqual({ until: NOW, days: {}, wordsLearned: 0 });
  });
});

describe('merge: no double counting', () => {
  const dev = (days: HistoryStore['devices'][string]): HistoryStore['devices'][string] => days;
  const A: HistoryStore = {
    version: 1,
    devices: { 'd-a': dev({ '2026-11-05': { mod: { dictation: { n: 5, ok: 4 } }, grades: { again: 1, hard: 0, good: 3, easy: 0 } } }) },
    base: { until: 100, days: { '2026-11-01': { mod: { dictation: { n: 10, ok: 7 } } } }, wordsLearned: 4 },
  };
  // B synced A's file earlier (A had only 3 attempts that day), then did its own practice.
  const B: HistoryStore = {
    version: 1,
    devices: {
      'd-a': dev({ '2026-11-05': { mod: { dictation: { n: 3, ok: 3 } } } }),
      'd-b': dev({ '2026-11-05': { mod: { pairs: { n: 2, ok: 1 } }, ret: { n: 2, again: 1 }, words: 1 } }),
    },
    base: { until: 100, days: { '2026-11-01': { mod: { dictation: { n: 10, ok: 7 } } } }, wordsLearned: 4 },
  };

  it('keeps one bucket per device and takes the max per device/day/field', () => {
    const m = mergeHistoryStores(A, B);
    expect(m.devices['d-a']['2026-11-05'].mod?.dictation).toEqual({ n: 5, ok: 4 });
    const days = historyDays(m);
    expect(practiceTotals(days)).toMatchObject({ n: 17, ok: 12, activeDays: 2 }); // 10 backfilled + 5 (A) + 2 (B)
    expect(reviewRetention(days)).toEqual({ n: 2, again: 1, pct: 50 });
    expect(wordsLearnedTotal(m)).toBe(5);
  });

  it('is idempotent, commutative and associative', () => {
    const C: HistoryStore = { version: 1, devices: { 'd-c': { '2026-11-06': { mod: { media: { n: 1, ok: 0 } } } } }, base: null };
    const ab = mergeHistoryStores(A, B);
    expect(mergeHistoryStores(ab, ab)).toEqual(ab);
    expect(mergeHistoryStores(ab, A)).toEqual(ab);
    expect(mergeHistoryStores(B, A)).toEqual(ab);
    expect(mergeHistoryStores(mergeHistoryStores(A, B), C)).toEqual(mergeHistoryStores(A, mergeHistoryStores(B, C)));
    // repeated syncs never inflate totals
    let x = ab;
    for (let i = 0; i < 5; i++) x = mergeHistoryStores(x, mergeHistoryStores(A, B));
    expect(practiceTotals(historyDays(x)).n).toBe(17);
  });

  it('merges two independent backfills by max (shared attempts once)', () => {
    const a: HistoryStore = { version: 1, devices: {}, base: { until: 100, days: { '2026-10-01': { mod: { drill: { n: 8, ok: 8 } } } }, wordsLearned: 2 } };
    const b: HistoryStore = { version: 1, devices: {}, base: { until: 200, days: { '2026-10-01': { mod: { drill: { n: 8, ok: 8 } } }, '2026-10-02': { mod: { drill: { n: 1, ok: 0 } } } }, wordsLearned: 3 } };
    const m = mergeHistoryStores(a, b);
    expect(m.base).toEqual({ until: 200, days: { '2026-10-01': { mod: { drill: { n: 8, ok: 8 } } }, '2026-10-02': { mod: { drill: { n: 1, ok: 0 } } } }, wordsLearned: 3 });
    expect(mergeHistoryStores(a, emptyHistory()).base).toEqual(a.base);
  });

  it('runs through the folder-sync merger and survives junk', () => {
    const text = mergeValue('progress-history', JSON.stringify(A), JSON.stringify(B), true);
    expect(practiceTotals(historyDays(parseHistory(JSON.parse(text)))).n).toBe(17);
    const junk = mergeProgressHistory({ devices: { __proto__: {}, x: { 'not-a-day': {}, '2026-11-01': { mod: { dictation: { n: -3, ok: 9 }, bogus: { n: 1 } }, words: 'x' } } }, base: { until: 'x' } }, null) as HistoryStore;
    expect(junk.base).toBeNull();
    expect(junk.devices.x).toEqual({});
    expect(parseHistory({ devices: { y: { '2026-11-01': { mod: { pairs: { n: 2, ok: 5 } } } } } }).devices.y['2026-11-01'].mod?.pairs).toEqual({ n: 2, ok: 2 });
  });
});

describe('selectors', () => {
  const store: HistoryStore = {
    version: 1,
    devices: {
      'd-a': {
        '2026-10-27': { mod: { dictation: { n: 10, ok: 6 } }, ret: { n: 4, again: 1 }, words: 2, grades: { again: 1, hard: 1, good: 2, easy: 0 } },
        '2026-11-03': { mod: { dictation: { n: 10, ok: 8 }, pairs: { n: 5, ok: 5 } }, ret: { n: 6, again: 0 }, words: 1 },
      },
    },
    base: { until: 0, days: { '2026-10-20': { mod: { drill: { n: 4, ok: 2 } } } }, wordsLearned: 10 },
  };
  const weeks = [week('2026-10-19', '2026-10-25'), week('2026-10-26', '2026-11-01'), week('2026-11-02', '2026-11-08')];
  const days = historyDays(store);

  it('weekly accuracy per module', () => {
    const w = weeklyModuleAccuracy(days, weeks);
    expect(w.map((x) => x.total.pct)).toEqual([50, 60, 87]);
    expect(w[2].byModule).toEqual({ dictation: { n: 10, ok: 8, pct: 80 }, pairs: { n: 5, ok: 5, pct: 100 } });
    expect(practiceDays(days, '2026-10-26')).toEqual(['2026-10-27', '2026-11-03']);
  });

  it('retention, grades and words', () => {
    expect(retentionByWeek(days, weeks).map((x) => x.pct)).toEqual([null, 75, 100]);
    expect(gradeTotals(days)).toEqual({ again: 1, hard: 1, good: 2, easy: 0, total: 4 });
    expect(wordsLearnedCumulative(store, weeks).map((x) => [x.total, x.added])).toEqual([
      [10, 0],
      [12, 2],
      [13, 1],
    ]);
  });

  it('lessons passed per week from completedAt', () => {
    const progress = { a: { completedAt: at(2026, 10, 28) }, b: { completedAt: 0 }, c: { completedAt: at(2026, 11, 8, 23) }, d: undefined };
    expect(lessonsPassedByWeek(progress, weeks).map((x) => x.count)).toEqual([0, 1, 1]);
    expect(lessonsPassedByWeek(null, weeks).map((x) => x.count)).toEqual([0, 0, 0]);
  });
});

describe('live recording', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('recordAttempt feeds the archive after a one-off backfill of older attempts', async () => {
    const map = stubWindow();
    map.set(P + 'stats', JSON.stringify({ attempts: [att(at(2026, 11, 1)), att(at(2026, 11, 1), 'pairs', false)], byPhenomenon: {}, activeDays: [] }));
    const { history, stats } = await fresh();
    stats.recordAttempt({ module: 'dictation', itemId: 'n1', correct: true, seen: [], missed: [], at: NOW });
    stats.recordAttempt({ module: 'dictation', itemId: 'n2', correct: false, seen: [], missed: [], at: NOW + 1 });
    const s = history.loadHistory(NOW + 2);
    expect(s.base?.until).toBe(NOW);
    expect(s.base?.days['2026-11-01'].mod).toEqual({ dictation: { n: 1, ok: 1 }, pairs: { n: 1, ok: 0 } });
    const dev = JSON.parse(map.get(P + 'device-id')!);
    expect(s.devices[dev]['2026-11-06'].mod).toEqual({ dictation: { n: 2, ok: 1 } });
    expect(practiceTotals(historyDays(s)).n).toBe(4);
  });

  it('keeps counting past the 1000-attempt cap of the stats key', async () => {
    stubWindow();
    const { history, stats } = await fresh();
    for (let i = 0; i < 1005; i++) stats.recordAttempt({ module: 'drill', itemId: 'c' + i, correct: i % 2 === 0, seen: [], missed: [], at: NOW + i });
    expect(stats.loadStats().attempts).toHaveLength(1000);
    expect(practiceTotals(historyDays(history.loadHistory(NOW + 2000)))).toMatchObject({ n: 1005, ok: 503 });
  });

  it('records first-listen results of dictation only, and merges them by max', async () => {
    const map = stubWindow();
    const { history, stats } = await fresh();
    const a = (itemId: string) => ({ module: 'dictation' as const, itemId, seen: [], missed: [] });
    stats.recordAttempt({ ...a('n1'), correct: true, at: NOW }, { once: true });
    stats.recordAttempt({ ...a('n2'), correct: true, at: NOW + 1 }, { once: false }); // right, but replayed
    stats.recordAttempt({ ...a('n3'), correct: false, at: NOW + 2 }, { once: true }); // one listen, wrong
    stats.recordAttempt({ ...a('n4'), correct: true, at: NOW + 3 }); // not measured (seen before / cloze / retry)
    stats.recordAttempt({ module: 'pairs', itemId: 'p', correct: true, seen: [], missed: [], at: NOW + 4 }, { once: true });
    stats.recordAttempt({ ...a('n5'), correct: true, at: NOW + 5 }, { inReview: true, once: true }); // Ôn tập: not archived
    const s = history.loadHistory(NOW + 9);
    const dev = JSON.parse(map.get(P + 'device-id')!);
    expect(s.devices[dev]['2026-11-06'].once).toEqual({ n: 3, ok: 1 });
    const days = history.historyDays(s);
    expect(history.firstListenTotals(days)).toEqual({ n: 3, ok: 1, pct: 33 });
    expect(history.firstListenTotals(days, '2026-11-07')).toEqual({ n: 0, ok: 0, pct: null });

    const other = parseHistory({
      version: 1,
      devices: { [dev]: { '2026-11-06': { once: { n: 2, ok: 2 } } }, 'd-z': { '2026-11-06': { once: { n: 4, ok: 9 } } } },
      base: null,
    });
    expect(other.devices['d-z']['2026-11-06'].once).toEqual({ n: 4, ok: 4 }); // ok never above n
    const merged = mergeHistoryStores(s, other);
    expect(merged.devices[dev]['2026-11-06'].once).toEqual({ n: 3, ok: 2 });
    expect(mergeHistoryStores(other, s)).toEqual(merged);
    expect(mergeHistoryStores(merged, merged)).toEqual(merged);
    expect(history.firstListenTotals(history.historyDays(merged))).toEqual({ n: 7, ok: 6, pct: 86 });
  });

  it('records review grades: retention on graduated cards, split for Ôn tập, first word graduation', async () => {
    stubWindow();
    const { history } = await fresh();
    history.noteReviewGrade({ grade: 'good', graduated: true, inReview: true }, NOW);
    history.noteReviewGrade({ grade: 'again', graduated: true, inReview: false }, NOW);
    history.noteReviewGrade({ grade: 'good', graduated: false, inReview: false, wordLearned: true }, NOW);
    history.noteReviewGrade({ grade: 'easy', graduated: false, inReview: false }, NOW); // nothing to count
    const days = historyDays(history.loadHistory(NOW));
    expect(reviewRetention(days)).toEqual({ n: 2, again: 1, pct: 50 });
    expect(gradeTotals(days).total).toBe(1);
    expect(history.wordsLearnedTotal(history.loadHistory(NOW))).toBe(1);
    expect(dayOf(NOW)).toBe('2026-11-06');
  });

  it('keeps the same device id across reloads', async () => {
    stubWindow();
    const a = (await fresh()).history.deviceId();
    const b = (await fresh()).history.deviceId();
    expect(a).toBe(b);
    expect(a).toMatch(/^d-[a-z0-9]{8}$/);
  });
});
