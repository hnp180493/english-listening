import { describe, expect, it } from 'vitest';
import { labelRect, overlaps, placeLabels, type LabelCandidate } from './mapLabels';

const BOX = { w: 400, h: 300 };
const cand = (id: string, x: number, y: number, priority: number, patch: Partial<LabelCandidate> = {}): LabelCandidate => ({ id, x, y, w: 80, h: 20, priority, ...patch });

describe('label placement', () => {
  it('puts a label above its anchor first', () => {
    const [p] = placeLabels([cand('a', 200, 150, 1)], BOX);
    expect(p).toMatchObject({ id: 'a', side: 'above', left: 160, top: 126 });
  });

  it('gives the spot to the more important name; the other moves to its next side', () => {
    const out = placeLabels([cand('lot', 200, 150, 10), cand('house', 210, 150, 100)], BOX);
    const house = out.find((p) => p.id === 'house')!;
    const lot = out.find((p) => p.id === 'lot')!;
    expect(house.side).toBe('above');
    expect(lot.side).toBe('below');
    expect(overlaps(house, lot)).toBe(false);
  });

  it('leaves out a name that fits nowhere', () => {
    const out = placeLabels([cand('a', 200, 150, 5, { sides: ['center'] }), cand('b', 205, 152, 1, { sides: ['center'] })], BOX);
    expect(out.map((p) => p.id)).toEqual(['a']);
  });

  it('keeps names inside the box and off the blocked parts', () => {
    expect(placeLabels([cand('edge', 10, 150, 1, { sides: ['left'] })], BOX)).toEqual([]);
    const blocked = [{ left: 0, top: 0, w: 400, h: 60 }];
    const [p] = placeLabels([cand('top', 200, 70, 1)], BOX, blocked);
    expect(p.side).not.toBe('above');
    expect(overlaps(p, blocked[0])).toBe(false);
  });

  it('never lets two placed names overlap', () => {
    const many = Array.from({ length: 40 }, (_, i) => cand(`n${i}`, 40 + ((i * 37) % 320), 30 + ((i * 53) % 240), i % 5));
    const out = placeLabels(many, BOX);
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) expect(overlaps(out[i], out[j])).toBe(false);
    for (const p of out) {
      expect(p.left).toBeGreaterThanOrEqual(4);
      expect(p.top).toBeGreaterThanOrEqual(4);
      expect(p.left + p.w).toBeLessThanOrEqual(BOX.w - 4);
      expect(p.top + p.h).toBeLessThanOrEqual(BOX.h - 4);
    }
  });

  it('tries another anchor of the same name when the first does not fit, and places it once', () => {
    const out = placeLabels(
      [cand('big', 200, 150, 9, { sides: ['center'] }), cand('d', 205, 150, 5, { sides: ['center'] }), cand('d', 200, 220, 4, { sides: ['center'] }), cand('d', 300, 60, 3, { sides: ['center'] })],
      BOX,
    );
    expect(out.filter((p) => p.id === 'd')).toHaveLength(1);
    expect(out.find((p) => p.id === 'd')).toMatchObject({ left: 160, top: 210 });
  });

  it('places a label on each side as asked', () => {
    expect(labelRect(100, 100, 40, 10, 'right', 4)).toEqual({ left: 104, top: 95, w: 40, h: 10 });
    expect(labelRect(100, 100, 40, 10, 'left', 4)).toEqual({ left: 56, top: 95, w: 40, h: 10 });
    expect(labelRect(100, 100, 40, 10, 'below', 4)).toEqual({ left: 80, top: 104, w: 40, h: 10 });
    expect(labelRect(100, 100, 40, 10, 'center')).toEqual({ left: 80, top: 95, w: 40, h: 10 });
  });
});
