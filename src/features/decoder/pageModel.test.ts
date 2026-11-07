import { describe, expect, it } from 'vitest';
import {
  addSentenceForDictation,
  addToHistory,
  chipLabel,
  cleanInput,
  findBuiltin,
  HISTORY_MAX,
  removeFromHistory,
  sanitizeHistory,
  shareUrl,
} from './pageModel';
import { parseHash } from '../../core/nav';
import { SENTENCES } from '../../data/sentences';

describe('decoder history', () => {
  it('sanitizes corrupt storage', () => {
    expect(sanitizeHistory(null)).toEqual([]);
    expect(sanitizeHistory('nope')).toEqual([]);
    expect(sanitizeHistory([1, null, {}, '  ', '!!!', ' Get  it. ', 'get it.', 'Turn it off'])).toEqual(['Get it.', 'Turn it off']);
    const many = Array.from({ length: 30 }, (_, i) => `Sentence ${i}`);
    expect(sanitizeHistory(many)).toHaveLength(HISTORY_MAX);
  });
  it('adds newest first, moves duplicates up, caps at 10', () => {
    let h: string[] = [];
    h = addToHistory(h, 'One');
    h = addToHistory(h, 'Two');
    h = addToHistory(h, 'one');
    expect(h).toEqual(['one', 'Two']);
    for (let i = 0; i < 20; i++) h = addToHistory(h, `S${i}`);
    expect(h).toHaveLength(HISTORY_MAX);
    expect(h[0]).toBe('S19');
  });
  it('returns the same array when nothing changes', () => {
    const h = ['Hello there'];
    expect(addToHistory(h, 'Hello there')).toBe(h);
    expect(addToHistory(h, '   ')).toBe(h);
    expect(addToHistory(h, '?!')).toBe(h);
  });
  it('removes one entry', () => {
    expect(removeFromHistory(['a b', 'c d'], 'a b')).toEqual(['c d']);
  });
  it('chip labels are short', () => {
    expect(chipLabel('short')).toBe('short');
    const long = chipLabel('x'.repeat(100));
    expect(long.length).toBeLessThanOrEqual(42);
    expect(long.endsWith('…')).toBe(true);
  });
  it('cleanInput drops control characters and caps length', () => {
    expect(cleanInput('a\u0000b\n\tc')).toBe('a b c');
    expect(cleanInput('y'.repeat(700))).toHaveLength(600);
    expect(cleanInput(42)).toBe('');
  });
});

describe('share link', () => {
  it('round-trips the text through the hash route', () => {
    const url = shareUrl({ origin: 'https://example.app', pathname: '/' }, "What's up? I'm going to go & see.");
    expect(url.startsWith('https://example.app/#/decoder?text=')).toBe(true);
    const route = parseHash(url.slice(url.indexOf('#')));
    expect(route.id).toBe('decoder');
    expect(route.params.text).toBe("What's up? I'm going to go & see.");
  });
  it('caps very long text and survives "+", "%" and "#" in the sentence', () => {
    const tricky = 'Is 50% + 50% = 100%? #yes ' + 'very '.repeat(200);
    const url = shareUrl({ origin: 'https://example.app', pathname: '/' }, tricky);
    const text = parseHash(url.slice(url.indexOf('#'))).params.text;
    expect(text).toBe(cleanInput(tricky));
    expect(text.length).toBeLessThanOrEqual(600);
    expect(parseHash('#/decoder?text=%E0%A4%A').params.text).toBeTypeOf('string'); // malformed escape: no throw
  });
  it('keeps a sub-path and handles empty text', () => {
    expect(shareUrl({ origin: 'http://localhost:5173', pathname: '/app/' }, '  ')).toBe('http://localhost:5173/app/#/decoder');
  });
});

describe('send to dictation', () => {
  it('adds a new sentence', () => {
    const r = addSentenceForDictation([], 'Turn it off, please.', 1_700_000_000_000, () => 3);
    expect(r.status).toBe('added');
    expect(r.list).toHaveLength(1);
    expect(r.list[0].text).toBe('Turn it off, please.');
  });
  it('an existing sentence is not an error', () => {
    const first = addSentenceForDictation([], 'Turn it off.', 1, () => 1);
    const again = addSentenceForDictation(first.list, 'turn it off', 2);
    expect(again.status).toBe('exists');
    expect(again.list).toHaveLength(1);
  });
  it('reports a Vietnamese message for invalid text and survives corrupt storage', () => {
    const r = addSentenceForDictation('garbage', 'a'.repeat(400), 1);
    expect(r.status).toBe('error');
    if (r.status === 'error') expect(r.message).toMatch(/tối đa/);
    expect(addSentenceForDictation({ x: 1 }, 'Xin chào các bạn', 1).status).toBe('error');
  });
  it('returns the id to open first, for a new and an already-saved sentence', () => {
    const r = addSentenceForDictation([], 'Turn it off, please.', 1_700_000_000_000, () => 3);
    expect(r.status).toBe('added');
    if (r.status !== 'added') return;
    expect(r.id).toBe(r.list[0].id);
    const again = addSentenceForDictation(r.list, '  turn it OFF please ', 1_700_000_000_500);
    expect(again.status).toBe('exists');
    if (again.status === 'exists') expect(again.id).toBe(r.id);
  });
});

describe('built-in sentences', () => {
  it('resolves a shipped sentence to its own id and does not need a custom copy', () => {
    const s = SENTENCES[0];
    expect(findBuiltin(s.text, SENTENCES)).toBe(s.id);
    expect(findBuiltin(`  ${s.text.toUpperCase()}  `, SENTENCES)).toBe(s.id);
  });
  it('returns undefined for typed text and empty input', () => {
    const list = [{ id: 's1', text: 'Get it.' }];
    expect(findBuiltin('Something nobody ships, surely.', list)).toBeUndefined();
    expect(findBuiltin('   ', list)).toBeUndefined();
    expect(findBuiltin('?!', list)).toBeUndefined();
  });
});
