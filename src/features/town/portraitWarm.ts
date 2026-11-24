// The conversation portraits drawn ahead of time (three/chars/portrait.ts caches them): in idle time after the town
// shows, and the one walked up to as the walk begins, so opening a conversation or smiling after a right answer never
// waits for the graphics card.

import type { CharacterId } from './engine/sim';
import type { PortraitMood } from './art';
import { renderPortrait, warmPortraitShaders } from './three/chars/portrait';
import { canDraw3d } from './three/offscreen';

/** The portrait's size in a conversation's panel (Conversation.tsx, Episode.tsx): smaller on a phone. */
export function talkFaceSize(): number {
  try {
    return window.matchMedia('(max-width: 720px)').matches ? 56 : 88;
  } catch {
    return 88;
  }
}

type IdleWindow = Window & { requestIdleCallback?: (run: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };

/**
 * Draw the conversation portraits of these residents ahead of time (neutral and smiling, at the panel's size), one
 * at a time when the page is idle, so a conversation opens and a right answer smiles without waiting for the
 * graphics card. The first one also makes the shared offscreen renderer. Returns a function that stops what is left.
 */
export function prewarmPortraits(ids: readonly CharacterId[]): () => void {
  if (!canDraw3d()) return () => undefined;
  const px = Math.round(talkFaceSize() * Math.min(3, window.devicePixelRatio || 1));
  const jobs: [CharacterId, Exclude<PortraitMood, 'sad'>][] = [];
  for (const id of ids) jobs.push([id, 'neutral'], [id, 'happy']);
  const w = window as IdleWindow;
  let handle = 0;
  let stopped = false;
  const next = () => {
    handle = 0;
    const job = jobs.shift();
    if (stopped || !job) return;
    renderPortrait(job[0], px, job[1]);
    schedule();
  };
  const schedule = () => {
    if (stopped || jobs.length === 0) return;
    handle = w.requestIdleCallback ? w.requestIdleCallback(next, { timeout: 1500 }) : window.setTimeout(next, 120);
  };
  // the shaders first (in an idle moment, compiled in the background): the first portrait then draws without
  // waiting on the driver
  const warm = () => {
    handle = 0;
    if (!stopped) void warmPortraitShaders().then(schedule, schedule);
  };
  handle = w.requestIdleCallback ? w.requestIdleCallback(warm, { timeout: 1500 }) : window.setTimeout(warm, 120);
  return () => {
    stopped = true;
    if (!handle) return;
    if (w.cancelIdleCallback) w.cancelIdleCallback(handle);
    else window.clearTimeout(handle);
  };
}

/** One resident's conversation portraits now (the walk up to them has begun), unless they are drawn already. */
export function warmPortrait(id: CharacterId): void {
  if (!canDraw3d()) return;
  const px = Math.round(talkFaceSize() * Math.min(3, window.devicePixelRatio || 1));
  renderPortrait(id, px, 'neutral');
}
