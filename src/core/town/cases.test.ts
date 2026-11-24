import { describe, expect, it } from 'vitest';
import { TOWN_CASES } from '../../data/cases';
import { TOWN_PLACES } from '../../data/town';
import { caseLineId, caseNow, chapterStars, chapterXu, cluesOf, emptyTownCases, mergeTownCases, parseTownCases, solveChapter } from './cases';

const T = new Date(2026, 10, 24, 10).getTime();
const DAY = 86400000;
const C1 = TOWN_CASES[0];

describe('one chapter a day', () => {
  it('the first chapter is open; the next one opens the day after the last was solved', () => {
    const fresh = emptyTownCases();
    expect(caseNow(TOWN_CASES, fresh, T)).toMatchObject({ kind: 'open', chapter: 0 });
    const one = solveChapter(fresh, C1, 0, 3, T);
    expect(one).toMatchObject({ first: true, xu: chapterXu(3), closed: false });
    // the same day, even late at night: tomorrow
    expect(caseNow(TOWN_CASES, one.cases, T + 13 * 3600_000)).toMatchObject({ kind: 'tomorrow', chapter: 1 });
    expect(caseNow(TOWN_CASES, one.cases, T + DAY)).toMatchObject({ kind: 'open', chapter: 1 });
    // days later: still just the next chapter
    expect(caseNow(TOWN_CASES, one.cases, T + 9 * DAY)).toMatchObject({ kind: 'open', chapter: 1 });
  });

  it('a case closes with its fifth chapter; the next case starts the day after; then nothing is left', () => {
    let s = emptyTownCases();
    for (let ch = 0; ch < 5; ch++) {
      const r = solveChapter(s, C1, ch, 2, T + ch * DAY);
      expect(r.closed).toBe(ch === 4);
      s = r.cases;
    }
    expect(caseNow(TOWN_CASES, s, T + 4 * DAY)).toMatchObject({ kind: 'tomorrow', case: TOWN_CASES[1], chapter: 0 });
    expect(caseNow(TOWN_CASES, s, T + 5 * DAY)).toMatchObject({ kind: 'open', case: TOWN_CASES[1], chapter: 0 });
    expect(cluesOf(C1, s)).toEqual(C1.chapters.map((c) => c.clue));
    for (const c of TOWN_CASES.slice(1)) for (let ch = 0; ch < 5; ch++) s = solveChapter(s, c, ch, 1, T + 30 * DAY).cases;
    expect(caseNow(TOWN_CASES, s, T + 60 * DAY)).toEqual({ kind: 'finished' });
  });

  it('a chapter pays once; the stars say how it was heard', () => {
    const one = solveChapter(emptyTownCases(), C1, 0, 3, T);
    expect(solveChapter(one.cases, C1, 0, 1, T + 5)).toMatchObject({ first: false, xu: 0 });
    expect(chapterStars(0, [1, 1, 1])).toBe(3);
    expect(chapterStars(0, [1, 2, 1])).toBe(2);
    expect(chapterStars(1, [1, 1, 1])).toBe(1);
    expect(chapterXu(1)).toBeLessThan(chapterXu(3));
    expect(caseLineId('case-1', 0, 2, 1)).toBe('case-1-1-3-2');
  });

  it('parses junk to nothing and merges two browsers: the earlier solve, the higher stars', () => {
    expect(parseTownCases('junk')).toEqual(emptyTownCases());
    expect(parseTownCases({ done: { 'Bad Id': { 0: { at: T, stars: 3 } }, 'case-1': { 9: { at: T, stars: 3 }, 1: { at: T, stars: 7 } } } })).toEqual(emptyTownCases());
    const a = solveChapter(emptyTownCases(), C1, 0, 1, T).cases;
    const b = solveChapter(emptyTownCases(), C1, 0, 3, T + 500).cases;
    const m = mergeTownCases(a, b);
    expect(m.done[C1.id]['0']).toEqual({ at: T, stars: 3 });
    expect(mergeTownCases(b, a)).toEqual(m);
    expect(parseTownCases(JSON.parse(JSON.stringify(m)))).toEqual(m);
  });
});

describe('the cases (data/cases)', () => {
  const places = new Set(TOWN_PLACES.map((p) => p.id));

  it('each has five chapters of three witnesses, a question answered by one of them, and an ending', () => {
    expect(TOWN_CASES.map((c) => c.id)).toEqual(TOWN_CASES.map((_, i) => `case-${i + 1}`));
    for (const c of TOWN_CASES) {
      expect(c.chapters, c.id).toHaveLength(5);
      expect(c.title.trim(), c.id).not.toBe('');
      expect(c.ending.trim(), c.id).not.toBe('');
      expect(places.has(c.friend), c.id).toBe(true);
      const used = new Set<string>();
      c.chapters.forEach((ch, i) => {
        const where = `${c.id} chapter ${i + 1}`;
        expect(ch.testimonies, where).toHaveLength(3);
        expect(new Set(ch.testimonies.map((t) => t.placeId)).size, where).toBe(3);
        for (const t of ch.testimonies) {
          expect(places.has(t.placeId), where).toBe(true);
          used.add(t.placeId);
          expect(t.lines.length, where).toBeGreaterThanOrEqual(2);
          expect(t.lines.length, where).toBeLessThanOrEqual(3);
          for (const l of t.lines) {
            const words = l.text.trim().split(/\s+/).length;
            expect(words, `${where}: ${l.text}`).toBeGreaterThanOrEqual(3);
            expect(words, `${where}: ${l.text}`).toBeLessThanOrEqual(18);
            expect(l.vi.trim(), where).not.toBe('');
          }
        }
        expect(ch.options, where).toHaveLength(3);
        expect(new Set(ch.options).size, where).toBe(3);
        expect([0, 1, 2], where).toContain(ch.answer);
        expect([0, 1, 2], where).toContain(ch.hint);
        expect(ch.question.trim(), where).not.toBe('');
        expect(ch.clue.trim(), where).not.toBe('');
        if (i < 4) expect(ch.cliffhanger.trim(), where).not.toBe('');
        else expect(ch.cliffhanger, where).toBe('');
      });
      expect(used.size, `${c.id}: witnesses`).toBeGreaterThanOrEqual(6);
      // the clues of a case are five different facts
      expect(new Set(c.chapters.map((ch) => ch.clue)).size, c.id).toBe(5);
    }
  });
});
