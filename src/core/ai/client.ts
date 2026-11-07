// High-level AI API used by features. Picks the provider, applies timeouts, retries transient
// failures (429/5xx/network, max 2, exponential backoff + jitter, honoring Retry-After), validates
// JSON (one automatic repair round), caches speech, counts usage. Every failure is an AiError
// with a Vietnamese message that never contains the API key.

import { loadAiConfig, maskKey, subscribeAiConfig } from './config';
import { DEFAULT_TTS_STYLE, defaultsFor } from './defaults';
import { AiError, isAiError, makeError, messageFor, registerSecret, TRUNCATED_DETAIL } from './errors';
import { TIMEOUT_REASON } from './http';
import { capabilitiesOf, getAdapter } from './registry';
import { parseJsonLoose, toObjectRoot, validateJson } from './schema';
import { createMemoryTtsCache, createTtsCache, ttsCacheKey, type CachedAudio, type TtsCache } from './ttsCache';
import type { AiConfig, Capabilities, ChatMessage, JsonSchema, ModelInfo, ProviderConfig, TestResult, TextRequest, TextResult, TtsResult } from './types';
import { isOverDailyCap, recordAiUsage, subscribeAiUsage } from './usage';
import { wavDurationSec } from './wav';

export const DEFAULT_TEXT_TIMEOUT_MS = 30_000;
export const DEFAULT_TTS_TIMEOUT_MS = 60_000;
export const DEFAULT_TEST_TIMEOUT_MS = 15_000;
export const MAX_RETRIES = 2;
/** A server asking us to wait longer than this is reported to the user instead of silently waited for. */
export const MAX_RETRY_WAIT_MS = 20_000;
/** A TTS-cache read/write that takes longer than this is skipped (IndexedDB can hang: WebKit open bug, blocked upgrade). */
export const TTS_CACHE_OP_TIMEOUT_MS = 2_000;

export interface AiCallOptions {
  /** Provider id; default = AiConfig.defaultTextProvider / defaultTtsProvider, else the first usable one. */
  provider?: string;
  timeoutMs?: number;
  /** 0..2 (default 2). */
  retries?: number;
}

/** aiJson request: like TextRequest, but the schema may have any root (non-object roots are wrapped for the providers). */
export type AiJsonRequest = Omit<TextRequest, 'json'> & { json: { schema: JsonSchema; name: string } };

export interface AiJsonOptions extends AiCallOptions {
  /** Extra semantic check after schema validation: return a problem description (English, sent to the model on repair) or null/undefined when OK. */
  validate?: (value: unknown) => string | null | undefined;
}

export interface AiSpeakOptions extends AiCallOptions {
  voice?: string;
  style?: string;
  signal?: AbortSignal;
  /** Default true: reuse/store audio in the TTS cache. */
  useCache?: boolean;
}

export interface AiSpeakResult {
  audio: Blob;
  mime: string;
  cached: boolean;
  providerId: string;
}

export interface ProviderSummary {
  id: string;
  kind: ProviderConfig['kind'];
  label: string;
  model: string;
  ttsModel?: string;
  ttsVoice?: string;
  enabled: boolean;
  hasKey: boolean;
  keyMasked: string;
  capabilities: Capabilities;
  /** Enabled, has a key when needed, and a model. */
  usable: boolean;
}

export interface AiStatus {
  /** At least one usable text provider. */
  configured: boolean;
  text: ProviderSummary | null;
  tts: ProviderSummary | null;
  providers: ProviderSummary[];
  dailyRequestCap?: number;
  overDailyCap: boolean;
}

// ---- runtime (overridable in tests) ----

interface Runtime {
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  random: () => number;
  cache: TtsCache | null;
  cacheTimeoutMs: number;
}

function defaultSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortedError());
    const t = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(t);
      reject(abortedError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

const runtime: Runtime = { sleep: defaultSleep, random: Math.random, cache: null, cacheTimeoutMs: TTS_CACHE_OP_TIMEOUT_MS };

/** Test hook: replace sleep/random/cache/cache timeout. */
export function _setAiRuntimeForTests(patch: Partial<Runtime>): void {
  Object.assign(runtime, patch);
}

export function getTtsCache(): TtsCache {
  return (runtime.cache ??= createTtsCache());
}

export async function clearTtsCache(): Promise<void> {
  await getTtsCache().clear();
}

function abortedError(): AiError {
  return new AiError('aborted', messageFor('aborted', { label: 'AI' }), { retryable: false });
}

// ---- provider resolution ----

function isUsable(p: ProviderConfig, purpose: 'text' | 'tts'): boolean {
  if (!p.enabled) return false;
  if (defaultsFor(p.kind).requiresKey && !p.apiKey) return false;
  const caps = capabilitiesOf(p);
  if (purpose === 'text') return caps.text && !!p.model.trim();
  return caps.tts;
}

function pickProvider(config: AiConfig, purpose: 'text' | 'tts', id?: string): ProviderConfig | null {
  const usable = (p: ProviderConfig | undefined): p is ProviderConfig => !!p && isUsable(p, purpose);
  if (id) {
    const p = config.providers.find((x) => x.id === id);
    return usable(p) ? p : null;
  }
  const preferred = config.providers.find((x) => x.id === (purpose === 'text' ? config.defaultTextProvider : config.defaultTtsProvider));
  if (usable(preferred)) return preferred;
  return config.providers.find((p) => usable(p)) ?? null;
}

function resolveProvider(purpose: 'text' | 'tts', id?: string): ProviderConfig {
  const config = loadAiConfig();
  const p = pickProvider(config, purpose, id);
  if (p) return p;
  const named = id ? config.providers.find((x) => x.id === id) : undefined;
  if (named) {
    const why = !named.enabled
      ? 'đang bị tắt'
      : defaultsFor(named.kind).requiresKey && !named.apiKey
        ? 'chưa có API key'
        : purpose === 'tts'
          ? 'không hỗ trợ đọc thành giọng nói'
          : 'chưa chọn model';
    throw new AiError('no-provider', `Nhà cung cấp AI "${named.label}" ${why}. Kiểm tra trong Cài đặt → AI.`, { provider: named.kind, retryable: false });
  }
  if (purpose === 'tts' && config.providers.some((x) => isUsable(x, 'text'))) {
    throw new AiError('no-provider', 'Chưa có nhà cung cấp AI nào hỗ trợ đọc thành giọng nói (ví dụ Gemini hoặc OpenAI). Thêm trong Cài đặt → AI.', { retryable: false });
  }
  throw new AiError('no-provider', messageFor('no-provider', { label: 'AI' }), { retryable: false });
}

function checkDailyCap(): void {
  const cap = loadAiConfig().dailyRequestCap;
  if (isOverDailyCap(cap)) {
    throw new AiError('quota', `Đã đạt giới hạn ${cap} yêu cầu AI mỗi ngày mà bạn tự đặt trong Cài đặt → AI. Tăng giới hạn hoặc thử lại vào ngày mai.`, { retryable: false });
  }
}

// ---- timeout + retry ----

/** Runs fn with a signal that aborts on the outer signal or after timeoutMs (→ 'timeout'). Never waits past the deadline even if fn ignores the signal. */
export async function withTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, timeoutMs: number, outer: AbortSignal | undefined, p: ProviderConfig, model?: string): Promise<T> {
  const ctx = { label: p.label || defaultsFor(p.kind).label, provider: p.kind, model, timeoutMs };
  if (outer?.aborted) throw makeError('aborted', ctx, { retryable: false });
  const ctrl = new AbortController();
  let rejectRace: (e: AiError) => void = () => {};
  const race = new Promise<never>((_, reject) => {
    rejectRace = reject;
  });
  const onOuter = () => {
    ctrl.abort(outer?.reason);
    rejectRace(makeError('aborted', ctx, { retryable: false }));
  };
  outer?.addEventListener('abort', onOuter, { once: true });
  const timer = setTimeout(() => {
    ctrl.abort(TIMEOUT_REASON);
    rejectRace(makeError('timeout', ctx, { retryable: false }));
  }, timeoutMs);
  try {
    return await Promise.race([fn(ctrl.signal), race]);
  } catch (e) {
    if (isAiError(e)) throw e;
    if (ctrl.signal.aborted) {
      throw ctrl.signal.reason === TIMEOUT_REASON ? makeError('timeout', ctx, { retryable: false }) : makeError('aborted', ctx, { retryable: false });
    }
    // Unexpected (bug in an adapter): never forward the raw error, it might carry request details.
    throw makeError('bad-response', ctx, { retryable: false });
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', onOuter);
  }
}

export function backoffMs(attempt: number, random: () => number = runtime.random): number {
  return Math.min(8000, 800 * 2 ** attempt) + Math.floor(random() * 400);
}

/** Retries retryable AiErrors up to `retries` times; honors retryAfterMs up to MAX_RETRY_WAIT_MS. */
export async function withRetry<T>(attemptFn: () => Promise<T>, retries: number, signal?: AbortSignal): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await attemptFn();
    } catch (e) {
      if (!isAiError(e) || !e.retryable || attempt >= retries || signal?.aborted) throw e;
      const wait = e.retryAfterMs ?? backoffMs(attempt);
      if (wait > MAX_RETRY_WAIT_MS) throw e;
      await runtime.sleep(wait, signal);
    }
  }
}

function clampRetries(n: number | undefined): number {
  return Math.max(0, Math.min(MAX_RETRIES, n ?? MAX_RETRIES));
}

// ---- public API ----

/** Free text (or raw JSON text when req.json is set; prefer aiJson for that). */
export async function aiText(req: TextRequest, opts: AiCallOptions = {}): Promise<TextResult> {
  const p = resolveProvider('text', opts.provider);
  checkDailyCap();
  const adapter = getAdapter(p.kind);
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TEXT_TIMEOUT_MS;
  try {
    const result = await withRetry(
      () => withTimeout((signal) => adapter.generateText(p, { ...req, signal }), timeoutMs, req.signal, p, p.model),
      clampRetries(opts.retries),
      req.signal,
    );
    recordAiUsage(p.id, { requests: 1, inputTokens: result.usage?.inputTokens ?? 0, outputTokens: result.usage?.outputTokens ?? 0 });
    return result;
  } catch (e) {
    if (!(isAiError(e) && e.code === 'aborted')) recordAiUsage(p.id, { errors: 1 });
    throw e;
  }
}

function problemsOf(value: unknown, schema: JsonSchema, validate?: AiJsonOptions['validate']): string[] {
  if (value === undefined) return ['the reply was not parseable JSON'];
  const errs = validateJson(value, schema);
  if (!errs.length && validate) {
    const extra = validate(value);
    if (extra) errs.push(extra);
  }
  return errs;
}

function truncatedError(p: ProviderConfig): AiError {
  return makeError('bad-response', { label: p.label || defaultsFor(p.kind).label, provider: p.kind, detail: TRUNCATED_DETAIL }, { retryable: false });
}

/**
 * Structured output: parsed + validated against req.json.schema (+ opts.validate), with one
 * automatic repair round. Any root type works: a non-object root is sent as {value: …} and
 * unwrapped. An answer cut off by maxTokens is reported at once (a repair would be cut off too).
 */
export async function aiJson<T>(req: AiJsonRequest, opts: AiJsonOptions = {}): Promise<T> {
  const original = req.json.schema;
  const root = toObjectRoot(original);
  const wire: TextRequest = { ...req, json: { name: req.json.name, schema: root.schema } };
  const first = await aiText(wire, opts);
  if (first.truncated) throw truncatedError(resolveProvider('text', opts.provider));
  const raw1 = first.json ?? parseJsonLoose(first.text);
  const v1 = raw1 === undefined ? undefined : root.unwrap(raw1);
  const errs1 = problemsOf(v1, original, opts.validate);
  if (!errs1.length) return v1 as T;

  const repairMessages: ChatMessage[] = [
    ...req.messages,
    { role: 'assistant', content: first.text.slice(0, 8000) },
    {
      role: 'user',
      content:
        'Your previous reply did not satisfy the required JSON Schema. Problems:\n- ' +
        errs1.slice(0, 10).join('\n- ') +
        '\nReply again with ONLY the corrected JSON value, nothing else.',
    },
  ];
  const second = await aiText({ ...wire, messages: repairMessages }, opts);
  if (second.truncated) throw truncatedError(resolveProvider('text', opts.provider));
  const raw2 = second.json ?? parseJsonLoose(second.text);
  const v2 = raw2 === undefined ? undefined : root.unwrap(raw2);
  const errs2 = problemsOf(v2, original, opts.validate);
  if (!errs2.length) return v2 as T;
  const p = resolveProvider('text', opts.provider);
  throw makeError('bad-response', { label: p.label, provider: p.kind, detail: `JSON không hợp lệ: ${errs2.slice(0, 3).join('; ')}` }, { retryable: false });
}

const CACHE_TIMEOUT = Symbol('cache-timeout');

/**
 * Runs a cache operation with a deadline and the caller's signal. A cache that hangs is treated
 * as a miss and replaced by an in-memory cache for the rest of the session; an abort rejects.
 */
async function cacheOp<T>(op: (c: TtsCache) => Promise<T>, signal: AbortSignal | undefined, p: ProviderConfig): Promise<T | undefined> {
  let cache: TtsCache;
  try {
    cache = getTtsCache();
  } catch {
    return undefined;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  try {
    const result = await Promise.race<T | typeof CACHE_TIMEOUT>([
      op(cache),
      new Promise<typeof CACHE_TIMEOUT>((resolve) => {
        timer = setTimeout(() => resolve(CACHE_TIMEOUT), runtime.cacheTimeoutMs);
      }),
      new Promise<never>((_, reject) => {
        if (!signal) return;
        onAbort = () => reject(makeError('aborted', { label: p.label, provider: p.kind }, { retryable: false }));
        if (signal.aborted) onAbort();
        else signal.addEventListener('abort', onAbort, { once: true });
      }),
    ]);
    if (result === CACHE_TIMEOUT) {
      if (runtime.cache === cache && cache.backend !== 'memory') runtime.cache = createMemoryTtsCache();
      return undefined;
    }
    return result;
  } catch (e) {
    if (isAiError(e) && e.code === 'aborted') throw e;
    return undefined; // cache problems never block speech
  } finally {
    clearTimeout(timer);
    if (onAbort) signal?.removeEventListener('abort', onAbort);
  }
}

/** A clip smaller than this is no audio at all. */
export const MIN_CLIP_BYTES = 200;
/** A WAV clip must last at least this long, and at least MIN_CLIP_SEC_PER_WORD per word of the text. */
export const MIN_CLIP_SEC = 0.2;
export const MIN_CLIP_SEC_PER_WORD = 0.08;

/**
 * Why a generated clip is unusable (empty or far too short for its text), or null. Such a clip is never cached:
 * it would replay as silence on every later click.
 */
export async function clipProblem(res: TtsResult, text: string): Promise<string | null> {
  if (!res.audio || res.audio.size < MIN_CLIP_BYTES) return 'đoạn âm thanh rỗng';
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await res.audio.arrayBuffer());
  } catch {
    return null;
  }
  const dur = wavDurationSec(bytes);
  if (dur === null) return null;
  const words = text.split(/\s+/).filter(Boolean).length;
  return dur < Math.max(MIN_CLIP_SEC, words * MIN_CLIP_SEC_PER_WORD) ? 'đoạn âm thanh quá ngắn so với câu' : null;
}

/** Shared in-flight synthesis, so concurrent identical requests (double click, StrictMode) pay once. */
interface Flight {
  promise: Promise<TtsResult>;
  ctrl: AbortController;
  waiters: number;
}
const flights = new Map<string, Flight>();

/** Waits for a flight on behalf of one caller; the flight is aborted only when every caller gave up. */
function joinFlight(flight: Flight, signal: AbortSignal | undefined, p: ProviderConfig): Promise<TtsResult> {
  flight.waiters++;
  return new Promise<TtsResult>((resolve, reject) => {
    let done = false;
    const leave = () => {
      if (done) return false;
      done = true;
      flight.waiters--;
      if (signal) signal.removeEventListener('abort', onAbort);
      return true;
    };
    const onAbort = () => {
      if (!leave()) return;
      if (flight.waiters <= 0) flight.ctrl.abort();
      reject(makeError('aborted', { label: p.label, provider: p.kind }, { retryable: false }));
    };
    if (signal?.aborted) return onAbort();
    signal?.addEventListener('abort', onAbort, { once: true });
    flight.promise.then(
      (r) => leave() && resolve(r),
      (e) => leave() && reject(e),
    );
  });
}

/** Text → speech through the TTS provider, served from the cache when the same clip was made before. */
export async function aiSpeak(text: string, opts: AiSpeakOptions = {}): Promise<AiSpeakResult> {
  const clean = text.trim();
  if (!clean) throw new AiError('bad-request', 'Không có nội dung để đọc.', { retryable: false });
  const p = resolveProvider('tts', opts.provider);
  if (opts.signal?.aborted) throw makeError('aborted', { label: p.label, provider: p.kind }, { retryable: false });
  const d = defaultsFor(p.kind);
  const model = p.ttsModel || d.ttsModel || '';
  const voice = opts.voice || p.ttsVoice || d.ttsVoice || '';
  const style = opts.style?.trim() || DEFAULT_TTS_STYLE;
  const useCache = opts.useCache !== false;
  const { key, fullKey } = ttsCacheKey({ kind: p.kind, model, voice, style, text: clean });

  if (useCache) {
    const hit: CachedAudio | undefined = await cacheOp((c) => c.get(key, fullKey), opts.signal, p);
    if (hit) {
      recordAiUsage(p.id, { cacheHits: 1 });
      return { ...hit, cached: true, providerId: p.id };
    }
  }

  const flightKey = `${p.id}\u0000${fullKey}`;
  let flight = flights.get(flightKey);
  if (!flight) {
    checkDailyCap();
    const tts = getAdapter(p.kind).tts;
    if (!tts) throw new AiError('no-provider', `${p.label} không hỗ trợ đọc thành giọng nói.`, { provider: p.kind, retryable: false });
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TTS_TIMEOUT_MS;
    const ctrl = new AbortController();
    const run = async (): Promise<TtsResult> => {
      try {
        const res = await withRetry(
          () => withTimeout((signal) => tts(p, { text: clean, voice, style, signal }), timeoutMs, ctrl.signal, p, model),
          clampRetries(opts.retries),
          ctrl.signal,
        );
        recordAiUsage(p.id, { requests: 1, ttsChars: clean.length });
        const bad = await clipProblem(res, clean);
        if (bad) throw makeError('bad-response', { label: p.label || d.label, provider: p.kind, detail: bad }, { retryable: false });
        if (useCache) await cacheOp((c) => c.put(key, fullKey, res), undefined, p);
        return res;
      } catch (e) {
        if (!(isAiError(e) && e.code === 'aborted')) recordAiUsage(p.id, { errors: 1 });
        throw e;
      } finally {
        flights.delete(flightKey);
      }
    };
    flight = { promise: run(), ctrl, waiters: 0 };
    flight.promise.catch(() => undefined); // rejections are delivered to the waiters
    flights.set(flightKey, flight);
  }
  const res = await joinFlight(flight, opts.signal, p);
  return { ...res, cached: false, providerId: p.id };
}

function summarize(p: ProviderConfig): ProviderSummary {
  return {
    id: p.id,
    kind: p.kind,
    label: p.label,
    model: p.model,
    ttsModel: p.ttsModel,
    ttsVoice: p.ttsVoice,
    enabled: p.enabled,
    hasKey: !!p.apiKey,
    keyMasked: maskKey(p.apiKey),
    capabilities: capabilitiesOf(p),
    usable: isUsable(p, 'text'),
  };
}

/** Snapshot for UI: is AI configured, which provider serves text / speech. Never contains keys (only masked). */
export function aiStatus(): AiStatus {
  const config = loadAiConfig();
  const text = pickProvider(config, 'text');
  const tts = pickProvider(config, 'tts');
  return {
    configured: !!text,
    text: text ? summarize(text) : null,
    tts: tts ? summarize(tts) : null,
    providers: config.providers.map(summarize),
    dailyRequestCap: config.dailyRequestCap,
    overDailyCap: isOverDailyCap(config.dailyRequestCap),
  };
}

function targetConfig(target: string | ProviderConfig): ProviderConfig | null {
  // An unsaved config from the settings form: register its key for redaction too (http.ts also
  // scrubs each request's own key from error bodies, whatever its length or format).
  const p = typeof target !== 'string' ? target : (loadAiConfig().providers.find((x) => x.id === target) ?? null);
  if (p) registerSecret(p.apiKey);
  return p;
}

/** "Kiểm tra kết nối" button. Never throws. Accepts an unsaved config (from the settings form). */
export async function testProvider(target: string | ProviderConfig, signal?: AbortSignal): Promise<TestResult> {
  const p = targetConfig(target);
  if (!p) return { ok: false, code: 'no-provider', message: 'Không tìm thấy nhà cung cấp AI này.' };
  try {
    return await withTimeout((s) => getAdapter(p.kind).testConnection(p, s), DEFAULT_TEST_TIMEOUT_MS, signal, p, p.model);
  } catch (e) {
    if (isAiError(e)) return { ok: false, code: e.code, message: e.message };
    return { ok: false, code: 'network', message: messageFor('network', { label: p.label }) };
  }
}

/** Models the provider offers (for a picker). Throws AiError. */
export async function listProviderModels(target: string | ProviderConfig, signal?: AbortSignal): Promise<ModelInfo[]> {
  const p = targetConfig(target);
  if (!p) throw new AiError('no-provider', 'Không tìm thấy nhà cung cấp AI này.', { retryable: false });
  const list = getAdapter(p.kind).listModels;
  if (!list) return [];
  return withRetry(() => withTimeout((s) => list(p, s), DEFAULT_TEXT_TIMEOUT_MS, signal, p), 1, signal);
}

let version = 0;
const versionListeners = new Set<() => void>();
let wired = false;

function wire(): void {
  if (wired) return;
  wired = true;
  const bump = () => {
    version++;
    for (const fn of versionListeners) {
      try {
        fn();
      } catch {
        // ignore
      }
    }
  };
  subscribeAiConfig(bump);
  subscribeAiUsage(bump);
}

/** Notified on any AI config change (this tab or another) or usage change. Returns unsubscribe. */
export function subscribeAi(fn: () => void): () => void {
  wire();
  versionListeners.add(fn);
  return () => {
    versionListeners.delete(fn);
  };
}

/** Monotonic counter bumped on every change subscribeAi reports (useSyncExternalStore snapshot). */
export function aiVersion(): number {
  wire();
  return version;
}

