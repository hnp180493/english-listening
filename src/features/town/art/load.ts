// Every picture of the town at once: the people (characters.ts) and the world (world.ts). The decoded images stay
// while the town page is open and for a while after it closes (holdTownArt), so going back to it soon draws at once;
// then they are let go (about 175 MB of bitmap pixels a phone should not keep for the rest of a dictation session).
// A failed load can be tried again.

import { characterArtReady, loadCharacterArt, releaseCharacterArt } from './characters';
import { loadWorldArt, releaseWorldArt, worldArtReady } from './world';

/** The decoded pictures are kept this long (ms) after the town page closes. */
export const RELEASE_AFTER_MS = 30_000;

export function townArtReady(): boolean {
  return characterArtReady() && worldArtReady();
}

let pending: Promise<void> | null = null;

let holders = 0;
let releaseTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * The town page is open: keep the decoded pictures. Returns the function to call when it closes; RELEASE_AFTER_MS
 * later, if no page holds them again, they are let go (closed bitmaps, cleared caches).
 */
export function holdTownArt(): () => void {
  holders++;
  if (releaseTimer !== null) {
    clearTimeout(releaseTimer);
    releaseTimer = null;
  }
  let held = true;
  return () => {
    if (!held) return;
    held = false;
    holders--;
    if (holders > 0) return;
    releaseTimer = setTimeout(() => {
      releaseTimer = null;
      if (holders === 0) releaseTownArt();
    }, RELEASE_AFTER_MS);
  };
}

/** Let go of every decoded picture of the town now (the next load decodes them again). */
export function releaseTownArt(): void {
  releaseCharacterArt();
  releaseWorldArt();
  pending = null;
}

/** Load (once) every atlas of the town. Rejects when one image cannot be loaded; calling again retries. */
export function loadTownArt(): Promise<void> {
  if (townArtReady()) return Promise.resolve();
  if (pending) return pending;
  pending = Promise.all([loadCharacterArt(), loadWorldArt()]).then(
    () => {
      pending = null;
    },
    (e: unknown) => {
      pending = null;
      throw e;
    },
  );
  return pending;
}
