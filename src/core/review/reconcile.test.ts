import { describe, expect, it } from 'vitest';
import type { SentenceProgress } from '../dictation/progress';
import { availableAt, START_EASE } from '../srs';
import type { ItemStat } from '../../features/pairs/game';
import { SEED_PER_DAY } from './constants';
import { isSeeded, reconcileCards, TEMPLATES, type ReconcileInput } from './reconcile';
import { localDayDiff, startOfLocalDay } from './time';
import type { CardId, ReviewCard } from './types';

const NOW = new Date(2026, 4, 10, 12, 0).getTime();
const DAY_MS = 86_400_000;
const SINCE = NOW - 2 * DAY_MS; // the review layer first ran two days ago
const BEFORE = SINCE - 5 * DAY_MS;
const AFTER = SINCE + DAY_MS;

function input(over: Partial<ReconcileInput> = {}): ReconcileInput {
  return {
    dictation: {},
    sentenceIds: new Set(Array.from({ length: 60 }, (_, i) => `s${i}`)),
    pairs: { items: {}, sets: {} },
    pairSets: {
      'can-cant': ['can-1', 'can-2', 'can-3', 'can-4'],
      'ill-i': ['ill-1', 'ill-2'],
    },
    lessons: {},
    lessonIds: new Set(['intro', 'linking', 'flap-t']),
    media: [],
    shadowWeak: [],
    ...over,
  };
}

const prog = (over: Partial<SentenceProgress> = {}): SentenceProgress => ({
  best: 0.5,
  attempts: 2,
  lastAt: BEFORE,
  ...over,
});
const stat = (over: Partial<ItemStat> = {}): ItemStat => ({
  seen: 3,
  correct: 3,
  streak: 3,
  lastAt: BEFORE,
  ...over,
});
const opts = (over: { since?: number; exclude?: CardId } = {}) => ({
  since: SINCE,
  now: NOW,
  ...over,
});
const dayOf = (c: ReviewCard) => Math.max(0, localDayDiff(NOW, availableAt(c)));

function seeded(id: string, d: number, interval = 3): ReviewCard {
  return {
    id,
    due: startOfLocalDay(NOW, d),
    interval,
    ease: START_EASE,
    reps: 1,
    lapses: 0,
    last: 0,
  };
}

function perDay(cards: Record<string, ReviewCard>): number[] {
  const out: number[] = [];
  for (const c of Object.values(cards)) {
    const d = dayOf(c);
    out[d] = (out[d] ?? 0) + 1;
  }
  return Array.from(out, (x) => x ?? 0);
}

describe('reconcileCards — sources and templates', () => {
  it('dictation: weak always; strong/known only for history before since', () => {
    const r = reconcileCards(
      input({
        dictation: {
          s1: prog({ best: 0.5, lastAt: AFTER }), // weak, after since → still WEAK
          s2: prog({ best: 1, attempts: 1, lastAt: BEFORE }), // first-try perfect → STRONG
          s3: prog({ best: 1, attempts: 3, lastAt: BEFORE }), // KNOWN
          s4: prog({ best: 1, attempts: 3, lastAt: AFTER }), // after since → skipped (hooks decided)
          s5: prog({
            best: 1,
            attempts: 1,
            hints: 1,
            lastAt: BEFORE,
            cleanAt: undefined,
          }), // hinted, never clean → WEAK
          gone: prog({ best: 0.2 }), // content gone
        },
      }),
      {},
      opts(),
    );
    expect(Object.keys(r.cards).sort()).toEqual(['dict:s1', 'dict:s2', 'dict:s3', 'dict:s5']);
    expect(r.cards['dict:s1']).toEqual({
      id: 'dict:s1',
      due: NOW,
      interval: 0,
      ease: START_EASE,
      reps: 0,
      lapses: 0,
      last: 0,
      born: NOW,
    });
    expect(r.cards['dict:s2']).toMatchObject({ interval: 7, reps: 2, last: 0 });
    expect(dayOf(r.cards['dict:s2'])).toBeGreaterThanOrEqual(2);
    expect(r.cards['dict:s3']).toMatchObject({ interval: 3, reps: 1 });
    expect(dayOf(r.cards['dict:s3'])).toBeGreaterThanOrEqual(1);
    expect(r.cards['dict:s5'].interval).toBe(0);
    expect(r.created).toBe(4);
    expect(r.moved).toBe(0);
    for (const c of Object.values(r.cards)) {
      expect(c.lastGrade).toBeUndefined();
      expect(isSeeded(c)).toBe(true);
    }
  });

  it('pair sets: weak → WEAK, a miss → KNOWN (always); enough answers → STRONG/KNOWN before since only', () => {
    const run = (items: Record<string, ItemStat>) =>
      reconcileCards(input({ pairs: { items, sets: {} } }), {}, opts()).cards['pair:can-cant'];
    expect(run({ 'can-1': stat({ streak: 0, correct: 2, lastAt: AFTER }) })?.interval).toBe(0);
    expect(run({ 'can-1': stat({ seen: 5, correct: 4, streak: 2, lastAt: AFTER }) })).toMatchObject({
      interval: 3,
      reps: 1,
    });
    // all correct, few answers: nothing
    expect(run({ 'can-1': stat() })).toBeUndefined();
    // >= 20 answers, every seen item streak >= 3, half the items seen → STRONG
    expect(
      run({
        'can-1': stat({ seen: 10, correct: 10 }),
        'can-2': stat({ seen: 10, correct: 10 }),
      }),
    ).toMatchObject({
      interval: 7,
      reps: 2,
    });
    // only a quarter of the items seen → KNOWN
    expect(run({ 'can-1': stat({ seen: 20, correct: 20, streak: 20 }) })).toMatchObject({ interval: 3 });
    // a streak under 3 → KNOWN
    expect(
      run({
        'can-1': stat({ seen: 10, correct: 10, streak: 2 }),
        'can-2': stat({ seen: 10, correct: 10 }),
      }),
    ).toMatchObject({
      interval: 3,
    });
    // practised after since: the hooks decided (budget), skip
    expect(
      run({
        'can-1': stat({ seen: 10, correct: 10, lastAt: AFTER }),
        'can-2': stat({ seen: 10, correct: 10 }),
      }),
    ).toBeUndefined();
  });

  it('pair items of an unknown set are ignored', () => {
    const r = reconcileCards(input({ pairs: { items: { 'zzz-1': stat({ streak: 0 }) }, sets: {} } }), {}, opts());
    expect(r.created).toBe(0);
  });

  it('lessons: >= 0.9 KNOWN, passed LEARNED1 (always); not completed or unknown → none', () => {
    const r = reconcileCards(
      input({
        lessons: {
          intro: { completedAt: AFTER, bestScore: 0.95, attempts: 1 },
          linking: { completedAt: AFTER, bestScore: 0.75, attempts: 2 },
          'flap-t': { completedAt: 0, bestScore: 0.5, attempts: 1 },
          removed: { completedAt: BEFORE, bestScore: 1, attempts: 1 },
        },
      }),
      {},
      opts(),
    );
    expect(Object.keys(r.cards).sort()).toEqual(['lesson:intro', 'lesson:linking']);
    expect(r.cards['lesson:intro']).toMatchObject({ interval: 3, reps: 1 });
    expect(r.cards['lesson:linking']).toMatchObject({
      interval: 1,
      reps: 1,
      due: NOW,
    });
  });

  it('media: only imperfect units inside the transcript', () => {
    const r = reconcileCards(
      input({
        media: [
          {
            itemId: 'm1',
            unitCount: 3,
            scores: { 0: 0.5, 1: 1, 2: 0.9, 5: 0.1 },
          },
        ],
      }),
      {},
      opts(),
    );
    expect(Object.keys(r.cards).sort()).toEqual(['media:m1:0', 'media:m1:2']);
    expect(r.cards['media:m1:0'].interval).toBe(0);
  });

  it('shadowing: weak takes of untouched built-in sentences → NEW (from tomorrow)', () => {
    const r = reconcileCards(
      input({
        dictation: { s2: prog({ best: 1, attempts: 2, lastAt: AFTER }) },
        shadowWeak: [
          { id: 's1', best: 0.5 },
          { id: 's2', best: 0.3 }, // has dictation progress
          { id: 's3', best: 0.8 }, // good enough
          { id: 's4', best: 0.2 }, // already has a card
          { id: 'zz', best: 0.1 }, // no content
        ],
      }),
      { 'dict:s4': { ...seeded('dict:s4', 3), last: NOW - 1 } },
      opts(),
    );
    expect(Object.keys(r.cards)).toEqual(['dict:s1']);
    expect(r.cards['dict:s1']).toMatchObject({
      interval: 0,
      reps: 0,
      due: startOfLocalDay(NOW, 1),
    });
  });

  it('templates', () => {
    expect(TEMPLATES).toEqual({
      WEAK: { interval: 0, reps: 0, bucket: 0, minDay: 0 },
      LEARNED1: { interval: 1, reps: 1, bucket: 1, minDay: 0 },
      NEW: { interval: 0, reps: 0, bucket: 2, minDay: 1 },
      KNOWN: { interval: 3, reps: 1, bucket: 3, minDay: 1 },
      STRONG: { interval: 7, reps: 2, bucket: 4, minDay: 2 },
      WORD: { interval: 0, reps: 0, bucket: 2, minDay: 0 },
    });
  });
});

describe('reconcileCards — spreading', () => {
  const weakMap = (n: number, from = 0) =>
    Object.fromEntries(Array.from({ length: n }, (_, i) => [`s${from + i}`, prog({ lastAt: BEFORE + i })]));

  it('never more than SEED_PER_DAY per day', () => {
    const r = reconcileCards(input({ dictation: weakMap(30) }), {}, opts());
    expect(r.created).toBe(30);
    expect(perDay(r.cards)).toEqual([8, 8, 8, 6]);
    expect(Math.max(...perDay(r.cards))).toBe(SEED_PER_DAY);
    // oldest first
    expect(dayOf(r.cards['dict:s0'])).toBe(0);
    expect(dayOf(r.cards['dict:s29'])).toBe(3);
    // day 0 is due now, later days at local midnight
    expect(r.cards['dict:s0'].due).toBe(NOW);
    expect(r.cards['dict:s29'].due).toBe(startOfLocalDay(NOW, 3));
  });

  it('existing seeded cards count toward the daily load; graded cards do not', () => {
    const existing: Record<string, ReviewCard> = {};
    for (let i = 0; i < 6; i++)
      existing[`dict:x${i}`] = {
        ...seeded(`dict:x${i}`, 0, 0),
        due: NOW - DAY_MS,
      }; // overdue → day 0
    for (let i = 0; i < 5; i++)
      existing[`dict:g${i}`] = {
        ...seeded(`dict:g${i}`, 0, 0),
        last: NOW - 1,
        lastGrade: 'good',
      };
    const r = reconcileCards(input({ dictation: weakMap(5) }), existing, opts());
    expect(perDay(r.cards)).toEqual([2, 3]);
    expect(r.moved).toBe(0);
  });

  it('re-spreads a merged pile (24 on one day → 8 + 8 + 8), interval desc then id desc moved first', () => {
    const existing: Record<string, ReviewCard> = {};
    for (let i = 0; i < 24; i++) {
      const id = `dict:p${String(i).padStart(2, '0')}`;
      existing[id] = seeded(id, 1, i < 4 ? 7 : 3);
    }
    const r = reconcileCards(input(), existing, opts());
    expect(r.created).toBe(0);
    expect(r.moved).toBe(16);
    const merged = { ...existing, ...r.cards };
    expect(perDay(merged)).toEqual([0, 8, 8, 8]);
    // the four interval-7 cards move, then the highest ids among the rest
    for (const id of ['dict:p00', 'dict:p03', 'dict:p23', 'dict:p12']) expect(r.cards[id]).toBeDefined();
    for (const id of ['dict:p04', 'dict:p11']) expect(r.cards[id]).toBeUndefined();
    for (const c of Object.values(r.cards)) expect(c.last).toBe(0);
    // stable afterwards
    expect(reconcileCards(input(), merged, opts())).toEqual({
      cards: {},
      created: 0,
      words: 0,
      moved: 0,
    });
  });

  it('minDay: KNOWN never lands today, STRONG not before day 2', () => {
    const r = reconcileCards(
      input({
        dictation: {
          s1: prog({ best: 1, attempts: 3 }),
          s2: prog({ best: 1, attempts: 1 }),
        },
      }),
      {},
      opts(),
    );
    expect(dayOf(r.cards['dict:s1'])).toBe(1);
    expect(dayOf(r.cards['dict:s2'])).toBe(2);
  });

  it('WEAK before LEARNED1 when days fill up', () => {
    const r = reconcileCards(
      input({
        dictation: weakMap(12),
        lessons: Object.fromEntries(
          ['intro', 'linking', 'flap-t'].map((id) => [
            id,
            { completedAt: BEFORE - DAY_MS, bestScore: 0.75, attempts: 1 },
          ]),
        ),
      }),
      {},
      opts(),
    );
    expect(perDay(r.cards)).toEqual([8, 7]);
    for (const id of ['lesson:intro', 'lesson:linking', 'lesson:flap-t']) expect(dayOf(r.cards[id])).toBe(1);
  });

  it('excludes the id being recorded and ids that already have a card', () => {
    const r = reconcileCards(
      input({ dictation: weakMap(3) }),
      { 'dict:s1': seeded('dict:s1', 2) },
      opts({ exclude: 'dict:s0' }),
    );
    expect(Object.keys(r.cards)).toEqual(['dict:s2']);
  });

  it('is idempotent and deterministic', () => {
    const inp = input({
      dictation: { ...weakMap(15), s40: prog({ best: 1, attempts: 2 }) },
      pairs: { items: { 'ill-1': stat({ streak: 0 }) }, sets: {} },
      media: [{ itemId: 'm1', unitCount: 2, scores: { 0: 0.4 } }],
    });
    const a = reconcileCards(inp, {}, opts());
    expect(reconcileCards(inp, {}, opts())).toEqual(a);
    const merged = { ...a.cards };
    expect(reconcileCards(inp, merged, opts())).toEqual({
      cards: {},
      created: 0,
      words: 0,
      moved: 0,
    });
    // later the same day: still nothing
    expect(reconcileCards(inp, merged, { since: SINCE, now: NOW + 3_600_000 })).toEqual({
      cards: {},
      created: 0,
      words: 0,
      moved: 0,
    });
  });

  it('a foreign progress map merged in later enrols only the new ids', () => {
    const first = reconcileCards(input({ dictation: weakMap(3) }), {}, opts());
    const second = reconcileCards(input({ dictation: { ...weakMap(3), ...weakMap(2, 10) } }), first.cards, opts());
    expect(Object.keys(second.cards).sort()).toEqual(['dict:s10', 'dict:s11']);
    expect(second.created).toBe(2);
  });
});
