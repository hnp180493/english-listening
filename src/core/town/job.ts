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
// Pure: the rules only. The script is data (data/city/jobs/), the runner and its panels features/town/jobs/.
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

export type NoteKey = 'pickup' | 'time' | 'look' | 'avoid';

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

/**
 * A whole job: its lines by id and the parts the runner plays (features/town/jobs). The places are ids of Westbay's
 * places (data/cityWorld.ts); the points are on its tile grid.
 */
export interface JobScript {
  /** `job-<name>`: what paid today is this id in the daily set `heard` of town-progress. */
  id: string;
  /** Shown on the quest card and the debrief. */
  title: string;
  /** One Vietnamese line: what the job is about, never what is said. */
  blurb: string;
  level: 1 | 2 | 3;
  lines: readonly JobLine[];
  /** The briefing (beat 1), said on the phone. */
  call: readonly string[];
  notebook: readonly NoteEntry[];
  /** The right pickup (a place id) and who is picked up there among the crowd standing at its door. */
  pickup: { place: string; host: string; passenger: string; crowd: readonly string[] };
  /** Where the noted pickup leads, by notebook value (a place id). */
  places: Readonly<Record<string, string>>;
  /** What each of the crowd says when asked by mistake (they send the learner away); the passenger's call after two. */
  notMe: Readonly<Record<string, string>>;
  callOut: string;
  /**
   * The passenger's first words: on time; then the consequence of a wrong time (he has been waiting, and says since
   * when) and of a wrong street to avoid (a rival's car behind). Each said after `ontime`, only when it happened.
   */
  greet: { ontime: string; late: string; spotted: string };
  /** Rico rings, annoyed, when the learner is at the wrong pickup, and says that one fact again. */
  wrongPlace: readonly string[];
  /** The passenger's directions: his junctions in order, then the drop-off. */
  junctions: readonly Junction[];
  /** "Xin nhắc lại" past the passenger's patience: what he says before saying it again. */
  again: string;
  /** The drop-off (a place id), what the passenger says on the way there and there. */
  dropoff: { place: string; near: string; arrive: string };
  /** Rico's second call (beat 3's brief). */
  brief: readonly string[];
  /** The two overheard, the place at whose door they stand, and what they say, looped. */
  overhear: { host: string; who: readonly [string, string]; lines: readonly string[]; noticed: string; passes: number };
  /** The password: who asks, the line it was said in, the chunk to type, and the answers. */
  password: { who: string; line: string; chunk: string; ask: string; right: string; close: string; wrong: string };
  /** Rico's last word by grade, and Bay FM's news by how it ended (tape or none). */
  ending: Readonly<Record<JobGrade, readonly string[]>>;
  news: { clean: readonly string[]; messy: readonly string[]; none: readonly string[] };
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
 * The appointment for a call made at `nowMs`: the first quarter past or quarter to an hour at least APPOINT_AHEAD
 * game minutes ahead (a minute of the day). Always :15 or :45, so it is said "quarter past / quarter to", the pair
 * a half-listening ear mixes up.
 */
export function appointment(nowMs: number): number {
  const from = Math.ceil(gameMinutes(nowMs) + APPOINT_AHEAD);
  for (let m = from; m < from + 60; m++) {
    const r = dayMinute(m) % 60;
    if (r === 15 || r === 45) return dayMinute(m);
  }
  return dayMinute(from);
}

const HOUR_WORDS = ['twelve', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven'] as const;

/** A minute of the day said the everyday way: "quarter to seven", "quarter past six", "half past", "o'clock". */
export function timeWords(minute: number): string {
  const m = dayMinute(minute);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const word = (hour: number) => HOUR_WORDS[hour % 12];
  if (mm === 0) return `${word(h)} o'clock`;
  if (mm === 15) return `quarter past ${word(h)}`;
  if (mm === 30) return `half past ${word(h)}`;
  if (mm === 45) return `quarter to ${word(h + 1)}`;
  return `${word(h)} ${mm < 10 ? `oh ${mm}` : mm}`;
}

/** "18:45": a minute of the day as the HUD's clock shows it. */
export function clockOf(minute: number): string {
  const m = dayMinute(minute);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * The three ways to write the appointment: the right one, "past" taken for "to" (or the other way round), and the
 * hour heard but not which side of it. Quarter to H (H−1:45): H−1:45, H:15, H:45. Quarter past H: H:15, H−1:45, H:45.
 */
export function timeOptions(minute: number): number[] {
  const m = dayMinute(minute);
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
export function fillLine<L extends Pick<JobLine, 'text' | 'vi'>>(line: L, minute: number | null): L {
  if (minute === null || !line.text.includes('{time}')) return line;
  return { ...line, text: line.text.replaceAll('{time}', timeWords(minute)), vi: line.vi.replaceAll('{time}', clockOf(minute)) };
}

/** The options of an entry as offered, in an order fixed by `seed` (the right one not always first). */
export function noteOptions(entry: NoteEntry, minute: number, seed: number): NoteOption[] {
  const all = entry.key === 'time' ? timeOptions(minute).map((m) => ({ value: String(m), label: clockOf(m) })) : [...entry.options];
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

/** What happened in a run of the job: each true is one consequence that played out in the world. */
export interface JobRun {
  /** Went to the wrong pickup: nobody there, Rico rang, annoyed. */
  wrongPlace: boolean;
  /** Wrote the wrong time (or got there after it): the passenger had been waiting, and said so. */
  late: boolean;
  /** Wrote the wrong street to avoid: a rival's car followed. */
  spotted: boolean;
  /** People asked before the right one (they sent the learner away). */
  wrongPeople: number;
  /** Wrong ways taken at the junctions. */
  wrongTurns: number;
  /** "Xin nhắc lại" asked of the passenger, all junctions together. */
  asks: number;
  /** The two overheard saw the learner listening. */
  noticed: boolean;
  /** The password: right at the first try, right after a hint, or never. */
  password: 'first' | 'helped' | 'none';
}

export type JobProblem = 'wrongPlace' | 'late' | 'spotted' | 'wrongPerson' | 'lost' | 'nagged' | 'noticed' | 'password';

/** The consequences hit, in the order they happen. */
export function jobProblems(r: JobRun): JobProblem[] {
  const out: JobProblem[] = [];
  if (r.wrongPlace) out.push('wrongPlace');
  if (r.late) out.push('late');
  if (r.spotted) out.push('spotted');
  if (r.wrongPeople > 0) out.push('wrongPerson');
  if (r.wrongTurns > 0) out.push('lost');
  if (r.asks > PATIENCE) out.push('nagged');
  if (r.noticed) out.push('noticed');
  if (r.password === 'none') out.push('password');
  return out;
}

export type JobGrade = 'clean' | 'messy' | 'broken';

/** The grade is how many consequences were hit: Sạch none, Lộn xộn one or two, Hỏng three or more. */
export function gradeJob(r: JobRun): JobGrade {
  const n = jobProblems(r).length;
  return n === 0 ? 'clean' : n <= 2 ? 'messy' : 'broken';
}

/** Xu for a grade (a game score). Paid for the first run of a day only. */
export const JOB_PAY: Readonly<Record<JobGrade, number>> = { clean: 30, messy: 15, broken: 5 };

export function jobPay(grade: JobGrade, paidToday: boolean): number {
  return paidToday ? 0 : JOB_PAY[grade];
}

/**
 * The lines the learner did not catch, as the run shows it (each is marked in the debrief and becomes a review card):
 * the call's lines behind an entry written wrong, the description when the wrong person was asked, a junction's line
 * when a wrong way was taken there, the password when it was not typed right at once.
 */
export function missedLines(o: {
  entries: readonly NoteEntry[];
  wrongNotes: readonly NoteKey[];
  wrongPeople: number;
  junctions: readonly Junction[];
  wrongAt: readonly string[];
  password: JobRun['password'];
  passwordLine: string;
}): string[] {
  const out: string[] = [];
  for (const e of o.entries) if (o.wrongNotes.includes(e.key) || (e.key === 'look' && o.wrongPeople > 0)) out.push(e.line);
  for (const j of o.junctions) if (o.wrongAt.includes(j.id)) out.push(j.line);
  if (o.password !== 'first') out.push(o.passwordLine);
  return [...new Set(out)];
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

/** Every ref a templated line can have (the times an appointment can be: every :15 and :45). */
export function templatedRefs(line: Pick<JobLine, 'id' | 'text'>): string[] {
  if (!line.text.includes('{time}')) return [line.id];
  const out: string[] = [];
  for (let m = 15; m < DAY_MIN; m += 30) out.push(lineRef(line, m));
  return out;
}
