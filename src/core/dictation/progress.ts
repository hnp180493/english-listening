// Per-sentence progress + practice ordering for dictation. Pure functions
// (storage is done by the page through src/core/storage.ts).

import type { Level, Sentence } from '../types';

export interface SentenceProgress {
  best: number; // best score 0..1
  attempts: number;
  lastAt: number; // epoch ms
  hints?: number; // attempts made after revealing the hint
  cleanAt?: number; // epoch ms of the latest perfect attempt made WITHOUT the hint
  hintAt?: number; // epoch ms of the latest attempt made WITH the hint
}

export type ProgressMap = Record<string, SentenceProgress>;

/** Defensive parse of whatever came out of storage. */
export function sanitizeProgress(raw: unknown): ProgressMap {
  const out: ProgressMap = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (id === '__proto__' || !v || typeof v !== 'object') continue;
    const p = v as Partial<SentenceProgress>;
    const best = typeof p.best === 'number' && Number.isFinite(p.best) ? Math.min(1, Math.max(0, p.best)) : 0;
    const attempts =
      typeof p.attempts === 'number' && Number.isFinite(p.attempts) && p.attempts > 0 ? Math.floor(p.attempts) : 0;
    const lastAt = typeof p.lastAt === 'number' && Number.isFinite(p.lastAt) ? p.lastAt : 0;
    if (attempts === 0) continue;
    const hints = typeof p.hints === 'number' && Number.isFinite(p.hints) && p.hints > 0 ? Math.floor(p.hints) : 0;
    const entry: SentenceProgress = { best, attempts, lastAt };
    if (hints > 0) entry.hints = hints;
    if (typeof p.cleanAt === 'number' && Number.isFinite(p.cleanAt) && p.cleanAt > 0) entry.cleanAt = p.cleanAt;
    if (hints > 0 && typeof p.hintAt === 'number' && Number.isFinite(p.hintAt) && p.hintAt > 0) entry.hintAt = p.hintAt;
    out[id] = entry;
  }
  return out;
}

export function updateProgress(map: ProgressMap, id: string, score: number, now: number, hinted = false): ProgressMap {
  const prev = map[id];
  const next: SentenceProgress = {
    best: Math.max(prev?.best ?? 0, score),
    attempts: (prev?.attempts ?? 0) + 1,
    lastAt: now,
  };
  const hints = (prev?.hints ?? 0) + (hinted ? 1 : 0);
  if (hints > 0) next.hints = hints;
  if (score >= 1 && !hinted) next.cleanAt = now;
  else if (prev?.cleanAt) next.cleanAt = prev.cleanAt;
  if (hinted) next.hintAt = now;
  else if (prev?.hintAt) next.hintAt = prev.hintAt;
  return { ...map, [id]: next };
}

/** Copy of `map` without `id` (used when a custom sentence is deleted). */
export function removeProgress(map: ProgressMap, id: string): ProgressMap {
  if (!Object.prototype.hasOwnProperty.call(map, id)) return map;
  const next = { ...map };
  delete next[id];
  return next;
}

/** Small deterministic PRNG so the session shuffle is stable. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled<T>(xs: readonly T[], seed: number): T[] {
  const rnd = mulberry32(seed);
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Unseen sentences first (shuffled with `seed`), then seen ones by lowest best score, oldest first. */
export function orderSentences(list: readonly Sentence[], progress: ProgressMap, seed: number): Sentence[] {
  const unseen = list.filter((s) => !progress[s.id]?.attempts);
  const seen = list.filter((s) => progress[s.id]?.attempts);
  seen.sort((a, b) => {
    const pa = progress[a.id];
    const pb = progress[b.id];
    return pa.best - pb.best || pa.lastAt - pb.lastAt;
  });
  // Unseen: shuffled, then easy levels first (stable sort keeps the shuffle within a level),
  // so a new learner starts with short sentences instead of a hard one.
  const fresh = shuffled(unseen, seed).sort((a, b) => a.level - b.level);
  return [...fresh, ...seen];
}

export type LevelFilter = 0 | Level; // 0 = all

export function filterSentences(list: readonly Sentence[], level: LevelFilter, topic: string): Sentence[] {
  return list.filter((s) => (level === 0 || s.level === level) && (!topic || s.topic === topic));
}

export function topicsOf(list: readonly Sentence[]): string[] {
  return [...new Set(list.map((s) => s.topic).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
}
