// Persisted drill state (card schedules + today's counters) under KEYS.drill.

import { MAX_INTERVAL_DAYS, MIN_EASE, START_EASE, type CardState, type Grade } from '../../core/srs';
import { localDay } from '../../core/stats';
import { KEYS, STORAGE_PREFIX, loadJSON, saveJSON } from '../../core/storage';

export const NEW_PER_DAY_OPTIONS = [5, 10, 20] as const;
export type NewPerDay = (typeof NEW_PER_DAY_OPTIONS)[number];

export interface DailyCounters {
  day: string; // local "YYYY-MM-DD"
  newIntroduced: number; // new cards started today
  extraNew: number; // extra new cards unlocked today ("Học thêm 5 thẻ mới")
  reviews: number; // grades given today
  studiedIds: string[]; // distinct chunk ids studied today
}

export interface DrillStore {
  version: 1;
  newPerDay: NewPerDay;
  cards: Record<string, CardState>;
  daily: DailyCounters;
  /**
   * Counters of a later local day, kept from another machine whose date is ahead (sync merge around midnight /
   * other timezone): they become `daily` when this machine reaches that day, so new cards are not started twice.
   */
  otherDaily?: DailyCounters;
}

const GRADE_SET = new Set<Grade>(['again', 'hard', 'good', 'easy']);
/** Upper bound for a stored ease; anything above is corrupt data. */
const MAX_EASE = 5;

function emptyDaily(day: string): DailyCounters {
  return { day, newIntroduced: 0, extraNew: 0, reviews: 0, studiedIds: [] };
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function count(v: unknown): number {
  return Math.max(0, Math.floor(num(v, 0)));
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function sanitizeCard(id: string, v: unknown, now: number): CardState | null {
  if (!id || !isRecord(v)) return null;
  const o = v;
  const card: CardState = {
    id,
    due: num(o.due, now),
    interval: Math.min(MAX_INTERVAL_DAYS, Math.max(0, num(o.interval, 0))),
    ease: Math.min(MAX_EASE, Math.max(MIN_EASE, num(o.ease, START_EASE))),
    reps: count(o.reps),
    lapses: count(o.lapses),
  };
  if (typeof o.lastGrade === 'string' && GRADE_SET.has(o.lastGrade as Grade)) card.lastGrade = o.lastGrade as Grade;
  return card;
}

/**
 * Turn whatever was stored (possibly corrupt, partial or from an older version) into a valid store.
 * Pure: never throws. Counters from another local day are reset.
 */
export function parseDrillStore(raw: unknown, now: number): DrillStore {
  const today = localDay(now);
  const root = isRecord(raw) ? raw : {};
  const cards: Record<string, CardState> = {};
  if (isRecord(root.cards)) {
    for (const [id, v] of Object.entries(root.cards)) {
      const c = sanitizeCard(id, v, now);
      if (c) cards[id] = c;
    }
  }
  const npd = root.newPerDay;
  const newPerDay: NewPerDay = NEW_PER_DAY_OPTIONS.includes(npd as NewPerDay) ? (npd as NewPerDay) : 10;
  // `daily` and `otherDaily` (the sync merge keeps two days): today's counters from either slot, and a later day's
  // (another machine ahead) for when this machine gets there. Past days are dropped.
  let daily: DailyCounters | null = null;
  let ahead: DailyCounters | null = null;
  for (const d of [root.daily, root.otherDaily]) {
    if (!isRecord(d) || typeof d.day !== 'string') continue;
    if (d.day === today) daily ??= sanitizeDaily(d, today);
    else if (/^\d{4}-\d{2}-\d{2}$/.test(d.day) && d.day > today && (!ahead || d.day > ahead.day)) ahead = sanitizeDaily(d, d.day);
  }
  const out: DrillStore = { version: 1, newPerDay, cards, daily: daily ?? emptyDaily(today) };
  if (ahead) out.otherDaily = ahead;
  return out;
}

function sanitizeDaily(d: Record<string, unknown>, day: string): DailyCounters {
  return {
    day,
    newIntroduced: count(d.newIntroduced),
    extraNew: count(d.extraNew),
    reviews: count(d.reviews),
    studiedIds: Array.isArray(d.studiedIds) ? [...new Set(d.studiedIds.filter((x): x is string => typeof x === 'string'))] : [],
  };
}

export function loadDrillStore(now: number = Date.now()): DrillStore {
  return parseDrillStore(loadJSON<unknown>(KEYS.drill, null), now);
}

/** Returns false when the write failed (storage unavailable or full). */
export function saveDrillStore(store: DrillStore): boolean {
  return saveJSON(KEYS.drill, store);
}

/**
 * True when a `storage` event (another tab) may have changed the drill store:
 * `null` means the whole storage was cleared.
 */
export function isDrillStorageKey(key: string | null): boolean {
  return key === null || key === STORAGE_PREFIX + KEYS.drill;
}

/**
 * Store to grade on top of. Normally the freshly read persisted store, so a grade made in
 * another tab is not overwritten by stale React state. When the last save failed (storage
 * unavailable or full), storage is behind memory and the in-memory store wins.
 */
export function gradeBase(memory: DrillStore, lastSaveOk: boolean, read: () => DrillStore, now: number): DrillStore {
  return rollDaily(lastSaveOk ? read() : memory, now);
}

/**
 * New local day → that day's counters: those another machine already spent (`otherDaily`, kept by the sync merge),
 * else empty ones. A day still ahead stays in `otherDaily`. Returns the same object if nothing changed.
 */
export function rollDaily(store: DrillStore, now: number): DrillStore {
  const today = localDay(now);
  if (store.daily.day === today) return store;
  const pool = store.otherDaily ? [store.daily, store.otherDaily] : [store.daily];
  const daily = pool.find((d) => d.day === today) ?? emptyDaily(today);
  const ahead = pool.filter((d) => d.day > today).sort((a, b) => (a.day < b.day ? 1 : -1))[0];
  const rest: DrillStore = { ...store, daily };
  delete rest.otherDaily;
  if (ahead) rest.otherDaily = ahead;
  return rest;
}

/** Store after grading one card. */
export function applyGrade(store: DrillStore, id: string, updated: CardState, wasNew: boolean, now: number): DrillStore {
  const base = rollDaily(store, now);
  const studied = base.daily.studiedIds.includes(id) ? base.daily.studiedIds : [...base.daily.studiedIds, id];
  return {
    ...base,
    cards: { ...base.cards, [id]: updated },
    daily: {
      ...base.daily,
      newIntroduced: base.daily.newIntroduced + (wasNew ? 1 : 0),
      reviews: base.daily.reviews + 1,
      studiedIds: studied,
    },
  };
}

export function emptyDrillStore(now: number = Date.now()): DrillStore {
  return { version: 1, newPerDay: 10, cards: {}, daily: emptyDaily(localDay(now)) };
}
