// "Giao hàng cho Emma" (docs/town.md §18): the shapes. After a shift at the counter Emma hands the learner an order
// to carry to somebody in town. She SAYS who it is for; the learner has to understand that and find the right person
// in the 3D town. The games belong together (owner, 2026-11-24: "các game này nọ cần có context và liên quan với
// nhau"): the café makes the deliveries, a delivery ends in a word with the one it was for, and they point on to the
// day's chapter of the mystery.

import type { Level } from '../types';
import type { CafeItemId } from './cafeTypes';

export interface DeliveryOrder {
  /** Stable id `dl-<placeId>-<n>` (n = 1…4). Never change it. */
  id: string;
  /** Who it is for (a resident's place id; never 'cafe': Emma sends it). */
  to: string;
  /**
   * 1: Emma names them and where they are ("Can you take this to Sam at the bus station?").
   * 2: no name: who they are by their job or place ("the man who sells the bus tickets").
   * 3: no name, no job: something the learner knows about them from their stories (their dog, what they love, what
   *    happened to them), so knowing the town is what finds them.
   */
  level: Level;
  /** What is carried (a tile of the counter). */
  item: CafeItemId;
  /** What Emma says: everyday spoken English, 8–22 words, one or two sentences. Names the item. */
  text: string;
  /** Natural Vietnamese meaning. */
  vi: string;
}
