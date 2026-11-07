import { describe, expect, it } from 'vitest';
import {
  addCustom,
  cleanText,
  estimateLevel,
  makeCustomId,
  MAX_CUSTOM,
  parseBulk,
  removeCustom,
  sanitizeCustom,
  toSentence,
  updateCustom,
  validateCustomText,
  wordCount,
  type CustomSentence,
} from './custom';

const analyzeNone = () => 0;

describe('estimateLevel', () => {
  it('short, light sentences are easy', () => {
    expect(estimateLevel(4, 2)).toBe(1);
    expect(estimateLevel(7, 4)).toBe(1);
  });
  it('medium sentences are medium', () => {
    expect(estimateLevel(9, 3)).toBe(2);
    expect(estimateLevel(10, 9)).toBe(2);
  });
  it('long or dense sentences are hard', () => {
    expect(estimateLevel(15, 7)).toBe(3);
    expect(estimateLevel(12, 8)).toBe(3);
  });
  it('tolerates bad numbers', () => {
    expect(estimateLevel(Number.NaN, -3)).toBe(1);
  });
});

describe('text helpers', () => {
  it('cleanText collapses whitespace and control chars', () => {
    expect(cleanText('  Turn\tit \n off\u0007 ')).toBe('Turn it off');
    expect(cleanText(42)).toBe('');
  });
  it('wordCount ignores punctuation-only tokens', () => {
    expect(wordCount('Well — I think so .')).toBe(4);
  });
  it('makeCustomId uses base36 time and avoids collisions', () => {
    const id = makeCustomId(1700000000000, new Set());
    expect(id).toBe('u-' + (1700000000000).toString(36));
    expect(makeCustomId(1700000000000, new Set([id]))).toBe('u-' + (1700000000001).toString(36));
  });
});

describe('validateCustomText', () => {
  const list: CustomSentence[] = [{ id: 'u-1', text: 'Turn it off.', vi: '', level: 1, createdAt: 1 }];
  it('requires English letters', () => {
    expect(validateCustomText('   ', list)).toBe('empty');
    expect(validateCustomText('123 456', list)).toBe('no-letters');
    expect(validateCustomText('Tắt nó đi', list)).toBe('not-english');
    expect(validateCustomText('Xin chào', list)).toBe('not-english');
    expect(validateCustomText("Let's grab a café latte", list)).toBeNull();
  });
  it('rejects duplicates ignoring case/punctuation, except the sentence being edited', () => {
    expect(validateCustomText('turn it off', list)).toBe('duplicate');
    expect(validateCustomText('turn it off', list, 'u-1')).toBeNull();
  });
  it('rejects overly long text', () => {
    expect(validateCustomText('a '.repeat(200), list)).toBe('too-long');
  });
});

describe('sanitizeCustom', () => {
  it('drops junk, repairs ids and levels, dedupes', () => {
    const raw = [
      null,
      'string',
      { id: 'u-abc', text: '  Pick it up  ', vi: 'Nhặt lên', level: 2, createdAt: 10 },
      { id: 'u-abc', text: 'Another one here', level: 9 },
      { id: 'bad id', text: 'pick it up!' },
      { text: '' },
      { id: 'u-x', text: '!!!' },
    ];
    const out = sanitizeCustom(raw, analyzeNone);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({ id: 'u-abc', text: 'Pick it up', vi: 'Nhặt lên', level: 2, createdAt: 10 });
    expect(out[1].id).not.toBe('u-abc');
    expect(out[1].id).toMatch(/^u-[0-9a-z]+$/);
    expect(out[1].level).toBe(1);
  });
  it('returns [] for non-arrays', () => {
    expect(sanitizeCustom({ a: 1 })).toEqual([]);
    expect(sanitizeCustom(undefined)).toEqual([]);
  });
  it('survives a throwing analyzer', () => {
    const out = sanitizeCustom([{ id: 'u-1', text: 'Hi there' }], () => {
      throw new Error('boom');
    });
    expect(out[0].level).toBe(1);
  });
});

describe('parseBulk', () => {
  it('splits lines, strips bullets/numbers, reads optional meaning, dedupes', () => {
    const out = parseBulk('1. Turn it off\n- Pick it up | Nhặt lên\n\n* turn it off\nCheck it out\tXem thử đi\n   ');
    expect(out).toEqual([
      { text: 'Turn it off' },
      { text: 'Pick it up', vi: 'Nhặt lên' },
      { text: 'Check it out', vi: 'Xem thử đi' },
    ]);
  });
});

describe('add / update / remove', () => {
  it('adds valid lines with distinct ids and reports rejected ones', () => {
    const { list, added, rejected } = addCustom([], [{ text: 'Turn it off' }, { text: 'turn it off!' }, { text: 'Xin chào bạn' }], 1000, () => 2);
    expect(added).toHaveLength(1);
    expect(list).toHaveLength(1);
    expect(rejected.map((r) => r.error)).toEqual(['duplicate', 'not-english']);
    expect(added[0].level).toBe(1);
    const more = addCustom(list, [{ text: 'One more' }, { text: 'And another' }], 1000);
    const ids = more.list.map((c) => c.id);
    expect(new Set(ids).size).toBe(3);
  });
  it('stops at the size limit', () => {
    const big: CustomSentence[] = Array.from({ length: MAX_CUSTOM }, (_, i) => ({ id: `u-${i.toString(36)}`, text: `Sentence number ${i}`, vi: '', level: 1, createdAt: 1 }));
    expect(addCustom(big, [{ text: 'brand new line' }], 5).rejected[0].error).toBe('full');
  });
  it('updates text/meaning, re-estimates level, keeps id', () => {
    const { list } = addCustom([], [{ text: 'Hi there' }], 1);
    const id = list[0].id;
    const r = updateCustom(list, id, { text: 'I was going to tell him about it but I forgot to do it yesterday', vi: 'x' }, () => 6);
    expect(r.error).toBeNull();
    expect(r.list[0]).toMatchObject({ id, vi: 'x', level: 3 });
    expect(updateCustom(r.list, id, { text: '' }).error).toBe('empty');
  });
  it('removes by id and converts to a Sentence', () => {
    const { list } = addCustom([], [{ text: 'Hi there', vi: 'Chào' }], 1);
    const s = toSentence(list[0], ['linking']);
    expect(s).toMatchObject({ text: 'Hi there', vi: 'Chào', topic: 'Câu của tôi', focus: ['linking'] });
    expect(removeCustom(list, list[0].id)).toEqual([]);
  });
});
