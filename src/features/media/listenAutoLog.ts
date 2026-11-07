// Auto-log of real listening in "Video thật": counts the seconds the player is really playing and hands them
// to core/listening addAppListening (source 'app', merged into today's entry for the same video).
//
// When the counted seconds are written ("flush"):
// - after the player has stayed paused for IDLE_FLUSH_MS (a short pause between sentences does not write);
// - every CHUNK_FLUSH_MS of continuous playing (a crash or a closed laptop loses at most that much);
// - when the page is hidden / unloaded, and when the player unmounts (leaving the video).
// Every flush resets the counter, so a second can be written only once (no double logging). Totals below one
// minute are kept device-local by addAppListening until they add up.
//
// What counts (docs/progress-report.md, "Giờ nghe"):
// - wall-clock time while the player says "playing", but a gap with no sign of life longer than MAX_GAP_MS
//   (computer asleep, page frozen or in the back/forward cache) counts only TICK_MS: waking a laptop that slept
//   overnight with a video "playing" never logs hours;
// - only free listening: watch mode without the sentence loop. Dictation mode and the auto-loop replay the same
//   sentence and are practice (they already count as practice attempts), not real listening;
// - nothing while this browser's "Bắt đầu nghe" stopwatch is running (the same minutes would be logged twice).

import { useEffect, useRef } from 'react';
import { addAppListening, createListenMeter, timerStatus, useListeningTimer } from '../../core/listening';

export const IDLE_FLUSH_MS = 60_000;
export const CHUNK_FLUSH_MS = 5 * 60_000;
/** How often the hook checks the two rules above. */
export const TICK_MS = 10_000;
/**
 * Longest silence between two events (ticks, play/pause, flush) that is still trusted as continuous playing.
 * Background tabs get their timers throttled to about once a minute, so this stays well above that.
 */
export const MAX_GAP_MS = 3 * 60_000;

export interface AutoLogger {
  setPlaying(playing: boolean, at: number): void;
  /** Periodic check: flushes after a long pause or a long continuous play. */
  tick(at: number): void;
  /** Write everything counted so far (page hidden, leaving the player). Returns the seconds written. */
  flush(at: number): number;
}

export function createAutoLogger(
  sink: (seconds: number, at: number) => void,
  opts: { idleMs?: number; chunkMs?: number; tickMs?: number; maxGapMs?: number } = {},
): AutoLogger {
  const idleMs = opts.idleMs ?? IDLE_FLUSH_MS;
  const chunkMs = opts.chunkMs ?? CHUNK_FLUSH_MS;
  const tickMs = opts.tickMs ?? TICK_MS;
  const maxGapMs = opts.maxGapMs ?? MAX_GAP_MS;
  const meter = createListenMeter();
  let pausedAt: number | null = null; // paused with seconds not yet written
  let unflushed = false; // something was counted since the last flush
  let spanFrom: number | null = null; // start of the current unflushed stretch of playing
  let lastSeen: number | null = null; // time of the latest event (tick, play/pause, flush)

  /** A long silence while "playing" (sleep, frozen page): count one tick of it, then restart the span at `at`. */
  const guard = (at: number): void => {
    if (meter.playing && lastSeen !== null && at - lastSeen > maxGapMs) {
      meter.setPlaying(false, lastSeen + tickMs);
      meter.setPlaying(true, at);
    }
    if (lastSeen === null || at > lastSeen) lastSeen = at;
  };

  const flush = (at: number): number => {
    guard(at);
    const s = meter.flush(at);
    pausedAt = null;
    unflushed = meter.playing; // still playing: the next stretch is already counting
    spanFrom = meter.playing ? at : null;
    if (s > 0) {
      try {
        sink(s, at);
      } catch {
        // storage problems must never break the player
      }
    }
    return s > 0 ? s : 0;
  };

  return {
    setPlaying(playing, at) {
      guard(at);
      if (playing === meter.playing) return;
      meter.setPlaying(playing, at);
      if (playing) {
        pausedAt = null;
        unflushed = true;
        if (spanFrom === null) spanFrom = at;
      } else {
        pausedAt = at;
        spanFrom = null;
      }
    },
    tick(at) {
      guard(at);
      if (!unflushed) return;
      if (!meter.playing && pausedAt !== null && at - pausedAt >= idleMs) flush(at);
      else if (meter.playing && spanFrom !== null && at - spanFrom >= chunkMs) flush(at);
    },
    flush,
  };
}

/**
 * Wire a player's playing state to the listening log. `itemId`/`title` identify the media item; `playing` must
 * already be false outside free listening (dictation mode, sentence loop: see PlayerView). Paused while this
 * browser's stopwatch runs.
 */
export function useListenAutoLog(itemId: string, title: string, playing: boolean): void {
  const timer = useListeningTimer();
  const stopwatchRunning = timer !== null && timerStatus(timer) === 'running';
  const counting = playing && !stopwatchRunning;
  const logger = useRef<AutoLogger | null>(null);
  const titleRef = useRef(title);
  useEffect(() => {
    titleRef.current = title;
  }, [title]);

  useEffect(() => {
    const lg = createAutoLogger((seconds, at) => {
      addAppListening(itemId, titleRef.current, seconds, at);
    });
    logger.current = lg;
    const id = window.setInterval(() => lg.tick(Date.now()), TICK_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') lg.flush(Date.now());
    };
    const onPageHide = () => lg.flush(Date.now());
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      const now = Date.now();
      lg.setPlaying(false, now);
      lg.flush(now);
      if (logger.current === lg) logger.current = null;
    };
  }, [itemId]);

  useEffect(() => {
    logger.current?.setPlaying(counting, Date.now());
  }, [counting, itemId]);
}
