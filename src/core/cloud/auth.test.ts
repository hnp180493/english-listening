import { describe, expect, it, vi } from 'vitest';
import {
  authorizeUrl,
  challengeFor,
  cleanCallbackUrl,
  exchangeCode,
  needsRefresh,
  newVerifier,
  parseSession,
  readCallback,
  redirectTarget,
  refreshSession,
  sessionFromToken,
  signOutRemote,
  type FetchFn,
} from './auth';
import { parseCloudConfig, type CloudConfig } from './config';
import { CloudError, restStore } from './remote';

const cfg: CloudConfig = { url: 'https://proj.supabase.co', key: 'sb_publishable_test', webAppUrl: 'https://example.github.io/app/' };
const USER = { id: '11111111-2222-3333-4444-555555555555', email: 'a@b.c', user_metadata: { full_name: 'Học Viên' } };

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('config', () => {
  it('needs both values and an https (or loopback) origin', () => {
    expect(parseCloudConfig({})).toBeNull();
    expect(parseCloudConfig({ url: 'https://p.supabase.co' })).toBeNull();
    expect(parseCloudConfig({ url: 'http://p.supabase.co', key: 'k' })).toBeNull();
    expect(parseCloudConfig({ url: 'https://p.supabase.co/rest', key: 'k' })).toBeNull();
    expect(parseCloudConfig({ url: 'http://127.0.0.1:54321', key: 'k' })?.url).toBe('http://127.0.0.1:54321');
    expect(parseCloudConfig({ url: 'https://p.supabase.co/', key: ' k ' })).toMatchObject({ url: 'https://p.supabase.co', key: 'k' });
  });

  it('refuses a secret key (it bypasses row level security)', () => {
    expect(parseCloudConfig({ url: 'https://p.supabase.co', key: 'sb_secret_abc' })).toBeNull();
  });

  it('web app URL: default, or a valid https override without query', () => {
    expect(parseCloudConfig({ url: 'https://p.supabase.co', key: 'k' })?.webAppUrl).toBe('https://hnp180493.github.io/english-listening/');
    expect(parseCloudConfig({ url: 'https://p.supabase.co', key: 'k', webAppUrl: 'https://x.dev/a/?q=1#h' })?.webAppUrl).toBe('https://x.dev/a/');
    expect(parseCloudConfig({ url: 'https://p.supabase.co', key: 'k', webAppUrl: 'javascript:alert(1)' })?.webAppUrl).toBe(
      'https://hnp180493.github.io/english-listening/',
    );
  });
});

describe('PKCE', () => {
  it('verifier is 64 base64url characters; challenge is the RFC 7636 S256 value', async () => {
    const v = newVerifier();
    expect(v).toMatch(/^[A-Za-z0-9_-]{64}$/);
    // RFC 7636 appendix B
    expect(await challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('authorize URL asks Google with the challenge and the redirect', () => {
    const u = new URL(authorizeUrl(cfg, 'https://example.github.io/app/', 'CH'));
    expect(u.origin + u.pathname).toBe('https://proj.supabase.co/auth/v1/authorize');
    expect(u.searchParams.get('provider')).toBe('google');
    expect(u.searchParams.get('redirect_to')).toBe('https://example.github.io/app/');
    expect(u.searchParams.get('code_challenge')).toBe('CH');
    expect(u.searchParams.get('code_challenge_method')).toBe('s256');
  });

  it('redirect: this page on the web, the web app with the portable flag from a file', () => {
    expect(redirectTarget(cfg, { protocol: 'https:', origin: 'https://example.github.io', pathname: '/app/' })).toBe('https://example.github.io/app/');
    expect(redirectTarget(cfg, { protocol: 'http:', origin: 'http://localhost:5173', pathname: '/' })).toBe('http://localhost:5173/');
    expect(redirectTarget(cfg, { protocol: 'file:', origin: 'null', pathname: '/C:/x/Nghe-Noi-Am.html' })).toBe(
      'https://example.github.io/app/?nna_login=portable',
    );
  });
});

describe('callback URL', () => {
  it('reads the code, the portable flag and errors', () => {
    expect(readCallback('https://x.io/app/')).toEqual({ kind: 'none' });
    expect(readCallback('https://x.io/app/#/settings')).toEqual({ kind: 'none' });
    expect(readCallback('https://x.io/app/?code=abcdef12-3456')).toEqual({ kind: 'code', code: 'abcdef12-3456', portable: false });
    expect(readCallback('https://x.io/app/?nna_login=portable&code=abcdef12-3456')).toEqual({ kind: 'code', code: 'abcdef12-3456', portable: true });
    expect(readCallback('https://x.io/app/?code=<script>')).toEqual({ kind: 'none' });
    expect(readCallback('https://x.io/app/?error=access_denied&error_description=User+cancelled')).toMatchObject({ kind: 'error', message: 'Đã hủy đăng nhập Google.' });
    expect(readCallback('https://x.io/app/#error=server_error&error_description=Unable')).toMatchObject({ kind: 'error' });
  });

  it('clean URL drops the sign-in parameters and opens Cài đặt', () => {
    expect(cleanCallbackUrl('https://x.io/app/?nna_login=portable&code=abc&keep=1#/home')).toBe('/app/?keep=1#/settings');
    expect(cleanCallbackUrl('https://x.io/app/?code=abc')).toBe('/app/#/settings');
  });
});

describe('sessions', () => {
  it('from a token response, and back from storage', () => {
    const s = sessionFromToken({ access_token: 'AT', refresh_token: 'RT', expires_at: 1_900_000_000, user: USER }, 0);
    expect(s).toEqual({ accessToken: 'AT', refreshToken: 'RT', expiresAt: 1_900_000_000_000, user: { id: USER.id, email: 'a@b.c', name: 'Học Viên' } });
    expect(parseSession(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(sessionFromToken({ access_token: 'AT', expires_in: 3600, refresh_token: 'RT', user: USER }, 1000)?.expiresAt).toBe(3_601_000);
    expect(sessionFromToken({ access_token: 'AT', user: USER }, 0)).toBeNull();
    expect(parseSession({ accessToken: 'AT', refreshToken: 'RT', user: {} })).toBeNull();
    expect(parseSession('x')).toBeNull();
  });

  it('refreshes a minute before expiry', () => {
    const s = { accessToken: 'a', refreshToken: 'r', expiresAt: 100_000, user: { id: 'x', email: null, name: null } };
    expect(needsRefresh(s, 30_000)).toBe(false);
    expect(needsRefresh(s, 40_000)).toBe(true);
  });

  it('exchange: right request; errors map to Vietnamese kinds', async () => {
    const f = vi.fn<FetchFn>(async () => json(200, { access_token: 'AT', refresh_token: 'RT', expires_in: 3600, user: USER }));
    const r = await exchangeCode(cfg, 'CODE', 'VER', f, () => 0);
    expect(r.ok).toBe(true);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://proj.supabase.co/auth/v1/token?grant_type=pkce');
    expect(JSON.parse(String(init?.body))).toEqual({ auth_code: 'CODE', code_verifier: 'VER' });
    expect((init!.headers as Record<string, string>).apikey).toBe('sb_publishable_test');

    expect(await exchangeCode(cfg, 'C', 'V', async () => json(400, { error: 'invalid_grant' }))).toMatchObject({ ok: false, kind: 'invalid' });
    expect(await refreshSession(cfg, 'R', async () => json(400, { code: 400, msg: 'Invalid Refresh Token' }))).toMatchObject({
      ok: false,
      kind: 'invalid',
      message: 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.',
    });
    expect(await refreshSession(cfg, 'R', async () => json(503, {}))).toMatchObject({ ok: false, kind: 'server' });
    expect(
      await refreshSession(cfg, 'R', async () => {
        throw new TypeError('Failed to fetch');
      }),
    ).toMatchObject({ ok: false, kind: 'network' });
  });

  it('sign out never throws', async () => {
    await expect(
      signOutRemote(cfg, 'AT', async () => {
        throw new TypeError('offline');
      }),
    ).resolves.toBeUndefined();
  });
});

describe('REST store', () => {
  it('lists, fetches only valid keys, and writes through the compare-and-swap function', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const f: FetchFn = async (url, init) => {
      calls.push({ url, init });
      if (url.includes('rpc/nna_sync_write')) return json(200, { ok: true, revs: { 'review-cards': 42 } });
      if (url.includes('value')) return json(200, [{ key: 'review-cards', rev: 41, updated_at: '2026-11-22T00:00:00Z', value: '{}' }]);
      return json(200, [{ key: 'review-cards', rev: '41', updated_at: '2026-11-22T00:00:00Z' }, { key: 'BAD KEY', rev: 1 }]);
    };
    const store = restStore(cfg, async () => 'TOKEN', f);
    expect(await store.list()).toEqual([{ key: 'review-cards', rev: 41, updatedAt: Date.parse('2026-11-22T00:00:00Z') }]);
    expect((await store.fetch(['review-cards', 'x"),evil'])).map((r) => r.key)).toEqual(['review-cards']);
    expect(calls[1].url).toBe('https://proj.supabase.co/rest/v1/nna_sync?select=key,rev,updated_at,value&key=in.("review-cards")');
    expect(await store.write([{ key: 'review-cards', value: '{}', base: 41 }], 'Edge · Windows')).toEqual({ ok: true, revs: { 'review-cards': 42 } });
    const w = calls[2];
    expect(w.init?.method).toBe('POST');
    expect(JSON.parse(String(w.init?.body))).toEqual({ changes: [{ key: 'review-cards', value: '{}', base: 41 }], device: 'Edge · Windows' });
    expect((w.init!.headers as Record<string, string>).Authorization).toBe('Bearer TOKEN');
  });

  it('maps failures: conflict / quota results, expired token, missing table, offline', async () => {
    const store = (res: () => Response | Promise<Response>) => restStore(cfg, async () => 'T', async () => res());
    expect(await store(() => json(200, { ok: false, error: 'conflict', key: 'stats' })).write([], 'd')).toEqual({ ok: false, error: 'conflict', key: 'stats' });
    expect(await store(() => json(200, { ok: false, error: 'quota' })).write([], 'd')).toEqual({ ok: false, error: 'quota' });
    const kindOf = async (p: Promise<unknown>) => {
      try {
        await p;
        return 'none';
      } catch (e) {
        return e instanceof CloudError ? e.kind : 'other';
      }
    };
    expect(await kindOf(store(() => json(401, { code: 'PGRST301' })).list())).toBe('auth');
    expect(await kindOf(store(() => json(404, { code: 'PGRST205' })).list())).toBe('missing-table');
    expect(await kindOf(store(() => json(500, {})).list())).toBe('server');
    expect(
      await kindOf(
        store(() => {
          throw new TypeError('Failed to fetch');
        }).list(),
      ),
    ).toBe('network');
  });
});
