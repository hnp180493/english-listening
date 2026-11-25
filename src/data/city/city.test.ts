// Content checks for Westbay (docs/city.md; core/town/cityTypes.ts): the main people's episodes, the short talks, the
// town's residents met in the city, what is overheard there, and the rides on bus no. 9 (data/scenes/rides.ts).
// The same rules as the town's "cảnh nghe" where they apply (data/scenes/scenes.test.ts).
import { describe, expect, it } from 'vitest';
import { decode, speakableFor } from '../../core/decoder';
import { LONE_APOSTROPHE, SAPI_MISREAD } from '../../core/decoder/sapiMisread';
import { CITY_PEOPLE, cityPerson } from '../../core/town/cityPeople';
import type { CityScene } from '../../core/town/cityTypes';
import { SCENE_VOICES, type ListenScene, type SceneLine, type SceneQuestion } from '../../core/town/sceneTypes';
import { BENCHMARK_FORMS } from '../benchmark';
import { CITY_PLACE_IDS } from '../cityWorld';
import { LISTEN_SCENES } from '../scenes';
import { RIDE_SCENES } from '../scenes/rides';
import { SENTENCES } from '../sentences';
import { TOWN_PLACES } from '../town';
import { TOWN_STORIES } from '../townStories';
import { CITY_CHATS, CITY_EPISODES, CITY_OVERHEARD, CITY_SCENES, CITY_VISITS_SCENES } from './index';

const TOWN_IDS = new Set<string>(TOWN_PLACES.map((p) => p.id));
const MAINS = CITY_PEOPLE.filter((p) => p.tier === 'main');
const KNOWN = CITY_PEOPLE.filter((p) => p.tier === 'known');
const wordCount = (s: string): number => s.split(/\s+/).filter((w) => /[a-z]/i.test(w)).length;
const knownSpeaker = (w: string): boolean => !!cityPerson(w) || TOWN_IDS.has(w) || Object.hasOwn(SCENE_VOICES, w);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter(Boolean);
}

function overlap(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const counts = new Map<string, number>();
  for (const w of a) counts.set(w, (counts.get(w) ?? 0) + 1);
  let shared = 0;
  for (const w of b) {
    const c = counts.get(w) ?? 0;
    if (c > 0) {
      shared++;
      counts.set(w, c - 1);
    }
  }
  return shared / Math.max(a.length, b.length);
}

/** Names and loanwords a Vietnamese line may carry. */
const ALLOWED = new Set([
  ...TOWN_PLACES.map((p) => p.resident.toLowerCase()),
  ...CITY_PEOPLE.flatMap((p) => p.name.toLowerCase().split(' ')),
  ...'marcus bay fm westbay chip maya dot rosa colin freshway lumen harbour press sunflower corner twin ovens gianna bo latte pizza pasta email radio karaoke taxi sandwich espresso cappuccino tiramisu risotto bus guitar piano jazz rock pop film video online wifi app'.split(' '),
]);
const ENGLISH = new Set('the you and is are it of on at my we he she they this that what yes ok okay hi hey bye but not with for'.split(' '));
const VIET_SYLLABLE = /^(ngh|ng|nh|ch|gh|gi|kh|ph|th|tr|qu|[bcdghklmnpqrstvx])?[aeiouy]{1,3}(ch|ng|nh|[cmnpt])?$/;
const VIET_MARK = /[ăâđêôơưàáạảãầấậẩẫằắặẳẵèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹ]/i;

function englishWords(vi: string): string[] {
  const out: string[] = [];
  for (const raw of vi.split(/[^\p{L}\p{N}]+/u).filter(Boolean)) {
    const w = raw.toLowerCase();
    if (/^\d+$/.test(w) || ALLOWED.has(w)) continue;
    if (ENGLISH.has(w)) {
      out.push(raw);
      continue;
    }
    const plain = w.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd');
    if (!VIET_SYLLABLE.test(plain)) out.push(raw);
  }
  return out;
}

interface AnyScene {
  id: string;
  title: string;
  scene: string;
  level: number;
  lines: readonly SceneLine[];
  questions: readonly SceneQuestion[];
}
const asAny = (s: ListenScene): AnyScene => ({ id: s.id, title: s.title, scene: s.scene, level: s.level, lines: s.lines, questions: s.detail ? [s.gist, s.detail] : [s.gist] });
const all: AnyScene[] = [...CITY_SCENES, ...CITY_OVERHEARD.map(asAny), ...RIDE_SCENES.map(asAny)];
const lines = all.flatMap((s) => s.lines.map((l, i) => ({ id: `${s.id}#${i + 1}`, line: l })));

describe('Westbay: shape', () => {
  it('every person of the city has a place on the map and the other way round', () => {
    expect(CITY_PEOPLE.map((p) => p.id).sort()).toEqual([...CITY_PLACE_IDS].sort());
    expect(MAINS.length).toBe(6);
    expect(KNOWN.length).toBe(12);
    for (const p of CITY_PEOPLE) for (const t of p.town) expect(TOWN_IDS.has(t), `${p.id}: ${t}`).toBe(true);
  });

  it('ids: one of each, of their kind, numbered 1, 2, 3… per person', () => {
    expect(new Set(all.map((s) => s.id)).size).toBe(all.length);
    expect(new Set(all.map((s) => s.title)).size).toBe(all.length);
    for (const s of CITY_SCENES) {
      expect([1, 2, 3], s.id).toContain(s.level);
      expect(s.id, s.id).toBe(`${s.kind === 'visit' ? 'cv' : 'ct'}-${s.at}-${s.n}`);
    }
    const byAt = new Map<string, CityScene[]>();
    for (const s of CITY_SCENES) byAt.set(`${s.kind}:${s.at}`, [...(byAt.get(`${s.kind}:${s.at}`) ?? []), s]);
    for (const [k, list] of byAt) expect(list.map((s) => s.n).sort(), k).toEqual(list.map((_, i) => i + 1));
  });

  it('episodes: three for each main person, 12–18 lines, two or three speakers, three questions', () => {
    for (const p of MAINS) expect(CITY_EPISODES.filter((s) => s.at === p.id).length, p.id).toBe(3);
    for (const s of CITY_EPISODES) {
      expect(s.kind, s.id).toBe('episode');
      expect(cityPerson(s.at)?.tier, s.id).toBe('main');
      expect(s.lines.length, s.id).toBeGreaterThanOrEqual(12);
      expect(s.lines.length, s.id).toBeLessThanOrEqual(18);
      const who = new Set(s.lines.map((l) => l.who));
      expect(who.size, s.id).toBeGreaterThanOrEqual(2);
      expect(who.size, s.id).toBeLessThanOrEqual(3);
      expect(who.has(s.at), `${s.id}: ${s.at} speaks`).toBe(true);
      expect(s.lines.filter((l) => l.who === s.at).length, `${s.id}: ${s.at} has the most to say`).toBeGreaterThanOrEqual(5);
      expect(s.questions.length, s.id).toBe(3);
    }
  });

  it("the second episode of each main person brings up the town resident of their story, in the resident's own words", () => {
    for (const p of MAINS) {
      const second = CITY_EPISODES.find((s) => s.at === p.id && s.n === 2);
      expect(second, p.id).toBeDefined();
      const guest = p.town[0];
      expect(second!.lines.filter((l) => l.who === guest).length, `${p.id}: ${guest} speaks in episode 2`).toBeGreaterThanOrEqual(4);
    }
  });

  it('short talks: two for each person known, 6–9 lines, one or two questions', () => {
    for (const p of KNOWN) expect(CITY_CHATS.filter((s) => s.at === p.id).length, p.id).toBe(2);
    for (const s of CITY_CHATS) {
      expect(s.kind, s.id).toBe('chat');
      expect(cityPerson(s.at)?.tier, s.id).toBe('known');
      expect(s.lines.length, s.id).toBeGreaterThanOrEqual(6);
      expect(s.lines.length, s.id).toBeLessThanOrEqual(9);
      expect(s.lines.filter((l) => l.who === s.at).length, s.id).toBeGreaterThanOrEqual(4);
      expect(s.questions.length, s.id).toBeGreaterThanOrEqual(1);
      expect(s.questions.length, s.id).toBeLessThanOrEqual(2);
    }
  });

  it('visits: every town resident is met in Westbay once, with somebody of the city, 6–10 lines', () => {
    for (const id of TOWN_IDS) expect(CITY_VISITS_SCENES.filter((s) => s.at === id).length, id).toBe(1);
    for (const s of CITY_VISITS_SCENES) {
      expect(s.kind, s.id).toBe('visit');
      expect(s.lines.length, s.id).toBeGreaterThanOrEqual(6);
      expect(s.lines.length, s.id).toBeLessThanOrEqual(10);
      expect(s.lines.filter((l) => l.who === s.at).length, s.id).toBeGreaterThanOrEqual(3);
      expect(s.lines.some((l) => !!cityPerson(l.who)), `${s.id}: somebody of the city is there`).toBe(true);
      expect(s.questions.length, s.id).toBeGreaterThanOrEqual(1);
      expect(s.questions.length, s.id).toBeLessThanOrEqual(2);
    }
  });

  it('everybody who speaks is known; the learner never speaks', () => {
    for (const { id, line } of lines) expect(knownSpeaker(line.who), `${id}: ${line.who}`).toBe(true);
  });

  it('what a scene needs exists, is heard before it, and the first one is open: Rico, off the bus', () => {
    const ids = new Set(CITY_SCENES.map((s) => s.id));
    const first = CITY_SCENES.find((s) => s.id === 'ct-rico-1');
    expect(first).toBeDefined();
    expect(first!.needs ?? []).toEqual([]);
    const depth = new Map<string, number>();
    const walk = (id: string, seen: string[]): number => {
      if (seen.includes(id)) throw new Error(`a circle of needs: ${[...seen, id].join(' → ')}`);
      const s = CITY_SCENES.find((x) => x.id === id)!;
      if (!depth.has(id)) depth.set(id, 1 + Math.max(0, ...(s.needs ?? []).map((n) => walk(n, [...seen, id]))));
      return depth.get(id)!;
    };
    for (const s of CITY_SCENES) {
      for (const n of s.needs ?? []) expect(ids.has(n), `${s.id} needs ${n}`).toBe(true);
      walk(s.id, []);
      // a person's scenes open in order
      if (s.n > 1) expect(s.needs ?? [], s.id).toContain(`${s.kind === 'visit' ? 'cv' : 'ct'}-${s.at}-${s.n - 1}`);
    }
    // every main person's first episode can be reached from Rico's
    for (const p of MAINS) if (p.id !== 'rico') expect(depth.get(`ct-${p.id}-1`) ?? 0, p.id).toBeGreaterThanOrEqual(2);
  });

  it('overheard in the city: two people of the city, 4–6 lines, a gist; a dozen or more', () => {
    expect(CITY_OVERHEARD.length).toBeGreaterThanOrEqual(12);
    for (const s of CITY_OVERHEARD) {
      expect(s.id, s.id).toMatch(/^co-\d{1,3}$/);
      expect(s.kind, s.id).toBe('overheard');
      expect(s.lines.length, s.id).toBeGreaterThanOrEqual(4);
      expect(s.lines.length, s.id).toBeLessThanOrEqual(6);
      const who = [...new Set(s.lines.map((l) => l.who))];
      expect(who.length, s.id).toBe(2);
      for (const w of who) expect(!!cityPerson(w), `${s.id}: ${w}`).toBe(true);
      expect(s.detail, s.id).toBeUndefined();
    }
  });

  it('rides: the bus speaker and two passengers, 5–8 lines, a gist and a detail; four or more each way', () => {
    for (const to of ['city', 'town'] as const) expect(RIDE_SCENES.filter((s) => s.to === to).length, to).toBeGreaterThanOrEqual(4);
    for (const s of RIDE_SCENES) {
      expect(s.id, s.id).toMatch(/^rd-\d{1,3}$/);
      expect(s.kind, s.id).toBe('ride');
      expect(s.lines.length, s.id).toBeGreaterThanOrEqual(5);
      expect(s.lines.length, s.id).toBeLessThanOrEqual(8);
      expect(s.lines[0].who, s.id).toBe('bus9');
      for (const l of s.lines) expect(['bus9', 'rider1', 'rider2'], `${s.id}: ${l.who}`).toContain(l.who);
      expect(s.detail, s.id).toBeDefined();
    }
  });
});

describe('Westbay: English lines', () => {
  it('plain written English: trimmed, ASCII, ends like a sentence, 3–16 words', () => {
    for (const { id, line } of lines) {
      expect(line.text, id).toBe(line.text.trim());
      expect(line.text, id).not.toMatch(/\s{2,}/);
      expect(line.text, id).toMatch(/^[A-Za-z0-9 ,.?!'-]+$/);
      expect(line.text, id).toMatch(/[.?!]$/);
      const n = wordCount(line.text);
      expect(n, `${id}: ${line.text}`).toBeGreaterThanOrEqual(3);
      expect(n, `${id}: ${line.text}`).toBeLessThanOrEqual(16);
    }
  });

  it('every line decodes, and what is said never uses a spelling SAPI misreads', () => {
    for (const { id, line } of lines) {
      expect(decode(line.text).tokens.length, id).toBeGreaterThan(0);
      const sent = speakableFor(line.text, line.say);
      expect(sent.trim(), id).not.toBe('');
      expect(sent, `${id}: ${sent}`).not.toMatch(SAPI_MISREAD);
      expect(sent, `${id}: ${sent}`).not.toMatch(LONE_APOSTROPHE);
    }
  });

  it('no line copies a dictation sentence, a story line, a scene line of the town, another line here, or (≥80%) a checkup line', () => {
    const taken = new Map<string, string>();
    for (const s of SENTENCES) taken.set(tokens(s.text).join(' '), s.id);
    for (const e of TOWN_STORIES) for (const l of e.lines) taken.set(tokens(l.text).join(' '), l.id);
    for (const s of LISTEN_SCENES) s.lines.forEach((l, i) => taken.set(tokens(l.text).join(' '), `${s.id}#${i + 1}`));
    const checkup = BENCHMARK_FORMS.flatMap((f) => [...f.sentences.map((s) => ({ id: s.id, text: s.text })), ...f.questions.flatMap((q) => q.lines.map((text, i) => ({ id: `${q.id}#${i}`, text })))]).map((c) => ({ id: c.id, toks: tokens(c.text) }));
    const clashes: string[] = [];
    for (const { id, line } of lines) {
      const k = tokens(line.text).join(' ');
      if (taken.has(k)) clashes.push(`${id} "${line.text}" = ${taken.get(k)}`);
      taken.set(k, id);
      for (const part of new Set([line.text, ...line.text.split(/(?<=[.!?])\s+/)])) {
        const mine = tokens(part);
        if (mine.length < 3) continue;
        for (const c of checkup) if (overlap(mine, c.toks) >= 0.8) clashes.push(`${id} "${part}" ~ checkup ${c.id}`);
      }
    }
    expect(clashes).toEqual([]);
  });
});

describe('Westbay: Vietnamese and questions', () => {
  it('meanings, titles, scene lines: Vietnamese with no English words', () => {
    for (const s of all) {
      for (const text of [s.title, s.scene, ...s.lines.map((l) => l.vi)]) {
        expect(text, s.id).toBe(text.trim());
        expect(VIET_MARK.test(text), `${s.id}: ${text}`).toBe(true);
        expect(englishWords(text), `${s.id}: ${text}`).toEqual([]);
      }
      expect(s.title.length, s.id).toBeLessThanOrEqual(40);
      expect(s.scene.length, s.id).toBeLessThanOrEqual(120);
      expect(new Set(s.lines.map((l) => l.vi)).size, s.id).toBe(s.lines.length);
    }
  });

  it('questions: three different Vietnamese answers; the right one is not the longest by far', () => {
    for (const s of all) {
      expect(new Set(s.questions.map((q) => q.q)).size, s.id).toBe(s.questions.length);
      for (const q of s.questions) {
        expect(VIET_MARK.test(q.q), `${s.id}: ${q.q}`).toBe(true);
        expect(englishWords(q.q), `${s.id}: ${q.q}`).toEqual([]);
        expect(q.options.length, s.id).toBe(3);
        expect(new Set(q.options).size, s.id).toBe(3);
        expect([0, 1, 2], s.id).toContain(q.answer);
        for (const o of q.options) {
          expect(englishWords(o), `${s.id}: ${o}`).toEqual([]);
          expect(o.length, `${s.id}: ${o}`).toBeLessThanOrEqual(60);
        }
        const others = q.options.filter((_, i) => i !== q.answer).map((o) => o.length);
        expect(q.options[q.answer].length, `${s.id}: ${q.q}`).toBeLessThanOrEqual(Math.max(...others) * 1.35);
      }
    }
  });

  it('the right answer sits in each place often enough (never "always the first")', () => {
    const groups: [string, AnyScene[]][] = [
      ['episodes', [...CITY_EPISODES]],
      ['chats', [...CITY_CHATS]],
      ['visits', [...CITY_VISITS_SCENES]],
      ['overheard', CITY_OVERHEARD.map(asAny)],
      ['rides', RIDE_SCENES.map(asAny)],
    ];
    for (const [name, list] of groups) {
      const qs = list.flatMap((s) => s.questions);
      for (const at of [0, 1, 2]) expect(qs.filter((q) => q.answer === at).length, `${name}: position ${at}`).toBeGreaterThanOrEqual(Math.floor(qs.length / 5));
    }
  });
});
