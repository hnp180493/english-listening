// "Vụ án ở thị trấn" (docs/town.md §17): the shapes. A cosy mystery told one chapter a day: three residents each say
// what they saw (audio, their own voices); a question can only be answered by catching a detail in what was said; the
// answer gives a clue and a cliffhanger, and the next chapter opens tomorrow. Designed from what brings people back
// daily without endless play: one puzzle a day (Wordle's scarcity) and an unfinished story (cliffhangers raise the
// wish for the next part: Communication Research Reports, 2023).

import type { Level } from '../types';

export interface CaseLine {
  /** What they say: everyday spoken English, 5–16 words. */
  text: string;
  /** Natural Vietnamese meaning (shown after the chapter is solved). */
  vi: string;
}

export interface Testimony {
  /** Who speaks (a resident's place id; their voice says the lines). */
  placeId: string;
  /** 2–3 lines. */
  lines: readonly CaseLine[];
}

export interface CaseChapter {
  /** Short Vietnamese title ("Kỳ 1: Đài phun nước cạn xu"). */
  title: string;
  /** One or two Vietnamese sentences: where we are, what just happened. Never gives the answer away. */
  scene: string;
  /** Three residents, three statements. */
  testimonies: readonly [Testimony, Testimony, Testimony];
  /** A Vietnamese question whose answer is a detail SAID in the testimonies (a time, a place, a thing, who). */
  question: string;
  /** Three Vietnamese options; all plausible, one right. */
  options: readonly [string, string, string];
  answer: 0 | 1 | 2;
  /** The testimony (0–2) that holds the detail: named after a wrong pick ("Nghe lại lời của …"). */
  hint: 0 | 1 | 2;
  /** Vietnamese: what goes into the notebook once solved (the fact established). */
  clue: string;
  /** Vietnamese: one sentence that makes tomorrow's chapter wanted. '' on the last chapter. */
  cliffhanger: string;
}

export interface TownCase {
  /** Stable id `case-<n>`. Never change it. */
  id: string;
  /** Vietnamese title ("Ai lấy xu trong đài phun nước?"). */
  title: string;
  level: Level;
  /** Five chapters; the fifth one's question is who did it (its options are three residents' names). */
  chapters: readonly [CaseChapter, CaseChapter, CaseChapter, CaseChapter, CaseChapter];
  /** Vietnamese: how it all really happened (2–3 sentences), shown when the last chapter is solved. */
  ending: string;
  /** The resident the learner helped (+friendship when the case closes). */
  friend: string;
}
