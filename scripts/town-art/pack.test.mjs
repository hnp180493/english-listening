import assert from 'node:assert/strict';
import { test } from 'node:test';
import { packShelves } from './pack.mjs';

const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('packs frames without overlaps, inside the atlas', () => {
  const rects = Array.from({ length: 106 }, (_, i) => ({ key: `f${i}`, w: 60 + ((i * 7) % 25), h: 80 + ((i * 11) % 30) }));
  const { width, height, at } = packShelves(rects, { pad: 2 });
  assert.equal(at.size, rects.length);
  const placed = rects.map((r) => ({ ...r, ...at.get(r.key) }));
  for (const p of placed) assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.w <= width && p.y + p.h <= height, p.key);
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) assert.ok(!overlaps(placed[i], placed[j]));
  // not wasteful: within 1.6 × the area of the frames
  const area = rects.reduce((s, r) => s + r.w * r.h, 0);
  assert.ok(width * height < area * 1.6, `${width}×${height} for ${area}`);
});

test('refuses frames that cannot fit', () => {
  assert.throws(() => packShelves([{ key: 'a', w: 300, h: 300 }], { maxSide: 256 }));
});
