// Media library: pure data logic (sanitising, progress, playback windows).
// Only transcripts + metadata are stored — never media bytes.

import { isYouTubeId } from '../../core/media/youtube';

export type MediaKind = 'youtube' | 'file';
export type MediaFileType = 'audio' | 'video';
export type PracticeMode = 'watch' | 'dictation';
export type Speed = 0.5 | 0.75 | 1;

export const SPEEDS: readonly Speed[] = [0.5, 0.75, 1];
/** A unit counts as done (✓) once a dictation score reaches this. */
export const DONE_SCORE = 0.8;
/** Refuse transcripts larger than this (bytes, UTF-8). */
export const MAX_TRANSCRIPT_BYTES = 500 * 1024;
/** Keep the whole library well under the ~5 MB localStorage quota. */
export const MAX_LIBRARY_CHARS = 3_500_000;
export const MAX_TITLE_LENGTH = 120;

export interface MediaUnit {
  start: number;
  end: number;
  text: string;
}

export interface MediaProgress {
  unitIndex: number; // where the learner left off
  done: number[]; // unit indexes completed, sorted, unique
  scores: Record<number, number>; // best dictation score per unit index, 0..1
}

export interface MediaItem {
  id: string;
  kind: MediaKind;
  title: string;
  youtubeId?: string;
  fileName?: string;
  fileType?: MediaFileType;
  createdAt: number;
  openedAt?: number;
  units: MediaUnit[];
  progress: MediaProgress;
}

export interface MediaPrefs {
  speed: Speed;
  autoLoop: boolean;
  showSubs: boolean;
  mode: PracticeMode;
  /** Epoch ms of the last prefs change (folder sync keeps the copy changed last); absent = never changed. */
  changedAt?: number;
}

export interface MediaLibrary {
  items: MediaItem[];
  prefs: MediaPrefs;
}

export const DEFAULT_PREFS: MediaPrefs = { speed: 1, autoLoop: false, showSubs: true, mode: 'watch' };

export function emptyLibrary(): MediaLibrary {
  return { items: [], prefs: { ...DEFAULT_PREFS } };
}

// ------------------------------------------------------------------ sanitising

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function sanitizeUnits(v: unknown): MediaUnit[] {
  if (!Array.isArray(v)) return [];
  const out: MediaUnit[] = [];
  for (const u of v) {
    if (!isObj(u) || !finite(u.start) || !finite(u.end) || typeof u.text !== 'string') continue;
    const text = u.text.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    const start = Math.max(0, u.start);
    out.push({ start, end: Math.max(u.end, start + 0.1), text });
  }
  return out;
}

function sanitizeProgress(v: unknown, unitCount: number): MediaProgress {
  const p = isObj(v) ? v : {};
  const inRange = (n: unknown): n is number => finite(n) && Number.isInteger(n) && n >= 0 && n < unitCount;
  const done = Array.isArray(p.done) ? [...new Set(p.done.filter(inRange))].sort((a, b) => a - b) : [];
  const scores: Record<number, number> = {};
  if (isObj(p.scores)) {
    for (const [k, s] of Object.entries(p.scores)) {
      const idx = Number(k);
      if (inRange(idx) && finite(s)) scores[idx] = Math.min(1, Math.max(0, s));
    }
  }
  const unitIndex = inRange(p.unitIndex) ? p.unitIndex : 0;
  return { unitIndex, done, scores };
}

export function sanitizeItem(v: unknown): MediaItem | null {
  if (!isObj(v) || typeof v.id !== 'string' || !v.id) return null;
  const kind: MediaKind | null = v.kind === 'youtube' || v.kind === 'file' ? v.kind : null;
  if (!kind) return null;
  const units = sanitizeUnits(v.units);
  const item: MediaItem = {
    id: v.id.slice(0, 64),
    kind,
    title: (typeof v.title === 'string' && v.title.trim() ? v.title.trim() : 'Không tên').slice(0, MAX_TITLE_LENGTH),
    createdAt: finite(v.createdAt) ? v.createdAt : 0,
    units,
    progress: sanitizeProgress(v.progress, units.length),
  };
  if (finite(v.openedAt)) item.openedAt = v.openedAt;
  if (kind === 'youtube') {
    if (typeof v.youtubeId !== 'string' || !isYouTubeId(v.youtubeId)) return null;
    item.youtubeId = v.youtubeId;
  } else {
    item.fileName = typeof v.fileName === 'string' ? v.fileName.slice(0, 260) : '';
    item.fileType = v.fileType === 'audio' ? 'audio' : 'video';
  }
  return item;
}

function sanitizePrefs(v: unknown): MediaPrefs {
  const p = isObj(v) ? v : {};
  const out: MediaPrefs = {
    speed: SPEEDS.includes(p.speed as Speed) ? (p.speed as Speed) : DEFAULT_PREFS.speed,
    autoLoop: typeof p.autoLoop === 'boolean' ? p.autoLoop : DEFAULT_PREFS.autoLoop,
    showSubs: typeof p.showSubs === 'boolean' ? p.showSubs : DEFAULT_PREFS.showSubs,
    mode: p.mode === 'dictation' || p.mode === 'watch' ? p.mode : DEFAULT_PREFS.mode,
  };
  if (typeof p.changedAt === 'number' && Number.isFinite(p.changedAt) && p.changedAt > 0) out.changedAt = p.changedAt;
  return out;
}

/** Accepts anything read from storage (including the legacy bare-array shape). */
export function sanitizeLibrary(v: unknown): MediaLibrary {
  const rawItems = Array.isArray(v) ? v : isObj(v) && Array.isArray(v.items) ? v.items : [];
  const seen = new Set<string>();
  const items: MediaItem[] = [];
  for (const r of rawItems) {
    const it = sanitizeItem(r);
    if (it && !seen.has(it.id)) {
      seen.add(it.id);
      items.push(it);
    }
  }
  return { items, prefs: sanitizePrefs(isObj(v) ? v.prefs : undefined) };
}

// ------------------------------------------------------------------ creating

export function makeId(now: number = Date.now(), rand: () => number = Math.random): string {
  return `m${now.toString(36)}${Math.floor(rand() * 1e8).toString(36)}`;
}

export interface NewItemInput {
  kind: MediaKind;
  title: string;
  youtubeId?: string;
  fileName?: string;
  fileType?: MediaFileType;
  units: MediaUnit[];
}

export function createItem(input: NewItemInput, now: number = Date.now(), id: string = makeId(now)): MediaItem {
  const units = sanitizeUnits(input.units);
  const fallbackTitle =
    input.kind === 'youtube' ? `Video YouTube ${input.youtubeId ?? ''}`.trim() : stripExtension(input.fileName ?? '') || 'Tệp âm thanh';
  const item: MediaItem = {
    id,
    kind: input.kind,
    title: (input.title.trim() || fallbackTitle).slice(0, MAX_TITLE_LENGTH),
    createdAt: now,
    openedAt: now,
    units,
    progress: { unitIndex: 0, done: [], scores: {} },
  };
  if (input.kind === 'youtube') item.youtubeId = input.youtubeId;
  else {
    item.fileName = input.fileName ?? '';
    item.fileType = input.fileType ?? 'video';
  }
  return item;
}

export function stripExtension(name: string): string {
  return name.replace(/\.[a-z0-9]{1,5}$/i, '').replace(/[_]+/g, ' ').trim();
}

/** Size of a string in UTF-8 bytes. */
export function byteLength(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      n += 4;
      i++;
    } else n += 3;
  }
  return n;
}

export function transcriptTooLarge(text: string): boolean {
  return byteLength(text) > MAX_TRANSCRIPT_BYTES;
}

// ------------------------------------------------------------------ progress (immutable updates)

export function setUnitIndex(item: MediaItem, index: number): MediaItem {
  const i = clampIndex(index, item.units.length);
  if (i === item.progress.unitIndex) return item;
  return { ...item, progress: { ...item.progress, unitIndex: i } };
}

export function setDone(item: MediaItem, index: number, done: boolean): MediaItem {
  if (index < 0 || index >= item.units.length) return item;
  const has = item.progress.done.includes(index);
  if (has === done) return item;
  const next = done ? [...item.progress.done, index].sort((a, b) => a - b) : item.progress.done.filter((d) => d !== index);
  return { ...item, progress: { ...item.progress, done: next } };
}

/** Keep the best score; mark done when it reaches DONE_SCORE. */
export function recordScore(item: MediaItem, index: number, score: number): MediaItem {
  if (index < 0 || index >= item.units.length || !Number.isFinite(score)) return item;
  const s = Math.min(1, Math.max(0, score));
  const prev = item.progress.scores[index];
  const best = prev === undefined ? s : Math.max(prev, s);
  const updated: MediaItem = { ...item, progress: { ...item.progress, scores: { ...item.progress.scores, [index]: best } } };
  return best >= DONE_SCORE ? setDone(updated, index, true) : updated;
}

export function resetProgress(item: MediaItem): MediaItem {
  return { ...item, progress: { unitIndex: 0, done: [], scores: {} } };
}

export function donePercent(item: MediaItem): number {
  if (item.units.length === 0) return 0;
  return Math.round((item.progress.done.length / item.units.length) * 100);
}

/** Average of the best dictation scores so far (null when none). */
export function averageScore(item: MediaItem): number | null {
  const vals = Object.values(item.progress.scores);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** First unit at/after `from` that is not done, wrapping around; -1 when all are done. */
export function nextUndone(item: MediaItem, from: number): number {
  const n = item.units.length;
  const done = new Set(item.progress.done);
  for (let k = 0; k < n; k++) {
    const i = (((from + k) % n) + n) % n;
    if (!done.has(i)) return i;
  }
  return -1;
}

export function clampIndex(i: number, length: number): number {
  if (length <= 0 || !Number.isFinite(i)) return 0;
  return Math.min(length - 1, Math.max(0, Math.trunc(i)));
}

// ------------------------------------------------------------------ playback helpers

/** Index of the unit being spoken at time t (or the last one that started before t); -1 before the first. */
export function unitAtTime(units: readonly MediaUnit[], t: number): number {
  let lo = 0;
  let hi = units.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (units[mid].start <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

export interface PlayWindow {
  start: number;
  end: number;
}

/**
 * The time range to play for one unit: a short lead-in (captions are often a little late)
 * and a small tail so the last word is not clipped, without bleeding far into neighbours.
 */
export function playWindow(units: readonly MediaUnit[], index: number, lead = 0.15, tail = 0.35): PlayWindow {
  const u = units[index];
  if (!u) return { start: 0, end: 0 };
  const prev = units[index - 1];
  const next = units[index + 1];
  const start = Math.max(0, prev ? Math.max(prev.end - 0.05, u.start - lead) : u.start - lead);
  const end = next ? Math.min(u.end + tail, Math.max(u.end, next.start + 0.1)) : u.end + tail;
  return { start: Math.min(start, u.start), end: Math.max(end, u.start + 0.3) };
}

/** Number of words (for masked transcript lines). */
export function wordCount(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** Vietnamese relative day label: "Hôm nay", "Hôm qua", "3 ngày trước", or d/m/yyyy. */
export function relativeDay(ts: number | undefined, now: number = Date.now()): string {
  if (!ts || !Number.isFinite(ts)) return 'Chưa mở';
  const a = new Date(ts);
  const b = new Date(now);
  const dayA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const dayB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  const diff = Math.round((dayB - dayA) / 86_400_000);
  if (diff <= 0) return 'Hôm nay';
  if (diff === 1) return 'Hôm qua';
  if (diff < 7) return `${diff} ngày trước`;
  return `${a.getDate()}/${a.getMonth() + 1}/${a.getFullYear()}`;
}

/** Items sorted for the library list: most recently opened/created first. */
export function sortItems(items: readonly MediaItem[]): MediaItem[] {
  return [...items].sort((x, y) => (y.openedAt ?? y.createdAt) - (x.openedAt ?? x.createdAt));
}

const AUDIO_EXT = /\.(mp3|m4a|aac|wav|wave|ogg|oga|opus|flac|weba|amr|aiff?)$/i;

/** Audio or video, from the MIME type, or from the extension when the browser gives none. */
export function guessFileType(name: string, mime: string): MediaFileType {
  if (/^audio\//i.test(mime)) return 'audio';
  if (/^video\//i.test(mime)) return 'video';
  return AUDIO_EXT.test(name) ? 'audio' : 'video';
}

const MEDIA_EXT = /\.(mp3|m4a|aac|wav|wave|ogg|oga|opus|flac|weba|amr|aiff?|mp4|m4v|mov|webm|mkv|ogv|avi|3gp)$/i;

/** True when a chosen file looks like audio / video (by MIME type, or by extension when MIME is empty). */
export function isMediaFile(name: string, mime: string): boolean {
  if (mime) return /^(audio|video)\//i.test(mime);
  return MEDIA_EXT.test(name);
}

/** An existing library item for the same YouTube video (to warn before adding it twice). */
export function findYouTubeDuplicate(items: readonly MediaItem[], youtubeId: string | null): MediaItem | null {
  if (!youtubeId) return null;
  return items.find((i) => i.kind === 'youtube' && i.youtubeId === youtubeId) ?? null;
}
