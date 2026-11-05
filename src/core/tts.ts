// Text-to-speech via the browser's speechSynthesis.
// Natural/neural voices (Edge "Microsoft … Online (Natural)", Chrome "Google US English")
// already produce fairly natural connected speech; we prefer them.

import { useEffect, useState } from 'react';
import { getSettings } from './settings';

export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function getEnglishVoices(): SpeechSynthesisVoice[] {
  if (!ttsSupported()) return [];
  return window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'));
}

function score(v: SpeechSynthesisVoice): number {
  let s = 0;
  const name = v.name.toLowerCase();
  if (/natural|neural|online/.test(name)) s += 10;
  if (/google/.test(name)) s += 6;
  if (v.lang === 'en-US') s += 4;
  else if (v.lang === 'en-GB') s += 3;
  if (v.localService === false) s += 1;
  return s;
}

export function pickVoice(voiceURI: string | null): SpeechSynthesisVoice | null {
  const voices = getEnglishVoices();
  if (voices.length === 0) return null;
  if (voiceURI) {
    const v = voices.find((x) => x.voiceURI === voiceURI);
    if (v) return v;
  }
  return [...voices].sort((a, b) => score(b) - score(a))[0];
}

/** React hook: English voices, updates when the browser finishes loading them. */
export function useEnglishVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => getEnglishVoices());
  useEffect(() => {
    if (!ttsSupported()) return;
    const update = () => setVoices(getEnglishVoices());
    update();
    window.speechSynthesis.addEventListener('voiceschanged', update);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update);
  }, []);
  return voices;
}

export interface SpeakOptions {
  rate?: number; // overrides settings.rate
  onStart?: () => void;
}

/**
 * Speak text. Cancels anything currently speaking. Resolves when finished,
 * cancelled or on error (never rejects).
 */
export function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  return new Promise((resolve) => {
    if (!ttsSupported() || !text.trim()) return resolve();
    const synth = window.speechSynthesis;
    synth.cancel();
    const settings = getSettings();
    const u = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(settings.voiceURI);
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    } else {
      u.lang = 'en-US';
    }
    u.rate = Math.min(2, Math.max(0.3, opts.rate ?? settings.rate));
    u.onstart = () => opts.onStart?.();
    u.onend = () => resolve();
    u.onerror = () => resolve();
    synth.speak(u);
  });
}

export function stopSpeaking(): void {
  if (ttsSupported()) window.speechSynthesis.cancel();
}
