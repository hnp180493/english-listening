// Content checks for "Cảnh nghe" (core/town/sceneTypes.ts; data/scenes/*.ts): what is overheard from a bench, read
// on the radio, said at a get-together. The same rules as the town's stories where they apply (townStories.test.ts).
import { describe, expect, it } from 'vitest';
import { decode, speakableFor } from '../../core/decoder';
import { LONE_APOSTROPHE, SAPI_MISREAD } from '../../core/decoder/sapiMisread';
import { SCENE_VOICES, type ListenScene, type SceneQuestion } from '../../core/town/sceneTypes';
import { TOWN_EVENTS } from '../../core/town/world';
import { BENCHMARK_FORMS } from '../benchmark';
import { SENTENCES } from '../sentences';
import { TOWN_PLACES } from '../town';
import { TOWN_STORIES } from '../townStories';
import { EVENT_SCENES, LISTEN_SCENES, OVERHEARD_SCENES, RADIO_SCENES } from './index';

const PLACE_IDS = new Set(TOWN_PLACES.map((p) => p.id));
const wordCount = (s: string): number => s.split(/\s+/).filter((w) => /[a-z]/i.test(w)).length;

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
const ALLOWED = new Set([...TOWN_PLACES.map((p) => p.resident.toLowerCase()), 'marcus', 'bay', 'fm', 'westbay', 'chip', 'pip', 'latte', 'pizza', 'email', 'radio', 'karaoke', 'taxi', 'sandwich', 'cornwall', 'london', 'brisbane']);
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

const all = LISTEN_SCENES;
const lines = all.flatMap((s) => s.lines.map((l, i) => ({ id: `${s.id}#${i + 1}`, scene: s, line: l })));
const questions = (s: ListenScene): SceneQuestion[] => (s.detail ? [s.gist, s.detail] : [s.gist]);

describe('cảnh nghe: shape', () => {
  it('there is enough of each kind, with ids of their kind, none twice', () => {
    expect(OVERHEARD_SCENES.length).toBeGreaterThanOrEqual(20);
    expect(RADIO_SCENES.length).toBeGreaterThanOrEqual(21);
    expect(EVENT_SCENES.length).toBeGreaterThanOrEqual(10);
    for (const s of OVERHEARD_SCENES) expect(s.id).toMatch(/^oh-\d{1,3}$/);
    for (const s of RADIO_SCENES) expect(s.id).toMatch(/^fm-\d{1,3}$/);
    for (const s of EVENT_SCENES) expect(s.id).toMatch(/^ev-[a-z]+-\d{1,2}$/);
    expect(new Set(all.map((s) => s.id)).size).toBe(all.length);
    expect(new Set(all.map((s) => s.title)).size).toBe(all.length);
    for (const s of all) expect([1, 2, 3], s.id).toContain(s.level);
  });

  it('overheard: two residents, 4–6 lines, both speak twice or more', () => {
    for (const s of OVERHEARD_SCENES) {
      expect(s.kind, s.id).toBe('overheard');
      expect(s.lines.length, s.id).toBeGreaterThanOrEqual(4);
      expect(s.lines.length, s.id).toBeLessThanOrEqual(6);
      const who = [...new Set(s.lines.map((l) => l.who))];
      expect(who.length, s.id).toBe(2);
      for (const w of who) {
        expect(PLACE_IDS.has(w), `${s.id}: ${w}`).toBe(true);
        expect(s.lines.filter((l) => l.who === w).length, `${s.id}: ${w}`).toBeGreaterThanOrEqual(2);
      }
      expect(s.detail, s.id).toBeUndefined();
    }
  });

  it('every resident is overheard somewhere, none in more than a third of the scenes', () => {
    const count = new Map<string, number>();
    for (const s of OVERHEARD_SCENES) for (const w of new Set(s.lines.map((l) => l.who))) count.set(w, (count.get(w) ?? 0) + 1);
    for (const id of PLACE_IDS) {
      expect(count.get(id) ?? 0, id).toBeGreaterThanOrEqual(2);
      expect(count.get(id) ?? 0, id).toBeLessThanOrEqual(Math.ceil(OVERHEARD_SCENES.length / 3));
    }
  });

  it('radio: the presenter alone, 3–5 sentences, a gist and a detail; every weather and every weekday has segments', () => {
    for (const s of RADIO_SCENES) {
      expect(s.kind, s.id).toBe('radio');
      expect(s.lines.length, s.id).toBeGreaterThanOrEqual(3);
      expect(s.lines.length, s.id).toBeLessThanOrEqual(5);
      for (const l of s.lines) expect(Object.hasOwn(SCENE_VOICES, l.who), `${s.id}: ${l.who}`).toBe(true);
      expect(s.detail, s.id).toBeDefined();
      if (s.weekday !== undefined) expect([0, 1, 2, 3, 4, 5, 6], s.id).toContain(s.weekday);
    }
    // on any day in any weather there are at least three segments to hear (the daily pay is for three)
    for (const weather of ['clear', 'cloudy', 'rain'] as const) {
      for (let weekday = 0; weekday < 7; weekday++) {
        const fit = RADIO_SCENES.filter((s) => (s.weather === undefined || s.weather === weather) && (s.weekday === undefined || s.weekday === weekday));
        expect(fit.length, `${weather} on day ${weekday}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('get-togethers: 8–12 lines, three or four residents, the host among them; each event has two or more', () => {
    for (const s of EVENT_SCENES) {
      expect(s.kind, s.id).toBe('event');
      const ev = TOWN_EVENTS.find((e) => e.id === s.event);
      expect(ev, s.id).toBeDefined();
      expect(s.id.startsWith(`ev-${s.event}-`), s.id).toBe(true);
      expect(s.lines.length, s.id).toBeGreaterThanOrEqual(8);
      expect(s.lines.length, s.id).toBeLessThanOrEqual(12);
      const who = new Set(s.lines.map((l) => l.who));
      expect(who.size, s.id).toBeGreaterThanOrEqual(3);
      expect(who.size, s.id).toBeLessThanOrEqual(4);
      for (const w of who) expect(PLACE_IDS.has(w), `${s.id}: ${w}`).toBe(true);
      expect(who.has(ev!.host), `${s.id}: the host ${ev!.host}`).toBe(true);
      expect(s.detail, s.id).toBeDefined();
    }
    for (const e of TOWN_EVENTS) expect(EVENT_SCENES.filter((s) => s.event === e.id).length, e.id).toBeGreaterThanOrEqual(2);
  });
});

describe('cảnh nghe: English lines', () => {
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

  it('no line copies a dictation sentence, a story line, another scene line, or (≥80%) a checkup line', () => {
    const taken = new Map<string, string>();
    for (const s of SENTENCES) taken.set(tokens(s.text).join(' '), s.id);
    for (const e of TOWN_STORIES) for (const l of e.lines) taken.set(tokens(l.text).join(' '), l.id);
    const checkup = BENCHMARK_FORMS.flatMap((f) => [...f.sentences.map((s) => ({ id: s.id, text: s.text })), ...f.questions.flatMap((q) => q.lines.map((text, i) => ({ id: `${q.id}#${i}`, text })))]).map((c) => ({ ...c, toks: tokens(c.text) }));
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

describe('cảnh nghe: Vietnamese and questions', () => {
  it('meanings, titles, scene lines: Vietnamese with no English words; a scene line never names what is talked about', () => {
    for (const s of all) {
      for (const text of [s.title, s.scene, ...s.lines.map((l) => l.vi)]) {
        expect(text, s.id).toBe(text.trim());
        expect(VIET_MARK.test(text), `${s.id}: ${text}`).toBe(true);
        expect(englishWords(text), `${s.id}: ${text}`).toEqual([]);
      }
      expect(s.title.length, s.id).toBeLessThanOrEqual(40);
      expect(s.scene.length, s.id).toBeLessThanOrEqual(110);
      expect(new Set(s.lines.map((l) => l.vi)).size, s.id).toBe(s.lines.length);
    }
  });

  it('questions: three different Vietnamese answers; the right one is not the longest by far', () => {
    for (const s of all) {
      for (const q of questions(s)) {
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
    for (const list of [OVERHEARD_SCENES, RADIO_SCENES, EVENT_SCENES]) {
      const qs = list.flatMap(questions);
      for (const at of [0, 1, 2]) expect(qs.filter((q) => q.answer === at).length, `position ${at}`).toBeGreaterThanOrEqual(Math.floor(qs.length / 5));
    }
  });
});
