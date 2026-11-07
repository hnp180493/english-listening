// Pure helpers for DictationPage: the URL ⇄ filter contract, stats outcome of a check, the spaced-review
// grade of a check, and read-modify-write access to the stored progress. Kept free of React so they can be
// unit-tested. Review imports name specific core/review files, never the barrel (docs/review-system.md §11).

import { parseFocus, parseLevel, parseMode, type DictMode } from '../../core/dictation/modes';
import { sanitizeProgress, type ProgressMap } from '../../core/dictation/progress';
import { gradeDictation } from '../../core/review/grading';
import { formatDueVi } from '../../core/review/time';
import type { ApplyResult, ReviewContext } from '../../core/review/types';
import { availableAt, type Grade } from '../../core/srs';
import { KEYS, STORAGE_PREFIX } from '../../core/storage';
import { MINE_TOPIC } from './constants';
import type { DictFilters } from './session';

/** What the page shows: the filters plus the topic select (topic only applies to normal / cloze). */
export interface DictView {
  filters: DictFilters;
  topic: string; // '' = all topics, MINE_TOPIC = my sentences, else a topic label
}

export const usesTopic = (mode: DictMode): boolean => mode === 'normal' || mode === 'cloze';

/** Route params that make a #/dictation link explicit. */
export const FILTER_PARAMS = ['mode', 'level', 'focus', 'topic'] as const;

export const hasFilterParams = (params: Record<string, string>): boolean => FILTER_PARAMS.some((k) => !!params[k]);

/** A topic value that the select can show, or '' (all topics). */
export function validTopic(t: unknown, topics: readonly string[]): string {
  return typeof t === 'string' && (t === MINE_TOPIC || topics.includes(t)) ? t : '';
}

/** The view a URL asks for: missing params mean the defaults (normal, all levels, any phenomenon, all topics). */
export function viewFromParams(params: Record<string, string>, topics: readonly string[]): DictView {
  const filters: DictFilters = { mode: parseMode(params.mode), level: parseLevel(params.level), focus: parseFocus(params.focus) };
  return { filters, topic: usesTopic(filters.mode) ? validTopic(params.topic, topics) : '' };
}

/** Identity of a view as the URL sees it (the topic only counts in modes that use it). */
export function viewKey(v: DictView): string {
  const { mode, level, focus } = v.filters;
  return `${mode}|${level}|${focus ?? ''}|${usesTopic(mode) ? v.topic : ''}`;
}

/** Route params for a view (defaults are left out so the URL stays short). */
export function paramsOf(v: DictView): Record<string, string | number | undefined> {
  const { mode, level, focus } = v.filters;
  return {
    mode: mode !== 'normal' ? mode : undefined,
    level: level || undefined,
    focus: focus ?? undefined,
    topic: usesTopic(mode) && v.topic ? v.topic : undefined,
  };
}

/**
 * The view to show for a #/dictation URL. A URL with any filter param is a complete request (a link from
 * another page starts from "all topics" unless it names one); a bare #/dictation keeps `current` — the same
 * rule whether the page is just mounting (current = last session) or already open (current = on screen).
 */
export function resolveView(params: Record<string, string>, current: DictView, topics: readonly string[]): DictView {
  if (hasFilterParams(params)) return viewFromParams(params, topics);
  return { filters: current.filters, topic: validTopic(current.topic, topics) };
}

/**
 * How a check counts in the shared stats. A retry of the sentence on screen (after the answer was shown)
 * is not a new attempt, and a perfect answer made with the hint is not counted as correct.
 */
export function statsOutcome(info: { score: number; hinted: boolean }, retry: boolean): { record: boolean; correct: boolean } {
  return { record: !retry, correct: info.score === 1 && !info.hinted };
}

/** The parts of a dictation check the review grade needs (Exercise's CheckedInfo). */
export interface ReviewCheck {
  hinted: boolean;
  total?: number;
  matched?: number;
  extra?: number;
  revealed?: boolean;
}

/**
 * How a dictation check is graded for spaced review (docs/review-system.md §5), or null when it is not: "Điền từ"
 * never grades, a retry of the sentence on screen is practice only, and a check without word counts cannot be
 * graded. `prevAttempts` = dictation attempts of the sentence BEFORE this check (a first-ever perfect answer is
 * `easy`). In "Ôn đến hạn" the context is 'review' (the api applies the not-due rule itself).
 */
export function reviewGradeFor(
  info: ReviewCheck,
  o: { mode: DictMode; retry: boolean; prevAttempts: number },
): { grade: Grade; ctx: ReviewContext } | null {
  if (o.mode === 'cloze' || o.retry) return null;
  if (typeof info.total !== 'number') return null;
  const review = o.mode === 'review';
  const grade = gradeDictation({
    total: info.total,
    matched: info.matched ?? 0,
    extra: info.extra ?? 0,
    hinted: info.hinted,
    revealed: !!info.revealed,
    firstTry: !review && !(o.prevAttempts > 0),
    kind: 'dict',
  });
  return { grade, ctx: review ? 'review' : 'practice' };
}

/**
 * The muted line shown under a graded sentence (dictation and video lines): when it comes back in Ôn tập, or
 * why it was not added today. null when there is nothing to say (not enrolled, suspended, nothing recorded).
 */
export function reviewNoteVi(r: Pick<ApplyResult, 'current' | 'reason'> | null | undefined, now: number): string | null {
  if (!r) return null;
  if (r.reason === 'over-budget') return 'Bạn đã nhớ câu này. Hôm nay Ôn tập đã đủ mục mới.';
  const shown = ['enrolled', 'graded', 'lapsed', 'pulled-in', 'skipped-not-due'];
  if (!r.current || !shown.includes(r.reason)) return null;
  return `Câu này sẽ quay lại trong Ôn tập ${formatDueVi(availableAt(r.current), now)}.`;
}

/** Stored dictation progress (empty when missing or unreadable). */
export function loadProgress(): ProgressMap {
  return loadProgressOr({});
}

/**
 * Stored dictation progress, read fresh so a write builds on what another tab (or a backup restore / wipe)
 * left there. Falls back to `fallback` only when storage itself cannot be read.
 */
export function loadProgressOr(fallback: ProgressMap): ProgressMap {
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + KEYS.dictation);
    return raw == null ? {} : sanitizeProgress(JSON.parse(raw));
  } catch {
    return fallback;
  }
}

/** True when a 'storage' event (another tab) may have changed `key`; a null key means storage was cleared. */
export function storageEventTouches(eventKey: string | null, key: string): boolean {
  return eventKey === null || eventKey === STORAGE_PREFIX + key;
}

/** Scroll behaviour that honours the OS "reduce motion" setting (kept as an alias of the shared helper). */
export { scrollBehavior } from '../../core/motion';

// ------------------------------------------------------------ sentence links (#/dictation?id=…)

/** The facts about a linked sentence that decide which mode / topic can show it. */
export interface LinkedSentence {
  custom: boolean; // one of the learner's own sentences
  topic: string; // its topic label ('' for custom sentences)
  cloze: boolean; // "Điền từ" can make at least one blank in it
  review: boolean; // "Ôn đến hạn" serves it now (its dict card is due)
}

/** The `id` route param when it names a sentence the page knows, else ''. */
export function linkedId(raw: unknown, known: (id: string) => boolean): string {
  return typeof raw === 'string' && raw !== '' && known(raw) ? raw : '';
}

/**
 * The view to open for a link to one sentence: the requested view, with the mode / topic changed only when
 * they cannot contain that sentence (a built-in sentence linked with mode=custom opens in "Chép cả câu",
 * a custom one linked with mode=normal opens in "Câu của tôi", and so on). Level and focus are kept: the
 * linked sentence is put first in the queue even when they would filter it out.
 */
export function viewForSentence(v: DictView, s: LinkedSentence): DictView {
  const { mode } = v.filters;
  const to = (m: DictMode, topic: string): DictView =>
    m === mode && topic === v.topic ? v : { filters: { ...v.filters, mode: m }, topic };
  if (mode === 'review') {
    if (s.review) return v;
    return s.custom ? to('custom', '') : to('normal', '');
  }
  if (s.custom) {
    if (mode === 'custom') return v;
    // "Câu của tôi" topic of normal / cloze also holds custom sentences
    if (v.topic === MINE_TOPIC) return mode === 'cloze' && !s.cloze ? to('normal', MINE_TOPIC) : v;
    return to('custom', '');
  }
  if (mode === 'custom') return to('normal', '');
  const topic = v.topic && v.topic !== s.topic ? '' : v.topic;
  return to(mode === 'cloze' && !s.cloze ? 'normal' : mode, topic);
}

/** What the page compares to notice a new request in the URL: the view, plus the linked sentence if any. */
export function routeSignature(v: DictView, id: string): string {
  return id ? `${viewKey(v)}#${id}` : viewKey(v);
}

/** `ids` with `first` moved (or added) to the front. */
export function withFirst(ids: readonly string[], first: string): string[] {
  return [first, ...ids.filter((id) => id !== first)];
}
