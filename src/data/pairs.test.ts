import { describe, expect, it } from 'vitest';
import { decode } from '../core/decoder';
import { PHENOMENA } from '../core/types';
import { PAIR_ITEM_COUNT, PAIR_SETS } from './pairs';

const canon = (s: string) => s.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z' ]/g, '').replace(/\s+/g, ' ').trim();

describe('PAIR_SETS data', () => {
  it('has enough sets and items', () => {
    expect(PAIR_SETS.length).toBeGreaterThanOrEqual(14);
    expect(PAIR_ITEM_COUNT).toBeGreaterThanOrEqual(90);
    expect(PAIR_ITEM_COUNT).toBe(PAIR_SETS.reduce((n, s) => n + s.items.length, 0));
  });

  it('set ids and item ids are unique', () => {
    const setIds = PAIR_SETS.map((s) => s.id);
    expect(new Set(setIds).size).toBe(setIds.length);
    const itemIds = PAIR_SETS.flatMap((s) => s.items.map((i) => i.id));
    expect(new Set(itemIds).size).toBe(itemIds.length);
    for (const id of [...setIds, ...itemIds]) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it('every set is well-formed', () => {
    for (const s of PAIR_SETS) {
      expect(PHENOMENA, s.id).toContain(s.phenomenon);
      expect(s.title.trim(), s.id).not.toBe('');
      expect(s.description.trim().length, s.id).toBeGreaterThan(40);
      expect(s.items.length, s.id).toBeGreaterThanOrEqual(6);
      expect(s.contrast.length, s.id).toBeGreaterThanOrEqual(2);
      for (const c of s.contrast) {
        expect(c.written.trim(), s.id).not.toBe('');
        expect(c.spoken.trim(), s.id).not.toBe('');
      }
    }
  });

  it('every item has 2–3 distinct, sentence-like options and a cue', () => {
    for (const s of PAIR_SETS) {
      for (const it of s.items) {
        expect(it.options.length, it.id).toBeGreaterThanOrEqual(2);
        expect(it.options.length, it.id).toBeLessThanOrEqual(3);
        const c = it.options.map(canon);
        expect(new Set(c).size, it.id).toBe(c.length);
        for (const o of it.options) {
          expect(o, it.id).toMatch(/^[A-Z]/);
          expect(o, it.id).toMatch(/[.?!]$/);
          expect(o, it.id).toBe(o.trim());
        }
        expect(it.cue.trim().length, it.id).toBeGreaterThan(10);
      }
    }
  });

  it('options within an item differ only a little (minimal pairs)', () => {
    for (const s of PAIR_SETS) {
      for (const it of s.items) {
        const words = it.options.map((o) => canon(o).split(' '));
        const base = new Set(words[0]);
        for (const w of words.slice(1)) {
          const shared = w.filter((x) => base.has(x)).length;
          expect(shared, it.id).toBeGreaterThanOrEqual(Math.min(w.length, words[0].length) - 2);
        }
      }
    }
  });

  it('covers every phenomenon so focus links always find a set', () => {
    for (const p of PHENOMENA) expect(PAIR_SETS.some((s) => s.phenomenon === p), p).toBe(true);
  });

  it('avoids near-homophone contrasts that are unfair by ear', () => {
    for (const s of PAIR_SETS) {
      for (const it of s.items) {
        const c = it.options.map(canon);
        for (const a of c) {
          for (const b of c) {
            // "I'd take" ≈ "I take": the d merges into a following t/d
            const dStop = a.match(/\b(\w+)'d ([td]\w*)/);
            if (dStop) expect(b, it.id).not.toBe(a.replace(`${dStop[1]}'d ${dStop[2]}`, `${dStop[1]} ${dStop[2]}`));
            // "I'd like" ≈ "I like": d and l share a place, so the d is barely released
            const dLat = a.match(/\b(\w+)'d (l\w*)/);
            if (dLat) expect(b, it.id).not.toBe(a.replace(`${dLat[1]}'d ${dLat[2]}`, `${dLat[1]} ${dLat[2]}`));
            // "You'll love" ≈ "You love": the two Ls merge
            const lStop = a.match(/\b(\w+)'ll (l\w*)/);
            if (lStop) expect(b, it.id).not.toBe(a.replace(`${lStop[1]}'ll ${lStop[2]}`, `${lStop[1]} ${lStop[2]}`));
            // "I've got" ≈ "I got": the v vanishes before a consonant
            const vStop = a.match(/\b(\w+)'ve ([^aeiou ]\w*)/);
            if (vStop && s.id === 'ive-i') expect(b, it.id).not.toBe(a.replace(`${vStop[1]}'ve ${vStop[2]}`, `${vStop[1]} ${vStop[2]}`));
          }
        }
      }
    }
  });

  it('cues that keep the th of "them" agree with the decoder', () => {
    // The decoder (and the lessons) drop the th of unstressed "them" after a consonant
    // ("tell them" → tel-ləm) and keep it only after a vowel ("saw them" → saw-thəm).
    for (const s of PAIR_SETS) {
      for (const it of s.items) {
        if (!it.cue.includes('thəm')) continue;
        expect(it.options.some((o) => decode(o).spokenText.includes('thəm')), it.id).toBe(true);
      }
    }
    const himThem = PAIR_SETS.find((s) => s.id === 'him-them');
    expect(himThem?.contrast.find((c) => c.written === 'tell them')?.spoken).toBe('tel-ləm');
    expect(decode('Tell them.').spokenText).toContain('ləm');
  });

  it('respellings use plain letters (IPA only inside /slashes/)', () => {
    for (const s of PAIR_SETS) {
      for (const c of s.contrast) {
        const plain = c.spoken.replace(/\/[^/]*\//g, '');
        expect(plain, s.id).not.toMatch(/[ɫʌɑɪʊɛɔː]/);
      }
      for (const it of s.items) expect(it.cue.replace(/\/[^/]*\//g, ''), it.id).not.toMatch(/[ɫʌɑɪʊː]/);
    }
  });
});
