// Property checks (commutative, idempotent, associative) for the mergers changed by the 2026-11-07 red-team pass,
// plus the regressions it found: per-value change times (settings, custom sentences, media prefs), tombstones,
// reset markers, the daily counters of two local days, and the order-independent review card merge.
import { describe, expect, it } from 'vitest';
import { parseReviewStore, rollReviewDaily } from './review/store';
import { STORAGE_PREFIX } from './storage';
import { mergeReset, mergeTombstones, TOMBSTONE_TTL_MS, withReset } from './syncMarkers';
import {
  hasUserData,
  mergeCustomSentences,
  mergeData,
  mergeDrill,
  mergeMedia,
  mergeReview,
  mergeSettings,
  mergeValue,
} from './syncMerge';
import { parseDrillStore, rollDaily } from '../features/drill/drillStore';

const K = (k: string) => STORAGE_PREFIX + k;
type Merger = (n: unknown, o: unknown) => unknown;

let seed = 20261107;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const ri = (n: number) => Math.floor(rnd() * n);
const pick = <T,>(xs: readonly T[]): T => xs[ri(xs.length)];
const maybe = (p = 0.5) => rnd() < p;

/** Stable text: object keys sorted, arrays of strings sorted (sets stored as arrays). */
const canon = (v: unknown): string =>
  JSON.stringify(v, (_k, x: unknown) => {
    if (Array.isArray(x)) return x.every((e) => typeof e === 'string') ? [...x].sort() : x;
    if (x && typeof x === 'object') {
      const o = x as Record<string, unknown>;
      return Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
    }
    return x;
  });

function checkLaws(name: string, m: Merger, gen: () => unknown, runs = 1500, laws = { assoc: true }) {
  it(`${name}: commutative, idempotent${laws.assoc ? ', associative' : ''}`, () => {
    for (let i = 0; i < runs; i++) {
      const a = gen();
      const b = gen();
      const c = gen();
      const ab = m(a, b);
      expect(canon(ab), 'commutative').toBe(canon(m(b, a)));
      const aa = m(a, a);
      expect(canon(m(aa, aa)), 'idempotent').toBe(canon(aa));
      expect(canon(m(ab, b)), 'absorbs').toBe(canon(ab));
      if (laws.assoc) expect(canon(m(m(a, b), c)), 'associative').toBe(canon(m(a, m(b, c))));
    }
  });
}

const T0 = 1_800_000_000_000;
const DAY = 86_400_000;
const ids = ['u-a', 'u-b', 'u-c', 'u-d'];
const days = ['2026-11-06', '2026-11-07', '2026-11-08'];

describe('merger laws', () => {
  checkLaws('settings', mergeSettings, () => ({ theme: pick(['light', 'dark']), reviewMinutes: pick([5, 10, 20]), changedAt: T0 + 1 + ri(4) }));

  checkLaws('custom sentences', mergeCustomSentences, () =>
    ids
      .filter(() => maybe())
      .map((id, i) =>
        maybe(0.4)
          ? { id, text: 'orig ' + id, vi: '', level: 1, createdAt: T0 + i }
          : { id, text: pick(['x', 'y', 'z']), vi: '', level: 1, createdAt: T0 + i, updatedAt: T0 + 10 + ri(3) },
      ),
  );

  checkLaws('media library (items + prefs)', mergeMedia, () => ({
    items: ['m1', 'm2', 'm3']
      .filter(() => maybe())
      .map((id, i) => ({
        id,
        title: pick(['x', 'y']),
        createdAt: T0 + i,
        openedAt: T0 + ri(3),
        units: [],
        progress: { unitIndex: ri(2), done: [ri(3)], scores: { [ri(3)]: ri(3) / 2 }, ...(maybe() ? { heard: [...new Set([ri(4), ri(4)])].sort((x, y) => x - y) } : {}) },
      })),
    prefs: { speed: pick([0.75, 1]), autoLoop: maybe(), showSubs: true, mode: 'watch', changedAt: T0 + 1 + ri(4) },
  }));

  checkLaws('tombstones', mergeTombstones, () => ({
    version: 1,
    custom: Object.fromEntries(ids.filter(() => maybe()).map((id) => [id, T0 + ri(3) * 100 * DAY])),
    media: Object.fromEntries(['m1', 'm2'].filter(() => maybe()).map((id) => [id, T0 + ri(3)])),
  }));

  checkLaws('reset marker', mergeReset, () => ({ version: 1, all: pick([0, T0, T0 + 1]), keys: maybe() ? { stats: T0 + ri(3) } : {} }));

  const reviewDaily = (day: string) => {
    const reviewed = ['dict:a', 'dict:b', 'dict:c'].filter(() => maybe());
    return { day, ids: reviewed, exempt: reviewed.filter(() => maybe()), extraSec: ri(2) * 300, enrolled: ri(4) };
  };
  checkLaws('review daily (two local days)', mergeReview, () => ({
    version: 1,
    cards: {},
    daily: reviewDaily(pick(days)),
    ...(maybe(0.3) ? { otherDaily: reviewDaily(pick(days)) } : {}),
    since: T0,
    notice: null,
    noticeSeenAt: 0,
  }));

  const drillDaily = (day: string) => ({ day, newIntroduced: ri(4), extraNew: ri(2) * 5, reviews: ri(5), studiedIds: ['c1', 'c2'].filter(() => maybe()) });
  checkLaws('drill daily (two local days)', mergeDrill, () => ({
    version: 1,
    newPerDay: 10,
    cards: {},
    daily: drillDaily(pick(days)),
    ...(maybe(0.3) ? { otherDaily: drillDaily(pick(days)) } : {}),
  }));

  // Realistic review cards: two lineages (born), each a chain of copies where a later copy has a later `last` and at
  // least as many reps; any copy may end with a miss. Copies of a chain are what different machines hold.
  const chain = (born: number, start: number) => {
    const out: Record<string, unknown>[] = [];
    let reps = ri(2);
    let interval = 1 + ri(3);
    for (let i = 0; i < 4; i++) {
      const last = start + i * DAY + ri(1000);
      const miss = maybe(0.3);
      reps += miss ? 0 : 1;
      interval = miss ? interval : interval * 2;
      out.push({ id: 'dict:s1', ease: 2.5, lapses: 0, born, last, reps, interval, lastGrade: miss ? 'again' : 'good', due: last + interval * DAY });
    }
    return out;
  };
  const lineages = [chain(T0 - 20 * DAY, T0), chain(T0 - 5 * DAY, T0 + DAY / 2)];
  checkLaws('review cards (realistic copies of two lineages)', mergeReview, () => ({
    version: 1,
    cards: { 'dict:s1': pick(pick(lineages)) },
    since: T0,
    notice: null,
    noticeSeenAt: 0,
  }));
});

describe('settings, custom sentences, media prefs: decided by when THAT value changed', () => {
  it('settings: the copy changed last wins, whichever machine wrote anything since; legacy copies keep the newer side', () => {
    const a = { theme: 'dark', reviewMinutes: 20, changedAt: 2000 };
    const b = { theme: 'light', reviewMinutes: 10, changedAt: 1000 };
    expect(mergeSettings(b, a)).toEqual(a);
    expect(mergeSettings(a, b)).toEqual(a);
    expect(mergeSettings({ theme: 'light' }, a)).toEqual(a); // stamped beats legacy
    expect(mergeSettings({ theme: 'light' }, { theme: 'dark' })).toEqual({ theme: 'light' });
    // through mergeData: remoteNewer (the folder file saved after the last local write) no longer decides it
    expect(JSON.parse(mergeValue('settings', JSON.stringify(a), JSON.stringify(b), true))).toEqual(a);
  });

  it('custom sentences: the version edited last wins; a legacy pair keeps the newer side; sorted by createdAt, id', () => {
    const old = { id: 'u-1', text: 'Old text', vi: '', level: 1, createdAt: 10 };
    const edited = { ...old, text: 'Edited text', updatedAt: 50 };
    expect(mergeCustomSentences([old], [edited])).toEqual([edited]);
    expect(mergeCustomSentences([edited], [old])).toEqual([edited]);
    const other = { id: 'u-0', text: 'Same time', vi: '', level: 1, createdAt: 10 };
    expect((mergeCustomSentences([edited], [other]) as { id: string }[]).map((x) => x.id)).toEqual(['u-0', 'u-1']);
    expect(mergeCustomSentences([{ ...old, vi: 'mới' }], [old])).toEqual([{ ...old, vi: 'mới' }]);
  });

  it('media prefs: the prefs changed last win; items unchanged by it', () => {
    const n = { items: [], prefs: { speed: 1, changedAt: 100 } };
    const o = { items: [], prefs: { speed: 0.75, changedAt: 200 } };
    expect((mergeMedia(n, o) as { prefs: unknown }).prefs).toEqual(o.prefs);
    expect((mergeMedia(o, n) as { prefs: unknown }).prefs).toEqual(o.prefs);
    expect((mergeMedia({ items: [], prefs: { speed: 1 } }, { items: [], prefs: { speed: 0.5 } }) as { prefs: unknown }).prefs).toEqual({ speed: 1 });
  });
});

describe('tombstones and reset markers in mergeData', () => {
  const cs = (list: [string, string, number?][]) =>
    JSON.stringify(list.map(([id, text, updatedAt], i) => ({ id, text, vi: '', level: 1, createdAt: 100 + i, ...(updatedAt ? { updatedAt } : {}) })));

  it('a deleted custom sentence or media item does not come back; one changed after the delete does', () => {
    const local = {
      [K('custom-sentences')]: cs([['u-1', 'keep']]),
      [K('media-library')]: JSON.stringify({ items: [], prefs: {} }),
      [K('tombstones')]: JSON.stringify({ version: 1, custom: { 'u-2': 500, 'u-3': 500 }, media: { m1: 500 } }),
    };
    const remote = {
      [K('custom-sentences')]: cs([['u-1', 'keep'], ['u-2', 'deleted'], ['u-3', 'edited after the delete', 900]]),
      [K('media-library')]: JSON.stringify({ items: [{ id: 'm1', createdAt: 1, openedAt: 2, units: [], progress: {} }, { id: 'm2', createdAt: 600, units: [], progress: {} }], prefs: {} }),
    };
    for (const m of [mergeData(local, remote, true), mergeData(remote, local, false)]) {
      expect((JSON.parse(m[K('custom-sentences')]) as { id: string }[]).map((x) => x.id)).toEqual(['u-1', 'u-3']);
      expect((JSON.parse(m[K('media-library')]) as { items: { id: string }[] }).items.map((x) => x.id)).toEqual(['m2']);
    }
  });

  it('tombstones older than the TTL (before the newest one) are pruned', () => {
    const t = mergeTombstones({ custom: { old: T0 }, media: {} }, { custom: { fresh: T0 + TOMBSTONE_TTL_MS + 1 }, media: {} });
    expect(Object.keys(t.custom)).toEqual(['fresh']);
  });

  const lessons = (ids: string[]) => JSON.stringify(Object.fromEntries(ids.map((id) => [id, { completedAt: 5, bestScore: 1, attempts: 1 }])));

  it('"Xóa dữ liệu" elsewhere: this side\'s older data is dropped, not merged back (both directions)', () => {
    const cleared = { [K('reset')]: JSON.stringify(withReset(mergeReset(null, null), T0)) };
    const stale = { [K('lessons-progress')]: lessons(['l1', 'l2']), [K('settings')]: '{"theme":"dark"}' };
    expect(mergeData(stale, cleared, true)).toEqual(cleared);
    expect(mergeData(cleared, stale, false)).toEqual(cleared);
    // data written after the reset (this side has seen the marker) is merged as usual
    const after = { ...cleared, [K('lessons-progress')]: lessons(['l9']) };
    expect(Object.keys(mergeData(after, cleared, true)).sort()).toEqual([K('lessons-progress'), K('reset')]);
    // a first connection ("Gộp" chosen by the learner) combines both
    expect(Object.keys(mergeData(stale, cleared, true, { honorReset: false })).sort()).toEqual([K('lessons-progress'), K('reset'), K('settings')]);
  });

  it('"Xóa lịch sử luyện tập" (per-key reset) drops only the older stats', () => {
    const reset = { [K('reset')]: JSON.stringify(withReset(mergeReset(null, null), T0, ['stats'])), [K('stats')]: '{"attempts":[],"byPhenomenon":{},"activeDays":[]}' };
    const stale = { [K('stats')]: '{"attempts":[{"at":1,"module":"dictation","itemId":"a"}],"byPhenomenon":{},"activeDays":["2026-11-01"]}', [K('lessons-progress')]: lessons(['l1']) };
    const m = mergeData(stale, reset, false);
    expect(m[K('stats')]).toBe(reset[K('stats')]);
    expect(m[K('lessons-progress')]).toBe(stale[K('lessons-progress')]);
  });

  it('bookkeeping alone is not learner data', () => {
    expect(hasUserData({ [K('reset')]: '{}', [K('tombstones')]: '{}' })).toBe(false);
    expect(hasUserData({ [K('reset')]: '{}', [K('settings')]: '{}' })).toBe(true);
  });
});

describe('daily caps across midnight / timezones', () => {
  it('review: a machine still on the earlier day keeps its spent budget; the later day waits in otherDaily', () => {
    const at2350 = new Date(2026, 10, 7, 23, 50).getTime();
    const B = { version: 1, cards: {}, daily: { day: '2026-11-07', ids: ['dict:s001', 'dict:s002'], exempt: [], extraSec: 0, enrolled: 10, newWords: 6 }, since: 1, notice: null, noticeSeenAt: 0 };
    const A = { version: 1, cards: {}, daily: { day: '2026-11-08', ids: ['dict:s003'], exempt: [], extraSec: 0, enrolled: 1 }, since: 1, notice: null, noticeSeenAt: 0 };
    for (const merged of [mergeReview(B, A), mergeReview(A, B)]) {
      const s = parseReviewStore(merged, at2350);
      expect(s.daily).toMatchObject({ day: '2026-11-07', enrolled: 10, newWords: 6 });
      expect(s.daily.ids).toEqual(['dict:s001', 'dict:s002']);
      expect(s.otherDaily).toMatchObject({ day: '2026-11-08', enrolled: 1, ids: ['dict:s003'] });
      // after midnight this machine continues with what A already spent on the 8th
      const next = rollReviewDaily(s, at2350 + 20 * 60_000);
      expect(next.daily).toMatchObject({ day: '2026-11-08', enrolled: 1, ids: ['dict:s003'] });
      expect(next.otherDaily).toBeUndefined();
      // and the machine already on the 8th keeps its own counters (the 7th is past for it)
      const a = parseReviewStore(merged, at2350 + DAY);
      expect(a.daily).toMatchObject({ day: '2026-11-08', enrolled: 1 });
      expect(a.otherDaily).toBeUndefined();
    }
  });

  it('drill: same for new cards started today', () => {
    const at2350 = new Date(2026, 10, 7, 23, 50).getTime();
    const B = { version: 1, newPerDay: 10, cards: {}, daily: { day: '2026-11-07', newIntroduced: 10, extraNew: 0, reviews: 30, studiedIds: ['c1'] } };
    const A = { version: 1, newPerDay: 10, cards: {}, daily: { day: '2026-11-08', newIntroduced: 2, extraNew: 0, reviews: 3, studiedIds: ['c2'] } };
    const s = parseDrillStore(mergeDrill(A, B), at2350);
    expect(s.daily).toMatchObject({ day: '2026-11-07', newIntroduced: 10, reviews: 30 });
    expect(s.otherDaily).toMatchObject({ day: '2026-11-08', newIntroduced: 2 });
    expect(rollDaily(s, at2350 + 20 * 60_000).daily).toMatchObject({ day: '2026-11-08', newIntroduced: 2, studiedIds: ['c2'] });
  });
});

describe('review card merge is order-independent', () => {
  it('a regrade on one machine and a miss on an independent copy give the same card in any order', () => {
    const T = new Date(2026, 10, 1, 10).getTime();
    const st = (c: object) => ({ version: 1, cards: { 'dict:s001': { id: 'dict:s001', ease: 2.5, lapses: 0, ...c } }, since: 1, notice: null, noticeSeenAt: 0 });
    const A = st({ born: T - 10 * DAY, last: T, lastGrade: 'good', interval: 3, reps: 2, due: T + 3 * DAY });
    const C = st({ born: T - 10 * DAY, last: T + DAY, lastGrade: 'good', interval: 8, reps: 3, due: T + 9 * DAY });
    const B = st({ born: T - 5 * DAY, last: T + 2 * DAY, lastGrade: 'again', interval: 0, reps: 0, due: T + 2 * DAY + 600_000 });
    const card = (x: unknown) => (x as { cards: Record<string, Record<string, unknown>> }).cards['dict:s001'];
    const results = [
      mergeReview(mergeReview(A, B), C),
      mergeReview(A, mergeReview(B, C)),
      mergeReview(mergeReview(A, C), B),
      mergeReview(C, mergeReview(B, A)),
    ].map((r) => canon(card(r)));
    expect(new Set(results).size).toBe(1);
    const c = card(mergeReview(mergeReview(A, B), C));
    // C's regrade (interval 8) is kept, and B's later miss pulls it to the next day
    expect(c).toMatchObject({ interval: 8, reps: 3, lastGrade: 'again', last: T + 2 * DAY, baseLast: T + DAY, missAt: T + 2 * DAY });
    expect(c.due).toBe(new Date(2026, 10, 4).getTime());
    // the app keeps the merge fields, and a local regrade afterwards (last moves on) makes them inert
    const parsed = parseReviewStore({ version: 1, cards: { 'dict:s001': c } }, T + 2 * DAY).cards['dict:s001'];
    expect(parsed).toMatchObject({ missAt: T + 2 * DAY, baseLast: T + DAY });
  });
});
