// Ôn tập session state machine (docs/review-system.md §6.2). Pure: no React, no storage.
//
// One result per queue position. An 'again' on a non-lesson item is requeued once at the end of the
// session; a second fire at the same position (retry, double click) never records again.

import type { Grade } from '../../core/srs';
import type { CardId, ReviewKind } from '../../core/review/types';

export interface SessionResult {
  id: CardId;
  kind: ReviewKind;
  grade: Grade;
  correct: boolean;
}

export interface SessionState {
  queue: CardId[];
  original: number; // queue length at start
  pos: number;
  results: Record<number, SessionResult>; // keyed by position: one result per position
  requeued: CardId[];
  ended: boolean;
}

export function startSession(queue: readonly CardId[]): SessionState {
  return { queue: [...queue], original: queue.length, pos: 0, results: {}, requeued: [], ended: queue.length === 0 };
}

export function currentId(s: SessionState): CardId | null {
  return s.ended ? null : (s.queue[s.pos] ?? null);
}

export function isGraded(s: SessionState, pos: number): boolean {
  return Object.prototype.hasOwnProperty.call(s.results, pos);
}

/** Ignored when `pos` already has a result. 'again' on a non-lesson id not yet requeued → append to queue + requeued. */
export function recordResult(s: SessionState, pos: number, r: SessionResult): SessionState {
  if (isGraded(s, pos) || pos < 0 || pos >= s.queue.length || s.queue[pos] !== r.id) return s;
  const results = { ...s.results, [pos]: r };
  if (r.grade === 'again' && r.kind !== 'lesson' && !s.requeued.includes(r.id)) {
    return { ...s, results, queue: [...s.queue, r.id], requeued: [...s.requeued, r.id] };
  }
  return { ...s, results };
}

/** True when the result at `pos` put its item back at the end of the session. */
export function wasRequeuedAt(s: SessionState, pos: number): boolean {
  const r = s.results[pos];
  if (!r || r.grade !== 'again' || !s.requeued.includes(r.id)) return false;
  // the requeued copy sits after `pos`
  return s.queue.indexOf(r.id, pos + 1) > pos;
}

export function nextItem(s: SessionState): SessionState {
  if (s.ended) return s;
  const pos = s.pos + 1;
  return { ...s, pos, ended: pos >= s.queue.length };
}

/**
 * Undo of "Không ôn mục này nữa": put `id` back right after the item on screen. No-op when the session ended or the
 * id is still ahead in the queue. An item of the original queue stays inside the original part (progress bar).
 */
export function restoreItem(s: SessionState, id: CardId): SessionState {
  if (s.ended || s.queue.indexOf(id, s.pos) >= 0) return s;
  const at = Math.min(s.pos + 1, s.queue.length);
  const queue = [...s.queue.slice(0, at), id, ...s.queue.slice(at)];
  return { ...s, queue, original: at <= s.original ? s.original + 1 : s.original };
}

/** Leave the item without a result. */
export function skipItem(s: SessionState): SessionState {
  return nextItem(s);
}

export function endSession(s: SessionState): SessionState {
  return s.ended ? s : { ...s, ended: true };
}

export function remaining(s: SessionState): number {
  return Math.max(0, s.queue.length - s.pos);
}

/** Positions of the original queue that are passed. */
export function originalDone(s: SessionState): number {
  return Math.min(s.pos, s.original);
}

export interface SessionSummary {
  total: number;
  remembered: number;
  notYet: number;
  byKind: Partial<Record<ReviewKind, { total: number; remembered: number }>>;
}

/**
 * Counts distinct items once; remembered = no result of the id was 'again'. A miss lapses the card even when the
 * requeued copy is then answered right (that second answer does not change the card), so it stays "Chưa nhớ".
 */
export function summarizeSession(s: SessionState): SessionSummary {
  const byId = new Map<CardId, { kind: ReviewKind; missed: boolean }>();
  const positions = Object.keys(s.results)
    .map(Number)
    .sort((a, b) => a - b);
  for (const p of positions) {
    const r = s.results[p];
    const prev = byId.get(r.id);
    byId.set(r.id, { kind: r.kind, missed: (prev?.missed ?? false) || r.grade === 'again' });
  }
  const byKind: SessionSummary['byKind'] = {};
  let remembered = 0;
  for (const r of byId.values()) {
    const ok = !r.missed;
    if (ok) remembered++;
    const k = (byKind[r.kind] ??= { total: 0, remembered: 0 });
    k.total++;
    if (ok) k.remembered++;
  }
  return { total: byId.size, remembered, notYet: byId.size - remembered, byKind };
}
