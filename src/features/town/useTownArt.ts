import { useCallback, useEffect, useState } from 'react';
import { holdTownArt, loadTownArt, townArtReady } from './art/load';

export type TownArtStatus = 'loading' | 'ready' | 'error';

/**
 * The town's pictures (22 WebP files, about 9 MB): their state, and a way to try again after a failure. They stay
 * decoded while the page is open and for half a minute after it closes (art/load.ts holdTownArt), then are let go.
 */
export function useTownArt(): { status: TownArtStatus; retry: () => void } {
  const [status, setStatus] = useState<TownArtStatus>(() => (townArtReady() ? 'ready' : 'loading'));
  const [attempt, setAttempt] = useState(0);
  useEffect(() => holdTownArt(), []);
  useEffect(() => {
    if (townArtReady()) return;
    let live = true;
    loadTownArt().then(
      () => live && setStatus('ready'),
      () => live && setStatus('error'),
    );
    return () => {
      live = false;
    };
  }, [attempt]);
  const retry = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);
  return { status, retry };
}
