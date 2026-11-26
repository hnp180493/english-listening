// The voices of Rico's dispatch office (core/town/dispatch.ts): a caller on phone two and the drivers on the radio, all
// in the browser's voice (never a clip, never the paid voice: docs/city.md §5). A caller's manner is a speed and a
// loudness of that voice: hurried a little faster, mumbling quieter, a bad line a little quieter (its words already
// say it twice). "Xin nhắc lại" is slower (still connected). One thing at a time: a queue, so a driver's report never
// talks over a caller.

import { CAREFUL_RATE } from '../../../core/playback';
import { getSettings } from '../../../core/settings';
import type { DispatchCall, DriverId, Manner } from '../../../core/town/dispatch';
import { jobVoice } from '../../../core/town/jobVoice';
import { speak, stopSpeaking, type SpeakOptions, type SpeakVoice } from '../../../core/tts';
import { dispatchVoice } from '../../../data/city/dispatch';
import { dictationAudio } from '../../dictation/decodeCache';

const MANNER: Readonly<Record<Manner, { rate: number; volume: number }>> = {
  clear: { rate: 1, volume: 1 },
  hurried: { rate: 1.15, volume: 1 },
  mumbling: { rate: 0.97, volume: 0.6 },
  badline: { rate: 1, volume: 0.8 },
};

/** A line as the office says it: connected (the decoder's or the authored spelling), or the written words slowly. */
function playback(text: string, level: number, careful: boolean): string {
  const a = dictationAudio({ text, level });
  return (careful ? a.careful : a.connected).trim();
}

let chain: Promise<void> = Promise.resolve();
let gen = 0;

/** Say lines one after another (a new queue starts after `hush`). */
function queue(text: string, opts: SpeakOptions): Promise<void> {
  const g = gen;
  chain = chain.then(() => (g === gen ? speak(text, opts).catch(() => undefined) : undefined));
  return chain;
}

/** Stop whatever is said and drop what waits. */
export function hush(): void {
  gen++;
  chain = Promise.resolve();
  stopSpeaking();
}

/** The speech level's speed for the callers of the shift under way (core/town/difficulty.ts): a factor on the learner's rate. */
let levelRate = 1;
export function setCallerRate(factor: number): void {
  levelRate = factor > 0 ? factor : 1;
}

export interface CallSay {
  call: Pick<DispatchCall, 'id' | 'gender' | 'manner' | 'level'>;
  text: string;
  /** A repeat ("Xin nhắc lại"): slower. */
  again?: boolean;
  /** The written words, slowly ("Rõ từng từ", only after the shift). */
  careful?: boolean;
}

/** A caller says something (on the phone: their manner). */
export function sayCaller({ call, text, again = false, careful = false }: CallSay, onStart?: () => void): Promise<void> {
  const base = getSettings().rate || 1;
  const m = MANNER[call.manner];
  const voice: SpeakVoice = dispatchVoice(call);
  const opts: SpeakOptions = careful
    ? { mode: 'careful', rate: CAREFUL_RATE, voice, browserOnly: true }
    : { mode: 'connected', voice, browserOnly: true, volume: m.volume, ...(again ? { slow: true } : { rate: Math.min(1.6, base * m.rate * levelRate) }) };
  if (onStart) opts.onStart = onStart;
  return queue(playback(text, call.level, careful), opts);
}

/** A driver (or Rico at the office) on the radio. */
export function sayDriver(who: DriverId, text: string, careful = false): Promise<void> {
  const voice = jobVoice(who);
  const opts: SpeakOptions = careful ? { mode: 'careful', rate: CAREFUL_RATE, browserOnly: true } : { mode: 'connected', browserOnly: true, volume: 0.85 };
  if (voice) opts.voice = voice;
  return queue(playback(text, 2, careful), opts);
}
