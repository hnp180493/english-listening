// Shelf packing of sprite frames into one atlas: tallest first, rows left to right. Frames of one character are
// close in size, so shelves waste little. Pure; tested by pack.test.mjs (node --test).

/**
 * @param {{ key: string, w: number, h: number }[]} rects
 * @param {{ pad?: number, maxSide?: number }} [opts]
 * @returns {{ width: number, height: number, at: Map<string, { x: number, y: number }> }}
 */
export function packShelves(rects, { pad = 2, maxSide = 2048 } = {}) {
  if (rects.length === 0) return { width: 1, height: 1, at: new Map() };
  const sorted = [...rects].sort((a, b) => b.h - a.h || b.w - a.w || (a.key < b.key ? -1 : 1));
  const widest = Math.max(...rects.map((r) => r.w)) + pad;
  const area = rects.reduce((s, r) => s + (r.w + pad) * (r.h + pad), 0);
  let best = null;
  for (let width = Math.max(widest, 64); width <= maxSide; width += 32) {
    const at = new Map();
    let x = 0;
    let y = 0;
    let rowH = 0;
    for (const r of sorted) {
      if (x + r.w + pad > width) {
        x = 0;
        y += rowH;
        rowH = 0;
      }
      at.set(r.key, { x: x + pad / 2, y: y + pad / 2 });
      x += r.w + pad;
      rowH = Math.max(rowH, r.h + pad);
    }
    const height = y + rowH;
    if (height > maxSide) continue;
    // least area, then the squarest
    const score = width * height + Math.abs(width - height) * 4;
    if (!best || score < best.score) best = { width, height, at, score };
    if (width * width > area * 4) break;
  }
  if (!best) throw new Error(`frames do not fit in ${maxSide}×${maxSide}`);
  return { width: best.width, height: best.height, at: best.at };
}
