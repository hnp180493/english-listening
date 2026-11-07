// Play the learner's own recording (an object URL) and know when it finishes.

import { useCallback, useEffect, useRef, useState } from 'react';

export interface ClipPlayer {
  playing: boolean;
  /** Play from the start; resolves when it ends, is stopped or fails. */
  play: () => Promise<void>;
  stop: () => void;
}

export function useClipPlayer(url: string | null): ClipPlayer {
  const audio = useRef<HTMLAudioElement | null>(null);
  const done = useRef<(() => void) | null>(null);
  const [playing, setPlaying] = useState(false);

  const stop = useCallback(() => {
    const a = audio.current;
    if (a) {
      try {
        a.pause();
      } catch {
        // ignore
      }
    }
    done.current?.();
  }, []);

  const play = useCallback((): Promise<void> => {
    stop();
    if (!url) return Promise.resolve();
    const a = new Audio(url);
    audio.current = a;
    setPlaying(true);
    return new Promise<void>((resolve) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        a.onended = null;
        a.onerror = null;
        if (audio.current === a) {
          audio.current = null;
          setPlaying(false);
        }
        if (done.current === finish) done.current = null;
        resolve();
      };
      done.current = finish;
      a.onended = finish;
      a.onerror = finish;
      a.play().catch(finish);
    });
  }, [stop, url]);

  // New recording or unmount: stop whatever is playing.
  useEffect(() => stop, [stop, url]);

  return { playing, play, stop };
}
