import { describe, expect, it } from 'vitest';
import type { Annotation, DecodeResult } from '../types';
import { align } from './align';
import { classify } from './classify';
import { makeHint } from './hint';
import { filterSentences, orderSentences, sanitizeProgress, topicsOf, updateProgress } from './progress';
import type { Sentence } from '../types';

function fakeDecode(text: string, annotations: Annotation[]): DecodeResult {
  const raws = text.split(' ');
  let pos = 0;
  const tokens = raws.map((raw, index) => {
    const start = text.indexOf(raw, pos);
    pos = start + raw.length;
    return { index, raw, word: raw.toLowerCase().replace(/[^a-z']/g, ''), start, end: pos };
  });
  return { input: text, tokens, annotations, segments: [], spokenText: '' };
}

const ann = (id: string, type: Annotation['type'], from: number, to: number): Annotation => ({
  id,
  type,
  from,
  to,
  original: '',
  spoken: '',
  rule: '',
});

describe('classify', () => {
  const text = 'Turn it off and get out of here';
  const dr = fakeDecode(text, [
    ann('a1', 'linking', 0, 2),
    ann('a2', 'weak-form', 3, 3),
    ann('a3', 'flap-t', 4, 5),
    ann('a4', 'linking', 4, 6),
  ]);
  const raws = dr.tokens.map((t) => t.raw);

  it('no errors → nothing missed, all seen', () => {
    const c = classify(dr, align(raws, text).ops);
    expect(c.errors).toEqual([]);
    expect(c.missedPhenomena).toEqual([]);
    expect(c.seenPhenomena).toEqual(['linking', 'weak-form', 'flap-t']);
  });
  it('maps a missing word to its covering annotation', () => {
    const c = classify(dr, align(raws, 'turn off and get out of here').ops);
    expect(c.errors).toHaveLength(1);
    expect(c.errors[0]).toMatchObject({ targetIndex: 1, targetWord: 'it', kind: 'del', category: 'phenomenon' });
    expect(c.errors[0].phenomena).toEqual(['linking']);
    expect(c.missedAnnotationIds).toEqual(['a1']);
  });
  it('dedupes phenomena when several annotations cover a token', () => {
    const c = classify(dr, align(raws, 'turn it off and get a of here').ops);
    expect(c.errors[0]).toMatchObject({ targetIndex: 5, kind: 'sub', answerWord: 'a' });
    expect(c.errors[0].phenomena).toEqual(['flap-t', 'linking']);
    expect(c.errors[0].annotationIds).toEqual(['a3', 'a4']);
    expect(c.missedPhenomena).toEqual(['flap-t', 'linking']);
  });
  it('error without annotation is category other', () => {
    const c = classify(dr, align(raws, 'turn it off and get out of hair').ops);
    expect(c.errors[0]).toMatchObject({ targetIndex: 7, category: 'other', phenomena: [] });
    expect(c.missedPhenomena).toEqual([]);
  });
  it('one error per original token even when it expands to several canonical words', () => {
    const d = fakeDecode("I'm gonna go", [ann('r1', 'reduction', 1, 1)]);
    const c = classify(d, align(d.tokens.map((t) => t.raw), "I'm go").ops);
    expect(c.errors).toHaveLength(1);
    expect(c.errors[0]).toMatchObject({ targetIndex: 1, kind: 'del', phenomena: ['reduction'] });
  });
  it('handles a null/empty decode result', () => {
    const c = classify(null, align('hello there', 'hello').ops);
    expect(c.errors[0]).toMatchObject({ category: 'other', targetWord: 'there' });
    expect(c.seenPhenomena).toEqual([]);
  });
  it('ignores extra words', () => {
    const c = classify(dr, align(raws, 'turn it off and then get out of here').ops);
    expect(c.errors).toEqual([]);
  });
});

describe('hint', () => {
  it('reveals first letter of each word', () => {
    expect(makeHint(['What', 'do', 'you', 'want?'])).toBe('W___ d_ y__ w___?');
    expect(makeHint(["Don't"])).toBe("D__'_");
  });
});

const S = (id: string, level: 1 | 2 | 3, topic: string): Sentence => ({ id, text: id, vi: '', level, topic, focus: [] });

describe('progress & ordering', () => {
  const list = [S('a', 1, 'Công việc'), S('b', 2, 'Du lịch'), S('c', 3, 'Công việc'), S('d', 1, 'Ăn uống')];
  it('unseen first, then lowest best score', () => {
    const prog = { a: { best: 0.9, attempts: 1, lastAt: 1 }, c: { best: 0.3, attempts: 2, lastAt: 2 } };
    const order = orderSentences(list, prog, 42).map((s) => s.id);
    expect(order.slice(0, 2).sort()).toEqual(['b', 'd']);
    expect(order.slice(2)).toEqual(['c', 'a']);
  });
  it('shuffle is stable for the same seed', () => {
    expect(orderSentences(list, {}, 7).map((s) => s.id)).toEqual(orderSentences(list, {}, 7).map((s) => s.id));
  });
  it('filters by level and topic, lists topics', () => {
    expect(filterSentences(list, 1, '').map((s) => s.id)).toEqual(['a', 'd']);
    expect(filterSentences(list, 0, 'Công việc').map((s) => s.id)).toEqual(['a', 'c']);
    expect(topicsOf(list)).toHaveLength(3);
    expect(filterSentences([], 0, '')).toEqual([]);
  });
  it('updateProgress keeps best and counts attempts/hints', () => {
    let p = updateProgress({}, 'a', 0.5, 10);
    p = updateProgress(p, 'a', 0.3, 20, true);
    expect(p.a).toEqual({ best: 0.5, attempts: 2, lastAt: 20, hints: 1, hintAt: 20 });
  });
  it('sanitizeProgress survives garbage', () => {
    expect(sanitizeProgress(null)).toEqual({});
    expect(sanitizeProgress([1, 2])).toEqual({});
    expect(sanitizeProgress({ x: 'bad', y: { best: 2, attempts: 3, lastAt: 5 } })).toEqual({
      y: { best: 1, attempts: 3, lastAt: 5 },
    });
  });
});

describe('classify answerWord', () => {
  it('reports what the learner typed as written when answerRaw is given', () => {
    const d = fakeDecode('Give me a minute.', []);
    const answerRaw = ['wanna', 'get', 'a', 'minute'];
    const c = classify(d, align(d.tokens.map((t) => t.raw), answerRaw).ops, answerRaw);
    expect(c.errors[0]).toMatchObject({ targetIndex: 0, targetWord: 'Give' });
    expect(c.errors[0].answerWord).toBe('wanna');
  });
});
