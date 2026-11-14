// What the learner has understood, earned and bought in "Thị trấn". Pure: storage is in ./store, the rules (what a
// line pays, what things cost, the daily tasks) are in ./economy and ./daily.
//
// Stored under KEYS.town ('town-progress', synced):
//   {
//     version: 2,
//     lines:  { [lineId]: { best, tries, at } },
//     earned: { [deviceId]: xu },
//     bought: [id, …],
//     daily:  { [day]: { [deviceId]: { talks, lines, first, met: [placeId, …], paid: [taskId, …] } } },
//     days:   [day, …],
//   }
// - lines.best: 0 = answered, not understood yet; 1 = understood with replays or a slower play; 2 = understood on
//   the first listen. It only ever grows: a wrong answer later never takes a line away.
// - lines.tries: answers given (any outcome).
// - lines.at: when the line was last understood (for a line not understood yet: its last try). A wrong answer on a
//   line already understood leaves it alone, so that line stays among the oldest and is asked again sooner.
// - earned: xu earned, one bucket per browser (core/history deviceId). A browser only ever adds to its OWN bucket,
//   so two copies merge by max per device and the total is the sum (the idea of core/history).
// - bought: ids of the places built and the decorations bought (data/town). Nothing is ever un-bought, so two
//   copies merge as a union. The balance is derived: earned − the cost of everything bought (./economy).
// - daily: what the three daily tasks need, per local day and browser: conversations finished, lines understood,
//   lines understood on the first listen, the places talked at, the tasks already paid. Counters merge by max, the
//   sets as unions. A write keeps the DAILY_KEEP_DAYS days up to today; a read or a merge keeps at most the newest
//   DAILY_MAX_DAYS (so a few days written by a machine with a wrong clock cannot push today out).
// - days: local days with at least one answered line (for the town streak), a union, newest DAYS_KEEP kept.
// Every field only grows, so the merge (core/syncMerge mergeTown) is idempotent, commutative and associative. The
// caps keep those laws: "the newest N keys of a union" does not depend on the order of merging.
//
// A version 1 value ({ version: 1, lines }) reads as the same lines with nothing earned or bought.
//
// This file imports no content: core/syncMerge uses it and must stay light. Counts per place are in ./overview.

import type { LineOutcome, TownLine } from './types';

export type LineBest = 0 | 1 | 2;

export interface LineProgress {
  best: LineBest;
  tries: number;
  at: number; // epoch ms
}

/** One browser's counters for one local day. */
export interface DailyCount {
  /** Conversations finished (all their lines answered). */
  talks: number;
  /** Lines understood (any right answer, a line met before included). */
  lines: number;
  /** Of those, understood on the first listen. */
  first: number;
  /** Places where a conversation was finished (sorted). */
  met: string[];
  /** Daily tasks already paid (sorted task ids, ./daily). */
  paid: string[];
}

export interface TownProgress {
  version: 2;
  lines: Record<string, LineProgress>;
  earned: Record<string, number>;
  bought: string[];
  daily: Record<string, Record<string, DailyCount>>;
  days: string[];
}

/** Days of daily counters a write keeps (today included). */
export const DAILY_KEEP_DAYS = 14;
/** Days of daily counters a read or a merge keeps at most (the newest ones). */
export const DAILY_MAX_DAYS = 60;
/** Active days kept for the streak. */
export const DAYS_KEEP = 400;
const MAX_DEVICES = 64;
const MAX_BOUGHT = 200;
const MAX_SET = 40;
const MAX_XU = 10_000_000;

const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_ID = 200;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DEVICE_RE = /^[a-z0-9-]{4,40}$/;
const ITEM_RE = /^[a-z][a-z0-9-]{0,39}$/;

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const count = (v: unknown): number => (finite(v) && v > 0 ? Math.floor(v) : 0);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const toBest = (v: unknown): LineBest => Math.min(2, count(v)) as LineBest;
const own = <T>(o: Record<string, T>, k: string): T | undefined => (Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);
const safeKey = (k: string): boolean => !UNSAFE.has(k);

export function emptyTownProgress(): TownProgress {
  return { version: 2, lines: {}, earned: {}, bought: [], daily: {}, days: [] };
}

export function emptyDailyCount(): DailyCount {
  return { talks: 0, lines: 0, first: 0, met: [], paid: [] };
}

/** Local 'YYYY-MM-DD' (as core/stats localDay and core/history dayOf). */
export function townDay(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ───────────────────────── sets and capped keys ─────────────────────────

/** Sorted unique strings that pass `ok`, the first `max` of them. */
function idSet(raw: unknown, ok: (s: string) => boolean, max: number): string[] {
  if (!Array.isArray(raw)) return [];
  const out = new Set<string>();
  for (const v of raw) if (typeof v === 'string' && ok(v) && safeKey(v)) out.add(v);
  return [...out].sort().slice(0, max);
}

const union = (a: readonly string[], b: readonly string[], max: number): string[] => [...new Set([...a, ...b])].sort().slice(0, max);
/** The newest `max` days of a sorted-or-not list, returned sorted ascending. */
const newest = (days: readonly string[], max: number): string[] => [...new Set(days)].sort().slice(-max);

const isItemId = (s: string): boolean => ITEM_RE.test(s);
const isDay = (s: string): boolean => DAY_RE.test(s);
const isDevice = (s: string): boolean => DEVICE_RE.test(s) && safeKey(s);

// ───────────────────────── parse ─────────────────────────

/** One stored line, or null when nothing in it says the line was ever answered. */
function parseLine(raw: unknown): LineProgress | null {
  if (!isObj(raw)) return null;
  const best = toBest(raw.best);
  const tries = count(raw.tries);
  if (best === 0 && tries === 0) return null;
  return { best, tries: Math.max(1, tries), at: finite(raw.at) && raw.at > 0 ? raw.at : 0 };
}

function parseDailyCount(raw: unknown): DailyCount | null {
  if (!isObj(raw)) return null;
  const c: DailyCount = {
    talks: count(raw.talks),
    lines: count(raw.lines),
    first: count(raw.first),
    met: idSet(raw.met, isItemId, MAX_SET),
    paid: idSet(raw.paid, isItemId, MAX_SET),
  };
  return c.talks || c.lines || c.first || c.met.length || c.paid.length ? c : null;
}

function parseDaily(raw: unknown): TownProgress['daily'] {
  const out: TownProgress['daily'] = {};
  if (!isObj(raw)) return out;
  for (const day of newest(Object.keys(raw).filter(isDay), DAILY_MAX_DAYS)) {
    const devices = raw[day];
    if (!isObj(devices)) continue;
    const bucket: Record<string, DailyCount> = {};
    for (const dev of Object.keys(devices).filter(isDevice).sort().slice(0, MAX_DEVICES)) {
      const c = parseDailyCount(devices[dev]);
      if (c) bucket[dev] = c;
    }
    if (Object.keys(bucket).length > 0) out[day] = bucket;
  }
  return out;
}

function parseEarned(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObj(raw)) return out;
  for (const dev of Object.keys(raw).filter(isDevice).sort().slice(0, MAX_DEVICES)) {
    const xu = Math.min(MAX_XU, count(raw[dev]));
    if (xu > 0) out[dev] = xu;
  }
  return out;
}

/**
 * Defensive parse of whatever storage, a backup or the synced folder holds: junk reads as "nothing understood,
 * nothing earned", never as a crash. Keys come out sorted (equal content gives equal JSON). Any version is read:
 * a version 1 value simply has no earned / bought / daily / days.
 */
export function parseTownProgress(raw: unknown): TownProgress {
  const out = emptyTownProgress();
  if (!isObj(raw)) return out;
  if (isObj(raw.lines)) {
    for (const id of Object.keys(raw.lines).sort()) {
      if (!id || id.length > MAX_ID || UNSAFE.has(id)) continue;
      const line = parseLine(raw.lines[id]);
      if (line) out.lines[id] = line;
    }
  }
  out.earned = parseEarned(raw.earned);
  out.bought = idSet(raw.bought, isItemId, MAX_BOUGHT);
  out.daily = parseDaily(raw.daily);
  out.days = newest(idSet(raw.days, isDay, Number.MAX_SAFE_INTEGER), DAYS_KEEP);
  return out;
}

// ───────────────────────── merge ─────────────────────────

function mergeDailyCount(a: DailyCount | undefined, b: DailyCount | undefined): DailyCount {
  const x = a ?? emptyDailyCount();
  const y = b ?? emptyDailyCount();
  return {
    talks: Math.max(x.talks, y.talks),
    lines: Math.max(x.lines, y.lines),
    first: Math.max(x.first, y.first),
    met: union(x.met, y.met, MAX_SET),
    paid: union(x.paid, y.paid, MAX_SET),
  };
}

/**
 * Sync merge of two copies (both already parsed): union of lines with the max of each field, max per device of the
 * xu earned, union of what was bought, max / union per day and device of the daily counters, union of the days.
 */
export function mergeTownProgress(a: TownProgress, b: TownProgress): TownProgress {
  const out = emptyTownProgress();
  for (const id of [...new Set([...Object.keys(a.lines), ...Object.keys(b.lines)])].sort()) {
    const x = own(a.lines, id);
    const y = own(b.lines, id);
    if (x && y) out.lines[id] = { best: Math.max(x.best, y.best) as LineBest, tries: Math.max(x.tries, y.tries), at: Math.max(x.at, y.at) };
    else if (x ?? y) out.lines[id] = { ...(x ?? y)! };
  }
  for (const dev of [...new Set([...Object.keys(a.earned), ...Object.keys(b.earned)])].sort().slice(0, MAX_DEVICES)) {
    out.earned[dev] = Math.max(own(a.earned, dev) ?? 0, own(b.earned, dev) ?? 0);
  }
  out.bought = union(a.bought, b.bought, MAX_BOUGHT);
  for (const day of newest([...Object.keys(a.daily), ...Object.keys(b.daily)], DAILY_MAX_DAYS)) {
    const x = own(a.daily, day) ?? {};
    const y = own(b.daily, day) ?? {};
    const bucket: Record<string, DailyCount> = {};
    for (const dev of [...new Set([...Object.keys(x), ...Object.keys(y)])].sort().slice(0, MAX_DEVICES)) {
      bucket[dev] = mergeDailyCount(own(x, dev), own(y, dev));
    }
    out.daily[day] = bucket;
  }
  out.days = newest([...a.days, ...b.days], DAYS_KEEP);
  return out;
}

// ───────────────────────── lines ─────────────────────────

/** The stored record of a line, if it was ever answered. */
export function lineProgress(progress: TownProgress, id: string): LineProgress | undefined {
  return own(progress.lines, id);
}

export function isUnderstood(progress: TownProgress, id: string): boolean {
  return (lineProgress(progress, id)?.best ?? 0) >= 1;
}

/** A line id the store can keep. */
export function isLineId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0 && id.length <= MAX_ID && !UNSAFE.has(id);
}

/** The progress after one answered line (the input is not changed). An unusable id changes nothing. */
export function recordLine(progress: TownProgress, id: string, outcome: LineOutcome, now: number): TownProgress {
  if (!isLineId(id)) return progress;
  const prev = lineProgress(progress, id);
  const got: LineBest = outcome === 'first' ? 2 : outcome === 'replayed' ? 1 : 0;
  const best = Math.max(prev?.best ?? 0, got) as LineBest;
  const t = finite(now) && now > 0 ? now : 0;
  // a miss on a line already understood keeps its time (see the header)
  const at = got === 0 && (prev?.best ?? 0) >= 1 ? (prev?.at ?? 0) : Math.max(prev?.at ?? 0, t);
  return { ...progress, lines: { ...progress.lines, [id]: { best, tries: (prev?.tries ?? 0) + 1, at } } };
}

// ───────────────────────── xu, purchases, days (plain updates: the rules are in ./economy and ./daily) ────────

/** Xu earned on all browsers together. */
export function earnedTotal(progress: TownProgress): number {
  let sum = 0;
  for (const dev of Object.keys(progress.earned)) sum += own(progress.earned, dev) ?? 0;
  return sum;
}

/** `xu` more in the bucket of `device` (the input is not changed). Nothing for a bad device id or amount. */
export function addEarned(progress: TownProgress, device: string, xu: number): TownProgress {
  const add = count(xu);
  if (add === 0 || !isDevice(device)) return progress;
  return { ...progress, earned: { ...progress.earned, [device]: Math.min(MAX_XU, (own(progress.earned, device) ?? 0) + add) } };
}

export function hasBought(progress: TownProgress, id: string): boolean {
  return progress.bought.includes(id);
}

/** `id` added to what was bought (the input is not changed). The price is checked by ./economy buy, not here. */
export function addBought(progress: TownProgress, id: string): TownProgress {
  if (typeof id !== 'string' || !isItemId(id) || !safeKey(id) || hasBought(progress, id)) return progress;
  return { ...progress, bought: union(progress.bought, [id], MAX_BOUGHT) };
}

/** The counters of `device` on `day` (zeros when there are none). */
export function dailyCount(progress: TownProgress, day: string, device: string): DailyCount {
  const bucket = own(progress.daily, day);
  return (bucket && own(bucket, device)) ?? emptyDailyCount();
}

/**
 * The progress with the counters of (`day`, `device`) replaced by `change(current)`, `day` noted as an active day,
 * and only the DAILY_KEEP_DAYS days up to `day` kept (plus the day after it: another machine's time zone). Counters
 * never go down and sets never lose a member, whatever `change` returns. A bad day or device changes nothing.
 */
export function updateDaily(progress: TownProgress, day: string, device: string, change: (c: DailyCount) => DailyCount): TownProgress {
  if (!isDay(day) || !isDevice(device)) return progress;
  const next = mergeDailyCount(dailyCount(progress, day, device), parseDailyCount(change(dailyCount(progress, day, device))) ?? undefined);
  const bucket = { ...own(progress.daily, day) };
  // a day with nothing to count yet (a first answer that was wrong) is an active day, not a stored row of zeros
  if (next.talks || next.lines || next.first || next.met.length || next.paid.length) bucket[device] = next;
  const daily: TownProgress['daily'] = {};
  const from = daysBefore(day, DAILY_KEEP_DAYS - 1);
  const until = daysBefore(day, -1);
  for (const d of [...new Set([...Object.keys(progress.daily), day])].sort()) {
    if (d === day) {
      if (Object.keys(bucket).length > 0) daily[d] = bucket;
    } else if (d >= from && d <= until) daily[d] = progress.daily[d];
  }
  return { ...progress, daily, days: newest([...progress.days, day], DAYS_KEEP) };
}

/** The local day `n` days before `day` ('YYYY-MM-DD'); noon keeps it safe across daylight-saving changes. */
export function daysBefore(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return townDay(new Date(y, m - 1, d - n, 12).getTime());
}

// ───────────────────────── counts ─────────────────────────

export interface TownStats {
  total: number; // lines there are
  understood: number; // best >= 1
  first: number; // best = 2: understood on the first listen
}

/** Counts over `lines` (a place's, or any list). Records of lines that no longer exist are not counted. */
export function linesStats(progress: TownProgress, lines: readonly TownLine[]): TownStats {
  let understood = 0;
  let first = 0;
  for (const l of lines) {
    const best = lineProgress(progress, l.id)?.best ?? 0;
    if (best >= 1) understood += 1;
    if (best >= 2) first += 1;
  }
  return { total: lines.length, understood, first };
}
