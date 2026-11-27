// When a speech bubble may be shown, and where (owner, 2026-11-28: "bug phần âm thanh đi theo nhân vật chính nè": a
// greeting's bubble stayed pinned to the stage's edge over the grass and moved with the camera). Pure, tested
// (speechBubble.test.ts). A bubble belongs over somebody who is drawn and whose head is in view, while their voice is
// heard (a greeting's bubble also while the learner has it open); off the stage, gone inside, or silent: no bubble. A
// voice with no body (the radio, the phone) never has a floating one.

export interface StagePoint {
  x: number;
  y: number;
}

/** A head inside the stage (CSS px), with a small margin for the bubble's own size. */
export function onStage(at: StagePoint, w: number, h: number, margin = 4): boolean {
  return Number.isFinite(at.x) && Number.isFinite(at.y) && at.x >= margin && at.x <= w - margin && at.y >= margin && at.y <= h - margin;
}

/**
 * A greeting's bubble (friends/GreetBubble.tsx): where it goes, or null. `head`: the speaker's head from the stage's
 * speakerPoint (null when they are not drawn or not in view). Shown while the line sounds, or while it is open; never
 * pinned to an edge: only nudged sideways to keep the box inside the stage, by at most its half width.
 */
export function greetBubblePlace(s: { greeting: boolean; sounding: boolean; open: boolean }, head: StagePoint | null, stageW: number): { x: number; y: number; below: boolean } | null {
  if (!s.greeting || !head || (!s.sounding && !s.open)) return null;
  const half = s.open ? Math.min(150, stageW / 2) : 30;
  const x = stageW > 0 ? Math.min(stageW - half, Math.max(half, head.x)) : head.x;
  // under the head only when there is no room over it for the box below the HUD's row (a shorter avatar's head sits
  // higher on the stage than the round body's did: under it at 190 px, the closed bubble covered the speaker's chest)
  return { x: Math.round(x), y: Math.round(head.y), below: head.y < (s.open ? 190 : 110) };
}

/** The greeting stays (useGreeting): until its line has sounded, or while it is open. No lingering after it. */
export function greetingStays(s: { held: boolean; playing: boolean; ended: boolean }): boolean {
  return s.held || s.playing || !s.ended;
}
