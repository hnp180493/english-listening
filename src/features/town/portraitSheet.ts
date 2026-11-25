// A resident's drawn portraits are ONE picture (docs/portrait-prompts.md): nine faces in a 3 × 3 grid, made by
// scripts/portraits.mjs into public/portraits/<placeId>.webp and listed in portraitFiles.ts. This picks the cell
// a mood shows; Portrait (art.tsx) shows that cell of the one picture, so a new face never waits for a new file.

import { PORTRAIT_SHEETS } from './portraitFiles';

/**
 * A face in a portrait: as it is, smiling (a right answer), sad (a wrong one), 'love' = shy and blushing (more
 * friendship, a warm answer on a date), 'surprised' (a proposal), 'moved' = happy tears (a yes, the wedding),
 * 'pout' = a little sulk (a gift they do not like, a clumsy answer), 'thinking' (a witness remembering what they saw),
 * 'worried' (a café customer whose patience runs low, a witness misheard).
 */
export type PortraitMood = 'neutral' | 'happy' | 'sad' | 'love' | 'surprised' | 'moved' | 'pout' | 'thinking' | 'worried';

/** The grid's cells, left to right, top to bottom (the same order as scripts/portraits.mjs SHEET_LAYOUT). */
export const SHEET_LAYOUT: readonly PortraitMood[] = ['neutral', 'happy', 'sad', 'love', 'surprised', 'moved', 'pout', 'thinking', 'worried'];

/** Which face stands in for a mood whose cell is empty, in order (the plain one last). */
export const MOOD_FALLBACK: Readonly<Record<PortraitMood, readonly PortraitMood[]>> = {
  neutral: ['neutral', 'happy'],
  happy: ['happy', 'neutral'],
  sad: ['sad', 'neutral'],
  love: ['love', 'happy', 'neutral'],
  surprised: ['surprised', 'neutral'],
  moved: ['moved', 'love', 'happy', 'neutral'],
  pout: ['pout', 'sad', 'neutral'],
  thinking: ['thinking', 'neutral'],
  worried: ['worried', 'sad', 'neutral'],
};

export interface SheetEntry {
  /** A hash of the file: a new picture is fetched again. */
  readonly v: string;
  /** The moods drawn in it (an empty cell is left out). */
  readonly has: readonly string[];
  /** Each cell's background colour ('' = empty): a round frame fills round the face with it. */
  readonly bg?: readonly string[];
  /** How far a round frame moves the picture down (part of the frame) so the whole head is inside the circle. */
  readonly lift?: number;
}

const PORTRAIT_DIR = 'portraits/';

/**
 * The drawn picture of a resident and the cell this mood shows (0–8, left to right, top to bottom), or null when they
 * have no picture or none of the mood's fallbacks is drawn. The URL is next to the page (public/portraits, the portable
 * build's portraits/ folder); `bg` is the cell's background colour ('' when not measured), `lift` the round frame's move.
 */
export function sheetCell(placeId: string, mood: PortraitMood, sheets: Readonly<Record<string, SheetEntry>> = PORTRAIT_SHEETS): { src: string; cell: number; bg: string; lift: number } | null {
  const s = Object.hasOwn(sheets, placeId) ? sheets[placeId] : undefined;
  if (!s) return null;
  for (const m of MOOD_FALLBACK[mood]) {
    if (!s.has.includes(m)) continue;
    const cell = SHEET_LAYOUT.indexOf(m);
    return { src: `${PORTRAIT_DIR}${placeId}.webp?v=${s.v}`, cell, bg: s.bg?.[cell] ?? '', lift: s.lift ?? 0 };
  }
  return null;
}
