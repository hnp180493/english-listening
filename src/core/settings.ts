import { useSyncExternalStore } from 'react';
import { KEYS, loadJSON, saveJSON } from './storage';

export interface Settings {
  voiceURI: string | null; // chosen speechSynthesis voice; null = auto-pick best English voice
  rate: number; // default playback rate, 0.5–1.5
  showIpa: boolean; // show IPA next to respellings
}

const DEFAULTS: Settings = { voiceURI: null, rate: 1, showIpa: false };

let current: Settings = { ...DEFAULTS, ...loadJSON<Partial<Settings>>(KEYS.settings, {}) };
const listeners = new Set<() => void>();

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  saveJSON(KEYS.settings, current);
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, getSettings);
}
