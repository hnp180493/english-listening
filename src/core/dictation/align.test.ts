import { describe, expect, it } from 'vitest';
import { align } from './align';
import { buildDiff } from './diff';

const kinds = (t: string, a: string) => align(t, a).ops.map((o) => o.kind);

describe('align', () => {
  it('perfect answer scores 1', () => {
    const r = align('Turn it off, please.', 'turn it off please');
    expect(r.score).toBe(1);
    expect(r.ops.every((o) => o.kind === 'match')).toBe(true);
  });
  it('detects a missing word', () => {
    const r = align('I want to go home', 'I want go home');
    expect(r.ops.map((o) => o.kind)).toEqual(['match', 'match', 'del', 'match', 'match']);
    expect(r.ops[2].targetIndex).toBe(2);
    expect(r.score).toBeCloseTo(4 / 5);
  });
  it('detects a substitution', () => {
    const r = align('Get it done', 'Get a done');
    expect(r.ops[1]).toMatchObject({ kind: 'sub', targetIndex: 1, answerWord: 'a' });
    expect(r.score).toBeCloseTo(2 / 3);
  });
  it('detects an extra word', () => {
    expect(kinds('a cup of tea', 'a cup of the tea')).toEqual(['match', 'match', 'match', 'ins', 'match']);
    const r = align('a cup of tea', 'a cup of the tea');
    expect(r.extra).toBe(1);
    expect(r.score).toBeCloseTo(4 / 5); // extra words are penalised
  });
  it('empty answer: everything missing, score 0', () => {
    const r = align('See you later', '');
    expect(r.ops.every((o) => o.kind === 'del')).toBe(true);
    expect(r.score).toBe(0);
  });
  it('empty target and empty answer', () => {
    expect(align('', '').score).toBe(1);
    expect(align('', 'hello').score).toBe(0);
  });
  it('contraction vs full form is a full match', () => {
    expect(align("I'm gonna call him", 'I am going to call him').score).toBe(1);
    expect(align('I would like that', "I'd like that").score).toBe(1);
  });
  it('maps canonical ops back to original token indices', () => {
    const r = align("I'm gonna go", "I'm go");
    const dels = r.ops.filter((o) => o.kind === 'del');
    expect(dels.map((o) => o.targetIndex)).toEqual([1, 1]);
    expect(r.score).toBeCloseTo(2 / 3);
  });
  it('typo near-miss counts as match with typo flag', () => {
    const r = align('I will receive it tomorrow', 'I will recieve it tomorow');
    expect(r.score).toBe(1);
    expect(r.typos).toBe(2);
    expect(r.ops.filter((o) => o.typo).map((o) => o.targetIndex)).toEqual([2, 4]);
  });
  it('dropped -ed ending is an error, not a typo', () => {
    const r = align('I used to live there', 'I use to live there');
    expect(r.ops[1].kind).toBe('sub');
  });
  it('number digits accepted', () => {
    expect(align('I have two brothers', 'I have 2 brothers').score).toBe(1);
  });
  it('accepts token arrays (decoder raws)', () => {
    const r = align(['What', 'do', 'you', 'want?'], 'whadda you want');
    expect(r.total).toBe(4);
    expect(r.matched).toBe(2);
  });
});

describe('buildDiff', () => {
  it('produces ok / wrong / missing / extra units over original words', () => {
    const target = ['Turn', 'it', 'off', 'now.'];
    const answer = ['turn', 'a', 'off', 'right', 'now'];
    const r = align(target, answer);
    const units = buildDiff(target, answer, r.ops);
    expect(units.map((u) => u.kind)).toEqual(['ok', 'wrong', 'ok', 'extra', 'ok']);
    expect(units[1]).toMatchObject({ target: 'it', answer: 'a' });
  });
  it('marks missing and punctuation-only tokens', () => {
    const target = ['Well', '—', 'see', 'you'];
    const answer = ['well', 'you'];
    const units = buildDiff(target, answer, align(target, answer).ops);
    expect(units.map((u) => u.kind)).toEqual(['ok', 'skip', 'missing', 'ok']);
  });
  it('partial contraction is wrong, showing what was typed', () => {
    const target = ["I'd", 'go'];
    const answer = ['I', 'go'];
    const units = buildDiff(target, answer, align(target, answer).ops);
    expect(units[0]).toMatchObject({ kind: 'wrong', target: "I'd", answer: 'I' });
  });
  it('typo unit keeps the typed word', () => {
    const target = ['receive'];
    const answer = ['recieve'];
    expect(buildDiff(target, answer, align(target, answer).ops)[0]).toMatchObject({ kind: 'typo', answer: 'recieve' });
  });
});
