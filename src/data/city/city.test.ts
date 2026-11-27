// Content checks for Westbay (docs/city.md; core/town/cityTypes.ts): the main people's episodes, the short talks, the
// town's residents met in the city, what is overheard there, and the rides on bus no. 9 (data/scenes/rides.ts).
// The same rules as the town's "cảnh nghe" where they apply (data/scenes/scenes.test.ts).
import { describe, expect, it } from 'vitest';
import { decode, speakableFor } from '../../core/decoder';
import { LONE_APOSTROPHE, SAPI_MISREAD } from '../../core/decoder/sapiMisread';
import { CITY_PEOPLE, cityPerson } from '../../core/town/cityPeople';
import type { CityScene } from '../../core/town/cityTypes';
import { SCENE_VOICES, YOU, type ListenScene, type SceneLine, type SceneQuestion } from '../../core/town/sceneTypes';
import { BENCHMARK_FORMS } from '../benchmark';
import { CITY_PLACE_IDS } from '../cityWorld';
import { LISTEN_SCENES } from '../scenes';
import { RIDE_SCENES } from '../scenes/rides';
import { SENTENCES } from '../sentences';
import { TOWN_PLACES } from '../town';
import { TOWN_STORIES } from '../townStories';
import { CITY_CHAPTERS, CITY_CHATS, CITY_EPISODES, CITY_EVENT_SCENES, CITY_EVENTS, CITY_OUTINGS, CITY_OVERHEARD, CITY_SCENES, CITY_SEASONS, CITY_VISITS_SCENES } from './index';
import { OUTING_ROLES } from '../../core/town/cityTypes';

const TOWN_IDS = new Set<string>(TOWN_PLACES.map((p) => p.id));
const MAINS = CITY_PEOPLE.filter((p) => p.tier === 'main');
const KNOWN = CITY_PEOPLE.filter((p) => p.tier === 'known');
const wordCount = (s: string): number => s.split(/\s+/).filter((w) => /[a-z]/i.test(w)).length;
const knownSpeaker = (w: string): boolean => !!cityPerson(w) || TOWN_IDS.has(w) || Object.hasOwn(SCENE_VOICES, w) || (OUTING_ROLES as readonly string[]).includes(w);

/** What the people of a talk say (the learner's own lines, YOU, are not counted as theirs). */
const cast = (s: { lines: readonly SceneLine[] }): SceneLine[] => s.lines.filter((l) => l.who !== YOU);

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
  ...'marcus bay fm westbay chip maya dot rosa crane hale ward vane colin freshway lumen harbour press sunflower corner twin ovens gianna bo latte pizza pasta email radio karaoke taxi sandwich espresso cappuccino tiramisu risotto bus guitar piano jazz rock pop film video online wifi app'.split(' '),
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
const all: AnyScene[] = [...CITY_SCENES, ...CITY_OUTINGS, ...CITY_CHAPTERS, ...CITY_OVERHEARD.map(asAny), ...CITY_EVENT_SCENES.map(asAny), ...RIDE_SCENES.map(asAny)];
const lines = all.flatMap((s) => s.lines.map((l, i) => ({ id: `${s.id}#${i + 1}`, line: l })));

describe('Westbay: shape', () => {
  it('every person of the city has a place on the map and the other way round', () => {
    expect(CITY_PEOPLE.map((p) => p.id).sort()).toEqual([...CITY_PLACE_IDS].sort());
    expect(MAINS.length).toBe(12);
    expect(KNOWN.length).toBe(25);
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
      expect(cast(s).length, s.id).toBeGreaterThanOrEqual(12);
      expect(cast(s).length, s.id).toBeLessThanOrEqual(18);
      const who = new Set(cast(s).map((l) => l.who));
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
      expect(cast(s).length, s.id).toBeGreaterThanOrEqual(6);
      expect(cast(s).length, s.id).toBeLessThanOrEqual(9);
      expect(s.lines.filter((l) => l.who === s.at).length, s.id).toBeGreaterThanOrEqual(4);
      expect(s.questions.length, s.id).toBeGreaterThanOrEqual(1);
      expect(s.questions.length, s.id).toBeLessThanOrEqual(2);
    }
  });

  it('visits: every town resident is met in Westbay twice (the second when they came up with the learner), with somebody of the city, 6–10 lines', () => {
    for (const id of TOWN_IDS) expect(CITY_VISITS_SCENES.filter((s) => s.at === id).length, id).toBe(2);
    for (const s of CITY_VISITS_SCENES) {
      expect(s.kind, s.id).toBe('visit');
      expect(cast(s).length, s.id).toBeGreaterThanOrEqual(6);
      expect(cast(s).length, s.id).toBeLessThanOrEqual(10);
      expect(s.lines.filter((l) => l.who === s.at).length, s.id).toBeGreaterThanOrEqual(3);
      expect(s.lines.some((l) => !!cityPerson(l.who)), `${s.id}: somebody of the city is there`).toBe(true);
      expect(s.questions.length, s.id).toBeGreaterThanOrEqual(1);
      expect(s.questions.length, s.id).toBeLessThanOrEqual(2);
    }
  });

  it('outings: dates and family outings hosted by somebody of the city; the partner speaks, in words anybody could say', () => {
    expect(CITY_OUTINGS.filter((s) => s.kind === 'date').length).toBeGreaterThanOrEqual(5);
    expect(CITY_OUTINGS.filter((s) => s.kind === 'family').length).toBeGreaterThanOrEqual(3);
    for (const s of CITY_OUTINGS) {
      expect(s.id, s.id).toBe(`cx-${s.at}-${s.n}`);
      expect(!!cityPerson(s.at), `${s.id}: hosted by somebody of the city`).toBe(true);
      expect(s.needs ?? [], s.id).toEqual([]);
      expect(s.lines.length, s.id).toBeGreaterThanOrEqual(8);
      expect(s.lines.length, s.id).toBeLessThanOrEqual(14);
      const who = new Set(s.lines.map((l) => l.who));
      expect(who.has(s.at), `${s.id}: the host speaks`).toBe(true);
      expect(s.lines.filter((l) => l.who === 'partner').length, `${s.id}: the partner speaks`).toBeGreaterThanOrEqual(3);
      if (s.kind === 'family') expect(s.lines.filter((l) => l.who === 'kid').length, `${s.id}: the child speaks`).toBeGreaterThanOrEqual(2);
      else expect(who.has('kid'), `${s.id}: no child on a date`).toBe(false);
      for (const w of who) expect(TOWN_IDS.has(w), `${s.id}: ${w} (no town resident by name: the partner is 'partner')`).toBe(false);
      // nothing in the partner's or the child's lines fixes who they are
      for (const l of s.lines) if (l.who === 'partner' || l.who === 'kid') expect(l.text, `${s.id}: ${l.text}`).not.toMatch(/\b(he|she|his|her|him|husband|wife|boyfriend|girlfriend|son|daughter|boy|girl|mum|mom|dad|mummy|daddy)\b/i);
      expect(s.questions.length, s.id).toBeGreaterThanOrEqual(1);
      expect(s.questions.length, s.id).toBeLessThanOrEqual(2);
    }
    const ids = CITY_OUTINGS.map((s) => `${s.at}:${s.n}`);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('the long stories: six chapters each, in the city at somebody of the city, in the town at a resident; they open from scenes that exist', () => {
    // (the main story's second part opens from the last chapter of its first: a chapter's id)
    const ids = new Set([...CITY_SCENES, ...CITY_CHAPTERS].map((s) => s.id));
    // six long stories and the main story in two parts ('deal', 'bigdeal', free: data/city/seasonsMain.ts, seasonsMain2.ts)
    expect(CITY_SEASONS.length).toBe(8);
    expect(new Set(CITY_SEASONS.map((s) => s.id)).size).toBe(8);
    expect(CITY_SEASONS.filter((s) => s.free).map((s) => s.id)).toEqual(['deal', 'bigdeal']);
    expect(CITY_SEASONS.find((s) => s.id === 'bigdeal')!.needs).toEqual(['cs-deal-6']);
    for (const season of CITY_SEASONS) {
      expect(season.id, season.id).toMatch(/^[a-z]{2,12}$/);
      expect(season.chapters.length, season.id).toBe(6);
      expect(season.needs.length, season.id).toBeGreaterThanOrEqual(1);
      for (const n of season.needs) expect(ids.has(n), `${season.id} needs ${n}`).toBe(true);
      expect(VIET_MARK.test(season.title) && VIET_MARK.test(season.blurb), season.id).toBe(true);
      expect(season.chapters.some((c) => c.where === 'town'), `${season.id}: a chapter in the town`).toBe(true);
      expect(season.chapters.some((c) => c.where !== 'town'), `${season.id}: a chapter in the city`).toBe(true);
      season.chapters.forEach((ch, i) => {
        expect(ch.id, ch.id).toBe(`cs-${season.id}-${i + 1}`);
        expect(ch.kind, ch.id).toBe('chapter');
        expect(ch.n, ch.id).toBe(i + 1);
        expect(ch.needs ?? [], ch.id).toEqual([]);
        if (ch.where === 'town') expect(TOWN_IDS.has(ch.at), `${ch.id}: in the town at ${ch.at}`).toBe(true);
        else expect(!!cityPerson(ch.at), `${ch.id}: in the city at ${ch.at}`).toBe(true);
        expect(cast(ch).length, ch.id).toBeGreaterThanOrEqual(12);
        expect(cast(ch).length, ch.id).toBeLessThanOrEqual(18);
        const who = new Set(cast(ch).map((l) => l.who));
        expect(who.size, ch.id).toBeGreaterThanOrEqual(2);
        expect(who.size, ch.id).toBeLessThanOrEqual(4);
        expect(who.has(ch.at), `${ch.id}: ${ch.at} speaks`).toBe(true);
        expect(ch.questions.length, ch.id).toBe(3);
        if (ch.rush !== undefined) expect(season.free && ch.rush >= 35 && ch.rush <= 60, `${ch.id}: rush`).toBe(true);
      });
    }
  });

  it("the city's week: a get-together every weekday and a festival every month, two scenes each, the host among the speakers", () => {
    for (let d = 0; d < 7; d++) expect(CITY_EVENTS.filter((e) => e.weekday === d && !e.months).length, `weekday ${d}`).toBe(1);
    for (let m = 1; m <= 12; m++) expect(CITY_EVENTS.filter((e) => e.months?.includes(m)).length, `month ${m}`).toBe(1);
    for (const e of CITY_EVENTS) {
      expect(!!cityPerson(e.host), `${e.id}: hosted by somebody of the city`).toBe(true);
      expect(CITY_EVENT_SCENES.filter((s) => s.event === e.id).length, e.id).toBeGreaterThanOrEqual(2);
    }
    for (const s of CITY_EVENT_SCENES) {
      const ev = CITY_EVENTS.find((e) => e.id === s.event);
      expect(ev, s.id).toBeDefined();
      expect(s.id.startsWith(`ce-${s.event}-`), s.id).toBe(true);
      expect(s.kind, s.id).toBe('event');
      expect(s.lines.length, s.id).toBeGreaterThanOrEqual(8);
      expect(s.lines.length, s.id).toBeLessThanOrEqual(12);
      const who = new Set(s.lines.map((l) => l.who));
      expect(who.size, s.id).toBeGreaterThanOrEqual(3);
      expect(who.size, s.id).toBeLessThanOrEqual(4);
      expect(who.has(ev!.host), `${s.id}: the host ${ev!.host}`).toBe(true);
      expect(s.detail, s.id).toBeDefined();
    }
  });

  it('everybody who speaks is known; the learner speaks only in a talk they began, short lines, never the last word', () => {
    // a talk the learner began: an episode, a short talk, a visit, a chapter of a long story (never overheard, an
    // outing, a get-together or the bus)
    const talks = new Set([...CITY_SCENES, ...CITY_CHAPTERS].map((s) => s.id));
    for (const { id, line } of lines) {
      if (line.who === YOU) {
        expect(talks.has(id.split('#')[0]), `${id}: the learner speaks only in an episode, a talk, a visit or a chapter`).toBe(true);
        const n = line.text.split(/\s+/).length;
        expect(n, `${id}: ${line.text}`).toBeGreaterThanOrEqual(2);
        expect(n, `${id}: ${line.text}`).toBeLessThanOrEqual(12);
      } else expect(knownSpeaker(line.who), `${id}: ${line.who}`).toBe(true);
    }
    for (const s of [...CITY_SCENES, ...CITY_CHAPTERS]) {
      if (s.lines.length > 0) expect(s.lines[s.lines.length - 1].who, `${s.id}: somebody answers the learner`).not.toBe(YOU);
      // a talk the learner began is a talk WITH them (owner, 2026-11-27: "tao chủ động nói chuyện, sao thành ra lại là
      // nghe lén rồi?"): two lines of theirs at least, three in an episode or a chapter
      const mine = s.lines.filter((l) => l.who === YOU).length;
      expect(mine, `${s.id}: the learner takes part`).toBeGreaterThanOrEqual(s.kind === 'episode' || s.kind === 'chapter' ? 3 : 2);
      // never two of the learner's lines in a row: the other answers each
      s.lines.forEach((l, i) => i > 0 && l.who === YOU && expect(s.lines[i - 1].who, `${s.id}#${i + 1}: two lines of the learner in a row`).not.toBe(YOU));
    }
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
      ['outings', [...CITY_OUTINGS]],
      ['chapters', [...CITY_CHAPTERS]],
      ['events', CITY_EVENT_SCENES.map(asAny)],
      ['overheard', CITY_OVERHEARD.map(asAny)],
      ['rides', RIDE_SCENES.map(asAny)],
    ];
    for (const [name, list] of groups) {
      const qs = list.flatMap((s) => s.questions);
      for (const at of [0, 1, 2]) expect(qs.filter((q) => q.answer === at).length, `${name}: position ${at}`).toBeGreaterThanOrEqual(Math.floor(qs.length / 5));
    }
  });
});
