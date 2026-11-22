// Google sign-in through Supabase Auth (GoTrue REST, PKCE flow), without the supabase-js library: the app only needs
// "authorize", "exchange the code", "refresh" and "sign out". Everything here is pure or takes `fetch` as an argument,
// so it runs in node tests. Browser glue (storage, redirects, timers) is in cloudController.ts.
//
// Flow (web): authorizeUrl() → Google → Supabase → back to the app with ?code=… → exchangeCode(code, verifier).
// Flow (portable file://): the browser cannot be sent back to a file, so Google returns to the WEB app with
// ?nna_login=portable&code=…; the web app shows the code, the learner pastes it into the file, and the file exchanges
// it with the verifier only it holds (a code without its verifier is useless to anyone else).

import type { CloudConfig } from './config';

export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export interface CloudUser {
  id: string;
  email: string | null;
  name: string | null;
}

export interface CloudSession {
  accessToken: string;
  refreshToken: string;
  /** epoch ms */
  expiresAt: number;
  user: CloudUser;
}

export type AuthFailure = { ok: false; kind: 'invalid' | 'network' | 'server'; message: string };
export type AuthResult = { ok: true; session: CloudSession } | AuthFailure;

/** The query flag that marks a sign-in started by the portable file (the web app shows the code instead of using it). */
export const PORTABLE_FLAG = 'nna_login';

const str = (v: unknown, max = 4096): string | null => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function userFrom(raw: unknown): CloudUser | null {
  if (!isObj(raw)) return null;
  const id = str(raw.id, 64);
  if (!id || !/^[0-9a-f-]{8,64}$/i.test(id)) return null;
  const meta = isObj(raw.user_metadata) ? raw.user_metadata : {};
  const name = str(meta.full_name, 200) ?? str(meta.name, 200);
  return { id, email: str(raw.email, 320), name };
}

/** Session from a /token response; null when a field is missing. */
export function sessionFromToken(json: unknown, now: number): CloudSession | null {
  if (!isObj(json)) return null;
  const accessToken = str(json.access_token, 8192);
  const refreshToken = str(json.refresh_token, 1024);
  const user = userFrom(json.user);
  if (!accessToken || !refreshToken || !user) return null;
  let expiresAt = 0;
  if (typeof json.expires_at === 'number' && Number.isFinite(json.expires_at)) expiresAt = json.expires_at * 1000;
  else if (typeof json.expires_in === 'number' && Number.isFinite(json.expires_in)) expiresAt = now + json.expires_in * 1000;
  else expiresAt = now + 3600_000;
  return { accessToken, refreshToken, expiresAt, user };
}

/** Defensive parse of a stored session (device-local storage). */
export function parseSession(raw: unknown): CloudSession | null {
  if (!isObj(raw)) return null;
  const accessToken = str(raw.accessToken, 8192);
  const refreshToken = str(raw.refreshToken, 1024);
  const expiresAt = typeof raw.expiresAt === 'number' && Number.isFinite(raw.expiresAt) ? raw.expiresAt : 0;
  const u = isObj(raw.user) ? raw.user : null;
  const id = u ? str(u.id, 64) : null;
  if (!accessToken || !refreshToken || !u || !id) return null;
  return { accessToken, refreshToken, expiresAt, user: { id, email: str(u.email, 320), name: str(u.name, 200) } };
}

/** Refresh a minute before the access token runs out. */
export function needsRefresh(s: CloudSession, now: number): boolean {
  return s.expiresAt - 60_000 <= now;
}

// ───────────────────────── PKCE ─────────────────────────

function base64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A random code verifier (64 characters of base64url, within RFC 7636's 43–128). */
export function newVerifier(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  return base64url(random(48));
}

export async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

export function authorizeUrl(cfg: CloudConfig, redirectTo: string, challenge: string): string {
  const q = new URLSearchParams({
    provider: 'google',
    redirect_to: redirectTo,
    code_challenge: challenge,
    code_challenge_method: 's256',
  });
  return `${cfg.url}/auth/v1/authorize?${q.toString()}`;
}

/** Where Google should send the learner back to: this page (web) or the web app with the portable flag (file://). */
export function redirectTarget(cfg: CloudConfig, loc: { protocol: string; origin: string; pathname: string }): string {
  if (loc.protocol === 'file:') {
    const u = new URL(cfg.webAppUrl);
    u.searchParams.set(PORTABLE_FLAG, 'portable');
    return u.toString();
  }
  return loc.origin + loc.pathname;
}

// ───────────────────────── callback URL ─────────────────────────

export type Callback =
  | { kind: 'none' }
  | { kind: 'code'; code: string; portable: boolean }
  | { kind: 'error'; message: string };

/** Reads ?code=… / ?error=… that Supabase appended (an error may also come in the fragment). */
export function readCallback(href: string): Callback {
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return { kind: 'none' };
  }
  const q = u.searchParams;
  const frag = new URLSearchParams(u.hash.startsWith('#') && !u.hash.startsWith('#/') ? u.hash.slice(1) : '');
  const err = q.get('error_description') ?? q.get('error') ?? frag.get('error_description') ?? frag.get('error');
  if (err) return { kind: 'error', message: callbackErrorMessage(err) };
  const code = q.get('code');
  if (code && /^[A-Za-z0-9._~-]{8,512}$/.test(code)) return { kind: 'code', code, portable: q.get(PORTABLE_FLAG) === 'portable' };
  return { kind: 'none' };
}

function callbackErrorMessage(raw: string): string {
  if (/access_denied|cancel/i.test(raw)) return 'Đã hủy đăng nhập Google.';
  return 'Đăng nhập Google không thành công. Hãy thử lại.';
}

/** The page URL without the sign-in parameters, opened on Cài đặt. */
export function cleanCallbackUrl(href: string): string {
  const u = new URL(href);
  for (const p of ['code', 'error', 'error_code', 'error_description', 'state', PORTABLE_FLAG]) u.searchParams.delete(p);
  const search = u.searchParams.toString();
  return u.pathname + (search ? `?${search}` : '') + '#/settings';
}

// ───────────────────────── requests ─────────────────────────

async function tokenRequest(cfg: CloudConfig, grant: 'pkce' | 'refresh_token', body: object, fetchFn: FetchFn, now: () => number): Promise<AuthResult> {
  let res: Response;
  try {
    res = await fetchFn(`${cfg.url}/auth/v1/token?grant_type=${grant}`, {
      method: 'POST',
      headers: { apikey: cfg.key, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, kind: 'network', message: 'Không kết nối được máy chủ (đang ngoại tuyến?).' };
  }
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  if (res.ok) {
    const session = sessionFromToken(json, now());
    if (session) return { ok: true, session };
    return { ok: false, kind: 'server', message: 'Máy chủ trả về phiên đăng nhập không hợp lệ.' };
  }
  if (res.status >= 500 || res.status === 429) return { ok: false, kind: 'server', message: 'Máy chủ đăng nhập đang bận. Hãy thử lại sau.' };
  // 400/401/403: the code expired or was used, or the refresh token is no longer valid
  return {
    ok: false,
    kind: 'invalid',
    message:
      grant === 'pkce'
        ? 'Mã đăng nhập không dùng được (đã hết hạn hoặc đã dùng rồi). Hãy đăng nhập lại.'
        : 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.',
  };
}

export function exchangeCode(cfg: CloudConfig, code: string, verifier: string, fetchFn: FetchFn, now: () => number = Date.now): Promise<AuthResult> {
  return tokenRequest(cfg, 'pkce', { auth_code: code, code_verifier: verifier }, fetchFn, now);
}

export function refreshSession(cfg: CloudConfig, refreshToken: string, fetchFn: FetchFn, now: () => number = Date.now): Promise<AuthResult> {
  return tokenRequest(cfg, 'refresh_token', { refresh_token: refreshToken }, fetchFn, now);
}

/** Ends this browser's session on the server (best effort: the local copy is dropped either way). */
export async function signOutRemote(cfg: CloudConfig, accessToken: string, fetchFn: FetchFn): Promise<void> {
  try {
    await fetchFn(`${cfg.url}/auth/v1/logout?scope=local`, {
      method: 'POST',
      headers: { apikey: cfg.key, Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    // offline: the token simply expires
  }
}
