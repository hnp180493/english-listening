// "Phụ quầy cà phê" (docs/town.md §16): the shapes. Residents come to Emma's counter and SAY their order in fast,
// connected English; the learner taps what they asked for before their patience runs out. Designed from what keeps
// short games played (owner, 2026-11-24: "không có game gì gây nghiện giữ chân người học à… sao mày không thử đi tham
// khảo ở trên mạng"): one action understood at a glance, a patience meter, a combo that a miss resets, rising pace,
// difficulty held near 85% right, a personal best, one simple day streak, a capped daily reward.

import type { Level } from '../types';

/** What the café sells: the tiles of the counter. Ids are stable (orders name them). */
export const CAFE_ITEMS = ['latte', 'iced-latte', 'black-coffee', 'tea', 'iced-tea', 'green-tea', 'orange-juice', 'water', 'muffin', 'cookie', 'lemon-cake', 'sandwich'] as const;
export type CafeItemId = (typeof CAFE_ITEMS)[number];

/** How many of an item (1–3). Items not asked for are absent. */
export type CafeBasket = Partial<Record<CafeItemId, number>>;

export interface CafeOrder {
  /** Stable id `cf-<placeId>-<n>` (n = 1…). Never change it. */
  id: string;
  /** Who orders (their voice says it). */
  placeId: string;
  /**
   * 1: one kind of thing, said plainly. 2: two kinds or a number ("two teas and a muffin"). 3: a change of mind, a
   * "no …" or a near sound-alike that must be heard right ("an iced tea" / "a nice tea").
   */
  level: Level;
  /** What they say: everyday spoken English, 4–16 words, the way that resident talks. */
  text: string;
  /** Natural Vietnamese meaning (shown after the answer). */
  vi: string;
  /** What must be on the tray: exactly this. 1–4 things in all. */
  items: CafeBasket;
}
