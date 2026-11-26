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
// Facts and consequences (owner's review, gta-plan §11.4): every fact the learner can mishear has ONE consequence that
// plays out in the world and then rejoins the main line; the grade counts the consequences hit. `wellFormed` (tested
// for every job: data/city/jobs/jobs.test.ts) checks that each fact has its consequence and its rejoin, and that the
// steps really play each one out. Pure: types and checks only.

import type { JobGrade, JobLine, Junction, NoteEntry } from './job';

/** When a line is said or a step plays (evaluated against the run: core/town/jobDoc evalCond). */
export type Cond =
  | { note: string; is: 'right' | 'wrong' | 'early' | 'late' }
  | { note: string; value: string }
  | { flag: string }
  | { hit: string }
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

export type Step =
  | { kind: 'goto'; place: string; label: string; if?: Cond }
  | { kind: 'scene'; at?: string; who?: readonly string[]; lines: readonly Said[]; if?: Cond }
  | { kind: 'phone'; lines: readonly Said[]; if?: Cond }
  | { kind: 'radio'; lines: readonly Said[]; if?: Cond }
  | {
      kind: 'notebook';
      /** The briefing (said once; replayable, counted). `via`: on the learner's phone or by somebody in the scene. */
      call: readonly Said[];
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
      who: readonly [string, string];
      lines: readonly Said[];
      passes: number;
      /** Too near before the password line is heard: they notice (said, the talk stops). Without it they never do. */
      noticed?: { line: string; consequence: string };
      /** The line whose hearing is the fact (the password); its passes are counted. */
      word?: string;
      /** Start from this line when the condition holds (the learner arrives late: they missed the start). */
      from?: { if: Cond; index: number };
      if?: Cond;
    }
  | ({ kind: 'intent' } & IntentStep)
  | { kind: 'password'; who: string; line: string; chunk: string; ask: string; right: string; close: string; wrong: string; consequence: string; if?: Cond };

/** An answer by intent: somebody asks, the learner picks; `check`: the right option, and the consequence of another. */
export interface IntentStep {
  who: string;
  ask: readonly Said[];
  options: readonly IntentOption[];
  check?: { right: number; consequence: string; fact: string };
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
  lines: readonly JobLine[];
  facts: readonly JobFact[];
  consequences: Readonly<Record<string, JobConsequence>>;
  steps: readonly Step[];
  /** The last word by grade, and the news by how it ended (`none`: the job's goal was not reached). */
  ending: Readonly<Record<JobGrade, readonly Said[]>>;
  news: Readonly<Record<JobGrade, readonly Said[]>> & { none?: readonly Said[] };
  /** The consequence that means "the goal was not reached" (the news then reads `none`). */
  failed?: string;
}

// ───────────────────────── conditions ─────────────────────────

/** What a condition is read against. */
export interface CondState {
  /** Per notebook entry: right, wrong, and for a time early / late. */
  note: (key: string) => { value: string | undefined; right: boolean; early: boolean; late: boolean };
  flags: ReadonlySet<string>;
  hits: ReadonlySet<string>;
}

export function evalCond(c: Cond | undefined, s: CondState): boolean {
  if (!c) return true;
  if ('not' in c) return !evalCond(c.not, s);
  if ('all' in c) return c.all.every((x) => evalCond(x, s));
  if ('any' in c) return c.any.some((x) => evalCond(x, s));
  if ('flag' in c) return s.flags.has(c.flag);
  if ('hit' in c) return s.hits.has(c.hit);
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
export function docRefs(doc: JobDoc): { lines: string[]; conds: Cond[]; consequences: string[] } {
  const lines: string[] = [];
  const conds: Cond[] = [];
  const consequences: string[] = [];
  const said = (list: readonly Said[] | undefined) => {
    for (const x of list ?? []) {
      lines.push(lineOf(x));
      conds.push(...condsOf(x));
    }
  };
  const intent = (i: IntentStep) => {
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
    if ('if' in st && st.if) conds.push(st.if);
    switch (st.kind) {
      case 'goto':
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
  const readsNote = (key: string): boolean => {
    const reads = (c: Cond): boolean => ('note' in c ? c.note === key : 'not' in c ? reads(c.not) : 'all' in c ? c.all.some(reads) : 'any' in c ? c.any.some(reads) : false);
    // a pickup / ride led by the entry plays it out too
    return refs.conds.some(reads) || doc.steps.some((s) => (s.kind === 'pickup' && s.entry === key) || (s.kind === 'ride' && s.entry === key));
  };
  // the consequences a step hits by itself (what the learner does), as opposed to a fact's own
  const byStep = new Set(docRefs({ ...doc, facts: [] }).consequences);
  for (const e of entries) {
    const fact = doc.facts.find((f) => f.line === e.line);
    if (!fact) out.push(`notebook entry without a fact: ${e.key}`);
    else if (!readsNote(e.key) && !(fact.byAction && byStep.has(fact.consequence))) out.push(`a wrong ${e.key} never plays out`);
  }
  for (const f of doc.facts) if (f.byAction && !byStep.has(f.consequence)) out.push(`no step plays out ${f.id}`);
  for (const f of doc.facts) if (!Object.hasOwn(doc.consequences, f.consequence)) out.push(`fact without a consequence: ${f.id}`);
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
    if (s.kind === 'intent' && s.check && (s.check.right < 0 || s.check.right >= s.options.length)) out.push(`intent check out of range: ${s.who}`);
  }
  if (!doc.steps.some((s) => s.kind === 'notebook')) out.push('no notebook');
  return out;
}
