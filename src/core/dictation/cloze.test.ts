import { describe, expect, it } from 'vitest';
import { decode } from '../decoder';
import { SENTENCES } from '../../data/sentences';
import type { Annotation, DecodeResult, Phenomenon, Token } from '../types';
import { blankBudget, buildCloze, checkBlank, clozeBlanks, gradeCloze, selectClozeTokens } from './cloze';

function mk(text: string, anns: [Phenomenon, number, number][]): DecodeResult {
  let pos = 0;
  const tokens: Token[] = text.split(' ').map((raw, index) => {
    const start = text.indexOf(raw, pos);
    pos = start + raw.length;
    return { index, raw, word: raw.toLowerCase().replace(/[^a-z']/g, ''), start, end: pos };
  });
  const annotations: Annotation[] = anns.map(([type, from, to], k) => ({
    id: `a${k}`,
    type,
    from,
    to,
    original: tokens.slice(from, to + 1).map((t) => t.raw).join(' '),
    spoken: '',
    rule: '',
  }));
  return { input: text, tokens, annotations, segments: [], spokenText: '' };
}

describe('blankBudget', () => {
  it('hides about half the words, at least 1, at most 6', () => {
    expect(blankBudget(0)).toBe(0);
    expect(blankBudget(1)).toBe(1);
    expect(blankBudget(4)).toBe(2);
    expect(blankBudget(10)).toBe(5);
    expect(blankBudget(20)).toBe(6);
  });
});

describe('selectClozeTokens', () => {
  it('returns nothing when the sentence has no annotations', () => {
    expect(selectClozeTokens(mk('Hello there friend.', []))).toEqual([]);
    expect(selectClozeTokens(null)).toEqual([]);
  });

  it('only hides tokens covered by an annotation', () => {
    const r = mk('I want to go home now please', [['reduction', 1, 2]]);
    expect(selectClozeTokens(r)).toEqual([1, 2]);
  });

  it('prefers reductions over linking and respects the budget', () => {
    // 6 words → budget 3
    const r = mk('Turn it off, I want to', [
      ['linking', 0, 1],
      ['reduction', 4, 5],
      ['flap-t', 1, 2],
    ]);
    const sel = selectClozeTokens(r);
    expect(sel).toContain(4);
    expect(sel).toContain(5);
    expect(sel.length).toBeLessThanOrEqual(3);
  });

  it('puts the focus phenomenon first', () => {
    const r = mk('Did you tell him about it', [
      ['reduction', 0, 1],
      ['h-dropping', 2, 3],
    ]);
    // budget 3: only one 2-word annotation fits; focus decides which
    expect(selectClozeTokens(r, { focus: 'h-dropping' })).toEqual([2, 3]);
    expect(selectClozeTokens(r)).toEqual([0, 1]);
  });

  it('falls back to one annotation when every annotation exceeds the budget', () => {
    const r = mk('Thank you', [['linking', 0, 1]]);
    expect(selectClozeTokens(r)).toEqual([0, 1]);
  });

  it('ignores malformed annotations', () => {
    const r = mk('a b c', [['linking', 2, 9]]);
    expect(selectClozeTokens(r)).toEqual([]);
  });

  it('works on real decoder output: hidden words are always annotated and some stay visible', () => {
    for (const s of SENTENCES.slice(0, 60)) {
      const r = decode(s.text);
      const sel = selectClozeTokens(r);
      const covered = new Set<number>();
      for (const a of r.annotations) for (let i = a.from; i <= a.to; i++) covered.add(i);
      for (const i of sel) expect(covered.has(i)).toBe(true);
      if (r.tokens.length >= 4) expect(sel.length).toBeLessThan(r.tokens.length);
    }
  });
});

describe('buildCloze', () => {
  it('merges adjacent hidden words into one blank and keeps punctuation outside', () => {
    const units = buildCloze(mk('Okay, turn it off, please.', [['linking', 1, 2]]));
    const blanks = clozeBlanks(units);
    expect(blanks).toHaveLength(1);
    expect(blanks[0].target).toBe('turn it');
    expect(blanks[0].from).toBe(1);
    expect(blanks[0].to).toBe(2);
    expect(units.filter((u) => u.kind === 'text').map((u) => (u.kind === 'text' ? u.raw : ''))).toEqual(['Okay,', 'off,', 'please.']);
  });

  it('strips edge punctuation of a single hidden word into lead/trail', () => {
    const blanks = clozeBlanks(buildCloze(mk('Can you see "it?" now', [['weak-form', 3, 3]])));
    expect(blanks[0]).toMatchObject({ target: 'it', lead: '"', trail: '?"' });
  });

  it('records the phenomena overlapping each blank', () => {
    const blanks = clozeBlanks(buildCloze(mk('I want to go out today', [['reduction', 1, 2]])));
    expect(blanks[0].phenomena).toEqual(['reduction']);
    expect(blanks[0].annotationIds).toEqual(['a0']);
  });
});

describe('checkBlank', () => {
  it('accepts exact and case/punctuation-insensitive answers', () => {
    expect(checkBlank('Turn it', 'turn it')).toBe('ok');
    expect(checkBlank("it's", 'its')).not.toBe('empty');
  });
  it('accepts equivalent spellings (gonna, contractions, numbers)', () => {
    expect(checkBlank('going to', 'gonna')).toBe('ok');
    expect(checkBlank("I'm", 'I am')).toBe('ok');
    expect(checkBlank('two', '2')).toBe('ok');
  });
  it('flags small spelling slips in long words as typo', () => {
    expect(checkBlank('tomorrow', 'tomorow')).toBe('typo');
  });
  it('rejects wrong or partial answers and reports empty', () => {
    expect(checkBlank('want to', 'want')).toBe('wrong');
    expect(checkBlank('him', 'them')).toBe('wrong');
    expect(checkBlank('him', '   ')).toBe('empty');
  });
});

describe('gradeCloze', () => {
  it('scores per blank and reports missed phenomena', () => {
    const r = mk('Did you tell him about it today, okay?', [
      ['reduction', 0, 1],
      ['h-dropping', 2, 3],
      ['flap-t', 4, 5],
    ]);
    const units = buildCloze(r);
    const blanks = clozeBlanks(units);
    const answers = blanks.map((b) => (b.phenomena.includes('reduction') ? 'did you' : 'xx'));
    const g = gradeCloze(units, answers, r.annotations);
    expect(g.total).toBe(blanks.length);
    expect(g.correct).toBe(blanks.filter((b) => b.phenomena.includes('reduction')).length);
    expect(g.missed).not.toContain('reduction');
    expect(g.seen.sort()).toEqual(['flap-t', 'h-dropping', 'reduction']);
    expect(g.score).toBeCloseTo(g.correct / g.total);
  });
  it('gives a perfect score when there are no blanks', () => {
    expect(gradeCloze([], []).score).toBe(1);
  });
});
