import { afterEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_PREFIX } from '../storage';
import { CHUNKS } from '../../data/chunks';
import { LESSONS } from '../../data/lessons';
import { PAIR_SETS } from '../../data/pairs';
import { SENTENCES } from '../../data/sentences';
import { buildCatalog, invalidateCatalog, readCatalog, staticContentIds } from './catalog';

describe('buildCatalog', () => {
  const cat = buildCatalog({
    builtinSentenceIds: new Set(['s1']),
    customSentenceIds: new Set(['u-1']),
    lessonIds: new Set(['linking']),
    chunkIds: new Set(['gonna']),
    pairSetIds: new Set(['can-cant']),
    media: new Map([['m1', 3]]),
  });

  it('has() per kind', () => {
    expect(cat.has('dict:s1')).toBe(true);
    expect(cat.has('dict:u-1')).toBe(true);
    expect(cat.has('dict:s2')).toBe(false);
    expect(cat.has('lesson:linking')).toBe(true);
    expect(cat.has('lesson:s1')).toBe(false);
    expect(cat.has('chunk:gonna')).toBe(true);
    expect(cat.has('chunk:wanna')).toBe(false);
    expect(cat.has('pair:can-cant')).toBe(true);
    expect(cat.has('pair:nope')).toBe(false);
  });

  it('media: the item exists and the unit is inside the transcript', () => {
    expect(cat.has('media:m1:0')).toBe(true);
    expect(cat.has('media:m1:2')).toBe(true);
    expect(cat.has('media:m1:3')).toBe(false);
    expect(cat.has('media:m2:0')).toBe(false);
    expect(cat.has('media:m1:x')).toBe(false);
    expect(cat.has('media:m1')).toBe(false);
  });

  it('rejects unparsable ids', () => {
    expect(cat.has('bogus' as never)).toBe(false);
  });
});

describe('static content ids', () => {
  it('cover the built-in data (lessons with a quiz only)', () => {
    const s = staticContentIds();
    expect(s.builtinSentenceIds.size).toBe(new Set(SENTENCES.map((x) => x.id)).size);
    expect([...s.lessonIds].sort()).toEqual(
      LESSONS.filter((l) => l.quiz.length > 0)
        .map((l) => l.id)
        .sort(),
    );
    expect(s.chunkIds.has(CHUNKS[0].id)).toBe(true);
    expect([...s.pairSetIds].sort()).toEqual(PAIR_SETS.map((p) => p.id).sort());
  });
});

describe('readCatalog', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    invalidateCatalog();
  });

  it('reads custom sentences and saved media, cached until invalidated', () => {
    const map = new Map<string, string>();
    map.set(STORAGE_PREFIX + 'custom-sentences', JSON.stringify([{ id: 'u-1', text: 'Hi there' }, { nope: 1 }, 'x']));
    map.set(
      STORAGE_PREFIX + 'media-library',
      JSON.stringify({
        items: [
          {
            id: 'm1',
            kind: 'file',
            title: 't',
            units: [
              { start: 0, end: 1, text: 'a' },
              { start: 1, end: 2, text: 'b' },
            ],
          },
        ],
      }),
    );
    vi.stubGlobal('window', {
      localStorage: { getItem: (k: string) => map.get(k) ?? null },
    });
    invalidateCatalog();
    const c = readCatalog();
    expect(c.has('dict:u-1')).toBe(true);
    expect(c.has('media:m1:1')).toBe(true);
    expect(c.has('media:m1:2')).toBe(false);
    expect(c.has(`dict:${SENTENCES[0].id}`)).toBe(true);
    map.set(
      STORAGE_PREFIX + 'custom-sentences',
      JSON.stringify([
        { id: 'u-aaa', text: 'I want to go home' },
        { id: 'u-bbb', text: 'I want to go home.' }, // same sentence added on two devices: DictationPage drops it
      ]),
    );
    invalidateCatalog();
    const dup = readCatalog();
    expect(dup.has('dict:u-aaa')).toBe(true);
    expect(dup.has('dict:u-bbb')).toBe(false);
    map.set(STORAGE_PREFIX + 'custom-sentences', JSON.stringify([{ id: 'u-1', text: 'Hi there' }]));
    invalidateCatalog();
    const again = readCatalog();
    map.set(STORAGE_PREFIX + 'custom-sentences', '[]');
    expect(readCatalog()).toBe(again);
    invalidateCatalog();
    expect(readCatalog().has('dict:u-1')).toBe(false);
  });
});
