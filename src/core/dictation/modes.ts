// Dictation route params (mode / focus / level), focus filtering, the weak-sentence list and the
// "Ôn đến hạn" queue (spaced review, docs/review-system.md §7). Pure functions, no storage, no DOM.
// Must never import core/review (the review api imports this module at runtime).

import { isDueToday, type CardState } from '../srs';
import { PHENOMENA, type Phenomenon, type Sentence } from '../types';
import type { LevelFilter, ProgressMap, SentenceProgress } from './progress';

export type DictMode = 'normal' | 'cloze' | 'review' | 'custom';

export const DICT_MODES: readonly DictMode[] = ['normal', 'cloze', 'review', 'custom'];

/** `mode` route param → mode; anything unknown falls back to the normal full-sentence mode. */
export function parseMode(v: unknown): DictMode {
  return typeof v === 'string' && (DICT_MODES as readonly string[]).includes(v) ? (v as DictMode) : 'normal';
}

/** `level` route param → 0 (all) | 1 | 2 | 3. */
export function parseLevel(v: unknown): LevelFilter {
  const s = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : '';
  return s === '1' ? 1 : s === '2' ? 2 : s === '3' ? 3 : 0;
}

/** `focus` route param → a known phenomenon, or null. */
export function parseFocus(v: unknown): Phenomenon | null {
  return typeof v === 'string' && (PHENOMENA as readonly string[]).includes(v) ? (v as Phenomenon) : null;
}

/** True when the sentence practises `focus`: author-labelled OR detected by the decoder. */
export function matchesFocus(s: Sentence, focus: Phenomenon | null, detected: readonly Phenomenon[] = []): boolean {
  if (!focus) return true;
  return (Array.isArray(s.focus) && s.focus.includes(focus)) || detected.includes(focus);
}

/** Keep only sentences that practise `focus` (null = no filter). */
export function filterByFocus(
  list: readonly Sentence[],
  focus: Phenomenon | null,
  detectedOf: (s: Sentence) => readonly Phenomenon[],
): Sentence[] {
  if (!focus) return [...list];
  return list.filter((s) => matchesFocus(s, focus, detectedOf(s)));
}

/**
 * A sentence needs review when it was never fully right, or when it was only
 * fully right with the hint and has not since been done cleanly.
 */
export function needsReview(p: SentenceProgress | undefined): boolean {
  if (!p || !(p.attempts > 0)) return false;
  if (p.best < 1) return true;
  if (!((p.hints ?? 0) > 0)) return false;
  // hinted: graduated by a perfect attempt WITHOUT the hint made after the last hinted one
  if (!p.cleanAt) return true;
  if (p.hintAt) return p.cleanAt < p.hintAt;
  return p.cleanAt !== p.lastAt; // older data without hintAt: the latest attempt must be the clean one
}

/** Weak sentences (the old "Ôn câu sai" list): sentences needing review, lowest best score first, then the oldest attempt. */
export function reviewQueue(list: readonly Sentence[], progress: ProgressMap): Sentence[] {
  return list
    .filter((s) => needsReview(progress[s.id]))
    .sort((a, b) => {
      const pa = progress[a.id];
      const pb = progress[b.id];
      return pa.best - pb.best || pa.lastAt - pb.lastAt || a.id.localeCompare(b.id);
    });
}

export function countReview(list: readonly Sentence[], progress: ProgressMap): number {
  let n = 0;
  for (const s of list) if (needsReview(progress[s.id])) n++;
  return n;
}

export type DictStates = Readonly<Record<string, CardState | undefined>>;

/** The sentence's card when it is due now (own keys only: a sentence id like "constructor" must not hit Object). */
function dueState(states: DictStates, id: string, now: number): CardState | undefined {
  const st = Object.hasOwn(states, id) ? states[id] : undefined;
  return st && isDueToday(st, now) ? st : undefined;
}

/** "Ôn đến hạn": sentences of `list` whose dict card is due (isDueToday), most overdue first (due asc, then id). */
export function dueQueue(list: readonly Sentence[], states: DictStates, now: number): Sentence[] {
  const due: { s: Sentence; at: number }[] = [];
  for (const s of list) {
    const st = dueState(states, s.id, now);
    if (st) due.push({ s, at: st.due });
  }
  return due.sort((a, b) => a.at - b.at || (a.s.id < b.s.id ? -1 : a.s.id > b.s.id ? 1 : 0)).map((d) => d.s);
}

/** Number of sentences of `list` whose dict card is due (the count "Ôn đến hạn" serves). */
export function countDue(list: readonly Sentence[], states: DictStates, now: number): number {
  let n = 0;
  for (const s of list) if (dueState(states, s.id, now)) n++;
  return n;
}

/** True when "Ôn đến hạn" serves sentence `id` now (its dict card is due). */
export function isSentenceDue(states: DictStates, id: string, now: number): boolean {
  return !!dueState(states, id, now);
}
