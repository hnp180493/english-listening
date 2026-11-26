// Content checks for Rico's dispatch office (docs/town.md §27): the calls' shape, that their places are on Westbay's
// map and named in what is said, that each careless-ear place is the other half of a written-down pair, that every
// line (the calls, their repeats, every radio template with every place) is speakable by the browser's voice, and that
// nobody of the town speaks here (no clips: docs/city.md §5).
import { describe, expect, it } from 'vitest';
import { decode, speakableFor } from '../../../core/decoder';
import { LONE_APOSTROPHE, SAPI_MISREAD } from '../../../core/decoder/sapiMisread';
import { cityPerson } from '../../../core/town/cityPeople';
import { DRIVERS, MANNERS, type DriverId } from '../../../core/town/dispatch';

/** Every driver with lines: the three, and Jas of the fourth car (core/town/office.ts). */
const ALL_DRIVERS = Object.keys(DRIVER_LINES) as DriverId[];
import { CAST_VOICES } from '../../../core/town/voices';
import { CITY_PLACE_IDS, CITY_PLACES, CITY_ROWS } from '../../cityWorld';
import { TOWN_PLACES } from '../../town';
import { CALLBACK_LINES, CROSS_LINES, DISPATCH_ALIKES, DISPATCH_CALLS, DISPATCH_PLACES, DRIVER_LINES, NEWS_LINES, OFFICE_AT, OPEN_LINES, STOLEN_LINES, alikesOf, dispatchCallByRef, dispatchPlace, fillDispatchLine, type DispatchLine } from './index';
import { placeVi } from './names';

const words = (s: string): number => s.split(/\s+/).filter((w) => /[a-z]/i.test(w)).length;
const names = (s: string, id: string): boolean => (dispatchPlace(id)?.keys ?? []).some((k) => s.toLowerCase().includes(k));

function speakable(id: string, text: string): void {
  expect(text, id).toMatch(/^[\x20-\x7e]+$/);
  expect(decode(text).tokens.length, id).toBeGreaterThan(0);
  const sent = speakableFor(text);
  expect(sent, `${id}: ${sent}`).not.toMatch(SAPI_MISREAD);
  expect(sent, `${id}: ${sent}`).not.toMatch(LONE_APOSTROPHE);
}

describe('dispatch office: places', () => {
  it('every place is a place of Westbay, with a name, a label and words that name it', () => {
    expect(new Set(DISPATCH_PLACES.map((p) => p.id)).size).toBe(DISPATCH_PLACES.length);
    for (const p of DISPATCH_PLACES) {
      expect((CITY_PLACE_IDS as readonly string[]).includes(p.id), p.id).toBe(true);
      expect(p.en.trim().length, p.id).toBeGreaterThan(0);
      expect(p.en.startsWith('The '), `${p.id}: "the" in the middle of a sentence`).toBe(false);
      expect(p.label.length, p.id).toBeLessThanOrEqual(14);
      expect(p.keys.length, p.id).toBeGreaterThan(0);
      for (const k of p.keys) expect(k, p.id).toBe(k.toLowerCase());
      // its door is on a street or a square: a car can stop there
      const door = CITY_PLACES.find((c) => c.id === p.id)!.door;
      expect(['=', 'o'], p.id).toContain(CITY_ROWS[door.y][door.x]);
    }
    expect((CITY_PLACE_IDS as readonly string[]).includes(OFFICE_AT)).toBe(true);
  });

  it('the pairs a careless ear confuses: two different places of the office, each pair once', () => {
    const seen = new Set<string>();
    for (const p of DISPATCH_ALIKES) {
      expect(p.a, `${p.a}/${p.b}`).not.toBe(p.b);
      expect(dispatchPlace(p.a), p.a).toBeDefined();
      expect(dispatchPlace(p.b), p.b).toBeDefined();
      const k = [p.a, p.b].sort().join('/');
      expect(seen.has(k), k).toBe(false);
      seen.add(k);
    }
  });
});

describe('dispatch office: calls', () => {
  it('at least 40, ids dc-1… in order, every level and manner and both voices well represented', () => {
    expect(DISPATCH_CALLS.length).toBeGreaterThanOrEqual(40);
    DISPATCH_CALLS.forEach((c, i) => expect(c.id).toBe(`dc-${i + 1}`));
    for (const lv of [1, 2, 3]) expect(DISPATCH_CALLS.filter((c) => c.level === lv).length, `level ${lv}`).toBeGreaterThanOrEqual(10);
    for (const m of MANNERS) expect(DISPATCH_CALLS.filter((c) => c.manner === m).length, m).toBeGreaterThanOrEqual(m === 'clear' ? 10 : 4);
    for (const g of ['male', 'female']) expect(DISPATCH_CALLS.filter((c) => c.gender === g).length, g).toBeGreaterThanOrEqual(15);
  });

  it('each names its pickup and destination, two different places of the map, in the call and in its repeat', () => {
    for (const c of DISPATCH_CALLS) {
      expect(c.from, c.id).not.toBe(c.to);
      expect(dispatchPlace(c.from), `${c.id}: ${c.from}`).toBeDefined();
      expect(dispatchPlace(c.to), `${c.id}: ${c.to}`).toBeDefined();
      expect(names(c.text, c.from), `${c.id}: names ${c.from}`).toBe(true);
      expect(names(c.text, c.to), `${c.id}: names ${c.to}`).toBe(true);
      expect(names(c.again.text, c.from), `${c.id} again: names ${c.from}`).toBe(true);
      expect(names(c.again.text, c.to), `${c.id} again: names ${c.to}`).toBe(true);
    }
  });

  it("each careless-ear place is the other half of a pair written down in places.ts", () => {
    for (const c of DISPATCH_CALLS) {
      expect(alikesOf(c.from), `${c.id}: ${c.from} ~ ${c.fromNear}`).toContain(c.fromNear);
      expect(alikesOf(c.to), `${c.id}: ${c.to} ~ ${c.toNear}`).toContain(c.toNear);
    }
  });

  it('said in one breath (≤ 32 words), the repeat shorter; speakable; a meaning in Vietnamese', () => {
    for (const c of DISPATCH_CALLS) {
      expect(words(c.text), `${c.id}: ${c.text}`).toBeLessThanOrEqual(32);
      expect(words(c.text), c.id).toBeGreaterThanOrEqual(6);
      expect(words(c.again.text), `${c.id}: ${c.again.text}`).toBeLessThanOrEqual(12);
      expect(words(c.again.text), c.id).toBeLessThan(words(c.text) + 1);
      speakable(c.id, c.text);
      speakable(`${c.id} again`, c.again.text);
      expect(c.vi.trim().length, c.id).toBeGreaterThan(0);
      expect(c.again.vi.trim().length, c.id).toBeGreaterThan(0);
      expect(/[ăâđêôơư]/i.test(c.vi), `${c.id}: Vietnamese`).toBe(true);
    }
  });

  it('a call is found by its review ref', () => {
    expect(dispatchCallByRef('disp-dc-12')?.id).toBe('dc-12');
    expect(dispatchCallByRef('dc-12')).toBeUndefined();
    expect(dispatchCallByRef('disp-dc-999')).toBeUndefined();
  });
});

describe('dispatch office: who speaks', () => {
  const TOWN = new Set<string>(TOWN_PLACES.map((p) => p.id));
  it('the drivers are people of Westbay, never a town resident (no Gemini voice, no clip)', () => {
    for (const d of DRIVERS) {
      expect(cityPerson(d), d).toBeDefined();
      expect(TOWN.has(d), d).toBe(false);
      expect(Object.hasOwn(CAST_VOICES, d), `${d} has no Gemini voice`).toBe(false);
    }
  });

  it('every template, filled with every place, is a short speakable line', () => {
    const all: [string, DispatchLine][] = [
      ...ALL_DRIVERS.flatMap((d) => Object.entries(DRIVER_LINES[d]).flatMap(([k, ls]) => ls.map((l, i): [string, DispatchLine] => [`${d}.${k}.${i}`, l]))),
      ...CALLBACK_LINES.map((l, i): [string, DispatchLine] => [`callback.${i}`, l]),
      ...CROSS_LINES.map((l, i): [string, DispatchLine] => [`cross.${i}`, l]),
      ...STOLEN_LINES.map((l, i): [string, DispatchLine] => [`stolen.${i}`, l]),
      ...OPEN_LINES.map((l, i): [string, DispatchLine] => [`open.${i}`, l]),
      ...NEWS_LINES.good.map((l, i): [string, DispatchLine] => [`news.good.${i}`, l]),
      ...NEWS_LINES.bad.map((l, i): [string, DispatchLine] => [`news.bad.${i}`, l]),
    ];
    for (const d of ALL_DRIVERS) for (const k of ['board', 'nobody', 'drop', 'wrongDrop'] as const) expect(DRIVER_LINES[d][k].length, `${d}.${k}`).toBeGreaterThan(0);
    for (const [id, line] of all) {
      expect(line.text.startsWith('{'), id).toBe(false);
      expect(line.vi.trim().length, id).toBeGreaterThan(0);
      for (const a of DISPATCH_PLACES)
        for (const b of [DISPATCH_PLACES[0], DISPATCH_PLACES[DISPATCH_PLACES.length - 1]]) {
          const f = fillDispatchLine(line, { place: a.en, right: b.en }, { place: placeVi(a.id), right: placeVi(b.id) });
          expect(f.text.includes('{'), id).toBe(false);
          expect(f.vi.includes('{'), id).toBe(false);
          expect(words(f.text), `${id}: ${f.text}`).toBeLessThanOrEqual(16);
          expect(words(f.text), `${id}: ${f.text}`).toBeGreaterThanOrEqual(2);
        }
      // speakable with a sample of places (every place's name is checked through the calls)
      speakable(id, fillDispatchLine(line, { place: 'the ferry', right: "Gianna's" }, {}).text);
    }
  });
});
