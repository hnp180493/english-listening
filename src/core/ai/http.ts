// Thin fetch layer shared by adapters: one HTTP call, mapped to AiError on failure. Retries and
// timeouts are orchestrated by client.ts (it aborts the signal with TIMEOUT_REASON on timeout).
// Secrets only ever travel in request headers; nothing here logs or echoes them.

import { AiError, makeError, redactSecrets } from './errors';
import type { AiErrorCode, ProviderKind } from './types';

/** Abort reason client.ts uses for its timer, so a timeout is told apart from a user abort. */
export const TIMEOUT_REASON: { readonly aiTimeout: true } = Object.freeze({ aiTimeout: true as const });

export interface CallContext {
  kind: ProviderKind;
  label: string;
  model?: string;
  /** For the timeout message only. */
  timeoutMs?: number;
}

export type ErrorMapper = (status: number, body: unknown, headers: Headers, ctx: CallContext) => AiError;

export interface SendOptions {
  url: string;
  method?: 'GET' | 'POST';
  headers: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
  ctx: CallContext;
  mapError: ErrorMapper;
  /** Code for a fetch that rejects while the browser is online: 'cors' for local servers, else 'network'. */
  fetchFailCode?: 'network' | 'cors';
}

export interface JsonResponse {
  status: number;
  body: unknown;
  headers: Headers;
}

function isOffline(): boolean {
  const nav = (globalThis as { navigator?: { onLine?: boolean } }).navigator;
  return nav?.onLine === false;
}

/** Maps a rejected fetch (no HTTP response) to timeout / aborted / network / cors. */
export function mapFetchFailure(e: unknown, signal: AbortSignal | undefined, ctx: CallContext, failCode: 'network' | 'cors'): AiError {
  if (e instanceof AiError) return e;
  if (signal?.aborted) {
    return signal.reason === TIMEOUT_REASON
      ? makeError('timeout', { ...ctx, provider: ctx.kind })
      : makeError('aborted', { ...ctx, provider: ctx.kind });
  }
  if ((e as { name?: string } | null)?.name === 'AbortError') return makeError('aborted', { ...ctx, provider: ctx.kind });
  const code: AiErrorCode = isOffline() ? 'network' : failCode;
  return makeError(code, { ...ctx, provider: ctx.kind }, { retryable: code === 'network' });
}

/** Header names that carry a credential. */
const SECRET_HEADERS = new Set(['x-goog-api-key', 'x-api-key', 'authorization']);
/** Shorter values are not scrubbed (they would mangle ordinary words; such a "key" is no secret anyway). */
const MIN_SCRUB_LENGTH = 4;

/** The credential values carried in this request's headers ("Bearer " stripped). */
export function secretsOf(headers: Record<string, string>): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(headers)) {
    if (!SECRET_HEADERS.has(k.toLowerCase()) || typeof v !== 'string') continue;
    const value = v.replace(/^Bearer\s+/i, '').trim();
    if (value.length >= MIN_SCRUB_LENGTH) out.push(value);
  }
  return out;
}

/**
 * Replaces every occurrence of the given secrets in all strings of a parsed body (deep copy).
 * Applied to error bodies BEFORE any mapper sees them, so a server that echoes the key (local
 * LM Studio/LiteLLM/vLLM keys have no recognisable prefix) can never leak it into a message.
 */
export function scrubSecrets<T>(value: T, secrets: readonly string[], depth = 0): T {
  if (!secrets.length) return value;
  if (typeof value === 'string') {
    let s: string = value;
    for (const k of secrets) if (s.includes(k)) s = s.split(k).join('[đã ẩn]');
    return s as T;
  }
  if (!value || typeof value !== 'object' || depth > 20) return value;
  if (Array.isArray(value)) return value.map((v) => scrubSecrets(v, secrets, depth + 1)) as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = scrubSecrets(v, secrets, depth + 1);
  return out as T;
}

/** In a 2xx body only the error parts can echo a key (OpenRouter delivers some errors with HTTP 200). */
function scrubErrorParts(body: unknown, secrets: readonly string[]): unknown {
  if (!secrets.length || !body || typeof body !== 'object' || Array.isArray(body)) return body;
  const b = { ...(body as Record<string, unknown>) };
  if ('error' in b) b.error = scrubSecrets(b.error, secrets);
  if (Array.isArray(b.choices)) {
    b.choices = b.choices.map((c: unknown) =>
      c && typeof c === 'object' && 'error' in c ? { ...(c as Record<string, unknown>), error: scrubSecrets((c as { error: unknown }).error, secrets) } : c,
    );
  }
  return b;
}

/**
 * fetch() throws a TypeError for header values outside ISO-8859-1, which would look like a
 * network failure (and be retried). A key with "…" (pasted from the masked display) or a
 * zero-width character is a key problem: report it as such, without the key.
 */
function checkHeaders(opts: SendOptions): void {
  for (const [k, v] of Object.entries(opts.headers)) {
    if (/^[ -~]*$/.test(v)) continue;
    if (SECRET_HEADERS.has(k.toLowerCase())) {
      throw new AiError(
        'bad-key',
        `API key của ${opts.ctx.label} chứa ký tự không hợp lệ (có thể bạn đã dán key bị che "…" hoặc có ký tự ẩn). Dán lại key đầy đủ trong Cài đặt → AI.`,
        { provider: opts.ctx.kind, retryable: false },
      );
    }
    throw new AiError('bad-request', `Không gửi được yêu cầu tới ${opts.ctx.label}: header "${k}" chứa ký tự không hợp lệ.`, { provider: opts.ctx.kind, retryable: false });
  }
}

async function doFetch(opts: SendOptions): Promise<Response> {
  checkHeaders(opts);
  const init: RequestInit = {
    method: opts.method ?? (opts.body === undefined ? 'GET' : 'POST'),
    headers: opts.headers,
    signal: opts.signal,
    // Never send cookies to providers; no referrer details beyond the origin.
    credentials: 'omit',
    referrerPolicy: 'strict-origin',
  };
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body);
  try {
    return await fetch(opts.url, init);
  } catch (e) {
    throw mapFetchFailure(e, opts.signal, opts.ctx, opts.fetchFailCode ?? 'network');
  }
}

async function readBody(res: Response, signal: AbortSignal | undefined, ctx: CallContext): Promise<unknown> {
  let text: string;
  try {
    text = await res.text();
  } catch (e) {
    throw mapFetchFailure(e, signal, ctx, 'network');
  }
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text.slice(0, 2000);
  }
}

/** One JSON call. Resolves with the parsed body of a 2xx response; throws AiError otherwise. */
export async function sendJson(opts: SendOptions): Promise<JsonResponse> {
  const res = await doFetch(opts);
  const raw = await readBody(res, opts.signal, opts.ctx);
  const secrets = secretsOf(opts.headers);
  if (!res.ok) throw opts.mapError(res.status, scrubSecrets(raw, secrets), res.headers, opts.ctx);
  return { status: res.status, body: scrubErrorParts(raw, secrets), headers: res.headers };
}

/** One call whose 2xx body is binary (audio). Error bodies are still parsed as JSON for mapping. */
export async function sendForBlob(opts: SendOptions): Promise<{ blob: Blob; mime: string }> {
  const res = await doFetch(opts);
  if (!res.ok) {
    const body = scrubSecrets(await readBody(res, opts.signal, opts.ctx), secretsOf(opts.headers));
    throw opts.mapError(res.status, body, res.headers, opts.ctx);
  }
  try {
    const blob = await res.blob();
    return { blob, mime: res.headers.get('content-type')?.split(';')[0].trim() || blob.type || 'application/octet-stream' };
  } catch (e) {
    throw mapFetchFailure(e, opts.signal, opts.ctx, 'network');
  }
}

/** Retry-After (delta-seconds or HTTP-date) or retry-after-ms → milliseconds. */
export function parseRetryAfter(headers: Headers | undefined, now = Date.now()): number | undefined {
  if (!headers) return undefined;
  const ms = headers.get('retry-after-ms');
  if (ms && /^\d+(\.\d+)?$/.test(ms.trim())) return Math.round(Number(ms));
  const v = headers.get('retry-after')?.trim();
  if (!v) return undefined;
  if (/^\d+(\.\d+)?$/.test(v)) return Math.round(Number(v) * 1000);
  const at = Date.parse(v);
  if (Number.isNaN(at)) return undefined;
  return Math.max(0, at - now);
}

/**
 * Wait hint inside an error message, e.g. OpenAI's "Please try again in 20s" / "in 1.2s" /
 * "in 120ms" / "in 1m30s". Needed because OpenAI and OpenRouter do NOT expose Retry-After to
 * browsers (Access-Control-Expose-Headers lists only CF-Ray / a few x-openrouter-* headers), so
 * headers.get('retry-after') is always null there outside tests.
 */
export function parseRetryHint(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const m = /(?:try again|retry) (?:in|after) ((?:\d+(?:\.\d+)?\s*(?:ms|h|m|s)\s*)+)/i.exec(text);
  if (!m) return undefined;
  const unit: Record<string, number> = { ms: 1, s: 1000, m: 60_000, h: 3_600_000 };
  let total = 0;
  for (const part of m[1].matchAll(/(\d+(?:\.\d+)?)\s*(ms|h|m|s)/gi)) total += Number(part[1]) * unit[part[2].toLowerCase()];
  return total > 0 ? Math.round(total) : undefined;
}

/** Provider error text from the usual shapes ({error:{message}}, {error:"…"}, {message}, plain text), redacted and trimmed. */
export function providerMessage(body: unknown): string | undefined {
  let msg: unknown;
  if (typeof body === 'string') msg = body;
  else if (body && typeof body === 'object') {
    const b = body as { error?: unknown; message?: unknown };
    if (typeof b.error === 'string') msg = b.error;
    else if (b.error && typeof b.error === 'object') msg = (b.error as { message?: unknown }).message;
    if (msg == null) msg = b.message;
  }
  if (typeof msg !== 'string' || !msg.trim()) return undefined;
  return redactSecrets(msg.replace(/\s+/g, ' ').trim()).slice(0, 300);
}

/** Fallback mapping by HTTP status, used by adapters after their provider-specific rules. */
export function mapCommonStatus(status: number, ctx: CallContext, detail: string | undefined, retryAfterMs?: number): AiError {
  const c = { ...ctx, provider: ctx.kind, status, detail, retryAfterMs };
  if (status === 401 || status === 403) return makeError('bad-key', c);
  if (status === 402) return makeError('quota', c);
  if (status === 404) return makeError('model', c);
  if (status === 408) return makeError('server', c, { retryable: true });
  if (status === 429) return makeError('rate-limit', c);
  if (status >= 500) return makeError('server', c);
  return makeError('bad-request', c);
}

/** Joins a base URL and a path segment. */
export function joinUrl(base: string, path: string): string {
  return base.replace(/\/+$/, '') + '/' + path.replace(/^\/+/, '');
}
