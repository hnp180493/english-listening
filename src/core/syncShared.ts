// Small helpers of account sync (core/cloud) that are not about Supabase: a fingerprint of stored values, a label for
// this browser, the startup window in which synced data may still replace local data, and the cross-tab "data was
// replaced" signal. (They came from the folder sync, retired 2026-11-22: Supabase is the only sync channel now.)

import type { DataMap } from './syncMerge';

/**
 * localStorage key (outside STORAGE_PREFIX, so never exported or synced) bumped whenever synced data replaced this
 * browser's data: other open tabs of the app reload instead of writing their stale copies back.
 */
export const SYNC_APPLIED_KEY = 'nghe-noi-am-sync-applied';

/** Order-independent fingerprint of app data (FNV-1a over the sorted entries). Not cryptographic. */
export function dataHash(data: DataMap): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ 0x5bd1e995;
  const feed = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193);
      h2 = Math.imul(h2 ^ c, 0x5bd1e995) ^ (h2 >>> 15);
    }
  };
  const keys = Object.keys(data).sort();
  for (const k of keys) {
    // Length prefixes keep "ab"+"c" and "a"+"bc" apart.
    feed(`${k.length}:${k}${data[k].length}:`);
    feed(data[k]);
  }
  return `${keys.length}-${(h1 >>> 0).toString(36)}-${(h2 >>> 0).toString(36)}`;
}

/** "Edge · Windows" from a user agent string (written next to synced rows, for the learner's eyes). */
export function deviceLabelFrom(ua: string): string {
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Trình duyệt';
  const os = /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /CrOS/.test(ua)
        ? 'ChromeOS'
        : /iPhone|iPad/.test(ua)
          ? 'iOS'
          : /Mac OS X/.test(ua)
            ? 'macOS'
            : /Linux/.test(ua)
              ? 'Linux'
              : '';
  return os ? `${browser} · ${os}` : browser;
}

export interface StartupWindow {
  /** True until the budget has run out (or close() was called). */
  canApply(): boolean;
  /** Resolves when the budget has run out; the window is already closed by then. */
  expired: Promise<void>;
  close(): void;
}

/**
 * Before the first render, synced data may replace local data; after it, never (the page would show and write back
 * stale values). The window is closed by the timer itself, before anything awaiting `expired` can render, so no clock
 * comparison can let a late apply slip through.
 */
export function startupWindow(budgetMs: number, setTimer: (fn: () => void, ms: number) => unknown = setTimeout): StartupWindow {
  let open = true;
  let done: () => void = () => {};
  const expired = new Promise<void>((resolve) => {
    done = resolve;
  });
  setTimer(() => {
    open = false;
    done();
  }, budgetMs);
  return {
    canApply: () => open,
    expired,
    close: () => {
      open = false;
      done();
    },
  };
}
