import { describe, expect, it } from 'vitest';
import { newCard, type CardState } from '../../core/srs';
import type { Chunk, Phenomenon } from '../../core/types';
import { CHUNKS } from '../../data/chunks';
import { CHOICE_COUNT, buildChoices, canChoose, cardKind, choiceSeed, hashString, seededRandom } from './choice';
import { sanitizeChunks } from './chunkData';
import { splitHighlight, variants } from './match';

const NOW = Date.UTC(2026, 10, 5);

function chunk(id: string, written: string, phenomena: Phenomenon[], example = '', rank = 1): Chunk {
  return { id, written, spoken: written, ttsText: written, phenomena, meaning: '', example, exampleVi: '', rank };
}

function reps(id: string, n: number): CardState {
  return { ...newCard(id, NOW), reps: n, interval: 3 };
}

describe('hashString / seededRandom', () => {
  it('are deterministic and in range', () => {
    expect(hashString('c001')).toBe(hashString('c001'));
    expect(hashString('c001')).not.toBe(hashString('c002'));
    const a = seededRandom(42);
    const b = seededRandom(42);
    for (let i = 0; i < 20; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });
});

describe('canChoose', () => {
  it('needs the chunk to be inside its example sentence', () => {
    expect(canChoose(chunk('a', 'want to', ['reduction'], 'Do you want to go?'))).toBe(true);
    expect(canChoose(chunk('a', 'want to', ['reduction'], 'I like tea.'))).toBe(false);
    expect(canChoose(chunk('a', 'want to', ['reduction'], ''))).toBe(false);
  });
});

describe('cardKind', () => {
  const c = chunk('k1', 'want to', ['reduction'], 'Do you want to go?');

  it('new and young cards are always typed', () => {
    expect(cardKind(c, undefined)).toBe('type');
    expect(cardKind(c, reps('k1', 0))).toBe('type');
    expect(cardKind(c, reps('k1', 1))).toBe('type');
  });

  it('alternates deterministically from 2 reps on', () => {
    const kinds = [2, 3, 4, 5, 6, 7].map((n) => cardKind(c, reps('k1', n)));
    expect(new Set(kinds)).toEqual(new Set(['type', 'choose']));
    for (let i = 1; i < kinds.length; i++) expect(kinds[i]).not.toBe(kinds[i - 1]);
    expect(cardKind(c, reps('k1', 4))).toBe(kinds[2]);
  });

  it('falls back to typing when the example does not contain the chunk', () => {
    const bad = chunk('k1', 'want to', ['reduction'], 'Nothing here.');
    for (const n of [2, 3, 4, 5]) expect(cardKind(bad, reps('k1', n))).toBe('type');
  });
});

describe('buildChoices', () => {
  const target = chunk('t', 'going to', ['reduction', 'weak-form'], "I'm going to call her.", 10);
  const pool = [
    target,
    chunk('p1', 'want to', ['reduction', 'weak-form'], '', 11),
    chunk('p2', 'kind of', ['reduction'], '', 12),
    chunk('p3', 'got to', ['reduction'], '', 13),
    chunk('p4', 'call her', ['h-dropping'], '', 14), // audible in the target sentence
    chunk('p5', 'gonna', ['reduction'], '', 15), // same as the answer
    chunk('p6', 'tell him', ['h-dropping'], '', 16),
    chunk('p7', 'want to', ['reduction'], '', 17), // duplicate written form
  ];

  it('returns 4 distinct options including the answer, deterministically', () => {
    const a = buildChoices(target, pool, 123);
    expect(a).not.toBeNull();
    expect(a!.length).toBe(CHOICE_COUNT);
    expect(a!.map((c) => c.id)).toContain('t');
    expect(new Set(a!.map((c) => c.written)).size).toBe(CHOICE_COUNT);
    expect(buildChoices(target, pool, 123)!.map((c) => c.id)).toEqual(a!.map((c) => c.id));
  });

  it('never offers a chunk that is also in the sentence or equals the answer', () => {
    for (let seed = 0; seed < 40; seed++) {
      const ids = buildChoices(target, pool, seed)!.map((c) => c.id);
      expect(ids).not.toContain('p4');
      expect(ids).not.toContain('p5');
    }
  });

  it('prefers distractors sharing a phenomenon', () => {
    for (let seed = 0; seed < 20; seed++) {
      const ids = buildChoices(target, pool, seed)!.map((c) => c.id).sort();
      expect(ids).toEqual(['p1', 'p2', 'p3', 't']);
    }
  });

  it('returns null when there are not enough safe distractors', () => {
    expect(buildChoices(target, [target, pool[1], pool[4], pool[5]], 1)).toBeNull();
    expect(buildChoices(target, [], 1)).toBeNull();
  });

  it('works for every choose-capable chunk of the real data set', () => {
    const all = sanitizeChunks(CHUNKS);
    for (const c of all.filter(canChoose)) {
      const opts = buildChoices(c, all, choiceSeed(c, reps(c.id, 2)));
      expect(opts).not.toBeNull();
      for (const o of opts!) {
        if (o.id === c.id) continue;
        expect(splitHighlight(c.example, [o.written, o.spoken, o.ttsText])).toBeNull();
      }
    }
  });
});

describe('buildChoices: ambiguity guards', () => {
  const filler = [
    chunk('f1', 'kind of', ['reduction'], '', 30),
    chunk('f2', 'out of', ['reduction'], '', 31),
    chunk('f3', 'a lot of', ['reduction'], '', 32),
    chunk('f4', 'let me', ['assimilation'], '', 33),
  ];

  it('never offers a chunk heard through a contraction or reduction of the sentence', () => {
    const target = chunk('t', 'call her', ['h-dropping'], "I'm going to call her.", 1);
    const gonna = { ...chunk('g', 'gonna', ['reduction'], '', 2), ttsText: 'gonna', spoken: 'gə-nə' };
    const iDid = chunk('d', "I'd", ['contraction'], '', 3);
    const target2 = chunk('t2', 'mean that', ['elision'], "I'm sorry, I didn't mean that.", 1);
    for (let seed = 0; seed < 30; seed++) {
      expect(buildChoices(target, [target, gonna, ...filler], seed)!.map((c) => c.id)).not.toContain('g');
      expect(buildChoices(target2, [target2, iDid, ...filler], seed)!.map((c) => c.id)).not.toContain('d');
    }
  });

  it('never offers a phrase that contains the answer word for word, or is contained in it', () => {
    const target = chunk('t', 'have to', ['weak-form'], 'We have to leave now.', 1);
    const longer = chunk('l', "don't have to", ['weak-form'], '', 2);
    const target2 = chunk('t2', 'what time is it', ['linking'], 'Excuse me, what time is it?', 1);
    const shorter = chunk('s', 'is it', ['linking'], '', 2);
    for (let seed = 0; seed < 30; seed++) {
      expect(buildChoices(target, [target, longer, ...filler], seed)!.map((c) => c.id)).not.toContain('l');
      expect(buildChoices(target2, [target2, shorter, ...filler], seed)!.map((c) => c.id)).not.toContain('s');
    }
  });

  it('never shows the same phrase twice under different spellings', () => {
    const target = chunk('t', 'tell him', ['h-dropping'], 'Tell him I said hi.', 1);
    const pool = [
      target,
      chunk('a', 'want to', ['reduction'], '', 2),
      { ...chunk('b', 'wanna', ['reduction'], '', 3), ttsText: 'wanna' },
      chunk('c', 'got to', ['reduction'], '', 4),
      chunk('e', 'kind of', ['reduction'], '', 5),
    ];
    for (let seed = 0; seed < 30; seed++) {
      const ids = buildChoices(target, pool, seed)!.map((c) => c.id);
      expect(ids.includes('a') && ids.includes('b')).toBe(false);
      expect(ids).toHaveLength(CHOICE_COUNT);
    }
  });

  it('fills with unrelated chunks when the phenomenon has few chunks', () => {
    const target = chunk('t', 'tell him', ['h-dropping'], 'Tell him I said hi.', 1);
    const opts = buildChoices(target, [target, ...filler], 7);
    expect(opts).not.toBeNull();
    expect(opts!.map((c) => c.id).sort()).toHaveLength(CHOICE_COUNT);
    // Only 2 safe distractors → no card (the page falls back to typing).
    expect(buildChoices(target, [target, filler[0], filler[1]], 7)).toBeNull();
  });

  it('real data: no distractor is audible in the sentence, even through a contraction', () => {
    const all = sanitizeChunks(CHUNKS);
    const words = (c: Chunk) =>
      [c.written, c.ttsText].flatMap((s) => [...variants(s)]).map((v) => ` ${v.replace(/'/g, '')} `);
    for (const c of all.filter(canChoose)) {
      const sentence = [...variants(c.example)].map((v) => ` ${v.replace(/'/g, '')} `);
      const tw = words(c);
      for (const n of [2, 3, 4, 5]) {
        const opts = buildChoices(c, all, choiceSeed(c, reps(c.id, n)));
        expect(opts).not.toBeNull();
        for (const o of opts!) {
          if (o.id === c.id) continue;
          for (const w of words(o)) {
            expect(sentence.some((s) => s.includes(w)), `${o.written} in "${c.example}"`).toBe(false);
            expect(tw.some((t) => t.includes(w) || w.includes(t)), `${o.written} ~ ${c.written}`).toBe(false);
          }
        }
      }
    }
  });
});

describe('choiceSeed', () => {
  it('changes with the number of reviews', () => {
    const c = chunk('s1', 'want to', ['reduction']);
    expect(choiceSeed(c, reps('s1', 2))).not.toBe(choiceSeed(c, reps('s1', 4)));
    expect(choiceSeed(c, reps('s1', 2))).toBe(choiceSeed(c, reps('s1', 2)));
  });
});
