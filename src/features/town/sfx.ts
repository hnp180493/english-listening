// The town's sound effects: a few short, soft tones made with Web Audio (no files, no music). They never sound
// while English is being spoken (the learner is here to hear it): playSfx is refused while a playback is in flight,
// and stopSfx() cuts what is still ringing when a line starts.

import { currentUtteranceId } from '../../core/tts';

export type SfxName = 'coin' | 'right' | 'first' | 'wrong' | 'build' | 'pop' | 'level' | 'task';

/** One tone: when it starts (seconds from now), its pitch, how long it rings and how loud (0..1 of the master). */
export interface Tone {
  at: number;
  hz: number;
  dur: number;
  vol: number;
  wave?: OscillatorType;
  /** Slide to this pitch over the tone (a knock falls, a sparkle rises). */
  to?: number;
}

const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const B5 = 987.77;
const C6 = 1046.5;
const E6 = 1318.5;
const G6 = 1568;

/** The scores. Everything is under a second except the level-up. */
export const SFX: Readonly<Record<SfxName, readonly Tone[]>> = {
  coin: [
    { at: 0, hz: B5, dur: 0.07, vol: 0.5 },
    { at: 0.07, hz: E6, dur: 0.24, vol: 0.5 },
  ],
  right: [
    { at: 0, hz: E5, dur: 0.12, vol: 0.5, wave: 'triangle' },
    { at: 0.1, hz: G5, dur: 0.22, vol: 0.5, wave: 'triangle' },
  ],
  first: [
    { at: 0, hz: C5, dur: 0.1, vol: 0.5, wave: 'triangle' },
    { at: 0.09, hz: E5, dur: 0.1, vol: 0.5, wave: 'triangle' },
    { at: 0.18, hz: G5, dur: 0.12, vol: 0.5, wave: 'triangle' },
    { at: 0.28, hz: C6, dur: 0.3, vol: 0.45 },
  ],
  wrong: [
    { at: 0, hz: 311, dur: 0.14, vol: 0.45 },
    { at: 0.13, hz: 247, dur: 0.26, vol: 0.45 },
  ],
  build: [
    { at: 0, hz: 190, to: 110, dur: 0.07, vol: 0.7, wave: 'triangle' },
    { at: 0.14, hz: 210, to: 120, dur: 0.07, vol: 0.7, wave: 'triangle' },
    { at: 0.28, hz: 170, to: 100, dur: 0.08, vol: 0.7, wave: 'triangle' },
  ],
  pop: [
    { at: 0, hz: 330, to: 660, dur: 0.09, vol: 0.5 },
    { at: 0.1, hz: G5, dur: 0.14, vol: 0.45, wave: 'triangle' },
    { at: 0.2, hz: C6, dur: 0.34, vol: 0.45 },
  ],
  level: [
    { at: 0, hz: C5, dur: 0.14, vol: 0.5, wave: 'triangle' },
    { at: 0.11, hz: E5, dur: 0.14, vol: 0.5, wave: 'triangle' },
    { at: 0.22, hz: G5, dur: 0.14, vol: 0.5, wave: 'triangle' },
    { at: 0.33, hz: C6, dur: 0.18, vol: 0.5, wave: 'triangle' },
    { at: 0.46, hz: E6, dur: 0.2, vol: 0.45 },
    { at: 0.6, hz: G6, dur: 0.5, vol: 0.4 },
  ],
  task: [
    { at: 0, hz: G5, dur: 0.12, vol: 0.5 },
    { at: 0.12, hz: C6, dur: 0.12, vol: 0.5 },
    { at: 0.24, hz: E6, dur: 0.3, vol: 0.45 },
  ],
};

/** How long a score rings, in seconds. */
export function sfxSeconds(name: SfxName): number {
  return SFX[name].reduce((end, t) => Math.max(end, t.at + t.dur), 0);
}

/** Quiet on purpose: the effects sit well under the voice. */
const MASTER = 0.16;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function audio(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

function bus(ac: AudioContext): GainNode {
  if (!master) {
    master = ac.createGain();
    master.gain.value = MASTER;
    master.connect(ac.destination);
  }
  return master;
}

/**
 * Play an effect now. Does nothing when `enabled` is false, while speech is in flight (never over a line), or
 * where the browser has no Web Audio or has not let the page make sound yet. Never throws.
 */
export function playSfx(name: SfxName, enabled: boolean): void {
  if (!enabled || currentUtteranceId() !== null) return;
  try {
    const ac = audio();
    if (!ac) return;
    if (ac.state === 'suspended') void ac.resume().catch(() => {});
    const out = bus(ac);
    const t0 = ac.currentTime + 0.01;
    for (const tone of SFX[name]) {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = tone.wave ?? 'sine';
      const start = t0 + tone.at;
      osc.frequency.setValueAtTime(tone.hz, start);
      if (tone.to) osc.frequency.exponentialRampToValueAtTime(tone.to, start + tone.dur);
      // a soft attack and an even softer tail: no clicks
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(tone.vol, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.dur);
      osc.connect(gain);
      gain.connect(out);
      osc.start(start);
      osc.stop(start + tone.dur + 0.03);
    }
  } catch {
    // sound effects are decoration: never break the game
  }
}

/** Cut whatever is still ringing (a line is about to be spoken). */
export function stopSfx(): void {
  if (!ctx || !master) return;
  try {
    const old = master;
    master = null;
    old.gain.cancelScheduledValues(ctx.currentTime);
    old.gain.setTargetAtTime(0, ctx.currentTime, 0.015);
    window.setTimeout(() => old.disconnect(), 200);
  } catch {
    // nothing to stop
  }
}
