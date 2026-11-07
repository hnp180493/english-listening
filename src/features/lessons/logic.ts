// Pure logic for the lessons module: quiz checking, option generation,
// course progress and the md-lite text format. No DOM, no storage.
import type { LessonProgress } from '../../core/lessons';
import { PASS_SCORE } from '../../core/lessons';
import { PHENOMENON_INFO } from '../../core/phenomena';
import type { Phenomenon } from '../../core/types';
import { canonicalize, isTypo, splitWords, wordsEqual } from '../../core/dictation/normalize';
import type { Lesson, QuizItem, SilentLetterItem, SpotItem } from '../../data/lessonTypes';

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

const APOS = /[‘’ʼ`´]/g;
/** Strip punctuation around a word but keep inner apostrophes: "it," → "it", "can't!" → "can't". */
export function cleanWord(raw: string): string {
  return raw.replace(APOS, "'").replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '').replace(/^'+|'+$/g, '');
}

/** Lowercase comparison key for words and word pairs. */
export function keyOf(s: string): string {
  return splitWords(s.replace(APOS, "'"))
    .map((w) => cleanWord(w).toLowerCase())
    .filter(Boolean)
    .join(' ');
}

/** "Turn it off." → "Turn, it, off." — read word by word (citation form) by TTS. */
export function citationText(text: string): string {
  const words = splitWords(text).map(cleanWord).filter(Boolean);
  return words.length ? words.join(', ') + '.' : '';
}

export interface Gap {
  before: string;
  gap: string;
  after: string;
  /** The sentence without brackets (what TTS speaks). */
  full: string;
}

/** Parse "I'm [going to] call you." → { before: "I'm", gap: "going to", after: "call you." }. */
export function parseGap(text: string): Gap | null {
  const m = /^(.*?)\[([^\]]+)\](.*)$/s.exec(text ?? '');
  if (!m) return null;
  const [, rawBefore, rawGap, rawAfter] = m;
  if (rawAfter.includes('[') || rawAfter.includes(']') || rawBefore.includes(']')) return null;
  const gap = rawGap.trim();
  if (!gap) return null;
  const before = rawBefore.trim();
  const after = rawAfter.trim();
  const glueAfter = /^[.,!?;:]/.test(after) ? '' : ' ';
  const full = [before, gap].filter(Boolean).join(' ') + (after ? glueAfter + after : '');
  return { before, gap, after, full };
}

/** Text spoken by TTS for a listen-type sentence (brackets removed). */
export function speechText(text: string): string {
  return parseGap(text)?.full ?? text.replace(/[[\]]/g, '');
}

export interface TypedCheck {
  correct: boolean;
  typo: boolean; // accepted with a small spelling slip
  empty: boolean;
}

/**
 * Compare a typed answer with the expected gap words. Equivalent spellings are
 * accepted ("gonna" = "going to", "it'll" = "it will"); a one-letter slip on a
 * 4+ letter word counts as correct with `typo: true`.
 *
 * With `exact` (spelling-focused courses, where the spelling IS the point) only the same letters count:
 * case, surrounding punctuation, extra whitespace and straight/curly apostrophes are ignored, nothing else.
 */
export function checkTyped(expected: string, input: string, exact = false): TypedCheck {
  if (exact) {
    const got = keyOf(input ?? '');
    if (!got) return { correct: false, typo: false, empty: true };
    return { correct: got === keyOf(expected), typo: false, empty: false };
  }
  const want = canonicalize(splitWords(expected)).words;
  const got = canonicalize(splitWords(input ?? '')).words;
  if (got.length === 0) return { correct: false, typo: false, empty: true };
  if (want.length !== got.length) return { correct: false, typo: false, empty: false };
  let typo = false;
  for (let i = 0; i < want.length; i++) {
    if (wordsEqual(want[i], got[i])) continue;
    if (isTypo(want[i], got[i])) {
      typo = true;
      continue;
    }
    return { correct: false, typo: false, empty: false };
  }
  return { correct: true, typo, empty: false };
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Tappable options for a spot item: single words, or adjacent word pairs for boundaries. */
export function spotOptions(text: string, unit: SpotItem['unit']): string[] {
  const words = splitWords(text).map(cleanWord).filter(Boolean);
  if (unit === 'word') return words;
  const out: string[] = [];
  for (let i = 0; i + 1 < words.length; i++) out.push(`${words[i]} ${words[i + 1]}`);
  return out;
}

/** Indices of spot options that are accepted answers. */
export function spotAnswerIndices(item: SpotItem): number[] {
  const keys = new Set(item.answers.map(keyOf));
  const out: number[] = [];
  spotOptions(item.text, item.unit).forEach((o, i) => {
    if (keys.has(keyOf(o))) out.push(i);
  });
  return out;
}

/** Display labels of a choice item's options (in authored order). Empty for listen-type and silent-letter. */
export function optionLabels(item: QuizItem): string[] {
  switch (item.type) {
    case 'listen-choose':
    case 'choose':
      return item.options;
    case 'which-rule':
      return item.options.map((p) => PHENOMENON_INFO[p]?.label ?? p);
    case 'spot':
      return spotOptions(item.text, item.unit);
    case 'listen-type':
    case 'silent-letter':
      return [];
  }
}

/** Authored-order indices of the correct option(s). Empty for listen-type and silent-letter. */
export function correctIndices(item: QuizItem): number[] {
  switch (item.type) {
    case 'listen-choose':
    case 'choose':
      return item.answer >= 0 && item.answer < item.options.length ? [item.answer] : [];
    case 'which-rule': {
      const i = item.options.indexOf(item.answer);
      return i >= 0 ? [i] : [];
    }
    case 'spot':
      return spotAnswerIndices(item);
    case 'listen-type':
    case 'silent-letter':
      return [];
  }
}

/** Small deterministic PRNG (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A permutation of 0..n-1 (display order → authored index). Same seed, same order. */
export function shuffledOrder(n: number, seed: number): number[] {
  const order = Array.from({ length: Math.max(0, n) }, (_, i) => i);
  const r = rng(seed);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/** Display order for an item's options: choice lists are shuffled, spot chips keep sentence order. */
export function displayOrder(item: QuizItem, seed: number): number[] {
  const n = optionLabels(item).length;
  if (item.type === 'spot') return Array.from({ length: n }, (_, i) => i);
  return shuffledOrder(n, seed);
}

// ---------------------------------------------------------------------------
// Checking
// ---------------------------------------------------------------------------

export type QuizResponse =
  | { kind: 'choice'; index: number }
  | { kind: 'text'; value: string }
  /** silent-letter: the letter indices the learner marked. */
  | { kind: 'set'; indices: number[] };

export interface QuizOutcome {
  correct: boolean;
  typo: boolean;
  /** Human-readable correct answer. */
  expected: string;
  /** Authored index chosen (choice items), -1 otherwise. */
  chosen: number;
  /** Text typed (listen-type), '' otherwise. */
  typed: string;
  /** Letter indices marked (silent-letter), sorted; absent otherwise. */
  picked?: number[];
}

/** Human-readable correct answer for an item. */
export function expectedAnswer(item: QuizItem): string {
  if (item.type === 'listen-type') return parseGap(item.text)?.gap ?? '';
  if (item.type === 'silent-letter') return letterGroups(item.word, item.silent);
  const labels = optionLabels(item);
  return correctIndices(item)
    .map((i) => labels[i])
    .join(' / ');
}

/**
 * Typed answers must be spelled exactly in every course but 'connected' (spelling, irregular words, loanwords…):
 * there "det" for debt is the very mistake the lesson is about. Connected speech keeps its typo tolerance (and
 * so does a call without a course).
 */
export function exactSpelling(course: string | undefined): boolean {
  return course !== undefined && course !== 'connected';
}

/**
 * Check one response. Wrong-kind responses (text for a choice item…) are simply incorrect. `course` is the
 * lesson's course: it decides whether a typed answer may have a small typo (see exactSpelling).
 */
export function checkAnswer(item: QuizItem, response: QuizResponse, course?: string): QuizOutcome {
  const expected = expectedAnswer(item);
  if (item.type === 'listen-type') {
    const typed = response.kind === 'text' ? response.value : '';
    const gap = parseGap(item.text);
    const r = gap ? checkTyped(gap.gap, typed, exactSpelling(course)) : { correct: false, typo: false };
    return { correct: r.correct, typo: r.typo, expected, chosen: -1, typed };
  }
  if (item.type === 'silent-letter') {
    const picked = response.kind === 'set' ? normIndices(response.indices) : [];
    const want = normIndices(item.silent);
    const correct = picked.length === want.length && picked.every((v, i) => v === want[i]);
    return { correct, typo: false, expected, chosen: -1, typed: '', picked };
  }
  const chosen = response.kind === 'choice' ? response.index : -1;
  const correct = chosen >= 0 && correctIndices(item).includes(chosen);
  return { correct, typo: false, expected, chosen, typed: '' };
}

/** Fraction of correct answers, 0..1 (0 for an empty list). */
export function scoreOf(results: readonly boolean[]): number {
  if (results.length === 0) return 0;
  return results.filter(Boolean).length / results.length;
}

export function isPass(score: number): boolean {
  return score >= PASS_SCORE;
}

export function percent(score: number): string {
  const s = Number.isFinite(score) ? Math.min(1, Math.max(0, score)) : 0;
  return `${Math.round(s * 100)}%`;
}

/**
 * Phenomena an item practises (for stats): its own list, else the lesson's phenomenon,
 * else (intro/review lessons) the answer of a which-rule item.
 */
export function itemPhenomena(item: QuizItem, lessonPhenomenon: Phenomenon | null): Phenomenon[] {
  if (item.phenomena && item.phenomena.length) return [...new Set(item.phenomena)];
  if (lessonPhenomenon) return [lessonPhenomenon];
  return item.type === 'which-rule' ? [item.answer] : [];
}

/** What TTS should say for a quiz item (null for items that are read, not heard, before answering). */
export function itemAudio(item: QuizItem): string | null {
  switch (item.type) {
    case 'listen-choose':
      return item.say ?? item.options[item.answer] ?? null;
    case 'listen-type':
      return speechText(item.text);
    case 'choose':
      return item.play?.trim() || null;
    case 'silent-letter':
      // Hearing the word is how a learner finds its silent letters.
      return (item.say ?? item.word).trim() || null;
    default:
      return null;
  }
}

/** Items that are answered by ear (Ôn tập prefers them): listening types and 'choose' with `play`. */
export function isListeningItem(item: QuizItem): boolean {
  switch (item.type) {
    case 'listen-choose':
    case 'listen-type':
    case 'spot':
      return true;
    case 'choose':
      return !!item.play?.trim();
    default:
      return false;
  }
}

/**
 * Connected-speech items: their feedback decodes the sentence with SpokenSentence. With `course`, items of a
 * lesson outside course 'connected' (spelling, irregular words…) are not decoded unless they list `phenomena`:
 * the decoder's colours and respellings are about linking, not spelling, and a lone word decodes to itself.
 */
export function isConnectedSpeechItem(item: QuizItem, course?: string): boolean {
  const kind = item.type === 'listen-choose' || item.type === 'listen-type' || item.type === 'spot' || item.type === 'which-rule';
  if (!kind) return false;
  if (course === undefined || course === 'connected') return true;
  return !!item.phenomena?.length;
}

/** The English sentence to decode/play after answering. */
export function itemSentence(item: QuizItem): string {
  switch (item.type) {
    case 'listen-choose':
      return item.options[item.answer] ?? '';
    case 'listen-type':
      return speechText(item.text);
    case 'spot':
      return item.text;
    case 'which-rule':
      // "going to (call)" → "going to call": the context word is what triggers the decoder.
      return item.written.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
    case 'choose':
      return (item.play ?? item.show ?? '').trim();
    case 'silent-letter':
      return item.say ?? item.word;
  }
}

export type OptionUnit = 'từ' | 'cụm từ' | 'câu';

/**
 * What the options of a listen-choose item are, for its prompt ("Nghe và chọn … bạn nghe được"): 'từ' when every
 * option is one word, 'cụm từ' when each has at most 3 words and no sentence punctuation (a cat / a kite), else 'câu'.
 */
export function optionUnit(options: readonly string[]): OptionUnit {
  const list = options.map((o) => (o ?? '').trim()).filter(Boolean);
  if (list.length === 0) return 'câu';
  if (list.every((o) => !/\s/.test(o))) return 'từ';
  if (list.every((o) => o.split(/\s+/).length <= 3 && !/[.?!]/.test(o))) return 'cụm từ';
  return 'câu';
}

/**
 * A word row's `say` worth showing: a context sentence (several words) that is more than the word itself
 * (heteronyms…). A one-word `say` is a TTS spelling override, not something to read, so it stays hidden.
 */
export function contextSentence(word: string, say: string | undefined): string | null {
  const s = say?.trim();
  return s && /\s/.test(s) && keyOf(s) !== keyOf(word) ? s : null;
}

export interface LetterPart {
  text: string;
  /** same: typed and right; extra: typed but not in the answer; missing: in the answer but not typed. */
  kind: 'same' | 'extra' | 'missing';
}

/** keyOf without lower-casing: what a diff shows (a proper noun keeps its capital). */
function diffText(s: string): string {
  return splitWords((s ?? '').normalize('NFC').replace(APOS, "'"))
    .map((w) => cleanWord(w))
    .filter(Boolean)
    .join(' ');
}

/**
 * Letter-level diff of a typed answer against the expected one (compared case-insensitively, apostrophes unified,
 * surrounding punctuation dropped; shown with the original letters, matching ones as the answer writes them):
 * "det" vs "debt" → de · +b · t; "dept" vs "debt" → de · -p · +b · t; "Shicago" vs "Chicago" → -S · +C · hicago.
 * Longest-common-subsequence alignment; consecutive parts of one kind are merged. Empty when nothing was typed.
 */
export function letterDiff(expected: string, typed: string): LetterPart[] {
  const a = [...diffText(expected)];
  const b = [...diffText(typed)];
  const al = a.map((x) => x.toLowerCase());
  const bl = b.map((x) => x.toLowerCase());
  if (b.length === 0) return [];
  const m = a.length;
  const n = b.length;
  // lcs[i][j] = LCS length of a[i..] and b[j..]
  const lcs = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--)
    for (let j = n - 1; j >= 0; j--)
      lcs[i][j] = al[i] === bl[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const parts: LetterPart[] = [];
  const push = (text: string, kind: LetterPart['kind']) => {
    const last = parts[parts.length - 1];
    if (last && last.kind === kind) last.text += text;
    else parts.push({ text, kind });
  };
  let i = 0;
  let j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && al[i] === bl[j]) {
      push(a[i], 'same');
      i++;
      j++;
    } else if (j < n && (i >= m || lcs[i][j + 1] >= lcs[i + 1][j])) {
      // A wrong letter shows as typed-extra first, then the missing right one: de~~p~~b̲t.
      push(b[j], 'extra');
      j++;
    } else {
      push(a[i], 'missing');
      i++;
    }
  }
  return parts;
}

/**
 * The diff in words (Vietnamese), '' when the letters already match: a wrong letter (extra right before a missing
 * part of the same length) is "gõ p thay vì b"; the rest "thiếu k, w" · "thừa d".
 */
export function letterDiffSummary(parts: readonly LetterPart[]): string {
  const swaps: string[] = [];
  const missing: string[] = [];
  const extra: string[] = [];
  for (let k = 0; k < parts.length; k++) {
    const p = parts[k];
    const t = p.text.trim();
    if (p.kind === 'same' || !t) continue;
    const q = parts[k + 1];
    if (p.kind === 'extra' && q?.kind === 'missing' && q.text.trim() && [...q.text].length === [...p.text].length) {
      swaps.push(`gõ ${t} thay vì ${q.text.trim()}`);
      k++;
      continue;
    }
    (p.kind === 'missing' ? missing : extra).push(t);
  }
  return [
    ...swaps,
    missing.length > 0 && `thiếu ${missing.join(', ')}`,
    extra.length > 0 && `thừa ${extra.join(', ')}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Respelling shown under the natural column of a compare card, or null when it adds nothing. */
export function spokenHint(natural: string, spoken: string): string | null {
  const a = keyOf(natural);
  const b = keyOf(spoken);
  return b && a !== b ? spoken.trim() : null;
}

/** Short one-line description used in the result review list. */
export function itemSummary(item: QuizItem): string {
  switch (item.type) {
    case 'listen-choose':
      return item.options[item.answer] ?? '';
    case 'listen-type':
      return speechText(item.text);
    case 'spot':
      return item.text;
    case 'which-rule':
      return `${item.written} → ${item.spoken}`;
    case 'choose':
      return (item.show ?? item.play ?? '').trim() || item.prompt;
    case 'silent-letter':
      return item.word;
  }
}

/** True when itemSummary() is English (the review list sets lang="en"). */
export function summaryIsEnglish(item: QuizItem): boolean {
  return item.type !== 'choose' || !!(item.show ?? item.play)?.trim();
}

export const ITEM_TYPE_LABEL: Record<QuizItem['type'], string> = {
  'listen-choose': 'Nghe và chọn',
  'listen-type': 'Nghe và điền',
  spot: 'Tìm chỗ biến âm',
  'which-rule': 'Hiện tượng nào?',
  choose: 'Chọn đáp án',
  'silent-letter': 'Tìm chữ câm',
};

// ---------------------------------------------------------------------------
// Words and letters (words block 'mark', silent-letter items)
// ---------------------------------------------------------------------------

/** Sorted unique integer indices. */
export function normIndices(xs: readonly number[] | undefined): number[] {
  return [...new Set((xs ?? []).filter((n) => Number.isInteger(n)))].sort((a, b) => a - b);
}

/** Letters of `word` at `indices`, consecutive ones joined: ("knight", [0,3,4]) → "k, gh". */
export function letterGroups(word: string, indices: readonly number[]): string {
  const idx = normIndices(indices).filter((i) => i >= 0 && i < word.length);
  const groups: string[] = [];
  let prev = -2;
  for (const i of idx) {
    if (i === prev + 1 && groups.length) groups[groups.length - 1] += word[i];
    else groups.push(word[i]);
    prev = i;
  }
  return groups.join(', ');
}

/** Letter indices of a word that can be tapped (letters only; apostrophes, hyphens and spaces are not). */
export function letterIndices(word: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < word.length; i++) if (/\p{L}/u.test(word[i])) out.push(i);
  return out;
}

export interface MarkPart {
  text: string;
  kind: 'plain' | 'mark' | 'silent';
}

/**
 * Split a words-block `mark` ("(k)ni(gh)t", "lau[gh]") into parts. Null when the mark is malformed: nested or
 * unclosed groups, empty groups, or letters that do not spell `word` once the brackets are removed.
 */
export function parseMark(word: string, mark: string | undefined): MarkPart[] | null {
  if (!mark) return [{ text: word, kind: 'plain' }];
  const parts: MarkPart[] = [];
  let kind: MarkPart['kind'] = 'plain';
  let buf = '';
  const flush = () => {
    if (buf) parts.push({ text: buf, kind });
    buf = '';
  };
  for (const ch of mark) {
    if (ch === '[' || ch === '(') {
      if (kind !== 'plain') return null;
      flush();
      kind = ch === '[' ? 'mark' : 'silent';
    } else if (ch === ']' || ch === ')') {
      if ((ch === ']' && kind !== 'mark') || (ch === ')' && kind !== 'silent') || !buf) return null;
      flush();
      kind = 'plain';
    } else buf += ch;
  }
  if (kind !== 'plain') return null;
  flush();
  return parts.map((p) => p.text).join('') === word ? parts : null;
}

/** Silent-letter parts of a word for display: ("knight", [0,3,4]) → (k) ni (gh) t. */
export function silentParts(word: string, silent: readonly number[]): MarkPart[] {
  const set = new Set(silent);
  const parts: MarkPart[] = [];
  for (let i = 0; i < word.length; i++) {
    const kind: MarkPart['kind'] = set.has(i) ? 'silent' : 'plain';
    const last = parts[parts.length - 1];
    if (last && last.kind === kind) last.text += word[i];
    else parts.push({ text: word[i], kind });
  }
  return parts;
}

/** A silent-letter item is well formed: 1+ unique indices of letters inside the word, not every letter. */
export function silentItemValid(item: SilentLetterItem): boolean {
  const letters = new Set(letterIndices(item.word));
  return (
    item.silent.length > 0 &&
    new Set(item.silent).size === item.silent.length &&
    item.silent.every((i) => Number.isInteger(i) && letters.has(i)) &&
    item.silent.length < letters.size
  );
}

// ---------------------------------------------------------------------------
// Course progress
// ---------------------------------------------------------------------------

export type LessonState = 'new' | 'tried' | 'done';

export interface LessonStatus {
  state: LessonState;
  best: number | null; // best quiz score 0..1, null if never tried
  attempts: number;
}

export function lessonStatus(progress: LessonProgress, id: string): LessonStatus {
  const r = progress[id];
  if (!r) return { state: 'new', best: null, attempts: 0 };
  const best = Number.isFinite(r.bestScore) ? Math.min(1, Math.max(0, r.bestScore)) : 0;
  return { state: r.completedAt > 0 ? 'done' : 'tried', best, attempts: Math.max(0, r.attempts | 0) };
}

export interface CourseProgress {
  completed: number;
  total: number;
  ratio: number; // 0..1
}

export function courseProgress(lessons: readonly { id: string }[], progress: LessonProgress): CourseProgress {
  const total = lessons.length;
  const completed = lessons.filter((l) => lessonStatus(progress, l.id).state === 'done').length;
  return { completed, total, ratio: total ? completed / total : 0 };
}

/** First lesson (by order) not completed yet; null when the whole course is done. */
export function recommendNext<T extends { id: string; order: number }>(lessons: readonly T[], progress: LessonProgress): T | null {
  const sorted = [...lessons].sort((a, b) => a.order - b.order);
  return sorted.find((l) => lessonStatus(progress, l.id).state !== 'done') ?? null;
}

/** Lesson after `id` in course order, or null for the last one / unknown ids. */
export function nextLessonAfter<T extends { id: string; order: number }>(lessons: readonly T[], id: string): T | null {
  const sorted = [...lessons].sort((a, b) => a.order - b.order);
  const i = sorted.findIndex((l) => l.id === id);
  return i >= 0 && i + 1 < sorted.length ? sorted[i + 1] : null;
}

/** Total number of examples in a lesson (shown in the header). */
export function exampleCount(lesson: Lesson): number {
  let n = 0;
  for (const s of lesson.sections) for (const b of s.blocks) if (b.type === 'examples') n += b.items.length;
  return n;
}

// ---------------------------------------------------------------------------
// md-lite
// ---------------------------------------------------------------------------

export interface MdSpan {
  text: string;
  bold: boolean;
}

export type MdBlock = { kind: 'p'; spans: MdSpan[] } | { kind: 'ul'; items: MdSpan[][] };

/** Split "a **b** c" into spans. Unmatched ** are kept as literal text. */
export function parseInline(s: string): MdSpan[] {
  const out: MdSpan[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    if (m.index > last) out.push({ text: s.slice(last, m.index), bold: false });
    out.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last), bold: false });
  return out;
}

/** Paragraphs split by blank lines; consecutive "- " lines form a bullet list. */
export function parseMd(md: string): MdBlock[] {
  const blocks: MdBlock[] = [];
  for (const chunk of (md ?? '').split(/\n\s*\n/)) {
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
    let para: string[] = [];
    let list: MdSpan[][] = [];
    const flushPara = () => {
      if (para.length) blocks.push({ kind: 'p', spans: parseInline(para.join(' ')) });
      para = [];
    };
    const flushList = () => {
      if (list.length) blocks.push({ kind: 'ul', items: list });
      list = [];
    };
    for (const line of lines) {
      if (/^[-•]\s+/.test(line)) {
        flushPara();
        list.push(parseInline(line.replace(/^[-•]\s+/, '')));
      } else {
        flushList();
        para.push(line);
      }
    }
    flushPara();
    flushList();
  }
  return blocks;
}
