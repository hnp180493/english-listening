// Every picture of the town at once: the people (characters.ts) and the world (world.ts). Both loaders keep their
// images for the whole session, so a second visit of the page draws at once; a failed load can be tried again.

import { characterArtReady, loadCharacterArt } from './characters';
import { loadWorldArt, worldArtReady } from './world';

export function townArtReady(): boolean {
  return characterArtReady() && worldArtReady();
}

let pending: Promise<void> | null = null;

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
