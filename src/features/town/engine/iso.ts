// Isometric projection of the town. Tile space: x = column, y = row, z = height in world pixels. World space: flat
// pixels before the camera (zoom 1). Tile (0,0) is the far corner; x runs down-right, y down-left.

export const TILE_W = 64;
export const TILE_H = 32;
const HW = TILE_W / 2;
const HH = TILE_H / 2;

export interface Pt {
  x: number;
  y: number;
}

/** Tile grid point (and a height in pixels) → world pixels. */
export function toWorld(tx: number, ty: number, z = 0): Pt {
  return { x: (tx - ty) * HW, y: (tx + ty) * HH - z };
}

/** World pixels (on the ground, z = 0) → tile grid point. Floor both to get the tile. */
export function toTile(wx: number, wy: number): Pt {
  const a = wx / HW;
  const b = wy / HH;
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

/**
 * How near the viewer something standing on the ground is: bigger = drawn later. For a point this is x + y on the
 * tile grid; for a footprint it is the depth of its centre, which orders it correctly against anything standing on
 * a tile beside it as long as the footprint is not more than two tiles longer than it is wide (ours are 2×2, 3×2).
 */
export function depthOfPoint(tx: number, ty: number): number {
  return tx + ty;
}

export function depthOfFootprint(x: number, y: number, w: number, d: number): number {
  return x + w / 2 + y + d / 2;
}

/** World-pixel box that holds a square town of `size` tiles, with room for roofs above and the cliff below. */
export function worldBounds(size: number, top = 110, bottom = 90, side = 60): { x0: number; y0: number; x1: number; y1: number } {
  return { x0: -size * HW - side, y0: -top, x1: size * HW + side, y1: size * TILE_H + bottom };
}

/** Set a 2D context so that drawing in tile units lands on the isometric ground (circles become ellipses). */
export function groundTransform(ctx: CanvasRenderingContext2D): void {
  ctx.transform(HW, HH, -HW, HH, 0, 0);
}
