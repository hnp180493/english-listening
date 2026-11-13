// "Nghe 1 lần là đúng" for real speech (Video thật → Chép chính tả). Pure.
//
// The plays of each transcript line during one visit of the player, and whether a dictation check of a line is a
// FIRST listen: the line was never played before this visit, never dictated or ticked, and its text was never on
// screen. Only then does the check count in the long-term number (core/history DayAgg.onceReal), which is kept
// apart from the app-voice number (DayAgg.once): a real speaker and the app's voice are not the same test.
//
// What it cannot know: a video the learner watched somewhere else, lines played before MediaProgress.heard existed,
// and plays through the YouTube player's own controls while the tab was throttled. So it can still count a line the
// learner knew; it never counts one this app showed or played before.

import { NO_LISTENS, type ListenTally } from '../../core/dictation/listens';
import type { MediaProgress } from './library';

export interface LineListens extends ListenTally {
  /** The line was already in MediaProgress.heard when this visit first played it. */
  prior: boolean;
}

export interface ListenSession {
  /** MediaProgress.heard when the player opened. */
  heardBefore: Set<number>;
  lines: Map<number, LineListens>;
  /** Lines shown in "Nghe & xem" (their text may have been revealed there). */
  exposed: Set<number>;
  /** The whole transcript was readable at some point (subtitles on in "Nghe & xem"). */
  exposedAll: boolean;
}

export function newListenSession(progress: Pick<MediaProgress, 'heard'>): ListenSession {
  return { heardBefore: new Set(progress.heard ?? []), lines: new Map(), exposed: new Set(), exposedAll: false };
}

/** One play of a line. Below 1× it is a slowed play (not a first listen at real speed). Returns true on its first play this visit. */
export function noteLinePlay(s: ListenSession, index: number, speed: number): boolean {
  let e = s.lines.get(index);
  const first = !e;
  if (!e) {
    e = { ...NO_LISTENS, prior: s.heardBefore.has(index) };
    s.lines.set(index, e);
  }
  if (speed >= 1) e.normal += 1;
  else e.slow += 1;
  return first;
}

/** The line was on screen in "Nghe & xem"; with subtitles on, so was every other line (the transcript list). */
export function noteLineShown(s: ListenSession, index: number, subtitlesOn: boolean): void {
  s.exposed.add(index);
  if (subtitlesOn) s.exposedAll = true;
}

export function lineTally(s: ListenSession, index: number): ListenTally {
  const e = s.lines.get(index);
  return e ? { normal: e.normal, slow: e.slow, chunks: 0 } : NO_LISTENS;
}

/** The learner meets this line for the first time: never played, dictated, ticked or shown here before. */
export function lineIsFresh(s: ListenSession, index: number, progress: Pick<MediaProgress, 'done' | 'scores'>): boolean {
  if (s.exposedAll || s.exposed.has(index)) return false;
  if (s.heardBefore.has(index) || s.lines.get(index)?.prior) return false;
  return progress.scores[index] === undefined && !progress.done.includes(index);
}
