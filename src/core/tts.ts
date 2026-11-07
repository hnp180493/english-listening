// Text-to-speech for every playback in the app.
//
// Two engines behind one speak():
//  - 'browser' (default): speechSynthesis. Natural/neural voices (Edge "Microsoft … Online (Natural)",
//    Chrome "Google US English") already produce fairly natural connected speech; we prefer them.
//  - 'ai' (Settings.voiceEngine === 'ai' AND a usable AI speech provider in Cài đặt → AI): the clip comes
//    from aiSpeak() (cached in IndexedDB, so replays are free) and plays through one shared
//    HTMLAudioElement (./audioPlayer). The rate maps to playbackRate (0.5–1.5, pitch preserved).
//    Any AI failure falls back to the browser voice for that playback and is reported once
//    through useVoiceStatus() ("Giọng AI lỗi, đang dùng giọng trình duyệt: …").
//
// No feature in the app uses speechSynthesis boundary events (word-by-word highlighting); dictation's
// chunk highlighting is per speak() call, so it works the same with AI audio. onStart fires when the
// clip actually starts playing (after generation), like the utterance's 'start' event.

import { useEffect, useState, useSyncExternalStore } from 'react';
import { AiError, aiSpeak, aiStatus, aiVersion, defaultsFor, isAiError, useAiVersion, type AiErrorCode, type ProviderKind, type ProviderSummary } from './ai';
import { clampClipRate, getClipPlayer } from './audioPlayer';
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
/** Failures that will not go away until the AI settings change (key, quota, model …). */
const HARD_CODES: ReadonlySet<AiErrorCode> = new Set<AiErrorCode>(['no-provider', 'bad-key', 'quota', 'cors', 'model', 'bad-request']);
/** Transient failures: the AI voice pauses for a while instead of making every click wait and retry. */
const COOLDOWN_CODES: ReadonlySet<AiErrorCode> = new Set<AiErrorCode>(['network', 'timeout', 'server', 'rate-limit']);

const SHORT_PROVIDER: Partial<Record<ProviderKind, string>> = {
  gemini: 'Gemini',
  openai: 'OpenAI',
  anthropic: 'Claude',
  openrouter: 'OpenRouter',
};

let statusMemo: { v: number; tts: ProviderSummary | null; sig: string } | null = null;
/** AI voice switched off after a failure, for the provider settings it failed with (sig). */
let breaker: { sig: string; until: number } | null = null;

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
 * The AI speech provider playback will use right now, or null for the browser voice: voiceEngine is
 * 'browser', no provider can speak, or the AI voice just failed in a way that needs the settings fixed
 * (or a network problem, for AI_COOLDOWN_MS).
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

/** Name of the voice the next playback uses: "Gemini · Kore", or the browser voice name; null when none. */
export function currentVoiceLabel(): string | null {
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
/** Set by the first AI playback of the session; until then only the current sentence is prefetched. */
let aiPlayedOnce = false;
/** Texts held back by prefetchSpeech before the first AI playback (the next sentence): queued once it happens. */
let heldBack: string[] = [];

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

/** Opens the breaker for failures that would repeat on the next click. */
function tripBreaker(e: unknown): void {
  if (!isAiError(e) || isSelfCap(e)) return;
  const { sig } = ttsSnapshot();
  if (HARD_CODES.has(e.code)) breaker = { sig, until: Infinity };
  else if (e.code === 'rate-limit') {
    const wait = Math.min(RATE_LIMIT_MAX_MS, Math.max(RATE_LIMIT_MIN_MS, e.retryAfterMs ?? AI_COOLDOWN_MS));
    breaker = { sig, until: Date.now() + wait };
  } else if (COOLDOWN_CODES.has(e.code)) breaker = { sig, until: Date.now() + AI_COOLDOWN_MS };
}

/** Records an AI voice failure: notice (once per kind of failure), and the breaker for failures that repeat. */
function reportAiFailure(e: unknown): void {
  if (isAiError(e) && e.code === 'aborted') return;
  tripBreaker(e);
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
  if (vstate.error || vstate.notice) setVoiceState({ error: null, notice: null });
}

// ───────────────────────────────────────────── speak / stop

export interface SpeakOptions {
  rate?: number; // overrides settings.rate
  /** Called when sound actually starts (for the AI voice: after the clip was generated). */
  onStart?: () => void;
  /**
   * Who started this speech: any stable object (e.g. a per-component ref value). Lets a component
   * stop speech on unmount only when it is still its own (see stopSpeakingIfOwner), instead of
   * cutting off what another component or the next page started.
   */
  owner?: object;
}

/**
 * The playback in flight. For the browser voice, holding `u` keeps the utterance from being
 * garbage-collected mid-speech (Chrome then drops 'end'); `settle` lets stop/next speak resolve it
 * even when the browser never fires 'end'/'error'.
 */
interface Current {
  engine: 'browser' | 'ai';
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
    const ai = aiVoiceProvider();
    if (ai) return speakAi(ai, text, opts, resolve);
    if (!speechSynthesisSupported()) return resolve();
    speakBrowser(text, opts, resolve, ++lastId);
  });
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
  const rate = Math.min(2, Math.max(0.3, opts.rate ?? settings.rate));
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
  const firstPlay = !aiPlayedOnce;
  aiPlayedOnce = true;
  const owner = opts.owner ?? null;
  const player = getClipPlayer();
  current?.settle();
  if (speechSynthesisSupported()) window.speechSynthesis.cancel();
  // Still inside the click (if any): unlock audio output before the asynchronous generation.
  player.prime();

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

  const rate = clampClipRate(opts.rate ?? getSettings().rate);
  const fallBack = (e: unknown) => {
    if (!finish()) return;
    const blocked = e instanceof Error && e.name === 'NotAllowedError'; // autoplay policy, not an AI problem
    if (!blocked) reportAiFailure(e);
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
  const flight = aiSpeak(text, { timeoutMs: AI_PLAY_TIMEOUT_MS, retries: 0 });
  // the learner listens with the AI voice: now the next sentence held back by prefetchSpeech is worth making
  if (firstPlay && heldBack.length) {
    const later = heldBack;
    heldBack = [];
    prefetchSpeech(later);
  }
  flight.then(
    (res) => {
      if (done) return;
      clearTimeout(deadline);
      clearPending(id);
      reportAiSuccess();
      sounding = true;
      watchdog = setTimeout(() => entry.settle(), speakWatchdogMs(text, rate) * 1.5);
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
    (e: unknown) => fallBack(e),
  );
}

export function stopSpeaking(): void {
  const cur = current;
  cur?.settle();
  if (cur?.engine === 'ai') getClipPlayer().stop();
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

const prefetchQueue: string[] = [];
const prefetchKnown = new Set<string>(); // queued or running
let prefetchRunning = 0;

/**
 * Warms the AI speech cache for texts the learner will probably hear next (the current and the next
 * dictation sentence, checkup item …). No-op with the browser voice. Each text is a paid request, so
 * until the learner has played something with the AI voice this session only the first text (the
 * current sentence) is generated. Failures are quiet, except ones that need the settings fixed and rate
 * limits (they pause the AI voice and show the notice). Nothing is prefetched while the AI voice is
 * paused or once the learner's own daily cap is reached.
 */
export function prefetchSpeech(texts: readonly string[]): void {
  if (!aiVoiceProvider() || overSelfCap()) return;
  if (!aiPlayedOnce) heldBack = texts.slice(1).filter((t) => typeof t === 'string' && !!t.trim());
  for (const t of aiPlayedOnce ? texts : texts.slice(0, 1)) {
    const clean = typeof t === 'string' ? t.trim() : '';
    if (!clean || prefetchKnown.has(clean)) continue;
    prefetchKnown.add(clean);
    prefetchQueue.push(clean);
  }
  while (prefetchQueue.length > PREFETCH_QUEUE_MAX) {
    const dropped = prefetchQueue.shift();
    if (dropped !== undefined) prefetchKnown.delete(dropped);
  }
  pumpPrefetch();
}

function pumpPrefetch(): void {
  while (prefetchRunning < PREFETCH_CONCURRENCY && prefetchQueue.length) {
    const text = prefetchQueue.shift() as string;
    if (!aiVoiceProvider() || overSelfCap()) {
      prefetchQueue.length = 0;
      prefetchKnown.clear();
      return;
    }
    prefetchRunning++;
    aiSpeak(text, { retries: 1, timeoutMs: AI_PREFETCH_TIMEOUT_MS })
      .catch((e: unknown) => {
        if (!isAiError(e) || isSelfCap(e)) return;
        if (HARD_CODES.has(e.code) || e.code === 'rate-limit') reportAiFailure(e);
      })
      .finally(() => {
        prefetchRunning--;
        prefetchKnown.delete(text);
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
  aiPlayedOnce = false;
  heldBack = [];
  noticed.clear();
  prefetchQueue.length = 0;
  prefetchKnown.clear();
  prefetchRunning = 0;
  vstate = { pending: false, pendingOwner: null, error: null, notice: null, noticeId: 0 };
}
