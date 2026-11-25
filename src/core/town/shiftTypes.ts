// "Ca làm việc" in Westbay (the café game's cousin, docs/town.md §16): the shapes. A caller or a customer SAYS a
// request in connected English; the learner sets two or three things (where from, where to, when; which flower, what
// colour, how many) before their patience runs out. One engine (./shift.ts) and one panel
// (features/town/city/ShiftPanel.tsx); a new shift is data only (data/city/shifts/).

import type { Level } from '../types';

/** One thing the learner can pick in a slot. */
export interface ShiftOption {
  /** Stable id within its slot (orders name it). */
  id: string;
  /** Vietnamese label of the tile (place names stay as they are). */
  label: string;
  /**
   * The words or phrases by which it may be said, lower case, as written in an order's text ("half past seven",
   * "seven thirty"). The content test checks that every order says its answer by one of them.
   */
  hear: readonly string[];
}

/** One thing to set: a row of tiles. */
export interface ShiftSlot {
  id: string;
  /** Vietnamese label of the row ("Đón ở"). */
  label: string;
  /** 4–8 options. */
  options: readonly ShiftOption[];
}

export interface ShiftOrder {
  /** Stable id `sh-<shiftId>-<n>` (n = 1…). Never change it. */
  id: string;
  /**
   * 1: said plainly, nothing else named. 2: said the way people say it (half a dozen, seven thirty, more words round
   * it). 3: two reductions, a change of mind ("…no, sorry, make that the station") or a near sound-alike that must
   * be heard right; a wrong option may be named.
   */
  level: Level;
  /** The browser voice that says it. */
  gender: 'male' | 'female';
  /** What is said: everyday spoken English, 6–24 words, one or two sentences. */
  text: string;
  /** Natural Vietnamese meaning (shown after the answer). */
  vi: string;
  /** Authored connected spelling, when the generated one would be wrong. */
  say?: string;
  /** slot id → option id: what must be set. Every slot of the shift. */
  answer: Readonly<Record<string, string>>;
}

export interface ShiftDef {
  /** Stable id, lower-case letters ('taxi', 'flowers'). */
  id: string;
  /** Vietnamese name ("Tổng đài taxi của Rico"). */
  name: string;
  /** The city person whose shift it is (data/cityWorld.ts CITY_PLACE_IDS). */
  at: string;
  /** One Vietnamese line for the start card. */
  blurb: string;
  /** 2–3 things to set. */
  slots: readonly ShiftSlot[];
  orders: readonly ShiftOrder[];
}
