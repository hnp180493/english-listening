import { useSyncExternalStore } from 'react';
import { DEFAULT_REVIEW_MINUTES, REVIEW_MINUTES_OPTIONS } from './review/constants';
import { KEYS, loadJSON, saveJSON, STORAGE_PREFIX } from './storage';

export interface Settings {
  voiceURI: string | null; // chosen speechSynthesis voice; null = auto-pick best English voice
  rate: number; // default playback rate, 0.5–1.5
  showIpa: boolean; // show IPA next to respellings
  theme: 'system' | 'light' | 'dark'; // applied as <html data-theme="..."> ("system" removes the attribute)
  dailyGoal: number; // target practice attempts per day (any module), 10–100
  reviewMinutes: number; // "Thời lượng ôn mỗi ngày" (Ôn tập budget), one of REVIEW_MINUTES_OPTIONS
  listenGoal: number; // "Mục tiêu nghe mỗi ngày" in minutes of real listening (Nhật ký nghe), one of LISTEN_GOAL_OPTIONS; 0 = off
  /**
   * Which voice reads the app's audio: 'browser' = speechSynthesis (voiceURI), 'ai' = the AI speech provider
   * from Cài đặt → AI (falls back to the browser voice when no provider can speak or a request fails).
   */
  voiceEngine: VoiceEngine;
}

export type VoiceEngine = 'browser' | 'ai';
export const VOICE_ENGINES: readonly VoiceEngine[] = ['browser', 'ai'];

/** A stored voiceEngine value, or 'browser' when it is not a known engine. */
export function sanitizeVoiceEngine(v: unknown): VoiceEngine {
  return v === 'ai' ? 'ai' : 'browser';
}

/** Daily real-listening goal choices in minutes (0 = tắt). */
export const LISTEN_GOAL_OPTIONS: readonly number[] = [0, 15, 30, 45, 60, 90];
export const DEFAULT_LISTEN_GOAL = 30;

/** A stored listenGoal value, or the default when it is not one of LISTEN_GOAL_OPTIONS. */
export function sanitizeListenGoal(v: unknown): number {
  return typeof v === 'number' && LISTEN_GOAL_OPTIONS.includes(v) ? v : DEFAULT_LISTEN_GOAL;
}

const DEFAULTS: Settings = {
  voiceURI: null,
  rate: 1,
  showIpa: false,
  theme: 'system',
  dailyGoal: 30,
  reviewMinutes: DEFAULT_REVIEW_MINUTES,
  listenGoal: DEFAULT_LISTEN_GOAL,
  voiceEngine: 'browser',
};

/** A stored reviewMinutes value, or the default when it is not one of REVIEW_MINUTES_OPTIONS. */
export function sanitizeReviewMinutes(v: unknown): number {
  return typeof v === 'number' && REVIEW_MINUTES_OPTIONS.includes(v) ? v : DEFAULT_REVIEW_MINUTES;
}

const withValidReview = (s: Settings): Settings => {
  const reviewMinutes = sanitizeReviewMinutes(s.reviewMinutes);
  const listenGoal = sanitizeListenGoal(s.listenGoal);
  const voiceEngine = sanitizeVoiceEngine(s.voiceEngine);
  return s.reviewMinutes === reviewMinutes && s.listenGoal === listenGoal && s.voiceEngine === voiceEngine
    ? s
    : { ...s, reviewMinutes, listenGoal, voiceEngine };
};

const read = (): Settings => withValidReview({ ...DEFAULTS, ...loadJSON<Partial<Settings>>(KEYS.settings, {}) });

let current: Settings = read();
const listeners = new Set<() => void>();
/** True while the last write failed (blocked/full storage). */
let unsaved = false;

// Another tab saved settings: pick them up so this tab neither shows nor writes back stale values.
if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('storage', (e) => {
    if (e.key === null || e.key === STORAGE_PREFIX + KEYS.settings) {
      current = read();
      unsaved = false;
      listeners.forEach((fn) => fn());
    }
  });
}

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>): void {
  // Build on what is stored (another tab may have changed it), unless our last write failed:
  // then memory holds changes storage never got, so keep building on memory.
  current = withValidReview({ ...current, ...(unsaved ? {} : readStoredPartial()), ...patch });
  unsaved = !saveJSON(KEYS.settings, current);
  listeners.forEach((fn) => fn());
}

/** Re-read settings from storage (after folder sync replaced the stored data) and notify subscribers. */
export function reloadSettings(): void {
  current = read();
  unsaved = false;
  listeners.forEach((fn) => fn());
}

function readStoredPartial(): Partial<Settings> {
  return loadJSON<Partial<Settings>>(KEYS.settings, {});
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, getSettings);
}
