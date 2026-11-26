// "Phi vụ" (docs/gta-plan.md §3, milestone M0): a job in Westbay played in four beats, where what was HEARD is
// answered by ACTING in the world, and a mishearing has a consequence in the world instead of "wrong, try again".
//   1. the briefing: a phone call; the learner fills in a NOTEBOOK (each entry three look-alike ways to write it).
//      Nothing says right or wrong then: the job leads the learner by what THEY wrote;
//   2. on the way: to the pickup they noted, then the passenger's spoken directions: at each junction the car stops
//      and the learner picks the way (left / straight / right), the same with a finger or the keys;
//   3. on site: overhearing two people (each line heard clearly, faintly or not at all by the distance when it starts,
//      a step less in rain) and typing the password just heard;
//   4. the outcome: no fail state; the grade counts the consequences hit; then the words and Bay FM's news.
// A wrong note never forks the story: it has ONE consequence that plays out in the world and then rejoins the main
// line (owner's review, 2026-11-26). Hearing again is an action with a cost, counted per fact ("heard once" honestly).
// Pure: the rules only. A job's shape is ./jobDoc.ts, the jobs are data (data/city/jobs/), the engine and its panels
// features/town/jobs/.
// Nothing here is a measure of level: grades and xu are a game score (docs/progress-report.md §6).

import { GAME_DAY_MS, gameMinutes } from './sky';

// ───────────────────────── the script's shape ─────────────────────────

/** One line of a job: who says it (a person of Westbay, or a voice only heard), what, and its meaning. */
export interface JobLine {
  /** Stable id `job-<job>-<key>`; never change it (a review card may point at it). */
  id: string;
  /** A city person's id (core/town/cityPeople) or a key of SCENE_VOICES. Westbay people only: browser voice. */
  who: string;
  /** What is said (3–16 words). `{time}` is the time of the job's appointment, in words. */
  text: string;
  /** Natural Vietnamese meaning. `{time}` as above, in digits. */
  vi: string;
  /** How it sounds said naturally, when the decoder's own version would be wrong. */
  say?: string;
  /** Said in pieces with a silence (a hiss) at every "..." of the text: a line over a bad radio (core/town/jobDoc.ts §2). */
  broken?: boolean;
}

/** A point of the map's tile grid. */
export interface TilePt {
  x: number;
  y: number;
}

/** One way to write a notebook entry: what it leads the learner to (a place id, a game minute, a street…). */
export interface NoteOption {
  value: string;
  /** What is written, in Vietnamese (names as they are). */
  label: string;
}

/** A notebook entry's key ('pickup', 'time', 'name'…; 'time' is the appointment, its options made from it). */
export type NoteKey = string;

export interface NoteEntry {
  key: NoteKey;
  /** The entry's heading in the notebook ("Đón ở đâu"). */
  label: string;
  /** The line of the call that says it (missed when the entry was written wrong). */
  line: string;
  /** The right value. For 'time' the options are made from the appointment (timeOptions). */
  answer: string;
  /** Three ways to write it, the right one among them (none for 'time'). */
  options: readonly NoteOption[];
}

export type Turn = 'left' | 'straight' | 'right';
export const TURNS: readonly Turn[] = ['left', 'straight', 'right'];

/**
 * A junction on the passenger's way (Westbay has no street data: the junctions of a job's route are its own small
 * table). The car stops at `at`; the passenger said `line` on the way there; the ways out are the streets that leave
 * it (seen from the car: left, straight on, right), the right one leads on, a wrong one goes a few tiles that way and
 * the passenger says `line` of that way.
 */
export interface Junction {
  /** Stable id (a fact of the debrief). */
  id: string;
  /** The two streets, for the debrief ("Market Street × College Road"). */
  name: string;
  at: TilePt;
  line: string;
  right: Turn;
  ways: Partial<Record<Turn, { to: TilePt; line?: string }>>;
}

// ───────────────────────── the clock: an appointment in the game's time ─────────────────────────

/** Real milliseconds in a minute of the game (a game day is 48 real minutes). */
export const GAME_MINUTE_MS = GAME_DAY_MS / (24 * 60);
const DAY_MIN = 24 * 60;

/** How far ahead of the call the appointment is, at least (game minutes; 2.5 real minutes). */
export const APPOINT_AHEAD = 75;
/** Minutes late that still count as on time. */
export const ON_TIME_GRACE = 5;

/** A minute of the day into 0 … 1439. */
export const dayMinute = (m: number): number => ((Math.round(m) % DAY_MIN) + DAY_MIN) % DAY_MIN;

/**
 * How a job says its appointment (JobDoc.clock): 'quarter' (the default) a quarter past or to an hour ("quarter to
 * seven": past / to is the pair a careless ear mixes up); 'half' half past, said the British way ("half five", which
 * many learners take for 4:30); 'ten' ten past or to ("ten past six" / "ten to six").
 */
export type ClockStyle = 'quarter' | 'half' | 'ten';

/** The minutes past the hour an appointment of a style can fall on. */
export const CLOCK_MINUTES: Readonly<Record<ClockStyle, readonly number[]>> = { quarter: [15, 45], half: [30], ten: [10, 50] };

/**
 * The appointment for a call made at `nowMs`: the first minute of the style at least APPOINT_AHEAD game minutes ahead
 * (a minute of the day).
 */
export function appointment(nowMs: number, style: ClockStyle = 'quarter'): number {
  const from = Math.ceil(gameMinutes(nowMs) + APPOINT_AHEAD);
  for (let m = from; m < from + 61; m++) if (CLOCK_MINUTES[style].includes(dayMinute(m) % 60)) return dayMinute(m);
  return dayMinute(from);
}

const HOUR_WORDS = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven'] as const;

/**
 * A minute of the day said the everyday way: "quarter to seven", "quarter past six", "ten past six", "ten to six",
 * "half past" ("half five" in the 'half' style), "o'clock".
 */
export function timeWords(minute: number, style: ClockStyle = 'quarter'): string {
  const m = dayMinute(minute);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const word = (hour: number) => HOUR_WORDS[hour % 12];
  if (mm === 0) return `${word(h)} o'clock`;
  if (mm === 10) return `ten past ${word(h)}`;
  if (mm === 15) return `quarter past ${word(h)}`;
  if (mm === 30) return style === 'half' ? `half ${word(h)}` : `half past ${word(h)}`;
  if (mm === 45) return `quarter to ${word(h + 1)}`;
  if (mm === 50) return `ten to ${word(h + 1)}`;
  return `${word(h)} ${mm < 10 ? `oh ${mm}` : mm}`;
}

/** "18:45": a minute of the day as the HUD's clock shows it. */
export function clockOf(minute: number): string {
  const m = dayMinute(minute);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * The three ways to write the appointment: the right one and what a half-listening ear writes instead.
 * 'quarter': quarter to H (H−1:45) → H−1:45, H:15, H:45; quarter past H → H:15, H−1:45, H:45.
 * 'half': half five (5:30) → 5:30, 4:30 ("half to five", as in German), 5:00 (only "five" kept).
 * 'ten': ten past six (6:10) → 6:10, 5:50 ("to" for "past"), 7:10; ten to six (5:50) → 5:50, 6:10, 6:50.
 */
export function timeOptions(minute: number, style: ClockStyle = 'quarter'): number[] {
  const m = dayMinute(minute);
  if (style === 'half') return [m, dayMinute(m - 60), dayMinute(m - 30)];
  if (style === 'ten') return m % 60 === 10 ? [m, dayMinute(m - 20), dayMinute(m + 60)] : [m, dayMinute(m + 20), dayMinute(m + 60)];
  return m % 60 === 45 ? [m, dayMinute(m + 30), dayMinute(m + 60)] : [m, dayMinute(m - 30), dayMinute(m + 30)];
}

/** Signed game minutes from `minute` to the clock at `nowMs` (late > 0), within half a day either way. */
export function minutesPast(minute: number, nowMs: number): number {
  const d = dayMinute(gameMinutes(nowMs) - minute);
  return d > DAY_MIN / 2 ? d - DAY_MIN : d;
}

/** The real time (epoch ms) at which the game's clock next shows `minute`, seen from `nowMs` (now if it is now). */
export function realTimeOf(minute: number, nowMs: number): number {
  return nowMs - minutesPast(minute, nowMs) * GAME_MINUTE_MS;
}

/** Got to the pickup after the appointment (and its grace)? */
export function arrivedLate(minute: number, nowMs: number): boolean {
  return minutesPast(minute, nowMs) > ON_TIME_GRACE;
}

// ───────────────────────── the notebook ─────────────────────────

/** A line with the appointment filled in: `{time}` in words in the English, in digits in the Vietnamese. */
export function fillLine<L extends Pick<JobLine, 'text' | 'vi'>>(line: L, minute: number | null, style: ClockStyle = 'quarter'): L {
  if (minute === null || !line.text.includes('{time}')) return line;
  return { ...line, text: line.text.replaceAll('{time}', timeWords(minute, style)), vi: line.vi.replaceAll('{time}', clockOf(minute)) };
}

/** The options of an entry as offered, in an order fixed by `seed` (the right one not always first). */
export function noteOptions(entry: NoteEntry, minute: number, seed: number, style: ClockStyle = 'quarter'): NoteOption[] {
  const all = entry.key === 'time' ? timeOptions(minute, style).map((m) => ({ value: String(m), label: clockOf(m) })) : [...entry.options];
  const k = ((Math.floor(seed) % all.length) + all.length) % all.length;
  return [...all.slice(k), ...all.slice(0, k)];
}

/** The right value of an entry (the appointment for 'time'). */
export function noteAnswer(entry: NoteEntry, minute: number): string {
  return entry.key === 'time' ? String(dayMinute(minute)) : entry.answer;
}

/** The entries written down wrong (or not at all). */
export function notesWrong(entries: readonly NoteEntry[], picks: Readonly<Partial<Record<NoteKey, string>>>, minute: number): NoteKey[] {
  return entries.filter((e) => picks[e.key] !== noteAnswer(e, minute)).map((e) => e.key);
}

// ───────────────────────── on the way: the junctions ─────────────────────────

/** The ways out of a junction, in the order left, straight, right. */
export const waysOf = (j: Junction): Turn[] => TURNS.filter((t) => !!j.ways[t]);

/** A way picked at a junction: the right one, a wrong one, or none that leaves it. */
export function chooseTurn(j: Junction, turn: Turn): 'right' | 'wrong' | 'none' {
  if (!j.ways[turn]) return 'none';
  return turn === j.right ? 'right' : 'wrong';
}

/** "Xin nhắc lại" the passenger takes with good grace; past it he minds (a consequence). */
export const PATIENCE = 2;

// ───────────────────────── on site: overhearing ─────────────────────────

/** Nearer than this, the two talking see you listening: they notice you (tiles). */
export const NOTICED_WITHIN = 1.8;
/** Heard clearly up to here, faintly up to FAINT_WITHIN, not at all beyond (tiles). */
export const CLEAR_WITHIN = 3.5;
export const FAINT_WITHIN = 7;

export type Clarity = 'clear' | 'faint' | 'none';

/**
 * How a line overheard is heard: decided when it starts (the browser's voice takes its volume then and keeps it) by
 * the distance to whoever says it; rain (`rain` 0 … 1 from the sky: core/town/sky.ts SkyMix) above a half takes it
 * down a step. No noise is mixed over the speech.
 */
export function overhearClarity(distance: number, rain: number): Clarity {
  const base: Clarity = distance <= CLEAR_WITHIN ? 'clear' : distance <= FAINT_WITHIN ? 'faint' : 'none';
  if (rain < 0.5) return base;
  return base === 'clear' ? 'faint' : 'none';
}

/** The browser voice's volume for a clarity (0 = not said at all, only its time passes). */
export const CLARITY_VOLUME: Readonly<Record<Clarity, number>> = { clear: 1, faint: 0.3, none: 0 };

// ───────────────────────── the outcome ─────────────────────────

/** Sạch / Lộn xộn / Hỏng (the grade counts the consequences hit: core/town/jobDoc gradeHits). A game score. */
export type JobGrade = 'clean' | 'messy' | 'broken';

/** Xu for a grade (a game score). Paid for the first run of a day only. */
export const JOB_PAY: Readonly<Record<JobGrade, number>> = { clean: 64, messy: 32, broken: 10 };

/** A harder job (JobDoc.level) pays more: the grade's pay times this (docs/town.md §31 "Kinh tế"). */
export const JOB_LEVEL_FACTOR: Readonly<Record<1 | 2 | 3, number>> = { 1: 1, 2: 1.2, 3: 1.45 };

/** Jobs that pay in a real day, on every browser (the rest replay for nothing): replays are not a living. */
export const JOBS_PAID_A_DAY = 2;

/** What a grade pays on a job of `level` (1 … 3). */
export function jobLevelPay(grade: JobGrade, level: 1 | 2 | 3 = 2): number {
  return Math.round(JOB_PAY[grade] * (JOB_LEVEL_FACTOR[level] ?? 1));
}

export function jobPay(grade: JobGrade, paidToday: boolean, level: 1 | 2 | 3 = 2): number {
  return paidToday ? 0 : jobLevelPay(grade, level);
}

/** How a time noted compares with the appointment: right, earlier, later (within half a day). */
export function timeSide(noted: number, appointment: number): 'right' | 'early' | 'late' {
  const d = dayMinute(noted - appointment);
  if (d === 0) return 'right';
  return d > DAY_MIN / 2 ? 'early' : 'late';
}

// ───────────────────────── review cards of templated lines ─────────────────────────

/** The review ref of a line as said: a line with `{time}` carries the time it was said with (`…-t1845`). */
export function lineRef(line: Pick<JobLine, 'id' | 'text'>, minute: number | null): string {
  return minute !== null && line.text.includes('{time}') ? `${line.id}-t${clockOf(minute).replace(':', '')}` : line.id;
}

/** Back from a ref: the line's id and the time it was said with (null: none). */
export function parseLineRef(ref: string): { id: string; minute: number | null } {
  const m = /^(.*)-t(\d{2})(\d{2})$/.exec(ref);
  if (!m) return { id: ref, minute: null };
  const h = Number(m[2]);
  const mm = Number(m[3]);
  return h < 24 && mm < 60 ? { id: m[1], minute: h * 60 + mm } : { id: ref, minute: null };
}

/** Every ref a templated line can have (every minute of the day an appointment of the style can fall on). */
export function templatedRefs(line: Pick<JobLine, 'id' | 'text'>, style: ClockStyle = 'quarter'): string[] {
  if (!line.text.includes('{time}')) return [line.id];
  const out: string[] = [];
  for (let h = 0; h < 24; h++) for (const mm of CLOCK_MINUTES[style]) out.push(lineRef(line, h * 60 + mm));
  return out.sort();
}
