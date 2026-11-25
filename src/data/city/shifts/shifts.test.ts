// Content checks for Westbay's work shifts (core/town/shiftTypes.ts; data/city/shifts/*.ts).
import { describe, expect, it } from 'vitest';
import { decode, speakableFor } from '../../../core/decoder';
import { LONE_APOSTROPHE, SAPI_MISREAD } from '../../../core/decoder/sapiMisread';
import type { ShiftDef, ShiftOrder, ShiftSlot } from '../../../core/town/shiftTypes';
import { CITY_PLACE_IDS } from '../../cityWorld';
import { CITY_SHIFTS, cityShift } from './index';

const wordCount = (s: string): number => s.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length;

/** The text as words: lower case, hyphens as spaces, punctuation gone (apostrophes inside words kept). */
const words = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/[^a-z0-9' ]+/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter(Boolean);

interface Hit {
  option: string;
  from: number;
  to: number;
}

/**
 * The options of a slot that the text names: every place one of their `hear` phrases occurs as whole words; a match
 * inside a longer match of the same slot does not count ("twenty" in "twenty four", "a dozen" in "half a dozen").
 */
function named(slot: ShiftSlot, text: string): Set<string> {
  const w = words(text);
  const hits: Hit[] = [];
  for (const opt of slot.options) {
    for (const phrase of opt.hear) {
      const p = words(phrase);
      for (let i = 0; i + p.length <= w.length; i++) if (p.every((x, j) => w[i + j] === x)) hits.push({ option: opt.id, from: i, to: i + p.length });
    }
  }
  const kept = hits.filter((h) => !hits.some((o) => o !== h && o.from <= h.from && o.to >= h.to && o.to - o.from > h.to - h.from));
  return new Set(kept.map((h) => h.option));
}

const orders = CITY_SHIFTS.flatMap((def) => def.orders.map((o) => ({ def, o })));

describe('work shifts: shape', () => {
  it('five shifts, ids unique and well formed, each at a city person, found by id', () => {
    expect(CITY_SHIFTS.map((s) => s.id)).toEqual(['taxi', 'flowers', 'desk', 'kitchen', 'pharmacy']);
    for (const s of CITY_SHIFTS) {
      expect(s.id).toMatch(/^[a-z]{2,16}$/);
      expect((CITY_PLACE_IDS as readonly string[]).includes(s.at), s.id).toBe(true);
      expect(cityShift(s.id)).toBe(s);
      expect(s.name.trim(), s.id).toBe(s.name);
      expect(s.blurb.length, s.id).toBeGreaterThan(20);
    }
    expect(cityShift('nope')).toBeUndefined();
  });

  it('2–3 slots, each with 4–8 options, ids unique, every option said some way', () => {
    for (const s of CITY_SHIFTS) {
      expect(s.slots.length, s.id).toBeGreaterThanOrEqual(2);
      expect(s.slots.length, s.id).toBeLessThanOrEqual(3);
      expect(new Set(s.slots.map((x) => x.id)).size, s.id).toBe(s.slots.length);
      for (const slot of s.slots) {
        expect(slot.options.length, `${s.id}.${slot.id}`).toBeGreaterThanOrEqual(4);
        expect(slot.options.length, `${s.id}.${slot.id}`).toBeLessThanOrEqual(8);
        expect(new Set(slot.options.map((x) => x.id)).size, `${s.id}.${slot.id}`).toBe(slot.options.length);
        expect(new Set(slot.options.map((x) => x.label)).size, `${s.id}.${slot.id}`).toBe(slot.options.length);
        for (const opt of slot.options) {
          expect(opt.hear.length, opt.id).toBeGreaterThan(0);
          for (const h of opt.hear) expect(words(h).join(' '), `${opt.id}: ${h}`).toBe(h);
        }
      }
    }
  });

  it('at least 40 orders a shift (about 14 / 14 / 12 by level), ids sh-<shift>-<n> without gaps', () => {
    for (const s of CITY_SHIFTS) {
      expect(s.orders.length, s.id).toBeGreaterThanOrEqual(40);
      s.orders.forEach((o, i) => expect(o.id).toBe(`sh-${s.id}-${i + 1}`));
      for (const level of [1, 2, 3] as const) expect(s.orders.filter((o) => o.level === level).length, `${s.id} level ${level}`).toBeGreaterThanOrEqual(10);
      expect(s.orders.filter((o) => o.gender === 'male').length, s.id).toBeGreaterThanOrEqual(s.orders.length / 3);
      expect(s.orders.filter((o) => o.gender === 'female').length, s.id).toBeGreaterThanOrEqual(s.orders.length / 3);
    }
    expect(new Set(orders.map(({ o }) => o.id)).size).toBe(orders.length);
  });

  it('every answer names every slot and a real option of it', () => {
    for (const { def, o } of orders) {
      expect(Object.keys(o.answer).sort(), o.id).toEqual(def.slots.map((s) => s.id).sort());
      for (const slot of def.slots) expect(slot.options.some((x) => x.id === o.answer[slot.id]), `${o.id}.${slot.id}`).toBe(true);
    }
  });

  it('answers are spread over the options (none the answer of more than 35% of a slot)', () => {
    for (const s of CITY_SHIFTS) {
      for (const slot of s.slots) {
        for (const opt of slot.options) {
          const n = s.orders.filter((o) => o.answer[slot.id] === opt.id).length;
          expect(n / s.orders.length, `${s.id}.${slot.id} = ${opt.id}`).toBeLessThanOrEqual(0.35);
        }
      }
    }
  });

  it('no two orders say the same thing, and no two have the same text', () => {
    expect(new Set(orders.map(({ o }) => words(o.text).join(' '))).size).toBe(orders.length);
  });
});

/** Slots that share their options (taxi: from and to): an option answering any of them may be named. */
function answeredBySiblings(def: ShiftDef, slot: ShiftSlot, o: ShiftOrder): Set<string> {
  const ids = new Set(slot.options.map((x) => x.id));
  return new Set(def.slots.filter((s) => s.options.every((x) => ids.has(x.id))).map((s) => o.answer[s.id]));
}

describe('work shifts: each order says its answer', () => {
  it('the text names the answer of every slot', () => {
    const bad: string[] = [];
    for (const { def, o } of orders) for (const slot of def.slots) if (!named(slot, o.text).has(o.answer[slot.id])) bad.push(`${o.id}.${slot.id} = ${o.answer[slot.id]}: ${o.text}`);
    expect(bad).toEqual([]);
  });

  it('levels 1 and 2 name no wrong option; level 3 may (a change of mind)', () => {
    const bad: string[] = [];
    for (const { def, o } of orders) {
      if (o.level === 3) continue;
      for (const slot of def.slots) {
        const ok = answeredBySiblings(def, slot, o);
        for (const id of named(slot, o.text)) if (!ok.has(id)) bad.push(`${o.id}.${slot.id} names ${id}: ${o.text}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('a taxi never goes where it starts', () => {
    for (const o of cityShift('taxi')!.orders) expect(o.answer.from, o.id).not.toBe(o.answer.to);
  });

  it('level 3 is not just level 1 said again: a wrong option named, or more words', () => {
    for (const { def, o } of orders) {
      if (o.level !== 3) continue;
      const wrongNamed = def.slots.some((slot) => [...named(slot, o.text)].some((id) => !answeredBySiblings(def, slot, o).has(id)));
      expect(wrongNamed || wordCount(o.text) >= 14, `${o.id}: ${o.text}`).toBe(true);
    }
  });
});

describe('work shifts: English lines', () => {
  it('plain written English: trimmed, ASCII, ends like a sentence, 6–24 words', () => {
    for (const { o } of orders) {
      expect(o.text, o.id).toBe(o.text.trim());
      expect(o.text, o.id).not.toMatch(/\s{2,}/);
      expect(o.text, o.id).toMatch(/^[A-Za-z0-9 ,.?!'-]+$/);
      expect(o.text, o.id).toMatch(/[.?!]$/);
      expect(o.text, o.id).not.toMatch(/(^|[^A-Za-z])'|'([^A-Za-z]|$)/);
      const n = wordCount(o.text);
      expect(n, `${o.id}: ${o.text}`).toBeGreaterThanOrEqual(6);
      expect(n, `${o.id}: ${o.text}`).toBeLessThanOrEqual(24);
    }
  });

  it('every line decodes, and what is said never uses a spelling the speech engine misreads', () => {
    for (const { o } of orders) {
      expect(decode(o.text).tokens.length, o.id).toBeGreaterThan(0);
      const sent = speakableFor(o.text, o.say);
      expect(sent.trim(), o.id).not.toBe('');
      expect(sent, `${o.id}: ${sent}`).not.toMatch(SAPI_MISREAD);
      expect(sent, `${o.id}: ${sent}`).not.toMatch(LONE_APOSTROPHE);
      expect(sent, `${o.id}: ${sent}`).not.toMatch(/\b(ta|ya|jus|n|er|em)\b/i);
    }
  });

  it('meanings are Vietnamese, trimmed, one per order', () => {
    for (const { o } of orders) {
      expect(o.vi, o.id).toBe(o.vi.trim());
      expect(o.vi, o.id).toMatch(/[ăâđêôơưàáạảãầấậẩẫằắặẳẵèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹ]/i);
    }
    expect(new Set(orders.map(({ o }) => o.vi)).size).toBe(orders.length);
  });
});
