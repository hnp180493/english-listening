// A talk with a resident met out in the town (docs/town.md §14 "Gặp trên đường"): a short, coherent exchange, not
// five unrelated sentences (owner, 2026-11-23: "gặp trên đường sao toàn câu tào lao không liên quan gì nhau vậy?").
// The resident's lines are the listening checks (hear → pick the meaning; one is typed); the learner's own lines sit
// between them as what their character answers (shown, and said in the player's voice).

import type { Level } from '../types';
import type { FactId } from './story';

export interface StreetTalkLine {
  /** 'them': the resident (a listening check); 'you': the learner's character (shown between the checks). */
  who: 'them' | 'you';
  /** Everyday spoken English, short (4–14 words), true anywhere in the street. */
  text: string;
  /** Natural Vietnamese meaning. */
  vi: string;
}

export interface StreetTalk {
  /** Stable id `st-<placeId>-<n>`; line ids are `<id>-<k>` (k = 1, 2, … over every line). Never change them. */
  id: string;
  placeId: string;
  level: Level;
  /** Only from this many hearts (a friendlier talk). */
  minHearts?: number;
  /** Only once the learner knows this fact about them (data/stories): the talk builds on it. */
  fact?: FactId;
  /** 5–7 lines: starts and ends with 'them'; 'them' and 'you' alternate; 3–4 'them' lines. */
  lines: readonly StreetTalkLine[];
}
