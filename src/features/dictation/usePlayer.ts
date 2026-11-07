// TTS playback shared by the dictation exercises: normal / slow / chunk-by-chunk,
// auto-play after the first user gesture, Esc = replay.

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useSettings } from '../../core/settings';
import { prefetchSpeech, speak, stopSpeaking, ttsSupported, useSpeechPending } from '../../core/tts';
import { session } from './session';

export type PlayMode = 'normal' | 'slow' | 'chunks';

const SLOW_RATE = 0.7;
const CHUNK_PAUSE_MS = 380;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export interface Player {
  canSpeak: boolean;
  playing: PlayMode | null;
  /** AI voice: the clip for `playing` is being generated (show a spinner / aria-busy). */
  pending: boolean;
  chunkPos: number; // index of the chunk being spoken, -1 when not in chunk mode
  chunkCount: number;
  plays: number; // how many times playback was started
  play: (mode: PlayMode, toggle?: boolean) => Promise<void>;
  stop: () => void;
}

export function isCoarsePointer(): boolean {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

export function usePlayer(
  text: string,
  chunks: readonly string[],
  opts: { autoPlay: boolean; rootRef: RefObject<HTMLElement | null> },
): Player {
  const settings = useSettings();
  const canSpeak = ttsSupported();
  const [playing, setPlaying] = useState<PlayMode | null>(null);
  const [chunkPos, setChunkPos] = useState(-1);
  const [plays, setPlays] = useState(0);
  const runRef = useRef(0);
  // Ownership token: lets the buttons show "generating" only for this player's own speech.
  const [owner] = useState<object>(() => ({}));
  const pending = useSpeechPending(owner);
  const playingRef = useRef<PlayMode | null>(null);
  const rateRef = useRef(settings.rate);
  useEffect(() => {
    rateRef.current = settings.rate;
  }, [settings.rate]);

  const stop = useCallback(() => {
    runRef.current++;
    stopSpeaking();
    playingRef.current = null;
    setPlaying(null);
    setChunkPos(-1);
  }, []);

  const play = useCallback(
    async (mode: PlayMode, toggle = true) => {
      if (!canSpeak) return;
      if (toggle && playingRef.current === mode) {
        stop();
        return;
      }
      const my = ++runRef.current;
      session.gestured = true;
      playingRef.current = mode;
      setPlaying(mode);
      setPlays((n) => n + 1);
      try {
        if (mode === 'chunks') {
          for (let k = 0; k < chunks.length; k++) {
            if (runRef.current !== my) return;
            setChunkPos(k);
            const done = speak(chunks[k], { rate: rateRef.current, owner });
            // AI voice: generate the other chunks while the first one is made, not one after another between
            // the pauses (no-op with the browser voice)
            if (k === 0) prefetchSpeech(chunks.slice(1));
            await done;
            if (runRef.current !== my) return;
            if (k < chunks.length - 1) await sleep(CHUNK_PAUSE_MS);
          }
        } else {
          await speak(text, { rate: mode === 'slow' ? SLOW_RATE : rateRef.current, owner });
        }
      } catch {
        // speech errors end playback quietly
      }
      if (runRef.current !== my) return;
      playingRef.current = null;
      setPlaying(null);
      setChunkPos(-1);
    },
    [canSpeak, chunks, text, stop, owner],
  );

  // stop audio on unmount (sentence change, tab change)
  useEffect(
    () => () => {
      runRef.current++;
      stopSpeaking();
    },
    [],
  );

  // auto-play only after the user has already interacted (browser gesture rules)
  const playRef = useRef(play);
  useEffect(() => {
    playRef.current = play;
  }, [play]);
  const { autoPlay, rootRef } = opts;
  useEffect(() => {
    if (autoPlay) void playRef.current('normal', false);
  }, [autoPlay]);

  // Esc = replay, anywhere on the page except other form fields (settings panel, sentence manager …)
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing || e.repeat) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      const t = e.target;
      if (t instanceof HTMLElement) {
        const ownInput = t instanceof HTMLInputElement && !!rootRef.current?.contains(t);
        if (!ownInput) {
          if (t.isContentEditable || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement) return;
          if (t instanceof HTMLInputElement) return;
          if (t.closest('.app-settings, [role="dialog"], [data-popover], .dict-mgr')) return;
        }
      }
      e.preventDefault();
      void playRef.current('normal', false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rootRef]);

  return { canSpeak, playing, pending: pending && playing !== null, chunkPos, chunkCount: chunks.length, plays, play, stop };
}
