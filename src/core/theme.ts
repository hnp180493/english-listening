// Applies the theme preference to <html data-theme> and keeps <meta name="theme-color"> in sync.
// 'system' removes the attribute so the prefers-color-scheme rules in index.css decide.

import type { Settings } from './settings';

export type ThemePref = Settings['theme'];
export type ResolvedTheme = 'light' | 'dark';

/** Must match --bg in src/index.css (light / dark). */
export const THEME_COLOR: Record<ResolvedTheme, string> = { light: '#f5f6fa', dark: '#0b0d17' };

export function sanitizeTheme(t: unknown): ThemePref {
  return t === 'light' || t === 'dark' ? t : 'system';
}

export function systemPrefersDark(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

export function resolveTheme(pref: unknown, prefersDark: boolean = systemPrefersDark()): ResolvedTheme {
  const t = sanitizeTheme(pref);
  if (t === 'system') return prefersDark ? 'dark' : 'light';
  return t;
}

function setThemeColorMeta(color: string): void {
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = color;
}

export function applyTheme(pref: unknown): void {
  if (typeof document === 'undefined') return;
  const t = sanitizeTheme(pref);
  const root = document.documentElement;
  if (t === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', t);
  setThemeColorMeta(THEME_COLOR[resolveTheme(t)]);
}

/** Re-apply when the OS switches light/dark (matters for 'system'). Returns an unsubscribe. */
export function watchSystemTheme(getPref: () => unknown): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => applyTheme(getPref());
  mq.addEventListener?.('change', onChange);
  return () => mq.removeEventListener?.('change', onChange);
}
