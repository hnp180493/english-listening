// "Nhật ký nghe": the learner's log of real listening (films, YouTube, podcasts, the app's own "Video thật"),
// the "Bắt đầu nghe" stopwatch and the in-app video auto-log. See docs/progress-report.md.
//
// Storage:
// - KEYS.listeningLog ('listening-log', synced): { version: 1, entries: StoredListening[] }. Deletes leave a
//   tombstone { id, updatedAt, deleted: true } so the folder-sync merge (union by id, newer updatedAt wins,
//   core/syncMerge mergeListeningLog) carries them to the other machines. Tombstones older than
//   TOMBSTONE_TTL_DAYS are pruned on the next write: a machine offline for longer could bring a deleted entry back.
// - KEYS.listeningTimer ('listening-timer', device-local): the running stopwatch of this browser.
// - KEYS.listeningPending ('listening-pending', device-local): in-app video seconds below one minute.
//
// Days are local calendar days 'YYYY-MM-DD' (core/stats localDay). Week maths goes through the Date
// constructor (DST-safe), never `+ k * DAY`.

import { useSyncExternalStore } from 'react';
import { deviceId } from './history';
import { localDay } from './stats';
import { KEYS, loadJSON, onAppWrite, saveJSON, removeKey, STORAGE_PREFIX } from './storage';

// ───────────────────────── types and labels ─────────────────────────

export type ListeningSource = 'phim' | 'youtube' | 'podcast' | 'app' | 'khac';
export const LISTENING_SOURCES: readonly ListeningSource[] = ['phim', 'youtube', 'podcast', 'app', 'khac'];
export const SOURCE_LABEL: Record<ListeningSource, string> = {
  phim: 'Phim/series',
  youtube: 'YouTube',
  podcast: 'Podcast/audio',
  app: 'Video thật trong app',
  khac: 'Khác',
};

/** Self-rated share of the audio understood: 1 "<30%" … 5 ">90%". */
export type Understood = 1 | 2 | 3 | 4 | 5;
export const UNDERSTOOD_LEVELS: readonly Understood[] = [1, 2, 3, 4, 5];
export const UNDERSTOOD_LABEL: Record<Understood, string> = {
  1: '<30%',
  2: '30–50%',
  3: '50–70%',
  4: '70–90%',
  5: '>90%',
};

export type SubtitleMode = 'none' | 'en' | 'vi';
export const SUBTITLE_MODES: readonly SubtitleMode[] = ['none', 'en', 'vi'];
export const SUBTITLE_LABEL: Record<SubtitleMode, string> = {
  none: 'Không phụ đề',
  en: 'Phụ đề Anh',
  vi: 'Phụ đề Việt',
};

export interface ListeningEntry {
  id: string;
  startedAt: number; // epoch ms (for the timer: when it was first started)
  day: string; // local 'YYYY-MM-DD' the minutes count for (authoritative for every day/week total)
  minutes: number; // integer, MIN_MINUTES..MAX_MINUTES
  source: ListeningSource;
  title?: string; // ≤ TITLE_MAX characters
  understood?: Understood;
  subtitles?: SubtitleMode;
  mediaId?: string; // source 'app' only: the media item (auto-log merges into the same day + item)
  seconds?: number; // source 'app' only: exact listened seconds (minutes = round(seconds / 60))
  dev?: string; // source 'app' only: the browser (core/history deviceId) whose auto-log owns this entry
  updatedAt: number; // epoch ms of the last change (merge: newer wins)
}

export interface ListeningTombstone {
  id: string;
  updatedAt: number;
  deleted: true;
}

export type StoredListening = ListeningEntry | ListeningTombstone;

export interface ListeningLogStore {
  version: 1;
  entries: StoredListening[];
}

export const MIN_MINUTES = 1;
export const MAX_MINUTES = 600;
export const TITLE_MAX = 120;
export const TOMBSTONE_TTL_DAYS = 180;
/** A timer running longer than this makes the save form warn ("Bạn quên tắt đồng hồ?"). */
export const LONG_TIMER_MS = 4 * 3_600_000;
/** Lifetime listening milestones, in hours. */
export const MILESTONE_HOURS: readonly number[] = [10, 25, 50, 100, 200, 300, 500, 750, 1000];
/** Quick-add minute chips. */
export const QUICK_MINUTES: readonly number[] = [15, 30, 45, 60];

const DAY_MS = 86_400_000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const isTombstone = (e: StoredListening): e is ListeningTombstone => (e as ListeningTombstone).deleted === true;

// ───────────────────────── day helpers (DST-safe) ─────────────────────────

/** True for a real calendar day 'YYYY-MM-DD'. */
export function isDay(v: unknown): v is string {
  if (typeof v !== 'string' || !DAY_RE.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/** Local midnight that starts `day`. */
export function dayStart(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

/** `day` shifted by `n` calendar days. */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return localDay(new Date(y, m - 1, d + n).getTime());
}

/** The Monday starting the week that contains `day` (weeks start on Monday). */
export function weekStartDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return localDay(new Date(y, m - 1, d - ((dt.getDay() + 6) % 7)).getTime());
}

/** Calendar days from `a` to `b` (negative when `b` is earlier). */
export function daysBetween(a: string, b: string): number {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / DAY_MS);
}

/** 'dd/mm' of a day. */
export function ddmm(day: string): string {
  const [, m, d] = day.split('-');
  return `${d}/${m}`;
}

// ───────────────────────── formatting ─────────────────────────

/** "3 giờ 20 phút", "45 phút", "2 giờ", "0 phút". */
export function formatMinutesVi(minutes: number): string {
  const m = Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} phút`;
  return r === 0 ? `${h} giờ` : `${h} giờ ${r} phút`;
}

/** Integer with Vietnamese thousands dots: 2413 → "2.413", 1000 → "1.000", 950 → "950". */
export function groupVi(n: number): string {
  const v = Math.round(Number.isFinite(n) ? n : 0);
  const sign = v < 0 ? '-' : '';
  return sign + String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Hours with one decimal and a Vietnamese comma: "12,5 giờ", "3 giờ", "0 giờ", "2.413 giờ" (no decimal from 100 h). */
export function formatHoursVi(minutes: number): string {
  const raw = Math.max(0, Number.isFinite(minutes) ? minutes : 0) / 60;
  if (raw >= 100) return `${groupVi(raw)} giờ`;
  const h = Math.round(raw * 10) / 10;
  return `${String(h).replace('.', ',')} giờ`;
}

/**
 * One duration format for every listening total of the report and the log: below 10 hours "3 giờ 20 phút"
 * (formatMinutesVi), from 10 hours "46,1 giờ" / "2.413 giờ" (formatHoursVi). The same number never shows in
 * two styles side by side.
 */
export function formatDurationVi(minutes: number): string {
  const m = Number.isFinite(minutes) ? Math.max(0, minutes) : 0;
  return m >= 600 ? formatHoursVi(m) : formatMinutesVi(m);
}

/** Stopwatch text: "4:05", "12:34", "1:02:03". */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor((Number.isFinite(ms) ? ms : 0) / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

// ───────────────────────── sanitizing ─────────────────────────

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Minutes as stored: an integer MIN_MINUTES..MAX_MINUTES, or null when not a usable number (≤ 0, NaN). */
export function validateMinutes(v: unknown): number | null {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  if (!finite(n)) return null;
  const r = Math.round(n);
  if (r < MIN_MINUTES) return null;
  return Math.min(MAX_MINUTES, r);
}

export function cleanTitle(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.replace(/\s+/g, ' ').trim().slice(0, TITLE_MAX).trim();
  return t || undefined;
}

const isSource = (v: unknown): v is ListeningSource => typeof v === 'string' && (LISTENING_SOURCES as readonly string[]).includes(v);
const isUnderstood = (v: unknown): v is Understood => typeof v === 'number' && (UNDERSTOOD_LEVELS as readonly number[]).includes(v);
const isSubtitle = (v: unknown): v is SubtitleMode => typeof v === 'string' && (SUBTITLE_MODES as readonly string[]).includes(v);

/** One stored record, or null when it is junk. A live entry with a bad field is dropped (never guessed). */
export function sanitizeStored(raw: unknown): StoredListening | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id || r.id.length > 80 || !finite(r.updatedAt)) return null;
  if (r.deleted === true) return { id: r.id, updatedAt: r.updatedAt, deleted: true };
  const minutes = validateMinutes(r.minutes);
  if (minutes === null || !isDay(r.day) || !finite(r.startedAt) || !isSource(r.source)) return null;
  const e: ListeningEntry = { id: r.id, startedAt: r.startedAt, day: r.day, minutes, source: r.source, updatedAt: r.updatedAt };
  const title = cleanTitle(r.title);
  if (title) e.title = title;
  if (isUnderstood(r.understood)) e.understood = r.understood;
  if (isSubtitle(r.subtitles)) e.subtitles = r.subtitles;
  if (r.source === 'app' && typeof r.mediaId === 'string' && r.mediaId) e.mediaId = r.mediaId.slice(0, 80);
  if (r.source === 'app' && finite(r.seconds) && r.seconds > 0) e.seconds = Math.round(r.seconds);
  if (r.source === 'app' && typeof r.dev === 'string' && /^[a-z0-9-]{4,40}$/.test(r.dev)) e.dev = r.dev;
  return e;
}

/** The stored log (any shape) → records; duplicate ids keep the newer record. */
export function parseListeningLog(raw: unknown): StoredListening[] {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? (raw as { entries?: unknown }).entries : null;
  if (!Array.isArray(list)) return [];
  const byId = new Map<string, StoredListening>();
  for (const it of list) {
    const e = sanitizeStored(it);
    if (!e) continue;
    const prev = byId.get(e.id);
    if (!prev || e.updatedAt > prev.updatedAt || (e.updatedAt === prev.updatedAt && isTombstone(e))) byId.set(e.id, e);
  }
  return [...byId.values()];
}

/** Live entries, newest first (day, then start time). */
export function liveEntries(list: readonly StoredListening[]): ListeningEntry[] {
  return list
    .filter((e): e is ListeningEntry => !isTombstone(e))
    .sort((a, b) => (a.day === b.day ? b.startedAt - a.startedAt : a.day < b.day ? 1 : -1));
}

/** Drop tombstones older than TOMBSTONE_TTL_DAYS. */
export function pruneTombstones(list: readonly StoredListening[], now: number): StoredListening[] {
  const cutoff = now - TOMBSTONE_TTL_DAYS * DAY_MS;
  return list.filter((e) => !isTombstone(e) || e.updatedAt >= cutoff);
}

// ───────────────────────── store ─────────────────────────

/** Set only while the last write failed (blocked/full storage): this session's records live here. */
let session: StoredListening[] | null = null;
let cacheRaw: string | null | undefined;
let cacheSession: StoredListening[] | null = null;
let cacheList: ListeningEntry[] = [];
const listeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + KEYS.listeningLog);
  } catch {
    return null;
  }
}

function readStored(): StoredListening[] {
  if (session) return session;
  return parseListeningLog(loadJSON<unknown>(KEYS.listeningLog, null));
}

function notify(): void {
  for (const fn of [...listeners]) {
    try {
      fn();
    } catch {
      // a listener must never break a write
    }
  }
}

function writeStored(list: StoredListening[], now: number): boolean {
  const pruned = pruneTombstones(list, now);
  const value: ListeningLogStore = { version: 1, entries: pruned };
  const saved = saveJSON(KEYS.listeningLog, value);
  session = saved ? null : pruned;
  cacheRaw = undefined;
  notify();
  return saved;
}

/** Every stored record (tombstones included). */
export function loadListeningLog(): StoredListening[] {
  return readStored();
}

/**
 * Live entries, newest first. Stable identity while the stored value is unchanged (safe as a
 * useSyncExternalStore snapshot); picks up writes from other tabs and folder sync by itself.
 */
export function getListeningEntries(): readonly ListeningEntry[] {
  if (session) {
    if (cacheSession !== session) {
      cacheList = liveEntries(session);
      cacheSession = session;
      cacheRaw = undefined;
    }
    return cacheList;
  }
  const raw = readRaw();
  if (raw !== cacheRaw || cacheSession) {
    cacheSession = null;
    let parsed: unknown = null;
    try {
      parsed = raw == null ? null : JSON.parse(raw);
    } catch {
      parsed = null;
    }
    cacheList = liveEntries(parseListeningLog(parsed));
    cacheRaw = raw;
  }
  return cacheList;
}

let hooked = false;
function ensureHooks(): void {
  if (hooked) return;
  hooked = true;
  onAppWrite((key) => {
    if (key === KEYS.listeningLog || key === KEYS.listeningTimer || key === '*') {
      cacheRaw = undefined;
      notify();
    }
  });
  try {
    window.addEventListener('storage', (e) => {
      if (e.key === null || e.key === STORAGE_PREFIX + KEYS.listeningLog || e.key === STORAGE_PREFIX + KEYS.listeningTimer) {
        cacheRaw = undefined;
        notify();
      }
    });
  } catch {
    // no DOM (tests)
  }
}

/** Called after any change to the log or the timer (this tab, another tab, folder sync). */
export function subscribeListening(fn: () => void): () => void {
  ensureHooks();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Re-read from storage (after folder sync replaced the stored data) and notify subscribers. */
export function reloadListening(): void {
  session = null;
  cacheRaw = undefined;
  notify();
}

/** Live log entries, newest first; re-renders on every change. */
export function useListeningEntries(): readonly ListeningEntry[] {
  return useSyncExternalStore(subscribeListening, getListeningEntries, getListeningEntries);
}

export function newListeningId(now: number, rand: () => number = Math.random): string {
  return `l-${now.toString(36)}-${Math.floor(rand() * 36 ** 5).toString(36).padStart(5, '0')}`;
}

export interface ListeningInput {
  minutes: number;
  source: ListeningSource;
  title?: string;
  understood?: Understood | null;
  subtitles?: SubtitleMode | null;
  /** Day the minutes count for; default the local day of `startedAt` (or of now). */
  day?: string;
  /** Default: for today, now − minutes; for another day, 12:00 of that day. */
  startedAt?: number;
}

/** Build a valid entry from form input, or null when the minutes/source/day are not usable. */
export function makeEntry(input: ListeningInput, now: number, id: string = newListeningId(now)): ListeningEntry | null {
  const minutes = validateMinutes(input?.minutes);
  if (minutes === null || !isSource(input.source)) return null;
  const day = input.day ?? localDay(finite(input.startedAt) ? input.startedAt : now);
  if (!isDay(day)) return null;
  const startedAt = finite(input.startedAt)
    ? input.startedAt
    : day === localDay(now)
      ? now - minutes * 60_000
      : dayStart(day) + 12 * 3_600_000;
  const e: ListeningEntry = { id, startedAt, day, minutes, source: input.source, updatedAt: now };
  const title = cleanTitle(input.title);
  if (title) e.title = title;
  if (isUnderstood(input.understood)) e.understood = input.understood;
  if (isSubtitle(input.subtitles)) e.subtitles = input.subtitles;
  return e;
}

/** Log listening minutes. Returns the saved entry (null when the input is invalid). */
export function addListeningEntry(input: ListeningInput, now: number = Date.now()): ListeningEntry | null {
  const e = makeEntry(input, now);
  if (!e) return null;
  writeStored([...readStored(), e], now);
  return e;
}

/**
 * Change an entry. Fields set to null in the patch (understood, subtitles, title '') are removed. Returns the
 * updated entry, or null when the id is unknown/deleted or the result is invalid.
 */
export function updateListeningEntry(
  id: string,
  patch: Partial<Omit<ListeningInput, 'startedAt'>>,
  now: number = Date.now(),
): ListeningEntry | null {
  const list = readStored();
  const i = list.findIndex((e) => e.id === id);
  const prev = i >= 0 ? list[i] : null;
  if (!prev || isTombstone(prev)) return null;
  const minutes = patch.minutes === undefined ? prev.minutes : validateMinutes(patch.minutes);
  const source = patch.source === undefined ? prev.source : patch.source;
  const day = patch.day === undefined ? prev.day : patch.day;
  if (minutes === null || !isSource(source) || !isDay(day)) return null;
  const next: ListeningEntry = { ...prev, minutes, source, day, updatedAt: Math.max(now, prev.updatedAt + 1) };
  if (patch.title !== undefined) {
    const t = cleanTitle(patch.title);
    if (t) next.title = t;
    else delete next.title;
  }
  if (patch.understood !== undefined) {
    if (isUnderstood(patch.understood)) next.understood = patch.understood;
    else delete next.understood;
  }
  if (patch.subtitles !== undefined) {
    if (isSubtitle(patch.subtitles)) next.subtitles = patch.subtitles;
    else delete next.subtitles;
  }
  if (source !== 'app') {
    delete next.mediaId;
    delete next.seconds;
    delete next.dev;
  } else if (patch.minutes !== undefined) {
    next.seconds = minutes * 60; // a hand-edited duration replaces the measured one
  }
  const out = [...list];
  out[i] = next;
  writeStored(out, now);
  return next;
}

/** Delete an entry (leaves a tombstone). Returns the deleted entry so the UI can offer "Hoàn tác". */
export function deleteListeningEntry(id: string, now: number = Date.now()): ListeningEntry | null {
  const list = readStored();
  const i = list.findIndex((e) => e.id === id);
  const prev = i >= 0 ? list[i] : null;
  if (!prev || isTombstone(prev)) return null;
  const out = [...list];
  out[i] = { id, updatedAt: Math.max(now, prev.updatedAt + 1), deleted: true };
  writeStored(out, now);
  return prev;
}

/** Undo a delete: the entry comes back with a newer updatedAt (so it also wins over the tombstone elsewhere). */
export function restoreListeningEntry(entry: ListeningEntry, now: number = Date.now()): ListeningEntry | null {
  const clean = sanitizeStored(entry);
  if (!clean || isTombstone(clean)) return null;
  const list = readStored();
  const i = list.findIndex((e) => e.id === clean.id);
  const floor = i >= 0 ? list[i].updatedAt + 1 : 0;
  const next: ListeningEntry = { ...clean, updatedAt: Math.max(now, floor) };
  const out = [...list];
  if (i >= 0) out[i] = next;
  else out.push(next);
  writeStored(out, now);
  return next;
}

// ───────────────────────── in-app video auto-log ─────────────────────────

/** Seconds below one minute, per 'day|mediaId' (device-local). Older days are dropped: < 1 minute is ignored. */
type Pending = Record<string, { seconds: number; title?: string }>;

function readPending(day: string): Pending {
  const raw = loadJSON<unknown>(KEYS.listeningPending, null);
  const out: Pending = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!k.startsWith(day + '|') || !v || typeof v !== 'object') continue;
    const s = (v as { seconds?: unknown }).seconds;
    if (finite(s) && s > 0) out[k] = { seconds: s, title: cleanTitle((v as { title?: unknown }).title) };
  }
  return out;
}

/** Longest single flush accepted (a player left "playing" overnight is not listening). */
export const MAX_FLUSH_SECONDS = 6 * 3600;

/**
 * Real playing time of an in-app video ("Video thật"). Adds to today's entry for the same media item (source
 * 'app'); below one minute in total for the day nothing is logged yet (kept on this device until it reaches a
 * minute). Returns the created/updated entry, or null when nothing was written.
 */
export function addAppListening(itemId: string, title: string, seconds: number, at: number = Date.now()): ListeningEntry | null {
  if (typeof itemId !== 'string' || !itemId || !finite(seconds) || seconds <= 0) return null;
  const s = Math.min(MAX_FLUSH_SECONDS, seconds);
  const day = localDay(at);
  const dev = deviceId();
  const list = readStored();
  // Only this browser's own entry is incremented: the log merges last-writer-wins per id, so two machines adding
  // to one shared entry between syncs would lose one machine's seconds. Each browser keeps its own entry per
  // day and video instead (the list shows them as separate rows; every total sums them).
  const i = list.findIndex((e) => !isTombstone(e) && e.source === 'app' && e.mediaId === itemId && e.day === day && e.dev === dev);
  if (i >= 0) {
    const prev = list[i] as ListeningEntry;
    const total = (prev.seconds ?? prev.minutes * 60) + s;
    const minutes = Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(total / 60)));
    const next: ListeningEntry = { ...prev, seconds: Math.round(total), minutes, updatedAt: Math.max(at, prev.updatedAt + 1) };
    const out = [...list];
    out[i] = next;
    writeStored(out, at);
    return next;
  }
  const pending = readPending(day);
  const key = `${day}|${itemId}`;
  const total = (pending[key]?.seconds ?? 0) + s;
  if (total < 60) {
    pending[key] = { seconds: total, title: cleanTitle(title) ?? pending[key]?.title };
    saveJSON(KEYS.listeningPending, pending);
    return null;
  }
  const name = cleanTitle(title) ?? pending[key]?.title;
  delete pending[key];
  if (Object.keys(pending).length) saveJSON(KEYS.listeningPending, pending);
  else removeKey(KEYS.listeningPending);
  const e = makeEntry({ minutes: total / 60, source: 'app', title: name, day, startedAt: at - total * 1000 }, at);
  if (!e) return null;
  e.mediaId = itemId.slice(0, 80);
  e.seconds = Math.round(total);
  e.dev = dev;
  writeStored([...list, e], at);
  return e;
}

/** Counts real playing seconds between flushes (feed it the player's playing/paused changes). */
export interface ListenMeter {
  setPlaying(playing: boolean, at?: number): void;
  /** Seconds played since the last flush (a running span counts up to `at`); resets the count. */
  flush(at?: number): number;
  readonly playing: boolean;
}

export function createListenMeter(): ListenMeter {
  let since: number | null = null;
  let acc = 0;
  const span = (at: number) => (since === null ? 0 : Math.min(MAX_FLUSH_SECONDS * 1000, Math.max(0, at - since)));
  return {
    get playing() {
      return since !== null;
    },
    setPlaying(playing, at = Date.now()) {
      if (playing && since === null) since = at;
      else if (!playing && since !== null) {
        acc += span(at);
        since = null;
      }
    },
    flush(at = Date.now()) {
      const ms = acc + span(at);
      acc = 0;
      if (since !== null) since = at;
      return ms / 1000;
    },
  };
}

// ───────────────────────── stopwatch (device-local) ─────────────────────────

export interface ListeningTimer {
  startedAt: number; // first start (epoch ms)
  runningSince: number | null; // null while paused / stopped
  accumulatedMs: number; // time counted before runningSince
  stoppedAt?: number; // set by stopTimer: frozen, waiting for the save form (survives a reload)
  lastStartAt?: number; // start of the latest running span (start or resume): decides the day the minutes count for
  source?: ListeningSource;
  title?: string;
}

export type TimerStatus = 'running' | 'paused' | 'stopped';

export function timerStatus(t: ListeningTimer): TimerStatus {
  return t.stoppedAt !== undefined ? 'stopped' : t.runningSince !== null ? 'running' : 'paused';
}

/** Counted time; a clock that went backwards never makes it shrink below what was accumulated. */
export function timerElapsedMs(t: ListeningTimer | null, now: number = Date.now()): number {
  if (!t) return 0;
  return t.accumulatedMs + (t.runningSince === null ? 0 : Math.max(0, now - t.runningSince));
}

function sanitizeTimer(raw: unknown): ListeningTimer | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (!finite(r.startedAt)) return null;
  const t: ListeningTimer = {
    startedAt: r.startedAt,
    runningSince: finite(r.runningSince) ? r.runningSince : null,
    accumulatedMs: finite(r.accumulatedMs) && r.accumulatedMs > 0 ? r.accumulatedMs : 0,
  };
  if (finite(r.stoppedAt)) {
    t.stoppedAt = r.stoppedAt;
    t.runningSince = null;
  }
  if (finite(r.lastStartAt)) t.lastStartAt = r.lastStartAt;
  if (isSource(r.source)) t.source = r.source;
  const title = cleanTitle(r.title);
  if (title) t.title = title;
  return t;
}

let timerSession: ListeningTimer | null | undefined; // only while a timer write failed
let timerCacheRaw: string | null | undefined;
let timerCache: ListeningTimer | null = null;

function readTimerRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_PREFIX + KEYS.listeningTimer);
  } catch {
    return null;
  }
}

/** This browser's stopwatch, or null. Stable identity while unchanged (safe as a useSyncExternalStore snapshot). */
export function getTimer(): ListeningTimer | null {
  if (timerSession !== undefined) return timerSession;
  const raw = readTimerRaw();
  if (raw !== timerCacheRaw) {
    let parsed: unknown = null;
    try {
      parsed = raw == null ? null : JSON.parse(raw);
    } catch {
      parsed = null;
    }
    timerCache = sanitizeTimer(parsed);
    timerCacheRaw = raw;
  }
  return timerCache;
}

function writeTimer(t: ListeningTimer | null): void {
  let ok: boolean;
  if (t) ok = saveJSON(KEYS.listeningTimer, t);
  else {
    removeKey(KEYS.listeningTimer);
    ok = readTimerRaw() === null;
  }
  timerSession = ok ? undefined : t;
  timerCacheRaw = undefined;
  notify();
}

/** Start the stopwatch (a running/paused one is resumed; a stopped one waiting for its form is kept). */
export function startTimer(opts: { source?: ListeningSource; title?: string } = {}, now: number = Date.now()): ListeningTimer {
  const cur = getTimer();
  if (cur) {
    if (timerStatus(cur) === 'paused') return resumeTimer(now) ?? cur;
    return cur;
  }
  const t: ListeningTimer = { startedAt: now, runningSince: now, accumulatedMs: 0, lastStartAt: now };
  if (isSource(opts.source)) t.source = opts.source;
  const title = cleanTitle(opts.title);
  if (title) t.title = title;
  writeTimer(t);
  return t;
}

export function pauseTimer(now: number = Date.now()): ListeningTimer | null {
  const t = getTimer();
  if (!t || timerStatus(t) !== 'running') return t;
  const next: ListeningTimer = { ...t, accumulatedMs: timerElapsedMs(t, now), runningSince: null };
  writeTimer(next);
  return next;
}

export function resumeTimer(now: number = Date.now()): ListeningTimer | null {
  const t = getTimer();
  if (!t || timerStatus(t) !== 'paused') return t;
  const next: ListeningTimer = { ...t, runningSince: now, lastStartAt: now };
  writeTimer(next);
  return next;
}

/** Source / title chosen while the timer runs (shown prefilled in the save form). */
export function setTimerInfo(info: { source?: ListeningSource | null; title?: string | null }): ListeningTimer | null {
  const t = getTimer();
  if (!t) return null;
  const next: ListeningTimer = { ...t };
  if (info.source !== undefined) {
    if (isSource(info.source)) next.source = info.source;
    else delete next.source;
  }
  if (info.title !== undefined) {
    const title = cleanTitle(info.title);
    if (title) next.title = title;
    else delete next.title;
  }
  writeTimer(next);
  return next;
}

/** What the save form is prefilled with after "Dừng". */
export interface TimerSummary {
  startedAt: number;
  day: string; // local day of the latest running span (a timer paused at night and resumed next morning counts for the morning)
  elapsedMs: number;
  minutes: number; // suggested: rounded, MIN_MINUTES..MAX_MINUTES (editable)
  tooShort: boolean; // under one minute
  tooLong: boolean; // over LONG_TIMER_MS: "Bạn quên tắt đồng hồ? Hãy sửa lại số phút."
  source?: ListeningSource;
  title?: string;
}

/**
 * The day a stopwatch's minutes count for: the day its latest running span started. A timer run 22:00–22:05,
 * paused, then resumed 08:00–08:55 next day counts for the next day (most of it was listened to then); a timer
 * run 23:30–00:20 without a pause counts for the day it started. The save form lets the learner change it.
 */
export function timerDay(t: ListeningTimer): string {
  return localDay(t.lastStartAt ?? t.startedAt);
}

export function timerSummary(t: ListeningTimer, now: number = Date.now()): TimerSummary {
  const elapsedMs = timerElapsedMs(t, t.stoppedAt ?? now);
  return {
    startedAt: t.startedAt,
    day: timerDay(t),
    elapsedMs,
    minutes: Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(elapsedMs / 60_000))),
    tooShort: elapsedMs < 60_000,
    tooLong: elapsedMs > LONG_TIMER_MS,
    ...(t.source ? { source: t.source } : {}),
    ...(t.title ? { title: t.title } : {}),
  };
}

/** "Dừng": freeze the timer (it stays stored, so a reload brings the save form back). */
export function stopTimer(now: number = Date.now()): TimerSummary | null {
  const t = getTimer();
  if (!t) return null;
  if (timerStatus(t) === 'stopped') return timerSummary(t, now);
  const next: ListeningTimer = { ...t, accumulatedMs: timerElapsedMs(t, now), runningSince: null, stoppedAt: now };
  writeTimer(next);
  return timerSummary(next, now);
}

/** Save the stopped timer as an entry (form values win over the timer's) and clear it. */
export function saveTimer(input: Omit<ListeningInput, 'startedAt'>, now: number = Date.now()): ListeningEntry | null {
  const t = getTimer();
  const e = addListeningEntry({ ...input, startedAt: t?.startedAt, day: input.day ?? (t ? timerDay(t) : undefined) }, now);
  if (e) writeTimer(null);
  return e;
}

/** Throw the timer away without logging anything. */
export function discardTimer(): void {
  writeTimer(null);
}

/** The stopwatch; re-renders on start/pause/stop (not every second: tick with your own clock + timerElapsedMs). */
export function useListeningTimer(): ListeningTimer | null {
  return useSyncExternalStore(subscribeListening, getTimer, getTimer);
}

// ───────────────────────── selectors (pure) ─────────────────────────

export function minutesOnDay(entries: readonly ListeningEntry[], day: string): number {
  let m = 0;
  for (const e of entries) if (e.day === day) m += e.minutes;
  return m;
}

/** Minutes of entries whose day is in [fromDay, toDay] (inclusive; either bound may be omitted). */
export function minutesBetween(entries: readonly ListeningEntry[], fromDay?: string, toDay?: string): number {
  let m = 0;
  for (const e of entries) if ((!fromDay || e.day >= fromDay) && (!toDay || e.day <= toDay)) m += e.minutes;
  return m;
}

export function totalMinutes(entries: readonly ListeningEntry[]): number {
  return minutesBetween(entries);
}

/** Distinct days with any listening in [fromDay, toDay]. */
export function listeningDays(entries: readonly ListeningEntry[], fromDay?: string, toDay?: string): string[] {
  const s = new Set<string>();
  for (const e of entries) if ((!fromDay || e.day >= fromDay) && (!toDay || e.day <= toDay)) s.add(e.day);
  return [...s].sort();
}

export interface TodayListening {
  minutes: number;
  goal: number; // 0 = no goal (tắt)
  pct: number; // 0..100 capped; 0 when there is no goal
  done: boolean; // goal reached (false when there is no goal)
}

export function listeningToday(entries: readonly ListeningEntry[], now: number, goal: number): TodayListening {
  const minutes = minutesOnDay(entries, localDay(now));
  const g = finite(goal) && goal > 0 ? goal : 0;
  return { minutes, goal: g, pct: g ? Math.min(100, Math.round((minutes / g) * 100)) : 0, done: g > 0 && minutes >= g };
}

export interface Milestone {
  reachedHours: number; // last milestone reached (0 = none yet)
  nextHours: number | null; // null once every milestone is reached
  remainingMinutes: number; // to the next milestone (0 when none)
  progress: number; // 0..1 from the last reached milestone to the next (1 when none left)
  label: string; // "Còn 3 giờ 20 phút đến mốc 10 giờ" / "Đã qua mốc 1000 giờ"
}

export function nextMilestone(totalMin: number): Milestone {
  const total = Math.max(0, finite(totalMin) ? totalMin : 0);
  let reached = 0;
  for (const h of MILESTONE_HOURS) if (total >= h * 60) reached = h;
  const next = MILESTONE_HOURS.find((h) => total < h * 60) ?? null;
  if (next === null) {
    return { reachedHours: reached, nextHours: null, remainingMinutes: 0, progress: 1, label: `Đã qua mốc ${groupVi(reached)} giờ` };
  }
  const remainingMinutes = Math.ceil(next * 60 - total);
  return {
    reachedHours: reached,
    nextHours: next,
    remainingMinutes,
    progress: Math.min(1, Math.max(0, (total - reached * 60) / ((next - reached) * 60))),
    label: `Còn ${formatDurationVi(remainingMinutes)} đến mốc ${groupVi(next)} giờ`,
  };
}

export interface ListenWeek {
  key: string; // Monday 'YYYY-MM-DD'
  start: number; // local Monday 00:00
  label: string; // 'dd/mm' of the Monday
  rangeLabel: string; // 'dd/mm – dd/mm'
  isCurrent: boolean;
  minutes: number;
  bySource: Record<ListeningSource, number>;
  days: number; // distinct days with listening
  goalDays: number; // days that reached `goal` (0 when no goal given)
}

const emptySources = (): Record<ListeningSource, number> => ({ phim: 0, youtube: 0, podcast: 0, app: 0, khac: 0 });

/** Monday-based weeks, oldest first, ending with the week of `now`. */
export function weekBuckets(entries: readonly ListeningEntry[], now: number, weeks = 8, goal = 0): ListenWeek[] {
  const current = weekStartDay(localDay(now));
  const out: ListenWeek[] = [];
  const index = new Map<string, ListenWeek>();
  const n = Math.max(1, Math.floor(weeks));
  for (let i = n - 1; i >= 0; i--) {
    const key = addDays(current, -7 * i);
    const w: ListenWeek = {
      key,
      start: dayStart(key),
      label: ddmm(key),
      rangeLabel: `${ddmm(key)} – ${ddmm(addDays(key, 6))}`,
      isCurrent: i === 0,
      minutes: 0,
      bySource: emptySources(),
      days: 0,
      goalDays: 0,
    };
    out.push(w);
    index.set(key, w);
  }
  const perDay = new Map<string, number>();
  for (const e of entries) {
    const w = index.get(weekStartDay(e.day));
    if (!w) continue;
    w.minutes += e.minutes;
    w.bySource[e.source] += e.minutes;
    perDay.set(e.day, (perDay.get(e.day) ?? 0) + e.minutes);
  }
  for (const [day, m] of perDay) {
    const w = index.get(weekStartDay(day))!;
    w.days += 1;
    if (goal > 0 && m >= goal) w.goalDays += 1;
  }
  return out;
}

export interface SourceShare {
  source: ListeningSource;
  label: string;
  minutes: number;
  share: number; // 0..1
}

/** Minutes per source in [fromDay, toDay], largest first, sources with minutes only. */
export function sourceSplit(entries: readonly ListeningEntry[], fromDay?: string, toDay?: string): SourceShare[] {
  const by = emptySources();
  let total = 0;
  for (const e of entries) {
    if ((fromDay && e.day < fromDay) || (toDay && e.day > toDay)) continue;
    by[e.source] += e.minutes;
    total += e.minutes;
  }
  return LISTENING_SOURCES.filter((s) => by[s] > 0)
    .map((s) => ({ source: s, label: SOURCE_LABEL[s], minutes: by[s], share: by[s] / total }))
    .sort((a, b) => b.minutes - a.minutes);
}

export interface UnderstoodWeek {
  key: string;
  label: string;
  rangeLabel: string;
  avg: number | null; // minutes-weighted mean of `understood` (1..5, one decimal); null without rated entries
  count: number; // rated entries
  minutes: number; // minutes of rated entries
}

/** Weekly self-rated understanding (only entries that have `understood`), oldest first. */
export function understoodByWeek(entries: readonly ListeningEntry[], now: number, weeks = 8): UnderstoodWeek[] {
  const base = weekBuckets([], now, weeks);
  const acc = new Map<string, { sum: number; minutes: number; count: number }>();
  for (const w of base) acc.set(w.key, { sum: 0, minutes: 0, count: 0 });
  for (const e of entries) {
    if (!e.understood) continue;
    const a = acc.get(weekStartDay(e.day));
    if (!a) continue;
    a.sum += e.understood * e.minutes;
    a.minutes += e.minutes;
    a.count += 1;
  }
  return base.map((w) => {
    const a = acc.get(w.key)!;
    return {
      key: w.key,
      label: w.label,
      rangeLabel: w.rangeLabel,
      avg: a.minutes > 0 ? Math.round((a.sum / a.minutes) * 10) / 10 : null,
      count: a.count,
      minutes: a.minutes,
    };
  });
}

/**
 * The self-rated level nearest to an average: 3.4 → 3. A tie goes to the LOWER level (4.5 → 4, from one "70–90%"
 * and one ">90%"), so an average of self-ratings is never rounded up into a better band.
 */
export function understoodLevel(avg: number): Understood {
  return Math.min(5, Math.max(1, Math.ceil(avg - 0.5))) as Understood;
}

/** The understood label nearest to an average: 3.4 → "50–70%", 4.5 → "70–90%". */
export function understoodLabelFor(avg: number): string {
  return UNDERSTOOD_LABEL[understoodLevel(avg)];
}
