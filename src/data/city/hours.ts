// Westbay's opening hours by the GAME's clock (docs/gta-plan.md §4.7; docs/town.md §33): the harbour's night market
// opens at dusk, the offices and the library close in the evening, the fish stall is a morning trade. Outside its hours
// a place is shut: its person is not about (they are inside, out of sight), a CLOSED board hangs at the door, and a
// scene or a story chapter that needs them says when it opens ("Mở lúc 18:00"). Nothing waits for long: no place is
// shut more than sixteen hours of the game (32 real minutes), and the admin sandbox ignores the hours. The hours are
// guesses until somebody plays them.
//
// Hours are of the game's day (core/town/sky.ts gameHour: 0 … 24); `close` before `open` runs past midnight.

export interface Hours {
  open: number;
  close: number;
}

export const CITY_HOURS: Readonly<Record<string, Hours>> = {
  // the night market on the harbour square
  mei: { open: 17, close: 2 },
  sol: { open: 17, close: 2 },
  // the offices, the library
  priya: { open: 8, close: 19 },
  vivian: { open: 9, close: 19 },
  colin: { open: 8, close: 19 },
  finch: { open: 9, close: 21 },
  // the fish stall: from the first boats till the afternoon
  hal: { open: 5, close: 15 },
};

const norm = (h: number): number => ((h % 24) + 24) % 24;

/** Open at a game hour (a place without hours always is). */
export function openAt(id: string, hour: number): boolean {
  const h = Object.hasOwn(CITY_HOURS, id) ? CITY_HOURS[id] : undefined;
  if (!h) return true;
  const t = norm(hour);
  return h.open < h.close ? t >= h.open && t < h.close : t >= h.open || t < h.close;
}

/** The hour it opens next when shut now (0 … 24), null when open now (or without hours). */
export function opensAt(id: string, hour: number): number | null {
  if (openAt(id, hour)) return null;
  return CITY_HOURS[id].open;
}

/** "18:00". */
export const hourLabel = (h: number): string => `${String(Math.floor(norm(h))).padStart(2, '0')}:00`;

/** The places shut at a game hour. */
export const shutAt = (hour: number): string[] => Object.keys(CITY_HOURS).filter((id) => !openAt(id, hour));
