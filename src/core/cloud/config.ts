// Where the account sync lives: the Supabase project shared with daily-english (docs/supabase-sync.md).
// The URL and the publishable key come from the build environment (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY:
// `.env.local` on a computer, repository secrets in the deploy workflow), never from the repository. A publishable key
// is meant to ship in the page (row level security protects the data), but it stays out of the source like every key.
// Without both values the whole feature is hidden and the app behaves exactly as before.

export interface CloudConfig {
  /** https://<project>.supabase.co (no trailing slash) */
  url: string;
  /** sb_publishable_… (or a legacy anon JWT) */
  key: string;
  /** The web app, where Google sends the learner back to (the portable file cannot receive a redirect). */
  webAppUrl: string;
}

/** The published web app (GitHub Pages). The portable file sends its sign-in through it. */
export const DEFAULT_WEB_APP_URL = 'https://hnp180493.github.io/english-listening/';

/** Validates the raw build values; null when anything is missing or odd (feature off). */
export function parseCloudConfig(raw: { url?: unknown; key?: unknown; webAppUrl?: unknown }): CloudConfig | null {
  const url = typeof raw.url === 'string' ? raw.url.trim().replace(/\/+$/, '') : '';
  const key = typeof raw.key === 'string' ? raw.key.trim() : '';
  if (!url || !key) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const loopback = u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]';
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && loopback)) return null;
  if (u.pathname !== '/' || u.search || u.hash || u.username || u.password) return null;
  // never a secret key: those bypass row level security and must not reach a browser
  if (/^sb_secret_/i.test(key) || key.length > 2000 || /\s/.test(key)) return null;
  let webAppUrl = DEFAULT_WEB_APP_URL;
  if (typeof raw.webAppUrl === 'string' && raw.webAppUrl.trim()) {
    try {
      const w = new URL(raw.webAppUrl.trim());
      if (w.protocol === 'https:' || (w.protocol === 'http:' && (w.hostname === 'localhost' || w.hostname === '127.0.0.1'))) {
        webAppUrl = w.origin + w.pathname;
      }
    } catch {
      // keep the default
    }
  }
  return { url: u.origin, key, webAppUrl };
}

let cached: CloudConfig | null | undefined;

export function cloudConfig(): CloudConfig | null {
  if (cached === undefined) {
    let env: Record<string, unknown> = {};
    try {
      env = import.meta.env as unknown as Record<string, unknown>;
    } catch {
      env = {};
    }
    cached = parseCloudConfig({ url: env.VITE_SUPABASE_URL, key: env.VITE_SUPABASE_PUBLISHABLE_KEY, webAppUrl: env.VITE_WEB_APP_URL });
  }
  return cached;
}

/** Test hook. */
export function _setCloudConfig(c: CloudConfig | null | undefined): void {
  cached = c;
}
