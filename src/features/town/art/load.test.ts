import { afterEach, describe, expect, it, vi } from 'vitest';

const released = { characters: 0, world: 0 };
vi.mock('./characters', () => ({
  characterArtReady: () => false,
  loadCharacterArt: () => Promise.resolve(),
  releaseCharacterArt: () => released.characters++,
}));
vi.mock('./world', () => ({
  worldArtReady: () => false,
  loadWorldArt: () => Promise.resolve(),
  releaseWorldArt: () => released.world++,
}));

const { holdTownArt, RELEASE_AFTER_MS } = await import('./load');

describe('holdTownArt', () => {
  afterEach(() => {
    vi.useRealTimers();
    released.characters = released.world = 0;
  });

  it('lets the decoded pictures go a while after the town page closes, not while it is open or soon back', () => {
    vi.useFakeTimers();
    const close = holdTownArt();
    vi.advanceTimersByTime(RELEASE_AFTER_MS * 3);
    // open: kept
    expect(released.characters).toBe(0);
    close();
    vi.advanceTimersByTime(RELEASE_AFTER_MS / 2);
    // back on the page before the time is up: kept, and the release is called off
    const again = holdTownArt();
    vi.advanceTimersByTime(RELEASE_AFTER_MS * 2);
    expect(released.characters).toBe(0);
    again();
    // closing twice counts once
    again();
    vi.advanceTimersByTime(RELEASE_AFTER_MS + 1);
    expect(released).toEqual({ characters: 1, world: 1 });
  });

  it('keeps them while any holder is left', () => {
    vi.useFakeTimers();
    const a = holdTownArt();
    const b = holdTownArt();
    a();
    vi.advanceTimersByTime(RELEASE_AFTER_MS * 2);
    expect(released.characters).toBe(0);
    b();
    vi.advanceTimersByTime(RELEASE_AFTER_MS + 1);
    expect(released.characters).toBe(1);
  });
});
