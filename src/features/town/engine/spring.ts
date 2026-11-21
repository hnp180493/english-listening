// How the 3D town's camera eases (three/scene/engine3d.ts): a critically damped spring (no overshoot) whose speed
// starts at zero, so a new thing to look at (a conversation, its end, a build) eases in AND out, and the camera's
// own time for a frame, so a late frame shows as a short pause and never as the camera jumping ahead.

/**
 * One step of a critically damped spring towards `goal` (exact for any dt): the new value and speed.
 * x(t) = goal + (x0 − goal + (v0 + w(x0 − goal)) t) e^(−wt).
 */
export function springStep(x: number, v: number, goal: number, w: number, dt: number): [number, number] {
  const d = x - goal;
  const k = (v + w * d) * dt;
  const e = Math.exp(-w * dt);
  return [goal + (d + k) * e, (v - w * k) * e];
}

/**
 * The camera's time for a frame of `dt` seconds, `typical` = the display's usual frame time (smoothed). A frame the
 * browser is late with (the panel's first paint, a garbage collection) shows as a short pause, never as the camera
 * jumping ahead: it gets at most 1.5 usual frames (and never less than 1/50 s). A steady slow display (30 Hz, a phone
 * saving battery) still gets real time: a cap of a flat 1/50 s once ran every eased move there in slow motion.
 */
export function cameraDt(dt: number, typical: number): number {
  return Math.min(dt, Math.max(1 / 50, typical * 1.5));
}
