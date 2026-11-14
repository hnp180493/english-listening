import { useCallback, useEffect, useState } from 'react';
import { loadTownArt, townArtReady } from './art/load';

export type TownArtStatus = 'loading' | 'ready' | 'error';

/**
 * The town's pictures (22 WebP files, about 5.5 MB, loaded once per session and kept across visits of the page):
 * their state, and a way to try again after a failure.
 */
export function useTownArt(): { status: TownArtStatus; retry: () => void } {
  const [status, setStatus] = useState<TownArtStatus>(() => (townArtReady() ? 'ready' : 'loading'));
  const [attempt, setAttempt] = useState(0);
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
