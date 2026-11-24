// The rules of "Vụ án ở thị trấn" (docs/town.md §17), pure: which chapter is open today, how a solved chapter is
// rated and paid, and what is stored (KEYS.townCases, synced, merged by core/syncMerge mergeCases).
//
// One chapter a day: a chapter opens the local day AFTER the one before it was solved (the first chapter of the first
// case is open from the start). That scarcity is the point (Wordle: one puzzle a day leaves people wanting the next),
// and each chapter ends on a cliffhanger (a 2023 study in Communication Research Reports found cliffhangers raise the
// wish for the next part). The research on the Zeigarnik effect itself is contested: no promise is made here.

import type { TownCase } from './caseTypes';

/** Xu for a solved chapter: CHAPTER_XU + STAR_XU a star, once. */
export const CHAPTER_XU = 4;
export const STAR_XU = 2;
/** Friendship with the case's `friend` when its last chapter is solved. */
export const CASE_BOND = 20;

export type Stars = 1 | 2 | 3;

/**
 * 3: the right answer at the first pick with every testimony heard exactly once; 2: right at the first pick with a
 * replay; 1: right after a wrong pick.
 */
export function chapterStars(wrongPicks: number, plays: readonly number[]): Stars {
  if (wrongPicks > 0) return 1;
  return plays.every((n) => n <= 1) ? 3 : 2;
}

export function chapterXu(stars: Stars): number {
  return CHAPTER_XU + STAR_XU * stars;
}

/** A line's id in the clip inventory and the notebook: `<case id>-<chapter 1..5>-<testimony 1..3>-<line 1..>`. */
export const caseLineId = (caseId: string, chapter: number, testimony: number, line: number): string => `${caseId}-${chapter + 1}-${testimony + 1}-${line + 1}`;

// ───────────────────────── stored (version 1) ─────────────────────────
//
// done: per case and chapter (0..4), when it was first solved and with how many stars. The earlier time and the
// higher stars win (two browsers that each solved it before a sync).

export const CASES_VERSION = 1;

export interface ChapterDone {
  at: number;
  stars: Stars;
}

export interface TownCases {
  version: number;
  done: Record<string, Record<string, ChapterDone>>;
}

export function emptyTownCases(): TownCases {
  return { version: CASES_VERSION, done: {} };
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const CASE_ID = /^case-\d{1,3}$/;
const CHAPTER = /^[0-4]$/;

function parseDone(raw: unknown): ChapterDone | null {
  if (!isObj(raw)) return null;
  const at = typeof raw.at === 'number' && Number.isFinite(raw.at) && raw.at > 0 ? Math.round(raw.at) : 0;
  const stars = raw.stars === 1 || raw.stars === 2 || raw.stars === 3 ? raw.stars : 0;
  return at && stars ? { at, stars } : null;
}

export function parseTownCases(raw: unknown): TownCases {
  const out = emptyTownCases();
  if (!isObj(raw) || !isObj(raw.done)) return out;
  for (const [id, v] of Object.entries(raw.done)) {
    if (!CASE_ID.test(id) || !isObj(v)) continue;
    const row: Record<string, ChapterDone> = {};
    for (const [ch, d] of Object.entries(v)) {
      const done = CHAPTER.test(ch) ? parseDone(d) : null;
      if (done) row[ch] = done;
    }
    if (Object.keys(row).length > 0) out.done[id] = row;
  }
  return out;
}

/** Idempotent, commutative and associative (core/syncMerge.props.test). */
export function mergeTownCases(x: TownCases, y: TownCases): TownCases {
  const out = emptyTownCases();
  out.version = Math.max(x.version, y.version, CASES_VERSION);
  for (const id of new Set([...Object.keys(x.done), ...Object.keys(y.done)])) {
    const row: Record<string, ChapterDone> = {};
    for (const ch of new Set([...Object.keys(x.done[id] ?? {}), ...Object.keys(y.done[id] ?? {})])) {
      const a = x.done[id]?.[ch];
      const b = y.done[id]?.[ch];
      row[ch] = !a || !b ? { ...(a ?? b)! } : { at: Math.min(a.at, b.at), stars: Math.max(a.stars, b.stars) as Stars };
    }
    out.done[id] = row;
  }
  return out;
}

// ───────────────────────── what is open ─────────────────────────

/** The local day of a time, YYYY-MM-DD. */
export function caseDay(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export type CaseNow =
  /** A chapter to play today. */
  | { kind: 'open'; case: TownCase; chapter: number }
  /** The next chapter opens tomorrow (the one before was solved today). */
  | { kind: 'tomorrow'; case: TownCase; chapter: number }
  /** Every case is closed. */
  | { kind: 'finished' };

/** Where the learner is: the first chapter not solved yet, open unless the one before it was solved today. */
export function caseNow(cases: readonly TownCase[], stored: TownCases, now: number): CaseNow {
  let before: ChapterDone | null = null;
  for (const c of cases) {
    for (let ch = 0; ch < c.chapters.length; ch++) {
      const done = stored.done[c.id]?.[String(ch)];
      if (done) {
        before = done;
        continue;
      }
      const wait = !!before && caseDay(before.at) === caseDay(now);
      return { kind: wait ? 'tomorrow' : 'open', case: c, chapter: ch };
    }
  }
  return { kind: 'finished' };
}

/** The clues of a case found so far, in order. */
export function cluesOf(c: TownCase, stored: TownCases): string[] {
  return c.chapters.filter((_, ch) => !!stored.done[c.id]?.[String(ch)]).map((ch) => ch.clue);
}

export interface ChapterSolve {
  cases: TownCases;
  /** Solved for the first time now (false: it was solved before; nothing is paid again). */
  first: boolean;
  xu: number;
  /** The case closed with this chapter. */
  closed: boolean;
}

/** A chapter solved at `now` with `stars`: written once (a second solve changes nothing and pays nothing). */
export function solveChapter(stored: TownCases, c: TownCase, chapter: number, stars: Stars, now: number): ChapterSolve {
  const key = String(chapter);
  if (stored.done[c.id]?.[key] || chapter < 0 || chapter >= c.chapters.length) return { cases: stored, first: false, xu: 0, closed: false };
  const next: TownCases = { ...stored, done: { ...stored.done, [c.id]: { ...(stored.done[c.id] ?? {}), [key]: { at: now, stars } } } };
  return { cases: next, first: true, xu: chapterXu(stars), closed: chapter === c.chapters.length - 1 };
}
