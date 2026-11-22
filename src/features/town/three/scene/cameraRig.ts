// The camera of the 3D town, as pure numbers: a perspective camera with a low field of view (a diorama) looking at a
// point on the ground from a yaw (default π/4: from +x+y, doors face it) and a pitch, at a distance. Where it
// stands, how far it must be to fit things, how far it may wander from the island, where it looks while it follows
// the player, and which way the keys walk. three.js only applies what this works out (engine3d.ts).

import type { P3 } from './coords';

/** Vertical field of view (degrees): low, so the town reads like a model on a table. */
export const FOV = 28;
/** Default yaw: the camera stands towards +x +y of what it looks at (doors face it). */
export const YAW0 = Math.PI / 4;
/** How far down the camera looks (radians, 33°): low enough that the houses and trees round the player show, not only the ground. */
export const PITCH = (33 * Math.PI) / 180;
/** A grown-up is this tall (scene units: chars/person.ts TILE_SCALE), for the zoom that keeps people a readable size. */
export const PERSON_HEIGHT = 0.75;
/** The learner's own zoom (wheel / pinch) stays within these factors of the resting distance. */
export const ZOOM_MIN = 0.55;
export const ZOOM_MAX = 1.9;
/** Radians the camera turns for a drag of one CSS px (the right or middle button, or two fingers): about 1,050 px all the way round. */
export const YAW_PER_PX = 0.006;

export interface Basis {
  /** Screen right, on the ground plane. */
  right: P3;
  /** Screen up (tilted with the pitch). */
  up: P3;
  /** From the camera towards what it looks at. */
  fwd: P3;
}

const dot = (a: P3, b: P3) => a.x * b.x + a.y * b.y + a.z * b.z;

/** The camera's axes for a yaw and a pitch. */
export function basisOf(yaw: number, pitch: number): Basis {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  // the camera stands at target + dist × (cy·cp, sp, sy·cp): it looks the other way
  const fwd = { x: -cy * cp, y: -sp, z: -sy * cp };
  // right = fwd × worldUp
  const right = { x: -fwd.z, y: 0, z: fwd.x };
  const rl = Math.hypot(right.x, right.z) || 1;
  right.x /= rl;
  right.z /= rl;
  // up = right × fwd
  const up = {
    x: right.y * fwd.z - right.z * fwd.y,
    y: right.z * fwd.x - right.x * fwd.z,
    z: right.x * fwd.y - right.y * fwd.x,
  };
  return { right, up, fwd };
}

/** Where the camera stands to look at `target` from `dist` away. */
export function cameraPosition(target: P3, yaw: number, pitch: number, dist: number): P3 {
  const cp = Math.cos(pitch);
  return { x: target.x + Math.cos(yaw) * cp * dist, y: target.y + Math.sin(pitch) * dist, z: target.z + Math.sin(yaw) * cp * dist };
}

const tanHalf = (fovDeg: number) => Math.tan((fovDeg * Math.PI) / 360);

/** How tall (CSS px) a grown-up stands at the resting zoom on a stage of this size. */
export function personPx(viewW: number, viewH: number): number {
  return Math.max(48, Math.min(100, Math.min(viewH / 9, viewW / 6.5)));
}

/**
 * The resting distance for a stage of this size: a grown-up stands about a ninth of the stage high (about 75 CSS px
 * on a laptop's stage, at most 100), and on a narrow phone less (its width bounds it: about 60 px on a 390 px phone),
 * so the town round the player shows from the first look (owner, 2026-11-22: a fifth was "sát rạc").
 */
export function restDistance(viewW: number, viewH: number, fov = FOV, pitch = PITCH): number {
  const w = Math.max(1, viewW);
  const h = Math.max(1, viewH);
  const px = personPx(w, h);
  return (PERSON_HEIGHT * Math.cos(pitch) * h) / (2 * tanHalf(fov) * px);
}

/**
 * The distance at which every point fits in the view around `centre`, using `fill` of the half view (exact for the
 * perspective camera: a point at depth w past the centre needs less room).
 */
export function fitDistance(points: readonly P3[], centre: P3, yaw: number, pitch: number, aspect: number, fill = 0.9, fov = FOV): number {
  const b = basisOf(yaw, pitch);
  const t = tanHalf(fov) * fill;
  let need = 0;
  for (const p of points) {
    const r = { x: p.x - centre.x, y: p.y - centre.y, z: p.z - centre.z };
    const u = Math.abs(dot(r, b.right));
    const v = Math.abs(dot(r, b.up));
    const w = dot(r, b.fwd);
    need = Math.max(need, v / t - w, u / (t * Math.max(0.1, aspect)) - w);
  }
  return need;
}

/** Half the width and half the depth of the ground the view covers around its target (scene units, approximate). */
export function groundHalfExtent(dist: number, pitch: number, aspect: number, fov = FOV): { across: number; deep: number } {
  const h = dist * tanHalf(fov);
  return { across: h * aspect, deep: h / Math.max(0.2, Math.sin(pitch)) };
}

/**
 * Keep the target over the island: never so near its edge that more sky than ground shows. A world of `size`
 * tiles; the target may come `slack` of the half view past the middle of the edge band.
 */
export function clampToIsland(target: P3, size: number, dist: number, pitch: number, aspect: number, slack = 0.55, fov = FOV): P3 {
  const e = groundHalfExtent(dist, pitch, aspect, fov);
  // the view is turned 45°: its half width across the diamond reaches about 0.7 of that along x and z
  const m = Math.min(size / 2, Math.max(e.across, e.deep) * 0.7 * slack);
  return { x: Math.min(size - m, Math.max(m, target.x)), y: target.y, z: Math.min(size - m, Math.max(m, target.z)) };
}

/**
 * The camera follows the player (docs/town.md §7 "The camera"): a critically damped spring of FOLLOW_W on a point
 * FOLLOW_LEAD seconds ahead of the player along the way they go, so a walker is kept in the middle (no more than a
 * few hundredths of the stage off it) and a stop never overshoots (the lead, 0.8/FOLLOW_W on a pace smoothed at 40/s,
 * stays short of what would carry the camera past a player who stopped).
 */
export const FOLLOW_W = 11;
export const FOLLOW_LEAD = 0.073;
/**
 * On a narrow stage (a phone) a tile is a larger share of the screen: the same lag would carry a running player
 * (2.8 tiles/s) about a tenth of the stage off the middle. There the follow is stiffer (FOLLOW_W_NARROW, its lead
 * 0.8/w as above), which keeps a run within about 6% of the centre.
 */
export const FOLLOW_W_NARROW = 19;
/** Below this width (CSS px) a stage is narrow. */
export const NARROW_STAGE = 600;

/** The follow's spring for a stage this wide. */
export function followStiffness(viewW: number): number {
  return viewW < NARROW_STAGE ? FOLLOW_W_NARROW : FOLLOW_W;
}

/** The lead ahead of a walker for a follow of spring `w` (seconds): short of carrying the camera past a stop. */
export function followLead(w: number): number {
  return w === FOLLOW_W ? FOLLOW_LEAD : 0.8 / w;
}

/** At the island's edge the camera may hold back at most this far (tiles) from the player. */
export const EDGE_HOLD = 1.2;

/**
 * Where the camera looks while it follows: the player, a little ahead of them as they walk, held back over the island
 * only near its edge (`clampToIsland`, never more than EDGE_HOLD tiles off the player).
 */
export function followPoint(player: { x: number; z: number }, velocity: { x: number; z: number }, size: number, dist: number, pitch: number, aspect: number, y = 0.3, lead = FOLLOW_LEAD): P3 {
  const at = { x: player.x + velocity.x * lead, y, z: player.z + velocity.z * lead };
  const c = clampToIsland(at, size, dist, pitch, aspect);
  const dx = c.x - at.x;
  const dz = c.z - at.z;
  const d = Math.hypot(dx, dz);
  if (d <= EDGE_HOLD) return c;
  return { x: at.x + (dx / d) * EDGE_HOLD, y, z: at.z + (dz / d) * EDGE_HOLD };
}

/**
 * The arrow keys / W A S D as a way on the ground (a unit vector on the tile grid, x and z), relative to the camera
 * that stands at `yaw`: up = away from the camera on the screen, right = screen right; two keys a diagonal of the
 * screen. Null = no way (none held, or opposite keys).
 */
export function keyDirection(k: { up: boolean; down: boolean; left: boolean; right: boolean }, yaw: number): { x: number; y: number } | null {
  const v = (k.up ? 1 : 0) - (k.down ? 1 : 0);
  const h = (k.right ? 1 : 0) - (k.left ? 1 : 0);
  if (v === 0 && h === 0) return null;
  // on the ground: away from the camera is (-cos yaw, -sin yaw), screen right is (sin yaw, -cos yaw)
  const x = -Math.cos(yaw) * v + Math.sin(yaw) * h;
  const y = -Math.sin(yaw) * v - Math.cos(yaw) * h;
  const l = Math.hypot(x, y);
  return { x: x / l, y: y / l };
}

/** Where the camera's target goes on the stage (CSS px from the middle) so it is centred in what panels leave free. */
export function insetShift(viewW: number, viewH: number, inset: { right: number; bottom: number }, safe: { top: number; right: number; bottom: number; left: number }): { x: number; y: number } {
  const right = Math.max(inset.right, safe.right);
  const bottom = Math.max(inset.bottom, safe.bottom);
  const cap = (v: number, size: number) => Math.max(-(size / 2 - 60), Math.min(size / 2 - 60, v));
  return { x: cap((safe.left - right) / 2, viewW), y: cap((safe.top - bottom) / 2, viewH) };
}

/** The learner's zoom factor after a wheel step (deltaY px) or a pinch (ratio of finger distances), clamped. */
export function zoomAfter(zoom: number, change: { wheel?: number; pinch?: number }): number {
  let z = zoom;
  if (change.wheel) z *= Math.exp(change.wheel * 0.0015);
  if (change.pinch && change.pinch > 0) z /= change.pinch;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

/**
 * The yaw after a drag of `dx` CSS px: all the way round, as often as the learner likes (until 2026-11-22 it stopped
 * 60° either side of the default view; the owner: "sao mày không cho xoay bản đồ 360 độ?").
 */
export function yawAfter(yaw: number, dx: number): number {
  return yaw - dx * YAW_PER_PX;
}
