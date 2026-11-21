import { describe, expect, it } from 'vitest';
import { placeTags, type TagBox } from './overlay';

const tag = (x: number, y: number, w = 50, above = 0, alt?: number): TagBox => ({ x, y, w, h: 21, above, alt });
const area = { x0: 0, y0: 0, x1: 400, y1: 400 };
const overlap = (a: TagBox, b: TagBox) =>
  Math.abs(a.x - b.x) < (a.w + b.w) / 2 && a.y - a.h - a.above < b.y && b.y - b.h - b.above < a.y;

describe('placeTags', () => {
  it('no tag covers another; the first ones keep their place', () => {
    const tags = [tag(200, 200, 60, 28), tag(205, 205), tag(210, 190), tag(100, 300)];
    placeTags(tags, area);
    expect(tags[0]).toMatchObject({ x: 200, y: 200 });
    expect(tags[3]).toMatchObject({ x: 100, y: 300 });
    const shown = tags.filter((t) => !t.hidden);
    for (let i = 0; i < shown.length; i++) for (let j = i + 1; j < shown.length; j++) expect(overlap(shown[i], shown[j]), `${i} ${j}`).toBe(false);
  });

  it('every tag stays inside the free part of the stage', () => {
    const tags = [tag(-40, 10, 80, 28), tag(460, 500), tag(390, 2)];
    placeTags(tags, { x0: 10, y0: 50, x1: 340, y1: 380 });
    for (const t of tags) {
      expect(t.x - t.w / 2).toBeGreaterThanOrEqual(10);
      expect(t.x + t.w / 2).toBeLessThanOrEqual(340);
      expect(t.y - t.h - t.above).toBeGreaterThanOrEqual(50);
      expect(t.y).toBeLessThanOrEqual(380);
    }
  });

  it('a tag never ends up over somebody else: under its own feet, or not shown', () => {
    // the player's tag right beside a resident's: pushed up it would sit over the resident's head
    const tags = [tag(200, 200, 60, 28), tag(210, 204, 40, 0, 260), tag(190, 202, 40)];
    placeTags(tags, area);
    expect(tags[0]).toMatchObject({ x: 200, y: 200 });
    expect(tags[1]).toMatchObject({ y: 260, below: true });
    expect(tags[2].hidden).toBe(true);
    const shown = tags.filter((t) => !t.hidden);
    for (let i = 0; i < shown.length; i++) for (let j = i + 1; j < shown.length; j++) expect(overlap(shown[i], shown[j]), `${i} ${j}`).toBe(false);
  });

  it('with no room over the head, the tag goes under the feet without its marker', () => {
    const [t] = placeTags([tag(200, 30, 50, 28, 120)], { x0: 0, y0: 60, x1: 400, y1: 400 });
    expect(t).toMatchObject({ y: 120, above: 0, below: true });
  });
});
