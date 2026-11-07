// Learner-facing scheduling lines (docs/review-system.md §3.10). Pure.

import { availableAt, type CardState } from '../srs';
import { seenTime } from './schedule';
import { formatDaysVi, formatDueVi, localDayDiff } from './time';
import type { ReviewEntry } from './types';

/** Why this item is in today's session. */
export function contextLineVi(entry: ReviewEntry, now: number): string {
  const s = entry.state;
  if (s.lastGrade === 'again') return 'Lần trước bạn chưa nhớ mục này';
  if (entry.kind === 'word' && s.lastGrade === undefined) return 'Từ mới trong bài bạn đã học';
  if ((entry.seenAt ?? entry.last) === 0) return 'Mục bạn từng học trước đây';
  // When the learner last met it (seenAt): a suspend toggle never counts, a far-future time (fast clock) is unknown
  const t = typeof entry.last === 'number' ? seenTime(entry, now) : undefined;
  if (t !== undefined) {
    const d = localDayDiff(Math.min(t, now), now);
    const base =
      d <= 0 ? 'Bạn vừa gặp mục này hôm nay' : d === 1 ? 'Bạn gặp mục này hôm qua' : `Bạn học mục này ${d} ngày trước`;
    return s.reps >= 1 ? `${base} · ôn lần ${s.reps + 1}` : base;
  }
  if (s.reps >= 1) return `Ôn lần ${s.reps + 1}`;
  return entry.kind === 'chunk' ? 'Cụm từ bạn đang học' : 'Mục bạn đang học';
}

/** When the item comes back after this answer. */
export function growthLineVi(prev: CardState | undefined, next: CardState, now: number): string {
  if (next.interval === 0) return `Gặp lại ${formatDueVi(availableAt(next), now)}`;
  const line = `Gặp lại sau ${formatDaysVi(next.interval)}`;
  if (prev && prev.interval >= 1 && prev.interval !== next.interval) {
    return `${line} (lần trước: ${formatDaysVi(prev.interval)})`;
  }
  return line;
}
