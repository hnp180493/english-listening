import { describe, expect, it } from 'vitest';
import { greetBubblePlace, greetingStays, onStage } from './speechBubble';

// A speech bubble only over somebody drawn and in view, only while there is a voice (owner, 2026-11-28: a greeting's
// bubble had stayed pinned to the stage's edge over the grass and moved with the camera).

const W = 1050;
const H = 670;

describe('onStage', () => {
  it('a head inside the stage is; off any edge or not a number is not', () => {
    expect(onStage({ x: 500, y: 300 }, W, H)).toBe(true);
    expect(onStage({ x: 3382, y: 245 }, W, H)).toBe(false);
    expect(onStage({ x: -40, y: 245 }, W, H)).toBe(false);
    expect(onStage({ x: 500, y: -302 }, W, H)).toBe(false);
    expect(onStage({ x: 500, y: H + 20 }, W, H)).toBe(false);
    expect(onStage({ x: Number.NaN, y: 10 }, W, H)).toBe(false);
  });
});

describe('a greeting bubble (GreetBubble)', () => {
  const live = { greeting: true, sounding: true, open: false };

  it('over the head while the line sounds', () => {
    expect(greetBubblePlace(live, { x: 600, y: 320 }, W)).toEqual({ x: 600, y: 320, below: false });
  });

  it('the speaker not drawn or out of view (speakerPoint null): no bubble, never one pinned to the edge', () => {
    expect(greetBubblePlace(live, null, W)).toBeNull();
  });

  it('the voice ended or was cut short: no bubble, unless the learner opened it', () => {
    expect(greetBubblePlace({ ...live, sounding: false }, { x: 600, y: 320 }, W)).toBeNull();
    expect(greetBubblePlace({ greeting: true, sounding: false, open: true }, { x: 600, y: 320 }, W)).not.toBeNull();
    expect(greetBubblePlace({ ...live, greeting: false }, { x: 600, y: 320 }, W)).toBeNull();
  });

  it('a head near a side is only nudged by the box half (30 px closed, up to 150 px open), never more', () => {
    expect(greetBubblePlace(live, { x: 10, y: 320 }, W)?.x).toBe(30);
    expect(greetBubblePlace(live, { x: W - 5, y: 320 }, W)?.x).toBe(W - 30);
    expect(greetBubblePlace({ ...live, open: true }, { x: 40, y: 320 }, W)?.x).toBe(150);
    expect(greetBubblePlace(live, { x: 600, y: 153 }, W)?.below).toBe(false);
    expect(greetBubblePlace(live, { x: 600, y: 90 }, W)?.below).toBe(true);
    expect(greetBubblePlace({ ...live, open: true }, { x: 600, y: 153 }, W)?.below).toBe(true);
  });
});

describe('a greeting stays (useGreeting)', () => {
  it('until its line has sounded; gone at once after, or when stopped; kept while open', () => {
    expect(greetingStays({ held: false, playing: false, ended: false })).toBe(true);
    expect(greetingStays({ held: false, playing: true, ended: false })).toBe(true);
    expect(greetingStays({ held: false, playing: false, ended: true })).toBe(false);
    expect(greetingStays({ held: true, playing: false, ended: true })).toBe(true);
  });
});
