// "Luyện theo hiện tượng": a short practice session limited to one phenomenon.
// New and due cards in the session are scheduled normally; cards that are not due yet are
// "extra practice" (graded and recorded in stats, but their SRS schedule is left alone).
// Pure module: no DOM, no storage.

import { isDue, type CardState, type Grade } from '../../core/srs';
import { PHENOMENA, type Chunk, type Phenomenon } from '../../core/types';

/** Cards in one focus session. */
export const FOCUS_SESSION_SIZE = 15;
/** New (never studied) cards introduced by one focus session at most. */
export const FOCUS_MAX_NEW = 5;
/** A card graded "again" comes back this many cards later (once per session). */
export const FOCUS_REQUEUE_GAP = 3;

type States = Readonly<Record<string, CardState | undefined>>;

/** Validate the `focus` route param. */
export function parseFocus(v: unknown): Phenomenon | null {
  return typeof v === 'string' && (PHENOMENA as readonly string[]).includes(v) ? (v as Phenomenon) : null;
}

/** A started card that is not due yet: grading it must not change its schedule. */
export function isExtraPractice(state: CardState | undefined, now: number): boolean {
  return !!state && !isDue(state, now);
}

export interface PhenomenonCount {
  phenomenon: Phenomenon;
  total: number; // chunks showing this phenomenon
  due: number; // started cards due now
  fresh: number; // never studied
}

/** Per-phenomenon counts for the picker, in PHENOMENA order, skipping phenomena with no chunk. */
export function phenomenonCounts(chunks: readonly Chunk[], states: States, now: number): PhenomenonCount[] {
  const map = new Map<Phenomenon, PhenomenonCount>();
  for (const p of PHENOMENA) map.set(p, { phenomenon: p, total: 0, due: 0, fresh: 0 });
  for (const c of chunks) {
    const s = states[c.id];
    for (const p of new Set(c.phenomena)) {
      const row = map.get(p);
      if (!row) continue;
      row.total += 1;
      if (!s) row.fresh += 1;
      else if (isDue(s, now)) row.due += 1;
    }
  }
  return PHENOMENA.map((p) => map.get(p)!).filter((r) => r.total > 0);
}

export interface FocusSession {
  phenomenon: Phenomenon;
  queue: string[]; // chunk ids still to show; queue[0] is the current card
  total: number; // cards planned at the start (without re-queued ones)
  done: number; // grades given in this session
  correct: number; // grades "good" / "easy"
  missed: string[]; // distinct ids graded "again" at least once
  requeued: string[]; // ids already re-queued once
}

/** How weak a started card is: more lapses, lower ease and a shorter interval come first. */
function weakness(s: CardState): number {
  return s.lapses * 10 + (3 - s.ease) * 4 - Math.min(s.interval, 60) / 10;
}

/**
 * Build a session for `phenomenon`: due cards (most overdue first), then up to
 * FOCUS_MAX_NEW new cards in rank order, then not-yet-due cards weakest first,
 * capped at `size`.
 */
export function startFocusSession(
  chunks: readonly Chunk[],
  states: States,
  phenomenon: Phenomenon,
  now: number,
  size: number = FOCUS_SESSION_SIZE,
): FocusSession {
  const due: { c: Chunk; s: CardState }[] = [];
  const fresh: Chunk[] = [];
  const extra: { c: Chunk; s: CardState }[] = [];
  const seen = new Set<string>();
  for (const c of chunks) {
    if (seen.has(c.id) || !c.phenomena.includes(phenomenon)) continue;
    seen.add(c.id);
    const s = states[c.id];
    if (!s) fresh.push(c);
    else if (isDue(s, now)) due.push({ c, s });
    else extra.push({ c, s });
  }
  due.sort((a, b) => a.s.due - b.s.due || a.c.rank - b.c.rank || a.c.id.localeCompare(b.c.id));
  fresh.sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id));
  extra.sort((a, b) => weakness(b.s) - weakness(a.s) || a.s.due - b.s.due || a.c.rank - b.c.rank);

  const cap = Math.max(1, Math.floor(size));
  const ids = [
    ...due.map((x) => x.c.id),
    ...fresh.slice(0, FOCUS_MAX_NEW).map((c) => c.id),
    ...extra.map((x) => x.c.id),
  ].slice(0, cap);
  return { phenomenon, queue: ids, total: ids.length, done: 0, correct: 0, missed: [], requeued: [] };
}

/** Session after grading its current card `id` (no-op if `id` is not the current card). */
export function advanceFocus(session: FocusSession, id: string, g: Grade): FocusSession {
  if (session.queue[0] !== id) return session;
  let queue = session.queue.slice(1);
  let requeued = session.requeued;
  if (g === 'again' && !requeued.includes(id)) {
    const at = Math.min(FOCUS_REQUEUE_GAP, queue.length);
    queue = [...queue.slice(0, at), id, ...queue.slice(at)];
    requeued = [...requeued, id];
  }
  const correct = g === 'good' || g === 'easy';
  return {
    ...session,
    queue,
    requeued,
    done: session.done + 1,
    correct: session.correct + (correct ? 1 : 0),
    missed: g === 'again' && !session.missed.includes(id) ? [...session.missed, id] : session.missed,
  };
}

/**
 * How one self-grade is scored in stats. 'good'/'easy' are correct; only 'again' counts the
 * chunk's phenomena as missed ('hard' is a pass in SRS, so it is neither correct nor missed),
 * the same rule as advanceFocus and shadowing's lowest self-rating.
 */
export function gradeOutcome(
  g: Grade,
  phenomena: readonly Phenomenon[],
): { correct: boolean; missed: Phenomenon[] } {
  return { correct: g === 'good' || g === 'easy', missed: g === 'again' ? [...phenomena] : [] };
}
