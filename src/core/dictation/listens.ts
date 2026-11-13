// "Nghe 1 lần là đúng": how many times a dictation sentence was played before the answer was checked. Pure.
//
// Real speech is said once, at full speed. Practice lets the learner replay and slow down, which is right for
// learning to decode but hides how far the ear is from real listening. So every whole-sentence check carries the
// plays made BEFORE it, and a NEW sentence written fully right after one normal-speed play counts as a first-listen
// success (core/history DayAgg.once, shown in the round summary and in Báo cáo).

export interface ListenTally {
  normal: number; // "Nghe" at the learner's speed (auto-play of the next sentence included)
  slow: number; // "Chậm"
  chunks: number; // "Từng cụm"
}

export const NO_LISTENS: ListenTally = { normal: 0, slow: 0, chunks: 0 };

const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

export function totalListens(t: ListenTally | null | undefined): number {
  return t ? n(t.normal) + n(t.slow) + n(t.chunks) : 0;
}

/** Exactly one play, at the normal speed: no replay, no "Chậm", no "Từng cụm". */
export function heardOnce(t: ListenTally | null | undefined): boolean {
  return !!t && n(t.normal) === 1 && n(t.slow) === 0 && n(t.chunks) === 0;
}

/** The answer was fully right, unaided, after one normal-speed play. */
export function rightOnFirstListen(check: { score: number; hinted: boolean; revealed?: boolean; listens?: ListenTally }): boolean {
  return check.score >= 1 && !check.hinted && !check.revealed && heardOnce(check.listens);
}

/**
 * Whether a check counts in the long-term first-listen number, and as what: `undefined` = not measured, `true` =
 * heard once, `false` = needed more. Measured only on a sentence the learner has never dictated before (a replayed
 * sentence is partly memory), never on a retry of the sentence on screen, on "Điền từ", or on an answer given
 * without playing the sentence at all (nothing was heard, so nothing was measured).
 */
export function firstListenOutcome(
  check: { listens?: ListenTally },
  o: { cloze: boolean; retry: boolean; prevAttempts: number },
): boolean | undefined {
  if (o.cloze || o.retry || o.prevAttempts > 0) return undefined;
  if (totalListens(check.listens) === 0) return undefined;
  return heardOnce(check.listens);
}

/** The short note in the result line: "nghe 1 lần" | "nghe 3 lần" | "nghe 2 lần, có nghe chậm" | '' (not played). */
export function listensLabelVi(t: ListenTally | null | undefined): string {
  const total = totalListens(t);
  if (!t || total === 0) return '';
  const aided = n(t.slow) + n(t.chunks) > 0;
  if (total === 1) return aided ? 'nghe 1 lần (chậm)' : 'nghe 1 lần';
  return `nghe ${total} lần${aided ? ', có nghe chậm' : ''}`;
}
