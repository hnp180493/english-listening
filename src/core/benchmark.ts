// "Kiểm tra định kỳ": scoring, results store, form rotation and cadence of the periodic listening check.
// Content: src/data/benchmark.ts (BENCHMARK_FORMS). Types: src/data/benchmarkTypes.ts. See docs/progress-report.md.
//
// Rules of the test (the UI enforces them): natural speed (rate 1), each item played at most MAX_PLAYS times, no
// slow playback, no hints. Nothing here calls recordAttempt / recordReview: a checkup measures, it is not practice.
//
// Score 0–100 = round(0.6 × dictation word accuracy % + 0.4 × comprehension %).
// Dictation word accuracy = Σ correct words / Σ (sentence words + extra words typed), the same rule as the
// dictation score (core/dictation/align: extra words lower it). Per-phenomenon misses come from the decoder +
// core/dictation/classify on the dictation part only, deduped per sentence like recordAttempt.
//
// Storage: KEYS.checkups ('checkup-results', synced, union by id: core/syncMerge mergeCheckups) holds finished
// tests only; an unfinished test lives in KEYS.checkupDraft (device-local) so a reload can resume it.

import { useSyncExternalStore } from 'react';
import type { BenchmarkForm, BenchmarkFormId, BenchmarkQuestion, BenchmarkSentence } from '../data/benchmarkTypes';
import { decode } from './decoder';
import { align } from './dictation/align';
import { classify } from './dictation/classify';
import { buildDiff, type DiffUnit } from './dictation/diff';
import { splitWords } from './dictation/normalize';
import { PHENOMENON_INFO } from './phenomena';
import { localDayDiff } from './review/time';
import { KEYS, loadJSON, onAppWrite, removeKey, saveJSON, STORAGE_PREFIX } from './storage';
import { PHENOMENA, type DecodeResult, type Phenomenon } from './types';

export const CHECKUP_RATE = 1;
/**
 * How the checkup audio is made. 'connected': the speakable connected-speech spelling (src/core/playback.ts), what
 * new results record. 'standard': results saved before that change (no `audioMode` field): the standard written
 * text read by the voice, clearer and easier. Scores across the two are a different condition (like a voice change).
 */
export type CheckupAudioMode = 'connected' | 'standard';
export const CHECKUP_AUDIO_MODE = 'connected' as const;

/** Audio mode of a saved result: 'standard' for older results without the field. */
export function audioModeOf(r: object): CheckupAudioMode {
  return (r as { audioMode?: unknown }).audioMode === 'connected' ? 'connected' : 'standard';
}
export const MAX_PLAYS = 2;
/** Recommended days between checkups. */
export const CHECKUP_CADENCE_DAYS = 14;
export const DICTATION_WEIGHT = 0.6;
export const COMPREHENSION_WEIGHT = 0.4;
/** An unfinished test older than this is not offered for resuming. */
export const DRAFT_TTL_MS = 24 * 3_600_000;
export const FORM_IDS: readonly BenchmarkFormId[] = ['A', 'B', 'C', 'D', 'E', 'F'];

export interface DictationItemResult {
  id: string; // BenchmarkSentence id
  typed: string;
  correctWords: number; // sentence words heard right (typo-level misspellings count as right)
  totalWords: number; // words in the sentence
  extraWords: number; // words typed that are not in the sentence (they lower the accuracy)
  plays: number;
}

export interface ComprehensionItemResult {
  id: string; // BenchmarkQuestion id
  chosen: number | null; // option index, null = no answer
  correct: boolean;
  plays: number;
}

export interface CheckupResult {
  id: string;
  at: number; // epoch ms the test was finished
  form: BenchmarkFormId;
  voiceName: string | null; // TTS voice used (a change makes scores less comparable)
  /** 'connected' = the audio was the connected-speech version. Absent on older results (standard text, see audioModeOf). */
  audioMode?: 'connected';
  rate: 1;
  dictation: {
    words: number; // Σ totalWords
    correct: number; // Σ correctWords
    extra: number; // Σ extraWords
    pct: number; // word accuracy 0..100 (rounded)
    items: DictationItemResult[];
  };
  comprehension: {
    correct: number;
    total: number;
    pct: number; // 0..100 (rounded)
    items: ComprehensionItemResult[];
  };
  byPhenomenon: Record<Phenomenon, { seen: number; missed: number }>;
  score: number; // 0..100
  durationSec: number;
  completed: true;
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const nonNeg = (v: unknown): number => (finite(v) && v > 0 ? Math.floor(v) : 0);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isFormId = (v: unknown): v is BenchmarkFormId => typeof v === 'string' && (FORM_IDS as readonly string[]).includes(v);

export function emptyByPhenomenon(): Record<Phenomenon, { seen: number; missed: number }> {
  const out = {} as Record<Phenomenon, { seen: number; missed: number }>;
  for (const p of PHENOMENA) out[p] = { seen: 0, missed: 0 };
  return out;
}

// ───────────────────────── scoring (pure) ─────────────────────────

const decodeCache = new Map<string, DecodeResult>();

/** decode() that never throws (cached by text). */
export function safeDecode(text: string): DecodeResult {
  const hit = decodeCache.get(text);
  if (hit) return hit;
  let r: DecodeResult = { input: text, tokens: [], annotations: [], segments: [], spokenText: '' };
  try {
    const d = decode(text);
    if (d && Array.isArray(d.tokens) && Array.isArray(d.annotations)) r = d;
  } catch {
    // a decoder failure only loses the per-phenomenon detail
  }
  if (decodeCache.size > 200) decodeCache.clear();
  decodeCache.set(text, r);
  return r;
}

export interface SentenceCheck {
  item: DictationItemResult;
  seen: Phenomenon[]; // phenomena the decoder finds in the sentence
  missed: Phenomenon[]; // of those, the ones on words heard wrong
  units: DiffUnit[]; // colour-coded diff for the review screen (core/dictation/diff)
  pct: number; // this sentence's accuracy 0..100
}

/**
 * Contractions typed without the apostrophe that are also real words ("ill", "were", "well"…). The dictation
 * normalizer cannot accept them in general ("well" is a word), but in a checkup sentence that contains the
 * contraction (and not the plain word) they are what a phone keyboard produces: accepted, so the score does not
 * depend on typing habit and on how many such contractions a form happens to have.
 */
const BARE_CONTRACTIONS: Readonly<Record<string, string>> = {
  ill: "i'll",
  id: "i'd",
  were: "we're",
  wed: "we'd",
  well: "we'll",
  shed: "she'd",
  shell: "she'll",
  hed: "he'd",
  hell: "he'll",
  its: "it's",
  lets: "let's",
  whod: "who'd",
  wholl: "who'll",
  theyd: "they'd",
};

const bare = (w: string) => w.toLowerCase().replace(/[‘’`´]/g, "'").replace(/[^a-z']/g, '');

/** The answer tokens with apostrophe-less contractions restored where the target has that contraction. */
export function restoreBareContractions(targetRaw: readonly string[], answerRaw: readonly string[]): string[] {
  const target = new Set(targetRaw.map(bare));
  return answerRaw.map((raw) => {
    const w = bare(raw);
    const full = Object.prototype.hasOwnProperty.call(BARE_CONTRACTIONS, w) ? BARE_CONTRACTIONS[w] : undefined;
    return full && target.has(full) && !target.has(w) ? full : raw;
  });
}

/** Score one typed answer against a sentence (also used by the result screen to show the diff). */
export function checkSentence(sentence: Pick<BenchmarkSentence, 'id' | 'text'>, typed: string, plays = 0): SentenceCheck {
  const text = typeof typed === 'string' ? typed : '';
  const decoded = safeDecode(sentence.text);
  const targetRaw = decoded.tokens.length ? decoded.tokens.map((t) => t.raw) : splitWords(sentence.text);
  const answerRaw = splitWords(text);
  const al = align(targetRaw, restoreBareContractions(targetRaw, answerRaw));
  const cls = classify(decoded, al.ops, answerRaw, targetRaw);
  return {
    item: {
      id: sentence.id,
      typed: text.slice(0, 500),
      correctWords: al.matched,
      totalWords: al.total,
      extraWords: al.extra,
      plays: Math.min(MAX_PLAYS, nonNeg(plays)),
    },
    seen: cls.seenPhenomena,
    missed: cls.missedPhenomena,
    units: buildDiff(targetRaw, answerRaw, al.ops),
    pct: Math.round(al.score * 100),
  };
}

/** round(0.6 × dictation % + 0.4 × comprehension %), clamped to 0..100. */
export function combinedScore(dictationPct: number, comprehensionPct: number): number {
  const d = Math.min(100, Math.max(0, finite(dictationPct) ? dictationPct : 0));
  const c = Math.min(100, Math.max(0, finite(comprehensionPct) ? comprehensionPct : 0));
  return Math.round(DICTATION_WEIGHT * d + COMPREHENSION_WEIGHT * c);
}

export interface DictationAnswer {
  typed: string;
  plays: number;
}

export interface ComprehensionAnswer {
  chosen: number | null;
  plays: number;
}

/** Part 1: every sentence of the form (unanswered = typed ''). */
export function scoreDictation(sentences: readonly BenchmarkSentence[], answers: Readonly<Record<string, DictationAnswer | undefined>>) {
  const checks = sentences.map((s) => checkSentence(s, answers[s.id]?.typed ?? '', answers[s.id]?.plays ?? 0));
  let words = 0;
  let correct = 0;
  let extra = 0;
  const byPhenomenon = emptyByPhenomenon();
  for (const c of checks) {
    words += c.item.totalWords;
    correct += c.item.correctWords;
    extra += c.item.extraWords;
    for (const p of new Set(c.seen)) byPhenomenon[p].seen += 1;
    for (const p of new Set(c.missed)) byPhenomenon[p].missed += 1;
  }
  const denom = words + extra;
  return {
    words,
    correct,
    extra,
    pct: denom > 0 ? Math.round((correct / denom) * 100) : 0,
    items: checks.map((c) => c.item),
    byPhenomenon,
    checks,
  };
}

/** Part 2: one question per passage (unanswered = wrong). */
export function scoreComprehension(questions: readonly BenchmarkQuestion[], answers: Readonly<Record<string, ComprehensionAnswer | undefined>>) {
  const items: ComprehensionItemResult[] = questions.map((q) => {
    const a = answers[q.id];
    const chosen = a && finite(a.chosen) && a.chosen >= 0 && a.chosen < q.options.length ? Math.floor(a.chosen) : null;
    return { id: q.id, chosen, correct: chosen !== null && chosen === q.answer, plays: Math.min(MAX_PLAYS, nonNeg(a?.plays)) };
  });
  const correct = items.filter((i) => i.correct).length;
  const total = items.length;
  return { correct, total, pct: total > 0 ? Math.round((correct / total) * 100) : 0, items };
}

export interface BuildResultInput {
  form: BenchmarkForm;
  dictation: Readonly<Record<string, DictationAnswer | undefined>>;
  comprehension: Readonly<Record<string, ComprehensionAnswer | undefined>>;
  voiceName: string | null;
  startedAt: number;
  now: number;
  id?: string;
}

/** The record saved when the learner finishes the test. */
export function buildCheckupResult(input: BuildResultInput): CheckupResult {
  const d = scoreDictation(input.form.sentences, input.dictation);
  const c = scoreComprehension(input.form.questions, input.comprehension);
  return {
    id: input.id ?? newCheckupId(input.now),
    at: input.now,
    form: input.form.id,
    voiceName: typeof input.voiceName === 'string' && input.voiceName ? input.voiceName.slice(0, 200) : null,
    audioMode: CHECKUP_AUDIO_MODE,
    rate: CHECKUP_RATE,
    dictation: { words: d.words, correct: d.correct, extra: d.extra, pct: d.pct, items: d.items },
    comprehension: { correct: c.correct, total: c.total, pct: c.pct, items: c.items },
    byPhenomenon: d.byPhenomenon,
    score: combinedScore(d.pct, c.pct),
    durationSec: Math.max(0, Math.round((input.now - input.startedAt) / 1000)),
    completed: true,
  };
}

export function newCheckupId(now: number, rand: () => number = Math.random): string {
  return `k-${now.toString(36)}-${Math.floor(rand() * 36 ** 4).toString(36).padStart(4, '0')}`;
}

// ───────────────────────── sanitizing ─────────────────────────

/** One stored result, or null when it is not a usable finished result. */
export function sanitizeResult(raw: unknown): CheckupResult | null {
  if (!isObj(raw) || typeof raw.id !== 'string' || !raw.id || !finite(raw.at) || !isFormId(raw.form) || raw.completed !== true) return null;
  const d = isObj(raw.dictation) ? raw.dictation : {};
  const c = isObj(raw.comprehension) ? raw.comprehension : {};
  const words = nonNeg(d.words);
  const correct = Math.min(words, nonNeg(d.correct));
  const extra = nonNeg(d.extra);
  const total = nonNeg(c.total);
  const cCorrect = Math.min(total, nonNeg(c.correct));
  const dPct = finite(d.pct) ? Math.min(100, Math.max(0, Math.round(d.pct))) : words + extra > 0 ? Math.round((correct / (words + extra)) * 100) : 0;
  const cPct = finite(c.pct) ? Math.min(100, Math.max(0, Math.round(c.pct))) : total > 0 ? Math.round((cCorrect / total) * 100) : 0;
  const by = emptyByPhenomenon();
  if (isObj(raw.byPhenomenon)) {
    for (const p of PHENOMENA) {
      const v = raw.byPhenomenon[p];
      if (isObj(v)) {
        const seen = nonNeg(v.seen);
        by[p] = { seen, missed: Math.min(seen, nonNeg(v.missed)) };
      }
    }
  }
  const dItems: DictationItemResult[] = Array.isArray(d.items)
    ? d.items.filter(isObj).filter((i) => typeof i.id === 'string').map((i) => ({
        id: i.id as string,
        typed: typeof i.typed === 'string' ? i.typed.slice(0, 500) : '',
        correctWords: nonNeg(i.correctWords),
        totalWords: nonNeg(i.totalWords),
        extraWords: nonNeg(i.extraWords),
        plays: nonNeg(i.plays),
      }))
    : [];
  const cItems: ComprehensionItemResult[] = Array.isArray(c.items)
    ? c.items.filter(isObj).filter((i) => typeof i.id === 'string').map((i) => ({
        id: i.id as string,
        chosen: finite(i.chosen) && i.chosen >= 0 ? Math.floor(i.chosen) : null,
        correct: i.correct === true,
        plays: nonNeg(i.plays),
      }))
    : [];
  return {
    id: raw.id,
    at: raw.at,
    form: raw.form,
    voiceName: typeof raw.voiceName === 'string' && raw.voiceName ? raw.voiceName.slice(0, 200) : null,
    ...(raw.audioMode === 'connected' ? { audioMode: 'connected' as const } : {}),
    rate: CHECKUP_RATE,
    dictation: { words, correct, extra, pct: dPct, items: dItems },
    comprehension: { correct: cCorrect, total, pct: cPct, items: cItems },
    byPhenomenon: by,
    score: finite(raw.score) ? Math.min(100, Math.max(0, Math.round(raw.score))) : combinedScore(dPct, cPct),
    durationSec: nonNeg(raw.durationSec),
    completed: true,
  };
}

/** Stored value → finished results, oldest first, one per id. */
export function parseCheckups(raw: unknown): CheckupResult[] {
  const list = Array.isArray(raw) ? raw : isObj(raw) && Array.isArray(raw.results) ? raw.results : [];
  const byId = new Map<string, CheckupResult>();
  for (const it of list) {
    const r = sanitizeResult(it);
    if (r && !byId.has(r.id)) byId.set(r.id, r);
  }
  return [...byId.values()].sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
}

// ───────────────────────── rotation and cadence (pure) ─────────────────────────

/**
 * The form to take next: one never taken first (in `forms` order, A → F), else the least recently taken.
 * null when there are no forms.
 */
export function nextForm<F extends Pick<BenchmarkForm, 'id'>>(results: readonly Pick<CheckupResult, 'form' | 'at'>[], forms: readonly F[]): F | null {
  if (!forms.length) return null;
  const last = new Map<string, number>();
  for (const r of results) last.set(r.form, Math.max(last.get(r.form) ?? -Infinity, r.at));
  const never = forms.find((f) => !last.has(f.id));
  if (never) return never;
  return forms.reduce((best, f) => ((last.get(f.id) ?? 0) < (last.get(best.id) ?? 0) ? f : best));
}

export interface CheckupDue {
  /** 'baseline': none taken yet (and onboarding done); 'due': CHECKUP_CADENCE_DAYS or more since the last; null: not now. */
  kind: 'baseline' | 'due' | null;
  daysSince: number | null; // calendar days since the latest checkup; null when none
  lastAt: number | null;
  nextDueAt: number | null; // local midnight of the day the next one is recommended; null when none taken
}

export function checkupDue(results: readonly Pick<CheckupResult, 'at'>[], now: number, onboardingDone: boolean): CheckupDue {
  if (!results.length) return { kind: onboardingDone ? 'baseline' : null, daysSince: null, lastAt: null, nextDueAt: null };
  const lastAt = Math.max(...results.map((r) => r.at));
  const daysSince = Math.max(0, localDayDiff(lastAt, now));
  const d = new Date(lastAt);
  const nextDueAt = new Date(d.getFullYear(), d.getMonth(), d.getDate() + CHECKUP_CADENCE_DAYS).getTime();
  return { kind: daysSince >= CHECKUP_CADENCE_DAYS ? 'due' : null, daysSince, lastAt, nextDueAt };
}

// ───────────────────────── comparison (pure) ─────────────────────────

export interface CheckupDelta {
  score: number;
  dictationPct: number;
  comprehensionPct: number;
}

export interface PhenomenonChange {
  phenomenon: Phenomenon;
  label: string; // Vietnamese name ("Nối âm")
  firstSeen: number;
  firstMissed: number;
  latestSeen: number;
  latestMissed: number;
  firstMissPct: number | null; // null when not seen
  latestMissPct: number | null;
  change: number | null; // latestMissPct − firstMissPct (negative = fewer misses = better)
}

export interface CheckupComparison {
  latest: CheckupResult;
  isBaseline: boolean; // first === latest: nothing to compare yet
  vsPrev: CheckupDelta | null;
  vsFirst: CheckupDelta | null;
  /** The TTS voice differs between the compared tests (prev or first vs latest). */
  voiceChanged: boolean;
  /**
   * The audio mode differs from the test compared against just before (the previous one, or the first when there is
   * no other): older 'standard' text vs 'connected' speech, a different test condition. Shown as a caveat.
   */
  audioModeChanged: boolean;
  /**
   * Only the FIRST test used another audio mode (the previous one did not): the vs-first numbers cross conditions.
   * Said once, quietly ("lần đầu dùng giọng đọc chuẩn"), not as the full caveat on every later checkup.
   */
  firstAudioModeDiffers: boolean;
  phenomena: PhenomenonChange[]; // first vs latest, phenomena seen in either, PHENOMENA order
}

const delta = (a: CheckupResult, b: CheckupResult): CheckupDelta => ({
  score: b.score - a.score,
  dictationPct: b.dictation.pct - a.dictation.pct,
  comprehensionPct: b.comprehension.pct - a.comprehension.pct,
});

const missPct = (v: { seen: number; missed: number }) => (v.seen > 0 ? Math.round((v.missed / v.seen) * 100) : null);

/** Compare the latest checkup with the previous and the first one. */
export function compare(first: CheckupResult, prev: CheckupResult | null, latest: CheckupResult): CheckupComparison {
  const isBaseline = first.id === latest.id;
  const p = prev && prev.id !== latest.id ? prev : null;
  const phenomena: PhenomenonChange[] = [];
  if (!isBaseline) {
    for (const ph of PHENOMENA) {
      const a = first.byPhenomenon[ph] ?? { seen: 0, missed: 0 };
      const b = latest.byPhenomenon[ph] ?? { seen: 0, missed: 0 };
      if (a.seen === 0 && b.seen === 0) continue;
      const fp = missPct(a);
      const lp = missPct(b);
      phenomena.push({
        phenomenon: ph,
        label: PHENOMENON_INFO[ph].label,
        firstSeen: a.seen,
        firstMissed: a.missed,
        latestSeen: b.seen,
        latestMissed: b.missed,
        firstMissPct: fp,
        latestMissPct: lp,
        change: fp !== null && lp !== null ? lp - fp : null,
      });
    }
  }
  const voiceChanged = !isBaseline && ((p !== null && p.voiceName !== latest.voiceName) || first.voiceName !== latest.voiceName);
  const mode = audioModeOf(latest);
  const firstDiffers = !isBaseline && audioModeOf(first) !== mode;
  const audioModeChanged = !isBaseline && (p !== null ? audioModeOf(p) !== mode : firstDiffers);
  return {
    latest,
    isBaseline,
    vsPrev: p ? delta(p, latest) : null,
    vsFirst: isBaseline ? null : delta(first, latest),
    voiceChanged,
    audioModeChanged,
    firstAudioModeDiffers: firstDiffers && !audioModeChanged,
    phenomena,
  };
}

/** Comparison for a list of results (oldest first); null when there are none. */
export function compareAll(results: readonly CheckupResult[]): CheckupComparison | null {
  if (!results.length) return null;
  const sorted = [...results].sort((a, b) => a.at - b.at);
  return compare(sorted[0], sorted.length > 1 ? sorted[sorted.length - 2] : null, sorted[sorted.length - 1]);
}

/** "+12 điểm", "−3 điểm", "không đổi". */
export function formatDeltaVi(n: number, unit = 'điểm'): string {
  if (!finite(n) || n === 0) return 'không đổi';
  return `${n > 0 ? '+' : '−'}${Math.abs(Math.round(n))} ${unit}`;
}

// ───────────────────────── results store ─────────────────────────

let session: CheckupResult[] | null = null;
let cacheRaw: string | null | undefined;
let cacheList: CheckupResult[] = [];
const listeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + KEYS.checkups);
  } catch {
    return null;
  }
}

function notify(): void {
  for (const fn of [...listeners]) {
    try {
      fn();
    } catch {
      // never break a write
    }
  }
}

/** Finished checkups, oldest first. Stable identity while unchanged (useSyncExternalStore snapshot). */
export function loadCheckups(): readonly CheckupResult[] {
  if (session) return session;
  const raw = readRaw();
  if (raw !== cacheRaw) {
    let parsed: unknown = null;
    try {
      parsed = raw == null ? null : JSON.parse(raw);
    } catch {
      parsed = null;
    }
    cacheList = parseCheckups(parsed);
    cacheRaw = raw;
  }
  return cacheList;
}

/** Save a finished checkup (and drop the draft). Returns false when storage refused it (kept for this session). */
export function saveCheckupResult(result: CheckupResult): boolean {
  const clean = sanitizeResult(result);
  if (!clean) return false;
  const list = [...loadCheckups().filter((r) => r.id !== clean.id), clean].sort((a, b) => a.at - b.at);
  const ok = saveJSON(KEYS.checkups, { version: 1, results: list });
  session = ok ? null : list;
  cacheRaw = undefined;
  clearCheckupDraft();
  notify();
  return ok;
}

let hooked = false;
export function subscribeCheckups(fn: () => void): () => void {
  if (!hooked) {
    hooked = true;
    onAppWrite((key) => {
      if (key === KEYS.checkups || key === '*') {
        cacheRaw = undefined;
        notify();
      }
    });
    try {
      window.addEventListener('storage', (e) => {
        if (e.key === null || e.key === STORAGE_PREFIX + KEYS.checkups) {
          cacheRaw = undefined;
          notify();
        }
      });
    } catch {
      // no DOM
    }
  }
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Re-read after folder sync replaced the stored data. */
export function reloadCheckups(): void {
  session = null;
  cacheRaw = undefined;
  notify();
}

export function useCheckups(): readonly CheckupResult[] {
  return useSyncExternalStore(subscribeCheckups, loadCheckups, loadCheckups);
}

// ───────────────────────── draft (device-local) ─────────────────────────

export interface CheckupDraft {
  form: BenchmarkFormId;
  startedAt: number;
  savedAt: number;
  /** 'intro' | 'dictation' | 'comprehension'; `index` is the item within the part. */
  part: 'intro' | 'dictation' | 'comprehension';
  index: number;
  voiceName: string | null;
  dictation: Record<string, DictationAnswer>;
  comprehension: Record<string, ComprehensionAnswer>;
}

function sanitizeDraft(raw: unknown, now: number): CheckupDraft | null {
  if (!isObj(raw) || !isFormId(raw.form) || !finite(raw.startedAt) || !finite(raw.savedAt)) return null;
  if (now - raw.savedAt > DRAFT_TTL_MS || raw.savedAt > now + 60_000) return null;
  const part = raw.part === 'dictation' || raw.part === 'comprehension' ? raw.part : 'intro';
  const dictation: Record<string, DictationAnswer> = {};
  if (isObj(raw.dictation)) {
    for (const [id, v] of Object.entries(raw.dictation)) {
      if (isObj(v)) dictation[id] = { typed: typeof v.typed === 'string' ? v.typed.slice(0, 500) : '', plays: Math.min(MAX_PLAYS, nonNeg(v.plays)) };
    }
  }
  const comprehension: Record<string, ComprehensionAnswer> = {};
  if (isObj(raw.comprehension)) {
    for (const [id, v] of Object.entries(raw.comprehension)) {
      if (isObj(v)) comprehension[id] = { chosen: finite(v.chosen) && v.chosen >= 0 ? Math.floor(v.chosen) : null, plays: Math.min(MAX_PLAYS, nonNeg(v.plays)) };
    }
  }
  return {
    form: raw.form,
    startedAt: raw.startedAt,
    savedAt: raw.savedAt,
    part,
    index: nonNeg(raw.index),
    voiceName: typeof raw.voiceName === 'string' ? raw.voiceName.slice(0, 200) : null,
    dictation,
    comprehension,
  };
}

/** The unfinished test of this browser, unless it is older than DRAFT_TTL_MS. */
export function loadCheckupDraft(now: number = Date.now()): CheckupDraft | null {
  return sanitizeDraft(loadJSON<unknown>(KEYS.checkupDraft, null), now);
}

export function saveCheckupDraft(draft: Omit<CheckupDraft, 'savedAt'>, now: number = Date.now()): boolean {
  return saveJSON(KEYS.checkupDraft, { ...draft, savedAt: now });
}

export function clearCheckupDraft(): void {
  removeKey(KEYS.checkupDraft);
}

// ───────────────────────── honest trends (pure) ─────────────────────────

/** Tests closer than this to the previous counted test are left out of trends (a quick retake is not a new data point). */
export const RETAKE_WINDOW_DAYS = 7;

/**
 * The checkups a trend may use, oldest first: a test taken less than RETAKE_WINDOW_DAYS after the previous
 * counted one is skipped, so retaking until the score looks good (or cycling the six forms in one evening)
 * cannot move the trend. The first test of each window counts.
 */
export function trendCheckups<R extends Pick<CheckupResult, 'at'>>(results: readonly R[]): R[] {
  const sorted = [...results].sort((a, b) => a.at - b.at);
  const out: R[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && localDayDiff(last.at, r.at) < RETAKE_WINDOW_DAYS) continue;
    out.push(r);
  }
  return out;
}

/** True when `result` uses a form an earlier test already used (sentences and answers were shown afterwards). */
export function isRepeatForm(results: readonly Pick<CheckupResult, 'id' | 'at' | 'form'>[], result: Pick<CheckupResult, 'id' | 'at' | 'form'>): boolean {
  return results.some((r) => r.id !== result.id && r.form === result.form && r.at < result.at);
}

const VOICE_REGION: Readonly<Record<string, string>> = {
  'united states': 'Mỹ',
  us: 'Mỹ',
  'united kingdom': 'Anh',
  gb: 'Anh',
  uk: 'Anh',
  australia: 'Úc',
  au: 'Úc',
  canada: 'Canada',
  ca: 'Canada',
  ireland: 'Ireland',
  ie: 'Ireland',
  india: 'Ấn Độ',
  in: 'Ấn Độ',
  'new zealand': 'New Zealand',
  nz: 'New Zealand',
  'south africa': 'Nam Phi',
  za: 'Nam Phi',
};

/**
 * A short Vietnamese label for a TTS voice name, for the screen ("Ava (Mỹ)"); the full name stays in the stored
 * result. "Microsoft Ava Multilingual Online (Natural) - English (United States)" → "Ava (Mỹ)",
 * "Google UK English Female" → "Google (Anh)", "Samantha" → "Samantha".
 */
export function shortVoiceName(name: string | null | undefined): string | null {
  if (typeof name !== 'string' || !name.trim()) return null;
  let region: string | null = null;
  const loc = /\(([^()]+)\)\s*$/.exec(name.split(' - ').slice(1).join(' - ')) ?? /\ben[-_]([a-z]{2})\b/i.exec(name);
  if (loc) region = VOICE_REGION[loc[1].trim().toLowerCase()] ?? null;
  if (!region) {
    const m = /\b(US|UK|GB|AU|CA|IE|IN|NZ|ZA)\b/.exec(name);
    if (m) region = VOICE_REGION[m[1].toLowerCase()] ?? null;
  }
  let base = name.split(' - ')[0];
  base = base
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(Microsoft|Apple|Online|Natural|Neural|Multilingual|Desktop|Enhanced|Premium|Compact|English|Female|Male|US|UK|GB|en-[A-Z]{2})\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!base) base = name.trim().split(/\s+/)[0];
  if (base.length > 24) base = base.slice(0, 24).trim();
  return region ? `${base} (${region})` : base;
}
