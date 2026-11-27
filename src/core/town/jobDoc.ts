// A Westbay job as DATA (docs/gta-plan.md §3, §12; M1): one engine (features/town/jobs/useCityJob.tsx) plays any
// document made of steps of known kinds, so a new job is a new data file, not new code. The kinds are the pieces of
// the plan's "phi vụ" both drafts use (the M0 sample "Cuộn băng của Gus", the story bible's job 1 "Máy số hai"):
//
//   goto      walk (or drive) to a place, the way shown;                      scene  people talk in the world;
//   phone     a call (the learner's phone);                                   radio  the car's radio;
//   notebook  the briefing heard, then the learner writes it down (each entry three look-alikes, no right / wrong);
//   pickup    go to the place NOTED, find the person described among people standing there, greet by what was noted;
//   ride      the passenger aboard: the car drives by itself to where it goes (the place noted, or fixed); on the way
//             either junctions where the learner picks the way, or a talk; arriving says something by the note;
//   overhear  two people at a place, each line heard by the distance when it starts;
//   intent    the learner answers by a Vietnamese intent (their own line is shown, and said when PLAYER_VOICE is on);
//   password  the chunk just heard, typed;                                    end    the grade's lines and the news.
//
// Added for Act I's jobs 2–5 (M2, gta-plan §14; fields are only ever ADDED, never renamed, so every job keeps
// working): JobDoc `after` (the job done first in the story's chain), `side` (a job outside the chain), `clock` (how
// the appointment is said: 'quarter' / 'half' "half five" / 'ten' "ten past six"); Cond `past` (a flag or a consequence
// an EARLIER job left: `<job id>:<flag>` or `<job id>:hit:<consequence>`); goto `deadline` (late = a consequence);
// pickup `board: false` (the one found is not driven anywhere); notebook `via` ('phone' / 'radio' / 'scene': who says
// the briefing, and how the strip shows it); several notebooks in one job (keys unique across them); overhear `who` of
// any length (each line heard by the distance to the nearest of them); intent `check.right` a list of good answers.
//
// Added for Act II (gta-plan §17 "Crew, phone, clues as built"; again only ADDED): JobDoc `crew` (the people who may
// come along: what opens each one, their cut of the pay, where they stand or ride) with Cond `crew` (the steps and
// lines that are theirs); Cond `clue` (a clue the learner earned by hearing it: data/city/clues.ts, kept in town-jobs)
// and a step's `clue` (playing the step through gives it); scene / overhear `park` (a drawn car waits at a place for
// the length of the step); notebook `via: 'voicemail'` (the briefing is a voice message left on the learner's phone:
// heard from the phone, then noted). `wellFormed` checks each crew choice (and going alone) on its own: every fact still
// plays out and the job still has its notebook.
//
// Added for Act II's jobs (docs/gta-story-2.md §7 "NEEDS ENGINE", gta-plan §18; only ADDED). By the bible's numbers:
//   1  JobDoc `afterAll: [...]` (every one of these jobs done first, any grade); Cond `{ count: [conds], min?, max? }`
//      (how many of the conditions hold: e.g. how many of the other chains are done); Cond `past` with a bare job id
//      (`{ past: 'job-link' }`) = that job is done.
//   2  JobLine `broken: true`: said in pieces, a silence (a hiss, no noise mixed in) at every "..." of its text.
//   3  notebook `via: 'tape'`: the learner first goes to the hideout when they own it (Jun's stall when not), then the
//      tape plays; rewinding (the replay keys, "Xin nhắc lại") is free and counted, as for any notebook.
//   4  step `patrol` { street, from?, to?, seconds, lines?: [{ line, at? }], seen?: { consequence?, flag?, lines? } }:
//      a police car drives one street now (features/town/streets/jobPolice.ts jobPatrol) while the scanner says the
//      lines (speakers 'scanner-desk' / 'scanner-unit'); seen → the consequence and / or the flag. Nobody is fined.
//      Step `scanner` { lines }: lines said on the police scanner, no car.
//   5  step `enter` { door?: 'front' | 'back' | 'water', host?, visitor?, more? }: walk to that door of warehouse
//      fifteen and go in through the dark with those people (features/town/city/warehouse.ts); the steps after it are
//      inside; step `leave` comes out at the same door. Places may also be the job SPOTS of data/city/jobs/spots.ts
//      ('w15-front', 'w15-back', 'w15-water', 'w14-front', 'row-end', 'quay-east', 'hideout', 'jetty').
//   9  step `boat` { from?, to?, aboard? } (spots): a launch runs over the bay (warehouse.ts runBoat); the step ends
//      when it arrives; the boat stays moored till the job ends.
//   6  step `threads` { tracks: [{ id, label, lines, key?, consequence? }] }: several threads of talk go on at once;
//      the learner hears one at a time and switches; a key line that goes by on a thread not listened to is that
//      thread's consequence.
//   7  step `pick` { ask?, clips: [line ids], right, consequence, fact }: short clips with no text, each played as
//      often as wanted; pick one.
//   8  step `spot` { lines, at, early, late, never, fact, via? }: the lines play; the learner presses "Đó!" when the
//      line `at` is said (until a moment after it ends); too early, too late and never are each a consequence.
//
// Added for Act III's jobs (docs/gta-story-3.md §7, gta-plan §20; only ADDED):
//   1  Cond `{ heat: { min?, max? } }`: the heat (core/town/heat.ts, kept in memory) when the step begins.
//   3  JobLine `as` (job.ts): who really says a forged line (a speaker id, or 'splice' for a tape cut together). While
//      playing nothing changes (the strip shows `who`, the voice is `who`'s); the debrief, the review card and the
//      hideout's tape say "Lyle Penn (nhại Rico)" / "Marcus (băng ghép)" (core/town/jobVoice.ts revealedName).
//   4  Cond `{ grade: '<job id>', min: 'clean' | 'messy' | 'broken' }`: that job's best grade (town-jobs) is at least min.
//   5  step `flag` { set, if? }: sets a flag of the run when its condition holds, says nothing (kept in town-jobs like
//      every flag: `job-live:end-best`).
//   8  `pick.why`: per wrong clip, a line that says why it was wrong (a tape cut together is not an imitation).
//      thread `cover` (a Cond, e.g. `{ crew: 'tess' }`): somebody else keeps that thread; when it holds as the step
//      begins, its key lines going by unheard are no consequence (two keys at once can be caught only with a crew).
//
// Facts and consequences (owner's review, gta-plan §11.4): every fact the learner can mishear has ONE consequence that
// plays out in the world and then rejoins the main line; the grade counts the consequences hit. `wellFormed` (tested
// for every job: data/city/jobs/jobs.test.ts) checks that each fact has its consequence and its rejoin, and that the
// steps really play each one out. Pure: types and checks only.

import type { JobGrade, JobLine, Junction, NoteEntry } from './job';
import { JOB_DEPOSITS, type JobNeeds } from './fame';

/** When a line is said or a step plays (evaluated against the run: core/town/jobDoc evalCond). */
export type Cond =
  | { note: string; is: 'right' | 'wrong' | 'early' | 'late' }
  | { note: string; value: string }
  | { flag: string }
  | { hit: string }
  | { past: string }
  | { crew: string }
  | { clue: string }
  | { count: readonly Cond[]; min?: number; max?: number }
  | { heat: { min?: number; max?: number } }
  | { grade: string; min: JobGrade }
  | { not: Cond }
  | { all: readonly Cond[] }
  | { any: readonly Cond[] };

/** A line said, always or only when its condition holds. */
export type Said = string | { line: string; if: Cond };

/** One answer of an intent step: what the learner means (Vietnamese), their line, the reply, what it sets. */
export interface IntentOption {
  /** The intent, in Vietnamese ("Đùa cho qua"). */
  label: string;
  /** The learner's own line (speaker 'player'). */
  say: string;
  reply: readonly Said[];
  /** A flag the run remembers (for later lines and jobs). */
  flag?: string;
}

/** A drawn car of the job waiting at a place for the length of a step (features/town/jobs/jobCars.ts). */
export interface Park {
  at: string;
  /** Which of the car model's colours (0–2). */
  look?: number;
}

/** Someone who may come along on a job (gta-plan §4.3): who, what they do, what opens them, their cut, where they are. */
export interface CrewRole {
  /** A Westbay person's id (core/town/cityPeople) or a town resident's place id (data/town CAST_VOICES). */
  who: string;
  /** What they are on this job, in Vietnamese ("Thợ bộ đàm"). */
  role: string;
  /** How the job's listening changes with them, in Vietnamese (shown before choosing). */
  listen: string;
  /** A town resident: hearts of friendship; a Westbay person: the city scenes heard with them (there are no hearts up there). */
  opens: { hearts: number } | { heard: readonly string[] };
  /** Their share of the pay (core/town/crew.ts CREW_CUT). */
  cut: number;
  /** Where they are during the job: beside a place's door, or in the vehicle with the learner. */
  with?: 'ride' | { at: string };
}

/** One thread of a `threads` step: a label (Vietnamese: "Trong kho"), its lines, the lines that must be heard on it. */
export interface Track {
  id: string;
  label: string;
  lines: readonly Said[];
  /** Lines that matter: one going by while another thread is listened to is `consequence`. */
  key?: readonly string[];
  consequence?: string;
  /** Somebody else keeps this thread (a crew member: `{ crew: 'tess' }`): when it holds as the step begins, its key lines going by unheard are no consequence. */
  cover?: Cond;
}

export type Step =
  | {
      kind: 'goto';
      place: string;
      label: string;
      /** Get there in time or it is a consequence: `seconds` real seconds from the step's start, else by the appointment. */
      deadline?: { seconds?: number; consequence: string; lines: readonly Said[] };
      if?: Cond;
    }
  | { kind: 'scene'; at?: string; who?: readonly string[]; lines: readonly Said[]; park?: readonly Park[]; clue?: string; if?: Cond }
  | { kind: 'phone'; lines: readonly Said[]; clue?: string; if?: Cond }
  | { kind: 'radio'; lines: readonly Said[]; clue?: string; if?: Cond }
  | {
      kind: 'notebook';
      /** The briefing (said once; replayable, counted). */
      call: readonly Said[];
      /** Who says it: the learner's phone (the default), the car's radio, somebody in the scene, a voice message, a tape. */
      via?: 'phone' | 'radio' | 'scene' | 'voicemail' | 'tape';
      entries: readonly NoteEntry[];
      /** "Xin nhắc lại" one entry: these lines (default: the entry's own line, a little slower). */
      repeat?: Readonly<Record<string, readonly string[]>>;
      /** From this many repeats on, the speaker adds this line once. */
      patience?: { after: number; line: string };
      if?: Cond;
    }
  | {
      kind: 'pickup';
      /** The notebook entry whose value is the place gone to (its value → a place id); the right place. */
      entry: string;
      places: Readonly<Record<string, string>>;
      place: string;
      /** At a noted place that is not the right one: who rings and what they say (then the way is shown). */
      wrongPlace: { lines: readonly Said[]; consequence: string };
      /** Arriving after the appointment by more than `after` game minutes: the passenger has gone (fatal). */
      gone?: { after: number; lines: readonly Said[]; consequence: string };
      /** Said on arrival, before anybody is asked (e.g. the consequence of a time written too early). */
      arrive?: readonly Said[];
      /** The people standing at the right place (at its door), the passenger among them. */
      crowd: readonly string[];
      passenger: string;
      /** The learner's own line before each ask (variants by the note). */
      ask?: readonly Said[];
      /** What each of the others says when asked; asking them is the consequence `wrongPerson`. */
      notMe: Readonly<Record<string, readonly Said[]>>;
      wrongPerson: string;
      /** After this many wrong asks the passenger calls out. */
      callOut?: { after: number; line: string };
      /** The passenger's first words (conditional on the notes: the consequences of the time and the like). */
      greet: readonly Said[];
      /** false: the one found is not driven anywhere (they stay where they stand, the talk goes on). Default true. */
      board?: boolean;
      if?: Cond;
    }
  | {
      kind: 'ride';
      /** Where to: a notebook entry's value → a place, or a fixed place; the right place. */
      entry?: string;
      places?: Readonly<Record<string, string>>;
      place: string;
      /** Directions: junctions where the learner picks the way (a wrong way is `lost`). */
      junctions?: readonly Junction[];
      lost?: string;
      /** "Xin nhắc lại" at a junction: past `patience` asks, `again` first, and the consequence `nagged`. */
      again?: { line: string; patience: number; consequence: string };
      /** A talk on the way (scene lines and intent steps), played while the car drives. */
      talk?: readonly (Said | { intent: IntentStep })[];
      /** Said on the way to the drop-off (after the last junction). */
      near?: readonly Said[];
      /** Said on arrival, by the place reached (the entry's value, or 'right'). */
      arrive: Readonly<Record<string, readonly Said[]>>;
      /** The noted destination was wrong: its consequence (the passenger walks on ahead). */
      wrongStop?: string;
      if?: Cond;
    }
  | {
      kind: 'overhear';
      at: string;
      /** Who stands there (one or more): each line is heard by the distance to the nearest of them. */
      who: readonly string[];
      lines: readonly Said[];
      passes: number;
      /** Too near before the password line is heard: they notice (said, the talk stops). Without it they never do. */
      noticed?: { line: string; consequence: string };
      /** The line whose hearing is the fact (the password); its passes are counted. */
      word?: string;
      /** Start from this line when the condition holds (the learner arrives late: they missed the start). */
      from?: { if: Cond; index: number };
      park?: readonly Park[];
      clue?: string;
      if?: Cond;
    }
  | ({ kind: 'intent' } & IntentStep)
  | { kind: 'enter'; door?: 'front' | 'back' | 'water'; host?: string; visitor?: string; more?: readonly string[]; label?: string; if?: Cond }
  | { kind: 'leave'; if?: Cond }
  | { kind: 'boat'; from?: string; to?: string; aboard?: boolean; if?: Cond }
  | {
      kind: 'patrol';
      street: string;
      from?: string;
      to?: string;
      seconds: number;
      lines?: readonly { line: string; at?: number }[];
      seen?: { consequence?: string; flag?: string; lines?: readonly Said[] };
      if?: Cond;
    }
  | { kind: 'scanner'; lines: readonly Said[]; if?: Cond }
  | { kind: 'threads'; tracks: readonly Track[]; if?: Cond }
  | { kind: 'pick'; ask?: readonly Said[]; clips: readonly string[]; right: number; consequence: string; fact: string; why?: Readonly<Record<string, string>>; if?: Cond }
  | { kind: 'flag'; set: string; if?: Cond }
  | { kind: 'spot'; lines: readonly Said[]; at: string; early: string; late: string; never: string; fact: string; via?: 'scene' | 'radio' | 'phone' | 'scanner'; if?: Cond }
  | { kind: 'password'; who: string; line: string; chunk: string; ask: string; right: string; close: string; wrong: string; consequence: string; if?: Cond };

/** An answer by intent: somebody asks, the learner picks; `check`: the right option, and the consequence of another. */
export interface IntentStep {
  who: string;
  ask: readonly Said[];
  options: readonly IntentOption[];
  /** The good answer (or answers); another is the consequence. */
  check?: { right: number | readonly number[]; consequence: string; fact: string };
  if?: Cond;
}

/** Something the learner can mishear, the line that says it, and its one consequence. */
export interface JobFact {
  id: string;
  /** For the debrief ("Tên khách"). */
  label: string;
  line: string;
  /** The consequence a wrong note has (`early` for a time noted too early: another consequence). */
  consequence: string;
  early?: string;
  /**
   * The consequence is hit by what the learner DOES (went to the wrong place, asked the wrong person, answered wrong),
   * not by the note itself: a wrong note acted on rightly costs nothing. Otherwise a wrong note hits it.
   */
  byAction?: boolean;
}

/** A consequence: what happens (the debrief's words) and how the story rejoins its main line. */
export interface JobConsequence {
  name: string;
  rejoin: string;
  /** Hỏng whatever else (the passenger lost). */
  fatal?: boolean;
}

export interface JobDoc {
  /** `job-<name>`: what paid today is this id in the daily set `heard` of town-progress. */
  id: string;
  title: string;
  /** One Vietnamese line: what the job is about, never what is said. */
  blurb: string;
  level: 1 | 2 | 3;
  /** Its place in the list of jobs (lower first). */
  order: number;
  /** City scenes that must have been heard before it opens (always open in the admin sandbox). */
  opens: readonly string[];
  /** Who rings to offer it (the strip and the quest card). */
  from: string;
  /** The job that must be done first (any grade): the story's chain. Without it the job opens with `opens`. */
  after?: string;
  /** Every one of these must be done first (any grade), as well as `after`. */
  afterAll?: readonly string[];
  /** A job outside the story's chain (offered beside it, never in its way). */
  side?: boolean;
  /** How the appointment is said (core/town/job.ts ClockStyle). Default 'quarter'. */
  clock?: 'quarter' | 'half' | 'ten';
  /** Who may come along (picked before the job starts; going alone is always allowed). */
  crew?: { roles: readonly CrewRole[] };
  lines: readonly JobLine[];
  facts: readonly JobFact[];
  consequences: Readonly<Record<string, JobConsequence>>;
  steps: readonly Step[];
  /** The last word by grade, and the news by how it ended (`none`: the job's goal was not reached). */
  ending: Readonly<Record<JobGrade, readonly Said[]>>;
  news: Readonly<Record<JobGrade, readonly Said[]>> & { none?: readonly Said[] };
  /** The consequence that means "the goal was not reached" (the news then reads `none`). */
  failed?: string;
  /**
   * What opens a big job besides the chain (./fame.ts, gta-plan §5 "Mở khóa"): fame counted from what the learner has
   * done, and a deposit paid down (its amount is JOB_DEPOSITS[id]; it comes back when the job is first done). A job
   * done before is never shut by it; the admin sandbox ignores it.
   */
  needs?: JobNeeds;
}

// ───────────────────────── conditions ─────────────────────────

/** What a condition is read against. */
export interface CondState {
  /** Per notebook entry: right, wrong, and for a time early / late. */
  note: (key: string) => { value: string | undefined; right: boolean; early: boolean; late: boolean };
  flags: ReadonlySet<string>;
  hits: ReadonlySet<string>;
  /** A flag an earlier job left (core/town/jobProgress pastFlag). */
  past?: (ref: string) => boolean;
  /** Who came along (null: alone). */
  crew?: string | null;
  /** A clue the learner holds (core/town/jobProgress hasClue). */
  clue?: (id: string) => boolean;
  /** The heat now (core/town/heat.ts). */
  heat?: number;
  /** An earlier job's best grade (null: not done). */
  grade?: (jobId: string) => JobGrade | null;
}

const GRADE_ORDER: Readonly<Record<JobGrade, number>> = { broken: 0, messy: 1, clean: 2 };

export function evalCond(c: Cond | undefined, s: CondState): boolean {
  if (!c) return true;
  if ('not' in c) return !evalCond(c.not, s);
  if ('all' in c) return c.all.every((x) => evalCond(x, s));
  if ('any' in c) return c.any.some((x) => evalCond(x, s));
  if ('flag' in c) return s.flags.has(c.flag);
  if ('hit' in c) return s.hits.has(c.hit);
  if ('past' in c) return !!s.past?.(c.past);
  if ('crew' in c) return (s.crew ?? null) === c.crew;
  if ('clue' in c) return !!s.clue?.(c.clue);
  if ('count' in c) {
    const n = c.count.filter((x) => evalCond(x, s)).length;
    return n >= (c.min ?? 0) && n <= (c.max ?? Infinity);
  }
  if ('heat' in c) {
    const h = s.heat ?? 0;
    return h >= (c.heat.min ?? -Infinity) && h <= (c.heat.max ?? Infinity);
  }
  if ('grade' in c) {
    const g = s.grade?.(c.grade) ?? null;
    return g !== null && GRADE_ORDER[g] >= GRADE_ORDER[c.min];
  }
  const n = s.note(c.note);
  if ('value' in c) return n.value === c.value;
  if (c.is === 'right') return n.right;
  if (c.is === 'wrong') return !n.right;
  if (c.is === 'early') return n.early;
  return n.late;
}

/** The lines of a list that are said now. */
export function saidNow(list: readonly Said[], s: CondState): string[] {
  return list.flatMap((x) => (typeof x === 'string' ? [x] : evalCond(x.if, s) ? [x.line] : []));
}

const lineOf = (x: Said): string => (typeof x === 'string' ? x : x.line);
const condsOf = (x: Said): Cond[] => (typeof x === 'string' ? [] : [x.if]);

// ───────────────────────── the grade ─────────────────────────

/** The grade is how many consequences were hit: none Sạch, one or two Lộn xộn, three or more (or a fatal one) Hỏng. */
export function gradeHits(hits: ReadonlySet<string>, doc: Pick<JobDoc, 'consequences'>): JobGrade {
  if ([...hits].some((h) => doc.consequences[h]?.fatal)) return 'broken';
  const n = [...hits].filter((h) => Object.hasOwn(doc.consequences, h)).length;
  return n === 0 ? 'clean' : n <= 2 ? 'messy' : 'broken';
}

// ───────────────────────── well formed ─────────────────────────

/** Every line id a document refers to, and every condition in it. */
export function docRefs(doc: JobDoc, keep: (c: Cond | undefined) => boolean = () => true): { lines: string[]; conds: Cond[]; consequences: string[] } {
  const lines: string[] = [];
  const conds: Cond[] = [];
  const consequences: string[] = [];
  const said = (list: readonly Said[] | undefined) => {
    for (const x of list ?? []) {
      if (typeof x !== 'string' && !keep(x.if)) continue;
      lines.push(lineOf(x));
      conds.push(...condsOf(x));
    }
  };
  const intent = (i: IntentStep) => {
    if (!keep(i.if)) return;
    said(i.ask);
    for (const o of i.options) {
      lines.push(o.say);
      said(o.reply);
    }
    if (i.check) consequences.push(i.check.consequence);
    if (i.if) conds.push(i.if);
  };
  for (const f of doc.facts) {
    lines.push(f.line);
    consequences.push(f.consequence);
    if (f.early) consequences.push(f.early);
  }
  for (const st of doc.steps) {
    if ('if' in st && !keep(st.if)) continue;
    if ('if' in st && st.if) conds.push(st.if);
    switch (st.kind) {
      case 'goto':
        if (st.deadline) {
          said(st.deadline.lines);
          consequences.push(st.deadline.consequence);
        }
        break;
      case 'scene':
      case 'phone':
      case 'radio':
        said(st.lines);
        break;
      case 'notebook':
        said(st.call);
        for (const e of st.entries) lines.push(e.line);
        for (const r of Object.values(st.repeat ?? {})) lines.push(...r);
        if (st.patience) lines.push(st.patience.line);
        break;
      case 'pickup':
        said(st.wrongPlace.lines);
        consequences.push(st.wrongPlace.consequence, st.wrongPerson);
        if (st.gone) {
          said(st.gone.lines);
          consequences.push(st.gone.consequence);
        }
        said(st.arrive);
        said(st.ask);
        for (const r of Object.values(st.notMe)) said(r);
        if (st.callOut) lines.push(st.callOut.line);
        said(st.greet);
        break;
      case 'ride':
        for (const j of st.junctions ?? []) {
          lines.push(j.line);
          for (const w of Object.values(j.ways)) if (w?.line) lines.push(w.line);
        }
        if (st.lost) consequences.push(st.lost);
        if (st.again) {
          lines.push(st.again.line);
          consequences.push(st.again.consequence);
        }
        for (const t of st.talk ?? []) {
          if (typeof t === 'object' && 'intent' in t) intent(t.intent);
          else said([t]);
        }
        said(st.near);
        for (const a of Object.values(st.arrive)) said(a);
        if (st.wrongStop) consequences.push(st.wrongStop);
        break;
      case 'overhear':
        said(st.lines);
        if (st.noticed) {
          lines.push(st.noticed.line);
          consequences.push(st.noticed.consequence);
        }
        if (st.word) lines.push(st.word);
        if (st.from) conds.push(st.from.if);
        break;
      case 'intent':
        intent(st);
        break;
      case 'password':
        lines.push(st.line, st.ask, st.right, st.close, st.wrong);
        consequences.push(st.consequence);
        break;
      case 'patrol':
        for (const l of st.lines ?? []) lines.push(l.line);
        if (st.seen?.consequence) consequences.push(st.seen.consequence);
        said(st.seen?.lines);
        break;
      case 'scanner':
        said(st.lines);
        break;
      case 'threads':
        for (const t of st.tracks) {
          said(t.lines);
          if (t.consequence) consequences.push(t.consequence);
          if (t.cover) conds.push(t.cover);
        }
        break;
      case 'pick':
        said(st.ask);
        lines.push(...st.clips);
        lines.push(...Object.values(st.why ?? {}));
        consequences.push(st.consequence);
        break;
      case 'spot':
        said(st.lines);
        consequences.push(st.early, st.late, st.never);
        break;
    }
  }
  for (const v of Object.values(doc.ending)) said(v);
  for (const v of Object.values(doc.news)) said(v);
  if (doc.failed) consequences.push(doc.failed);
  return { lines, conds, consequences };
}

/** Everything a world gives the check: which speakers are allowed, which places exist, whether a tile is road. */
export interface WorldCheck {
  speaker: (who: string) => boolean;
  place: (id: string) => boolean;
  road: (x: number, y: number) => boolean;
  /** A street a patrol can drive (core/town/streets.ts); unchecked without it. */
  street?: (name: string) => boolean;
}

/**
 * The problems of a job document (empty = well formed): lines that do not exist or are never said, speakers who
 * may not speak, places not on the map, junctions off the road, facts without a consequence or a rejoin, notebook
 * entries without a fact, a fact whose consequence never plays out (no step's condition reads its entry, and nothing
 * else hits it), consequences that are never used.
 */
export function wellFormed(doc: JobDoc, w: WorldCheck): string[] {
  const out: string[] = [];
  const ids = new Set(doc.lines.map((l) => l.id));
  if (ids.size !== doc.lines.length) out.push('duplicate line ids');
  const refs = docRefs(doc);
  for (const r of refs.lines) if (!ids.has(r)) out.push(`no line ${r}`);
  const used = new Set(refs.lines);
  for (const l of doc.lines) {
    if (!used.has(l.id)) out.push(`line never said: ${l.id}`);
    if (!w.speaker(l.who)) out.push(`speaker not allowed: ${l.who} (${l.id})`);
  }
  for (const c of refs.consequences) if (!Object.hasOwn(doc.consequences, c)) out.push(`no consequence ${c}`);
  for (const [id, c] of Object.entries(doc.consequences)) {
    if (!c.name.trim()) out.push(`consequence without words: ${id}`);
    if (!c.rejoin.trim()) out.push(`consequence without a rejoin: ${id}`);
    if (!refs.consequences.includes(id)) out.push(`consequence never used: ${id}`);
  }
  const entries = doc.steps.flatMap((s) => (s.kind === 'notebook' ? s.entries : []));
  if (new Set(entries.map((e) => e.key)).size !== entries.length) out.push('notebook keys repeat across notebooks');
  out.push(...playedOut(doc));
  for (const f of doc.facts) if (!Object.hasOwn(doc.consequences, f.consequence)) out.push(`fact without a consequence: ${f.id}`);
  if (doc.needs) {
    const { fame, deposit } = doc.needs;
    if (fame !== undefined && !(Number.isInteger(fame) && fame > 0)) out.push(`needs: fame must be a whole number above 0`);
    if (deposit !== undefined && deposit !== JOB_DEPOSITS[doc.id]) out.push(`needs: a deposit must be JOB_DEPOSITS['${doc.id}']`);
    if (fame === undefined && deposit === undefined) out.push('needs: empty');
  }
  if (JOB_DEPOSITS[doc.id] !== undefined && doc.needs?.deposit !== JOB_DEPOSITS[doc.id]) out.push(`a deposit is set for ${doc.id} but the job does not ask for it`);
  for (const s of doc.steps) {
    const places = s.kind === 'goto' ? [s.place] : s.kind === 'scene' ? (s.at ? [s.at] : []) : s.kind === 'pickup' ? [s.place, ...Object.values(s.places)] : s.kind === 'ride' ? [s.place, ...Object.values(s.places ?? {})] : s.kind === 'overhear' ? [s.at] : [];
    for (const p of places) if (!w.place(p)) out.push(`no place ${p}`);
    if (s.kind === 'ride')
      for (const j of s.junctions ?? []) {
        if (!w.road(j.at.x, j.at.y)) out.push(`junction off the road: ${j.id}`);
        if (!j.ways[j.right]) out.push(`junction without its right way: ${j.id}`);
        for (const [t, way] of Object.entries(j.ways)) {
          if (way && !w.road(way.to.x, way.to.y)) out.push(`way off the road: ${j.id} ${t}`);
          if (way && (t === j.right) === !!way.line) out.push(`${j.id} ${t}: a wrong way needs a line, the right one none`);
        }
      }
    if (s.kind === 'intent' && s.check) {
      const rights = typeof s.check.right === 'number' ? [s.check.right] : s.check.right;
      if (rights.length === 0 || rights.some((r) => r < 0 || r >= s.options.length)) out.push(`intent check out of range: ${s.who}`);
    }
    if (s.kind === 'overhear' && s.who.length === 0) out.push('overhear without anybody');
    if (s.kind === 'boat') for (const p of [s.from, s.to]) if (p && !w.place(p)) out.push(`no place ${p}`);
    if (s.kind === 'patrol') {
      if (!(s.seconds > 0)) out.push(`patrol without a length: ${s.street}`);
      if (w.street && !w.street(s.street)) out.push(`no street ${s.street}`);
      for (const l of s.lines ?? []) if (!['scanner-desk', 'scanner-unit'].includes(doc.lines.find((x) => x.id === l.line)?.who ?? '')) out.push(`patrol line not on the scanner: ${l.line}`);
    }
    if (s.kind === 'threads') {
      if (s.tracks.length < 2) out.push('threads with fewer than two tracks');
      if (new Set(s.tracks.map((t) => t.id)).size !== s.tracks.length) out.push('threads with repeated ids');
      for (const t of s.tracks) {
        const said = t.lines.map(lineOf);
        for (const k of t.key ?? []) if (!said.includes(k)) out.push(`thread ${t.id}: key line not on it: ${k}`);
        if ((t.key ?? []).length > 0 && !t.consequence) out.push(`thread ${t.id}: key lines without a consequence`);
      }
    }
    if (s.kind === 'pick' && (s.clips.length < 2 || s.right < 0 || s.right >= s.clips.length)) out.push(`pick out of range: ${s.fact}`);
    if (s.kind === 'pick') for (const k of Object.keys(s.why ?? {})) if (!s.clips.includes(k) || k === s.clips[s.right]) out.push(`pick why for no wrong clip: ${k}`);
    if (s.kind === 'flag' && !/^[a-z0-9][a-z0-9-]{0,40}$/.test(s.set)) out.push(`flag not a name: ${s.set}`);
    if (s.kind === 'spot' && !s.lines.map(lineOf).includes(s.at)) out.push(`spot line not said in it: ${s.at}`);
  }
  // into the warehouse and out again: every `enter` has its `leave` after it, never two in (for each crew choice: the
  // enters of different crew members are different doors in, not two)
  const views = (doc.crew?.roles.length ? [null, ...doc.crew.roles.map((r) => r.who)] : [null]) as (string | null)[];
  const roomProblems = new Set<string>();
  for (const who of views) {
    let inside = false;
    for (const s of doc.steps) {
      if ('if' in s && crewTri(s.if, who) === 0) continue;
      if (s.kind === 'enter') {
        if (inside) roomProblems.add('enter while inside');
        inside = true;
      }
      if (s.kind === 'leave') {
        if (!inside) roomProblems.add('leave while outside');
        inside = false;
      }
    }
    if (inside) roomProblems.add('enter without a leave');
  }
  out.push(...roomProblems);
  if (!doc.steps.some((s) => s.kind === 'notebook')) out.push('no notebook');
  for (const s of doc.steps) if ((s.kind === 'scene' || s.kind === 'overhear') && s.park) for (const p of s.park) if (!w.place(p.at)) out.push(`no place ${p.at}`);
  // the crew: each choice (and going alone) on its own still plays every fact out and has its notebook
  const roles = doc.crew?.roles ?? [];
  const crewIds = new Set(roles.map((r) => r.who));
  if (crewIds.size !== roles.length) out.push('crew repeats a person');
  for (const r of roles) {
    if (!w.speaker(r.who)) out.push(`crew not a person: ${r.who}`);
    if (!r.role.trim() || !r.listen.trim()) out.push(`crew without words: ${r.who}`);
    if (!(r.cut >= 0 && r.cut <= 0.5)) out.push(`crew cut out of range: ${r.who}`);
    if (r.with && r.with !== 'ride' && !w.place(r.with.at)) out.push(`no place ${r.with.at}`);
    if ('heard' in r.opens ? r.opens.heard.length === 0 : !(r.opens.hearts >= 0 && r.opens.hearts <= 10)) out.push(`crew opens nothing: ${r.who}`);
  }
  const crewsIn = (c: Cond): string[] => ('crew' in c ? [c.crew] : 'not' in c ? crewsIn(c.not) : 'all' in c ? c.all.flatMap(crewsIn) : 'any' in c ? c.any.flatMap(crewsIn) : 'count' in c ? c.count.flatMap(crewsIn) : []);
  // Act III's conditions: a heat between 0 and 10, a grade of a job id
  const condsDeep = (c: Cond): Cond[] => [c, ...('not' in c ? condsDeep(c.not) : 'all' in c ? c.all.flatMap(condsDeep) : 'any' in c ? c.any.flatMap(condsDeep) : 'count' in c ? c.count.flatMap(condsDeep) : [])];
  for (const c of refs.conds.flatMap(condsDeep)) {
    if ('heat' in c) {
      const { min, max } = c.heat;
      if ((min !== undefined && (min < 0 || min > 10)) || (max !== undefined && (max < 0 || max > 10)) || (min !== undefined && max !== undefined && min > max) || (min === undefined && max === undefined)) out.push('heat condition out of range');
    }
    if ('grade' in c && !/^job-[a-z0-9-]+$/.test(c.grade)) out.push(`grade condition of no job: ${c.grade}`);
  }
  // forged lines: who really says them is a speaker, or a tape cut together
  for (const l of doc.lines) if (l.as !== undefined && l.as !== 'splice' && !w.speaker(l.as)) out.push(`as not a speaker: ${l.as} (${l.id})`);
  for (const id of new Set(refs.conds.flatMap(crewsIn))) if (!crewIds.has(id)) out.push(`crew condition without a role: ${id}`);
  if (roles.length > 0)
    for (const who of [null, ...crewIds]) {
      const keep = (c: Cond | undefined) => crewTri(c, who) !== 0;
      for (const p of playedOut(doc, keep)) out.push(`${who ? `with ${who}` : 'alone'}: ${p}`);
      if (!doc.steps.some((s) => s.kind === 'notebook' && keep(s.if))) out.push(`${who ? `with ${who}` : 'alone'}: no notebook`);
    }
  return out;
}

/** A condition with the crew known and everything else not: 0 false for sure, 1 true for sure, 2 it depends. */
export function crewTri(c: Cond | undefined, crew: string | null): 0 | 1 | 2 {
  if (!c) return 1;
  if ('crew' in c) return c.crew === crew ? 1 : 0;
  if ('not' in c) {
    const t = crewTri(c.not, crew);
    return t === 2 ? 2 : t === 1 ? 0 : 1;
  }
  if ('all' in c) {
    const ts = c.all.map((x) => crewTri(x, crew));
    return ts.includes(0) ? 0 : ts.every((t) => t === 1) ? 1 : 2;
  }
  if ('any' in c) {
    const ts = c.any.map((x) => crewTri(x, crew));
    return ts.includes(1) ? 1 : ts.every((t) => t === 0) ? 0 : 2;
  }
  if ('count' in c) {
    const ts = c.count.map((x) => crewTri(x, crew));
    const sure = ts.filter((t) => t === 1).length;
    const maybe = ts.filter((t) => t === 2).length;
    const lo = c.min ?? 0;
    const hi = c.max ?? Infinity;
    if (sure >= lo && sure + maybe <= hi) return 1;
    if (sure + maybe < lo || sure > hi) return 0;
    return 2;
  }
  return 2;
}

/**
 * Whether every notebook entry and every fact plays out among the steps and lines `keep` lets through (all by
 * default): an entry read by some condition or leading a pickup / ride, or a fact acted on whose consequence a step hits.
 */
function playedOut(doc: JobDoc, keep: (c: Cond | undefined) => boolean = () => true): string[] {
  const out: string[] = [];
  const steps = doc.steps.filter((s) => !('if' in s) || keep(s.if));
  const refs = docRefs(doc, keep);
  const entries = steps.flatMap((s) => (s.kind === 'notebook' ? s.entries : []));
  const readsNote = (key: string): boolean => {
    const reads = (c: Cond): boolean => ('note' in c ? c.note === key : 'not' in c ? reads(c.not) : 'all' in c ? c.all.some(reads) : 'any' in c ? c.any.some(reads) : 'count' in c ? c.count.some(reads) : false);
    // a pickup / ride led by the entry plays it out too
    return refs.conds.some(reads) || steps.some((s) => (s.kind === 'pickup' && s.entry === key) || (s.kind === 'ride' && s.entry === key));
  };
  // the consequences a step hits by itself (what the learner does), as opposed to a fact's own
  const stepRefs = docRefs({ ...doc, facts: [] }, keep);
  const byStep = new Set(stepRefs.consequences);
  // a fact acted on needs its consequence only where its line is said (a crew's own fact: only with them)
  const saidHere = new Set(stepRefs.lines);
  for (const e of entries) {
    const fact = doc.facts.find((f) => f.line === e.line);
    if (!fact) out.push(`notebook entry without a fact: ${e.key}`);
    else if (!readsNote(e.key) && !(fact.byAction && byStep.has(fact.consequence))) out.push(`a wrong ${e.key} never plays out`);
  }
  for (const f of doc.facts) if (f.byAction && saidHere.has(f.line) && !byStep.has(f.consequence)) out.push(`no step plays out ${f.id}`);
  return out;
}
