import { describe, expect, it } from 'vitest';
import { panelSpans, parseName, SHEET_LAYOUT as SCRIPT_LAYOUT } from '../../../scripts/portraits.mjs';
import { PORTRAIT_SHEETS } from './portraitFiles';
import { MOOD_FALLBACK, SHEET_LAYOUT, sheetCell, type PortraitMood } from './portraitSheet';

/** The pictures in public/portraits, by file name (only listed, never loaded). */
const PICTURES = new Set(Object.keys(import.meta.glob('../../../public/portraits/*.webp')).map((p) => p.split('/').pop()));

describe('drawn portraits: one 3 × 3 grid per resident', () => {
  it('the app reads the cells in the order the script writes them', () => {
    expect(SHEET_LAYOUT).toEqual(SCRIPT_LAYOUT);
    expect(new Set(SHEET_LAYOUT).size).toBe(9);
  });

  it('every mood tries itself first and has a cell', () => {
    for (const [mood, chain] of Object.entries(MOOD_FALLBACK)) {
      expect(chain[0]).toBe(mood);
      for (const m of chain) expect(SHEET_LAYOUT).toContain(m);
    }
  });

  it('picks the cell of the mood, or of the nearest one drawn', () => {
    const sheets = { cafe: { v: 'abc', has: ['neutral', 'happy', 'sad', 'love'], bg: ['#111111', '#222222', '', '', '', '', '', '', ''] } };
    expect(sheetCell('cafe', 'happy', sheets)).toEqual({ src: 'portraits/cafe.webp?v=abc', cell: 1, bg: '#222222', lift: 0 });
    expect(sheetCell('cafe', 'happy', { cafe: { ...sheets.cafe, lift: 0.05 } })?.lift).toBe(0.05);
    expect(sheetCell('cafe', 'sad', sheets)?.bg).toBe('');
    expect(sheetCell('cafe', 'sad', { cafe: { v: 'x', has: ['sad'] } })?.bg).toBe('');
    expect(sheetCell('cafe', 'moved', sheets)?.cell).toBe(3); // moved → love
    expect(sheetCell('cafe', 'worried', sheets)?.cell).toBe(2); // worried → sad
    expect(sheetCell('cafe', 'thinking', sheets)?.cell).toBe(0); // thinking → neutral
    expect(sheetCell('park', 'happy', sheets)).toBeNull();
    expect(sheetCell('toString', 'happy', sheets)).toBeNull();
    expect(sheetCell('cafe', 'surprised', { cafe: { v: 'x', has: ['happy'] } })).toBeNull();
  });

  it('the list names only pictures that are there, with known moods', () => {
    for (const [id, s] of Object.entries(PORTRAIT_SHEETS)) {
      expect(PICTURES.has(`${id}.webp`)).toBe(true);
      expect(s.has.length).toBeGreaterThan(0);
      for (const m of s.has) expect(SHEET_LAYOUT).toContain(m as PortraitMood);
      // every drawn face has its background colour, for the round frame
      for (const m of s.has) expect(s.bg?.[SHEET_LAYOUT.indexOf(m as PortraitMood)]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('reads the owner’s file names', () => {
    expect(parseName('Zoe.PNG')).toEqual({ id: 'cinema', kind: 'auto' });
    expect(parseName('zoe-luoi.png')).toEqual({ id: 'cinema', kind: 'grid' });
    expect(parseName('Emma-Cười.jpg')).toEqual({ id: 'cafe', kind: 'cell', mood: 'happy' });
    expect(parseName('tom-suynghi.webp')).toEqual({ id: 'board', kind: 'cell', mood: 'thinking' });
    expect(parseName('kim_lolang.png')).toEqual({ id: 'clinic', kind: 'cell', mood: 'worried' });
    expect(parseName('cafe-pout.webp')).toEqual({ id: 'cafe', kind: 'cell', mood: 'pout' });
    expect(parseName('bob.png')).toBeNull();
    expect(parseName('constructor.png')).toBeNull();
    expect(parseName('emma.txt')).toBeNull();
  });

  it('finds three panels between the gutters, else nothing', () => {
    const line = (pattern: string) => [...pattern].map((c) => c === '.');
    // margin, panel, gutter, panel, gutter, panel, margin
    expect(panelSpans(line('..xxxxxxxx..xxxxxxxx..xxxxxxxx..'))).toEqual([
      [2, 10],
      [12, 20],
      [22, 30],
    ]);
    // no outer margin: the panels run to the edges
    expect(panelSpans(line('xxxxxxxxxx.xxxxxxxxxx.xxxxxxxxxx'))).toEqual([
      [0, 10],
      [11, 21],
      [22, 32],
    ]);
    // a plain picture: background above the head, then one panel
    expect(panelSpans(line('....xxxxxxxxxxxxxxxxxxxxxxxxxxxx'))).toBeNull();
    // a speck in a gutter is not a panel
    expect(panelSpans(line('..xxxxxxxxxx..x..xxxxxxxxxx..xxxxxxxxxx.'))).toHaveLength(3);
    // three people in a wide background (no gutters found) are not three panels
    expect(panelSpans(line('...xxxxxx.....xxxxxx.....xxxxxx..'))).toBeNull();
  });
});
