// Tests for the fixes made while reviewing the "dictation-plus" upgrade.
import { describe, expect, it } from 'vitest';
import { decode } from '../decoder';
import type { Annotation, DecodeResult, Phenomenon, Token } from '../types';
import { buildCloze, checkBlank, clozeBlanks, clozeTokens, fallbackClozeTokens, gradeCloze, selectClozeTokens } from './cloze';
import {
  addCustom,
  cleanText,
  CUSTOM_ERROR_TEXT,
  mostlyNonLatin,
  parseBulk,
  sanitizeCustom,
  validateCustomText,
  MAX_TEXT_CHARS,
  type CustomSentence,
} from './custom';
import { roundChecks, roundProgress, SESSION_GOAL, summarizeChecks, type SessionCheck } from './goal';
import { needsReview, reviewQueue } from './modes';
import { sanitizeProgress, updateProgress, type ProgressMap } from './progress';

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
    original: '',
    spoken: '',
    rule: '',
  }));
  return { input: text, tokens, annotations, segments: [], spokenText: '' };
}

describe('cloze fallback for sentences without annotations', () => {
  it('blanks function words (weak forms first) when the decoder finds nothing', () => {
    const r = mk('Send the report to the boss.', []);
    expect(selectClozeTokens(r)).toEqual([]);
    const sel = fallbackClozeTokens(r);
    expect(sel.length).toBeGreaterThan(0);
    expect(sel.length).toBeLessThanOrEqual(3);
    // "to" is the strongest weak-form candidate
    expect(sel).toContain(3);
    for (const i of sel) expect(['the', 'to']).toContain(r.tokens[i].word);
  });

  it('marks fallback blanks and keeps annotated blanks unmarked', () => {
    const plain = clozeBlanks(buildCloze(mk('Bring me a coffee please', [])));
    expect(plain.length).toBeGreaterThan(0);
    expect(plain.every((b) => b.fallback)).toBe(true);
    expect(plain.every((b) => b.phenomena.length === 0)).toBe(true);
    const ann = clozeBlanks(buildCloze(mk('I want to go home', [['reduction', 1, 2]])));
    expect(ann.every((b) => !b.fallback)).toBe(true);
  });

  it('uses the longest word when there is no function word, and never hides every word', () => {
    const r = mk('Stop, everybody!', []);
    expect(fallbackClozeTokens(r)).toEqual([1]);
    expect(fallbackClozeTokens(mk('Hello', []))).toEqual([0]);
    expect(fallbackClozeTokens(mk('to the', [])).length).toBe(1);
    expect(fallbackClozeTokens(null)).toEqual([]);
    expect(fallbackClozeTokens(mk('… —', []))).toEqual([]);
  });

  it('clozeTokens prefers annotations and only falls back when there are none', () => {
    expect(clozeTokens(mk('I want to go home', [['reduction', 1, 2]]))).toEqual([1, 2]);
    expect(clozeTokens(mk('I want to go home', [])).length).toBeGreaterThan(0);
  });

  it('every built-in sentence can make at least one blank', async () => {
    const { SENTENCES } = await import('../../data/sentences');
    for (const s of SENTENCES) {
      const r = decode(s.text);
      if (r.tokens.length) expect(clozeTokens(r).length).toBeGreaterThan(0);
    }
  });
});

describe('cloze checking edge cases', () => {
  it('handles contractions with curly apostrophes and attached punctuation', () => {
    const blanks = clozeBlanks(buildCloze(mk('Well, I’m done.', [['contraction', 1, 1]])));
    expect(blanks[0]).toMatchObject({ target: 'I’m', lead: '', trail: '' });
    expect(checkBlank(blanks[0].target, "i'm")).toBe('ok');
    expect(checkBlank(blanks[0].target, 'I am')).toBe('ok');
    const b2 = clozeBlanks(buildCloze(mk('Can you get it?', [['flap-t', 2, 3]])));
    expect(b2[0]).toMatchObject({ target: 'get it', trail: '?' });
    expect(checkBlank(b2[0].target, 'get it?')).toBe('ok');
  });

  it('grades repeated words independently, by position', () => {
    const r = mk('that that is it', [
      ['linking', 0, 0],
      ['linking', 3, 3],
    ]);
    const units = buildCloze(r, { ratio: 1 });
    const blanks = clozeBlanks(units);
    expect(blanks.map((b) => b.target)).toEqual(['that', 'it']);
    const g = gradeCloze(units, ['that', 'that'], r.annotations);
    expect(g.verdicts).toEqual(['ok', 'wrong']);
  });

  it('a blank spanning a comma accepts the words without the comma', () => {
    const r = mk('I said it, and left', [['linking', 2, 3]]);
    const blanks = clozeBlanks(buildCloze(r, { ratio: 1 }));
    expect(blanks[0].target).toBe('it, and');
    expect(checkBlank(blanks[0].target, 'it and')).toBe('ok');
  });
});

describe('custom sentence validation hardening', () => {
  const list: CustomSentence[] = [{ id: 'u-1', text: 'Turn it off.', vi: '', level: 1, createdAt: 1 }];

  it('strips HTML tags and entities', () => {
    expect(cleanText('<b>Turn</b> it&nbsp;<i>on</i>')).toBe('Turn it on');
    expect(validateCustomText('<script></script>', [])).toBe('empty');
    expect(validateCustomText('<b>Turn it off</b>', list)).toBe('duplicate');
    // a lone "<" in text is not a tag
    expect(cleanText('a < b')).toBe('a < b');
  });

  it('rejects mostly non-Latin text as not English', () => {
    expect(mostlyNonLatin('你好 hello 世界朋友')).toBe(true);
    expect(mostlyNonLatin('Привет, how are you doing today?')).toBe(false);
    expect(validateCustomText('Как дела, my friend?', [])).toBe('not-english');
    expect(validateCustomText('I had a café latte', [])).toBeNull();
    expect(CUSTOM_ERROR_TEXT['not-english']).toMatch(/tiếng Anh/);
  });

  it('measures too-long on the cleaned text, not raw markup', () => {
    const words = 'word '.repeat(70).trim(); // 349 chars
    expect(validateCustomText(words, [])).toBe('too-long');
    const tagged = `<span class="${'x'.repeat(400)}">Turn it on</span>`;
    expect(validateCustomText(tagged, [])).toBeNull();
    expect(validateCustomText('a'.repeat(MAX_TEXT_CHARS), [])).toBeNull();
  });

  it('bulk paste does not silently truncate long lines: they are rejected', () => {
    const long = 'This is a very long sentence '.repeat(15).trim();
    const items = parseBulk(`${long}\nTurn it on`);
    expect(items[0].text.length).toBeGreaterThan(MAX_TEXT_CHARS);
    const r = addCustom([], items, 1000);
    expect(r.added.map((c) => c.text)).toEqual(['Turn it on']);
    expect(r.rejected[0].error).toBe('too-long');
  });

  it('bulk paste splits the meaning on "|" with or without spaces', () => {
    expect(parseBulk('Turn it on|Bật lên')).toEqual([{ text: 'Turn it on', vi: 'Bật lên' }]);
    expect(parseBulk('Turn it off | Tắt đi')).toEqual([{ text: 'Turn it off', vi: 'Tắt đi' }]);
    expect(parseBulk('Get it\tLấy nó')).toEqual([{ text: 'Get it', vi: 'Lấy nó' }]);
  });

  it('sanitize never gives a repaired entry the id of a later valid entry', () => {
    const out = sanitizeCustom([
      { text: 'First one', createdAt: 36 }, // no id → would become u-10 (36 in base 36)
      { id: 'u-10', text: 'Second one', level: 2, createdAt: 50 },
    ]);
    expect(out[1].id).toBe('u-10');
    expect(out[0].id).not.toBe('u-10');
    expect(new Set(out.map((c) => c.id)).size).toBe(2);
  });
});

describe('review graduation with hint tracking', () => {
  it('records the time of the last hinted attempt', () => {
    let p: ProgressMap = updateProgress({}, 'a', 1, 10, true);
    expect(p.a.hintAt).toBe(10);
    p = updateProgress(p, 'a', 0.5, 20);
    expect(p.a.hintAt).toBe(10);
  });

  it('a hinted sentence graduates after a clean perfect attempt and stays graduated', () => {
    let p: ProgressMap = updateProgress({}, 'a', 1, 10, true);
    expect(needsReview(p.a)).toBe(true);
    p = updateProgress(p, 'a', 1, 20);
    expect(needsReview(p.a)).toBe(false);
    // a later imperfect attempt does not re-queue a sentence already done cleanly (best stays 1)
    p = updateProgress(p, 'a', 0.6, 30);
    expect(needsReview(p.a)).toBe(false);
    // using the hint again does
    p = updateProgress(p, 'a', 1, 40, true);
    expect(needsReview(p.a)).toBe(true);
  });

  it('keeps legacy data (no hintAt) working', () => {
    expect(needsReview({ best: 1, attempts: 2, lastAt: 20, hints: 1, cleanAt: 20 })).toBe(false);
    expect(needsReview({ best: 1, attempts: 3, lastAt: 30, hints: 1, cleanAt: 20 })).toBe(true);
    expect(needsReview({ best: 1, attempts: 1, lastAt: 20, hints: 1 })).toBe(true);
  });

  it('sanitizeProgress keeps a valid hintAt only with hints', () => {
    const p = sanitizeProgress({
      a: { best: 1, attempts: 2, lastAt: 5, hints: 1, hintAt: 4, cleanAt: 5 },
      b: { best: 1, attempts: 2, lastAt: 5, hintAt: 4 },
      c: { best: 1, attempts: 1, lastAt: 5, hints: 1, hintAt: 'x' },
    });
    expect(p.a.hintAt).toBe(4);
    expect(p.b.hintAt).toBeUndefined();
    expect(p.c.hintAt).toBeUndefined();
  });

  it('review queue: lowest best first, then oldest; graduated sentences excluded', () => {
    const S = (id: string) => ({ id, text: id, vi: '', level: 1 as const, topic: '', focus: [] });
    const progress: ProgressMap = {
      a: { best: 0.5, attempts: 1, lastAt: 30 },
      b: { best: 0.2, attempts: 1, lastAt: 40 },
      c: { best: 0.5, attempts: 1, lastAt: 10 },
      d: { best: 1, attempts: 2, lastAt: 50, hints: 1, hintAt: 20, cleanAt: 50 },
      e: { best: 1, attempts: 1, lastAt: 5, hints: 1, hintAt: 5 },
    };
    expect(reviewQueue([S('a'), S('b'), S('c'), S('d'), S('e')], progress).map((s) => s.id)).toEqual(['b', 'c', 'a', 'e']);
  });
});

describe('session goal counts distinct sentences', () => {
  const c = (id: string, score: number, missed: Phenomenon[] = []): SessionCheck => ({ id, score, seen: missed, missed });

  it('retries of the same sentence do not fill the goal', () => {
    const checks = [c('a', 0.2), c('a', 0.6), c('a', 1), c('b', 1)];
    expect(roundChecks(checks, 0).map((x) => x.id)).toEqual(['a', 'b']);
    expect(roundProgress(checks, 0)).toMatchObject({ done: 2, reached: false });
  });

  it('keeps the first (honest) score of each sentence for the summary', () => {
    const checks = [c('a', 0.2, ['linking']), c('a', 1), c('b', 1)];
    const s = summarizeChecks(roundChecks(checks, 0));
    expect(s.count).toBe(2);
    expect(s.avg).toBeCloseTo(0.6);
    expect(s.perfect).toBe(1);
    expect(s.topMissed[0]).toMatchObject({ phenomenon: 'linking', missed: 1 });
  });

  it('starts counting at the round start and caps at the goal', () => {
    const many = Array.from({ length: 25 }, (_, i) => c(`s${i}`, 1));
    expect(roundChecks(many, 0)).toHaveLength(SESSION_GOAL);
    expect(roundProgress(many, 0).reached).toBe(true);
    expect(roundProgress(many, 20)).toMatchObject({ done: 5, reached: false });
    // a sentence done in the previous round counts again in the new one
    expect(roundChecks([c('a', 1), c('a', 0.5)], 1)).toEqual([c('a', 0.5)]);
    expect(roundChecks(many, Number.NaN)).toHaveLength(SESSION_GOAL);
  });
});
