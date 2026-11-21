// Content checks for every resident's relationship arc (data/stories/<placeId>.ts, contract ResidentArc in
// core/town/story.ts): episodes 3+, choices, variants, facts, gift taste, gift reactions, greetings. Generic over
// RESIDENT_ARCS, so an empty stub passes and a filled arc must obey the same rules as episodes 1–2
// (data/townStories.test.ts): plain spoken English the decoder can show, SAPI-safe "Nghe" text, no checkup or
// dictation copies, Vietnamese meanings with no English, the app's tone-mark style.
// Review tool: ARC_DUMP=1 npx vitest run src/data/stories/arcs.test.ts
// prints every voiced line with the connected text "Nghe" sends and the phenomena decode() marks.
import { describe, expect, it } from 'vitest';
import { decode, speakableFor } from '../../core/decoder';
import { LONE_APOSTROPHE, SAPI_MISREAD } from '../../core/decoder/sapiMisread';
import type { FactId, ResidentArc, StoryEpisode, StorySetting } from '../../core/town/story';
import { CAST_VOICES } from '../../core/town/voices';
import { BENCHMARK_FORMS } from '../benchmark';
import { SENTENCES } from '../sentences';
import { TOWN_PLACES } from '../town';
import { TOWN_GIFTS } from '../townGifts';
import { BASE_STORIES, settingPlace } from '../townStories';
import { RESIDENT_ARCS } from './index';

const PLACE_IDS = new Set(TOWN_PLACES.map((p) => p.id));
const FREE = new Set(TOWN_PLACES.filter((p) => p.cost <= 0).map((p) => p.id));
const GIFT_IDS = new Set(TOWN_GIFTS.map((g) => g.id));
const TIERS = [0, 3, 7];
const LINE_MIN = 8;
const LINE_MAX = 12;
const WORDS_MIN = 3;
const WORDS_MAX = 14;
const POINTS_MIN = -20;
const POINTS_MAX = 30;

const ARC_EPISODES: { arc: ResidentArc; ep: StoryEpisode }[] = RESIDENT_ARCS.flatMap((arc) => arc.episodes.map((ep) => ({ arc, ep })));
const ARC_EPISODE_IDS = new Set(ARC_EPISODES.map(({ ep }) => ep.id));
/** Episodes 1–2 (never the arcs' own, even if a later build merges them into the same list). */
const BASE = BASE_STORIES.filter((e) => !ARC_EPISODE_IDS.has(e.id));

/** An arc nobody has filled yet: its placeholder reactions have no text. */
const isStub = (arc: ResidentArc): boolean =>
  arc.episodes.length === 0 && arc.facts.length === 0 && arc.greetings.length === 0 && arc.taste.loves.length + arc.taste.likes.length + arc.taste.dislikes.length === 0;

interface Voiced {
  id: string;
  kind: 'line' | 'choice' | 'variant' | 'greeting' | 'reaction';
  placeId: string;
  who: string;
  text: string;
  vi: string;
  say?: string;
}

/** Every line a resident or the learner says in the arcs (option 0 of a choice is the line itself, so it is left out). */
const VOICED: Voiced[] = RESIDENT_ARCS.flatMap((arc) => {
  const out: Voiced[] = [];
  const p = arc.placeId;
  for (const ep of arc.episodes) {
    for (const l of ep.lines) {
      out.push({ id: l.id, kind: 'line', placeId: p, who: l.who, text: l.text, vi: l.vi, say: l.say });
      for (const c of (l.choices ?? []).slice(1)) out.push({ id: c.id, kind: 'choice', placeId: p, who: l.who, text: c.text, vi: c.vi, say: c.say });
      for (const v of l.variants ?? []) out.push({ id: v.id, kind: 'variant', placeId: p, who: l.who, text: v.text, vi: v.vi, say: v.say });
    }
  }
  for (const g of arc.greetings) out.push({ id: g.id, kind: 'greeting', placeId: p, who: g.who, text: g.text, vi: g.vi, say: g.say });
  if (!isStub(arc)) for (const r of Object.values(arc.reactions)) out.push({ id: r.id, kind: 'reaction', placeId: p, who: r.who, text: r.text, vi: r.vi, say: r.say });
  return out;
});

const FACTS = new Map(RESIDENT_ARCS.flatMap((arc) => arc.facts.map((f) => [f.id, { fact: f, placeId: arc.placeId }] as const)));

/** Where a fact is taught: an episode's `learn` (at its end: line Infinity) or a choice on line `line` of an episode. */
interface Teacher {
  placeId: string;
  order: number;
  line: number;
  episodeId: string;
}
const TEACHERS = new Map<FactId, Teacher[]>();
for (const { arc, ep } of ARC_EPISODES) {
  const add = (id: FactId, line: number): void => {
    const list = TEACHERS.get(id) ?? [];
    list.push({ placeId: arc.placeId, order: ep.order, line, episodeId: ep.id });
    TEACHERS.set(id, list);
  };
  for (const id of ep.learn ?? []) add(id, Infinity);
  ep.lines.forEach((l, i) => {
    for (const c of l.choices ?? []) for (const id of c.learn ?? []) add(id, i);
  });
}

const wordCount = (s: string): number => s.split(/\s+/).filter((w) => /[a-z]/i.test(w)).length;

/** Lowercase word tokens, punctuation and quote style ignored (as in townStories.test.ts). */
function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[‘’`´]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, ''))
    .filter(Boolean);
}

/** Shared tokens (multiset) over the longer of the two lists: 1 = same words. */
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

// ── Vietnamese text: no English words (same detector as townStories.test.ts) ────────────────────────────────────────
const ALLOWED = new Set([...TOWN_PLACES.map((p) => p.resident.toLowerCase()), 'latte', 'pizza', 'email']);
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

/** The gift's noun as a line would say it: "an iced latte" → "latt", "a scarf" → "scar" (scarves), "roses" → "rose". */
function giftStem(en: string): string {
  const last = en.toLowerCase().split(/\s+/).pop() ?? '';
  return last.slice(0, Math.max(4, last.length - 2));
}

/** Every text said in an episode (lines, every choice, every variant). */
function episodeTexts(ep: StoryEpisode): string[] {
  return ep.lines.flatMap((l) => [l.text, ...(l.choices ?? []).map((c) => c.text), ...(l.variants ?? []).map((v) => v.text)]);
}

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
if (env.ARC_DUMP) {
  for (const v of VOICED) {
    const d = decode(v.say ?? v.text);
    console.log(`${v.id} [${v.who}] ${v.text}\n   → ${speakableFor(v.text, v.say)}\n   ${decode(v.text).annotations.map((a) => `${a.type}:${a.original}`).join(' | ')}${d.speakText === undefined ? ' (no speakText)' : ''}`);
  }
}

describe('RESIDENT_ARCS shape', () => {
  it('one arc per real place', () => {
    const ids = RESIDENT_ARCS.map((a) => a.placeId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(PLACE_IDS.has(id), id).toBe(true);
  });

  it('episode ids are `<placeId>-<order>`, unique town-wide, ordered right after the place\'s episodes 1–2 without gaps', () => {
    const all = [...BASE.map((e) => e.id), ...ARC_EPISODES.map(({ ep }) => ep.id)];
    expect(new Set(all).size).toBe(all.length);
    for (const arc of RESIDENT_ARCS) {
      const base = BASE.filter((e) => e.placeId === arc.placeId).length;
      expect(arc.episodes.map((e) => e.order), arc.placeId).toEqual(arc.episodes.map((_, i) => base + 1 + i));
      for (const e of arc.episodes) {
        expect(e.placeId, e.id).toBe(arc.placeId);
        expect(e.id).toBe(`${e.placeId}-${e.order}`);
      }
    }
  });

  it('requires: hearts 0–10, never falling along the arc; facts defined', () => {
    for (const arc of RESIDENT_ARCS) {
      let last = 0;
      for (const e of arc.episodes) {
        const h = e.requires?.hearts ?? 0;
        expect(Number.isInteger(h) && h >= 0 && h <= 10, e.id).toBe(true);
        expect(h, `${e.id}: hearts ${h} after ${last}`).toBeGreaterThanOrEqual(last);
        last = h;
        for (const f of e.requires?.facts ?? []) expect(FACTS.has(f), `${e.id} requires ${f}`).toBe(true);
      }
    }
  });

  it('levels are 1–3; titles unique town-wide', () => {
    for (const { ep } of ARC_EPISODES) expect([1, 2, 3], ep.id).toContain(ep.level);
    const titles = [...BASE.map((e) => e.title), ...ARC_EPISODES.map(({ ep }) => ep.title)];
    expect(new Set(titles).size).toBe(titles.length);
  });

  it(`line ids are \`<episodeId>-<nn>\` in order; ${LINE_MIN}–${LINE_MAX} lines; the learner says at least one, the resident at least two`, () => {
    for (const { ep } of ARC_EPISODES) {
      expect(ep.lines.map((l) => l.id)).toEqual(ep.lines.map((_, i) => `${ep.id}-${String(i + 1).padStart(2, '0')}`));
      expect(ep.lines.length, ep.id).toBeGreaterThanOrEqual(LINE_MIN);
      expect(ep.lines.length, ep.id).toBeLessThanOrEqual(LINE_MAX);
      expect(ep.lines.filter((l) => l.who === 'you').length, ep.id).toBeGreaterThanOrEqual(1);
      expect(ep.lines.filter((l) => l.who === 'them').length, ep.id).toBeGreaterThanOrEqual(2);
    }
  });

  it("a speaker is 'them', 'you' or another place's resident with a voice", () => {
    for (const { ep } of ARC_EPISODES) {
      for (const l of ep.lines) {
        if (l.who === 'them' || l.who === 'you') continue;
        expect(PLACE_IDS.has(l.who), l.id).toBe(true);
        expect(l.who, l.id).not.toBe(ep.placeId);
        expect(CAST_VOICES[l.who], l.id).toBeDefined();
      }
    }
  });

  it('every voiced id is unique town-wide', () => {
    const ids = [
      ...BASE.flatMap((e) => e.lines.map((l) => l.id)),
      ...ARC_EPISODES.flatMap(({ ep }) => ep.lines.flatMap((l) => [l.id, ...(l.choices ?? []).map((c) => c.id), ...(l.variants ?? []).map((v) => v.id)])),
      ...RESIDENT_ARCS.flatMap((a) => [...a.greetings.map((g) => g.id), ...Object.values(a.reactions).map((r) => r.id)]),
    ];
    const seen = new Set<string>();
    const dup = ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
    expect(dup).toEqual([]);
  });
});

describe('RESIDENT_ARCS choices and variants', () => {
  it("choices only on the learner's lines: 2–3 options, ids `<lineId>-a|b|c`, option 0 is the line itself", () => {
    for (const { ep } of ARC_EPISODES) {
      for (const l of ep.lines) {
        if (!l.choices) continue;
        expect(l.who, l.id).toBe('you');
        expect(l.choices.length, l.id).toBeGreaterThanOrEqual(2);
        expect(l.choices.length, l.id).toBeLessThanOrEqual(3);
        expect(l.choices.map((c) => c.id)).toEqual(l.choices.map((_, i) => `${l.id}-${'abc'[i]}`));
        const [first] = l.choices;
        expect({ text: first.text, vi: first.vi, say: first.say }, l.id).toEqual({ text: l.text, vi: l.vi, say: l.say });
        expect(new Set(l.choices.map((c) => c.text)).size, l.id).toBe(l.choices.length);
        expect(new Set(l.choices.map((c) => c.vi)).size, l.id).toBe(l.choices.length);
      }
    }
  });

  it('a choice: a short distinct Vietnamese intent, points within the contract, facts it teaches defined', () => {
    for (const { ep } of ARC_EPISODES) {
      for (const l of ep.lines) {
        if (!l.choices) continue;
        expect(new Set(l.choices.map((c) => c.intent)).size, l.id).toBe(l.choices.length);
        for (const c of l.choices) {
          expect(c.intent, c.id).toBe(c.intent.trim());
          expect(c.intent.length, c.id).toBeGreaterThan(0);
          expect(c.intent.length, c.id).toBeLessThanOrEqual(30);
          expect(englishWords(c.intent), `${c.id}: ${c.intent}`).toEqual([]);
          const p = c.points ?? 0;
          expect(Number.isInteger(p) && p >= POINTS_MIN && p <= POINTS_MAX, `${c.id}: ${p}`).toBe(true);
          for (const f of c.learn ?? []) expect(FACTS.has(f), `${c.id} learns ${f}`).toBe(true);
        }
      }
    }
  });

  it('a resident with episodes has a choice in at least two of them (memory needs choices)', () => {
    for (const arc of RESIDENT_ARCS) {
      if (arc.episodes.length === 0) continue;
      const withChoice = arc.episodes.filter((e) => e.lines.some((l) => l.choices)).length;
      expect(withChoice, arc.placeId).toBeGreaterThanOrEqual(Math.min(2, arc.episodes.length));
    }
  });

  it('variants: ids `<lineId>-v<n>`, a defined fact each (distinct per line), a text other than the line', () => {
    for (const { ep } of ARC_EPISODES) {
      for (const l of ep.lines) {
        if (!l.variants) continue;
        expect(l.variants.length, l.id).toBeGreaterThan(0);
        expect(l.variants.map((v) => v.id)).toEqual(l.variants.map((_, i) => `${l.id}-v${i + 1}`));
        expect(new Set(l.variants.map((v) => v.if)).size, l.id).toBe(l.variants.length);
        for (const v of l.variants) {
          expect(FACTS.has(v.if), `${v.id} if ${v.if}`).toBe(true);
          expect(tokens(v.text).join(' '), v.id).not.toBe(tokens(l.text).join(' '));
        }
      }
    }
  });

  it("a variant remembers something already known: a fact of the same resident's arc is taught in an earlier episode or by a choice on an earlier line", () => {
    for (const { arc, ep } of ARC_EPISODES) {
      ep.lines.forEach((l, i) => {
        for (const v of l.variants ?? []) {
          const teachers = TEACHERS.get(v.if) ?? [];
          expect(teachers.length, `${v.id}: ${v.if} is never taught`).toBeGreaterThan(0);
          if (teachers.some((t) => t.placeId !== arc.placeId)) continue; // taught by a neighbour: no order between arcs
          const before = teachers.some((t) => t.order < ep.order || (t.order === ep.order && t.line < i));
          expect(before, `${v.id}: ${v.if} is taught only later`).toBe(true);
        }
      });
    }
  });
});

describe('RESIDENT_ARCS facts and gifts', () => {
  it('fact ids: `<placeId>:<slug>` of the arc or `you:<slug>`, unique town-wide, with a Vietnamese journal line', () => {
    const ids = RESIDENT_ARCS.flatMap((a) => a.facts.map((f) => f.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const arc of RESIDENT_ARCS) {
      for (const f of arc.facts) {
        expect(f.id, arc.placeId).toMatch(new RegExp(`^(${arc.placeId}|you):[a-z0-9]+(-[a-z0-9]+)*$`));
        expect(f.vi, f.id).toBe(f.vi.trim());
        expect(VIET_MARK.test(f.vi), `${f.id}: ${f.vi}`).toBe(true);
        expect(englishWords(f.vi), `${f.id}: ${f.vi}`).toEqual([]);
      }
    }
  });

  it("facts used anywhere are defined; every defined fact is taught (an episode's learn or a choice)", () => {
    for (const { ep } of ARC_EPISODES) for (const f of ep.learn ?? []) expect(FACTS.has(f), `${ep.id} learns ${f}`).toBe(true);
    for (const arc of RESIDENT_ARCS) {
      for (const g of arc.greetings) if (g.if) expect(FACTS.has(g.if), `${g.id} if ${g.if}`).toBe(true);
      for (const f of arc.facts) expect(TEACHERS.has(f.id), `${f.id} is never taught`).toBe(true);
    }
  });

  it('taste: real gifts, each listed once', () => {
    for (const arc of RESIDENT_ARCS) {
      const all = [...arc.taste.loves, ...arc.taste.likes, ...arc.taste.dislikes];
      expect(new Set(all).size, arc.placeId).toBe(all.length);
      for (const g of all) expect(GIFT_IDS.has(g), `${arc.placeId}: ${g}`).toBe(true);
    }
  });

  it("a fact's gift matches the arc's taste", () => {
    for (const arc of RESIDENT_ARCS) {
      for (const f of arc.facts) {
        if (!f.gift) continue;
        expect(GIFT_IDS.has(f.gift.id), f.id).toBe(true);
        expect(arc.taste[f.gift.taste], `${f.id}: ${f.gift.id} ${f.gift.taste}`).toContain(f.gift.id);
      }
    }
  });

  it('every loved or liked gift is said: a fact of the arc reveals it, an episode teaches it, and one of its lines names the gift', () => {
    for (const arc of RESIDENT_ARCS) {
      for (const taste of ['loves', 'likes'] as const) {
        for (const giftId of arc.taste[taste]) {
          const fact = arc.facts.find((f) => f.gift?.id === giftId && f.gift.taste === taste);
          expect(fact, `${arc.placeId} ${taste} ${giftId}: no fact`).toBeDefined();
          if (!fact) continue;
          const teachers = (TEACHERS.get(fact.id) ?? []).filter((t) => t.placeId === arc.placeId);
          expect(teachers.length, `${fact.id} is never taught by ${arc.placeId}`).toBeGreaterThan(0);
          const stem = giftStem(TOWN_GIFTS.find((g) => g.id === giftId)?.en ?? giftId);
          const said = teachers.some((t) => {
            const ep = arc.episodes.find((e) => e.id === t.episodeId);
            return !!ep && episodeTexts(ep).some((s) => s.toLowerCase().includes(stem));
          });
          expect(said, `${fact.id}: no line of its episode says "${stem}"`).toBe(true);
        }
      }
    }
  });
});

describe('RESIDENT_ARCS reactions and greetings', () => {
  it("reactions: ids `<placeId>-gift-<taste>`, said by the resident; a filled arc has all four", () => {
    for (const arc of RESIDENT_ARCS) {
      for (const taste of ['loves', 'likes', 'neutral', 'dislikes'] as const) {
        const r = arc.reactions[taste];
        expect(r.id).toBe(`${arc.placeId}-gift-${taste}`);
        expect(r.who, r.id).toBe('them');
        if (!isStub(arc)) expect(r.text.trim(), r.id).not.toBe('');
      }
    }
  });

  it("greetings: ids `<placeId>-hi-<nn>` in order, said by the resident, tier 0 / 3 / 7, a plain one for a stranger", () => {
    for (const arc of RESIDENT_ARCS) {
      expect(arc.greetings.map((g) => g.id)).toEqual(arc.greetings.map((_, i) => `${arc.placeId}-hi-${String(i + 1).padStart(2, '0')}`));
      for (const g of arc.greetings) {
        expect(g.who, g.id).toBe('them');
        expect(TIERS, g.id).toContain(g.tier);
        expect(g.choices, g.id).toBeUndefined();
        expect(g.variants, g.id).toBeUndefined();
      }
      if (arc.greetings.length > 0) expect(arc.greetings.some((g) => g.tier === 0 && !g.if), arc.placeId).toBe(true);
    }
  });
});

describe('RESIDENT_ARCS settings', () => {
  function valid(s: StorySetting | undefined): boolean {
    if (!s) return false;
    if (s.kind === 'inside') return s.room === 'inn' || PLACE_IDS.has(s.room);
    return s.kind === 'outside' && PLACE_IDS.has(s.at);
  }

  it("every episode happens at its own place, one standing from the start, or the inn; never a lodger setting (episode 3+ needs the house)", () => {
    for (const { ep } of ARC_EPISODES) {
      expect(valid(ep.setting), `${ep.id}: ${JSON.stringify(ep.setting)}`).toBe(true);
      const needs = ep.setting ? settingPlace(ep.setting) : null;
      expect(needs === null || needs === ep.placeId || FREE.has(needs), `${ep.id}: ${JSON.stringify(ep.setting)}`).toBe(true);
      expect(ep.lodgerSetting, ep.id).toBeUndefined();
    }
  });
});

describe('RESIDENT_ARCS English lines', () => {
  it(`plain written English: trimmed, ASCII, ${WORDS_MIN}–${WORDS_MAX} words, ends like a sentence`, () => {
    for (const v of VOICED) {
      expect(v.text, v.id).toBe(v.text.trim());
      expect(v.text, v.id).not.toMatch(/\s{2,}/);
      expect(v.text, v.id).toMatch(/^[A-Za-z0-9 ,.?!'-]+$/);
      expect(v.text, v.id).toMatch(/[.?!]$/);
      const n = wordCount(v.text);
      expect(n, `${v.id}: ${v.text}`).toBeGreaterThanOrEqual(WORDS_MIN);
      expect(n, `${v.id}: ${v.text}`).toBeLessThanOrEqual(WORDS_MAX);
    }
  });

  it('every line decodes and "Nghe" has a connected text to send', () => {
    for (const v of VOICED) {
      expect(decode(v.text).tokens.length, v.id).toBeGreaterThan(0);
      expect(speakableFor(v.text, v.say).trim(), v.id).not.toBe('');
    }
  });

  it('what "Nghe" sends never uses a spelling SAPI was measured to misread', () => {
    for (const v of VOICED) {
      const sent = speakableFor(v.text, v.say);
      expect(sent, `${v.id}: ${sent}`).not.toMatch(SAPI_MISREAD);
      expect(sent, `${v.id}: ${sent}`).not.toMatch(LONE_APOSTROPHE);
    }
  });

  it('an authored `say` differs from the written text, keeps its punctuation and is left unchanged by the decoder', () => {
    for (const v of VOICED) {
      if (v.say === undefined) continue;
      expect(v.say, v.id).not.toBe(v.text);
      expect(v.say, v.id).toMatch(/^[A-Za-z ,.?!']+$/);
      expect(v.say.replace(/[^.?!,]/g, ''), v.id).toBe(v.text.replace(/[^.?!,]/g, ''));
      expect(speakableFor(v.text, v.say), v.id).toBe(v.say);
    }
  });

  it('no line equals or nearly equals (≥80% shared words) a checkup sentence or passage line', () => {
    const checkup = BENCHMARK_FORMS.flatMap((f) => [
      ...f.sentences.map((s) => ({ id: s.id, text: s.text })),
      ...f.questions.flatMap((q) => q.lines.map((text, i) => ({ id: `${q.id}#${i}`, text }))),
    ]).map((c) => ({ ...c, toks: tokens(c.text) }));
    expect(checkup.length).toBeGreaterThan(100);
    const clashes: string[] = [];
    for (const v of VOICED) {
      for (const part of new Set([v.text, ...v.text.split(/(?<=[.!?])\s+/)])) {
        const mine = tokens(part);
        if (mine.length < 3) continue;
        for (const c of checkup) {
          const ov = mine.join(' ') === c.toks.join(' ') ? 1 : overlap(mine, c.toks);
          if (ov >= 0.8) clashes.push(`${v.id} "${part}" ~ ${c.id} "${c.text}" (${Math.round(ov * 100)}%)`);
        }
      }
    }
    expect(clashes).toEqual([]);
  });

  it('no line copies a dictation sentence word for word', () => {
    const dictation = new Set(SENTENCES.map((s) => tokens(s.text).join(' ')));
    expect(VOICED.filter((v) => dictation.has(tokens(v.text).join(' '))).map((v) => `${v.id} ${v.text}`)).toEqual([]);
  });

  it('no line is used twice in the town (episodes 1–2 included)', () => {
    const seen = new Map<string, string>();
    for (const l of BASE.flatMap((e) => e.lines)) seen.set(tokens(l.text).join(' '), l.id);
    const repeats: string[] = [];
    for (const v of VOICED) {
      const k = tokens(v.text).join(' ');
      const before = seen.get(k);
      if (before) repeats.push(`${v.id} repeats ${before}: ${v.text}`);
      seen.set(k, v.id);
    }
    expect(repeats).toEqual([]);
  });
});

describe('RESIDENT_ARCS Vietnamese', () => {
  it('meanings: non-empty Vietnamese with no English words; distinct within an episode', () => {
    for (const v of VOICED) {
      expect(v.vi, v.id).toBe(v.vi.trim());
      expect(VIET_MARK.test(v.vi), `${v.id}: ${v.vi}`).toBe(true);
      expect(englishWords(v.vi), `${v.id}: ${v.vi}`).toEqual([]);
    }
    for (const { ep } of ARC_EPISODES) expect(new Set(ep.lines.map((l) => l.vi)).size, ep.id).toBe(ep.lines.length);
  });

  it('title, scene and gist are Vietnamese with no English words', () => {
    for (const { ep } of ARC_EPISODES) {
      for (const s of [ep.title, ep.scene, ep.gist.q, ...ep.gist.options]) {
        expect(s.trim(), ep.id).toBe(s);
        expect(s, ep.id).not.toBe('');
        expect(englishWords(s), `${ep.id}: ${s}`).toEqual([]);
      }
      for (const s of [ep.scene, ep.gist.q]) expect(VIET_MARK.test(s), `${ep.id}: ${s}`).toBe(true);
    }
  });

  it('gist: three distinct options, answer in range, the true one not given away by its length', () => {
    for (const { ep } of ARC_EPISODES) {
      const { options, answer } = ep.gist;
      expect(options, ep.id).toHaveLength(3);
      expect(new Set(options.map((o) => o.toLowerCase())).size, ep.id).toBe(3);
      expect([0, 1, 2], ep.id).toContain(answer);
      const len = options.map((o) => o.length);
      const others = len.filter((_, i) => i !== answer);
      expect(len[answer], `${ep.id}: ${options.join(' | ')}`).toBeLessThanOrEqual(Math.max(...others) * 1.35);
    }
  });

  it('the true gist option sits in every position, not always the first', () => {
    const n = ARC_EPISODES.length;
    const per = [0, 1, 2].map((p) => ARC_EPISODES.filter(({ ep }) => ep.gist.answer === p).length);
    for (const c of per) expect(c, per.join(',')).toBeGreaterThanOrEqual(Math.floor(n / 5));
  });

  it('uses the app tone-mark style (hủy, hóa, khóa, tòa)', () => {
    expect(JSON.stringify(RESIDENT_ARCS)).not.toMatch(/huỷ|hoá|khoá|toà(?!n)|tuỳ|thuỷ/i);
  });
});
