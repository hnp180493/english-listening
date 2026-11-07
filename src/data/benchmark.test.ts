// Content checks for the periodic listening check ("Kiểm tra định kỳ").
// Review tool: BENCH_DUMP=1 npx vitest run src/data/benchmark.test.ts --reporter=verbose
// prints every sentence with the phenomena decode() marks and per-form totals.
import { describe, expect, it } from 'vitest';
import { decode } from '../core/decoder';
import { checkSentence } from '../core/benchmark';
import { align } from '../core/dictation/align';
import { normalizeText } from '../core/dictation/normalize';
import { PHENOMENA, type Level, type Phenomenon } from '../core/types';
import { EXAMPLES } from '../features/decoder/examples';
import { BENCHMARK_FORMS } from './benchmark';
import type { BenchmarkFormId } from './benchmarkTypes';
import { CHUNKS } from './chunks';
import { LESSONS } from './lessons';
import { PAIR_SETS } from './pairs';
import { SENTENCES } from './sentences';

const FORM_IDS: BenchmarkFormId[] = ['A', 'B', 'C', 'D', 'E', 'F'];
const VIET = /[ăâđêôơưạảãầấậẩẫằắặẳẵẹẻẽềếệểễịỉĩọỏõồốộổỗờớợởỡụủũừứựửữ]/i;

const wordCount = (s: string): number => s.split(/\s+/).filter((w) => /[a-z]/i.test(w)).length;
const typesIn = (text: string): Set<Phenomenon> => new Set(decode(text).annotations.map((a) => a.type));

/** Lowercase word tokens, punctuation and quote style ignored. */
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

/** Every English string in a data structure (deep walk), plus its single sentences. */
function englishStrings(o: unknown, out: string[] = []): string[] {
  if (typeof o === 'string') {
    if (/[a-z]/i.test(o) && !VIET.test(o)) {
      out.push(o);
      for (const part of o.split(/(?<=[.!?])\s+/)) if (part !== o) out.push(part);
    }
  } else if (Array.isArray(o)) for (const x of o) englishStrings(x, out);
  else if (o && typeof o === 'object') for (const v of Object.values(o as Record<string, unknown>)) englishStrings(v, out);
  return out;
}

const sentencesOf = (f: (typeof BENCHMARK_FORMS)[number]) => f.sentences;
const allSentences = BENCHMARK_FORMS.flatMap(sentencesOf);
const allQuestions = BENCHMARK_FORMS.flatMap((f) => f.questions);

/** Every English line the test speaks: dictation sentences and passage lines. */
const benchmarkLines: { id: string; text: string }[] = [
  ...allSentences.map((s) => ({ id: s.id, text: s.text })),
  ...allQuestions.flatMap((q) => q.lines.map((text, i) => ({ id: `${q.id}#${i}`, text }))),
];

interface FormStats {
  words: number;
  annotations: number;
  phenomena: Set<Phenomenon>;
}

function formStats(f: (typeof BENCHMARK_FORMS)[number]): FormStats {
  let words = 0;
  let annotations = 0;
  const phenomena = new Set<Phenomenon>();
  for (const s of f.sentences) {
    words += wordCount(s.text);
    const anns = decode(s.text).annotations;
    annotations += anns.length;
    for (const a of anns) phenomena.add(a.type);
  }
  return { words, annotations, phenomena };
}

const STATS = new Map(BENCHMARK_FORMS.map((f) => [f.id, formStats(f)]));

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

if (env.BENCH_DUMP) {
  for (const f of BENCHMARK_FORMS) {
    const st = STATS.get(f.id)!;
    console.log(`\n=== Form ${f.id}: ${st.words} words, ${st.annotations} annotations, ${st.phenomena.size} phenomena [${[...st.phenomena].join(', ')}]`);
    for (const s of f.sentences) {
      const d = decode(s.text);
      console.log(`${s.id} L${s.level} (${wordCount(s.text)}w) ${s.text}\n   ${d.spokenText}\n   ${d.annotations.map((a) => `${a.type}:${a.original}`).join(' | ')}`);
    }
    for (const q of f.questions) {
      const d = decode(q.lines.join(' '));
      console.log(`${q.id} ${[...new Set(d.annotations.map((a) => a.type))].join(', ')}`);
    }
  }
}

describe('BENCHMARK_FORMS shape', () => {
  it('has the six forms A–F in order', () => {
    expect(BENCHMARK_FORMS.map((f) => f.id)).toEqual(FORM_IDS);
  });

  it('each form has 10 sentences and 4 questions with ordered, unique ids', () => {
    const ids = new Set<string>();
    for (const f of BENCHMARK_FORMS) {
      expect(f.sentences.map((s) => s.id)).toEqual(Array.from({ length: 10 }, (_, i) => `b${f.id}-s${String(i + 1).padStart(2, '0')}`));
      expect(f.questions.map((q) => q.id)).toEqual(Array.from({ length: 4 }, (_, i) => `b${f.id}-q${i + 1}`));
      for (const x of [...f.sentences, ...f.questions]) {
        expect(ids.has(x.id), x.id).toBe(false);
        ids.add(x.id);
      }
    }
  });

  it('sentences are 6–16 words of plain written English with a Vietnamese translation', () => {
    for (const s of allSentences) {
      const n = wordCount(s.text);
      expect(n, s.id).toBeGreaterThanOrEqual(6);
      expect(n, s.id).toBeLessThanOrEqual(16);
      expect(/\d/.test(s.text), `${s.id} has digits`).toBe(false);
      expect(/\b(gonna|wanna|gotta|kinda|lemme|gimme|dunno)\b/i.test(s.text), `${s.id} written reduction`).toBe(false);
      expect(s.vi.trim().length, s.id).toBeGreaterThan(0);
      expect(VIET.test(s.vi), `${s.id} vi`).toBe(true);
      expect(s.focus.length, s.id).toBeGreaterThan(0);
      expect(new Set(s.focus).size, s.id).toBe(s.focus.length);
    }
  });

  it('questions: 2–4 lines, Vietnamese question/why, 3–4 distinct options, answer in range', () => {
    for (const q of allQuestions) {
      expect(q.lines.length, q.id).toBeGreaterThanOrEqual(2);
      expect(q.lines.length, q.id).toBeLessThanOrEqual(4);
      for (const l of q.lines) expect(VIET.test(l), `${q.id} line`).toBe(false);
      expect(VIET.test(q.question), q.id).toBe(true);
      expect(VIET.test(q.why), q.id).toBe(true);
      expect(q.options.length, q.id).toBeGreaterThanOrEqual(3);
      expect(q.options.length, q.id).toBeLessThanOrEqual(4);
      expect(new Set(q.options.map((o) => o.trim().toLowerCase())).size, q.id).toBe(q.options.length);
      expect(Number.isInteger(q.answer), q.id).toBe(true);
      expect(q.answer, q.id).toBeGreaterThanOrEqual(0);
      expect(q.answer, q.id).toBeLessThan(q.options.length);
      expect(q.focus.length, q.id).toBeGreaterThan(0);
    }
  });

  it('correct option positions are spread out within each form', () => {
    for (const f of BENCHMARK_FORMS) {
      const answers = f.questions.map((q) => q.answer);
      // 4 questions, 4 options: every position used exactly once (the test also shuffles them per attempt).
      expect(new Set(answers).size, `form ${f.id} answers ${answers.join(',')}`).toBe(f.questions.length);
    }
  });

  it('the correct option is not given away by being much the longest', () => {
    for (const q of allQuestions) {
      const len = q.options.map((o) => o.length);
      const others = len.filter((_, i) => i !== q.answer);
      expect(len[q.answer], `${q.id}: ${q.options.join(' | ')}`).toBeLessThanOrEqual(Math.max(...others) * 1.35);
    }
  });

  it('options never assume the speaker is male or female (the TTS voice is the learner choice)', () => {
    for (const q of allQuestions) for (const o of [q.question, ...q.options]) expect(/(anh ấy|cô ấy)/i.test(o), `${q.id}: ${o}`).toBe(false);
  });

  it('uses the app tone-mark style (hủy, hóa, khóa, tòa)', () => {
    const text = JSON.stringify(BENCHMARK_FORMS);
    expect(text).not.toMatch(/huỷ|hoá|khoá|toà(?!n)/i);
  });
});

describe('BENCHMARK_FORMS balance', () => {
  it('level mix is exactly 3 × L1, 4 × L2, 3 × L3 in every form', () => {
    for (const f of BENCHMARK_FORMS) {
      const count = (l: Level) => f.sentences.filter((s) => s.level === l).length;
      expect([count(1), count(2), count(3)], `form ${f.id}`).toEqual([3, 4, 3]);
    }
  });

  it('total word counts are within ±8% of the mean', () => {
    const words = BENCHMARK_FORMS.map((f) => STATS.get(f.id)!.words);
    const mean = words.reduce((a, b) => a + b, 0) / words.length;
    for (const f of BENCHMARK_FORMS) {
      const w = STATS.get(f.id)!.words;
      expect(Math.abs(w - mean) / mean, `form ${f.id}: ${w} words vs mean ${mean.toFixed(1)}`).toBeLessThanOrEqual(0.08);
    }
  });

  it('decoder annotation totals are within ±10% of the mean', () => {
    const counts = BENCHMARK_FORMS.map((f) => STATS.get(f.id)!.annotations);
    const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
    for (const f of BENCHMARK_FORMS) {
      const n = STATS.get(f.id)!.annotations;
      expect(Math.abs(n - mean) / mean, `form ${f.id}: ${n} annotations vs mean ${mean.toFixed(1)}`).toBeLessThanOrEqual(0.1);
    }
  });

  it("at most 2 sentences per form hinge on an unreleased 'd (I'd / she'd …: barely audible before a consonant)", () => {
    for (const f of BENCHMARK_FORMS) {
      const n = f.sentences.filter((s) => /\w+'d/i.test(s.text)).length;
      expect(n, `form ${f.id}`).toBeLessThanOrEqual(2);
    }
  });

  it('every form covers at least 6 of the 8 phenomena (by decoder and by focus)', () => {
    for (const f of BENCHMARK_FORMS) {
      expect(STATS.get(f.id)!.phenomena.size, `form ${f.id} decoder`).toBeGreaterThanOrEqual(6);
      const focused = new Set(f.sentences.flatMap((s) => s.focus));
      expect(focused.size, `form ${f.id} focus`).toBeGreaterThanOrEqual(6);
      for (const p of focused) expect(PHENOMENA.includes(p)).toBe(true);
    }
  });

  it('level 3 sentences are longer on average than level 1 sentences', () => {
    for (const f of BENCHMARK_FORMS) {
      const avg = (l: Level) => {
        const xs = f.sentences.filter((s) => s.level === l).map((s) => wordCount(s.text));
        return xs.reduce((a, b) => a + b, 0) / xs.length;
      };
      expect(avg(3), `form ${f.id}`).toBeGreaterThan(avg(2));
      expect(avg(2), `form ${f.id}`).toBeGreaterThan(avg(1));
    }
  });
});

describe('BENCHMARK_FORMS focus tags are honest', () => {
  it('every sentence focus phenomenon is marked by decode()', () => {
    for (const s of allSentences) {
      const marked = typesIn(s.text);
      for (const p of s.focus) expect(marked.has(p), `${s.id} ${p}: "${s.text}"`).toBe(true);
    }
  });

  it('every passage focus phenomenon is marked by decode() somewhere in its lines', () => {
    for (const q of allQuestions) {
      const marked = new Set(q.lines.flatMap((l) => [...typesIn(l)]));
      for (const p of q.focus) expect(marked.has(p), `${q.id} ${p}`).toBe(true);
    }
  });
});

describe('BENCHMARK_FORMS never overlap other content', () => {
  const others = [
    ...englishStrings(SENTENCES.map((s) => s.text)),
    ...englishStrings(CHUNKS.map((c) => [c.written, c.example])),
    ...englishStrings(LESSONS),
    ...englishStrings(PAIR_SETS),
    ...englishStrings(EXAMPLES),
  ];
  const otherTokens = [...new Set(others)].map((t) => ({ text: t, toks: tokens(t) })).filter((o) => o.toks.length >= 3);

  it('collects a meaningful amount of other app content', () => {
    expect(otherTokens.length).toBeGreaterThan(500);
  });

  it('no sentence or passage line equals or nearly equals (≥80% shared words) any other app text', () => {
    const clashes: string[] = [];
    for (const line of benchmarkLines) {
      const mine = tokens(line.text);
      for (const o of otherTokens) {
        const ov = mine.join(' ') === o.toks.join(' ') ? 1 : overlap(mine, o.toks);
        if (ov >= 0.8) clashes.push(`${line.id} "${line.text}" ~ "${o.text}" (${Math.round(ov * 100)}%)`);
      }
    }
    expect(clashes).toEqual([]);
  });

  it('no duplicates or near-duplicates across forms', () => {
    const clashes: string[] = [];
    for (let i = 0; i < benchmarkLines.length; i++) {
      for (let j = i + 1; j < benchmarkLines.length; j++) {
        const a = benchmarkLines[i];
        const b = benchmarkLines[j];
        if (overlap(tokens(a.text), tokens(b.text)) >= 0.8) clashes.push(`${a.id} "${a.text}" ~ ${b.id} "${b.text}"`);
      }
    }
    expect(clashes).toEqual([]);
  });
});

describe('BENCHMARK_FORMS work with dictation scoring', () => {
  it('typing without apostrophes (phone keyboards) still scores 100% in the checkup scorer', () => {
    for (const s of allSentences) {
      const typed = s.text.replace(/['’]/g, '');
      expect(checkSentence(s, typed).pct, `${s.id}: "${typed}"`).toBe(100);
    }
  });

  it('accepts common split spellings of compounds (voice mail, down town, e-mail, alot)', () => {
    expect(align('It went straight to voicemail.', 'it went straight to voice mail').score).toBe(1);
    expect(align("What's the best way to get downtown?", 'whats the best way to get down town').score).toBe(1);
    expect(align('Did you get a chance to look at my email?', 'did you get a chance to look at my e-mail').score).toBe(1);
    expect(align("There's a lot of traffic on the bridge this morning.", 'theres alot of traffic on the bridge this morning').score).toBe(1);
  });

  it('each sentence aligned with itself (raw and normalized) scores 100%', () => {
    for (const s of allSentences) {
      const self = align(s.text, s.text);
      expect(self.score, s.id).toBe(1);
      expect(self.matched, s.id).toBe(self.total);
      const typed = normalizeText(s.text); // what a learner types: lowercase, no punctuation
      const r = align(s.text, typed);
      expect(r.score, `${s.id}: "${typed}"`).toBe(1);
      expect(r.typos, s.id).toBe(0);
    }
  });

  it('typing common reduced spellings still scores 100%', () => {
    const reduce = (t: string) =>
      t
        .replace(/\bgoing to\b/gi, 'gonna')
        .replace(/\bwant to\b/gi, 'wanna')
        .replace(/\bgot to\b/gi, 'gotta')
        .replace(/\bkind of\b/gi, 'kinda')
        .replace(/\blet me\b/gi, 'lemme')
        .replace(/\bgive me\b/gi, 'gimme');
    for (const s of allSentences) {
      const typed = reduce(s.text);
      if (typed === s.text) continue;
      expect(align(s.text, typed).score, `${s.id}: "${typed}"`).toBe(1);
    }
  });
});
