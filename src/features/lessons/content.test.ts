import { describe, expect, it } from 'vitest';
import { decode } from '../../core/decoder';
import type { LessonMeta } from '../../core/lessons';
import { PHENOMENON_INFO } from '../../core/phenomena';
import { PHENOMENA } from '../../core/types';
import { CONNECTED_LESSONS, getLesson, LESSONS, type LessonExample } from '../../data/lessons';
import { correctIndices, itemPhenomena, itemSentence, keyOf, optionLabels, parseGap, parseMd, spotOptions } from './logic';

const examplesOf = (id: string): LessonExample[] =>
  (getLesson(id)?.sections ?? []).flatMap((s) => s.blocks.flatMap((b) => (b.type === 'examples' ? b.items : [])));

// Course "connected" (Nghe nối âm). Rules for every course: courses.test.ts.
describe('lesson catalogue (course connected)', () => {
  it('stays assignable to LessonMeta[]', () => {
    const metas: LessonMeta[] = LESSONS;
    expect(metas.length).toBeGreaterThanOrEqual(10);
    expect(CONNECTED_LESSONS).toHaveLength(10);
  });

  it('keeps its ids and orders 1..10 in sequence (progress and review cards key on these ids)', () => {
    expect(CONNECTED_LESSONS.map((l) => l.id)).toEqual([
      'intro', 'weak-form', 'linking', 'flap-t', 'elision', 'assimilation', 'h-dropping', 'contraction', 'reduction', 'review',
    ]);
    expect(CONNECTED_LESSONS.map((l) => l.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(CONNECTED_LESSONS.every((l) => l.course === 'connected')).toBe(true);
    expect(LESSONS.slice(0, 10).map((l) => l.id)).toEqual(CONNECTED_LESSONS.map((l) => l.id));
  });

  it('covers every phenomenon exactly once; intro and review have none', () => {
    const ph = CONNECTED_LESSONS.map((l) => l.phenomenon).filter((p) => p !== null);
    expect([...ph].sort()).toEqual([...PHENOMENA].sort());
    expect(CONNECTED_LESSONS[0].phenomenon).toBeNull();
    expect(CONNECTED_LESSONS[9].phenomenon).toBeNull();
  });

  it('getLesson finds lessons and rejects unknown ids', () => {
    expect(getLesson('linking')?.order).toBe(3);
    expect(getLesson('nope')).toBeUndefined();
    expect(getLesson(undefined)).toBeUndefined();
  });
});

describe.each(CONNECTED_LESSONS.map((l) => [l.id, l] as const))('lesson %s', (_id, lesson) => {
  it('has meta, sections and non-empty blocks', () => {
    expect(lesson.title.trim()).not.toBe('');
    expect(lesson.summary.trim()).not.toBe('');
    expect(lesson.goal.trim()).not.toBe('');
    expect(lesson.minutes).toBeGreaterThan(0);
    expect(lesson.sections.length).toBeGreaterThanOrEqual(2);
    for (const s of lesson.sections) {
      expect(s.title.trim()).not.toBe('');
      expect(s.blocks.length).toBeGreaterThan(0);
      for (const b of s.blocks) {
        if (b.type === 'text' || b.type === 'tip') expect(parseMd(b.md).length).toBeGreaterThan(0);
        if (b.type === 'rule') expect(b.title && b.body).toBeTruthy();
        if (b.type === 'compare') expect(b.clear && b.natural && b.note).toBeTruthy();
        if (b.type === 'examples') expect(b.items.length).toBeGreaterThan(0);
      }
    }
  });

  it('has at least 6 teaching examples', () => {
    expect(examplesOf(lesson.id).length).toBeGreaterThanOrEqual(6);
  });

  it('every example decodes without throwing', () => {
    for (const ex of examplesOf(lesson.id)) {
      const r = decode(ex.text);
      expect(r.tokens.length).toBeGreaterThan(0);
    }
  });

  it('at least half of the examples show the lesson phenomenon per decode()', () => {
    if (!lesson.phenomenon) return;
    const exs = examplesOf(lesson.id);
    const hits = exs.filter((ex) => decode(ex.text).annotations.some((a) => a.type === lesson.phenomenon));
    expect(hits.length * 2).toBeGreaterThanOrEqual(exs.length);
  });

  it('quiz has 8 well-formed items mixing all 4 types', () => {
    expect(lesson.quiz).toHaveLength(8);
    expect(new Set(lesson.quiz.map((q) => q.type)).size).toBe(4);
    for (const q of lesson.quiz) {
      expect(q.explain.trim()).not.toBe('');
      for (const p of q.phenomena ?? []) expect(PHENOMENON_INFO[p]).toBeDefined();
      if (q.type === 'listen-type') {
        const gap = parseGap(q.text);
        expect(gap, q.text).not.toBeNull();
        expect(decode(gap!.full).tokens.length).toBeGreaterThan(0);
        continue;
      }
      const labels = optionLabels(q);
      expect(new Set(labels.map(keyOf)).size, JSON.stringify(labels)).toBe(labels.length);
      expect(correctIndices(q).length, JSON.stringify(q)).toBeGreaterThan(0);
      if (q.type === 'listen-choose') {
        expect(q.options.length).toBeGreaterThanOrEqual(3);
        expect(q.options.length).toBeLessThanOrEqual(4);
        expect(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length).toBe(true);
      }
      if (q.type === 'which-rule') {
        expect(q.options.length).toBeGreaterThanOrEqual(3);
        expect(new Set(q.options).size).toBe(q.options.length);
        expect(q.options).toContain(q.answer);
      }
      if (q.type === 'spot') {
        const keys = spotOptions(q.text, q.unit).map(keyOf);
        expect(keys.length).toBeGreaterThanOrEqual(2);
        for (const a of q.answers) expect(keys, `${q.text}: ${a}`).toContain(keyOf(a));
      }
    }
  });

  it('a phenomenon lesson tests mostly its own phenomenon', () => {
    if (!lesson.phenomenon) return;
    const own = lesson.quiz.filter((q) => !q.phenomena || q.phenomena.includes(lesson.phenomenon!));
    expect(own.length).toBeGreaterThanOrEqual(6);
  });
});

describe('quiz items are answerable', () => {
  const all = LESSONS.flatMap((l) => l.quiz.map((q, i) => ({ id: `${l.id}:${i}`, q })));

  // Regression: "We missed the bus." vs "We miss the bus." sound the same once the -ed
  // is elided (which the lesson itself teaches), so a listening item must not hinge on it.
  it('listen-choose options do not collapse to the same spoken form', () => {
    for (const { id, q } of all) {
      if (q.type !== 'listen-choose') continue;
      const spoken = q.options.map((o) => keyOf(decode(o).spokenText.replace(/-/g, ' ')));
      expect(new Set(spoken).size, `${id}: ${spoken.join(' | ')}`).toBe(q.options.length);
    }
  });

  // Regression: "a little bit → ə liddle bit" offered weak-form as a wrong option although
  // a → ə IS a weak form. A distractor must not be something the phrase really contains.
  it('which-rule distractors are not present in the phrase per decode()', () => {
    for (const { id, q } of all) {
      if (q.type !== 'which-rule') continue;
      const found = new Set(decode(itemSentence(q)).annotations.map((a) => a.type));
      for (const opt of q.options) {
        if (opt !== q.answer) expect(found.has(opt), `${id}: distractor ${opt} is in "${q.written}"`).toBe(false);
      }
      expect(found.has(q.answer), `${id}: decoder does not show ${q.answer} in "${q.written}"`).toBe(true);
    }
  });

  // h-dropping is itself the elision of /h/, so offering both makes the item ambiguous.
  it('h-dropping items never offer elision as a distractor', () => {
    for (const { id, q } of all) {
      if (q.type === 'which-rule' && q.answer === 'h-dropping') expect(q.options, id).not.toContain('elision');
    }
  });

  // Every finished quiz of course "connected" feeds the per-phenomenon stats, including intro and review.
  it('every connected-speech item maps to at least one phenomenon for stats', () => {
    for (const l of CONNECTED_LESSONS) {
      l.quiz.forEach((q, i) => expect(itemPhenomena(q, l.phenomenon).length, `${l.id}:${i}`).toBeGreaterThan(0));
    }
  });

  it('spot items accept only some of the chips', () => {
    for (const { id, q } of all) {
      if (q.type !== 'spot') continue;
      const n = spotOptions(q.text, q.unit).length;
      expect(correctIndices(q).length, id).toBeLessThan(n);
    }
  });
});
