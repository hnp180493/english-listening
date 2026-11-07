// Shadowing history: the last few scores per practised item, kept in KEYS.shadowing.
// Recordings themselves are NEVER stored.

import { KEYS, loadJSON, saveJSON } from '../../core/storage';

export type SelfRating = 'good' | 'ok' | 'bad';

export const SELF_SCORE: Record<SelfRating, number> = { good: 1, ok: 0.6, bad: 0.2 };
export const SELF_LABEL: Record<SelfRating, string> = { good: 'Tốt', ok: 'Tạm', bad: 'Chưa được' };

export interface ShadowAttempt {
  at: number; // epoch ms
  score: number; // 0..1
  self?: SelfRating; // present when the learner rated themselves (no speech recognition)
}

export interface ShadowItem {
  attempts: ShadowAttempt[]; // most recent last, at most HISTORY_LEN
  total: number; // all-time attempt count
  best: number; // all-time best score 0..1
  text?: string; // only for typed-in sentences ("custom:…" ids), so they can be picked again
}

export type ShadowState = Record<string, ShadowItem>;

export const HISTORY_LEN = 5;
export const MAX_ITEMS = 400;
export const MAX_TEXT = 300;

export function isCustomItemId(id: string): boolean {
  return id.startsWith('custom:');
}

function cleanText(raw: unknown): string {
  return typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT) : '';
}

function isRating(x: unknown): x is SelfRating {
  return x === 'good' || x === 'ok' || x === 'bad';
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function sanitizeAttempt(raw: unknown): ShadowAttempt | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.at !== 'number' || !Number.isFinite(r.at)) return null;
  if (typeof r.score !== 'number' || !Number.isFinite(r.score)) return null;
  const a: ShadowAttempt = { at: r.at, score: clamp01(r.score) };
  if (isRating(r.self)) a.self = r.self;
  return a;
}

/** Repair anything read from storage. */
export function sanitizeState(raw: unknown): ShadowState {
  const out: ShadowState = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!id || id === '__proto__' || !v || typeof v !== 'object') continue;
    const item = v as Record<string, unknown>;
    const attempts = (Array.isArray(item.attempts) ? item.attempts : [])
      .map(sanitizeAttempt)
      .filter((a): a is ShadowAttempt => a !== null)
      .sort((a, b) => a.at - b.at)
      .slice(-HISTORY_LEN);
    if (attempts.length === 0) continue;
    const bestSeen = Math.max(...attempts.map((a) => a.score));
    const best = typeof item.best === 'number' && Number.isFinite(item.best) ? clamp01(item.best) : 0;
    const total =
      typeof item.total === 'number' && Number.isFinite(item.total) ? Math.max(Math.floor(item.total), attempts.length) : attempts.length;
    const entry: ShadowItem = { attempts, total, best: Math.max(best, bestSeen) };
    const text = isCustomItemId(id) ? cleanText(item.text) : '';
    if (text && /[a-z]/i.test(text)) entry.text = text;
    out[id] = entry;
  }
  return out;
}

function lastAt(item: ShadowItem): number {
  return item.attempts.length ? item.attempts[item.attempts.length - 1].at : 0;
}

/**
 * Pure: state with one more attempt for itemId; keeps HISTORY_LEN attempts and at most MAX_ITEMS items.
 * `text` is remembered for typed-in sentences only.
 */
export function withAttempt(state: ShadowState, itemId: string, attempt: ShadowAttempt, text?: string): ShadowState {
  const prev = state[itemId];
  const score = Number.isFinite(attempt.score) ? clamp01(attempt.score) : 0;
  const a: ShadowAttempt = { ...attempt, score };
  const item: ShadowItem = {
    attempts: [...(prev?.attempts ?? []), a].slice(-HISTORY_LEN),
    total: (prev?.total ?? 0) + 1,
    best: Math.max(prev?.best ?? 0, a.score),
  };
  const keep = isCustomItemId(itemId) ? cleanText(text) || prev?.text : undefined;
  if (keep) item.text = keep;
  const next: ShadowState = { ...state, [itemId]: item };
  const ids = Object.keys(next);
  if (ids.length > MAX_ITEMS) {
    ids.sort((x, y) => lastAt(next[x]) - lastAt(next[y]));
    for (const id of ids.slice(0, ids.length - MAX_ITEMS)) if (id !== itemId) delete next[id];
  }
  return next;
}

export function loadShadowing(): ShadowState {
  return sanitizeState(loadJSON<unknown>(KEYS.shadowing, {}));
}

export function saveShadowAttempt(itemId: string, attempt: ShadowAttempt, text?: string): ShadowState {
  const next = withAttempt(loadShadowing(), itemId, attempt, text);
  saveJSON(KEYS.shadowing, next);
  return next;
}

export interface RecentCustom {
  id: string;
  text: string;
  best: number;
  total: number;
  lastAt: number;
}

/** Typed-in sentences practised before, most recent first. */
export function recentCustom(state: ShadowState, limit = 6): RecentCustom[] {
  return Object.entries(state)
    .filter(([id, item]) => isCustomItemId(id) && !!item.text)
    .map(([id, item]) => ({ id, text: item.text ?? '', best: item.best, total: item.total, lastAt: lastAt(item) }))
    .sort((a, b) => b.lastAt - a.lastAt)
    .slice(0, Math.max(0, limit));
}

/** Stable id for a sentence the learner typed in ("custom:" + short hash of the normalised text). */
export function customItemId(text: string): string {
  const norm = text.toLowerCase().replace(/\s+/g, ' ').trim();
  let h = 5381;
  for (let i = 0; i < norm.length; i++) h = ((h * 33) ^ norm.charCodeAt(i)) >>> 0;
  return 'custom:' + h.toString(36);
}

/** Round 0..1 to a whole percentage. */
export function toPercent(score: number): number {
  return Math.round(clamp01(Number.isFinite(score) ? score : 0) * 100);
}
