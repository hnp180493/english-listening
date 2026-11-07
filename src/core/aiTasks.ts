// AI learning tasks: prompt builders, JSON schemas, output validation/post-filters and a small result cache.
// Pure (no React, no fetch): features call aiJson() from src/core/ai with what these functions build, then
// run the matching sanitize/validate function on the answer. See docs/ai-providers.md (AI layer) and
// docs/progress-report.md §6 (honesty rules the coach must follow).
//
// Prompts are written in English for the model; every learner-facing string the model returns is Vietnamese.
// Nothing here ever sees an API key.

import type { JsonSchema } from './ai';
import { trendCheckups, type CheckupResult } from './benchmark';
import type { DiffUnit } from './dictation/diff';
import { PHENOMENON_INFO } from './phenomena';
import { pooledPhenomena, type ProgressReport } from './progressReport';
import { PHENOMENA, type Annotation, type Level, type Phenomenon } from './types';

/** The app's Vietnamese names of the phenomena ("Nối âm", …): the only names the model may use. */
export const PHENOMENON_VI: Readonly<Record<Phenomenon, string>> = Object.fromEntries(
  PHENOMENA.map((p) => [p, PHENOMENON_INFO[p]?.label ?? p]),
) as Record<Phenomenon, string>;

const clip = (s: unknown, max: number): string => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max).trim() : '');

// ───────────────────────── cache ─────────────────────────

/** sessionStorage prefix of cached AI answers (per tab, never synced or backed up: not under "nghe-noi-am:"). */
export const AI_CACHE_PREFIX = 'nghe-noi-am-aicache:';
const MEMORY_MAX = 60;
const memory = new Map<string, unknown>();

/** FNV-1a 32-bit, hex. Only used to shorten cache keys (the full key is stored next to the value). */
export function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Stable JSON (sorted object keys), so equal inputs always give the same cache key. */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(stableStringify).join(',') + ']';
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return '{' + Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => JSON.stringify(k) + ':' + stableStringify(o[k])).join(',') + '}';
  }
  return JSON.stringify(v ?? null);
}

/** Cache key of one task + its input (+ e.g. provider/model, day): "<task>:<hash>". */
export function aiCacheKey(task: string, input: unknown): string {
  return `${task}:${hashString(stableStringify(input))}`;
}

function session(): Storage | undefined {
  try {
    return (globalThis as { window?: { sessionStorage?: Storage } }).window?.sessionStorage;
  } catch {
    return undefined;
  }
}

/** Cached answer for `key` (memory first, then sessionStorage), or undefined. `full` guards against hash collisions. */
export function aiCacheGet<T>(key: string, full?: string): T | undefined {
  const m = memory.get(key) as { full?: string; value: T } | undefined;
  if (m && (full === undefined || m.full === full)) return m.value;
  try {
    const raw = session()?.getItem(AI_CACHE_PREFIX + key);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { full?: string; value: T };
    if (full !== undefined && parsed.full !== full) return undefined;
    remember(key, parsed);
    return parsed.value;
  } catch {
    return undefined;
  }
}

function remember(key: string, entry: unknown): void {
  memory.delete(key);
  memory.set(key, entry);
  while (memory.size > MEMORY_MAX) memory.delete(memory.keys().next().value as string);
}

export function aiCacheSet<T>(key: string, value: T, full?: string): void {
  const entry = { full, value };
  remember(key, entry);
  try {
    session()?.setItem(AI_CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // storage full / blocked: the memory copy still saves a second bill in this page
  }
}

/** Test hook / "Xóa dữ liệu": forget every cached answer. */
export function clearAiTaskCache(): void {
  memory.clear();
  const s = session();
  if (!s) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k?.startsWith(AI_CACHE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => s.removeItem(k));
  } catch {
    // ignore
  }
}

/** One prompt ready for aiJson(). */
export interface TaskPrompt {
  system: string;
  user: string;
  schema: JsonSchema;
  name: string;
  maxTokens: number;
}

// ───────────────────────── 1. "Hỏi AI vì sao nghe sai" ─────────────────────────

export interface ExplainMistake {
  expected: string; // the written word(s)
  typed: string; // what the learner typed there ('' = left out)
  /** The spoken chunk (decoder segment) the mistake sits in, when it sounds different from how it is written. */
  chunk?: { written: string; spoken: string };
  /** Accepted by the checker as a typo, but it is a different word (bought → brought): explained briefly. */
  minor?: boolean;
}

export interface ExplainAnnotation {
  type: Phenomenon;
  name: string; // Vietnamese name, e.g. "Nối âm"
  original: string;
  spoken: string;
  /** Touches a word the learner got wrong. */
  missed: boolean;
}

export interface ExplainInput {
  text: string;
  typed: string;
  mistakes: ExplainMistake[];
  annotations: ExplainAnnotation[];
  /** The whole sentence as it sounds (decoder spokenText), when known. */
  spokenText?: string;
}

/** What explainInputFrom needs from the decoder besides the annotations (DecodeResult fits). */
export interface ExplainDecoded {
  segments: readonly { from: number; to: number; written: string; spoken: string }[];
  spokenText: string;
}

const MAX_MISTAKES = 12;
/** Annotations that do not touch a mistake are context only: a couple at most (they mostly distract). */
const MAX_OTHER_ANNOTATIONS = 2;

/** "in." → "in" (keeps inner apostrophes: "don't"). */
const bare = (w: string) => w.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '');
const MAX_ANNOTATIONS = 12;

/** Consonant skeleton of a word, doubled letters collapsed: "tomorow" and "tomorrow" → "tmrw"; "bought" → "bght". */
function consonants(w: string): string {
  return w
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/[aeiouy]/g, '')
    .replace(/(.)\1+/g, '$1');
}

/**
 * A typo the checker accepted that is really another word (bought → brought, their → there is the same
 * skeleton and stays a typo): its consonants differ. Real misspellings ("tomorow", "recieve") keep them.
 */
export function typoIsOtherWord(target: string, answer: string): boolean {
  const a = consonants(bare(target));
  const b = consonants(bare(answer));
  return !!a && !!b && a !== b;
}

const norm = (s: string) => s.replace(/[‘’ʼ`]/g, "'").toLowerCase();

/**
 * Builds the explain payload from what the result screens already have: the sentence, what was typed, the diff
 * units (wrong / missing words per written token) and the decoder annotations (token ranges in the same index
 * space as the diff's targetIndex). Typos count as right (the app accepts them too), except a typo that is
 * really another word, which is listed as a minor mistake. With `decoded` (the DecodeResult) each mistake
 * carries the spoken chunk it sits in, and the prompt gets the whole sentence as it sounds.
 */
export function explainInputFrom(
  text: string,
  typed: string,
  units: readonly DiffUnit[],
  annotations: readonly Annotation[],
  decoded?: ExplainDecoded | null,
): ExplainInput {
  const bad = new Set<number>();
  const merged: (ExplainMistake & { from: number; to: number })[] = [];
  let lastMissing = -2; // target index of the previous left-out word
  for (const u of units) {
    if (u.kind === 'wrong') {
      bad.add(u.targetIndex);
      merged.push({ expected: bare(u.target), typed: u.answer, from: u.targetIndex, to: u.targetIndex });
      lastMissing = -2;
    } else if (u.kind === 'missing') {
      bad.add(u.targetIndex);
      // adjacent left-out words read better as one mistake ("going to" left out)
      const last = merged[merged.length - 1];
      if (last && lastMissing === u.targetIndex - 1) {
        last.expected += ' ' + bare(u.target);
        last.to = u.targetIndex;
      } else merged.push({ expected: bare(u.target), typed: '', from: u.targetIndex, to: u.targetIndex });
      lastMissing = u.targetIndex;
    } else if (u.kind === 'typo' && typoIsOtherWord(u.target, u.answer)) {
      merged.push({ expected: bare(u.target), typed: u.answer, minor: true, from: u.targetIndex, to: u.targetIndex });
      lastMissing = -2;
    } else if (u.kind !== 'extra') {
      lastMissing = -2;
    }
  }
  const anns: ExplainAnnotation[] = annotations
    .filter((a) => PHENOMENON_VI[a.type])
    .map((a) => {
      let missed = false;
      for (let i = a.from; i <= a.to; i++) if (bad.has(i)) missed = true;
      return { type: a.type, name: PHENOMENON_VI[a.type], original: clip(a.original, 80), spoken: clip(a.spoken, 80), missed };
    });
  // A contraction the learner missed ("I" for "I'm") is a plain fact even where the decoder has no
  // annotation for it (it does not mark "I'm"): add one, so the model may say Viết tắt without "(đoán)".
  for (const m of merged) {
    if (m.minor || !m.expected.includes("'")) continue;
    if (m.typed && norm(m.typed).includes("'")) continue;
    const covered = annotations.some((a) => a.type === 'contraction' && a.from <= m.to && a.to >= m.from);
    if (covered) continue;
    const word = m.expected.split(' ').find((w) => w.includes("'")) ?? m.expected;
    anns.push({ type: 'contraction', name: PHENOMENON_VI.contraction, original: clip(word, 80), spoken: clip(word, 80), missed: true });
  }
  // missed spots first (they are what the explanation is about), then at most a couple of others
  const missedAnns = anns.filter((a) => a.missed);
  const others = anns.filter((a) => !a.missed).slice(0, MAX_OTHER_ANNOTATIONS);
  const segments = decoded?.segments ?? [];
  const mistakes: ExplainMistake[] = merged.slice(0, MAX_MISTAKES).map((m) => {
    const out: ExplainMistake = { expected: clip(m.expected, 80), typed: clip(m.typed, 80) };
    if (m.minor) out.minor = true;
    const seg = segments.find((s) => s.from <= m.from && s.to >= m.from);
    if (seg && seg.spoken && seg.spoken.toLowerCase() !== bare(seg.written).toLowerCase()) {
      out.chunk = { written: clip(seg.written, 80), spoken: clip(seg.spoken, 80) };
    }
    return out;
  });
  const input: ExplainInput = {
    text: clip(text, 400),
    typed: clip(typed, 400),
    mistakes,
    annotations: [...missedAnns, ...others].slice(0, MAX_ANNOTATIONS),
  };
  const spoken = clip(decoded?.spokenText, 400);
  if (spoken) input.spokenText = spoken;
  return input;
}

export interface ExplainPoint {
  heard: string;
  actual: string;
  why: string;
  tip: string;
}

export interface Explanation {
  summary: string;
  points: ExplainPoint[];
}

export const EXPLAIN_MAX_POINTS = 4;

// `points` comes before `summary`: models write keys in schema order, so the summary is written after the points.
export const EXPLAIN_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    points: {
      type: 'array',
      minItems: 1,
      maxItems: EXPLAIN_MAX_POINTS,
      items: {
        type: 'object',
        properties: {
          heard: { type: 'string', description: 'What the learner typed at this spot, verbatim ("" if they left it out).' },
          actual: { type: 'string', description: 'The written words at this spot.' },
          why: { type: 'string', description: 'Vietnamese, at most 2 sentences. Phenomenon names in « » exactly as listed.' },
          tip: { type: 'string', description: 'Vietnamese, one short concrete listening tip.' },
        },
        required: ['heard', 'actual', 'why', 'tip'],
      },
    },
    summary: { type: 'string', description: 'One short Vietnamese sentence summing up the points above.' },
  },
  required: ['points', 'summary'],
};

const NAMES_LIST = PHENOMENA.map((p) => `«${PHENOMENON_VI[p]}» (${p})`).join(', ');

export const EXPLAIN_SYSTEM = [
  'You are a patient Vietnamese teacher of English listening. Your student is Vietnamese and is learning to hear connected American English speech.',
  'The student listened to one English sentence and typed what they heard. You get the sentence, how the whole sentence sounds, what they typed, the words the checker marked wrong (with the spoken chunk each one sits in), and the connected-speech annotations found by the app\'s decoder (type, written words, how it sounds).',
  'The student ALREADY SEES the decoder\'s rule cards for these annotations right above your answer. Do not just restate them. Add what they do not say: how the sounds of the chunk run together so that it led to exactly what the student typed, mis-heard words that are not a connected-speech event, and one concrete thing to listen for.',
  'Only the words in Mistakes were marked wrong. Everything else the student typed was accepted, including typos and informal spellings like gonna/wanna/bout: never correct or comment on them. One point per mistake (the most important first), nothing else.',
  'Mistakes marked "accepted as a typo" were graded right but are a different word: explain them in one short sentence.',
  `Phenomenon names: write them inside « » exactly as in this list, and use « » for nothing else: ${NAMES_LIST}.`,
  'Only name a phenomenon that is in the annotations. If you believe a phenomenon is involved that the annotations do not show, you may say so ONLY as a guess, written as «Name» (đoán).',
  'If a mistake is not caused by connected speech (vocabulary, spelling, grammar), say so plainly instead of inventing a phenomenon.',
  'To show how something sounds, quote the chunk respelling given for the mistake ("sounds like"), or an annotation\'s "spoken" respelling, exactly (the app\'s convention: lowercase syllables joined by hyphens, "ə" for the weak vowel, e.g. "tur-ni-dof-fi-nə", "wan-chu"); you may write the stressed syllable in CAPITALS. Never invent respellings or IPA.',
  'Write every field in natural, concise Vietnamese (the English words themselves stay in English). No greetings, no praise padding, no markdown.',
  `points: 1 to ${EXPLAIN_MAX_POINTS} items; "why" at most 2 short sentences; "tip" one short, concrete thing to listen for. summary: ONE Vietnamese sentence summing up the points.`,
].join('\n');

export function buildExplainPrompt(input: ExplainInput): TaskPrompt {
  const lines: string[] = [];
  lines.push(`Sentence (what was said): "${input.text}"`);
  if (input.spokenText) lines.push(`How the whole sentence sounds (app respelling): "${input.spokenText}"`);
  lines.push(`Student typed: "${input.typed || '(nothing)'}"`);
  lines.push('Mistakes (written word → what the student typed | the spoken chunk it sits in):');
  if (input.mistakes.length) {
    for (const m of input.mistakes) {
      let line = `- "${m.expected}" → ${m.typed ? `"${m.typed}"` : '(left out)'}`;
      if (m.minor) line += ' (accepted as a typo, but it is a different word)';
      if (m.chunk) line += ` | sounds like: "${m.chunk.spoken}" ("${m.chunk.written}")`;
      lines.push(line);
    }
  } else lines.push('- (none found by the checker)');
  lines.push('Decoder annotations (name | written | sounds like | touches a mistake):');
  if (input.annotations.length) {
    for (const a of input.annotations) lines.push(`- ${a.name} | "${a.original}" | "${a.spoken}" | ${a.missed ? 'yes' : 'no'}`);
  } else lines.push('- (none: the decoder found no connected-speech event)');
  lines.push('Reply with JSON only.');
  return { system: EXPLAIN_SYSTEM, user: lines.join('\n'), schema: EXPLAIN_SCHEMA, name: 'listening_explanation', maxTokens: 1400 };
}

/** Name as cited: "T bật (giọng Mỹ)" may be cited as just "T bật". */
const shortName = (p: Phenomenon) => PHENOMENON_VI[p].replace(/\s*\(.*\)\s*$/, '');
const reEsc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Names that can be matched without « »: they are never ordinary words. "Rút gọn" / "Viết tắt" ("dạng rút gọn
 * của", "viết tắt") and "Âm yếu" (inside "nguyên âm yếu") are everyday Vietnamese, so only «…» counts for them.
 */
const PLAIN_MATCH: ReadonlySet<Phenomenon> = new Set<Phenomenon>(['linking', 'elision', 'assimilation', 'flap-t', 'h-dropping']);

function nameRe(p: Phenomenon, plain: boolean): RegExp {
  const n = reEsc(shortName(p));
  const full = reEsc(PHENOMENON_VI[p]);
  return plain ? new RegExp(`«\\s*(?:${full}|${n})\\s*»|(?<![\\p{L}])(?:${full}|${n})(?![\\p{L}])`, 'giu') : new RegExp(`«\\s*(?:${full}|${n})\\s*»`, 'giu');
}

/** Phenomena (by key) named in `s`: «Name» always counts; a bare name only when it is never an ordinary word. */
export function phenomenaNamedIn(s: string): Phenomenon[] {
  return PHENOMENA.filter((p) => nameRe(p, PLAIN_MATCH.has(p)).test(s));
}

/** "(đoán)" right after the name (or its « »). */
const GUESS_AFTER = /^\s*»?\s*\(\s*đoán\s*\)/iu;

/** A negation right before the name ("không phải nối âm", "chẳng phải do «Nuốt âm»"): the model is ruling it out. */
const NEGATED_BEFORE = /(?:không|chẳng|chứ không)\s+(?:phải\s+)?(?:là\s+)?(?:do\s+)?(?:hiện tượng\s+)?«?\s*$/iu;

/**
 * Marks each unsupported phenomenon name in `s` as a guess, right after the name ("«Nuốt âm» (đoán)"), unless
 * it already is, or the name is negated ("Đây không phải nối âm" rules it out, so no "(đoán)"). A hedge elsewhere
 * in the sentence ("khó đoán", "có lẽ") does not count.
 */
export function markGuesses(s: string, known: ReadonlySet<Phenomenon>): string {
  let out = s;
  for (const p of PHENOMENA) {
    if (known.has(p)) continue;
    const re = nameRe(p, PLAIN_MATCH.has(p));
    out = out.replace(re, (m: string, offset: number, whole: string) => {
      const rest = whole.slice(offset + m.length);
      const before = whole.slice(Math.max(0, offset - 40), offset);
      return GUESS_AFTER.test(rest) || NEGATED_BEFORE.test(before) ? m : `${m} (đoán)`;
    });
  }
  return out;
}

/** Display form: «Nối âm» → Nối âm (the marks are for checking, not for the learner). */
export function stripNameMarks(s: string): string {
  return s.replace(/«\s*([^«»]{1,40}?)\s*»/g, '$1');
}

/**
 * Cleans an explanation from the model: trims and caps fields, drops empty points, keeps at most
 * EXPLAIN_MAX_POINTS, and marks as a guess every phenomenon name the decoder did not annotate (so the app never
 * states an unsupported phenomenon as fact). Returns null when nothing usable is left.
 */
export function sanitizeExplanation(raw: unknown, input: ExplainInput): Explanation | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { summary?: unknown; points?: unknown };
  const known = new Set(input.annotations.map((a) => a.type));
  const clean = (s: string) => stripNameMarks(markGuesses(s, known));
  const points: ExplainPoint[] = [];
  for (const item of Array.isArray(r.points) ? r.points : []) {
    if (!item || typeof item !== 'object') continue;
    const p = item as Record<string, unknown>;
    const why = clip(p.why, 400);
    const tip = clip(p.tip, 240);
    if (!why && !tip) continue;
    points.push({ heard: clip(p.heard, 120), actual: clip(p.actual, 120), why: clean(why), tip: clean(tip) });
    if (points.length >= EXPLAIN_MAX_POINTS) break;
  }
  const summary = clean(clip(r.summary, 300));
  if (!summary && !points.length) return null;
  return { summary, points };
}

// ───────────────────────── 2. "Tạo câu luyện bằng AI" ─────────────────────────

export type GenCount = 5 | 10;

export interface GenerateRequest {
  phenomenon: Phenomenon;
  topic: string; // optional free text ('' = any everyday topic)
  level: Level;
  count: GenCount;
}

export interface GeneratedItem {
  text: string;
  vi: string;
}

export const GEN_MIN_WORDS = 5;
export const GEN_MAX_WORDS = 18;
/** Extra sentences asked for, so a few dropped ones still leave `count`. */
export const GEN_EXTRA = 3;
export const MAX_TOPIC_CHARS = 60;

/** Topic chips under the free-text field (Vietnamese labels, sent as-is: the model understands them). */
export const TOPIC_CHIPS: readonly string[] = ['Công việc', 'Bạn bè', 'Ăn uống', 'Đi lại', 'Mua sắm', 'Ở nhà'];

/**
 * What each phenomenon looks like in WRITTEN English, so the model writes sentences the decoder will mark.
 * Every example is checked against the decoder in aiTasks.test.ts (hint and decoder must not drift apart).
 */
export const PHENOMENON_HINT: Readonly<Record<Phenomenon, { desc: string; examples: readonly string[]; avoid?: string }>> = {
  linking: {
    desc: 'a word ending in a consonant sound followed by a word starting with a vowel sound (not just before "a"/"the")',
    examples: ['turn it on', 'hold on a second', 'an hour', 'think about it'],
  },
  elision: {
    desc: 'a t or d sound dropped between consonants',
    examples: ['next day', 'last night', 'just go', 'must be', 'old man'],
  },
  assimilation: {
    desc: 'a final t/d/s/z sound right before "you", "your" or "year", or n right before b/p/m',
    examples: ['meet you', 'need you', 'miss you', 'got your', 'this year', 'ten boys', 'in bed'],
    avoid: 'Do NOT use "did you", "would you", "could you", "don\'t you" or "bet you": the app counts those as reduction, not assimilation.',
  },
  'weak-form': {
    desc: 'unstressed function words said with a weak vowel: to, for, of, and, can, at, from, them, was, some, are (articles a/the alone do not count)',
    examples: ['a cup of tea', 'time to go', 'I can help', 'look at them'],
  },
  'flap-t': {
    desc: 'a t or tt between vowel sounds in American English, inside a word or across words',
    examples: ['water', 'better', 'get it', 'what about', 'put it on'],
  },
  reduction: {
    desc: 'common reducible phrases written in FULL standard spelling',
    examples: ['going to eat', 'want to go', 'have to go', 'kind of', 'out of', 'let me', 'give me', "don't know", 'did you', 'would you'],
  },
  'h-dropping': {
    desc: 'a weak he/him/his/her/have/had after another word in the middle of the sentence',
    examples: ['tell him', 'ask her', 'give her', 'did he go', 'should have known'],
  },
  contraction: {
    desc: 'apostrophe contractions',
    examples: ["you're", "he's", "we'll", "they'd", "can't", "won't", "should've", "it'll"],
    avoid: 'The app does not count "I\'m" on its own: every sentence needs one of the other contractions.',
  },
};

/** Words per sentence for each level (inside GEN_MIN_WORDS–GEN_MAX_WORDS). */
export const LEVEL_WORDS: Readonly<Record<Level, readonly [number, number]>> = { 1: [6, 8], 2: [8, 12], 3: [12, 18] };

const LEVEL_HINT: Record<Level, string> = {
  1: 'easy: very common words, one clear spot of the target phenomenon',
  2: 'medium: everyday conversation, the target phenomenon plus maybe one other connected-speech spot',
  3: 'hard: fast natural conversation, several connected-speech spots including the target phenomenon',
};

/** Output tokens per requested sentence (English + Vietnamese + JSON) by level, plus headroom. */
const TOKENS_PER_ITEM: Record<Level, number> = { 1: 70, 2: 90, 3: 120 };
const TOKENS_HEADROOM = 600;

/** Free-text topic as sent to the model: printable, one line, capped. */
export function cleanTopic(s: unknown): string {
  if (typeof s !== 'string') return '';
  let printable = '';
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    printable += code < 32 || code === 127 || '<>{}`"'.includes(ch) ? ' ' : ch;
  }
  return printable.replace(/\s+/g, ' ').trim().slice(0, MAX_TOPIC_CHARS).trim();
}

export function genSchema(count: GenCount): JsonSchema {
  return {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        minItems: 1,
        maxItems: count + GEN_EXTRA,
        items: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'The English sentence, standard spelling.' },
            vi: { type: 'string', description: 'Natural Vietnamese translation.' },
          },
          required: ['text', 'vi'],
        },
      },
    },
    required: ['items'],
  };
}

export const GENERATE_SYSTEM = [
  'You write short, natural American English sentences for a Vietnamese learner who practises dictation (listen, then type what they hear).',
  'Rules for EVERY sentence:',
  '- Exactly the number of words asked for in the request (count every word; a contraction like "you\'re" counts as one word). Sentences shorter than 5 words are rejected.',
  '- Something people really say in everyday conversation.',
  '- Standard written spelling only: write "going to", never "gonna"; "want to", never "wanna"; no respelling, no slang spellings, no dropped letters with apostrophes ("goin\'", "\'em", "\'cause").',
  '- No digits (write numbers as words, and prefer sentences without numbers), no names of real people or brands, no rare words, no abbreviations.',
  '- It must clearly contain the target connected-speech phenomenon in its written words. The example phrases only show the pattern: do not use those exact phrases.',
  '- All sentences different from each other and from the listed existing sentences, in wording and structure.',
  'For each sentence also give a natural Vietnamese translation ("vi"), written in Vietnamese with diacritics.',
  'Reply with JSON only.',
].join('\n');

/** How many earlier sentences go into the "do not repeat" list. */
export const MAX_AVOID = 16;

export function buildGeneratePrompt(req: GenerateRequest, avoid: readonly string[] = []): TaskPrompt {
  const topic = cleanTopic(req.topic);
  const n = req.count + GEN_EXTRA;
  const hint = PHENOMENON_HINT[req.phenomenon];
  const [lo, hi] = LEVEL_WORDS[req.level];
  const lines = [
    `Write ${n} sentences.`,
    `Target phenomenon: ${req.phenomenon} — ${hint.desc}. Pattern examples: ${hint.examples.map((e) => `"${e}"`).join(', ')}.`,
  ];
  if (hint.avoid) lines.push(hint.avoid);
  lines.push(
    `Level: ${LEVEL_HINT[req.level]}.`,
    `Each sentence MUST have between ${lo} and ${hi} words.`,
    `Topic: ${topic ? `"${topic}" (the topic may be written in Vietnamese; the sentences are in English)` : 'any everyday situation (vary it)'}.`,
  );
  const seen = new Set<string>();
  const sample = avoid.filter((s) => {
    const k = genDedupeKey(s);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (sample.length) lines.push('Do not repeat these existing sentences:\n' + sample.slice(0, MAX_AVOID).map((s) => `- ${clip(s, 160)}`).join('\n'));
  return {
    system: GENERATE_SYSTEM,
    user: lines.join('\n'),
    schema: genSchema(req.count),
    name: 'practice_sentences',
    maxTokens: TOKENS_HEADROOM + n * TOKENS_PER_ITEM[req.level],
  };
}

/**
 * The "do not repeat" list: the learner's latest own sentences, a few built-in sentences that practise the same
 * phenomenon at the same level (the model would otherwise echo them, and they are rejected as duplicates), and
 * the previous batch on "Tạo lại" (so it does not come back with the same sentences).
 */
export function generateAvoidList(
  req: Pick<GenerateRequest, 'phenomenon' | 'level'>,
  own: readonly string[],
  builtIn: readonly { text: string; level: Level; focus: readonly Phenomenon[] }[],
  previous: readonly string[] = [],
): string[] {
  const same = builtIn.filter((s) => s.level === req.level && s.focus.includes(req.phenomenon)).slice(0, 6).map((s) => s.text);
  return [...previous.slice(0, 8), ...own.slice(-6), ...same];
}

export type DropReason = 'empty' | 'length' | 'digits' | 'spelling' | 'not-english' | 'duplicate' | 'no-phenomenon';

/** Informal respellings a dictation sentence must not contain (they are what the learner should hear, not read). */
const INFORMAL = new Set([
  'gonna', 'wanna', 'gotta', 'kinda', 'sorta', 'lemme', 'gimme', 'dunno', 'outta', 'lotta', 'coulda', 'shoulda',
  'woulda', 'musta', 'hafta', 'oughta', 'whatcha', 'gotcha', 'betcha', 'dontcha', 'didja', 'wouldja', 'ya', 'cuz', 'cos', 'tryna', 'ain\'t', 'innit', 'em', 'y\'know', 'c\'mon', 'gon', 'finna',
]);

const WORD_RE = /^[A-Za-z]+(?:'[A-Za-z]+)*$/;

/** Words as written, edge punctuation removed, curly apostrophes normalised. */
function wordsOf(text: string): string[] {
  return text
    .replace(/[‘’ʼ`]/g, "'")
    .split(/\s+/)
    .map((w) => w.replace(/^[^A-Za-z0-9']+|[^A-Za-z0-9']+$/g, ''))
    .filter(Boolean);
}

/** Why `text` is not a standard-spelling English sentence, or null when it is. */
export function spellingProblem(text: string): 'not-english' | 'spelling' | null {
  if (/[^\x20-\x7e‘’“”—–]/.test(text)) return 'not-english';
  for (const raw of wordsOf(text)) {
    // "well-known" is fine; respelling ("tur-ni-doff", "wan-CHU") is not: every hyphen part must be a plain word
    const parts = raw.split('-').filter(Boolean);
    for (const w of parts) {
      if (!WORD_RE.test(w)) return 'spelling';
      if (INFORMAL.has(w.toLowerCase())) return 'spelling';
      if (raw.includes('-') && w.length > 1 && w === w.toUpperCase()) return 'spelling';
    }
    if (raw.startsWith("'") || raw.endsWith("'")) return 'spelling';
  }
  if (/\s'[a-z]/i.test(' ' + text.replace(/[‘’ʼ`]/g, "'"))) return 'spelling'; // "'em", "'cause"
  return null;
}

/** Duplicate key (same as the custom list's: lowercase, letters/digits/apostrophes). */
export function genDedupeKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/[^\p{L}\p{N}' ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A usable Vietnamese translation, or '' (empty, a copy of the English, or no Vietnamese letters at all). */
export function cleanVi(vi: unknown, text: string): string {
  const v = clip(vi, 300);
  if (!v) return '';
  if (genDedupeKey(v) === genDedupeKey(text)) return '';
  if (!/[à-ỹđ]/i.test(v)) return '';
  return v;
}

const ARTICLES = new Set(['a', 'an', 'the']);
const lastWord = (s: string) => (s.toLowerCase().match(/[a-z']+/g) ?? []).at(-1) ?? '';

/**
 * Annotations of the target phenomenon that make it a real focus of the sentence. Weak forms of a/an/the and
 * linking into a/an/the are in nearly every sentence, so they do not count for those two phenomena.
 */
export function focusCount(phenomenon: Phenomenon, annotations: readonly Pick<Annotation, 'type' | 'original'>[]): number {
  return annotations.filter((a) => {
    if (a.type !== phenomenon) return false;
    if (phenomenon === 'weak-form') return !ARTICLES.has(a.original.trim().toLowerCase());
    if (phenomenon === 'linking') return !ARTICLES.has(lastWord(a.original));
    return true;
  }).length;
}

export interface GenValidation {
  ok: GeneratedItem[];
  dropped: { text: string; reason: DropReason }[];
}

/**
 * Keeps the generated sentences that are usable for dictation: GEN_MIN_WORDS–GEN_MAX_WORDS words, standard
 * spelling, no digits, not a duplicate of `existing` (custom + built-in sentences) or of an earlier item, and the
 * decoder (`annotate`) finds the requested phenomenon as a real focus (focusCount). Sentences inside the level's
 * word range (`level`) come first, then the ones with more spots of the phenomenon. At most `max` are kept (the
 * rest are surplus, not "dropped"). A missing or non-Vietnamese translation is blanked, not a reason to drop.
 */
export function validateGenerated(
  raw: unknown,
  opts: {
    phenomenon: Phenomenon;
    existing: Iterable<string>;
    annotate: (text: string) => readonly Pick<Annotation, 'type' | 'original'>[];
    max: number;
    level?: Level;
  },
): GenValidation {
  const items = raw && typeof raw === 'object' && Array.isArray((raw as { items?: unknown }).items) ? (raw as { items: unknown[] }).items : [];
  const seen = new Set<string>();
  for (const t of opts.existing) seen.add(genDedupeKey(t));
  const good: { item: GeneratedItem; inLevel: boolean; focus: number; order: number }[] = [];
  const dropped: GenValidation['dropped'] = [];
  const range = opts.level ? LEVEL_WORDS[opts.level] : null;
  for (const it of items) {
    const r = it && typeof it === 'object' ? (it as Record<string, unknown>) : {};
    const text = clip(r.text, 300).replace(/[“”]/g, '"');
    const drop = (reason: DropReason) => dropped.push({ text, reason });
    if (!text) {
      drop('empty');
      continue;
    }
    if (/\d/.test(text)) {
      drop('digits');
      continue;
    }
    const sp = spellingProblem(text);
    if (sp) {
      drop(sp);
      continue;
    }
    const n = wordsOf(text).length;
    if (n < GEN_MIN_WORDS || n > GEN_MAX_WORDS) {
      drop('length');
      continue;
    }
    const key = genDedupeKey(text);
    if (seen.has(key)) {
      drop('duplicate');
      continue;
    }
    let focus = 0;
    try {
      focus = focusCount(opts.phenomenon, opts.annotate(text));
    } catch {
      focus = 0;
    }
    if (focus === 0) {
      drop('no-phenomenon');
      continue;
    }
    seen.add(key);
    good.push({ item: { text, vi: cleanVi(r.vi, text) }, inLevel: !range || (n >= range[0] && n <= range[1]), focus, order: good.length });
  }
  good.sort((a, b) => Number(b.inLevel) - Number(a.inLevel) || b.focus - a.focus || a.order - b.order);
  return { ok: good.slice(0, opts.max).map((g) => g.item), dropped };
}

/** "Chỉ giữ được 4 câu đạt yêu cầu." when fewer than `requested` sentences are left ('' otherwise). */
export function dropSummaryVi(kept: number, requested: number): string {
  if (kept >= requested) return '';
  return kept > 0 ? `Chỉ giữ được ${kept} câu đạt yêu cầu.` : '';
}

const REASON_EN: Record<DropReason, string> = {
  empty: 'empty',
  length: `not ${GEN_MIN_WORDS}-${GEN_MAX_WORDS} words`,
  digits: 'contained digits',
  spelling: 'non-standard spelling',
  'not-english': 'not plain English',
  duplicate: 'repeated an existing sentence',
  'no-phenomenon': 'did not contain the target phenomenon',
};

/**
 * For aiJson's `validate` (one repair round): when fewer than `count` sentences survive validation, an English
 * description of what was rejected and why (with one example each), so the model can fix it; null when enough.
 */
export function generateRepairProblem(v: GenValidation, count: number, req: Pick<GenerateRequest, 'phenomenon' | 'level'>): string | null {
  if (v.ok.length >= count) return null;
  const by = new Map<DropReason, string[]>();
  for (const d of v.dropped) by.set(d.reason, [...(by.get(d.reason) ?? []), d.text]);
  const parts = [...by.entries()].map(([r, texts]) => `${texts.length} ${REASON_EN[r]} (e.g. "${clip(texts[0], 80)}")`);
  const [lo, hi] = LEVEL_WORDS[req.level];
  return (
    `Only ${v.ok.length} of the sentences were usable; ${parts.join('; ') || 'too few sentences'}. ` +
    `Write a full new list: every sentence ${lo}-${hi} words, clearly containing ${req.phenomenon}.`
  );
}

// ───────────────────────── 3. "Nhận xét bằng AI" (báo cáo) ─────────────────────────

/** Aggregate numbers only: never a log title, note or anything the learner typed. */
export interface CoachInput {
  period: ProgressReport['period'];
  periodLabel: string; // "Từ 19/10" (dates only)
  /** The rule-based "Nhận xét" lines shown right above the AI comment (built by the app from the same data). */
  alreadyShown: string[];
  listening: {
    minutesInPeriod: number;
    minutesAllTime: number;
    unit: 'week' | 'month';
    /** Oldest first. `partial`: the running week/month (only `elapsedDays` of it so far). */
    perBucket: { minutes: number; days: number; goalDays: number; elapsedDays: number; partial: boolean }[];
    goalMinutesPerDay: number;
    changeVsPreviousPct: number | null; // null = not enough base
    listeningDays: number;
    activeDays: number;
  };
  checkups: {
    count: number; // all time
    countInTrend: number; // all time, quick retakes left out
    testsBeforePeriod: number;
    retakes: number;
    /** Every trend test's score, oldest first (the report compares the mean of the first two with the last two). */
    trendScores: number[];
    /** Tests inside the period, oldest first. */
    scoresInPeriod: { score: number; dictationPct: number; comprehensionPct: number; repeatForm: boolean }[];
    firstScore: number | null;
    latestScore: number | null;
    /** Caveats the report states about these scores (Vietnamese, from the app). */
    caveats: string[];
    latestMisses: { phenomenon: string; missed: number; seen: number }[]; // latest test, sentences missed / seen
    /** Pooled like the report: first half vs second half of the trend tests. */
    phenomenonChanges: { phenomenon: string; earlyTests: string; recentTests: string; lowSample: boolean }[];
  };
  practice: {
    attempts: number;
    accuracyPct: number | null;
    modules: { module: string; attempts: number; accuracyPct: number }[];
    reviewRetentionPct: number | null;
    reviewGrades: number;
    lessonsPassed: number;
  };
  selfRated: {
    entries: number;
    average: number | null; // 1..5
    weekly: (number | null)[];
  };
}

/** Minimum sentences per side for a pooled phenomenon change to count (as in the report). */
const COACH_MIN_PH_SENTENCES = 5;

/**
 * Coach payload from the built report (+ the latest checkup's per-phenomenon misses, + all checkups for the
 * trend the report itself uses). Only numbers, the app's own labels and the report's own sentences go in:
 * listening titles, notes and typed answers are never read here.
 */
export function buildCoachInput(
  report: ProgressReport,
  latestByPhenomenon?: Partial<Record<Phenomenon, { seen: number; missed: number }>> | null,
  checkups?: readonly CheckupResult[] | null,
): CoachInput {
  const o = report.overview;
  const c = report.checkups;
  const p = report.practice;
  const u = report.understood;
  const latestMisses = PHENOMENA.flatMap((ph) => {
    const v = latestByPhenomenon?.[ph];
    if (!v || !(v.seen > 0)) return [];
    return [{ phenomenon: PHENOMENON_VI[ph], missed: Math.max(0, Math.min(v.seen, Math.floor(v.missed))), seen: Math.floor(v.seen) }];
  });
  const all = checkups ?? [];
  const trend = trendCheckups(all);
  const pooled = pooledPhenomena(all).filter((r) => r.early.seen > 0 || r.late.seen > 0);
  const caveats = [c.deltaHedge, c.formNote, c.voiceNote, c.staleNote, c.baselineNote].filter((x): x is string => !!x).map((x) => clip(x, 200));
  return {
    period: report.period,
    periodLabel: o.periodLabel,
    alreadyShown: report.insights.map((s) => clip(s, 400)),
    listening: {
      minutesInPeriod: Math.round(o.listenMinutes),
      minutesAllTime: Math.round(o.totalMinutes),
      unit: report.listening.unit,
      perBucket: report.listening.weeks.map((w) => ({
        minutes: Math.round(w.minutes),
        days: w.days,
        goalDays: w.goalDays,
        elapsedDays: w.elapsedDays,
        partial: !!w.isCurrent,
      })),
      goalMinutesPerDay: report.listening.goalPerDay,
      changeVsPreviousPct: o.changePct,
      listeningDays: o.listeningDays,
      activeDays: o.activeDays,
    },
    checkups: {
      count: c.count,
      countInTrend: c.trendCount,
      testsBeforePeriod: c.earlier,
      retakes: c.retakes,
      trendScores: trend.map((t) => t.score),
      scoresInPeriod: c.points.map((pt) => ({ score: pt.score, dictationPct: pt.dictationPct, comprehensionPct: pt.comprehensionPct, repeatForm: pt.repeatForm })),
      firstScore: c.firstScore,
      latestScore: c.latestScore,
      caveats,
      latestMisses,
      phenomenonChanges: pooled.map((r) => ({
        phenomenon: r.label,
        earlyTests: `missed ${r.early.missed}/${r.early.seen} sentences`,
        recentTests: `missed ${r.late.missed}/${r.late.seen} sentences`,
        lowSample: r.early.seen < COACH_MIN_PH_SENTENCES || r.late.seen < COACH_MIN_PH_SENTENCES,
      })),
    },
    practice: {
      attempts: p.total.n,
      accuracyPct: p.total.pct,
      modules: p.modules.map((m) => ({ module: m.label, attempts: m.n, accuracyPct: m.pct })),
      reviewRetentionPct: p.retention.pct,
      reviewGrades: p.retention.n,
      lessonsPassed: p.lessonsPassed,
    },
    selfRated: {
      entries: u.rated,
      average: u.avg,
      weekly: u.weeks.map((w) => w.avg),
    },
  };
}

/** Little data: one point at most, no general advice. */
export function coachDataIsSparse(input: CoachInput): boolean {
  return input.checkups.countInTrend < 2 && input.listening.minutesInPeriod < 120;
}

export interface CoachComment {
  headline: string;
  points: string[];
  nextWeek: string[];
}

export const COACH_MAX_POINTS = 3;
export const COACH_MAX_ACTIONS = 3;

export const COACH_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    headline: { type: 'string', description: 'One short Vietnamese sentence: the single most useful takeaway.' },
    points: { type: 'array', minItems: 0, maxItems: COACH_MAX_POINTS, items: { type: 'string' } },
    nextWeek: { type: 'array', minItems: 1, maxItems: COACH_MAX_ACTIONS, items: { type: 'string' } },
  },
  required: ['headline', 'points', 'nextWeek'],
};

/** App sections the coach may send the learner to (their Vietnamese names, exactly as in the menu). */
export const COACH_FEATURES = [
  'Chép chính tả', 'Cụm từ', 'Phân biệt âm', 'Nói nhại', 'Video thật', 'Bài học', 'Giải mã câu', 'Ôn tập',
  'Nhật ký nghe', 'Kiểm tra định kỳ',
] as const;

export const COACH_SYSTEM = [
  'You are a warm but strictly honest coach for a Vietnamese adult learning to understand spoken American English with a listening-practice app.',
  'You get ONLY aggregate numbers from the learner\'s progress report for the chosen period, plus "alreadyShown": the app\'s own comments that the learner sees right above yours. Comment in Vietnamese.',
  'Your comment is an add-on to alreadyShown: never repeat those facts or numbers, never contradict them (they apply the report\'s statistics correctly), and keep their caveats. Your main job is the plan for next week.',
  'Honesty rules (never break them):',
  '- Never claim or promise native-like listening, fluency or understanding "everything"/100%. Never use the words "bản ngữ", "bản xứ", "như người Mỹ", "native", "trôi chảy", "hoàn hảo".',
  '- Only talk about the chosen period, using numbers that are in the data. Do not invent numbers, dates or causes; do not compute new percentages.',
  '- Small samples must be hedged ("mới có N lần đo", "ít dữ liệu", "có vẻ"): fewer than 4 trend tests is not a trend; a checkup score change of 10 points or less is "chưa thay đổi rõ" (one comprehension answer is worth 10 points); a phenomenon marked lowSample is not evidence; a test with repeatForm true was seen before, so its score may be too high; practice accuracy depends on which exercises the learner chose. Respect checkups.caveats.',
  '- Self-rated understanding is always called "tự đánh giá" and depends on how hard the chosen content was. Its scale: 1 = under 30%, 2 = 30–50%, 3 = 50–70%, 4 = 70–90%, 5 = over 90% understood; quote it as the range, never as a single %.',
  '- Listening: durations are minutes; write them like the app ("2 giờ 15 phút", "45 phút"). A bucket with partial true is still running (elapsedDays so far): never call it lower than the others. More real listening is the main driver of progress; praise consistency, not perfection. Only "Nhật ký nghe" (real English content outside the app) and "Video thật" add listening hours; the other sections are exercises, so never suggest them as a way to raise listening time.',
  `Output: "headline" one short sentence; "points" 0 to ${COACH_MAX_POINTS} short bullets with something NEW (not in alreadyShown), each at most 2 sentences — leave it empty rather than restating; "nextWeek" 1 to ${COACH_MAX_ACTIONS} concrete actions for next week, each naming one app section by its exact Vietnamese name: ` +
    COACH_FEATURES.map((f) => `"${f}"`).join(', ') +
    '. Give amounts (minutes per day, number of sentences) when it helps. With no checkup yet (checkups.count 0), the first action is "Kiểm tra định kỳ".',
  'When there is little data (fewer than 2 trend tests and under 2 hours of listening), give at most 1 point and never fill with general advice.',
  'Natural, concise Vietnamese, no markdown, no emoji, no greeting.',
].join('\n');

export function buildCoachPrompt(input: CoachInput): TaskPrompt {
  const user = [
    'Progress report data (JSON). Minutes are whole minutes; percentages are 0-100; self-rated levels are 1-5 (see the scale).',
    coachDataIsSparse(input) ? 'Little data so far: at most 1 point.' : '',
    JSON.stringify(input),
    'Reply with JSON only.',
  ]
    .filter(Boolean)
    .join('\n');
  return { system: COACH_SYSTEM, user, schema: COACH_SCHEMA, name: 'progress_coach', maxTokens: 1200 };
}

/** Claims the report must never make (docs/progress-report.md §6): any sentence with one of these is removed. */
const DISHONEST = new RegExp(
  [
    'bản ngữ',
    'bản xứ',
    '(?<![\\p{L}])native(?![\\p{L}])',
    '(?:giống|như) (?:người|dân) (?:mỹ|anh|úc|tây|nước ngoài|bản|nói tiếng anh)',
    '(?<![\\p{L}])tây(?![\\p{L}])',
    'trôi chảy',
    'thành thạo',
    'hoàn hảo',
    '100\\s*%',
    '(?:sẽ|sắp) nghe (?:hiểu|được) (?:hết|tất cả|mọi|toàn bộ|100)',
  ].join('|'),
  'iu',
);

/** Removes every sentence that makes a native-like claim. '' when nothing is left. */
export function stripDishonest(s: string): string {
  const text = clip(s, 600);
  if (!DISHONEST.test(text)) return text;
  const sentences = text.match(/[^.!?…]+[.!?…]*\s*/g) ?? [text];
  return sentences
    .filter((x) => !DISHONEST.test(x))
    .join('')
    .trim();
}

const NUM_RE = /\d+(?:[.,]\d+)?/g;
const toNum = (s: string) => Number(s.replace(',', '.'));

/**
 * Every number the coach may quote: the numbers in its input (including the already-shown comments), durations
 * converted to hours ("2,5 giờ", "2 giờ 30 phút"), score differences, and small amounts (≤ 10).
 */
export function coachNumbers(input: CoachInput): number[] {
  const out = new Set<number>();
  for (const m of JSON.stringify(input).match(NUM_RE) ?? []) out.add(toNum(m));
  for (let i = 0; i <= 10; i++) out.add(i);
  const mins = [input.listening.minutesInPeriod, input.listening.minutesAllTime, ...input.listening.perBucket.map((b) => b.minutes)];
  for (const m of mins) {
    out.add(Math.round((m / 60) * 10) / 10);
    out.add(Math.round(m / 60));
    out.add(Math.floor(m / 60));
    out.add(m % 60);
  }
  const scores = [...input.checkups.trendScores, ...input.checkups.scoresInPeriod.map((x) => x.score)];
  for (const a of scores) for (const b of scores) out.add(Math.abs(a - b));
  return [...out];
}

/** Sentences of `s` whose numbers are all in `allowed` (± rounding). */
function keepKnownNumbers(s: string, allowed: readonly number[]): string {
  if (!/\d/.test(s)) return s;
  const sentences = s.match(/[^.!?…]+[.!?…]*\s*/g) ?? [s];
  return sentences
    .filter((x) => (x.match(NUM_RE) ?? []).every((m) => allowed.some((a) => Math.abs(a - toNum(m)) < 0.051)))
    .join('')
    .trim();
}

const FEATURE_RE = new RegExp(COACH_FEATURES.join('|'), 'i');
/** A bullet cut down to a short filler ("Tiếp tục nhé.") is dropped. */
const MIN_FILLER_CHARS = 25;

/**
 * Validated, honesty-filtered coach comment, or null when nothing usable is left. With `input`, headline and
 * points may only quote numbers that are in the data (coachNumbers); a sentence with any other number is removed.
 * A bullet that lost its claim and is left as a short filler without a number or an app section is dropped.
 */
export function sanitizeCoach(raw: unknown, input?: CoachInput): CoachComment | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { headline?: unknown; points?: unknown; nextWeek?: unknown };
  const allowed = input ? coachNumbers(input) : null;
  const clean = (x: unknown, checkNumbers: boolean): string => {
    const original = clip(x, 400);
    let s = stripDishonest(original);
    if (checkNumbers && allowed) s = keepKnownNumbers(s, allowed);
    if (s !== original && s.length < MIN_FILLER_CHARS && !/\d/.test(s) && !FEATURE_RE.test(s)) return '';
    return s;
  };
  const list = (v: unknown, max: number, checkNumbers: boolean) =>
    (Array.isArray(v) ? v : [])
      .map((x) => clean(x, checkNumbers))
      .filter(Boolean)
      .slice(0, max);
  const points = list(r.points, COACH_MAX_POINTS, true);
  const nextWeek = list(r.nextWeek, COACH_MAX_ACTIONS, false);
  const headline = clean(clip(r.headline, 200), true);
  if (!points.length && !nextWeek.length) return null;
  return { headline, points, nextWeek };
}

/** Local YYYY-MM-DD, part of the coach cache key (the comment is reused for the rest of the day). */
export function localDayKey(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
