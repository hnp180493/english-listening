import { describe, expect, it } from 'vitest';
import { NO_LISTENS, NORMAL_RATE_MIN, type ListenTally } from '../dictation/listens';
import { placeLines, TOWN_PLACES } from '../../data/town';
import { emptyTownProgress, recordLine, type TownProgress } from './progress';
import type { TownLine } from './types';
import {
  canAnswer,
  canTalk,
  CHOICE_COUNT,
  choiceSeed,
  choicesFor,
  confusability,
  conversationLines,
  DISTRACTOR_WINDOW,
  lineOutcome,
  notePlay,
  pickVisitLines,
  seededRandom,
  VISIT_SIZE,
  visitSummary,
} from './visit';

const T = 1_800_000_000_000;
const line = (id: string, level: 1 | 2 | 3, vi = `nghĩa ${id}`): TownLine => ({ id, text: `text ${id}`, vi, level });
const ids = (ls: readonly TownLine[]) => ls.map((l) => l.id);

describe('pickVisitLines', () => {
  const lines = [line('a3', 3), line('b1', 1), line('c2', 2), line('d1', 1), line('e2', 2), line('f3', 3), line('g1', 1)];

  it('a first visit takes the easiest lines, by level then id', () => {
    expect(VISIT_SIZE).toBe(5);
    expect(ids(pickVisitLines(lines, emptyTownProgress()))).toEqual(['b1', 'd1', 'g1', 'c2', 'e2']);
    expect(ids(pickVisitLines(lines, emptyTownProgress(), 2))).toEqual(['b1', 'd1']);
    expect(pickVisitLines([], emptyTownProgress())).toEqual([]);
    expect(pickVisitLines(lines, emptyTownProgress(), 0)).toEqual([]);
  });

  it('lines never understood come first (a missed one stays in), then replayed ones, then first-listen ones, oldest first', () => {
    const p: TownProgress = {
      ...emptyTownProgress(),
      lines: {
        b1: { best: 2, tries: 1, at: T + 5 },
        d1: { best: 1, tries: 2, at: T + 9 },
        g1: { best: 0, tries: 3, at: T + 99 }, // tried, not understood: still "never understood"
        c2: { best: 1, tries: 1, at: T + 1 },
        e2: { best: 2, tries: 1, at: T + 2 },
        a3: { best: 1, tries: 1, at: T + 1 }, // same time as c2: level, then id
      },
    };
    expect(ids(pickVisitLines(lines, p, 7))).toEqual(['g1', 'f3', 'c2', 'a3', 'd1', 'e2', 'b1']);
    expect(ids(pickVisitLines(lines, p))).toEqual(['g1', 'f3', 'c2', 'a3', 'd1']);
  });

  it('does not change its input and returns fewer lines when the place has fewer', () => {
    const copy = [...lines];
    pickVisitLines(lines, emptyTownProgress());
    expect(lines).toEqual(copy);
    expect(ids(pickVisitLines(lines.slice(0, 2), emptyTownProgress()))).toEqual(['b1', 'a3']);
  });

  it('visits walk through a whole place before any line repeats; then the oldest come back first', () => {
    const pool = placeLines('cafe');
    let p = emptyTownProgress();
    const asked: string[] = [];
    const fullVisits = Math.floor(pool.length / VISIT_SIZE);
    for (let visit = 0; visit < fullVisits; visit++) {
      for (const l of pickVisitLines(pool, p)) {
        asked.push(l.id);
        p = recordLine(p, l.id, 'first', T + asked.length);
      }
    }
    expect(new Set(asked).size).toBe(fullVisits * VISIT_SIZE);
    // the next visit: the lines still new, filled up with the ones understood longest ago
    const rest = pool.length - asked.length;
    const next = ids(pickVisitLines(pool, p));
    expect(next.slice(0, rest).some((id) => asked.includes(id))).toBe(false);
    expect(next.slice(rest)).toEqual(asked.slice(0, VISIT_SIZE - rest));
  });
});

describe('choicesFor', () => {
  it('for every line of the town: three different meanings, the right one once, the others from the same place', () => {
    const positions = [0, 0, 0];
    let sameLevel = 0;
    let wrongTotal = 0;
    for (const place of TOWN_PLACES) {
      const pool = placeLines(place.id);
      const byVi = new Map(pool.map((l) => [l.vi, l]));
      for (const l of pool) {
        const c = choicesFor(l, pool, 0);
        expect(c.options).toHaveLength(CHOICE_COUNT);
        expect(c.options[c.answer]).toBe(l.vi);
        expect(new Set(c.options).size).toBe(CHOICE_COUNT);
        expect(c.options.filter((o) => o === l.vi)).toHaveLength(1);
        positions[c.answer] += 1;
        c.options.forEach((o, i) => {
          if (i === c.answer) return;
          const from = byVi.get(o);
          expect(from, `${l.id}: "${o}" is a line of ${place.name}`).toBeDefined();
          wrongTotal += 1;
          if (from!.level === l.level) sameLevel += 1;
        });
      }
    }
    // the right meaning is not parked at one position
    for (const n of positions) expect(n).toBeGreaterThan(60);
    // same-level meanings whenever the place has them (every topic has several lines per level)
    expect(sameLevel).toBe(wrongTotal);
  });

  it('is deterministic for a seed, and a repeat never shows the right meaning where it was', () => {
    const pool = placeLines('square');
    for (const l of pool) {
      expect(choicesFor(l, pool, 3)).toEqual(choicesFor(l, pool, 3));
      const seen = new Set<number>();
      for (let seed = 0; seed < 9; seed++) {
        expect(choicesFor(l, pool, seed).answer).not.toBe(choicesFor(l, pool, seed + 1).answer);
        seen.add(choicesFor(l, pool, seed).answer);
      }
      expect(seen.size).toBe(3); // every position gets its turn
    }
    // not every repeat offers the same two wrong meanings
    const l = pool[0];
    const wrongSets = new Set([0, 1, 2, 3, 4, 5].map((s) => choicesFor(l, pool, s).options.filter((o) => o !== l.vi).sort().join('|')));
    expect(wrongSets.size).toBeGreaterThan(1);
  });

  it('prefers the same level, then the nearest; never offers two meanings that read the same', () => {
    const target = line('x', 1, 'Bạn ăn gì chưa?');
    const pool = [
      target,
      line('same', 3, 'bạn ăn gì chưa'), // the same meaning in other clothes
      line('dup1', 3, 'Trời đẹp quá.'),
      line('dup2', 3, 'Trời đẹp quá!'),
      line('far', 3, 'Hẹn gặp lại.'),
      line('near', 2, 'Mình về đây.'),
      line('lvl1', 1, 'Cảm ơn nhé.'),
    ];
    for (let seed = 0; seed < 12; seed++) {
      const c = choicesFor(target, pool, seed);
      const wrong = c.options.filter((_, i) => i !== c.answer).sort();
      expect(wrong).toEqual(['Cảm ơn nhé.', 'Mình về đây.']);
    }
    // only level-3 lines left: one of the two that read the same, never both
    const far = choicesFor(target, pool.filter((l) => l.level !== 2 && l.id !== 'lvl1'), 1);
    expect(far.options).toHaveLength(3);
    expect(far.options.filter((o) => o.startsWith('Trời đẹp')).length).toBe(1);
    expect(far.options).not.toContain('bạn ăn gì chưa');
  });

  it('confusability: shared words weigh most, then the same kind of sentence, then a similar length', () => {
    const right = 'Bạn muốn ăn gì?';
    const shared = confusability(right, 'Bạn ăn gì chưa?');
    const question = confusability(right, 'Mấy giờ rồi nhỉ?');
    const statement = confusability(right, 'Trời đẹp quá đi.');
    expect(shared).toBeGreaterThan(question);
    expect(question).toBeGreaterThan(statement);
    expect(confusability(right, 'Trời đẹp quá đi.')).toBeGreaterThan(confusability(right, 'Hôm qua trời mưa to nên cả nhà mình ở nhà xem phim tới khuya.'));
    expect(confusability(right, right)).toBeCloseTo(1);
    expect(confusability('Bạn muốn ăn gì?', 'bạn  muốn ăn gì')).toBeCloseTo(0.75); // the same words, only the "?" differs
    expect(confusability('a b', 'b a')).toBe(confusability('b a', 'a b'));
    for (const [a, b] of [['', ''], ['', 'x'], ['?', '!']]) expect(Number.isFinite(confusability(a, b))).toBe(true);
  });

  it('the wrong meanings are the confusable ones: always two of the few most confusable lines of the same level', () => {
    const target = line('x', 1, 'Bạn muốn uống cà phê không?');
    const hard = [
      line('h1', 1, 'Bạn muốn uống trà không?'),
      line('h2', 1, 'Bạn có uống cà phê không?'),
      line('h3', 1, 'Bạn muốn ăn gì không?'),
      line('h4', 1, 'Bạn thích cà phê sữa không?'),
    ];
    const easy = [
      line('e1', 1, 'Trời hôm nay đẹp quá.'),
      line('e2', 1, 'Mình về trước đây.'),
      line('e3', 1, 'Xe buýt tới rồi kìa.'),
      line('e4', 1, 'Cảm ơn nhiều lắm.'),
      line('e5', 1, 'Hẹn mai gặp lại.'),
    ];
    // very confusable but of another level: only used when the same level runs out
    const other = [line('o1', 3, 'Bạn muốn uống cà phê đá không?'), line('o2', 2, 'Bạn muốn uống nước cam không?')];
    const pool = [easy[0], target, ...other, easy[1], hard[2], easy[2], hard[0], easy[3], hard[3], easy[4], hard[1]];
    expect(hard).toHaveLength(DISTRACTOR_WINDOW);
    const hardVi = new Set(hard.map((l) => l.vi));
    const sets = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const c = choicesFor(target, pool, seed);
      const wrong = c.options.filter((_, i) => i !== c.answer);
      expect(wrong).toHaveLength(2);
      for (const w of wrong) expect(hardVi.has(w), `seed ${seed}: "${w}"`).toBe(true);
      sets.add([...wrong].sort().join('|'));
    }
    // the seed moves through the window: not always the same two
    expect(sets.size).toBeGreaterThanOrEqual(4);
    // the order of the pool does not matter
    expect(choicesFor(target, [...pool].reverse(), 5)).toEqual(choicesFor(target, pool, 5));
  });

  it('never offers a meaning that is nearly the right one, nor two wrong ones that are nearly the same', () => {
    const target = line('x', 1, 'Bạn khỏe không?');
    const pool = [
      target,
      line('p1', 1, 'Bạn khỏe không nhỉ?'), // the same with a closing particle
      line('p2', 1, 'Bạn có khỏe không?'), // the same plus one word
      line('p3', 1, 'bạn khỏe  không'), // the same in other clothes
      line('a', 1, 'Bạn đói không?'),
      line('a2', 1, 'Bạn có đói không?'), // nearly `a`: never together with it
      line('b', 1, 'Mẹ bạn khỏe không?'), // one more word: the rule is cautious and treats it as nearly the same
      line('c', 1, 'Bạn mệt à?'),
    ];
    const seen = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      const c = choicesFor(target, pool, seed);
      const wrong = c.options.filter((_, i) => i !== c.answer);
      for (const w of wrong) seen.add(w);
      expect(wrong).toHaveLength(2);
      for (const banned of ['Bạn khỏe không nhỉ?', 'Bạn có khỏe không?', 'bạn khỏe  không', 'Mẹ bạn khỏe không?']) expect(wrong).not.toContain(banned);
      expect(wrong.includes('Bạn đói không?') && wrong.includes('Bạn có đói không?')).toBe(false);
    }
    expect(seen.has('Bạn mệt à?')).toBe(true);
  });

  it('a negation is not a duplicate: "can" against "cannot" is exactly what the ear must tell apart', () => {
    const target = line('x', 1, 'Mình đi được.');
    const pool = [target, line('neg', 1, 'Mình không đi được.'), line('z', 1, 'Trời mưa rồi.')];
    const c = choicesFor(target, pool, 0);
    expect(c.options).toHaveLength(3);
    expect(c.options).toContain('Mình không đi được.');
  });

  it('on the real lines: harder than a random pick of the same place, and no two options a learner could not tell apart', () => {
    let chosen = 0;
    let chosenN = 0;
    let all = 0;
    let allN = 0;
    for (const place of TOWN_PLACES) {
      const pool = placeLines(place.id);
      for (const l of pool) {
        for (const other of pool) {
          if (other.id === l.id || other.level !== l.level) continue;
          all += confusability(l.vi, other.vi);
          allN += 1;
        }
        for (const seed of [0, 1, 2]) {
          const c = choicesFor(l, pool, seed);
          const [w1, w2] = c.options.filter((_, i) => i !== c.answer);
          chosen += confusability(l.vi, w1) + confusability(l.vi, w2);
          chosenN += 2;
          // not the same sentence in other words (what nearSame guards): the shared-word share stays below 1
          for (const [a, b] of [[l.vi, w1], [l.vi, w2], [w1, w2]]) expect(confusability(a, b), `${l.id}: "${a}" / "${b}"`).toBeLessThan(0.9);
        }
      }
    }
    const meanChosen = chosen / chosenN;
    const meanAll = all / allN;
    expect(meanChosen).toBeGreaterThan(meanAll + 0.03);
    // a known hard pair of Quán cà phê
    const cafe = placeLines('cafe');
    const eaten = cafe.find((l) => l.vi === 'Bạn ăn gì chưa?')!;
    const offered = new Set([0, 1, 2, 3, 4, 5, 6, 7].flatMap((seed) => choicesFor(eaten, cafe, seed).options));
    expect(offered.has('Bạn muốn ăn gì?')).toBe(true);
  });

  it('a pool too small gives fewer options, the right one always there; odd seeds are safe', () => {
    const a = line('a', 1);
    const b = line('b', 1);
    expect(choicesFor(a, [a], 0)).toEqual({ options: [a.vi], answer: 0 });
    expect(choicesFor(a, [], 5)).toEqual({ options: [a.vi], answer: 0 });
    const two = choicesFor(a, [a, b], 0);
    expect(two.options.slice().sort()).toEqual([a.vi, b.vi]);
    expect(choicesFor(a, [a, b], 1).answer).not.toBe(two.answer);
    for (const seed of [-3, 2.7, Number.NaN, Number.POSITIVE_INFINITY, 1e12]) {
      const c = choicesFor(a, [a, b, line('c', 1)], seed);
      expect(c.options[c.answer]).toBe(a.vi);
      expect(c.options).toHaveLength(3);
    }
  });

  it('choiceSeed is the number of earlier answers', () => {
    const p = recordLine(recordLine(emptyTownProgress(), 's001', 'wrong', T), 's001', 'replayed', T + 1);
    expect(choiceSeed(p, 's001')).toBe(2);
    expect(choiceSeed(p, 's002')).toBe(0);
  });

  it('seededRandom repeats for a seed and stays in [0, 1)', () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    const xs = Array.from({ length: 200 }, () => a());
    expect(Array.from({ length: 200 }, () => b())).toEqual(xs);
    for (const x of xs) expect(x >= 0 && x < 1).toBe(true);
    expect(new Set(xs).size).toBeGreaterThan(190);
    expect(seededRandom(43)()).not.toBe(xs[0]);
  });
});

describe('lineOutcome', () => {
  const t = (normal: number, slow = 0, chunks = 0): ListenTally => ({ normal, slow, chunks });

  it("'first' only for the right meaning after exactly one play at the normal speed", () => {
    expect(lineOutcome(true, t(1))).toBe('first');
    expect(lineOutcome(true, t(2))).toBe('replayed');
    expect(lineOutcome(true, t(1, 1))).toBe('replayed');
    expect(lineOutcome(true, t(0, 1))).toBe('replayed');
    expect(lineOutcome(false, t(1))).toBe('wrong');
    expect(lineOutcome(false, t(3, 2))).toBe('wrong');
  });

  it('nothing played: nothing to record (a guess is not listening)', () => {
    for (const none of [NO_LISTENS, null, undefined]) {
      expect(canAnswer(none)).toBe(false);
      expect(lineOutcome(true, none)).toBeNull();
      expect(lineOutcome(false, none)).toBeNull();
    }
    expect(canAnswer(t(0, 1))).toBe(true);
  });

  it('notePlay: a normal play with Tốc độ đọc below normal speed counts as a slowed one', () => {
    let tally = notePlay(null, 'normal', 1);
    expect(tally).toEqual(t(1));
    expect(lineOutcome(true, tally)).toBe('first');
    tally = notePlay(tally, 'slow', 1);
    expect(tally).toEqual(t(1, 1));
    expect(lineOutcome(true, tally)).toBe('replayed');
    const slowed = notePlay(NO_LISTENS, 'normal', NORMAL_RATE_MIN - 0.05);
    expect(slowed).toEqual(t(0, 1));
    expect(lineOutcome(true, slowed)).toBe('replayed');
    expect(notePlay(NO_LISTENS, 'normal', NORMAL_RATE_MIN)).toEqual(t(1));
    expect(NO_LISTENS).toEqual(t(0)); // never changed in place
  });
});

describe('visitSummary', () => {
  it('counts the outcomes; perfect = all five lines, none wrong', () => {
    expect(visitSummary(['first', 'replayed', 'wrong', 'first', 'wrong'])).toEqual({ lines: 5, understood: 3, first: 2, wrong: 2, perfect: false });
    expect(visitSummary(['first', 'replayed', 'first', 'first', 'replayed'])).toEqual({ lines: 5, understood: 5, first: 3, wrong: 0, perfect: true });
    expect(visitSummary(['first', 'first'])).toEqual({ lines: 2, understood: 2, first: 2, wrong: 0, perfect: false }); // left early
    expect(visitSummary([])).toEqual({ lines: 0, understood: 0, first: 0, wrong: 0, perfect: false });
  });
});

describe('a conversation needs a built place', () => {
  it('the three free places can be talked at from the start; an empty lot says nothing until it is built', () => {
    const p0 = emptyTownProgress();
    for (const id of ['square', 'cafe', 'friend']) {
      expect(canTalk(p0, id)).toBe(true);
      expect(conversationLines(p0, id)).toEqual(pickVisitLines(placeLines(id), p0));
      expect(conversationLines(p0, id)).toHaveLength(VISIT_SIZE);
    }
    for (const place of TOWN_PLACES.filter((x) => x.cost > 0)) {
      expect(canTalk(p0, place.id), place.id).toBe(false);
      expect(conversationLines(p0, place.id)).toEqual([]);
    }
    const built: TownProgress = { ...p0, bought: ['home'] };
    expect(canTalk(built, 'home')).toBe(true);
    expect(conversationLines(built, 'home')).toHaveLength(VISIT_SIZE);
    expect(conversationLines(built, 'home', 3)).toHaveLength(3);
    expect(canTalk(built, 'shop')).toBe(false);
    expect(canTalk(built, 'nope')).toBe(false);
    expect(canTalk(built, 'lamps1')).toBe(false); // a decoration is not a place
    expect(conversationLines(built, 'nope')).toEqual([]);
  });

  it('the next conversation follows what was understood', () => {
    let p = emptyTownProgress();
    const first = conversationLines(p, 'cafe');
    for (const l of first) p = recordLine(p, l.id, 'first', T);
    const second = conversationLines(p, 'cafe');
    expect(second.some((l) => first.includes(l))).toBe(false);
  });
});
