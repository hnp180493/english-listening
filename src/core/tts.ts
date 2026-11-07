// Text-to-speech for every playback in the app.
//
// Routes behind one speak(), tried in this order:
//  - shipped clip (Settings.voiceEngine 'clips', the default "Giọng Gemini có sẵn", or 'ai'): a Gemini (Kore)
//    clip generated once and shipped with the app in public/audio (or <portable folder>/audio), looked up by
//    audioKey(mode, exact text) in the manifest (./audioManifest); a playback without a mode looks up
//    audioKey('plain', text). No key, no request, no cost. It plays through the shared HTMLAudioElement at the
//    requested rate, pitch preserved. A text WITH a clip is never sent to the paid AI voice: when its file does
//    not load (skipped for a while, see audioManifest), or the manifest is unknown (slow / failed load: any text
//    may have a clip), it plays the browser voice, and CLIPS_NOTICE tells the learner once.
//  - AI voice (ONLY Settings.voiceEngine === 'ai', an explicit choice, AND a usable AI speech provider in Cài đặt
//    → AI): for texts known to have no clip, on the learner's click (auto playback only reuses a clip already made;
//    prefetchSpeech waits for a click). The clip comes from aiSpeak() (cached in IndexedDB, so replays are free)
//    and plays through one shared HTMLAudioElement (./audioPlayer). The rate maps to playbackRate (0.5–1.5,
//    pitch preserved). Any AI failure falls back to the browser voice for that playback and is reported once
//    through useVoiceStatus() ("Giọng AI lỗi, đang dùng giọng trình duyệt: …"). A circuit breaker keeps a failure
//    from being paid twice: for the whole AI voice (settings, quota until the next day, network, rate limit) or for
//    one text (unusable clip, safety block, 400). The default 'clips' never pays:
//    a text without a clip goes straight to the browser voice.
//  - browser voice: speechSynthesis ('browser' always). Natural/neural voices (Edge "Microsoft … Online
//    (Natural)", Chrome "Google US English") already produce fairly natural connected speech; we prefer them.
//
// No feature in the app uses speechSynthesis boundary events (word-by-word highlighting); dictation's
// chunk highlighting is per speak() call, so it works the same with AI audio. onStart fires when the
// clip actually starts playing (after generation), like the utterance's 'start' event.

import { useEffect, useState, useSyncExternalStore } from 'react';
import { AiError, aiSpeak, aiStatus, aiVersion, defaultsFor, isAiError, useAiVersion, type AiErrorCode, type ProviderKind, type ProviderSummary } from './ai';
import { clampClipRate, getClipPlayer } from './audioPlayer';
import { audioKey, type AudioClipMode } from './audioKey';
import {
  clipFileFor,
  clipsDisabled,
  clipUrl,
  hasShippedClip,
  loadAudioManifest,
  manifestUnavailable,
  peekAudioManifest,
  reportClipFailure,
  reportClipSuccess,
  type AudioManifest,
} from './audioManifest';
import { CAREFUL_STYLE, CONNECTED_STYLE, slowRate, type SpeechMode } from './playback';
import { getSettings, useSettings } from './settings';

// ───────────────────────────────────────────── browser voices

/** speechSynthesis is available (the browser voice). */
export function speechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Something can speak: the browser voice, or the AI voice when it is selected and usable. */
export function ttsSupported(): boolean {
  return speechSynthesisSupported() || !!aiVoiceProvider();
}

export function getEnglishVoices(): SpeechSynthesisVoice[] {
  if (!speechSynthesisSupported()) return [];
  return window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'));
}

function score(v: SpeechSynthesisVoice): number {
  let s = 0;
  const name = v.name.toLowerCase();
  if (/natural|neural|online/.test(name)) s += 10;
  if (/google/.test(name)) s += 6;
  if (v.lang === 'en-US') s += 4;
  else if (v.lang === 'en-GB') s += 3;
  if (v.localService === false) s += 1;
  return s;
}

export function pickVoice(voiceURI: string | null): SpeechSynthesisVoice | null {
  const voices = getEnglishVoices();
  if (voices.length === 0) return null;
  if (voiceURI) {
    const v = voices.find((x) => x.voiceURI === voiceURI);
    if (v) return v;
  }
  return [...voices].sort((a, b) => score(b) - score(a))[0];
}

/** React hook: English voices, updates when the browser finishes loading them. */
export function useEnglishVoices(): SpeechSynthesisVoice[] {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() => getEnglishVoices());
  useEffect(() => {
    if (!speechSynthesisSupported()) return;
    const update = () => setVoices(getEnglishVoices());
    update();
    window.speechSynthesis.addEventListener('voiceschanged', update);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', update);
  }, []);
  return voices;
}

// ───────────────────────────────────────────── AI voice selection

/**
 * One playback waits at most this long for the AI clip in total (including a request it joined, e.g. a
 * prefetch with a longer timeout), then plays the browser voice. The request itself keeps running into
 * the cache, so a later click is instant.
 */
export const AI_PLAY_TIMEOUT_MS = 15_000;
/** Timeout of one background (prefetch) generation. */
export const AI_PREFETCH_TIMEOUT_MS = 30_000;
/** After a network/timeout/server failure the AI voice is skipped this long (no 15 s wait on every click while offline). */
export const AI_COOLDOWN_MS = 30_000;
/** A rate limit (429) pauses the AI voice for the server's retry delay, within these bounds. */
export const RATE_LIMIT_MIN_MS = 5_000;
export const RATE_LIMIT_MAX_MS = 5 * 60_000;
/** Failures that will not go away until the AI settings change (key, model …). */
const HARD_CODES: ReadonlySet<AiErrorCode> = new Set<AiErrorCode>(['no-provider', 'bad-key', 'cors', 'model']);
/** Transient failures: the AI voice pauses for a while instead of making every click wait and retry. */
const COOLDOWN_CODES: ReadonlySet<AiErrorCode> = new Set<AiErrorCode>(['network', 'timeout', 'server', 'rate-limit']);
/**
 * Failures of ONE text (a clip too short for its words, a safety block, a 400 on an odd text): that text goes to the
 * browser voice instead of being paid for again on every click; other texts still use the AI voice.
 */
const PER_TEXT_CODES: ReadonlySet<AiErrorCode> = new Set<AiErrorCode>(['bad-response', 'safety', 'bad-request']);
/** A text whose clip came back unusable ('bad-response': may work later) is not asked for again this long. */
export const AI_TEXT_RETRY_MS = 30 * 60_000;
/** This many per-text failures in a row (different texts, no success between) pause the whole AI voice … */
export const AI_TEXT_FAILS_PAUSE_AFTER = 3;
/** … for this long: something is wrong with every request, not with one text. */
export const AI_TEXT_FAILS_PAUSE_MS = 10 * 60_000;
/**
 * A provider quota ('quota', not the learner's own cap) pauses the AI voice until the next local day, but at most this
 * long and at least QUOTA_PAUSE_MIN_MS: providers reset daily quotas at their own midnight, not ours.
 */
export const QUOTA_PAUSE_MAX_MS = 6 * 3600_000;
export const QUOTA_PAUSE_MIN_MS = 3600_000;

/** When a provider quota pause that started at `now` ends. */
export function quotaPauseUntil(now: number): number {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.min(now + QUOTA_PAUSE_MAX_MS, Math.max(now + QUOTA_PAUSE_MIN_MS, midnight.getTime()));
}

const SHORT_PROVIDER: Partial<Record<ProviderKind, string>> = {
  gemini: 'Gemini',
  openai: 'OpenAI',
  anthropic: 'Claude',
  openrouter: 'OpenRouter',
};

let statusMemo: { v: number; tts: ProviderSummary | null; sig: string } | null = null;
/** AI voice switched off after a failure, for the provider settings it failed with (sig). */
let breaker: { sig: string; until: number } | null = null;
/** Texts kept off the AI voice after a per-text failure: textKey → until. */
const textBlocks = new Map<string, number>();
const TEXT_BLOCKS_MAX = 500;
/** Per-text failures since the last AI success. */
let textFailStreak = 0;

const textKey = (sig: string, style: string | undefined, text: string) => `${sig}\u0000${style ?? ''}\u0000${text.trim()}`;

/** True when this text (in this style) is kept off the AI voice after a per-text failure. */
function aiTextBlocked(text: string, style: string | undefined): boolean {
  const k = textKey(ttsSnapshot().sig, style, text);
  const until = textBlocks.get(k);
  if (until === undefined) return false;
  if (Date.now() < until) return true;
  textBlocks.delete(k);
  return false;
}

function ttsSnapshot(): { tts: ProviderSummary | null; sig: string } {
  const v = aiVersion();
  if (statusMemo && statusMemo.v === v) return statusMemo;
  let tts: ProviderSummary | null = null;
  let cap: number | undefined;
  try {
    const s = aiStatus();
    tts = s.tts;
    cap = s.dailyRequestCap;
  } catch {
    tts = null;
  }
  const sig = tts ? JSON.stringify([tts.id, tts.kind, tts.ttsModel, tts.ttsVoice, tts.keyMasked, tts.enabled, cap]) : '';
  statusMemo = { v, tts, sig };
  return statusMemo;
}

/**
 * The AI speech provider playback will use right now (for texts without a shipped clip), or null for the browser
 * voice: voiceEngine is not 'ai' (the paid AI voice is an explicit choice), no provider can speak, or the AI voice
 * just failed in a way that needs the settings fixed (or a network problem, for AI_COOLDOWN_MS).
 */
export function aiVoiceProvider(): ProviderSummary | null {
  if (getSettings().voiceEngine !== 'ai') return null;
  const { tts, sig } = ttsSnapshot();
  if (!tts) return null;
  if (breaker) {
    if (breaker.sig === sig && Date.now() < breaker.until) return null;
    breaker = null;
  }
  return tts;
}

/** "Gemini · Kore" for a provider summary. */
export function aiVoiceLabel(p: Pick<ProviderSummary, 'kind' | 'label' | 'ttsVoice'>): string {
  const name = SHORT_PROVIDER[p.kind] ?? (p.label.trim() || 'AI');
  const voice = p.ttsVoice || defaultsFor(p.kind).ttsVoice || '';
  return voice ? `${name} · ${voice}` : name;
}

/** Voice name of the shipped clips (public/audio, generated once with Gemini Kore). */
export const SHIPPED_VOICE_LABEL = 'Gemini · Kore (có sẵn)';

/**
 * Name of the voice the next playback uses: the shipped clips' voice when they are on, else "Gemini · Kore" (AI
 * voice) or the browser voice name; null when none. A text without a shipped clip may still use another voice:
 * SpeakOptions.onVoice reports what actually spoke.
 */
export function currentVoiceLabel(): string | null {
  if (staticEligible() && !clipsDisabled()) return SHIPPED_VOICE_LABEL;
  const p = aiVoiceProvider();
  if (p) return aiVoiceLabel(p);
  if (!speechSynthesisSupported()) return null;
  return pickVoice(getSettings().voiceURI)?.name ?? null;
}

/** 'ai' when the next playback goes through the AI voice, else 'browser'. */
export function currentVoiceEngine(): 'browser' | 'ai' {
  return aiVoiceProvider() ? 'ai' : 'browser';
}

// ───────────────────────────────────────────── voice status store (pending + last error)

export interface VoiceStatus {
  /** An AI clip is being generated for the playback in flight (1–5 s): show a spinner / aria-busy. */
  pending: boolean;
  /** `owner` of that pending playback (SpeakOptions.owner), or null. */
  pendingOwner: object | null;
  /** Message of the last AI voice failure (cleared after the next AI playback works). */
  error: string | null;
  /** One-time notice to show, until dismissVoiceNotice(): "Giọng AI lỗi, đang dùng giọng trình duyệt: …". */
  notice: string | null;
  /** Increases with every new notice. */
  noticeId: number;
}

let vstate: VoiceStatus = { pending: false, pendingOwner: null, error: null, notice: null, noticeId: 0 };
let pendingId: number | null = null;
const vlisteners = new Set<() => void>();
/** Failures already shown as a notice this session (by error code, or message for non-AI errors): each kind shows once. */
const noticed = new Set<string>();

function setVoiceState(patch: Partial<VoiceStatus>): void {
  const next = { ...vstate, ...patch };
  if (
    next.pending === vstate.pending &&
    next.pendingOwner === vstate.pendingOwner &&
    next.error === vstate.error &&
    next.notice === vstate.notice &&
    next.noticeId === vstate.noticeId
  )
    return;
  vstate = next;
  for (const fn of vlisteners) {
    try {
      fn();
    } catch {
      // ignore
    }
  }
}

export function getVoiceStatus(): VoiceStatus {
  return vstate;
}

export function subscribeVoiceStatus(fn: () => void): () => void {
  vlisteners.add(fn);
  return () => {
    vlisteners.delete(fn);
  };
}

/** Hide the current AI-voice notice (the same message will not show again this session). */
export function dismissVoiceNotice(): void {
  setVoiceState({ notice: null });
}

export const VOICE_NOTICE_PREFIX = 'Giọng AI lỗi, đang dùng giọng trình duyệt: ';
/** Shown once per session when the shipped clips cannot be loaded right now (manifest or files) and the browser voice plays. */
export const CLIPS_NOTICE = 'Chưa tải được giọng Gemini có sẵn, tạm dùng giọng trình duyệt.';

/** The shipped clips are unavailable for now: tell the learner once why another voice speaks. */
function noticeClipsUnavailable(): void {
  if (noticed.has('clips')) return;
  noticed.add('clips');
  setVoiceState({ notice: CLIPS_NOTICE, noticeId: vstate.noticeId + 1 });
}

/** A shipped clip played again: the clips notice is out of date. */
function clearClipsNotice(): void {
  if (vstate.notice === CLIPS_NOTICE) setVoiceState({ notice: null });
}

function setPending(id: number, owner: object | null): void {
  pendingId = id;
  setVoiceState({ pending: true, pendingOwner: owner });
}

function clearPending(id: number): void {
  if (pendingId !== id) return;
  pendingId = null;
  setVoiceState({ pending: false, pendingOwner: null });
}

function errorMessage(e: unknown): string {
  if (isAiError(e)) return e.message;
  if (e instanceof Error && e.message && /[À-ỹ]/.test(e.message)) return e.message; // our own Vietnamese messages
  return 'Không phát được giọng AI.';
}

function overSelfCap(): boolean {
  try {
    return aiStatus().overDailyCap;
  } catch {
    return false;
  }
}

/**
 * The learner's own daily cap (Cài đặt → AI) was reached. Not a broken setup: cached clips still play for
 * free and the cap resets at midnight, so this never switches the AI voice off for the session.
 */
function isSelfCap(e: unknown): boolean {
  return isAiError(e) && e.code === 'quota' && overSelfCap();
}

/** The text (and AI style) a request was made for: per-text failures keep that text off the AI voice. */
interface TextJob {
  text: string;
  style: string | undefined;
}

/**
 * Opens the breaker for failures that would repeat on the next click: for the whole AI voice (settings, quota,
 * network, rate limit), or for one text (PER_TEXT_CODES), so no click pays twice for the same failure.
 */
function tripBreaker(e: unknown, job?: TextJob): void {
  if (!isAiError(e) || isSelfCap(e)) return;
  const { sig } = ttsSnapshot();
  const now = Date.now();
  if (PER_TEXT_CODES.has(e.code)) {
    if (job) {
      // a too-short clip may come out right later; a safety block or a 400 on this text will not
      textBlocks.set(textKey(sig, job.style, job.text), e.code === 'bad-response' ? now + AI_TEXT_RETRY_MS : Infinity);
      while (textBlocks.size > TEXT_BLOCKS_MAX) {
        const oldest = textBlocks.keys().next().value;
        if (oldest === undefined) break;
        textBlocks.delete(oldest);
      }
    }
    textFailStreak++;
    if (textFailStreak >= AI_TEXT_FAILS_PAUSE_AFTER || !job) breaker = { sig, until: now + AI_TEXT_FAILS_PAUSE_MS };
    return;
  }
  if (e.code === 'quota') breaker = { sig, until: quotaPauseUntil(now) };
  else if (HARD_CODES.has(e.code)) breaker = { sig, until: Infinity };
  else if (e.code === 'rate-limit') {
    const wait = Math.min(RATE_LIMIT_MAX_MS, Math.max(RATE_LIMIT_MIN_MS, e.retryAfterMs ?? AI_COOLDOWN_MS));
    breaker = { sig, until: now + wait };
  } else if (COOLDOWN_CODES.has(e.code)) breaker = { sig, until: now + AI_COOLDOWN_MS };
}

/** Records an AI voice failure: notice (once per kind of failure), and the breaker for failures that repeat. */
function reportAiFailure(e: unknown, job?: TextJob): void {
  if (isAiError(e) && e.code === 'aborted') return;
  tripBreaker(e, job);
  const msg = errorMessage(e);
  // by code: a 429 says "đợi khoảng 18 giây" once and "7 giây" the next time; that is still one notice
  const kind = isAiError(e) ? `code:${e.code}` : `msg:${msg}`;
  if (noticed.has(kind)) {
    setVoiceState({ error: msg });
    return;
  }
  noticed.add(kind);
  setVoiceState({ error: msg, notice: VOICE_NOTICE_PREFIX + msg, noticeId: vstate.noticeId + 1 });
}

/**
 * The AI voice is selected and configured but paused after a failure (playback uses the browser voice
 * for now): the failure's message. null when the AI voice is in use, or not selected at all.
 */
export function aiVoicePausedReason(): string | null {
  if (getSettings().voiceEngine !== 'ai') return null;
  const { tts, sig } = ttsSnapshot();
  if (!tts || !breaker || breaker.sig !== sig || Date.now() >= breaker.until) return null;
  return vstate.error ?? 'Giọng AI đang tạm tắt.';
}

function reportAiSuccess(): void {
  textFailStreak = 0;
  const aiNotice = vstate.notice?.startsWith(VOICE_NOTICE_PREFIX) ?? false;
  if (vstate.error || aiNotice) setVoiceState({ error: null, notice: aiNotice ? null : vstate.notice });
}

// ───────────────────────────────────────────── speak / stop

/** AI voice delivery style for a playback mode (undefined = the AI layer's default style). Part of the cache key. */
export function styleFor(mode: SpeechMode | undefined): string | undefined {
  if (mode === 'connected') return CONNECTED_STYLE;
  if (mode === 'careful') return CAREFUL_STYLE;
  return undefined;
}

export interface SpeakOptions {
  rate?: number; // overrides settings.rate
  /**
   * Playback mode (src/core/playback.ts). The caller already chose the TEXT (connected spelling vs standard);
   * this picks the AI voice's delivery style: 'connected' → CONNECTED_STYLE, 'careful' → CAREFUL_STYLE, omitted
   * → the AI layer's default style (single words, minimal pairs, samples). The browser voice ignores it.
   */
  mode?: SpeechMode;
  /**
   * A slowed playback (dictation "Chậm", the quiz turtle): never faster than 0.8 × the learner's rate (slowRate in
   * playback.ts). Careful mode is always slow. Default false.
   */
  slow?: boolean;
  /**
   * Never the paid AI voice for this playback (when the browser has a voice): many short clips in a row (dictation
   * "Từng cụm") would spend a free key's few requests per minute in one press. A shipped clip still plays (free).
   */
  browserOnly?: boolean;
  /**
   * Not started by the learner (auto-play of the next sentence): never makes a NEW paid request. A shipped clip, or an
   * AI clip already made or being made this session (prefetched after the learner played the previous item), still
   * plays; anything else uses the browser voice. It also does not release prefetchSpeech's armed clips.
   */
  auto?: boolean;
  /** Called when sound actually starts (for the AI voice: after the clip was generated). */
  onStart?: () => void;
  /**
   * Who started this speech: any stable object (e.g. a per-component ref value). Lets a component
   * stop speech on unmount only when it is still its own (see stopSpeakingIfOwner), instead of
   * cutting off what another component or the next page started.
   */
  owner?: object;
  /**
   * Called with the name of the voice that actually speaks ("Gemini · Kore", or the browser voice name;
   * null when the browser picks its default): after an AI failure this is the browser fallback voice.
   */
  onVoice?: (label: string | null) => void;
}

/**
 * The playback in flight. For the browser voice, holding `u` keeps the utterance from being
 * garbage-collected mid-speech (Chrome then drops 'end'); `settle` lets stop/next speak resolve it
 * even when the browser never fires 'end'/'error'.
 */
interface Current {
  engine: 'browser' | 'ai' | 'static';
  u: SpeechSynthesisUtterance | null;
  settle: () => void;
  id: number;
  owner: object | null;
}
let current: Current | null = null;
let lastId = 0;

/** Id of the playback in flight (increases with every speak() call), or null when nothing is speaking. */
export function currentUtteranceId(): number | null {
  return current?.id ?? null;
}

/** True while the playback in flight (generating or sounding) was started with `{ owner }`. */
export function isSpeakingOwner(owner: object): boolean {
  return !!current && current.owner === owner;
}

/** Safety net when neither 'end' nor 'error' fires: generous upper bound on speaking time. */
export function speakWatchdogMs(text: string, rate: number): number {
  return 4000 + (text.length * 120) / rate;
}

/**
 * Speak text. Cancels anything currently speaking (or being generated). Resolves when finished,
 * cancelled or on error (never rejects). A watchdog resolves it anyway if the browser never
 * reports the end of speech.
 */
export function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  return new Promise((resolve) => {
    if (!text.trim()) return resolve();
    route(text, opts, resolve);
    // the learner started this playback: clips prefetchSpeech armed for it may be made now (after its own request)
    if (!opts.auto) releaseArmed(text);
  });
}

function route(text: string, opts: SpeakOptions, resolve: () => void): void {
  if (staticEligible()) {
    const m = peekAudioManifest();
    if (m) return speakKnown(m, text, opts, resolve);
    // Unknown (a passing failure, or still loading after one playback already waited): any text may have a clip,
    // so it is never paid for. The browser voice plays at once instead of waiting again.
    if (manifestUnavailable() || manifestWaitedOut) {
      noticeClipsUnavailable();
      return speakFree(text, opts, resolve);
    }
    return speakAfterManifest(text, opts, resolve);
  }
  speakDynamic(text, opts, resolve);
}

/**
 * Routing once the manifest is known: a text with a clip plays the file, or (clip unavailable for now) the browser
 * voice, never the paid AI voice; a text without one takes the routes after the clips.
 */
function speakKnown(m: AudioManifest, text: string, opts: SpeakOptions, resolve: () => void, pendingNow = false): void {
  const key = m.size ? audioKey(clipMode(opts.mode), text) : '';
  if (key && hasShippedClip(m, key)) {
    const file = clipFileFor(m, key);
    if (file) return speakStatic(file, text, opts, resolve, pendingNow);
    noticeClipsUnavailable();
    return speakFree(text, opts, resolve);
  }
  speakDynamic(text, opts, resolve);
}

/** The free route for a text that has (or may have) a shipped clip: the browser voice, never the paid AI voice. */
function speakFree(text: string, opts: SpeakOptions, resolve: () => void): void {
  if (!speechSynthesisSupported()) return resolve();
  speakBrowser(text, opts, resolve, ++lastId);
}

/**
 * The routes after the shipped clips: AI voice (when chosen and usable; never for browserOnly, a text kept off it
 * after a per-text failure, or a NEW request for auto playback), else the browser voice.
 */
function speakDynamic(text: string, opts: SpeakOptions, resolve: () => void): void {
  const browser = speechSynthesisSupported();
  let ai = opts.browserOnly && browser ? null : aiVoiceProvider();
  if (ai) {
    const style = styleFor(opts.mode);
    if (aiTextBlocked(text, style) || (opts.auto && !aiClipMadeOrMaking(text, style))) ai = null;
  }
  if (ai) return speakAi(ai, text, opts, resolve);
  if (!browser) return resolve();
  speakBrowser(text, opts, resolve, ++lastId);
}

/**
 * iOS Safari speaks only an utterance started inside a user gesture; once one did, later ones (after an await) work.
 * The routes that may fall back to the browser voice asynchronously (manifest still loading, a clip that fails, the AI
 * voice) call this inside the click: one silent empty utterance, once per session, on iOS only.
 */
let speechPrimed = false;
function looksLikeIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1);
}
function primeSpeech(): void {
  if (speechPrimed || !speechSynthesisSupported() || !looksLikeIos()) return;
  speechPrimed = true;
  try {
    const u = new SpeechSynthesisUtterance('');
    u.volume = 0;
    window.speechSynthesis.speak(u);
  } catch {
    // best effort
  }
}

// ───────────────────────────────────────────── shipped clips (public/audio)

/** A shipped clip that has not started sounding after this long is given up (slow or stuck network). */
export const STATIC_LOAD_TIMEOUT_MS = 8000;
/** The spinner shows only when a shipped clip takes longer than this to start (local files are instant). */
const STATIC_PENDING_DELAY_MS = 250;

/**
 * Shipped clips are used unless the learner chose "Giọng trình duyệt": with the default "Giọng Gemini có sẵn"
 * ('clips') and with 'ai'. Every playback may have one: per mode (connected / careful), and 'plain' for a playback
 * without a mode (words, minimal pairs, as-written sentences). browserOnly playback (dictation "Từng cụm") plays
 * them too: browserOnly only keeps the paid AI voice out.
 */
function staticEligible(): boolean {
  return getSettings().voiceEngine !== 'browser';
}

/** Which clip a playback looks for: its mode, or 'plain' without one. */
function clipMode(mode: SpeechMode | undefined): AudioClipMode {
  return mode ?? 'plain';
}

/** The manifest lists a clip for this (mode, text): it is never worth a paid request. */
function shippedIn(m: AudioManifest, text: string, mode: AudioClipMode): boolean {
  return m.size > 0 && hasShippedClip(m, audioKey(mode, text));
}

/** The first playback waits at most this long for the manifest (still loading), then plays the browser voice. */
export const MANIFEST_WAIT_MS = 4000;
/**
 * A playback already waited MANIFEST_WAIT_MS for the manifest that is still loading (slow network): the next ones play
 * the browser voice at once instead of waiting again, until the load ends.
 */
let manifestWaitedOut = false;

/**
 * The manifest is still loading (first playback of the session). Holds the playback (stoppable, with the spinner
 * after STATIC_PENDING_DELAY_MS) until it is known, at most MANIFEST_WAIT_MS. Unknown or too slow → the browser voice:
 * the text may have a shipped clip, so it is never sent to the paid AI voice.
 */
function speakAfterManifest(text: string, opts: SpeakOptions, resolve: () => void): void {
  const id = ++lastId;
  const owner = opts.owner ?? null;
  current?.settle();
  if (speechSynthesisSupported()) window.speechSynthesis.cancel();
  getClipPlayer().prime(); // still inside the click
  primeSpeech(); // iOS: the browser voice may have to speak after the await
  let done = false;
  let spinner: ReturnType<typeof setTimeout> | undefined;
  let wait: ReturnType<typeof setTimeout> | undefined;
  /** Ends this hold; returns whether the spinner was showing. */
  const end = (): boolean => {
    done = true;
    clearTimeout(spinner);
    clearTimeout(wait);
    if (current === entry) current = null;
    const wasPending = pendingId === id;
    clearPending(id);
    return wasPending;
  };
  const entry: Current = {
    engine: 'static',
    u: null,
    id,
    owner,
    settle: () => {
      if (done) return;
      end();
      resolve();
    },
  };
  current = entry;
  spinner = setTimeout(() => {
    if (!done) setPending(id, owner);
  }, STATIC_PENDING_DELAY_MS);
  const go = (m: AudioManifest | null) => {
    if (done || current !== entry) return; // stopped or replaced meanwhile
    const wasPending = end();
    if (m) return speakKnown(m, text, opts, resolve, wasPending);
    noticeClipsUnavailable();
    speakFree(text, opts, resolve);
  };
  wait = setTimeout(() => {
    manifestWaitedOut = true;
    go(null);
  }, MANIFEST_WAIT_MS);
  void loadAudioManifest().then((m) => {
    manifestWaitedOut = false;
    go(m);
  });
}

function speakStatic(file: string, text: string, opts: SpeakOptions, resolve: () => void, pendingNow = false): void {
  const id = ++lastId;
  const owner = opts.owner ?? null;
  const player = getClipPlayer();
  current?.settle();
  if (speechSynthesisSupported()) window.speechSynthesis.cancel();
  player.prime();
  primeSpeech(); // iOS: a clip that fails falls back to the browser voice after the await

  let done = false;
  let sounding = false;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  let spinner: ReturnType<typeof setTimeout> | undefined;
  const finish = () => {
    if (done) return false;
    done = true;
    clearTimeout(watchdog);
    clearTimeout(deadline);
    clearTimeout(spinner);
    if (current === entry) current = null;
    clearPending(id);
    return true;
  };
  const entry: Current = {
    engine: 'static',
    u: null,
    id,
    owner,
    settle: () => {
      if (!finish()) return;
      player.stop();
      resolve();
    },
  };
  current = entry;
  // after a wait for the manifest that already showed the spinner, it stays on (no flicker)
  if (pendingNow) setPending(id, owner);
  else
    spinner = setTimeout(() => {
      if (!done && !sounding) setPending(id, owner);
    }, STATIC_PENDING_DELAY_MS);

  // Generated with the same styles as the AI voice, so the same rates apply (a careful clip is slow already).
  const rate = clampClipRate(slowRate(opts.rate, getSettings().rate, { mode: opts.mode, slow: opts.slow, engine: 'ai' }));
  const fallBack = (e: unknown) => {
    if (!finish()) return;
    // A clip that is still loading (timeout) must not start later on top of the fallback voice.
    player.stop();
    const blocked = e instanceof Error && e.name === 'NotAllowedError'; // autoplay policy: not the file's fault
    // A shipped text is never sent to the paid AI voice because its file did not load: the browser voice plays.
    if (!blocked && reportClipFailure(file)) noticeClipsUnavailable();
    if (!speechSynthesisSupported()) return resolve();
    speakBrowser(text, opts, resolve, id);
  };
  deadline = setTimeout(() => {
    if (!sounding) fallBack(new Error('timeout'));
  }, STATIC_LOAD_TIMEOUT_MS);

  player
    .playUrl(clipUrl(file), rate, () => {
      if (done) return;
      sounding = true;
      clearTimeout(deadline);
      clearTimeout(spinner);
      clearPending(id);
      reportClipSuccess();
      clearClipsNotice();
      watchdog = setTimeout(() => entry.settle(), speakWatchdogMs(text, rate) * 1.5);
      opts.onVoice?.(SHIPPED_VOICE_LABEL);
      opts.onStart?.();
    })
    .then(
      () => {
        if (finish()) resolve();
      },
      (e: unknown) => {
        sounding = false;
        fallBack(e);
      },
    );
}

function speakBrowser(text: string, opts: SpeakOptions, resolve: () => void, id: number): void {
  const synth = window.speechSynthesis;
  current?.settle();
  synth.cancel();
  const settings = getSettings();
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(settings.voiceURI);
  if (voice) {
    u.voice = voice;
    u.lang = voice.lang;
  } else {
    u.lang = 'en-US';
  }
  const rate = Math.min(2, Math.max(0.3, slowRate(opts.rate, settings.rate, { mode: opts.mode, slow: opts.slow, engine: 'browser' })));
  u.rate = rate;
  let done = false;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  const settle = () => {
    if (done) return;
    done = true;
    clearTimeout(watchdog);
    if (current?.u === u) current = null;
    resolve();
  };
  u.onstart = () => opts.onStart?.();
  opts.onVoice?.(voice?.name ?? null);
  u.onend = settle;
  u.onerror = settle;
  current = { engine: 'browser', u, settle, id, owner: opts.owner ?? null };
  watchdog = setTimeout(() => {
    const hung = current?.u === u;
    settle();
    // Reset a hung queue so the next utterance can play.
    if (hung && synth.speaking) synth.cancel();
  }, speakWatchdogMs(text, rate));
  synth.speak(u);
}

function speakAi(ai: ProviderSummary, text: string, opts: SpeakOptions, resolve: () => void): void {
  const id = ++lastId;
  const owner = opts.owner ?? null;
  const player = getClipPlayer();
  const job: TextJob = { text: text.trim(), style: styleFor(opts.mode) };
  current?.settle();
  if (speechSynthesisSupported()) window.speechSynthesis.cancel();
  // Still inside the click (if any): unlock audio output before the asynchronous generation.
  player.prime();
  primeSpeech();

  let done = false;
  let sounding = false;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const finish = () => {
    if (done) return false;
    done = true;
    clearTimeout(watchdog);
    clearTimeout(deadline);
    if (current === entry) current = null;
    clearPending(id);
    return true;
  };
  const entry: Current = {
    engine: 'ai',
    u: null,
    id,
    owner,
    settle: () => {
      const wasSounding = sounding;
      if (!finish()) return;
      if (wasSounding) player.stop();
      resolve();
    },
  };
  current = entry;
  setPending(id, owner);

  const rate = clampClipRate(slowRate(opts.rate, getSettings().rate, { mode: opts.mode, slow: opts.slow, engine: 'ai' }));
  const fallBack = (e: unknown) => {
    if (!finish()) return;
    const blocked = e instanceof Error && e.name === 'NotAllowedError'; // autoplay policy, not an AI problem
    if (!blocked) reportAiFailure(e, job);
    if (!speechSynthesisSupported()) return resolve();
    speakBrowser(text, opts, resolve, id);
  };

  // The playback's own deadline: a request it joined (a prefetch started earlier with a longer
  // timeout) never keeps the learner waiting longer than AI_PLAY_TIMEOUT_MS.
  deadline = setTimeout(() => {
    if (sounding) return;
    // Same provider name as the AI layer's own messages ("Google Gemini …"), at the start of a sentence.
    const name = ai.label?.trim() || SHORT_PROVIDER[ai.kind] || 'AI';
    fallBack(new AiError('timeout', `${name} phản hồi quá lâu (hơn ${Math.round(AI_PLAY_TIMEOUT_MS / 1000)} giây).`, { provider: ai.kind, retryable: false }));
  }, AI_PLAY_TIMEOUT_MS);

  // No signal on purpose: a clip whose playback was stopped or replaced while generating still
  // finishes into the cache (the request is paid for anyway), so the next click is instant;
  // identical requests in flight are shared by aiSpeak (double click, StrictMode, prefetch).
  // The request is still bounded by AI_PLAY_TIMEOUT_MS and is not retried: a 429/5xx falls back at
  // once and pauses the AI voice, instead of sleeping through the server's retry delay inside a click.
  const flight = aiSpeak(text, { timeoutMs: AI_PLAY_TIMEOUT_MS, retries: 0, style: job.style });
  flight.then(
    (res) => {
      noteAiClipMade(job);
      if (done) return;
      clearTimeout(deadline);
      clearPending(id);
      reportAiSuccess();
      sounding = true;
      watchdog = setTimeout(() => entry.settle(), speakWatchdogMs(text, rate) * 1.5);
      opts.onVoice?.(aiVoiceLabel(ai));
      opts.onStart?.();
      player.play(res.audio, rate).then(
        () => {
          if (finish()) resolve();
        },
        (e: unknown) => {
          sounding = false;
          fallBack(e);
        },
      );
    },
    (e: unknown) => {
      // a stopped playback's request still failed: remember a per-text failure (no notice), so it is not paid again
      if (!done) fallBack(e);
      else if (isAiError(e) && PER_TEXT_CODES.has(e.code)) tripBreaker(e, job);
    },
  );
}

export function stopSpeaking(): void {
  const cur = current;
  cur?.settle();
  if (cur && cur.engine !== 'browser') getClipPlayer().stop();
  if (speechSynthesisSupported()) window.speechSynthesis.cancel();
}

/**
 * Stop speech only if the playback in flight belongs to `owner` (started with `{ owner }`).
 * Returns true when it stopped something. Use in unmount cleanups of shared components.
 */
export function stopSpeakingIfOwner(owner: object): boolean {
  if (!isSpeakingOwner(owner)) return false;
  stopSpeaking();
  return true;
}

// ───────────────────────────────────────────── prefetch

/** At most this many AI clips are generated in the background at once. */
export const PREFETCH_CONCURRENCY = 2;
/** Older queued texts are dropped beyond this (the learner moved on). */
export const PREFETCH_QUEUE_MAX = 12;
/**
 * Default number of texts prefetched AFTER the first one. 0 = the first only: a free Gemini key allows a few speech
 * requests per minute and ~30 a day, so speculative clips would eat the quota the learner needs.
 */
export const PREFETCH_AHEAD_DEFAULT = 0;

export interface PrefetchOptions {
  /** Playback mode the clips will be played with (its AI style is part of the cache key). 'careful' is never prefetched. */
  mode?: SpeechMode;
  /** How many texts after the first to prefetch (default PREFETCH_AHEAD_DEFAULT = none). */
  ahead?: number;
  /**
   * Generate only once the learner plays THIS text (dictation: the next sentence, once the current one is played).
   * Without it, the next playback the learner starts releases the clips (checkup: the item's other lines).
   */
  after?: string;
}

/** Same shape as TextJob: the text and the AI style (part of the cache key). */
type PrefetchJob = TextJob;

const prefetchQueue: PrefetchJob[] = [];
const prefetchKnown = new Set<string>(); // queued or running, by jobKey
let prefetchRunning = 0;
/** Clips asked for by prefetchSpeech, waiting for the learner's next playback (only the latest call is kept). */
let armed: { jobs: PrefetchJob[]; mode: AudioClipMode; after: string | null } | null = null;
/** AI clips made this session (cache hits now): auto playback may use them for free. */
const madeThisSession = new Set<string>();
const MADE_MAX = 500;

const jobKey = (j: PrefetchJob) => `${j.style ?? ''}\u0000${j.text}`;

function noteAiClipMade(j: PrefetchJob): void {
  madeThisSession.delete(jobKey(j));
  madeThisSession.add(jobKey(j));
  if (madeThisSession.size > MADE_MAX) {
    const oldest = madeThisSession.values().next().value;
    if (oldest !== undefined) madeThisSession.delete(oldest);
  }
}

/** An AI clip for this text was made this session or is being made: playing it costs nothing more. */
function aiClipMadeOrMaking(text: string, style: string | undefined): boolean {
  const k = jobKey({ text: text.trim(), style });
  return madeThisSession.has(k) || prefetchKnown.has(k);
}

/**
 * Warms the AI speech cache for what the learner will hear next. Nothing is generated by this call itself: AI calls
 * happen only after a click. The clips wait ("armed") for the learner's next playback, of `after` when given (so a
 * sentence that is only shown, or skipped without playing, never costs a request); a newer call replaces them. By
 * default only the first text; `ahead` allows more. Pass the same `mode` the playback will use, so the clip lands under
 * the same cache key (text + style). No-op with the browser voice and for 'careful' playback. Texts with a shipped clip
 * (or that may have one: manifest unknown) are never generated. Failures are quiet, except ones that need the settings
 * fixed, quotas and rate limits (they pause the AI voice and show the notice); a per-text failure keeps that text off
 * the AI voice. Nothing is prefetched while the AI voice is paused or once the learner's own daily cap is reached.
 */
export function prefetchSpeech(texts: readonly string[], opts: PrefetchOptions = {}): void {
  if (opts.mode === 'careful') return;
  if (!aiVoiceProvider() || overSelfCap()) return;
  const style = styleFor(opts.mode);
  const ahead = Math.max(0, Math.floor(opts.ahead ?? PREFETCH_AHEAD_DEFAULT));
  const jobs: PrefetchJob[] = texts
    .slice(0, 1 + ahead)
    .map((t) => (typeof t === 'string' ? t.trim() : ''))
    .filter((t) => !!t)
    .map((text) => ({ text, style }));
  armed = jobs.length ? { jobs, mode: clipMode(opts.mode), after: opts.after?.trim() || null } : null;
}

/** The learner started a playback of `text`: queue the armed clips waiting for it. */
function releaseArmed(text: string): void {
  if (!armed) return;
  if (armed.after !== null && armed.after !== text.trim()) return;
  const { jobs, mode } = armed;
  armed = null;
  queueUnshipped(jobs, mode);
}

/** Queues the jobs whose text has no shipped clip; nothing while the manifest is unknown (any text may have one). */
function queueUnshipped(jobs: readonly PrefetchJob[], mode: AudioClipMode): void {
  if (!aiVoiceProvider() || overSelfCap()) return;
  if (!staticEligible()) return enqueuePrefetch(jobs);
  const run = (m: AudioManifest | null) => {
    if (m) enqueuePrefetch(jobs.filter((j) => !shippedIn(m, j.text, mode)));
  };
  const m = peekAudioManifest();
  if (m) return run(m);
  if (manifestUnavailable()) return;
  void loadAudioManifest().then(run);
}

function enqueuePrefetch(jobs: readonly PrefetchJob[]): void {
  if (!aiVoiceProvider() || overSelfCap()) return;
  for (const j of jobs) {
    const k = jobKey(j);
    if (prefetchKnown.has(k) || aiTextBlocked(j.text, j.style)) continue;
    prefetchKnown.add(k);
    prefetchQueue.push(j);
  }
  while (prefetchQueue.length > PREFETCH_QUEUE_MAX) {
    const dropped = prefetchQueue.shift();
    if (dropped !== undefined) prefetchKnown.delete(jobKey(dropped));
  }
  pumpPrefetch();
}

function pumpPrefetch(): void {
  while (prefetchRunning < PREFETCH_CONCURRENCY && prefetchQueue.length) {
    const job = prefetchQueue.shift() as PrefetchJob;
    if (!aiVoiceProvider() || overSelfCap()) {
      prefetchQueue.length = 0;
      prefetchKnown.clear();
      return;
    }
    if (aiTextBlocked(job.text, job.style)) {
      prefetchKnown.delete(jobKey(job));
      continue;
    }
    prefetchRunning++;
    aiSpeak(job.text, { retries: 1, timeoutMs: AI_PREFETCH_TIMEOUT_MS, style: job.style })
      .then(() => noteAiClipMade(job))
      .catch((e: unknown) => {
        if (!isAiError(e) || isSelfCap(e)) return;
        // one text's failure: kept off the AI voice (no retry, no notice); settings / quota / rate limit: the notice
        if (PER_TEXT_CODES.has(e.code)) tripBreaker(e, job);
        else if (HARD_CODES.has(e.code) || e.code === 'quota' || e.code === 'rate-limit') reportAiFailure(e, job);
      })
      .finally(() => {
        prefetchRunning--;
        prefetchKnown.delete(jobKey(job));
        pumpPrefetch();
      });
  }
}

// ───────────────────────────────────────────── React bindings

/** Pending AI generation + last AI voice error / one-time notice. */
export function useVoiceStatus(): VoiceStatus {
  return useSyncExternalStore(subscribeVoiceStatus, getVoiceStatus, getVoiceStatus);
}

/** True while an AI clip is being generated for a playback started with `{ owner }` (any owner when omitted). */
export function useSpeechPending(owner?: object): boolean {
  const s = useVoiceStatus();
  return s.pending && (owner === undefined || s.pendingOwner === owner);
}

/** currentVoiceLabel(), re-rendered when settings, the AI config or the browser's voices change. */
export function useVoiceLabel(): string | null {
  useSettings();
  useAiVersion();
  useEnglishVoices();
  useVoiceStatus(); // the breaker trips together with a status change
  return currentVoiceLabel();
}

/** 'ai' when playback goes through the AI voice, else 'browser' (reactive). */
export function useVoiceEngine(): 'browser' | 'ai' {
  useSettings();
  useAiVersion();
  useVoiceStatus();
  return currentVoiceEngine();
}

/** Test hook: reset module state between tests. */
export function _resetTtsForTests(): void {
  current = null;
  statusMemo = null;
  breaker = null;
  pendingId = null;
  textBlocks.clear();
  textFailStreak = 0;
  manifestWaitedOut = false;
  speechPrimed = false;
  armed = null;
  madeThisSession.clear();
  noticed.clear();
  prefetchQueue.length = 0;
  prefetchKnown.clear();
  prefetchRunning = 0;
  vstate = { pending: false, pendingOwner: null, error: null, notice: null, noticeId: 0 };
}
