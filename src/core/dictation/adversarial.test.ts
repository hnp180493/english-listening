// Regression tests for bugs found in review: extra words, partial contractions,
// prototype-key words, split contraction tokens, apostrophe-less forms.
import { describe, expect, it } from 'vitest';
import { align } from './align';
import { classify } from './classify';
import { buildDiff } from './diff';
import { canonicalize, normalizeText } from './normalize';
import { sanitizeProgress } from './progress';

const words = (s: string) => s.split(/\s+/).filter(Boolean);
const diffKinds = (t: string, a: string) => buildDiff(words(t), words(a), align(t, a).ops).map((u) => u.kind);

describe('extra words lower the score', () => {
  it('a long answer full of extra words is not 100%', () => {
    const r = align('Hi there', 'hi there and some more words here');
    expect(r.matched).toBe(2);
    expect(r.extra).toBe(5);
    expect(r.score).toBeCloseTo(2 / 7);
  });
  it('repeated extra words are counted once per typed token', () => {
    const r = align('I want to', 'I want to to to to');
    expect(r.extra).toBe(3);
    expect(r.score).toBeCloseTo(3 / 6);
  });
  it('exact answer still scores 1 with no extras', () => {
    const r = align("I'm going to call", "I'm gonna call");
    expect(r.extra).toBe(0);
    expect(r.score).toBe(1);
  });
  it('a reduction typed for a single word is ONE wrong word, not wrong + extra', () => {
    const r = align('go', 'gonna');
    expect(r.extra).toBe(0);
    expect(diffKinds('go', 'gonna')).toEqual(['wrong']);
  });
  it('partial extra piece after a matched word is shown and counted', () => {
    const r = align('going home', 'gonna home');
    expect(r.extra).toBe(1);
    expect(diffKinds('going home', 'gonna home')).toEqual(['ok', 'extra', 'ok']);
  });
});

describe('repeated words', () => {
  it('drops exactly one of the repeated words', () => {
    const r = align('I really really like it', 'I really like it');
    expect(r.ops.filter((o) => o.kind === 'del')).toHaveLength(1);
    expect(r.score).toBeCloseTo(4 / 5);
  });
});

describe('punctuation-only answers', () => {
  it('normalise to nothing', () => {
    expect(normalizeText('... !!! ,,,')).toBe('');
    expect(normalizeText('  “ ” ')).toBe('');
  });
});

describe('index mapping after expansion', () => {
  it("I'm going to: error on 'to' maps to original token 2", () => {
    const r = align("I'm going to call", "I'm going call");
    const dels = r.ops.filter((o) => o.kind === 'del');
    expect(dels.map((o) => o.targetIndex)).toEqual([2]);
  });
  it("missing half of I'm maps to token 0", () => {
    const r = align("I'm going to call", 'I going to call');
    expect(r.ops.filter((o) => o.kind !== 'match').map((o) => o.targetIndex)).toEqual([0]);
    expect(r.matched).toBe(3);
  });
  it('gonna on the target side maps both canonical pieces to token 1', () => {
    const r = align("I'm gonna call", 'I am going call');
    const bad = r.ops.filter((o) => o.kind !== 'match');
    expect(bad.map((o) => o.targetIndex)).toEqual([1]);
    expect(r.matched).toBe(2);
  });
});

describe('classify partial contraction', () => {
  it("typing 'I' for 'I'd' is a sub with what was typed, matching the diff", () => {
    const target = ["I'd", 'go'];
    const answer = ['I', 'go'];
    const c = classify(null, align(target, answer).ops, answer, target);
    expect(c.errors).toHaveLength(1);
    expect(c.errors[0]).toMatchObject({ targetIndex: 0, kind: 'sub', answerWord: 'I', targetWord: "I'd" });
  });
  it('uses the written target word (not the canonical expansion) without decoder tokens', () => {
    const target = ['It’s', 'late.'];
    const answer = ['late'];
    const c = classify(null, align(target, answer).ops, answer, target);
    expect(c.errors[0]).toMatchObject({ targetIndex: 0, kind: 'del', targetWord: 'It’s' });
  });
  it('a missing final word is a del', () => {
    const target = ['see', 'you', 'later'];
    const answer = ['see', 'ya'];
    const c = classify(null, align(target, answer).ops, answer, target);
    expect(c.errors.map((e) => [e.targetIndex, e.kind])).toEqual([[2, 'del']]);
  });
});

describe('words that collide with Object.prototype', () => {
  it('does not crash on "constructor" / "__proto__" / "toString"', () => {
    expect(() => align('The constructor is here', 'the constructor is here')).not.toThrow();
    expect(align('The constructor is here', 'the constructor is here').score).toBe(1);
    expect(() => align('hello', '__proto__ toString hasOwnProperty valueOf')).not.toThrow();
    expect(canonicalize(['constructor']).words).toEqual(['constructor']);
  });
});

describe('contraction tokens split by a tokenizer', () => {
  it("'m / n't / 'll / 'd as separate tokens still expand", () => {
    expect(canonicalize(['I', "'m", 'fine']).words).toEqual(['i', 'am', 'fine']);
    expect(canonicalize(['do', "n't"]).words).toEqual(['do', 'not']);
    expect(align(['I', "'ll", 'go'], "I'll go").score).toBe(1);
    expect(align(['she', "'d", 'go'], 'she would go').score).toBe(1);
  });
});

describe('contractions on both sides and apostrophe-less forms', () => {
  it.each([
    ["It's late", 'its late'],
    ["Let's go", 'lets go'],
    ["He's here", 'hes here'],
    ["Who's there", 'whos there'],
    ['It’s seven o’clock', "it's 7 oclock"],
    ["I'd go", 'I had go'],
    ['What are you doing', 'whatcha doing'],
    ['What do you want', 'whatcha want'],
    ["C'mon", 'come on'],
    ["I can't", 'I cannot'],
    ['I cannot', "I can't"],
    ['I’m fine', "I'm fine"],
  ])('%s = %s', (t, a) => {
    expect(align(t, a).score).toBe(1);
  });
  it('possessive its still matches its', () => {
    expect(align('The dog wagged its tail', 'the dog wagged its tail').score).toBe(1);
  });
  it('dropping the s of lets is still an error', () => {
    expect(align('He lets me go', 'he let me go').score).toBeLessThan(1);
  });
});

describe('numbers', () => {
  it.each([
    ['I have 2 cats', 'I have two cats'],
    ['It is 7:30', 'it is seven thirty'],
    ['Room 101', 'room one hundred one'],
    ['the 21st century', 'the twenty-first century'],
    ['It costs 1,000 dollars', 'it costs one thousand dollars'],
  ])('%s = %s', (t, a) => {
    expect(align(t, a).score).toBe(1);
  });
  it('"to" for "2" is wrong (a listening error)', () => {
    expect(align('I have 2 cats', 'I have to cats').score).toBeCloseTo(3 / 4);
  });
});

describe('sanitizeProgress', () => {
  it('ignores __proto__ and non-finite values', () => {
    const raw: unknown = JSON.parse(
      '{"__proto__": {"best": 1, "attempts": 1, "lastAt": 1}, "s1": {"best": 0.5, "attempts": 2.7, "lastAt": 3, "hints": 1.5}}',
    );
    const p = sanitizeProgress(raw);
    expect(Object.getPrototypeOf(p)).toBe(Object.prototype);
    expect(Object.keys(p)).toEqual(['s1']);
    expect(p.s1).toEqual({ best: 0.5, attempts: 2, lastAt: 3, hints: 1 });
  });
});
