// Shared contracts of "Thị trấn": a small town the learner builds. Its residents SAY a sentence (connected speech,
// audio only) and the learner picks its meaning. Every reward comes from understanding what was said: xu (coins)
// are earned per understood line, and xu build the empty lots and buy the decorations (core/town/economy).
//
// Where things live: places, decorations and their prices in data/town; the world layout (tiles, spots, paths) in
// data/townWorld + core/town/map (the game shell's side); the stored progress in ./progress.

import type { Level } from '../types';

/** A point of the world: x = column, y = row. The layout itself is not defined here. */
export interface Pos {
  x: number;
  y: number;
}

export type Dir = 'up' | 'down' | 'left' | 'right';

export interface TownPlace {
  /** Stable id (stored in purchases, used by the world layout and CSS): never shown, never translated. */
  id: string;
  /** Sentence topic spoken here (Sentence.topic): one place per topic. */
  topic: string;
  /** Vietnamese name. */
  name: string;
  /** Who you meet there. Only a name: the sentences are not written for a role. */
  resident: string;
  /** Xu to build it. 0 = it stands from the start. */
  cost: number;
}

/** Something bought with xu that only makes the town prettier (its spots are in the world layout). */
export interface TownDecoration {
  /** Stable id (stored in purchases). Never the id of a place. */
  id: string;
  /** Vietnamese name. */
  name: string;
  cost: number;
}

/**
 * One thing a resident says. Today every line is a built-in dictation sentence (`sentenceId` = `id`), so its audio is
 * exactly what Chép chính tả plays (features/dictation dictationAudio accepts a line as it is: text, level, say).
 * Authored mini-dialogues can add lines later: a line without `sentenceId` has no dictation card to fall back on.
 */
export interface TownLine {
  /** Key of the line in the stored progress. */
  id: string;
  text: string;
  vi: string;
  level: Level;
  /** Authored connected spelling, as Sentence.say. */
  say?: string;
  /** The built-in dictation sentence this line is (review card `dict:<sentenceId>`). */
  sentenceId?: string;
}

/**
 * How one line went: 'first' = the right meaning after exactly one play at the normal speed, 'replayed' = right but
 * with more or slower plays, 'wrong' = another meaning picked.
 */
export type LineOutcome = 'first' | 'replayed' | 'wrong';

/** Lines said in one conversation. */
export const VISIT_SIZE = 5;
