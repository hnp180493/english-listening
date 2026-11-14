// Content checks for "Chuyện ở thị trấn" (data/townStories.ts, contract in core/town/story.ts).
// Review tool: STORY_DUMP=1 npx vitest run src/data/townStories.test.ts
// prints every line with the connected text "Nghe" sends and the phenomena decode() marks.
import { describe, expect, it } from 'vitest';
import { decode, speakableFor } from '../core/decoder';
import { LONE_APOSTROPHE, SAPI_MISREAD } from '../core/decoder/sapiMisread';
import { CAST_VOICES } from '../core/town/voices';
import { BENCHMARK_FORMS } from './benchmark';
import { SENTENCES } from './sentences';
import { TOWN_PLACES } from './town';
import { storiesOfPlace, storyEpisode, TOWN_STORIES } from './townStories';

const PLACE_IDS = new Set(TOWN_PLACES.map((p) => p.id));
const allLines = TOWN_STORIES.flatMap((e) => e.lines.map((l) => ({ ep: e, line: l })));

const wordCount = (s: string): number => s.split(/\s+/).filter((w) => /[a-z]/i.test(w)).length;

/** Lowercase word tokens, punctuation and quote style ignored (as in benchmark.test.ts). */
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

// ── Vietnamese text: no English words ───────────────────────────────────────────────────────────────────────────────
/** The cast's names and the few loanwords Vietnamese uses as they are. */
const ALLOWED = new Set([
  ...TOWN_PLACES.map((p) => p.resident.toLowerCase()),
  'latte',
  'pizza',
  'email',
]);
/** Common English words that fit a Vietnamese syllable shape and are not Vietnamese words without tone marks
 * (so not in / to / can / do / so / me, which are). */
const ENGLISH = new Set('the you and is are it of on at my we he she they this that what yes ok okay hi hey bye but not with for'.split(' '));
/** One Vietnamese syllable once tone marks are removed: initial consonant(s), 1–3 vowels, a permitted final. */
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

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
if (env.STORY_DUMP) {
  for (const e of TOWN_STORIES) {
    console.log(`\n=== ${e.id} L${e.level} "${e.title}"`);
    for (const l of e.lines) {
      const d = decode(l.say ?? l.text);
      console.log(`${l.id} [${l.who}] ${l.text}\n   → ${speakableFor(l.text, l.say)}\n   ${decode(l.text).annotations.map((a) => `${a.type}:${a.original}`).join(' | ')}${d.speakText === undefined ? ' (no speakText)' : ''}`);
    }
  }
}

describe('TOWN_STORIES shape', () => {
  it('episode ids are `<placeId>-<order>`, unique, and every place exists', () => {
    const ids = TOWN_STORIES.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of TOWN_STORIES) {
      expect(PLACE_IDS.has(e.placeId), e.id).toBe(true);
      expect(e.id).toBe(`${e.placeId}-${e.order}`);
    }
  });

  it('every place has at least two episodes, ordered 1..n without gaps', () => {
    for (const p of TOWN_PLACES) {
      const orders = storiesOfPlace(p.id).map((e) => e.order);
      expect(orders.length, p.id).toBeGreaterThanOrEqual(2);
      expect(orders, p.id).toEqual(Array.from({ length: orders.length }, (_, i) => i + 1));
    }
  });

  it('line ids are `<episodeId>-<nn>` in order and unique across the town', () => {
    const ids = allLines.map(({ line }) => line.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of TOWN_STORIES) expect(e.lines.map((l) => l.id)).toEqual(e.lines.map((_, i) => `${e.id}-${String(i + 1).padStart(2, '0')}`));
  });

  it('5–8 lines; the learner says 1–3 of them, the resident at least 2', () => {
    for (const e of TOWN_STORIES) {
      expect(e.lines.length, e.id).toBeGreaterThanOrEqual(5);
      expect(e.lines.length, e.id).toBeLessThanOrEqual(8);
      const mine = e.lines.filter((l) => l.who === 'you').length;
      expect(mine, e.id).toBeGreaterThanOrEqual(1);
      expect(mine, e.id).toBeLessThanOrEqual(3);
      expect(e.lines.filter((l) => l.who === 'them').length, e.id).toBeGreaterThanOrEqual(2);
    }
  });

  it("a speaker is 'them', 'you' or another place's resident, and has a voice", () => {
    for (const { ep, line } of allLines) {
      if (line.who === 'them' || line.who === 'you') continue;
      expect(PLACE_IDS.has(line.who), line.id).toBe(true);
      expect(line.who, line.id).not.toBe(ep.placeId);
      expect(CAST_VOICES[line.who], line.id).toBeDefined();
    }
  });

  it('levels are 1–3 and the free places open at level 1', () => {
    for (const e of TOWN_STORIES) expect([1, 2, 3], e.id).toContain(e.level);
    for (const id of ['square-1', 'cafe-1', 'friend-1']) expect(storyEpisode(id)?.level, id).toBe(1);
  });

  it('lookups', () => {
    expect(storyEpisode('cafe-1')?.placeId).toBe('cafe');
    expect(storyEpisode('nope')).toBeUndefined();
    expect(storiesOfPlace('nope')).toEqual([]);
    expect(TOWN_PLACES.reduce((n, p) => n + storiesOfPlace(p.id).length, 0)).toBe(TOWN_STORIES.length);
  });
});

describe('TOWN_STORIES English lines', () => {
  it('plain written English: trimmed, ASCII, 3–12 words, ends like a sentence', () => {
    for (const { line } of allLines) {
      expect(line.text, line.id).toBe(line.text.trim());
      expect(line.text, line.id).not.toMatch(/\s{2,}/);
      expect(line.text, line.id).toMatch(/^[A-Za-z0-9 ,.?!'-]+$/);
      expect(line.text, line.id).toMatch(/[.?!]$/);
      const n = wordCount(line.text);
      expect(n, `${line.id}: ${line.text}`).toBeGreaterThanOrEqual(3);
      expect(n, `${line.id}: ${line.text}`).toBeLessThanOrEqual(12);
    }
  });

  it('every line decodes and "Nghe" has a connected text to send', () => {
    for (const { line } of allLines) {
      const d = decode(line.text);
      expect(d.tokens.length, line.id).toBeGreaterThan(0);
      expect(speakableFor(line.text, line.say).trim(), line.id).not.toBe('');
    }
  });

  it('what "Nghe" sends never uses a spelling SAPI was measured to misread', () => {
    for (const { line } of allLines) {
      const sent = speakableFor(line.text, line.say);
      expect(sent, `${line.id}: ${sent}`).not.toMatch(SAPI_MISREAD);
      expect(sent, `${line.id}: ${sent}`).not.toMatch(LONE_APOSTROPHE);
    }
  });

  it('an authored `say` differs from the written text, keeps its punctuation and is left unchanged by the decoder', () => {
    for (const { line } of allLines) {
      if (line.say === undefined) continue;
      expect(line.say, line.id).not.toBe(line.text);
      expect(line.say, line.id).toMatch(/^[A-Za-z ,.?!']+$/);
      expect(line.say.replace(/[^.?!,]/g, ''), line.id).toBe(line.text.replace(/[^.?!,]/g, ''));
      expect(speakableFor(line.text, line.say), line.id).toBe(line.say);
    }
  });

  it('no line equals or nearly equals (≥80% shared words) a checkup sentence or passage line', () => {
    const checkup = BENCHMARK_FORMS.flatMap((f) => [
      ...f.sentences.map((s) => ({ id: s.id, text: s.text })),
      ...f.questions.flatMap((q) => q.lines.map((text, i) => ({ id: `${q.id}#${i}`, text }))),
    ]).map((c) => ({ ...c, toks: tokens(c.text) }));
    expect(checkup.length).toBeGreaterThan(100);
    const clashes: string[] = [];
    for (const { line } of allLines) {
      const parts = [line.text, ...line.text.split(/(?<=[.!?])\s+/)];
      for (const part of new Set(parts)) {
        const mine = tokens(part);
        if (mine.length < 3) continue;
        for (const c of checkup) {
          const ov = mine.join(' ') === c.toks.join(' ') ? 1 : overlap(mine, c.toks);
          if (ov >= 0.8) clashes.push(`${line.id} "${part}" ~ ${c.id} "${c.text}" (${Math.round(ov * 100)}%)`);
        }
      }
    }
    expect(clashes).toEqual([]);
  });

  it('no line copies a dictation sentence word for word', () => {
    const dictation = new Map(SENTENCES.map((s) => [tokens(s.text).join(' '), s.id]));
    const copies = allLines.filter(({ line }) => dictation.has(tokens(line.text).join(' '))).map(({ line }) => `${line.id} ${line.text}`);
    expect(copies).toEqual([]);
  });

  it('no line is used twice', () => {
    const seen = new Map<string, string>();
    for (const { line } of allLines) {
      const k = tokens(line.text).join(' ');
      expect(seen.get(k), `${line.id} repeats ${seen.get(k)}`).toBeUndefined();
      seen.set(k, line.id);
    }
  });
});

describe('TOWN_STORIES Vietnamese', () => {
  it('the allow-list and the English detector work', () => {
    expect(englishWords('Cho tôi một ly latte nhé, Emma.')).toEqual([]);
    expect(englishWords('Bạn muốn nóng hay đá? Giữ giúp nghiêng khuya quán')).toEqual([]);
    expect(englishWords('Okay, cảm ơn nhé')).toEqual(['Okay']);
    expect(englishWords('Tôi thích the coffee')).toEqual(['the', 'coffee']);
  });

  it('meanings: non-empty Vietnamese with no English words, distinct within an episode', () => {
    for (const e of TOWN_STORIES) {
      for (const l of e.lines) {
        expect(l.vi, l.id).toBe(l.vi.trim());
        expect(VIET_MARK.test(l.vi), `${l.id}: ${l.vi}`).toBe(true);
        expect(englishWords(l.vi), `${l.id}: ${l.vi}`).toEqual([]);
      }
      expect(new Set(e.lines.map((l) => l.vi)).size, e.id).toBe(e.lines.length);
    }
  });

  it('title, scene and gist are Vietnamese with no English words', () => {
    for (const e of TOWN_STORIES) {
      for (const s of [e.title, e.scene, e.gist.q, ...e.gist.options]) {
        expect(s.trim(), e.id).toBe(s);
        expect(s, e.id).not.toBe('');
        expect(englishWords(s), `${e.id}: ${s}`).toEqual([]);
      }
      // a short title can be all unmarked syllables ("Tin vui"); the longer texts are plainly Vietnamese
      for (const s of [e.scene, e.gist.q]) expect(VIET_MARK.test(s), `${e.id}: ${s}`).toBe(true);
    }
  });

  it('titles are unique', () => {
    expect(new Set(TOWN_STORIES.map((e) => e.title)).size).toBe(TOWN_STORIES.length);
  });

  it('gist: three distinct options, answer in range, the true one not given away by its length', () => {
    for (const e of TOWN_STORIES) {
      const { options, answer } = e.gist;
      expect(options, e.id).toHaveLength(3);
      expect(new Set(options.map((o) => o.toLowerCase())).size, e.id).toBe(3);
      expect([0, 1, 2], e.id).toContain(answer);
      const len = options.map((o) => o.length);
      const others = len.filter((_, i) => i !== answer);
      expect(len[answer], `${e.id}: ${options.join(' | ')}`).toBeLessThanOrEqual(Math.max(...others) * 1.35);
    }
  });

  it('the true option sits in every position, not always the first', () => {
    const per = [0, 1, 2].map((p) => TOWN_STORIES.filter((e) => e.gist.answer === p).length);
    for (const n of per) expect(n, per.join(',')).toBeGreaterThanOrEqual(Math.floor(TOWN_STORIES.length / 5));
  });

  it('uses the app tone-mark style (hủy, hóa, khóa, tòa)', () => {
    expect(JSON.stringify(TOWN_STORIES)).not.toMatch(/huỷ|hoá|khoá|toà(?!n)|tuỳ|thuỷ/i);
  });
});
