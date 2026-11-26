// Rico's dispatch office grows (docs/town.md §30, docs/gta-plan.md §4.4 and §6): three upgrades bought with xu (a sink
// that does not run out quickly: 500, 1,200, 2,500), and the manager's daily word (gta-plan: "quản lý gọi báo việc bằng
// lời, nghe sót thì lỗ": the firm's takings come in through a spoken line, a number misheard loses part of them).
// Pure rules; the IO is ./officeStore.ts, the panel features/town/dispatch/.
//
// Kept where things already are: an upgrade is a store item of the town (an id in town-progress `bought`, its cost
// counted by ./economy spentTotal, as the hideout's is), so no new stored or synced key; a word heard is the id
// `dp-word-<game day>` in the daily set `heard` of town-progress, as a paid dispatch shift is `dp-shift-<n>`.

import { CALL_TIMES, DRIVERS, SHIFT_CALLS, type DriverId } from './dispatch';
import { GAME_DAY_MS } from './sky';

export type OfficeUpgradeId = 'office-map' | 'office-car4' | 'office-line2';

export interface OfficeUpgrade {
  id: OfficeUpgradeId;
  /** Vietnamese (the panel's line). */
  name: string;
  /** One Vietnamese line: what it changes. */
  blurb: string;
  cost: number;
  /** What it adds to the firm's daily takings (xu, through the manager's word). */
  takings: number;
}

/** The three upgrades, the cheapest first (gta-plan §6: 500 / 1,200 / 2,500). */
export const OFFICE_UPGRADES: readonly OfficeUpgrade[] = [
  { id: 'office-map', name: 'Bản đồ có tên phố', blurb: 'Tên các phố hiện trên tấm bản đồ ở tường.', cost: 500, takings: 3 },
  { id: 'office-car4', name: 'Xe thứ tư', blurb: 'Jas lái xe thứ tư: thường có một xe gần khách hơn.', cost: 1200, takings: 4 },
  { id: 'office-line2', name: 'Đường dây thứ hai', blurb: 'Mười cuộc một ca, gọi dồn dập hơn; khách chờ máy bên kia không bị Bayline cướp.', cost: 2500, takings: 5 },
];

export function officeUpgrade(id: string): OfficeUpgrade | undefined {
  return OFFICE_UPGRADES.find((u) => u.id === id);
}

/** The upgrades owned, from the town's `bought` list. */
export function ownedUpgrades(bought: readonly string[]): OfficeUpgradeId[] {
  return OFFICE_UPGRADES.filter((u) => bought.includes(u.id)).map((u) => u.id);
}

/** The fourth car's driver (docs/city.md §15). */
export const FOURTH_DRIVER: DriverId = 'jas';

/** How a shift runs with the upgrades owned. */
export interface ShiftSetup {
  drivers: readonly DriverId[];
  calls: number;
  /** When each call rings (seconds into the shift). */
  times: readonly number[];
  /** Two lines: a call ringing while the other line is busy waits on hold (Bayline does not take it). */
  lines: 1 | 2;
  /** The wall map shows the streets' names. */
  streetNames: boolean;
}

/** With a second line: ten calls, coming closer together. */
export const TWO_LINE_TIMES: readonly number[] = [0, 20, 38, 54, 68, 80, 92, 102, 112, 120];

export function shiftSetup(owned: readonly string[]): ShiftSetup {
  const two = owned.includes('office-line2');
  return {
    drivers: owned.includes('office-car4') ? [...DRIVERS, FOURTH_DRIVER] : DRIVERS,
    calls: two ? TWO_LINE_TIMES.length : SHIFT_CALLS,
    times: two ? TWO_LINE_TIMES : CALL_TIMES,
    lines: two ? 2 : 1,
    streetNames: owned.includes('office-map'),
  };
}

// ───────────────────────── the manager's word ─────────────────────────

/** The firm's takings a day before any upgrade (xu, a game score), and at most this many words paid a real day. */
export const OFFICE_TAKINGS_BASE = 5;
export const WORDS_PAID_A_DAY = 2;
/** The share of the day's takings lost when the number is misheard. */
export const WORD_LOSS = 0.5;

/** The takings of a game day with the upgrades owned (xu). */
export function officeTakings(owned: readonly string[]): number {
  return OFFICE_TAKINGS_BASE + OFFICE_UPGRADES.filter((u) => owned.includes(u.id)).reduce((n, u) => n + u.takings, 0);
}

/** What a word pays: all the takings when the number was heard right, the rest after the loss when not. */
export function wordPay(takings: number, right: boolean): number {
  return right ? takings : Math.round(takings * (1 - WORD_LOSS));
}

/** The game day a real time is in (counted from 1970): one word each. */
export const gameDayOf = (ms: number): number => Math.floor(ms / GAME_DAY_MS);
export const wordId = (gameDay: number): string => `dp-word-${gameDay}`;

/** Whether this game day's word waits: not heard yet, and the real day's allowance not used up. */
export function wordDue(heardToday: readonly string[], now: number): boolean {
  if (heardToday.includes(wordId(gameDayOf(now)))) return false;
  return heardToday.filter((id) => id.startsWith('dp-word-')).length < WORDS_PAID_A_DAY;
}

// ───────────────────────── numbers said aloud ─────────────────────────

const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const TEENS = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** 1 … 999 in British words ("two hundred and forty", "a hundred and fourteen"). */
export function numberWords(n: number): string {
  const v = Math.max(1, Math.min(999, Math.round(n)));
  const h = Math.floor(v / 100);
  const r = v % 100;
  const under = r === 0 ? '' : r < 10 ? ONES[r] : r < 20 ? TEENS[r - 10] : TENS[Math.floor(r / 10)] + (r % 10 ? '-' + ONES[r % 10] : '');
  if (h === 0) return under;
  const hundreds = h === 1 ? 'a hundred' : `${ONES[h]} hundred`;
  return r === 0 ? hundreds : `${hundreds} and ${under}`;
}

/**
 * The number Tess says on a game day (pounds: 130 … 390, tens of thirty and up, so it has a "-teen" look-alike), the
 * look-alike a careless ear hears ("forty" → "fourteen"), and a third that is plainly another number. Stable per day.
 */
export function wordNumbers(gameDay: number): { said: number; alike: number; other: number } {
  let x = (gameDay * 2654435761) >>> 0;
  const r = () => ((x = (x * 1103515245 + 12345) >>> 0) / 4294967296);
  const h = 1 + Math.floor(r() * 3);
  const d = 3 + Math.floor(r() * 7);
  const said = h * 100 + d * 10;
  const alike = h * 100 + 10 + d;
  const other = (h === 3 ? 1 : h + 1) * 100 + d * 10;
  return { said, alike, other };
}
