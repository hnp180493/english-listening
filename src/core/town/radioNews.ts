// News about the player for Bay FM's next bulletin (docs/town.md §25, docs/gta-plan.md §4.5: "cộng tin về chính việc
// mày làm"). Another module queues an item when the player has done something the city would talk about (milestone
// M0's job will want "Bay FM reports what the player just did"); the next generated bulletin (./radio bulletinAt,
// through ./radioStore) reads it after the time check, and it is dropped once that bulletin has been heard through.
//
// Kept IN MEMORY only, on purpose: news is of the moment. A reload, or `until` passing, forgets it; nothing is stored
// or synced. Marcus reads it in the browser's voice like everything on Bay FM (never a clip).
//
//   import { queueRadioNews } from '../core/town/radioNews';
//   queueRadioNews({ id: 'job-ferry-clean', lines: [{ text: 'A tape reached this studio tonight.', vi: '…' }] });

import type { RadioNewsItem } from './radio';

export type { RadioNewsItem };

/** At most this many items wait; a new one pushes the oldest out. */
export const NEWS_MAX = 3;
/** An item is forgotten after this long unless it says otherwise: six real hours. */
export const NEWS_TTL_MS = 6 * 60 * 60 * 1000;
/** Lines per item: a short story, not a programme. */
export const NEWS_LINES_MAX = 4;

interface Queued extends RadioNewsItem {
  until: number;
}

let queue: Queued[] = [];

/**
 * Queue a news item for the next bulletin. Same `id` again replaces it (no story twice). Lines are Marcus's words:
 * written English (3–16 words, ending like a sentence) with a Vietnamese meaning, and `say` when the decoder's own
 * connected version would be wrong. Returns false when the item is not usable (no id, no line, a line without words).
 */
export function queueRadioNews(item: RadioNewsItem & { until?: number }, now: number = Date.now()): boolean {
  const lines = (item.lines ?? []).filter((l) => typeof l.text === 'string' && l.text.trim() && typeof l.vi === 'string' && l.vi.trim());
  if (!item.id || lines.length === 0 || lines.length !== item.lines.length || lines.length > NEWS_LINES_MAX) return false;
  queue = queue.filter((q) => q.id !== item.id && q.until > now);
  queue.push({ id: item.id, lines: lines.map((l) => ({ text: l.text.trim(), vi: l.vi.trim(), ...(l.say ? { say: l.say } : {}) })), until: item.until ?? now + NEWS_TTL_MS });
  while (queue.length > NEWS_MAX) queue.shift();
  return true;
}

/** What waits for the next bulletin, oldest first. */
export function pendingRadioNews(now: number = Date.now()): RadioNewsItem[] {
  return queue.filter((q) => q.until > now).map(({ id, lines }) => ({ id, lines }));
}

/** A bulletin with these items was heard through: they are not read again. */
export function markRadioNewsAired(ids: readonly string[]): void {
  if (ids.length === 0) return;
  const gone = new Set(ids);
  queue = queue.filter((q) => !gone.has(q.id));
}

/** Tests only: an empty queue. */
export function clearRadioNews(): void {
  queue = [];
}
