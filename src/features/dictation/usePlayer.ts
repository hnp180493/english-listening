// TTS playback shared by the dictation exercises: normal / slow / chunk-by-chunk / careful,
// auto-play after the first user gesture, Esc = replay.
//
// The exercise audio is the CONNECTED version (src/core/playback.ts): that is what the learner must decode.
//  - 'normal': connected, the learner's rate (level 1: a little slower, still connected);
//  - 'slow': connected, CONNECTED_SLOW_RATE (slower, still reduced and linked);
//  - 'chunks': each segment's connected form with a pause, always with the BROWSER voice: with the AI voice every
//    chunk was one more request (a free key allows a few per minute, ~30 a day), so one press used the budget;
//  - 'careful': the standard written text, slower: "Rõ từng từ", offered only after checking the answer.

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useSettings } from '../../core/settings';
import { CAREFUL_RATE, CONNECTED_SLOW_RATE, dictationRate, type SpeechMode } from '../../core/playback';
import { speak, stopSpeaking, ttsSupported, useSpeechPending } from '../../core/tts';
import type { DictationAudio } from './decodeCache';
import { session } from './session';

export type PlayMode = 'normal' | 'slow' | 'chunks' | 'careful';

const CHUNK_PAUSE_MS = 380;

/** What one (non-chunk) play mode speaks: text, rate and AI style. Pure, tested. */
export function playbackFor(
  mode: Exclude<PlayMode, 'chunks'>,
  audio: DictationAudio,
  baseRate: number,
): { text: string; rate: number; mode: SpeechMode; slow?: boolean } {
  switch (mode) {
    case 'careful':
      return { text: audio.careful, rate: CAREFUL_RATE, mode: 'careful' };
    case 'slow':
      return { text: audio.connected, rate: CONNECTED_SLOW_RATE, mode: 'connected', slow: true };
    default:
      return { text: audio.connected, rate: dictationRate(baseRate, audio.level), mode: 'connected' };
  }
}

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
  audio: DictationAudio,
  chunks: readonly string[],
  opts: { autoPlay: boolean; rootRef: RefObject<HTMLElement | null> },
): Player {
  const settings = useSettings();
  const { connected, careful, level } = audio;
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
            // browser voice even when the AI voice is on: no quota spent per chunk
            await speak(chunks[k], { rate: dictationRate(rateRef.current, level), owner, mode: 'connected', browserOnly: true });
            if (runRef.current !== my) return;
            if (k < chunks.length - 1) await sleep(CHUNK_PAUSE_MS);
          }
        } else {
          const p = playbackFor(mode, { connected, careful, level }, rateRef.current);
          await speak(p.text, { rate: p.rate, owner, mode: p.mode, slow: p.slow });
        }
      } catch {
        // speech errors end playback quietly
      }
      if (runRef.current !== my) return;
      playingRef.current = null;
      setPlaying(null);
      setChunkPos(-1);
    },
    [canSpeak, chunks, connected, careful, level, stop, owner],
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
