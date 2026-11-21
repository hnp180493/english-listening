// The town map's view (features/town/map): how a point of the tile grid lands on the map's box, and back. Pure numbers.
//
// The map is turned like the 3D camera (three/scene/cameraRig.ts): the camera stands at heading `yaw` from what it
// looks at (cos yaw, sin yaw on the grid), so "up" on the map is away from the camera, (-cos yaw, -sin yaw), and
// "right" is (sin yaw, -cos yaw). At the default yaw (π/4) the tile (0, 0) is the top corner, as in the town.
// `tilt` squashes the ground vertically (the full map looks down from high up at an angle, like the town; 1 = straight
// down, the minimap): a thing `h` tile edges tall then stands `h · scale · √(1 − tilt²)` px above its foot.

export interface MapView {
  /** The point of the tile grid at the middle of the box. */
  cx: number;
  cy: number;
  /** CSS px per tile edge (across the screen; down the screen it is `scale · tilt`). */
  scale: number;
  /** The camera's yaw the map is turned to (radians). */
  yaw: number;
  /** Vertical squash of the ground, (0, 1]. */
  tilt: number;
}

export interface Box {
  w: number;
  h: number;
}

export interface Pt {
  x: number;
  y: number;
}

/** A 2D affine map in canvas `setTransform(a, b, c, d, e, f)` order: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Mat = readonly [number, number, number, number, number, number];

/** The default yaw of the camera (cameraRig YAW0), for a map opened without a stage. */
export const MAP_YAW0 = Math.PI / 4;
/** The full map's squash: the town from high up at a slant (about 37° above the ground). */
export const MAP_TILT = 0.6;

/** The grid → box matrix of a view (CSS px). */
export function viewMatrix(v: MapView, box: Box): Mat {
  const s = Math.sin(v.yaw);
  const c = Math.cos(v.yaw);
  const a = v.scale * s;
  const cc = -v.scale * c;
  const b = v.scale * v.tilt * c;
  const d = v.scale * v.tilt * s;
  return [a, b, cc, d, box.w / 2 - (a * v.cx + cc * v.cy), box.h / 2 - (b * v.cx + d * v.cy)];
}

/** Where a point of the grid is in the box (CSS px); `lift`: that many tile edges above the ground. */
export function toBox(v: MapView, box: Box, x: number, y: number, lift = 0): Pt {
  const dx = x - v.cx;
  const dy = y - v.cy;
  const s = Math.sin(v.yaw);
  const c = Math.cos(v.yaw);
  return {
    x: box.w / 2 + v.scale * (dx * s - dy * c),
    y: box.h / 2 + v.scale * v.tilt * (dx * c + dy * s) - liftPx(v, lift),
  };
}

/** The point of the ground (grid) under a point of the box. */
export function toGrid(v: MapView, box: Box, px: number, py: number): Pt {
  const s = Math.sin(v.yaw);
  const c = Math.cos(v.yaw);
  const r = (px - box.w / 2) / v.scale;
  const u = (py - box.h / 2) / (v.scale * v.tilt);
  return { x: v.cx + r * s + u * c, y: v.cy - r * c + u * s };
}

/** How many CSS px a thing `h` tile edges tall rises on the map. */
export function liftPx(v: MapView, h: number): number {
  if (h === 0) return 0;
  return h * v.scale * Math.sqrt(Math.max(0, 1 - v.tilt * v.tilt));
}

/** The size (CSS px per scale unit) of the world's square [0, size]² turned by yaw and squashed by tilt. */
function extent(size: number, yaw: number, tilt: number): { w: number; h: number } {
  const s = Math.abs(Math.sin(yaw));
  const c = Math.abs(Math.cos(yaw));
  return { w: size * (s + c), h: size * (s + c) * tilt };
}

/** The view that shows the whole town in the box with `pad` px round it (the centre of the town in the middle). */
export function fitView(box: Box, size: number, yaw: number, tilt: number, pad = 24): MapView {
  const e = extent(size, yaw, tilt);
  // a little room above for the houses and trees along the top edge
  const top = tilt < 1 ? 1.6 * Math.sqrt(1 - tilt * tilt) : 0;
  const scale = Math.max(0.5, Math.min((box.w - 2 * pad) / e.w, (box.h - 2 * pad) / (e.h + top)));
  return { cx: size / 2, cy: size / 2, scale, yaw, tilt };
}

/** The zoom limits of the full map: from the whole town (or a little less on a phone) to houses a thumb wide. */
export function scaleLimits(box: Box, size: number, yaw: number, tilt: number): { min: number; max: number } {
  const fit = fitView(box, size, yaw, tilt).scale;
  return { min: Math.min(fit, 8) * 0.85, max: Math.max(fit * 1.5, 46) };
}

/** A view kept within reason: the zoom within `limits`, the middle of the box over the town. */
export function clampView(v: MapView, size: number, limits: { min: number; max: number }): MapView {
  const scale = Math.max(limits.min, Math.min(limits.max, v.scale));
  return { ...v, scale, cx: Math.max(0, Math.min(size, v.cx)), cy: Math.max(0, Math.min(size, v.cy)) };
}

/** The view zoomed by `factor` round a point of the box (it stays under the pointer). */
export function zoomAt(v: MapView, box: Box, factor: number, px: number, py: number, size: number, limits: { min: number; max: number }): MapView {
  const before = toGrid(v, box, px, py);
  const next = clampView({ ...v, scale: v.scale * factor }, size, { min: limits.min, max: limits.max });
  const after = toGrid(next, box, px, py);
  return clampView({ ...next, cx: next.cx + before.x - after.x, cy: next.cy + before.y - after.y }, size, limits);
}

/** The view moved so that the ground follows a drag of (dx, dy) CSS px. */
export function panBy(v: MapView, dx: number, dy: number, size: number, limits: { min: number; max: number }): MapView {
  const s = Math.sin(v.yaw);
  const c = Math.cos(v.yaw);
  const r = dx / v.scale;
  const u = dy / (v.scale * v.tilt);
  return clampView({ ...v, cx: v.cx - (r * s + u * c), cy: v.cy - (-r * c + u * s) }, size, limits);
}

/** The camera's yaw from the way it looks (its forward vector's ground part, three X / Z = grid x / y). */
export function yawFromForward(fx: number, fz: number): number {
  if (Math.abs(fx) + Math.abs(fz) < 1e-9) return MAP_YAW0;
  return Math.atan2(-fz, -fx);
}

/**
 * How far to turn something drawn pointing up (CSS `rotate`, radians clockwise) so it points along a heading of the
 * grid (atan2(dy, dx)) on a map turned to `yaw`, squashed by `tilt`.
 */
export function arrowRotation(heading: number, yaw: number, tilt = 1): number {
  const sx = Math.sin(yaw - heading);
  const sy = tilt * Math.cos(yaw - heading);
  return Math.atan2(sx, -sy);
}

/** The minimap's view: round the player, turned with the camera, straight down, `radius` tiles to its rim. */
export function miniView(player: Pt, yaw: number, rimPx: number, radius: number): MapView {
  return { cx: player.x, cy: player.y, scale: rimPx / radius, yaw, tilt: 1 };
}

/** The distance between two points of the grid, in tile edges. */
export function gridDistance(a: Pt, b: Pt): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Below this many px per tile edge the houses are crumbs: a narrow box opens closer, round the player. */
export const MAP_READABLE = 11;

/**
 * The view the full map opens with: the whole town when it is readable that way (a laptop: the player is on it
 * anyway), else a readable zoom centred on the player (a phone), kept over the town.
 */
export function openView(box: Box, size: number, yaw: number, tilt: number, player: Pt | null): MapView {
  const fit = fitView(box, size, yaw, tilt);
  if (fit.scale >= MAP_READABLE || !player) return fit;
  const limits = scaleLimits(box, size, yaw, tilt);
  return clampView({ ...fit, scale: MAP_READABLE, cx: player.x, cy: player.y }, size, limits);
}
