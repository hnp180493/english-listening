import { describe, expect, it } from 'vitest';
import { clipInside, clipOutside, coverShare, grow } from './cover';
import type { Box } from './scene';

/** A stand-in for the 2D context's clipping: it records each clip path and answers whether a point is still drawn. */
function clipRecorder() {
  let path: Box[] = [];
  const clips: { rects: Box[]; rule: CanvasFillRule }[] = [];
  const ctx = {
    beginPath: () => {
      path = [];
    },
    rect: (x: number, y: number, w: number, h: number) => {
      path.push({ x, y, w, h });
    },
    clip: (rule?: CanvasFillRule | Path2D) => {
      clips.push({ rects: path, rule: typeof rule === 'string' ? rule : 'nonzero' });
    },
  } as unknown as Pick<CanvasRenderingContext2D, 'beginPath' | 'rect' | 'clip'>;
  // every rect is drawn the same way round, so non-zero = "in at least one", even-odd = "in an odd number"
  const drawn = (x: number, y: number) =>
    clips.every(({ rects, rule }) => {
      const n = rects.filter((r) => x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h).length;
      return rule === 'evenodd' ? n % 2 === 1 : n > 0;
    });
  return { ctx, drawn };
}

describe('cover', () => {
  it('coverShare: the part of the person under the thing', () => {
    const person = { x: 0, y: 0, w: 10, h: 10 };
    expect(coverShare(person, { x: 5, y: 0, w: 10, h: 10 })).toBe(0.5);
    expect(coverShare(person, { x: 20, y: 0, w: 5, h: 5 })).toBe(0);
    expect(coverShare(person, { x: -5, y: -5, w: 30, h: 30 })).toBe(1);
  });

  it('grow: sides and top by one amount, the bottom by another', () => {
    expect(grow({ x: 10, y: 10, w: 4, h: 4 }, 2, 5)).toEqual({ x: 8, y: 8, w: 8, h: 11 });
  });

  it('the solid pass skips every person, also where two people overlap behind the thing', () => {
    const thing = { x: 0, y: 0, w: 100, h: 100 };
    const a = { x: 20, y: 20, w: 26, h: 60 };
    const b = { x: 30, y: 30, w: 26, h: 60 };
    const { ctx, drawn } = clipRecorder();
    clipOutside(ctx, thing, [a, b]);
    expect(drawn(5, 5)).toBe(true); // the thing, away from everybody
    expect(drawn(22, 22)).toBe(false); // only a
    expect(drawn(54, 85)).toBe(false); // only b
    expect(drawn(40, 50)).toBe(false); // a and b: still a hole (an even-odd path of all rects made it solid here)
    expect(drawn(150, 50)).toBe(false); // outside the thing
  });

  it('a person sticking out of the thing does not widen the solid pass', () => {
    const { ctx, drawn } = clipRecorder();
    clipOutside(ctx, { x: 0, y: 0, w: 50, h: 50 }, [{ x: 40, y: 40, w: 30, h: 30 }]);
    expect(drawn(60, 60)).toBe(false);
    expect(drawn(45, 45)).toBe(false);
    expect(drawn(10, 10)).toBe(true);
  });

  it('the see-through pass covers every person, overlaps included', () => {
    const { ctx, drawn } = clipRecorder();
    clipInside(ctx, [
      { x: 20, y: 20, w: 26, h: 60 },
      { x: 30, y: 30, w: 26, h: 60 },
    ]);
    expect(drawn(40, 50)).toBe(true);
    expect(drawn(22, 22)).toBe(true);
    expect(drawn(5, 5)).toBe(false);
  });
});
