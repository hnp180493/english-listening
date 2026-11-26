import { describe, expect, it } from 'vitest';
import { edgeArrow, metres, wayDots } from './guide';

describe('the quest guide over the stage', () => {
  const area = { x0: 0, y0: 0, x1: 400, y1: 300 };

  it('shows no edge arrow while the target is on the stage', () => {
    expect(edgeArrow({ x: 200, y: 150 }, { x: 390, y: 10 }, area)).toBeNull();
  });

  it('puts the edge arrow where the way to the target leaves the stage, pointing at it', () => {
    const right = edgeArrow({ x: 200, y: 150 }, { x: 900, y: 150 }, area)!;
    expect(right).toMatchObject({ x: 370, y: 150 });
    expect(right.angle).toBeCloseTo(0);
    const up = edgeArrow({ x: 200, y: 150 }, { x: 200, y: -500 }, area)!;
    expect(up.y).toBe(30);
    expect(up.angle).toBeCloseTo(-Math.PI / 2);
    const corner = edgeArrow({ x: 200, y: 150 }, { x: 2000, y: 2000 }, area)!;
    expect(corner.x).toBeLessThanOrEqual(370);
    expect(corner.y).toBeLessThanOrEqual(270);
    expect(Math.max(corner.x - 370, corner.y - 270)).toBeCloseTo(0);
  });

  it('starts the ray inside even when the player is off the stage', () => {
    const a = edgeArrow({ x: -100, y: 150 }, { x: 900, y: 150 }, area)!;
    expect(a.x).toBe(370);
  });

  it('dots a way every step from the phase, at most max of them', () => {
    const dots = wayDots([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], 0.5, 0.25, 10);
    expect(dots.map((d) => [d.x, d.y])).toEqual([[0.25, 0], [0.75, 0], [1, 0.25], [1, 0.75]]);
    expect(wayDots([{ x: 0, y: 0 }, { x: 100, y: 0 }], 1, 0, 5)).toHaveLength(5);
  });

  it('says how far in metres, rounded to five past ten', () => {
    expect(metres(2)).toBe('4 m');
    expect(metres(17)).toBe('35 m');
    expect(metres(0.1)).toBe('1 m');
  });
});
