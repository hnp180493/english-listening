// AI provider configuration, stored DEVICE-LOCALLY (see deviceStorage.ts). It must never be synced
// to the shared folder or exported in backups: it holds API keys.

import { PROVIDER_DEFAULTS } from './defaults';
import { loadDevice, onDeviceStorageChange, removeDevice, saveDevice } from './deviceStorage';
import { registerSecret } from './errors';
import type { AiConfig, ProviderConfig, ProviderKind } from './types';

export const AI_CONFIG_KEY = 'ai-config';
export const AI_USAGE_KEY = 'ai-usage';
/** Short keys that are device-local: sync and backup must skip them (they are also under a separate prefix). */
export const AI_DEVICE_LOCAL_KEYS = [AI_CONFIG_KEY, AI_USAGE_KEY] as const;

export const PROVIDER_KINDS: readonly ProviderKind[] = ['gemini', 'openai', 'anthropic', 'openrouter', 'openai-compatible'];
const MAX_PROVIDERS = 20;

export function emptyAiConfig(): AiConfig {
  return { v: 1, providers: [] };
}

function str(v: unknown, max = 500): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/**
 * Removes whitespace and invisible format characters (zero-width space/joiners, BOM, soft hyphen,
 * bidi marks: \p{Cf}) that keys pasted from web pages often carry. Other non-ASCII characters
 * (e.g. the "…" of a masked key pasted back) are kept so the UI can flag them (keyLooksWrong) and
 * http.ts reports them as 'bad-key' instead of a confusing network error.
 */
export function cleanKey(v: unknown): string {
  return typeof v === 'string' ? v.replace(/[\s\p{Cf}]+/gu, '').slice(0, 512) : '';
}

/** Provider ids: short, URL/attribute-safe, never a prototype-polluting name. */
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const RESERVED_IDS = new Set(['__proto__', 'constructor', 'prototype']);

export function isValidProviderId(id: string): boolean {
  return ID_RE.test(id) && !RESERVED_IDS.has(id);
}

function cleanUrl(v: unknown): string | undefined {
  const s = str(v, 500);
  if (!s) return undefined;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return undefined;
    if (u.username || u.password || u.search || u.hash) return undefined; // no credentials/query in base URLs
    return s.replace(/\/+$/, '');
  } catch {
    return undefined;
  }
}

export function newProviderId(): string {
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  try {
    if (c?.randomUUID) return 'p-' + c.randomUUID().slice(0, 8);
  } catch {
    // insecure context (file://) may lack randomUUID
  }
  return 'p-' + Math.random().toString(36).slice(2, 10);
}

/**
 * Validates a stored/imported object into a well-formed AiConfig (drops unknown kinds, fixes
 * defaults). Invalid, reserved or duplicate ids are replaced DETERMINISTICALLY (from kind and
 * position), so sanitizing the same input twice gives the same ids (idempotent).
 */
export function sanitizeAiConfig(raw: unknown): AiConfig {
  if (!raw || typeof raw !== 'object') return emptyAiConfig();
  const r = raw as Record<string, unknown>;
  const providers: ProviderConfig[] = [];
  const seen = new Set<string>();
  const list = Array.isArray(r.providers) ? r.providers : [];
  for (const item of list) {
    if (providers.length >= MAX_PROVIDERS) break;
    if (!item || typeof item !== 'object') continue;
    const p = item as Record<string, unknown>;
    const kind = p.kind as ProviderKind;
    if (!PROVIDER_KINDS.includes(kind)) continue;
    const d = PROVIDER_DEFAULTS[kind];
    let id = str(p.id, 64);
    if (!isValidProviderId(id) || seen.has(id)) {
      const declared = list.map((x) => (x && typeof x === 'object' ? str((x as { id?: unknown }).id, 64) : ''));
      let n = providers.length + 1;
      do id = `p-${kind}-${n++}`;
      while (seen.has(id) || declared.includes(id));
    }
    seen.add(id);
    const cfg: ProviderConfig = {
      id,
      kind,
      label: str(p.label, 80) || d.label,
      apiKey: cleanKey(p.apiKey),
      model: str(p.model, 200) || d.model,
      enabled: typeof p.enabled === 'boolean' ? p.enabled : true,
    };
    const baseUrl = cleanUrl(p.baseUrl);
    if (baseUrl) cfg.baseUrl = baseUrl;
    else if (d.requiresBaseUrl) cfg.baseUrl = d.baseUrl;
    const ttsModel = str(p.ttsModel, 200) || d.ttsModel;
    if (ttsModel) cfg.ttsModel = ttsModel;
    const ttsVoice = str(p.ttsVoice, 100) || d.ttsVoice;
    if (ttsVoice) cfg.ttsVoice = ttsVoice;
    providers.push(cfg);
  }
  const out: AiConfig = { v: 1, providers };
  const ids = new Set(providers.map((p) => p.id));
  const dt = str(r.defaultTextProvider, 64);
  if (dt && ids.has(dt)) out.defaultTextProvider = dt;
  const dtts = str(r.defaultTtsProvider, 64);
  if (dtts && ids.has(dtts)) out.defaultTtsProvider = dtts;
  const cap = r.dailyRequestCap;
  if (typeof cap === 'number' && Number.isFinite(cap) && cap >= 1) out.dailyRequestCap = Math.min(100000, Math.floor(cap));
  return out;
}

let cache: AiConfig | null = null;
const listeners = new Set<() => void>();
let storageUnsub: (() => void) | null = null;

function notify(): void {
  for (const fn of listeners) {
    try {
      fn();
    } catch {
      // a listener must never break a save
    }
  }
}

function ensureStorageListener(): void {
  if (storageUnsub) return;
  storageUnsub = onDeviceStorageChange((key) => {
    if (key === AI_CONFIG_KEY || key === '*') {
      cache = null;
      notify();
    }
  });
}

/** Current config (memoized; refreshed after saves and changes from other tabs). */
export function loadAiConfig(): AiConfig {
  ensureStorageListener();
  if (!cache) {
    const raw = loadDevice<unknown>(AI_CONFIG_KEY, null);
    cache = sanitizeAiConfig(raw);
    for (const p of cache.providers) registerSecret(p.apiKey);
    // Persist repairs (e.g. replaced ids) so ids stay stable for usage history and other tabs.
    if (raw != null && JSON.stringify(raw) !== JSON.stringify(cache)) saveDevice(AI_CONFIG_KEY, cache);
  }
  return cache;
}

/** Saves (after sanitizing) and notifies subscribers. Returns the stored config and whether the write persisted. */
export function saveAiConfig(next: AiConfig): { config: AiConfig; persisted: boolean } {
  const config = sanitizeAiConfig(next);
  for (const p of config.providers) registerSecret(p.apiKey);
  const persisted = saveDevice(AI_CONFIG_KEY, config);
  cache = config;
  notify();
  return { config, persisted };
}

export function updateAiConfig(fn: (current: AiConfig) => AiConfig): AiConfig {
  return saveAiConfig(fn(loadAiConfig())).config;
}

/** A new provider entry with the kind's defaults (not saved). */
export function createProviderConfig(kind: ProviderKind, patch: Partial<Omit<ProviderConfig, 'kind'>> = {}): ProviderConfig {
  const d = PROVIDER_DEFAULTS[kind];
  const p: ProviderConfig = {
    id: patch.id && isValidProviderId(patch.id) ? patch.id : newProviderId(),
    kind,
    label: patch.label || d.label,
    apiKey: cleanKey(patch.apiKey),
    model: patch.model || d.model,
    enabled: patch.enabled ?? true,
  };
  const baseUrl = patch.baseUrl ?? (d.requiresBaseUrl ? d.baseUrl : undefined);
  if (baseUrl) p.baseUrl = baseUrl;
  const ttsModel = patch.ttsModel ?? d.ttsModel;
  if (ttsModel) p.ttsModel = ttsModel;
  const ttsVoice = patch.ttsVoice ?? d.ttsVoice;
  if (ttsVoice) p.ttsVoice = ttsVoice;
  return p;
}

/**
 * Adds or replaces (by id) a provider; the first provider becomes the default for text (and TTS if capable).
 * Gemini is the preferred voice (the owner compared Windows, OpenAI and Gemini by ear and chose Gemini): a newly
 * added Gemini provider takes over the TTS default unless another Gemini provider already holds it. The learner
 * can still pick another voice provider in Settings afterwards.
 */
export function upsertProvider(p: ProviderConfig): AiConfig {
  return updateAiConfig((c) => {
    const exists = c.providers.some((x) => x.id === p.id);
    const providers = exists ? c.providers.map((x) => (x.id === p.id ? p : x)) : [...c.providers, p];
    const next: AiConfig = { ...c, providers };
    if (!next.defaultTextProvider) next.defaultTextProvider = p.id;
    if (!next.defaultTtsProvider && PROVIDER_DEFAULTS[p.kind].ttsModel) next.defaultTtsProvider = p.id;
    if (!exists && p.kind === 'gemini') {
      const current = providers.find((x) => x.id === next.defaultTtsProvider);
      if (!current || current.kind !== 'gemini') next.defaultTtsProvider = p.id;
    }
    return next;
  });
}

export function removeProvider(id: string): AiConfig {
  return updateAiConfig((c) => ({ ...c, providers: c.providers.filter((p) => p.id !== id) }));
}

export function setDefaultProvider(purpose: 'text' | 'tts', id: string | undefined): AiConfig {
  return updateAiConfig((c) => (purpose === 'text' ? { ...c, defaultTextProvider: id } : { ...c, defaultTtsProvider: id }));
}

export function getProvider(id: string): ProviderConfig | undefined {
  return loadAiConfig().providers.find((p) => p.id === id);
}

/** Subscribe to config changes (this tab and other tabs). Returns unsubscribe. */
export function subscribeAiConfig(fn: () => void): () => void {
  ensureStorageListener();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** "AIzaSyD…k3Fq": first 4 + last 4 for display. Short keys are fully hidden. */
export function maskKey(key: string | undefined): string {
  const k = (key ?? '').trim();
  if (!k) return '';
  if (k.length < 12) return '••••';
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}

/** Wipes AI config and usage from this device (used by "xóa toàn bộ dữ liệu"). */
export function clearAiDeviceData(): void {
  for (const k of AI_DEVICE_LOCAL_KEYS) removeDevice(k);
  cache = null;
  notify();
}

/** Test hook: forget the memoized config. */
export function _resetAiConfigCache(): void {
  cache = null;
}
