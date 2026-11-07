// Pure model of the "Kiểm tra định kỳ" page: the step machine of a test (intro → 10 sentences → 4 passages),
// the play-count limit (MAX_PLAYS per item, no slow play), draft resume, and the result-screen helpers.
// Scoring, storage and comparison live in src/core/benchmark.ts; this file only arranges them for the UI.

import {
  compare,
  formatDeltaVi,
  MAX_PLAYS,
  type CheckupComparison,
  type CheckupDraft,
  type CheckupResult,
} from '../../core/benchmark';
import { PHENOMENON_INFO } from '../../core/phenomena';
import { MIN_TREND_CHECKUPS, SCORE_NOISE } from '../../core/progressReport';
import { PHENOMENA, type Phenomenon } from '../../core/types';
import type { BenchmarkForm, BenchmarkFormId, BenchmarkQuestion, BenchmarkSentence } from '../../data/benchmarkTypes';

/** A test in progress: exactly what is stored as the device-local draft (minus savedAt). */
export type TestState = Omit<CheckupDraft, 'savedAt'>;

export const MAX_TYPED = 500;
/** Pause between the lines of a passage (ms). */
export const LINE_PAUSE_MS = 650;

/** A fresh test on the intro screen. `startedAt` is reset when the learner presses "Bắt đầu". */
export function newTest(form: BenchmarkFormId, now: number, voiceName: string | null): TestState {
  return { form, startedAt: now, part: 'intro', index: 0, voiceName, dictation: {}, comprehension: {} };
}

/** Intro → first sentence. The duration is counted from here. */
export function beginTest(s: TestState, now: number): TestState {
  if (s.part !== 'intro') return s;
  return { ...s, part: 'dictation', index: 0, startedAt: now };
}

export type CurrentItem =
  | { kind: 'sentence'; sentence: BenchmarkSentence; index: number; count: number }
  | { kind: 'question'; question: BenchmarkQuestion; index: number; count: number };

/** The item on screen, or null on the intro (or when the index is out of range). */
export function currentItem(s: TestState, form: BenchmarkForm): CurrentItem | null {
  if (s.part === 'dictation') {
    const sentence = form.sentences[s.index];
    return sentence ? { kind: 'sentence', sentence, index: s.index, count: form.sentences.length } : null;
  }
  if (s.part === 'comprehension') {
    const question = form.questions[s.index];
    return question ? { kind: 'question', question, index: s.index, count: form.questions.length } : null;
  }
  return null;
}

const itemId = (item: CurrentItem) => (item.kind === 'sentence' ? item.sentence.id : item.question.id);

/** Plays already used on the current item. */
export function playsUsed(s: TestState, form: BenchmarkForm): number {
  const item = currentItem(s, form);
  if (!item) return 0;
  const id = itemId(item);
  const n = item.kind === 'sentence' ? s.dictation[id]?.plays : s.comprehension[id]?.plays;
  return Math.min(MAX_PLAYS, Math.max(0, n ?? 0));
}

export function playsLeft(s: TestState, form: BenchmarkForm): number {
  return currentItem(s, form) ? MAX_PLAYS - playsUsed(s, form) : 0;
}

/**
 * Count one play of the current item (call it BEFORE speaking, and save the draft, so a reload never gives a
 * free play). Records the voice when the test has none yet (voices load late in some browsers).
 * null when the item has no plays left or there is no item.
 */
export function recordPlay(s: TestState, form: BenchmarkForm, voiceName?: string | null): TestState | null {
  const item = currentItem(s, form);
  if (!item || playsLeft(s, form) <= 0) return null;
  const id = itemId(item);
  const voice = s.voiceName ?? (voiceName || null);
  if (item.kind === 'sentence') {
    const prev = s.dictation[id] ?? { typed: '', plays: 0 };
    return { ...s, voiceName: voice, dictation: { ...s.dictation, [id]: { ...prev, plays: prev.plays + 1 } } };
  }
  const prev = s.comprehension[id] ?? { chosen: null, plays: 0 };
  return { ...s, voiceName: voice, comprehension: { ...s.comprehension, [id]: { ...prev, plays: prev.plays + 1 } } };
}

/** The learner's typing on the current sentence (ignored elsewhere). */
export function setTyped(s: TestState, form: BenchmarkForm, typed: string): TestState {
  const item = currentItem(s, form);
  if (!item || item.kind !== 'sentence') return s;
  const id = item.sentence.id;
  const prev = s.dictation[id] ?? { typed: '', plays: 0 };
  const next = typed.slice(0, MAX_TYPED);
  if (prev.typed === next) return s;
  return { ...s, dictation: { ...s.dictation, [id]: { ...prev, typed: next } } };
}

/** Pick an option of the current question (ignored elsewhere or for an invalid index). */
export function choose(s: TestState, form: BenchmarkForm, option: number): TestState {
  const item = currentItem(s, form);
  if (!item || item.kind !== 'question') return s;
  if (!Number.isInteger(option) || option < 0 || option >= item.question.options.length) return s;
  const id = item.question.id;
  const prev = s.comprehension[id] ?? { chosen: null, plays: 0 };
  return { ...s, comprehension: { ...s.comprehension, [id]: { ...prev, chosen: option } } };
}

export function typedOf(s: TestState, form: BenchmarkForm): string {
  const item = currentItem(s, form);
  return item && item.kind === 'sentence' ? (s.dictation[item.sentence.id]?.typed ?? '') : '';
}

export function chosenOf(s: TestState, form: BenchmarkForm): number | null {
  const item = currentItem(s, form);
  return item && item.kind === 'question' ? (s.comprehension[item.question.id]?.chosen ?? null) : null;
}

/**
 * Why "next" should not go on yet: 'not-played' (listen first), 'empty' (nothing typed / no option chosen:
 * the page asks once, a second press skips the item). null = fine.
 */
export type Blocker = 'not-played' | 'empty' | null;

export function blocker(s: TestState, form: BenchmarkForm): Blocker {
  const item = currentItem(s, form);
  if (!item) return null;
  if (playsUsed(s, form) === 0) return 'not-played';
  if (item.kind === 'sentence') return typedOf(s, form).trim() ? null : 'empty';
  return chosenOf(s, form) === null ? 'empty' : null;
}

/** Move to the next item. `done` = the last passage was answered: build and save the result. */
export function advance(s: TestState, form: BenchmarkForm): { state: TestState; done: boolean } {
  if (s.part === 'dictation') {
    if (s.index + 1 < form.sentences.length) return { state: { ...s, index: s.index + 1 }, done: false };
    if (form.questions.length) return { state: { ...s, part: 'comprehension', index: 0 }, done: false };
    return { state: s, done: true };
  }
  if (s.part === 'comprehension') {
    if (s.index + 1 < form.questions.length) return { state: { ...s, index: s.index + 1 }, done: false };
    return { state: s, done: true };
  }
  return { state: s, done: false };
}

/** "Câu 3/10" / "Đoạn 2/4". */
export function stepLabel(s: TestState, form: BenchmarkForm): string {
  const item = currentItem(s, form);
  if (!item) return '';
  return `${item.kind === 'sentence' ? 'Câu' : 'Đoạn'} ${item.index + 1}/${item.count}`;
}

/** Label of the "next" button for the current item. */
export function nextLabel(s: TestState, form: BenchmarkForm): string {
  const item = currentItem(s, form);
  if (!item) return 'Bắt đầu';
  if (item.kind === 'sentence') {
    if (item.index + 1 < item.count) return 'Câu tiếp';
    return form.questions.length ? 'Sang phần 2' : 'Nộp bài';
  }
  return item.index + 1 < item.count ? 'Đoạn tiếp' : 'Nộp bài';
}

/** Items finished before the current one, over the whole test (0..100). */
export function progressPct(s: TestState, form: BenchmarkForm): number {
  const total = form.sentences.length + form.questions.length;
  if (!total || s.part === 'intro') return 0;
  const before = s.part === 'dictation' ? s.index : form.sentences.length + s.index;
  return Math.round((Math.min(before, total) / total) * 100);
}

/** Label of the listen button: "Nghe", then "Nghe (còn 1 lần)", then "Hết lượt nghe". */
export function playLabel(used: number, playing: boolean): string {
  if (playing) return 'Đang phát…';
  const left = MAX_PLAYS - Math.min(MAX_PLAYS, Math.max(0, used));
  if (used <= 0) return 'Nghe';
  return left > 0 ? `Nghe (còn ${left} lần)` : 'Hết lượt nghe';
}

/**
 * A stored draft → a test to resume, or null when it cannot be resumed: unknown form, still on the intro
 * (nothing done yet). Answers to ids outside the form are dropped; the index and play counts are clamped.
 */
export function resumeDraft(draft: CheckupDraft | null, forms: readonly BenchmarkForm[]): TestState | null {
  if (!draft || draft.part === 'intro') return null;
  const form = forms.find((f) => f.id === draft.form);
  if (!form) return null;
  const sIds = new Set(form.sentences.map((x) => x.id));
  const qIds = new Set(form.questions.map((x) => x.id));
  const dictation: TestState['dictation'] = {};
  for (const [id, a] of Object.entries(draft.dictation ?? {})) {
    if (sIds.has(id) && a) dictation[id] = { typed: String(a.typed ?? '').slice(0, MAX_TYPED), plays: Math.min(MAX_PLAYS, Math.max(0, a.plays | 0)) };
  }
  const comprehension: TestState['comprehension'] = {};
  for (const [id, a] of Object.entries(draft.comprehension ?? {})) {
    if (!qIds.has(id) || !a) continue;
    const q = form.questions.find((x) => x.id === id);
    const chosen = typeof a.chosen === 'number' && q && a.chosen >= 0 && a.chosen < q.options.length ? a.chosen : null;
    comprehension[id] = { chosen, plays: Math.min(MAX_PLAYS, Math.max(0, a.plays | 0)) };
  }
  let part = draft.part;
  const max = part === 'dictation' ? form.sentences.length : form.questions.length;
  let index = Math.max(0, Math.floor(draft.index || 0));
  if (index >= max) {
    if (part === 'dictation' && form.questions.length) {
      part = 'comprehension';
      index = 0;
    } else index = Math.max(0, max - 1);
  }
  return { form: form.id, startedAt: draft.startedAt, part, index, voiceName: draft.voiceName, dictation, comprehension };
}

// ───────────────────────── option order ─────────────────────────

/** FNV-1a hash of a string (seed of the option shuffle). */
function hash32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The order the options of a passage question are shown in for this attempt: a shuffle seeded by the test's
 * start time and the question id, so it is stable across a reload (the draft keeps startedAt) but differs from
 * one test to the next. The position of the right answer cannot be learnt from a previous test. Indices are
 * original option indices: what is stored (`chosen`) is always the original index.
 */
export function optionOrder(s: Pick<TestState, 'startedAt'>, q: Pick<BenchmarkQuestion, 'id' | 'options'>): number[] {
  const order = q.options.map((_, i) => i);
  let x = hash32(`${s.startedAt}|${q.id}`) || 1;
  const rand = () => {
    // xorshift32
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

// ───────────────────────── result screen ─────────────────────────

/** Comparison of one stored result with the first and the previous one (results taken up to it). */
export function comparisonFor(results: readonly CheckupResult[], id: string): { cmp: CheckupComparison; first: CheckupResult; prev: CheckupResult | null; count: number } | null {
  const sorted = [...results].sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1));
  const k = sorted.findIndex((r) => r.id === id);
  if (k < 0) return null;
  const upTo = sorted.slice(0, k + 1);
  const first = upTo[0];
  const prev = k > 0 ? upTo[k - 1] : null;
  return { cmp: compare(first, prev, upTo[k]), first, prev, count: upTo.length };
}

export interface DeltaInfo {
  text: string; // "+12 điểm", "−3 điểm", "không đổi"
  tone: 'up' | 'down' | 'flat';
  small: boolean; // within SCORE_NOISE: could be the form, not the learner
}

export function deltaInfo(n: number, unit = 'điểm'): DeltaInfo {
  const v = Number.isFinite(n) ? Math.round(n) : 0;
  return { text: formatDeltaVi(v, unit), tone: v > 0 ? 'up' : v < 0 ? 'down' : 'flat', small: Math.abs(v) <= SCORE_NOISE };
}

/**
 * One or two honest sentences about the change. Baseline → says it is the reference point. Small changes are
 * called "gần như không đổi"; with only 2 tests the wording stays tentative.
 */
export function comparisonSummary(info: { cmp: CheckupComparison; first: CheckupResult; prev: CheckupResult | null; count: number }): string {
  const { cmp, first, count } = info;
  if (cmp.isBaseline || !cmp.vsFirst) {
    return 'Đây là lần kiểm tra đầu tiên: điểm này là mốc để so sánh. Làm lại sau khoảng 2 tuần để thấy mình tiến bộ bao nhiêu.';
  }
  const d = cmp.vsFirst.score;
  const from = first.score;
  const to = cmp.latest.score;
  let s: string;
  if (Math.abs(d) <= SCORE_NOISE)
    s = `Điểm chưa thay đổi rõ so với lần đầu (${from} → ${to}): mỗi câu nghe hiểu là 10 điểm, nên chênh từ ${SCORE_NOISE} điểm trở xuống có thể chỉ do đề hoặc may rủi.`;
  else if (d > 0) s = `Điểm tăng từ ${from} lên ${to} so với lần đầu.`;
  else s = `Điểm thấp hơn lần đầu (${from} → ${to}). Một lần thấp chưa nói lên nhiều: đề khác, lúc mệt cũng làm điểm dao động.`;
  // The previous test, when it points the other way (the table below has the numbers).
  const p = cmp.vsPrev;
  if (p && info.prev && info.prev.id !== first.id && Math.abs(p.score) > SCORE_NOISE && Math.sign(p.score) !== Math.sign(d)) {
    s += p.score > 0 ? ` So với lần trước thì cao hơn ${p.score} điểm.` : ` So với lần trước thì thấp hơn ${-p.score} điểm.`;
  }
  if (count < MIN_TREND_CHECKUPS && Math.abs(d) > SCORE_NOISE) s += ` Mới có ${count} lần, cần khoảng ${MIN_TREND_CHECKUPS} lần mới chắc được xu hướng.`;
  return s;
}

export interface PhenomenonRow {
  p: Phenomenon;
  label: string;
  seen: number; // sentences with this phenomenon
  missed: number; // of those, sentences where a word of it was heard wrong
  missPct: number;
  firstMissPct: number | null; // the first checkup's miss rate (null on the baseline / not seen then)
}

/** Phenomena seen in the dictation part, most missed first. */
export function phenomenonRows(result: CheckupResult, cmp: CheckupComparison | null): PhenomenonRow[] {
  const change = new Map((cmp?.phenomena ?? []).map((c) => [c.phenomenon, c]));
  const rows: PhenomenonRow[] = [];
  for (const p of PHENOMENA) {
    const v = result.byPhenomenon[p];
    if (!v || v.seen <= 0) continue;
    rows.push({
      p,
      label: PHENOMENON_INFO[p].label,
      seen: v.seen,
      missed: v.missed,
      missPct: Math.round((v.missed / v.seen) * 100),
      firstMissPct: cmp && !cmp.isBaseline ? (change.get(p)?.firstMissPct ?? null) : null,
    });
  }
  return rows.sort((a, b) => b.missPct - a.missPct || b.missed - a.missed || PHENOMENA.indexOf(a.p) - PHENOMENA.indexOf(b.p));
}

/** The phenomenon to practise next: the highest miss rate, preferring ones seen in 2+ sentences. null = none missed. */
export function weakestPhenomenon(result: CheckupResult): Phenomenon | null {
  const rows = phenomenonRows(result, null).filter((r) => r.missed > 0);
  if (!rows.length) return null;
  return (rows.find((r) => r.seen >= 2) ?? rows[0]).p;
}

/** "9 phút 40 giây" / "45 giây". */
export function durationVi(sec: number): string {
  const s = Math.max(0, Math.round(Number.isFinite(sec) ? sec : 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r} giây`;
  if (m >= 60) return `${Math.floor(m / 60)} giờ ${m % 60} phút`;
  return r ? `${m} phút ${r} giây` : `${m} phút`;
}

/** "06/11/2026". */
export function dateVi(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}
