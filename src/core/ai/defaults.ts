// Per-kind defaults: endpoints, sensible cheap/fast models, voices, key hints, where to get a key.
// Model ids checked against the official docs on 2026-11-06 (see docs/ai-providers.md).

import type { ProviderKind } from './types';

export interface ProviderDefaults {
  kind: ProviderKind;
  /** Human label shown in settings. */
  label: string;
  /** Base URL without trailing slash. '' when the user must provide one. */
  baseUrl: string;
  /** Cheap, fast, stable text model. '' when the user must choose (local servers). */
  model: string;
  ttsModel?: string;
  ttsVoice?: string;
  /** Prebuilt voices the UI can offer (provider may accept more). */
  voices?: readonly string[];
  /** Other models worth suggesting in a picker before listModels has run. */
  suggestedModels: readonly string[];
  suggestedTtsModels?: readonly string[];
  requiresKey: boolean;
  requiresBaseUrl: boolean;
  /** Vietnamese hint about the key format. */
  keyHint: string;
  /** Loose format check, used only for a warning ("key trông không giống key Gemini"), never to block. */
  keyPattern?: RegExp;
  /** Where to create a key. */
  keyUrl?: string;
  docsUrl: string;
}

/** Default delivery style for listening practice (used when aiSpeak gets no style). */
export const DEFAULT_TTS_STYLE = 'natural conversational American English, normal speed';

export const GEMINI_VOICES = [
  'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede', 'Callirrhoe', 'Autonoe',
  'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Algenib', 'Rasalgethi',
  'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Achird',
  'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat',
] as const;

export const OPENAI_VOICES = [
  'marin', 'cedar', 'alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer', 'verse',
] as const;

export const PROVIDER_DEFAULTS: Readonly<Record<ProviderKind, ProviderDefaults>> = {
  gemini: {
    kind: 'gemini',
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-3.6-flash',
    ttsModel: 'gemini-3.8-flash-tts',
    ttsVoice: 'Kore',
    voices: GEMINI_VOICES,
    suggestedModels: ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash'],
    suggestedTtsModels: ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'],
    requiresKey: true,
    requiresBaseUrl: false,
    keyHint: 'Key Gemini bắt đầu bằng "AIza" hoặc "AQ." (dạng key mới). Tạo trong Google AI Studio.',
    // Classic Google API keys (AIza + 35) and the newer AI Studio key format "AQ.<token>" (verified live 2026-11-07).
    keyPattern: /^(?:AIza[0-9A-Za-z_-]{35}|AQ\.[0-9A-Za-z_-]{20,})$/,
    keyUrl: 'https://aistudio.google.com/apikey',
    docsUrl: 'https://aistudio.google.com/docs',
  },
  openai: {
    kind: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-6-luna',
    // /v1/audio/speech models shut down 2027-01-06 (no successor on that endpoint): OpenAI then reports tts: false.
    ttsModel: 'gpt-4o-mini-tts',
    ttsVoice: 'marin',
    voices: OPENAI_VOICES,
    suggestedModels: ['gpt-6-luna', 'gpt-6.1-terra', 'gpt-6.1-sol'],
    suggestedTtsModels: ['gpt-4o-mini-tts'],
    requiresKey: true,
    requiresBaseUrl: false,
    keyHint: 'Key OpenAI bắt đầu bằng "sk-" (thường là "sk-proj-").',
    keyPattern: /^sk-[A-Za-z0-9_-]{20,}$/,
    keyUrl: 'https://platform.openai.com/api-keys',
    docsUrl: 'https://developers.openai.com/api/docs',
  },
  anthropic: {
    kind: 'anthropic',
    label: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-haiku-5-5',
    suggestedModels: ['claude-haiku-5-5', 'claude-sonnet-5-5'],
    requiresKey: true,
    requiresBaseUrl: false,
    keyHint: 'Key Claude bắt đầu bằng "sk-ant-api".',
    keyPattern: /^sk-ant-[A-Za-z0-9_-]{20,}$/,
    keyUrl: 'https://platform.claude.com/settings/keys',
    docsUrl: 'https://platform.claude.com/docs',
  },
  openrouter: {
    kind: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'google/gemini-3.6-flash',
    suggestedModels: ['google/gemini-3.6-flash', 'google/gemini-3.5-flash-lite', 'anthropic/claude-haiku-5.5', 'openai/gpt-6-luna'],
    requiresKey: true,
    requiresBaseUrl: false,
    keyHint: 'Key OpenRouter bắt đầu bằng "sk-or-v1-".',
    keyPattern: /^sk-or-[A-Za-z0-9_-]{20,}$/,
    keyUrl: 'https://openrouter.ai/settings/keys',
    docsUrl: 'https://openrouter.ai/docs',
  },
  'openai-compatible': {
    kind: 'openai-compatible',
    label: 'Máy chủ tương thích OpenAI',
    baseUrl: 'http://localhost:11434/v1',
    model: '',
    suggestedModels: [],
    requiresKey: false,
    requiresBaseUrl: true,
    keyHint: 'Không bắt buộc với máy chủ cục bộ (Ollama, LM Studio). Nhập nếu máy chủ yêu cầu.',
    docsUrl: 'https://github.com/ollama/ollama/blob/main/docs/openai.md',
  },
};

export function defaultsFor(kind: ProviderKind): ProviderDefaults {
  return PROVIDER_DEFAULTS[kind];
}

function isLoopbackHost(h: string): boolean {
  return h === 'localhost' || h.endsWith('.localhost') || h === '[::1]' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h);
}

function isPrivateLanHost(h: string): boolean {
  if (h.endsWith('.local')) return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(h);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  return a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

/**
 * Whether a base URL override may receive this provider's API key:
 * - always an http(s) URL without credentials, query or hash;
 * - this computer (localhost, 127.x, [::1]) for any kind: local servers and test mocks;
 * - cloud kinds (Gemini, OpenAI, Anthropic, OpenRouter): otherwise only their official https origin, so a tampered
 *   config can never redirect a real key to another host;
 * - 'openai-compatible': any https host, or plain http on the local network only (the key is not sent unencrypted
 *   over the internet).
 */
export function baseUrlAllowed(kind: ProviderKind, url: string): boolean {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return false;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  if (u.username || u.password || u.search || u.hash) return false;
  const host = u.hostname.toLowerCase();
  if (isLoopbackHost(host)) return true;
  if (kind === 'openai-compatible') return u.protocol === 'https:' || isPrivateLanHost(host);
  return u.origin === new URL(PROVIDER_DEFAULTS[kind].baseUrl).origin;
}

/** Base URL actually used for a config: its override when allowed (baseUrlAllowed), else the kind's default; no trailing slash. */
export function effectiveBaseUrl(kind: ProviderKind, baseUrl: string | undefined): string {
  const o = baseUrl?.trim();
  return (o && baseUrlAllowed(kind, o) ? o : PROVIDER_DEFAULTS[kind].baseUrl).replace(/\/+$/, '');
}

/**
 * True when `key` is non-empty and does not look like this kind's key (UI warning only). Any
 * character outside printable ASCII (e.g. the "…" of a masked key pasted back) is always wrong:
 * HTTP headers cannot carry it.
 */
export function keyLooksWrong(kind: ProviderKind, key: string): boolean {
  if (!key) return false;
  if (!/^[\x21-\x7e]+$/.test(key.trim())) return true;
  const re = PROVIDER_DEFAULTS[kind].keyPattern;
  return !!re && !re.test(key.trim());
}
