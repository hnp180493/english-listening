// The rules of "Ca làm việc" in Westbay (./shiftTypes), pure: which requests a shift draws, how an answer is judged,
// points, patience, the daily xu, and what is stored (KEYS.townShifts, synced, merged by core/syncMerge mergeShifts).
//
// A shift: SHIFT_ORDERS requests, easier first. Each is SAID once by itself (it can be replayed); the learner sets
// every slot before the patience runs out. Every slot right = served. SHIFT_MISSES misses (a wrong answer, or too
// late) end the shift. The same design as the café (./cafe.ts): one action understood at a glance, a patience meter,
// a combo a miss resets, a personal best, a capped daily reward; the requests missed last time come back first.

import type { Level } from '../types';
import type { ShiftDef, ShiftOrder } from './shiftTypes';

export const SHIFT_ORDERS = 10;
export const SHIFT_MISSES = 3;
/** Xu one shift can pay a day (all browsers), per shift id, and the score one xu takes. */
export const SHIFT_XU_DAY = 16;
export const SHIFT_SCORE_PER_XU = 20;
/** How many requests of each level a shift of ten draws, in order (easier first). */
export const SHIFT_PLAN: readonly Level[] = [1, 1, 1, 2, 2, 2, 2, 3, 3, 3];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ───────────────────────── judging and points ─────────────────────────

export type ShiftPicks = Readonly<Record<string, string | undefined>>;

/** Every slot of the shift has a pick. */
export function allSet(def: Pick<ShiftDef, 'slots'>, picks: ShiftPicks): boolean {
  return def.slots.every((s) => !!picks[s.id]);
}

/** The slots set wrong (or not set). Empty: served. */
export function wrongSlots(def: Pick<ShiftDef, 'slots'>, order: Pick<ShiftOrder, 'answer'>, picks: ShiftPicks): string[] {
  return def.slots.filter((s) => picks[s.id] !== order.answer[s.id]).map((s) => s.id);
}

export function served(def: Pick<ShiftDef, 'slots'>, order: Pick<ShiftOrder, 'answer'>, picks: ShiftPicks): boolean {
  return wrongSlots(def, order, picks).length === 0;
}

/** The multiplier of the next right answer: ×1, then +0.25 for each right one in a row before it, up to ×3. */
export function comboMultiplier(combo: number): number {
  return Math.min(3, 1 + 0.25 * Math.max(0, combo));
}

/**
 * Points of a right answer: 10 a level, up to 10 more for speed (`left`: the share of the patience still left), 5
 * more for answering after hearing it only once, times the combo.
 */
export function shiftPoints(level: Level, left: number, firstListen: boolean, combo: number): number {
  const speed = Math.round(10 * clamp(Number.isFinite(left) ? left : 0, 0, 1));
  return Math.round((10 * level + speed + (firstListen ? 5 : 0)) * comboMultiplier(combo));
}

/**
 * How long the caller waits (seconds) from the moment they start speaking: time to hear the request and set the
 * slots (2.5 s a slot, 3 s more a level), a little shorter the later in the shift (3% an order), never under 10 s.
 */
export function patienceSeconds(level: Level, slots: number, index: number): number {
  const base = 10 + 2.5 * Math.max(1, slots) + 3 * (level - 1);
  const pace = 1 - 0.03 * clamp(index, 0, SHIFT_ORDERS);
  return Math.max(10, Math.round(base * pace * 10) / 10);
}

// ───────────────────────── drawing a shift ─────────────────────────

/** mulberry32: numbers in [0, 1) from a seed (for the panel; tests pass their own). */
export function seededRng(seed: number): () => number {
  let a = Math.floor(Math.abs(seed)) >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The requests of a shift, in order: SHIFT_PLAN's levels (the nearest level that still has one when a level runs
 * short), never one twice; at each level the ones missed in this shift's last run first, then the ones got right
 * least often, then by `rand`. Fewer than SHIFT_ORDERS only when the shift has fewer requests.
 */
export function drawShift(def: Pick<ShiftDef, 'orders'>, rand: () => number, missedLast: readonly string[] = [], rightCount: (orderId: string) => number = () => 0): ShiftOrder[] {
  const missed = new Set(missedLast);
  const used = new Set<string>();
  // one random key per order for this draw, so ties break the same way within it
  const key = new Map(def.orders.map((o) => [o.id, rand()]));
  const rank = (o: ShiftOrder): [number, number, number] => [missed.has(o.id) ? 0 : 1, rightCount(o.id), key.get(o.id) ?? 0];
  const better = (a: ShiftOrder, b: ShiftOrder): number => {
    const x = rank(a);
    const y = rank(b);
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  };
  const out: ShiftOrder[] = [];
  for (const want of SHIFT_PLAN) {
    let pick: ShiftOrder | undefined;
    for (const level of [want, want - 1, want + 1, want - 2, want + 2]) {
      const pool = def.orders.filter((o) => o.level === level && !used.has(o.id));
      if (pool.length === 0) continue;
      pick = [...pool].sort(better)[0];
      break;
    }
    if (!pick) break;
    used.add(pick.id);
    out.push(pick);
  }
  // easier first: a level filled from a neighbour keeps the shift's order by level
  return out.sort((a, b) => a.level - b.level);
}

// ───────────────────────── a run ─────────────────────────

export interface ShiftRunLine {
  orderId: string;
  /** 'right' every slot right; 'wrong' set and wrong; 'late' the patience ran out. */
  outcome: 'right' | 'wrong' | 'late';
  /** Heard only once before answering. */
  firstListen: boolean;
  points: number;
  /** What the learner set (for the feedback). */
  picks: Record<string, string>;
}

export interface ShiftRun {
  shiftId: string;
  /** The drawn requests' ids, in order. */
  queue: string[];
  lines: ShiftRunLine[];
  misses: number;
  combo: number;
  bestCombo: number;
  score: number;
}

export function startRun(shiftId: string, queue: readonly ShiftOrder[]): ShiftRun {
  return { shiftId, queue: queue.map((o) => o.id), lines: [], misses: 0, combo: 0, bestCombo: 0, score: 0 };
}

export function runOver(r: ShiftRun): boolean {
  return r.misses >= SHIFT_MISSES || r.lines.length >= r.queue.length;
}

/** The request now at the counter (null: the run is over). */
export function currentOrder(r: ShiftRun, def: Pick<ShiftDef, 'orders'>): ShiftOrder | null {
  if (runOver(r)) return null;
  const id = r.queue[r.lines.length];
  return def.orders.find((o) => o.id === id) ?? null;
}

/**
 * The run after one request. `picks` null: the patience ran out. `plays`: times it was played before the answer.
 * `left`: the share of the patience still left.
 */
export function answer(r: ShiftRun, def: Pick<ShiftDef, 'slots'>, order: ShiftOrder, picks: ShiftPicks | null, plays: number, left: number): ShiftRun {
  if (runOver(r)) return r;
  const right = !!picks && served(def, order, picks);
  const firstListen = right && plays <= 1;
  const points = right ? shiftPoints(order.level, left, firstListen, r.combo) : 0;
  const combo = right ? r.combo + 1 : 0;
  const kept: Record<string, string> = {};
  if (picks) for (const s of def.slots) if (picks[s.id]) kept[s.id] = picks[s.id] as string;
  return {
    ...r,
    lines: [...r.lines, { orderId: order.id, outcome: right ? 'right' : picks ? 'wrong' : 'late', firstListen, points, picks: kept }],
    misses: right ? r.misses : r.misses + 1,
    combo,
    bestCombo: Math.max(r.bestCombo, combo),
    score: r.score + points,
  };
}

export function rightCount(r: ShiftRun): number {
  return r.lines.filter((l) => l.outcome === 'right').length;
}

// ───────────────────────── stored (version 1) ─────────────────────────
//
// - best: per shift the best score and when (the higher; the earlier of equals);
// - last: per shift the requests missed in the newest run and when (the newer; the sorted union of equals, at most
//   LAST_MAX): they come back first next time;
// - orders: per request how often it came and how often it was got right (max of each: a hint for the draw);
// - days: per local day, browser and shift: runs and xu paid; max per field; the newest SHIFT_DAYS days are kept.

export const SHIFTS_VERSION = 1;
export const SHIFT_DAYS = 60;
const LAST_MAX = 10;

export interface ShiftDay {
  runs: number;
  xu: number;
}

export interface TownShifts {
  version: number;
  best: Record<string, { score: number; at: number }>;
  last: Record<string, { at: number; missed: string[] }>;
  orders: Record<string, { n: number; ok: number }>;
  days: Record<string, Record<string, Record<string, ShiftDay>>>;
}

export function emptyTownShifts(): TownShifts {
  return { version: SHIFTS_VERSION, best: {}, last: {}, orders: {}, days: {} };
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const count = (v: unknown, max = 1e7): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(max, Math.floor(v)) : 0);
const SHIFT_ID = /^[a-z]{2,16}$/;
const ORDER_ID = /^sh-[a-z]{2,16}-\d{1,3}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DEVICE = /^[a-z0-9-]{4,40}$/;

const missedList = (ids: Iterable<unknown>): string[] =>
  [...new Set([...ids].filter((id): id is string => typeof id === 'string' && ORDER_ID.test(id)))].sort().slice(0, LAST_MAX);

function trimDays(days: TownShifts['days']): TownShifts['days'] {
  const keys = Object.keys(days).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - SHIFT_DAYS))) delete days[k];
  return days;
}

export function parseTownShifts(raw: unknown): TownShifts {
  const out = emptyTownShifts();
  if (!isObj(raw)) return out;
  if (isObj(raw.best)) {
    for (const [id, v] of Object.entries(raw.best)) {
      if (SHIFT_ID.test(id) && isObj(v) && count(v.score) && count(v.at, 1e15)) out.best[id] = { score: count(v.score), at: count(v.at, 1e15) };
    }
  }
  if (isObj(raw.last)) {
    for (const [id, v] of Object.entries(raw.last)) {
      if (SHIFT_ID.test(id) && isObj(v) && count(v.at, 1e15)) out.last[id] = { at: count(v.at, 1e15), missed: Array.isArray(v.missed) ? missedList(v.missed) : [] };
    }
  }
  if (isObj(raw.orders)) {
    for (const [id, v] of Object.entries(raw.orders)) {
      if (!ORDER_ID.test(id) || !isObj(v)) continue;
      const n = count(v.n, 1e5);
      if (n) out.orders[id] = { n, ok: Math.min(n, count(v.ok, 1e5)) };
    }
  }
  if (isObj(raw.days)) {
    for (const [day, v] of Object.entries(raw.days)) {
      if (!DAY.test(day) || !isObj(v)) continue;
      const row: Record<string, Record<string, ShiftDay>> = {};
      for (const [device, perShift] of Object.entries(v)) {
        if (!DEVICE.test(device) || !isObj(perShift)) continue;
        const cell: Record<string, ShiftDay> = {};
        for (const [id, d] of Object.entries(perShift)) {
          if (!SHIFT_ID.test(id) || !isObj(d)) continue;
          const parsed: ShiftDay = { runs: count(d.runs, 1e4), xu: count(d.xu, 1e4) };
          if (parsed.runs || parsed.xu) cell[id] = parsed;
        }
        if (Object.keys(cell).length > 0) row[device] = cell;
      }
      if (Object.keys(row).length > 0) out.days[day] = row;
    }
    trimDays(out.days);
  }
  return out;
}

const keysOf = (...objs: (object | undefined)[]): string[] => [...new Set(objs.flatMap((o) => (o ? Object.keys(o) : [])))];

/** Idempotent, commutative and associative (core/syncMerge.props.test). */
export function mergeTownShifts(x: TownShifts, y: TownShifts): TownShifts {
  const out = emptyTownShifts();
  out.version = Math.max(x.version, y.version, SHIFTS_VERSION);
  for (const id of keysOf(x.best, y.best)) {
    const all = [x.best[id], y.best[id]].filter((b): b is { score: number; at: number } => !!b);
    out.best[id] = { ...all.sort((a, b) => b.score - a.score || a.at - b.at)[0] };
  }
  for (const id of keysOf(x.last, y.last)) {
    const a = x.last[id];
    const b = y.last[id];
    if (!a || !b) out.last[id] = { at: (a ?? b).at, missed: [...(a ?? b).missed] };
    else if (a.at !== b.at) out.last[id] = a.at > b.at ? { at: a.at, missed: [...a.missed] } : { at: b.at, missed: [...b.missed] };
    else out.last[id] = { at: a.at, missed: missedList([...a.missed, ...b.missed]) };
  }
  for (const id of keysOf(x.orders, y.orders)) {
    const a = x.orders[id];
    const b = y.orders[id];
    const n = Math.max(a?.n ?? 0, b?.n ?? 0);
    out.orders[id] = { n, ok: Math.min(n, Math.max(a?.ok ?? 0, b?.ok ?? 0)) };
  }
  for (const day of keysOf(x.days, y.days)) {
    const row: Record<string, Record<string, ShiftDay>> = {};
    for (const device of keysOf(x.days[day], y.days[day])) {
      const cell: Record<string, ShiftDay> = {};
      for (const id of keysOf(x.days[day]?.[device], y.days[day]?.[device])) {
        const a = x.days[day]?.[device]?.[id];
        const b = y.days[day]?.[device]?.[id];
        cell[id] = { runs: Math.max(a?.runs ?? 0, b?.runs ?? 0), xu: Math.max(a?.xu ?? 0, b?.xu ?? 0) };
      }
      row[device] = cell;
    }
    out.days[day] = row;
  }
  trimDays(out.days);
  return out;
}

// ───────────────────────── reading and writing (pure) ─────────────────────────

/** Xu this shift can still pay today (all browsers). */
export function shiftXuLeft(state: TownShifts, shiftId: string, day: string): number {
  const paid = Object.values(state.days[day] ?? {}).reduce((n, cell) => n + (cell[shiftId]?.xu ?? 0), 0);
  return Math.max(0, SHIFT_XU_DAY - paid);
}

/** The requests missed in this shift's newest run (they come back first). */
export function missedLast(state: TownShifts, shiftId: string): string[] {
  return state.last[shiftId]?.missed ?? [];
}

export interface ShiftPay {
  state: TownShifts;
  /** Xu this run pays (after the day's cap). */
  xu: number;
  /** The cap took some of what the score earned. */
  capped: boolean;
  /** A new best for this shift. */
  record: boolean;
}

/** A finished run written down: the day's cell of `device`, the best, the missed ones, the requests' counts. */
export function recordRun(state: TownShifts, r: ShiftRun, day: string, device: string, now: number): ShiftPay {
  if (!DAY.test(day) || !DEVICE.test(device) || !SHIFT_ID.test(r.shiftId)) return { state, xu: 0, capped: false, record: false };
  const earned = Math.floor(r.score / SHIFT_SCORE_PER_XU);
  const xu = Math.min(shiftXuLeft(state, r.shiftId, day), earned);
  const record = r.score > 0 && r.score > (state.best[r.shiftId]?.score ?? 0);
  const row = state.days[day] ?? {};
  const cell = row[device] ?? {};
  const was = cell[r.shiftId] ?? { runs: 0, xu: 0 };
  const orders = { ...state.orders };
  for (const l of r.lines) {
    const o = orders[l.orderId] ?? { n: 0, ok: 0 };
    orders[l.orderId] = { n: o.n + 1, ok: o.ok + (l.outcome === 'right' ? 1 : 0) };
  }
  const next: TownShifts = {
    ...state,
    best: record ? { ...state.best, [r.shiftId]: { score: r.score, at: now } } : state.best,
    last: { ...state.last, [r.shiftId]: { at: now, missed: missedList(r.lines.filter((l) => l.outcome !== 'right').map((l) => l.orderId)) } },
    orders,
    days: trimDays({ ...state.days, [day]: { ...row, [device]: { ...cell, [r.shiftId]: { runs: was.runs + 1, xu: was.xu + xu } } } }),
  };
  return { state: next, xu, capped: xu < earned, record };
}
