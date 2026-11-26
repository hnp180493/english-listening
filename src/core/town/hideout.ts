// The learner's hideout in Westbay ("Chỗ ẩn", data/city/hideout.ts; docs/town.md §29), its rules, pure. Bought once
// with xu through the town's own store (./economy townItem: the id goes into town-progress `bought`, the cost is
// spent), it is where heat cools ("Nằm nghỉ", once an hour of the game), where clothes are changed (the town's Tủ đồ)
// and where the lines missed in jobs and at the dispatch office are heard again ("Nghe lại băng": a re-listen, never
// a test: nothing is scored there).
//
// Stored under KEYS.townHideout (synced, merged by core/syncMerge mergeHideout): when it was first bought (the earlier
// time wins), the last rest (the later wins) and upgrades to come (each the earlier time). Ownership is the town's
// `bought` list OR a buying time here, so a copy of either key alone is enough.

import { GAME_DAY_MS } from './sky';
import { HIDEOUT_ID, RELISTEN_PREFIXES } from '../../data/city/hideout';

export const HIDEOUT_VERSION = 1;

export interface TownHideout {
  version: number;
  /** When it was first bought (ms), on any machine; null = not bought. */
  bought: number | null;
  /** The last "Nằm nghỉ" (ms); 0 = never. */
  rested: number;
  /** Upgrades bought (data/city/hideout.ts HIDEOUT_UPGRADES): id → when first bought. None exist yet. */
  upgrades: Record<string, number>;
}

export function emptyTownHideout(): TownHideout {
  return { version: HIDEOUT_VERSION, bought: null, rested: 0, upgrades: {} };
}

/** A time the store accepts: a whole number of ms after 2020 and not absurdly far ahead. */
const okTime = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 1_577_836_800_000 && v < 4_102_444_800_000;
const okId = (id: string): boolean => /^[a-z0-9][a-z0-9-]{0,39}$/.test(id) && id !== '__proto__';

/** Whatever is stored (or synced in), as a clean value; anything broken counts as nothing. */
export function parseTownHideout(raw: unknown): TownHideout {
  const out = emptyTownHideout();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const r = raw as Record<string, unknown>;
  if (okTime(r.bought)) out.bought = r.bought;
  if (okTime(r.rested)) out.rested = r.rested;
  const up = r.upgrades;
  if (up && typeof up === 'object' && !Array.isArray(up)) {
    for (const [id, at] of Object.entries(up as Record<string, unknown>)) if (okId(id) && okTime(at)) out.upgrades[id] = at;
  }
  return out;
}

/** Two copies into one (commutative, idempotent, associative): the earlier buying, the later rest, each upgrade's earlier time. */
export function mergeTownHideout(a: TownHideout, b: TownHideout): TownHideout {
  const out = emptyTownHideout();
  out.bought = a.bought === null ? b.bought : b.bought === null ? a.bought : Math.min(a.bought, b.bought);
  out.rested = Math.max(a.rested, b.rested);
  for (const id of [...new Set([...Object.keys(a.upgrades), ...Object.keys(b.upgrades)])].sort()) {
    const x = a.upgrades[id];
    const y = b.upgrades[id];
    out.upgrades[id] = x !== undefined && y !== undefined ? Math.min(x, y) : (x ?? y)!;
  }
  return out;
}

/** Owned: in the town's `bought` list, or bought here (either copy alone is enough). */
export function ownsHideout(bought: readonly string[], state: TownHideout): boolean {
  return state.bought !== null || bought.includes(HIDEOUT_ID);
}

/** The hideout bought now (kept as it was when it is already). */
export function markBought(state: TownHideout, now: number): TownHideout {
  return state.bought !== null ? state : { ...state, bought: now };
}

/** An hour of the game in real ms (two real minutes: ./sky.ts). */
export const GAME_HOUR_MS = GAME_DAY_MS / 24;

/** The hour of the game a real time falls in, counted from 1970 (rests are one per such hour). */
export const gameHourIndex = (ms: number): number => Math.floor(ms / GAME_HOUR_MS);

/** "Nằm nghỉ" can be taken now: owned, and no rest yet in this hour of the game. */
export function canRest(owned: boolean, state: TownHideout, now: number): boolean {
  return owned && (state.rested === 0 || gameHourIndex(now) > gameHourIndex(state.rested));
}

/** Real ms until the next rest is allowed (0 = now). */
export function restWait(state: TownHideout, now: number): number {
  if (state.rested === 0 || gameHourIndex(now) > gameHourIndex(state.rested)) return 0;
  return (gameHourIndex(state.rested) + 1) * GAME_HOUR_MS - now;
}

/** A rest taken now: the heat goes to zero (the page does that) and the time is written down. */
export function markRested(state: TownHideout, now: number): TownHideout {
  return { ...state, rested: Math.max(state.rested, now) };
}

/** A review card's ref that "Nghe lại băng" lists: a line of a job (`job-…`) or a call to the dispatch office (`disp-…`). */
export const isRelistenRef = (ref: string): boolean => RELISTEN_PREFIXES.some((p) => ref.startsWith(p));

/** A card as "Nghe lại băng" needs it. */
export interface TapeCard {
  /** The card's ref (after `talk:`). */
  ref: string;
  /** When it was enrolled (ms; the newest first). */
  added: number;
  /** When it is due in Ôn tập (ms). */
  due: number;
}

/** The tape: the cards of missed job lines and dispatch calls, the newest first, at most `max`. */
export function tapeOf(cards: readonly TapeCard[], max = 40): TapeCard[] {
  return cards
    .filter((c) => isRelistenRef(c.ref))
    .sort((a, b) => b.added - a.added || (a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0))
    .slice(0, max);
}

/** How many of the tape's cards are due in Ôn tập now (the link "Ôn tập" shows only then). */
export const dueOnTape = (tape: readonly TapeCard[], now: number): number => tape.filter((c) => c.due <= now).length;
