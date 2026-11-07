// Per-card statistics and sorting for the "Danh sách cụm từ" view. Pure module.

import { DAY, formatInterval, type CardState } from '../../core/srs';
import type { Chunk } from '../../core/types';

export type SortMode = 'rank' | 'due' | 'lapses';

export const SORT_LABEL: Record<SortMode, string> = {
  rank: 'Theo thứ tự',
  due: 'Sắp đến hạn',
  lapses: 'Hay quên',
};

export const SORT_MODES: readonly SortMode[] = ['rank', 'due', 'lapses'];

export function parseSortMode(v: unknown): SortMode {
  return typeof v === 'string' && (SORT_MODES as readonly string[]).includes(v) ? (v as SortMode) : 'rank';
}

type States = Readonly<Record<string, CardState | undefined>>;

const byRank = (a: Chunk, b: Chunk) => a.rank - b.rank || a.id.localeCompare(b.id);

/**
 * Sorted copy of `chunks`.
 * - rank: data order (most common first)
 * - due: started cards by due time (overdue first), never-studied cards last
 * - lapses: most forgotten first, then lowest ease; never-studied cards last
 */
export function sortChunks(chunks: readonly Chunk[], states: States, mode: SortMode): Chunk[] {
  const out = [...chunks];
  if (mode === 'rank') return out.sort(byRank);
  return out.sort((a, b) => {
    const sa = states[a.id];
    const sb = states[b.id];
    if (!sa || !sb) return (sa ? 0 : 1) - (sb ? 0 : 1) || byRank(a, b);
    if (mode === 'due') return sa.due - sb.due || byRank(a, b);
    return sb.lapses - sa.lapses || sa.ease - sb.ease || sa.due - sb.due || byRank(a, b);
  });
}

export type DueTone = 'overdue' | 'due' | 'soon' | 'later';

export interface DueInfo {
  label: string; // "Đến hạn", "Quá hạn 2 ngày", "còn 3 ngày", "còn 10 phút"
  tone: DueTone;
}

/** When a started card is due, in words. */
export function dueInfo(state: CardState, now: number): DueInfo {
  const diff = state.due - now;
  if (diff <= 0) {
    const days = Math.floor(-diff / DAY);
    return days >= 1 ? { label: `Quá hạn ${days} ngày`, tone: 'overdue' } : { label: 'Đến hạn', tone: 'due' };
  }
  return { label: `còn ${formatInterval(diff)}`, tone: diff < DAY ? 'soon' : 'later' };
}

/** Ease with a Vietnamese decimal comma: 2.5 → "2,5", 2.35 → "2,35". */
export function formatEase(ease: number): string {
  const r = Math.round(ease * 100) / 100;
  return String(r).replace('.', ',');
}
