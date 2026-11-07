import { describe, expect, it } from 'vitest';
import type { PairSet } from '../../data/pairs';
import {
  advance,
  applyAnswer,
  applySetResult,
  buildRound,
  createRng,
  currentQuestion,
  emptyProgress,
  isFinished,
  isMastered,
  isWeak,
  itemPriority,
  lessonIdFor,
  optionIndexForKey,
  perSetCap,
  requeuePosition,
  roundForRoute,
  roundKeyAction,
  routeSyncAction,
  sanitizeProgress,
  scoreTier,
  setMastery,
  setsForFocus,
  shuffle,
  startRound,
  submitAnswer,
  summarizeRound,
  weakItemIds,
  type PairsProgress,
  type Question,
  type RoundKeyContext,
} from './game';

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;

function makeSet(id: string, n: number, phenomenon: PairSet['phenomenon'] = 'contraction'): PairSet {
  return {
    id,
    title: id,
    description: 'd',
    phenomenon,
    contrast: [],
    items: Array.from({ length: n }, (_, i) => ({
      id: `${id}-${i + 1}`,
      options: [`${id} a ${i}`, `${id} b ${i}`],
      cue: 'c',
    })),
  };
}

function q(itemId: string, answer = 0, setId = 's'): Question {
  return { key: `${itemId}#0`, setId, itemId, answer, requeue: false };
}

describe('createRng / shuffle', () => {
  it('is deterministic for a seed and in [0,1)', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 50; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('different seeds give different sequences', () => {
    expect(createRng(1)()).not.toBe(createRng(2)());
  });

  it('shuffle keeps all elements and does not mutate input', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(arr, createRng(7));
    expect(arr).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...out].sort((x, y) => x - y)).toEqual(arr);
    expect(shuffle(arr, createRng(7))).toEqual(out);
  });
});

describe('buildRound', () => {
  const sets = [makeSet('a', 8), makeSet('b', 8), makeSet('c', 8)];

  it('returns 10 distinct questions by default', () => {
    const round = buildRound(sets, emptyProgress(), { seed: 1, now: NOW });
    expect(round).toHaveLength(10);
    expect(new Set(round.map((x) => x.itemId)).size).toBe(10);
    expect(round.every((x) => !x.requeue && x.key.endsWith('#0'))).toBe(true);
  });

  it('is deterministic for the same seed', () => {
    const p = emptyProgress();
    expect(buildRound(sets, p, { seed: 9, now: NOW })).toEqual(buildRound(sets, p, { seed: 9, now: NOW }));
  });

  it('answers are valid option indexes', () => {
    const round = buildRound(sets, emptyProgress(), { seed: 3, now: NOW, size: 24 });
    for (const x of round) {
      expect(x.answer).toBeGreaterThanOrEqual(0);
      expect(x.answer).toBeLessThan(2);
    }
  });

  it('shrinks to the number of available items', () => {
    const round = buildRound([makeSet('x', 4)], emptyProgress(), { seed: 1, now: NOW });
    expect(round).toHaveLength(4);
  });

  it('returns an empty round for no sets', () => {
    expect(buildRound([], emptyProgress(), { seed: 1, now: NOW })).toEqual([]);
  });

  it('prioritises weak items', () => {
    let p: PairsProgress = emptyProgress();
    // master everything in set a and b, except two weak items in c
    for (const s of sets) for (const it of s.items) p = applyAnswer(applyAnswer(p, it.id, true, NOW), it.id, true, NOW);
    p = applyAnswer(p, 'c-1', false, NOW);
    p = applyAnswer(p, 'c-2', false, NOW);
    for (let seed = 1; seed < 20; seed++) {
      const ids = buildRound(sets, p, { seed, now: NOW, size: 4 }).map((x) => x.itemId);
      expect(ids).toContain('c-1');
      expect(ids).toContain('c-2');
    }
  });

  it('caps questions per set in mixed rounds', () => {
    const many = Array.from({ length: 6 }, (_, i) => makeSet(`s${i}`, 8));
    const round = buildRound(many, emptyProgress(), { seed: 5, now: NOW });
    const counts = new Map<string, number>();
    for (const x of round) counts.set(x.setId, (counts.get(x.setId) ?? 0) + 1);
    const cap = perSetCap(6, 10);
    for (const n of counts.values()) expect(n).toBeLessThanOrEqual(cap);
  });

  it('fills beyond the cap when sets are too few', () => {
    const round = buildRound([makeSet('a', 8), makeSet('b', 2)], emptyProgress(), { seed: 2, now: NOW });
    expect(round).toHaveLength(10);
  });

  it('restricts to onlyItemIds', () => {
    const round = buildRound(sets, emptyProgress(), { seed: 1, now: NOW, onlyItemIds: ['a-1', 'b-3'] });
    expect(round.map((x) => x.itemId).sort()).toEqual(['a-1', 'b-3']);
  });

  it('perSetCap allows whole set for single-set rounds', () => {
    expect(perSetCap(1, 10)).toBe(10);
    expect(perSetCap(16, 10)).toBe(2);
    expect(perSetCap(3, 10)).toBe(5);
  });
});

describe('itemPriority / weakness', () => {
  it('weak > new > mastered', () => {
    const weak = { seen: 3, correct: 1, streak: 0, lastAt: NOW };
    const mastered = { seen: 4, correct: 4, streak: 4, lastAt: NOW };
    expect(itemPriority(weak, NOW)).toBeGreaterThan(itemPriority(undefined, NOW));
    expect(itemPriority(undefined, NOW)).toBeGreaterThan(itemPriority(mastered, NOW));
  });

  it('long-unseen items drift up', () => {
    const st = { seen: 2, correct: 2, streak: 2, lastAt: NOW - 30 * DAY };
    expect(itemPriority(st, NOW)).toBeGreaterThan(itemPriority({ ...st, lastAt: NOW }, NOW));
  });

  it('isWeak / isMastered', () => {
    expect(isWeak(undefined)).toBe(false);
    expect(isWeak({ seen: 1, correct: 0, streak: 0, lastAt: NOW })).toBe(true);
    expect(isWeak({ seen: 5, correct: 2, streak: 1, lastAt: NOW })).toBe(true);
    expect(isWeak({ seen: 3, correct: 3, streak: 3, lastAt: NOW })).toBe(false);
    expect(isMastered({ seen: 2, correct: 2, streak: 2, lastAt: NOW })).toBe(true);
    expect(isMastered({ seen: 2, correct: 1, streak: 1, lastAt: NOW })).toBe(false);
  });

  it('weakItemIds lists weak items weakest first', () => {
    const set = makeSet('w', 4);
    let p = emptyProgress();
    p = applyAnswer(p, 'w-1', false, NOW);
    p = applyAnswer(p, 'w-2', true, NOW);
    p = applyAnswer(applyAnswer(p, 'w-3', false, NOW), 'w-3', false, NOW);
    expect(weakItemIds([set], p, NOW)).toEqual(['w-1', 'w-3']);
  });

  it('setMastery counts seen, mastered and weak items', () => {
    const set = makeSet('m', 3);
    let p = emptyProgress();
    p = applyAnswer(applyAnswer(p, 'm-1', true, NOW), 'm-1', true, NOW);
    p = applyAnswer(p, 'm-2', false, NOW);
    expect(setMastery(set, p)).toEqual({ total: 3, seen: 2, mastered: 1, weak: 1 });
  });
});

describe('progress updates and sanitizing', () => {
  it('applyAnswer tracks seen, correct, streak, lastAt', () => {
    let p = applyAnswer(emptyProgress(), 'x', true, NOW);
    p = applyAnswer(p, 'x', true, NOW + 1);
    expect(p.items.x).toEqual({ seen: 2, correct: 2, streak: 2, lastAt: NOW + 1 });
    p = applyAnswer(p, 'x', false, NOW + 2);
    expect(p.items.x).toEqual({ seen: 3, correct: 2, streak: 0, lastAt: NOW + 2 });
  });

  it('applySetResult keeps the best score and counts plays', () => {
    let p = applySetResult(emptyProgress(), 's', 0.8, NOW);
    p = applySetResult(p, 's', 0.5, NOW + 1);
    expect(p.sets.s).toEqual({ best: 0.8, plays: 2, lastAt: NOW + 1 });
    expect(applySetResult(emptyProgress(), 's', 7, NOW).sets.s.best).toBe(1);
  });

  it('sanitizeProgress repairs corrupt data', () => {
    expect(sanitizeProgress(null)).toEqual(emptyProgress());
    expect(sanitizeProgress('junk')).toEqual(emptyProgress());
    expect(sanitizeProgress([1, 2])).toEqual(emptyProgress());
    const p = sanitizeProgress({
      items: {
        a: { seen: 3, correct: 9, streak: 5, lastAt: 'x' },
        b: null,
        c: { seen: -1 },
        d: { seen: 2.7, correct: 1, streak: 1, lastAt: NOW },
      },
      sets: { s: { best: 3, plays: 'two' }, t: 5 },
    });
    expect(p.items).toEqual({
      a: { seen: 3, correct: 3, streak: 3, lastAt: 0 },
      d: { seen: 2, correct: 1, streak: 1, lastAt: NOW },
    });
    expect(p.sets).toEqual({ s: { best: 1, plays: 0, lastAt: 0 } });
  });
});

describe('round state', () => {
  it('correct answers advance without requeue', () => {
    let s = startRound([q('a', 0), q('b', 1)]);
    s = submitAnswer(s, 0);
    expect(s.queue).toHaveLength(2);
    s = advance(s);
    expect(currentQuestion(s)?.itemId).toBe('b');
    s = advance(submitAnswer(s, 1));
    expect(isFinished(s)).toBe(true);
  });

  it('cannot advance before answering, and answers only once', () => {
    let s = startRound([q('a', 0)]);
    expect(advance(s)).toBe(s);
    s = submitAnswer(s, 1);
    expect(submitAnswer(s, 0)).toBe(s);
  });

  it('wrong answer re-queues the item later, once', () => {
    let s = startRound([q('a'), q('b'), q('c'), q('d'), q('e'), q('f')]);
    s = submitAnswer(s, 1, 1);
    expect(s.queue.map((x) => x.key)).toEqual(['a#0', 'b#0', 'c#0', 'd#0', 'a#1', 'e#0', 'f#0']);
    expect(s.queue[4]).toMatchObject({ requeue: true, answer: 1 });
    // skip to the requeued question and miss it again: no third copy
    for (let i = 0; i < 4; i++) s = advance(submitAnswer(s, s.queue[s.index].answer));
    expect(currentQuestion(s)?.key).toBe('a#1');
    s = submitAnswer(s, 0);
    expect(s.queue.filter((x) => x.itemId === 'a')).toHaveLength(2);
  });

  it('requeue near the end goes to the end', () => {
    expect(requeuePosition(8, 10)).toBe(10);
    expect(requeuePosition(0, 10)).toBe(4);
    let s = startRound([q('a'), q('b')]);
    s = advance(submitAnswer(s, 0));
    s = submitAnswer(s, 1);
    expect(s.queue.map((x) => x.key)).toEqual(['a#0', 'b#0', 'b#1']);
  });

  it('requeue keeps the played option when no replay answer is given', () => {
    const s = submitAnswer(startRound([q('a', 1)]), 0);
    expect(s.queue[1]).toMatchObject({ key: 'a#1', answer: 1 });
  });
});

describe('summarizeRound', () => {
  it('scores first answers only and reports recoveries', () => {
    let s = startRound([q('a', 0, 'x'), q('b', 0, 'x'), q('c', 0, 'y')]);
    s = advance(submitAnswer(s, 1)); // a wrong -> requeued at end
    s = advance(submitAnswer(s, 0)); // b right
    s = advance(submitAnswer(s, 0)); // c right
    s = advance(submitAnswer(s, 0)); // a#1 right (recovered)
    expect(isFinished(s)).toBe(true);
    const sum = summarizeRound(s);
    expect(sum.total).toBe(3);
    expect(sum.correct).toBe(2);
    expect(sum.score).toBeCloseTo(2 / 3);
    expect(sum.requeued).toBe(1);
    expect(sum.recovered).toBe(1);
    expect(sum.missed).toEqual([{ setId: 'x', itemId: 'a', answer: 0, choice: 1, recovered: true }]);
    expect(sum.bySet).toEqual([
      { setId: 'x', total: 2, correct: 1 },
      { setId: 'y', total: 1, correct: 1 },
    ]);
  });

  it('handles an empty or partial round', () => {
    expect(summarizeRound(startRound([]))).toMatchObject({ total: 0, score: 0, missed: [] });
    const s = submitAnswer(startRound([q('a'), q('b')]), 1);
    expect(summarizeRound(s).missed[0].recovered).toBeNull();
  });

  it('scoreTier picks a tone', () => {
    expect(scoreTier(1, 10).tone).toBe('great');
    expect(scoreTier(0.7, 10).tone).toBe('good');
    expect(scoreTier(0.3, 10).tone).toBe('practice');
    expect(scoreTier(0, 0).title).toBeTruthy();
  });
});

describe('helpers', () => {
  it('setsForFocus filters by phenomenon', () => {
    const sets = [makeSet('a', 1, 'linking'), makeSet('b', 1, 'flap-t')];
    expect(setsForFocus(sets, 'flap-t').map((s) => s.id)).toEqual(['b']);
    expect(setsForFocus(sets, null)).toHaveLength(2);
  });

  it('lessonIdFor finds the lesson or falls back', () => {
    const lessons = [
      { id: 'l-flap', course: 'connected' as const, order: 1, title: '', summary: '', phenomenon: 'flap-t' as const, minutes: 5 },
      // Only course "connected" lessons teach a phenomenon: another course never takes the link.
      { id: 'x-link', course: 'spelling' as const, order: 1, title: '', summary: '', phenomenon: 'linking' as const, minutes: 5 },
    ];
    expect(lessonIdFor('flap-t', lessons)).toBe('l-flap');
    expect(lessonIdFor('linking', lessons)).toBe('linking');
  });

  it('optionIndexForKey maps digit keys', () => {
    expect(optionIndexForKey('1', 2)).toBe(0);
    expect(optionIndexForKey('3', 3)).toBe(2);
    expect(optionIndexForKey('3', 2)).toBe(-1);
    expect(optionIndexForKey('r', 2)).toBe(-1);
  });
});

describe('review fixes', () => {
  const ctx = (o: Partial<RoundKeyContext> = {}): RoundKeyContext => ({
    answered: false,
    optionCount: 3,
    onControl: false,
    ignore: false,
    repeat: false,
    ...o,
  });

  it('roundKeyAction: digits choose before answering, compare after', () => {
    expect(roundKeyAction('2', ctx())).toEqual({ type: 'choose', index: 1 });
    expect(roundKeyAction('2', ctx({ answered: true }))).toEqual({ type: 'compare', index: 1 });
    expect(roundKeyAction('4', ctx())).toBeNull();
    expect(roundKeyAction('3', ctx({ optionCount: 2 }))).toBeNull();
  });

  it('roundKeyAction: R / S play, case-insensitive', () => {
    expect(roundKeyAction('r', ctx())).toEqual({ type: 'replay' });
    expect(roundKeyAction('R', ctx({ answered: true }))).toEqual({ type: 'replay' });
    expect(roundKeyAction('S', ctx())).toEqual({ type: 'slow' });
  });

  it('roundKeyAction: Enter/Space go next only after answering and never scroll', () => {
    expect(roundKeyAction('Enter', ctx({ answered: true }))).toEqual({ type: 'next' });
    expect(roundKeyAction(' ', ctx({ answered: true }))).toEqual({ type: 'next' });
    // before answering Space replays instead of scrolling the page
    expect(roundKeyAction(' ', ctx())).toEqual({ type: 'replay' });
    // on a focused button the browser activates it natively
    expect(roundKeyAction('Enter', ctx({ answered: true, onControl: true }))).toBeNull();
    expect(roundKeyAction(' ', ctx({ onControl: true }))).toBeNull();
  });

  it('roundKeyAction: held keys are swallowed so questions are not skipped', () => {
    expect(roundKeyAction('Enter', ctx({ answered: true, repeat: true }))).toEqual({ type: 'block' });
    expect(roundKeyAction('Enter', ctx({ answered: true, onControl: true, repeat: true }))).toEqual({ type: 'block' });
    expect(roundKeyAction('1', ctx({ repeat: true }))).toEqual({ type: 'block' });
    expect(roundKeyAction('r', ctx({ repeat: true }))).toEqual({ type: 'block' });
  });

  it('roundKeyAction: ignores typing targets / modifiers and unrelated keys', () => {
    expect(roundKeyAction('1', ctx({ ignore: true }))).toBeNull();
    expect(roundKeyAction('Enter', ctx({ answered: true, ignore: true }))).toBeNull();
    expect(roundKeyAction('x', ctx())).toBeNull();
    expect(roundKeyAction('Tab', ctx({ answered: true }))).toBeNull();
  });

  it('submitAnswer rejects invalid choices', () => {
    const s = startRound([q('a', 0)]);
    expect(submitAnswer(s, -1)).toBe(s);
    expect(submitAnswer(s, 0.5)).toBe(s);
    expect(submitAnswer(s, Number.NaN)).toBe(s);
  });

  it('sanitizeProgress drops unsafe keys like __proto__', () => {
    const raw = JSON.parse(
      '{"items":{"__proto__":{"seen":3,"correct":1,"streak":0},"ok-1":{"seen":1,"correct":1,"streak":1},"bad id!":{"seen":1}},"sets":{"constructor":{"best":1}}}',
    );
    const p = sanitizeProgress(raw);
    expect(Object.keys(p.items)).toEqual(['ok-1']);
    expect(Object.getPrototypeOf(p.items)).toBe(Object.prototype);
    expect(Object.keys(p.sets)).toEqual([]);
  });

  it('a full round never loops: every wrong answer adds at most one question', () => {
    const sets = [makeSet('a', 8), makeSet('b', 8)];
    const queue = buildRound(sets, emptyProgress(), { seed: 7, now: NOW });
    let s = startRound(queue);
    let steps = 0;
    while (!isFinished(s) && steps < 100) {
      const cur = currentQuestion(s)!;
      s = advance(submitAnswer(s, cur.answer === 0 ? 1 : 0, 0)); // always wrong
      steps += 1;
    }
    expect(isFinished(s)).toBe(true);
    expect(steps).toBe(queue.length * 2);
    const sum = summarizeRound(s);
    expect(sum.total).toBe(queue.length);
    expect(sum.requeued).toBe(queue.length);
  });
});

describe('route <-> round sync', () => {
  const has = (id: string) => id === 'can-cant';

  it('reads the round a pairs URL names', () => {
    expect(roundForRoute({ set: 'can-cant' }, null, has)).toEqual({ kind: 'set', setId: 'can-cant' });
    expect(roundForRoute({ set: 'nope' }, null, has)).toBeNull();
    expect(roundForRoute({ mode: 'mix' }, 'linking', has)).toEqual({ kind: 'mix', focus: 'linking' });
    expect(roundForRoute({ set: 'can-cant', mode: 'mix' }, null, has)).toEqual({ kind: 'set', setId: 'can-cant' });
    expect(roundForRoute({}, 'linking', has)).toBeNull();
    expect(roundForRoute({ mode: 'other' }, null, has)).toBeNull();
  });

  it('clears any running round when the URL names none (AppNav, filter chip, Back)', () => {
    expect(routeSyncAction({ kind: 'mix', focus: 'linking' }, null)).toBe('clear');
    expect(routeSyncAction({ kind: 'review' }, null)).toBe('clear');
    expect(routeSyncAction({ kind: 'set', setId: 'can-cant' }, null)).toBe('clear');
    expect(routeSyncAction(null, null)).toBe('keep');
  });

  it('keeps a round that already matches the URL and starts one that does not', () => {
    expect(routeSyncAction({ kind: 'set', setId: 'a' }, { kind: 'set', setId: 'a' })).toBe('keep');
    expect(routeSyncAction({ kind: 'set', setId: 'a' }, { kind: 'set', setId: 'b' })).toBe('start');
    expect(routeSyncAction({ kind: 'mix', focus: null }, { kind: 'mix', focus: null })).toBe('keep');
    expect(routeSyncAction({ kind: 'mix', focus: null }, { kind: 'mix', focus: 'linking' })).toBe('start');
    expect(routeSyncAction({ kind: 'review' }, { kind: 'mix', focus: null })).toBe('start');
    expect(routeSyncAction(null, { kind: 'set', setId: 'a' })).toBe('start');
  });
});
