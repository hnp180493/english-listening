import { describe, expect, it } from 'vitest';
import { decode } from '../../core/decoder';
import type { Chunk, DecodeResult, Sentence } from '../../core/types';
import { evaluateShadow, scoreVerdict, seenPhenomena } from './feedback';
import {
  cleanCustomText,
  customSource,
  filterChunks,
  filterSentences,
  foldText,
  nextItemId,
  resolveSource,
  suggestSentence,
} from './sources';
import { buildSteps, repeatPauseMs } from './steps';
import {
  HISTORY_LEN,
  MAX_ITEMS,
  customItemId,
  recentCustom,
  sanitizeState,
  toPercent,
  withAttempt,
  type ShadowState,
} from './store';
import { QUIET_MS, quietDelayMs, transcriptCoversTarget } from './autostop';

const SENTS: Sentence[] = [
  { id: 's1', text: 'Turn it off, please.', vi: 'Tắt nó đi.', level: 1, topic: 'Gia đình', focus: ['linking'] },
  { id: 's2', text: 'Did you eat yet?', vi: 'Bạn ăn chưa?', level: 1, topic: 'Ăn uống', focus: ['assimilation'] },
  { id: 's3', text: 'I was going to call you.', vi: 'Mình định gọi bạn.', level: 2, topic: 'Công việc', focus: ['reduction'] },
];
const CHUNKS: Chunk[] = [
  {
    id: 'c002', written: 'want to', spoken: 'wanna', ttsText: 'wanna', phenomena: ['reduction'],
    meaning: 'Muốn', example: 'Do you want to go?', exampleVi: 'Bạn muốn đi không?', rank: 2,
  },
  {
    id: 'c001', written: 'going to', spoken: 'gonna', ttsText: 'gonna', phenomena: ['reduction'],
    meaning: 'Sẽ', example: "I'm going to call her.", exampleVi: 'Tôi sẽ gọi cô ấy.', rank: 1,
  },
];

describe('store', () => {
  it('sanitizes junk', () => {
    expect(sanitizeState(null)).toEqual({});
    expect(sanitizeState([1, 2])).toEqual({});
    expect(sanitizeState({ a: 5, b: { attempts: 'x' } })).toEqual({});
    const s = sanitizeState({
      s1: { attempts: [{ at: 2, score: 1.5 }, { at: 1, score: 0.4, self: 'meh' }, { at: 'x', score: 1 }], best: 'q' },
    });
    expect(s.s1.attempts).toEqual([{ at: 1, score: 0.4 }, { at: 2, score: 1 }]);
    expect(s.s1.best).toBe(1);
    expect(s.s1.total).toBe(2);
  });

  it('keeps the last HISTORY_LEN attempts and tracks best/total', () => {
    let st: ShadowState = {};
    for (let i = 0; i < 8; i++) st = withAttempt(st, 's1', { at: i, score: i === 2 ? 0.95 : 0.5 });
    expect(st.s1.attempts).toHaveLength(HISTORY_LEN);
    expect(st.s1.total).toBe(8);
    expect(st.s1.best).toBe(0.95);
    expect(st.s1.attempts[HISTORY_LEN - 1].at).toBe(7);
  });

  it('caps the number of items, dropping the oldest', () => {
    let st: ShadowState = {};
    for (let i = 0; i < MAX_ITEMS + 3; i++) st = withAttempt(st, `x${i}`, { at: i, score: 0.5 });
    expect(Object.keys(st)).toHaveLength(MAX_ITEMS);
    expect(st.x0).toBeUndefined();
    expect(st[`x${MAX_ITEMS + 2}`]).toBeDefined();
  });

  it('makes stable custom ids', () => {
    expect(customItemId('Hello  World')).toBe(customItemId('hello world'));
    expect(customItemId('a')).not.toBe(customItemId('b'));
    expect(customItemId('x')).toMatch(/^custom:/);
  });

  it('converts to percent safely', () => {
    expect(toPercent(0.876)).toBe(88);
    expect(toPercent(NaN)).toBe(0);
    expect(toPercent(3)).toBe(100);
  });
});

describe('sources', () => {
  it('resolves route params', () => {
    expect(resolveSource({ id: 's2' }, SENTS, CHUNKS)?.text).toBe('Did you eat yet?');
    const c = resolveSource({ id: 'c001' }, SENTS, CHUNKS);
    expect(c?.kind).toBe('chunk');
    expect(c?.text).toBe("I'm going to call her.");
    const t = resolveSource({ text: '  Got  it ' }, SENTS, CHUNKS);
    expect(t?.kind).toBe('custom');
    expect(t?.text).toBe('Got it');
    expect(resolveSource({ id: 'nope' }, SENTS, CHUNKS)).toBeNull();
    expect(resolveSource({}, SENTS, CHUNKS)).toBeNull();
    expect(customSource('123 !!')).toBeNull();
  });

  it('keeps the identity of built-in items passed as text (e.g. back from the decoder)', () => {
    const s = resolveSource({ text: '  did you  eat yet? ' }, SENTS, CHUNKS);
    expect(s?.kind).toBe('sentence');
    expect(s?.itemId).toBe('s2');
    expect(s?.vi).toBe('Bạn ăn chưa?');
    expect(nextItemId(s!.itemId, SENTS, CHUNKS)).not.toBeNull();
    const c = resolveSource({ text: 'I’m going to call her.' }, SENTS, CHUNKS);
    expect(c?.kind).toBe('chunk');
    expect(c?.itemId).toBe('c001');
    // An id that resolves still wins over the text.
    expect(resolveSource({ id: 's1', text: 'Did you eat yet?' }, SENTS, CHUNKS)?.itemId).toBe('s1');
    // Near misses stay custom.
    expect(resolveSource({ text: 'Did you eat yet' }, SENTS, CHUNKS)?.kind).toBe('custom');
  });

  it('caps custom text', () => {
    expect(cleanCustomText('a'.repeat(1000))).toHaveLength(300);
  });

  it('cuts long custom text at a word boundary', () => {
    const words = Array.from({ length: 80 }, (_, i) => `word${i}`).join(' ');
    const out = cleanCustomText(words);
    expect(out.length).toBeLessThanOrEqual(300);
    expect(words.startsWith(out)).toBe(true);
    expect(words.charAt(out.length)).toBe(' ');
    expect(out.endsWith(' ')).toBe(false);
    // The limit lands exactly on a space (index 300): the whole last word is kept.
    const exact = 'abcd '.repeat(59) + 'abcde';
    expect(exact).toHaveLength(300);
    expect(cleanCustomText(exact + ' tail')).toBe(exact);
    // The limit lands inside a word: that word is dropped, not cut in half.
    expect(cleanCustomText(exact + 'xyz tail')).toBe('abcd '.repeat(58) + 'abcd');
    // Trailing separators before the cut are trimmed.
    const comma = 'abcd '.repeat(58) + 'abcd, — ' + 'z'.repeat(20);
    expect(cleanCustomText(comma)).toBe('abcd '.repeat(58) + 'abcd');
    // No word boundary in the second half of the limit: hard cut.
    expect(cleanCustomText('hi ' + 'x'.repeat(400))).toBe('hi ' + 'x'.repeat(297));
    expect(cleanCustomText('short   text ')).toBe('short text');
  });

  it('folds Vietnamese for search', () => {
    expect(foldText('Công  Việc Đi')).toBe('cong viec di');
    expect(filterSentences(SENTS, { level: 0, query: 'cong viec' }).map((s) => s.id)).toEqual(['s3']);
    expect(filterSentences(SENTS, { level: 1, query: '' }).map((s) => s.id)).toEqual(['s1', 's2']);
    expect(filterSentences(SENTS, { level: 1, query: 'eat' }).map((s) => s.id)).toEqual(['s2']);
    expect(filterChunks(CHUNKS, '').map((c) => c.id)).toEqual(['c001', 'c002']);
    expect(filterChunks(CHUNKS, 'wanna').map((c) => c.id)).toEqual(['c002']);
  });

  it('finds the next item within the same level / chunk rank', () => {
    expect(nextItemId('s1', SENTS, CHUNKS)).toBe('s2');
    expect(nextItemId('s2', SENTS, CHUNKS)).toBe('s1');
    expect(nextItemId('s3', SENTS, CHUNKS)).toBe('s3');
    expect(nextItemId('c001', SENTS, CHUNKS)).toBe('c002');
    expect(nextItemId('custom:abc', SENTS, CHUNKS)).toBeNull();
  });

  it('suggests unpractised sentences first, then the weakest', () => {
    expect(suggestSentence([], {})).toBeNull();
    expect(suggestSentence(SENTS, {})?.id).toBe('s1');
    const h: ShadowState = {
      s1: { attempts: [{ at: 1, score: 0.9 }], total: 1, best: 0.9 },
      s2: { attempts: [{ at: 1, score: 0.3 }], total: 1, best: 0.3 },
    };
    expect(suggestSentence(SENTS, h)?.id).toBe('s3');
    h.s3 = { attempts: [{ at: 1, score: 0.8 }], total: 1, best: 0.8 };
    expect(suggestSentence(SENTS, h)?.id).toBe('s2');
  });
});

describe('evaluateShadow', () => {
  it('scores a perfect transcript at 100%', () => {
    const r = decode('Turn it off, please.');
    const f = evaluateShadow(r, 'turn it off please');
    expect(f.percent).toBe(100);
    expect(f.words.every((w) => w.status !== 'miss')).toBe(true);
    expect(f.missedAnnotations).toEqual([]);
  });

  it('accepts reduced forms the recognizer may write', () => {
    const r = decode('I was going to call you.');
    expect(evaluateShadow(r, 'I was gonna call you').percent).toBe(100);
  });

  it('marks missed words and maps them to connected-speech annotations', () => {
    const r = decode('Turn it off, please.');
    const f = evaluateShadow(r, 'turn of please');
    expect(f.percent).toBeLessThan(100);
    const missed = f.words.filter((w) => w.status === 'miss').map((w) => w.raw);
    expect(missed.length).toBeGreaterThan(0);
    if (r.annotations.some((a) => a.from <= 1 && 1 <= a.to)) {
      expect(f.missedAnnotations.length).toBeGreaterThan(0);
    }
  });

  it('reports extra words and handles an empty transcript', () => {
    const r = decode('Did you eat yet?');
    const f = evaluateShadow(r, 'did you eat yet banana');
    expect(f.extra).toEqual(['banana']);
    expect(f.percent).toBeLessThan(100);
    const empty = evaluateShadow(r, '   ');
    expect(empty.percent).toBe(0);
    expect(empty.heard).toBe('');
  });

  it('copes with an empty sentence', () => {
    const r: DecodeResult = { input: '', tokens: [], annotations: [], segments: [], spokenText: '' };
    const f = evaluateShadow(r, 'hello');
    expect(f.words).toEqual([]);
    expect(f.percent).toBe(0);
  });

  it('gives verdicts and seen phenomena', () => {
    expect(scoreVerdict(95).tone).toBe('ok');
    expect(scoreVerdict(50).tone).toBe('warn');
    expect(scoreVerdict(10).tone).toBe('bad');
    const empty: DecodeResult = { input: 'x', tokens: [], annotations: [], segments: [], spokenText: '' };
    expect(seenPhenomena(empty, ['linking'])).toEqual(['linking']);
  });
});

describe('steps', () => {
  it('splits into short phrases that cover every token, breaking at punctuation', () => {
    const r = decode("Check it out, it's great and I think you are going to love it.");
    const steps = buildSteps(r, 4);
    expect(steps.length).toBeGreaterThan(1);
    expect(steps[0].text.endsWith(',')).toBe(true);
    expect(steps[0].from).toBe(0);
    expect(steps[steps.length - 1].to).toBe(r.tokens.length - 1);
    for (let i = 1; i < steps.length; i++) expect(steps[i].from).toBe(steps[i - 1].to + 1);
    // a segment is never cut in half
    for (const seg of r.segments) {
      const owner = steps.find((s) => s.from <= seg.from && seg.from <= s.to);
      expect(owner && seg.to <= owner.to).toBe(true);
    }
  });

  it('handles empty input', () => {
    const r: DecodeResult = { input: '', tokens: [], annotations: [], segments: [], spokenText: '' };
    expect(buildSteps(r)).toEqual([]);
  });

  it('pauses longer for longer phrases and slower rates, within bounds', () => {
    expect(repeatPauseMs(4)).toBeGreaterThan(repeatPauseMs(1));
    expect(repeatPauseMs(3, 0.8)).toBeGreaterThan(repeatPauseMs(3, 1));
    expect(repeatPauseMs(100)).toBe(8000);
    expect(repeatPauseMs(0, 0)).toBeGreaterThanOrEqual(1800);
  });
});

describe('custom sentence memory', () => {
  it('remembers the text of typed-in sentences only', () => {
    const id = customItemId('Got it');
    let st = withAttempt({}, id, { at: 1, score: 0.5 }, '  Got   it ');
    expect(st[id].text).toBe('Got it');
    st = withAttempt(st, id, { at: 2, score: 0.7 });
    expect(st[id].text).toBe('Got it');
    st = withAttempt(st, 's1', { at: 3, score: 1 }, 'should be ignored');
    expect(st.s1.text).toBeUndefined();
    st = withAttempt(st, 's2', { at: 4, score: NaN });
    expect(st.s2.attempts[0].score).toBe(0);
  });

  it('sanitizes stored text and lists recent ones newest first', () => {
    const a = customItemId('Old one');
    const b = customItemId('New one');
    const raw = {
      [a]: { attempts: [{ at: 1, score: 0.4 }], text: 'Old one' },
      [b]: { attempts: [{ at: 9, score: 0.8 }], text: 'New one' },
      'custom:zz': { attempts: [{ at: 5, score: 0.8 }], text: 42 },
      s1: { attempts: [{ at: 7, score: 0.8 }], text: 'not custom' },
    };
    const st = sanitizeState(raw);
    expect(st['custom:zz'].text).toBeUndefined();
    expect(st.s1.text).toBeUndefined();
    expect(recentCustom(st).map((r) => r.text)).toEqual(['New one', 'Old one']);
    expect(recentCustom(st, 1)).toHaveLength(1);
    expect(recentCustom({})).toEqual([]);
  });
});

describe('auto-stop', () => {
  const target = 'Did you eat yet?'.split(' ');

  it('knows when the transcript reaches the end of the sentence', () => {
    expect(transcriptCoversTarget(target, '')).toBe(false);
    expect(transcriptCoversTarget(target, 'did you')).toBe(false);
    expect(transcriptCoversTarget(target, 'did you eat yet')).toBe(true);
    expect(transcriptCoversTarget(target, 'did you it yet')).toBe(true); // reached the end, one word wrong
    expect(transcriptCoversTarget(target, 'did ya eat yet')).toBe(true);
    expect(transcriptCoversTarget([], 'hello')).toBe(true);
  });

  it('copes with contractions and numbers the recognizer writes differently', () => {
    expect(transcriptCoversTarget("I'm going to call you at two.".split(' '), 'I am gonna call you at 2')).toBe(true);
  });

  it('waits less once the sentence is complete', () => {
    expect(quietDelayMs(true, true)).toBe(QUIET_MS.finalComplete);
    expect(quietDelayMs(true, false)).toBeGreaterThan(quietDelayMs(true, true));
    expect(quietDelayMs(false, false)).toBeGreaterThan(quietDelayMs(false, true));
    expect(quietDelayMs(false, true)).toBeGreaterThan(quietDelayMs(true, true));
  });
});

describe('evaluateShadow with recognizer spellings', () => {
  it('accepts digits, contractions and punctuation-free transcripts', () => {
    const r = decode("I'm going to call you at two.");
    expect(evaluateShadow(r, 'I am gonna call you at 2').percent).toBe(100);
    const r2 = decode("Don't worry about it.");
    expect(evaluateShadow(r2, 'do not worry about it').percent).toBe(100);
  });
});
