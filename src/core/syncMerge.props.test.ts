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
  mergeTown,
  mergeLife,
  mergeCafe,
  mergeCases,
  mergeCity,
  mergeShifts,
  mergeJobs,
  mergeHideout,
  mergeEar,
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
    // CPU-heavy (hundreds of random merges): the default 5 s timed out under a loaded full run, never alone
  }, 30_000);
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

  // Thị trấn: copies of the same town at different stages (lines, xu per device, purchases, daily counters, days),
  // with junk parts, a junk whole value and a version 1 value (lines only) now and then. The day lists are longer
  // than the caps a merge keeps, so the caps are under the laws too.
  const townLine = () => pick<unknown>([{ best: ri(3), tries: 1 + ri(4), at: T0 + ri(5) }, { best: ri(3), tries: 1 + ri(4), at: T0 + ri(5) }, { best: 5, tries: -1 }, null, 'x']);
  const townLines = () => Object.fromEntries(['s001', 's002', 's003', 's004'].filter(() => maybe(0.7)).map((id) => [id, townLine()]));
  const townDevices = ['d-laptop01', 'd-phone001', 'd-tablet01'];
  const townDays = Array.from({ length: 80 }, (_, i) => new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10));
  const townDaily = () =>
    pick<unknown>([
      { talks: ri(3), lines: ri(10), first: ri(5), met: ['cafe', 'square', 'friend'].filter(() => maybe()), paid: ['talk', 'lines', 'first', 'fish'].filter(() => maybe()) },
      { lines: ri(3), fish: ri(6), fishFirst: ri(3), fishXu: ri(30), harvest: ri(20), eps: ri(2), perfect: ri(2) },
      { lines: ri(4) },
      // the day's fixed tasks (2026-11-21): a copy put back from before can hold another list for the same browser
      { lines: ri(3), tasks: pick<unknown>([['first', 'lines', 'talk'], ['fish', 'lines', 'talk'], ['episode', 'first', 'harvest'], ['Bad Id', 'first'], 'x']) },
      { tasks: ['lines', 'fish-first', 'talk', 'first'] },
      // friendship (version 5): who got their chat points / a gift today
      { lines: ri(2), bond: ['cafe', 'home', 'Bad Id'].filter(() => maybe()), gifted: pick<unknown>([['cafe'], ['home', 'cafe'], 'x']) },
      { talks: -1 },
      null,
    ]);
  const townItems = ['home', 'shop', 'park', 'lamps1', 'cat', 'Bad Id', 'constructor'];
  // episodes (version 3): every field at different stages, junk records and ids now and then
  const townEpisode = () =>
    pick<unknown>([
      { stage: ri(6), at: T0 + ri(5), okAt: T0 + ri(5), firstGist: ri(3), bestLines: ri(7) },
      { stage: 1 + ri(3), at: T0 + ri(3), okAt: T0 + ri(3), firstGist: 2, bestLines: ri(4) },
      { stage: 0, firstGist: 1 },
      { stage: 9, at: -5, okAt: 'x', firstGist: 7, bestLines: 1e9 },
      null,
      'x',
    ]);
  const townEpisodes = () => Object.fromEntries(['cafe-1', 'cafe-2', 'shop-1', 'Bad Id', 'constructor'].filter(() => maybe(0.5)).map((id) => [id, townEpisode()]));
  // the game loops (version 4): fish, farm days, eggs, owned items, the look (ordered by its own time), unlocks
  const townFish = () =>
    Object.fromEntries(
      ['ca-noi', 'ca-gon', 'koi-vang', 'Bad Id', '__proto__'].filter(() => maybe(0.5)).map((id) => [
        id,
        pick<unknown>([{ seen: ri(6), caught: ri(4), firstAt: pick([0, T0, T0 + 1]), bestMs: pick([0, 1500, 2200]), at: T0 + ri(4) }, { caught: 2 }, { seen: -1, bestMs: 'x' }, null]),
      ]),
    );
  const townCounts = () => Object.fromEntries([...townDevices, 'NOT A DEVICE'].filter(() => maybe(0.5)).map((d) => [d, pick([0, 1, 2, 5, 2.5, -1])]));
  const townEggs = () =>
    pick<unknown>([
      { grants: ['gist:cafe-1', 'farm:2026-09-03', 'perfect:2026-09-04', 'fish:koi-vang', 'Bad grant', 'x:'].filter(() => maybe()), bought: townCounts(), hatched: townCounts(), rare: townCounts() },
      { grants: 'x', bought: [] },
      null,
    ]);
  const townTimes = (ids: string[]) => Object.fromEntries(ids.filter(() => maybe(0.5)).map((id) => [id, pick<unknown>([T0, T0 + ri(3), 0, -5, 'x'])]));
  const townLook = () =>
    pick<unknown>([
      { hat: pick([null, 'mu-len', 'non-la']), outfit: pick([null, 'ao-do']), pet: pick([null, 'vit', 'Bad Id']), title: pick([null, 'tai-thinh']), at: pick([0, T0, T0 + 1, T0 + 2]) },
      { hat: 'mu-len', at: T0 + 1 },
      'x',
      null,
    ]);
  // friendship (version 5): points per resident, side and device, facts, the first choice per line, gifts per device
  const townFriends = () =>
    Object.fromEntries(
      ['cafe', 'home', 'Bad Id', '__proto__'].filter(() => maybe(0.5)).map((id) => [id, pick<unknown>([{ up: townCounts(), down: townCounts() }, { up: townCounts() }, { down: 'x' }, null])]),
    );
  const townFacts = () => townTimes(['cafe:loves-jazz', 'you:iced-latte', 'home:roses', 'Bad fact', 'x:', '__proto__']);
  const townChoices = () =>
    Object.fromEntries(
      ['cafe-3-04', 'home-3-02', 'Bad Id'].filter(() => maybe(0.5)).map((id) => [
        id,
        pick<unknown>([{ o: pick([id + '-a', id + '-b', id + '-c']), at: pick([T0, T0 + 1, T0 + 2]) }, { o: 'Bad', at: T0 }, { o: id + '-a', at: 0 }, null]),
      ]),
    );
  const townGifts = () =>
    pick<unknown>([
      {
        bought: Object.fromEntries(['roses', 'chocolate', 'Bad Id'].filter(() => maybe()).map((g) => [g, townCounts()])),
        given: Object.fromEntries(['roses', 'chocolate'].filter(() => maybe()).map((g) => [g, townCounts()])),
      },
      { bought: 'x' },
      null,
    ]);
  // version 6: typed checks per browser (n answered, ok typed right), junk buckets and values included
  const townTyped = () =>
    Object.fromEntries(
      [...townDevices, 'NOT A DEVICE', '__proto__']
        .filter(() => maybe(0.5))
        .map((d) => [d, pick<unknown>([{ n: ri(6), ok: ri(6) }, { n: 3, ok: 9 }, { n: 2.5 }, { ok: 1 }, { n: -1, ok: -1 }, null, 'x'])]),
    );
  checkLaws(
    'town progress',
    mergeTown,
    () => {
      if (maybe(0.05)) return pick<unknown>([null, 'junk', [], { lines: 7 }, { earned: 'x', bought: 5, daily: [], days: {} }]);
      if (maybe(0.1)) return { version: 1, lines: townLines() };
      const from = ri(40);
      const span = townDays.slice(from, from + 1 + ri(70));
      return {
        version: pick([2, 3, 4, 5, 6, 6, 7, 8]),
        // a newer build's top-level fields: kept and relayed in a version 7+ value, junk in a version 6 one
        ...(maybe(0.4) ? { garden: pick<unknown>([{ beds: ri(3) }, { beds: ri(3), at: T0 + ri(3) }, [1, 2], 'x', null]) } : {}),
        ...(maybe(0.3) ? { pets2: { n: ri(2) }, 'Bad Key': 1, prototype: 2 } : {}),
        ...(maybe(0.7) ? { episodes: townEpisodes() } : {}),
        ...(maybe(0.6)
          ? {
              fish: townFish(),
              farmDays: span.filter(() => maybe(0.2)),
              eggs: townEggs(),
              owned: townTimes(['mu-len', 'vit', 'ao-do', 'Bad Id', 'constructor']),
              look: townLook(),
              unlocks: townTimes(['me-ca-dau', 'tai-thinh', 'du-an-ben-ca', 'prototype']),
            }
          : {}),
        ...(maybe(0.6) ? { friends: townFriends(), facts: townFacts(), choices: townChoices(), gifts: townGifts() } : {}),
        ...(maybe(0.6) ? { typed: townTyped() } : {}),
        lines: townLines(),
        earned: Object.fromEntries([...townDevices, 'NOT A DEVICE'].filter(() => maybe(0.6)).map((d) => [d, pick([0, 3, 12, 12.5, 40, -2])])),
        bought: townItems.filter(() => maybe(0.4)),
        daily: Object.fromEntries(span.filter(() => maybe(0.8)).map((day) => [day, Object.fromEntries(townDevices.filter(() => maybe(0.6)).map((d) => [d, townDaily()]))])),
        days: span.filter(() => maybe(0.7)),
      };
    },
    600,
  );

  const reviewDaily = (day: string) => {
    const reviewed = ['dict:a', 'dict:b', 'dict:c'].filter(() => maybe());
    return { day, ids: reviewed, exempt: reviewed.filter(() => maybe()), extraSec: ri(2) * 300, enrolled: ri(4) };
  };
  // town-life (docs/town.md §15): the character (newer wins, ties by text), first step times, children, choices, talks
  checkLaws('town life', mergeLife, () => {
    if (maybe(0.05)) return pick<unknown>([null, 'junk', [], { court: 7 }]);
    const ids = ['cafe', 'park', 'square', 'Bad Id', '__proto__'];
    return {
      version: 1,
      profile: pick<unknown>([null, { gender: pick(['male', 'female']), name: pick(['Phước', 'Na']), skin: '#f6d3b8', hair: pick(['short', 'bun']), hairColor: '#3b2a22', at: pick([T0, T0 + 1, T0 + 2]) }, { gender: 'x' }]),
      court: Object.fromEntries(ids.filter(() => maybe(0.5)).map((id) => [id, { dating: pick([0, T0, T0 + 1, T0 + 2]), date1: pick([0, T0 + 3, T0 + 4]), married: pick([0, 0, T0 + 9]) }])),
      kids: Object.fromEntries(['kid-1', 'kid-2', 'kid-3', 'kid-4'].filter(() => maybe(0.4)).map((id) => [id, { name: pick(['Bin', 'Na']), gender: pick(['boy', 'girl']), born: pick([T0, T0 + 1, T0 + 5]), at: pick([T0, T0 + 1, T0 + 2]) }])),
      choices: Object.fromEntries(['cafe-date-1', 'park-date-2'].filter(() => maybe()).map((id) => [id, { o: pick([id + '-a', id + '-b']), at: pick([T0, T0 + 1]) }])),
      talked: Object.fromEntries(townDays.slice(ri(50), 60).filter(() => maybe(0.3)).map((d) => [d, [pick(['spouse', 'kid-1'])]])),
    };
  });
  // town-cases (docs/town.md §17): per case and chapter the earlier solve and the higher stars
  checkLaws('town cases', mergeCases, () => {
    if (maybe(0.05)) return pick<unknown>([null, 'junk', [], { done: 7 }]);
    return {
      version: 1,
      done: Object.fromEntries(
        ['case-1', 'case-2', 'Bad Id', '__proto__'].filter(() => maybe(0.6)).map((id) => [id, Object.fromEntries(['0', '1', '4', '9', 'x'].filter(() => maybe(0.5)).map((ch) => [ch, pick<unknown>([{ at: T0 + ri(3), stars: 1 + ri(3) }, { at: 0, stars: 2 }, { at: T0, stars: 9 }, null])]))]),
      ),
    };
  });
  // town-city (docs/town.md §20): per scene the earlier first hearing, the higher best and count, the later last
  checkLaws('town city', mergeCity, () => {
    if (maybe(0.05)) return pick<unknown>([null, 'junk', [], { heard: 7 }]);
    return {
      version: 1,
      first: pick<unknown>([0, T0, T0 + 5, -3, "x"]),
      heard: Object.fromEntries(
        ['ct-rico-1', 'ct-nora-2', 'cv-square-1', 'Bad Id', '__proto__'].filter(() => maybe(0.6)).map((id) => [id, pick<unknown>([{ at: pick([T0, T0 + 1]), best: ri(4), times: 1 + ri(3), last: pick([T0 + 1, T0 + 9]) }, { at: 0 }, 'x'])]),
      ),
    };
  });
  // town-shifts (Westbay's "Ca làm việc", core/town/shift): per shift best and last run's misses, per-order counts, days
  // town-jobs (Westbay's jobs, core/town/jobProgress): per job earlier first, better grade, more times, later last, flags
  checkLaws('town jobs', mergeJobs, () => {
    if (maybe(0.05)) return pick<unknown>([null, 'junk', [], { done: 7 }]);
    return {
      version: 1,
      done: Object.fromEntries(
        ['job-m2', 'job-half5', 'job-ferry', 'Bad Id', '__proto__'].filter(() => maybe(0.6)).map((id) => [
          id,
          pick<unknown>([
            { first: pick([T0, T0 + 1, T0 + 4]), best: pick(['clean', 'messy', 'broken']), times: 1 + ri(4), last: pick([T0 + 2, T0 + 9]), flags: ['hit:late', 'asked', 'kemp-asks-again'].filter(() => maybe()) },
            { first: 0, best: 'clean' },
            { first: T0, best: 'super' },
            'x',
          ]),
        ]),
      ),
      // the clues earned (gta-plan §17): id → first time; junk ids and times dropped
      ...(maybe(0.6) ? { clues: Object.fromEntries(['fay-heights', 'gate-one-call', 'Bad Clue'].filter(() => maybe()).map((id) => [id, pick<unknown>([T0, T0 + 3, 0, 'x'])])) } : {}),
      // the speech level (core/town/difficulty.ts): its automatic part by when written, the pin by when chosen
      ...(maybe(0.6) ? { speech: pick<unknown>([{ auto: { level: pick([1, 3, 5]), acc: pick([0.8, 0.9]), since: ri(20), at: pick([T0, T0 + 5]) }, pin: { level: pick([null, 2, 4]), changedAt: pick([0, T0 + 1, T0 + 7]) } }, 'junk', { auto: { level: 7 } }]) } : {}),
    };
  });
  // town-ear (docs/progress-report.md §4 "In the game"): ids met by the earlier time, counts by the max per browser,
  // day and voice (and level)
  checkLaws('town ear', mergeEar, () => {
    if (maybe(0.05)) return pick<unknown>([null, 'junk', [], { devices: 7 }]);
    const count = () => pick<unknown>([{ n: pick([1, 3, 3, 8]), ok: pick([0, 1, 3, 9]) }, { n: 0, ok: 0 }, 'x', null]);
    return {
      version: 1,
      met: Object.fromEntries(['job-ferry', 'job-machine2', 'dc-12', 'dc-7', 'Bad Id', '__proto__'].filter(() => maybe()).map((id) => [id, pick<unknown>([T0, T0 + 3, 0, 'x'])])),
      devices: Object.fromEntries(
        ['d-aaaa1111', 'd-bbbb2222', 'BAD'].filter(() => maybe()).map((dev) => [
          dev,
          Object.fromEntries(
            townDays
              .slice(ri(10), 30)
              .filter(() => maybe(0.2))
              .map((d) => [d, { browser: count(), clip: count(), ...(maybe(0.4) ? { lv: Object.fromEntries(['1', '2', '3', 'x'].filter(() => maybe()).map((k) => [k, count()])) } : {}) }]),
          ),
        ]),
      ),
    };
  });
  // town-hideout (docs/town.md §29): the earlier buying, the later rest, each upgrade at its earlier time
  checkLaws('town hideout', mergeHideout, () => {
    if (maybe(0.05)) return pick<unknown>([null, 'junk', [], { bought: 'x' }]);
    return {
      version: 1,
      bought: pick<unknown>([null, T0, T0 + 1, T0 + 7, 'x', -3]),
      rested: pick<unknown>([0, T0 + 2, T0 + 9, null]),
      upgrades: Object.fromEntries(['desk', 'bed', 'Bad Id', '__proto__'].filter(() => maybe()).map((id) => [id, pick<unknown>([T0, T0 + 3, 'x'])])),
    };
  });
  checkLaws('town shifts', mergeShifts, () => {
    if (maybe(0.05)) return pick<unknown>([null, 'junk', [], { days: 7 }]);
    const shiftIds = ['taxi', 'flowers', 'Bad Id', '__proto__'];
    return {
      version: 1,
      best: Object.fromEntries(shiftIds.filter(() => maybe()).map((id) => [id, pick<unknown>([{ score: pick([120, 300, 300]), at: pick([T0, T0 + 1, T0 + 2]) }, { score: 'x' }, null])])),
      last: Object.fromEntries(
        shiftIds.filter(() => maybe()).map((id) => [id, pick<unknown>([{ at: pick([T0, T0 + 1]), missed: ['sh-taxi-1', 'sh-taxi-3', 'sh-flowers-2', 'bad', 'sh-taxi-12'].filter(() => maybe(0.4)) }, { at: 0, missed: [] }, 'x'])]),
      ),
      orders: Object.fromEntries(['sh-taxi-1', 'sh-flowers-10', 'Bad Id', '__proto__'].filter(() => maybe()).map((id) => [id, { n: ri(5), ok: ri(5) }])),
      days: Object.fromEntries(
        townDays
          .slice(ri(10), 75)
          .filter(() => maybe(0.2))
          .map((d) => [d, Object.fromEntries([...townDevices, 'NOT A DEVICE'].filter(() => maybe(0.5)).map((dev) => [dev, Object.fromEntries(shiftIds.filter(() => maybe()).map((id) => [id, { runs: ri(3), xu: ri(16) }]))]))]),
      ),
    };
  });
  // town-cafe (docs/town.md §16): best score, skill (newer), per-order counts, per-day per-browser rows
  checkLaws('town cafe', mergeCafe, () => {
    if (maybe(0.05)) return pick<unknown>([null, 'junk', [], { days: 7 }]);
    return {
      version: 1,
      best: pick<unknown>([null, { score: pick([120, 300, 300]), at: pick([T0, T0 + 1, T0 + 2]) }, { score: 'x' }]),
      skill: pick<unknown>([null, { v: pick([0, 2.5, 7]), at: pick([T0, T0 + 1, T0 + 2]) }, { v: 99, at: T0 }]),
      orders: Object.fromEntries(['cf-shop-1', 'cf-park-10', 'Bad Id', '__proto__'].filter(() => maybe()).map((id) => [id, { n: ri(5), ok: ri(5) }])),
      days: Object.fromEntries(
        townDays.slice(ri(10), 75).filter(() => maybe(0.2)).map((d) => [d, Object.fromEntries([...townDevices, 'NOT A DEVICE'].filter(() => maybe(0.5)).map((dev) => [dev, { runs: ri(3), xu: ri(24), best: ri(400), bond: ri(2) }]))]),
      ),
    };
  });
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

  it('town progress follows the same rules: dropped by a reset elsewhere, kept by "Xóa lịch sử luyện tập"', () => {
    const town = (ids: string[]) =>
      JSON.stringify({
        version: 2,
        lines: Object.fromEntries(ids.map((id) => [id, { best: 2, tries: 1, at: 5 }])),
        earned: { 'd-laptop01': 3 * ids.length },
        bought: ids.length > 1 ? ['home'] : [],
        daily: {},
        days: [],
      });
    const cleared = { [K('reset')]: JSON.stringify(withReset(mergeReset(null, null), T0)) };
    const stale = { [K('town-progress')]: town(['s001', 's002']) };
    expect(mergeData(stale, cleared, true)).toEqual(cleared);
    expect(mergeData(cleared, stale, false)).toEqual(cleared);
    // lines understood after the reset are merged as usual
    const after = { ...cleared, [K('town-progress')]: town(['s009']) };
    expect(JSON.parse(mergeData(after, cleared, true)[K('town-progress')]).lines).toHaveProperty('s009');
    // …and the xu and the purchases from before the reset do not come back with them
    expect(JSON.parse(mergeData(after, stale, true)[K('town-progress')])).toMatchObject({ earned: { 'd-laptop01': 3 }, bought: [] });
    // a first connection ("Gộp") combines both copies
    expect(Object.keys(JSON.parse(mergeData(stale, after, true, { honorReset: false })[K('town-progress')]).lines)).toEqual(['s001', 's002', 's009']);
    // the per-key reset of the practice history does not touch what was understood in town
    const history = { [K('reset')]: JSON.stringify(withReset(mergeReset(null, null), T0, ['stats'])), [K('stats')]: '{"attempts":[],"byPhenomenon":{},"activeDays":[]}' };
    expect(mergeData(stale, history, false)[K('town-progress')]).toBe(stale[K('town-progress')]);
    expect(hasUserData(stale)).toBe(true);
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
