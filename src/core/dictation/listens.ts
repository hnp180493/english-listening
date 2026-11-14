// "Nghe 1 lần là đúng": how many times a dictation sentence was played before the answer was checked. Pure.
//
// Real speech is said once, at full speed. Practice lets the learner replay and slow down, which is right for
// learning to decode but hides how far the ear is from real listening. So every whole-sentence check carries the
// plays made BEFORE it, and a NEW sentence written fully right after one normal-speed play counts as a first-listen
// success (core/history DayAgg.once, shown in the round summary and in Báo cáo).
//
// Two things keep that number honest:
//  - speed: a press of "Nghe" is a normal-speed play only when Settings → Tốc độ đọc is at "tốc độ thường" or
//    faster (NORMAL_RATE_MIN). Below it the play is tallied as slowed, like "Chậm" (tallyKindFor);
//  - memory: the plays of a sentence, and whether its words were already on screen, are remembered for the whole
//    practice session (ListenMemory), not per mount of the exercise. Leaving the page and coming back, or meeting a
//    skipped sentence again, continues the count instead of starting at zero.

export interface ListenTally {
  normal: number; // "Nghe" with Tốc độ đọc at normal speed or faster (auto-play of the next sentence included)
  slow: number; // "Chậm", and "Nghe" while Tốc độ đọc is below normal speed
  chunks: number; // "Từng cụm"
}

/** A kind of play the tally counts ("Rõ từng từ" is not one: it only exists after the check). */
export type ListenKind = keyof ListenTally;

export const NO_LISTENS: ListenTally = { normal: 0, slow: 0, chunks: 0 };

/**
 * The lowest Settings → Tốc độ đọc that still is "tốc độ thường". ONE boundary for the whole app: the slider's hint
 * (features/settings/settingsModel rateHint) and the first-listen measurement both read it, so a speed the app
 * calls normal is measured as normal and a speed it calls "hơi chậm" is not.
 */
export const NORMAL_RATE_MIN = 0.95;

const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

/**
 * Which counter a play adds to. `mode` = the button, `baseRate` = Settings → Tốc độ đọc at the moment the play
 * starts (the learner's rate, NOT the rate the clip ran at). "Nghe" below NORMAL_RATE_MIN is a slowed play.
 *
 * Level-1 sentences: the app itself plays them at 0.9 of the learner's rate (core/playback LEVEL1_RATE_FACTOR).
 * That is the exercise's design, not the learner slowing the audio down, so it does not make the play slow: at the
 * default 1× an easy sentence still counts as normal speed although it ran at 0.9×. The first-listen number is
 * therefore a little kinder on "Dễ" sentences than on the others (stated in docs/progress-report.md §4).
 */
export function tallyKindFor(mode: ListenKind, baseRate: number): ListenKind {
  return mode === 'normal' && baseRate < NORMAL_RATE_MIN ? 'slow' : mode;
}

/** The tally after one more play of `kind` (a new object; bad counters are read as 0). */
export function addListen(t: ListenTally | null | undefined, kind: ListenKind): ListenTally {
  const next: ListenTally = { normal: n(t?.normal), slow: n(t?.slow), chunks: n(t?.chunks) };
  next[kind] += 1;
  return next;
}

export function totalListens(t: ListenTally | null | undefined): number {
  return t ? n(t.normal) + n(t.slow) + n(t.chunks) : 0;
}

/** Exactly one play, at the normal speed: no replay, no "Chậm", no "Từng cụm", Tốc độ đọc not below normal. */
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
 * sentence is partly memory), never on a retry of the sentence on screen, on "Điền từ", on a sentence whose words
 * the learner already knew when the exercise started (`known`: shown earlier in this session, or a sentence they
 * wrote themselves), or on an answer given without playing the sentence at all (nothing was heard, so nothing was
 * measured).
 */
export function firstListenOutcome(
  check: { listens?: ListenTally },
  o: { cloze: boolean; retry: boolean; prevAttempts: number; known?: boolean },
): boolean | undefined {
  if (o.cloze || o.retry || o.known || o.prevAttempts > 0) return undefined;
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

// ───────────────────────── what one practice session remembers per sentence ─────────────────────────
//
// Kept in memory by the page (features/dictation/session.ts): it lasts as long as the tab, is never stored and
// never synced. Known limit: a sentence heard or shown on another day, or on another machine, without ever being
// checked is still met as new.

export interface ListenMemory {
  /** sentence id → plays not yet followed by a check (since the session began, or since its answer was last shown) */
  plays: Map<string, ListenTally>;
  /** sentences whose words were on screen in this session: a checked answer, "Điền từ", the "Gợi ý" letters */
  shown: Set<string>;
}

export function newListenMemory(): ListenMemory {
  return { plays: new Map(), shown: new Set() };
}

/** One play of the sentence before its check. Returns its tally so far. */
export function noteListen(m: ListenMemory, id: string, kind: ListenKind): ListenTally {
  const next = addListen(m.plays.get(id), kind);
  m.plays.set(id, next);
  return next;
}

/** The plays an exercise of this sentence starts from (earlier visits in this session that ended without a check). */
export function carriedListens(m: ListenMemory, id: string): ListenTally {
  return m.plays.get(id) ?? NO_LISTENS;
}

/** The sentence's words were on screen ("Điền từ", the hint): from now on it is no first listen. */
export function noteShown(m: ListenMemory, id: string): void {
  m.shown.add(id);
}

/**
 * The sentence was checked, so its answer is on screen: it is known from now on, and its plays are spent (a retry
 * counts its own plays from zero; it is never a first listen because the sentence is `shown`).
 */
export function noteChecked(m: ListenMemory, id: string): void {
  m.shown.add(id);
  m.plays.delete(id);
}

export function wasShown(m: ListenMemory, id: string): boolean {
  return m.shown.has(id);
}

/**
 * Whether the learner already knows the words when an exercise of the sentence STARTS: a retry of the sentence on
 * screen, a sentence they wrote themselves (`own`), or one whose words were on screen earlier in this session.
 * Such an exercise is never praised or archived as a first listen (firstListenOutcome `known`). Ask once, when the
 * exercise starts: its own check marks the sentence as shown.
 */
export function knownAtStart(m: ListenMemory, id: string, o: { retry?: boolean; own?: boolean } = {}): boolean {
  return !!o.retry || !!o.own || m.shown.has(id);
}

/** The id now stands for other words (a custom sentence was edited or deleted): nothing known about it any more. */
export function forgetSentence(m: ListenMemory, id: string): void {
  m.plays.delete(id);
  m.shown.delete(id);
}
