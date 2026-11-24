// The rules of "Phụ quầy cà phê" (docs/town.md §16), pure: a shift at Emma's counter, its scoring, the difficulty that
// follows the learner, and what is stored (KEYS.townCafe, synced, merged by core/syncMerge mergeCafe).
//
// A shift: up to SHIFT_CUSTOMERS residents, one at a time. Each SAYS an order (cafeTypes CafeOrder); the learner
// puts exactly that on the tray before the patience runs out. Three misses (a wrong tray, or too late) end the shift.
//
// Why these numbers (the research the owner asked for, 2026-11-24):
// - a patience meter, a combo a miss resets and a rising pace are the core of serve-the-customer games since Tapper
//   and Diner Dash (Smith et al., "Order-fulfillment games", FDG 2019);
// - learning is fastest near 85% right (Wilson et al., "The Eighty Five Percent Rule for optimal learning", Nature
//   Communications 2019): the skill goes up SKILL_UP for a right tray and down SKILL_DOWN for a miss, and
//   SKILL_DOWN / SKILL_UP = 0.85 / 0.15, so it settles where the learner gets about 85% right;
// - one simple streak ("a day with a shift"), as Duolingo found its streak worked best as one lesson a day;
// - a daily reward that cannot be farmed: CAFE_XU_DAY xu a day over all browsers.

import type { Level } from '../types';
import { CAFE_ITEMS, type CafeBasket, type CafeItemId, type CafeOrder } from './cafeTypes';

export const SHIFT_CUSTOMERS = 12;
export const SHIFT_HEARTS = 3;
/** Xu the café can pay a day (all browsers), and the score one xu takes. */
export const CAFE_XU_DAY = 24;
export const SCORE_PER_XU = 30;
/** Right trays in a shift for the day's friendship with Emma (+CAFE_BOND points, once a day). */
export const CAFE_BOND_SERVED = 8;
export const CAFE_BOND = 10;
/** Friendship with a customer served right (once a day each). */
export const CUSTOMER_BOND = 3;

export const SKILL_MAX = 10;
export const SKILL_UP = 0.5;
export const SKILL_DOWN = (SKILL_UP * 0.85) / 0.15;

// ───────────────────────── the tray ─────────────────────────

/** Things on a tray or in an order. */
export function basketSize(b: CafeBasket): number {
  return CAFE_ITEMS.reduce((n, id) => n + (b[id] ?? 0), 0);
}

/** The tray is exactly the order. */
export function trayRight(order: Pick<CafeOrder, 'items'>, tray: CafeBasket): boolean {
  return CAFE_ITEMS.every((id) => (order.items[id] ?? 0) === (tray[id] ?? 0));
}

/** One more of `id` on the tray (at most 3 of a kind). */
export function addToTray(tray: CafeBasket, id: CafeItemId): CafeBasket {
  const n = tray[id] ?? 0;
  return n >= 3 ? tray : { ...tray, [id]: n + 1 };
}

/** One fewer of `id`. */
export function takeFromTray(tray: CafeBasket, id: CafeItemId): CafeBasket {
  const n = tray[id] ?? 0;
  if (n <= 0) return tray;
  const next = { ...tray };
  if (n === 1) delete next[id];
  else next[id] = n - 1;
  return next;
}

// ───────────────────────── difficulty ─────────────────────────

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** The skill after a customer: up a little for a right tray (half with a replay), down more for a miss. */
export function skillAfter(skill: number, right: boolean, firstListen: boolean): number {
  const s = Number.isFinite(skill) ? skill : 0;
  return clamp(right ? s + (firstListen ? SKILL_UP : SKILL_UP / 2) : s - SKILL_DOWN, 0, SKILL_MAX);
}

/** The level of the next order at this skill (`roll` in [0, 1) mixes neighbouring levels). */
export function levelFor(skill: number, roll: number): Level {
  const s = clamp(skill, 0, SKILL_MAX);
  if (s < 2) return 1;
  if (s < 5) return roll < (s - 2) / 3 ? 2 : 1;
  if (s < 8) return roll < (s - 5) / 3 ? 3 : 2;
  return roll < 0.8 ? 3 : 2;
}

/**
 * How long a customer waits (ms) from the moment they start speaking: time to hear the order, find the tiles and
 * serve, shorter as the skill rises (never under 6 s: the order itself takes two or three).
 */
export function patienceMs(order: Pick<CafeOrder, 'items' | 'level'>, skill: number): number {
  const base = 8000 + 2200 * basketSize(order.items) + (order.level === 3 ? 2500 : 0);
  const pace = 1 - 0.04 * clamp(skill, 0, SKILL_MAX);
  return Math.max(6000, Math.round(base * pace));
}

// ───────────────────────── a shift ─────────────────────────

export interface ShiftLine {
  orderId: string;
  /** 'right' the tray was the order; 'wrong' another tray; 'late' the patience ran out. */
  outcome: 'right' | 'wrong' | 'late';
  /** Heard once at the normal speed before serving. */
  firstListen: boolean;
  /** Points this customer paid. */
  points: number;
}

export interface Shift {
  seed: number;
  lines: ShiftLine[];
  hearts: number;
  /** Right trays in a row now, and the longest run of the shift. */
  combo: number;
  bestCombo: number;
  score: number;
  skill: number;
}

export function startShift(skill: number, seed: number): Shift {
  return { seed: Math.floor(Math.abs(seed)) || 1, lines: [], hearts: SHIFT_HEARTS, combo: 0, bestCombo: 0, score: 0, skill: clamp(Number.isFinite(skill) ? skill : 0, 0, SKILL_MAX) };
}

export function shiftOver(s: Shift): boolean {
  return s.hearts <= 0 || s.lines.length >= SHIFT_CUSTOMERS;
}

/** The multiplier of the next right tray: ×1, then +0.25 for each right tray in a row before it, up to ×3. */
export function comboMultiplier(combo: number): number {
  return Math.min(3, 1 + 0.25 * Math.max(0, combo));
}

/**
 * Points of a right tray: 10 a level, up to 10 more for speed (`left`: the share of the patience still left), 5 more
 * for hearing it once, times the combo.
 */
export function trayPoints(level: Level, left: number, firstListen: boolean, combo: number): number {
  const speed = Math.round(10 * clamp(left, 0, 1));
  return Math.round((10 * level + speed + (firstListen ? 5 : 0)) * comboMultiplier(combo));
}

/** The shift after one customer. `tray` null: the patience ran out. `plays`: times the order was played. */
export function serve(s: Shift, order: CafeOrder, tray: CafeBasket | null, plays: number, left: number): Shift {
  if (shiftOver(s)) return s;
  const right = !!tray && trayRight(order, tray);
  const firstListen = right && plays <= 1;
  const points = right ? trayPoints(order.level, left, firstListen, s.combo) : 0;
  const combo = right ? s.combo + 1 : 0;
  return {
    ...s,
    lines: [...s.lines, { orderId: order.id, outcome: right ? 'right' : tray ? 'wrong' : 'late', firstListen, points }],
    hearts: right ? s.hearts : s.hearts - 1,
    combo,
    bestCombo: Math.max(s.bestCombo, combo),
    score: s.score + points,
    skill: skillAfter(s.skill, right, firstListen),
  };
}

/** mulberry32: numbers in [0, 1) from a seed. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The next customer's order: of the level this skill asks for (the nearest level that still has one), never one
 * already heard this shift, never the same resident twice in a row; the ones got right least often first (a missed
 * order comes back before the others: `rightCount`), the rest by the shift's seed. Null: nothing left.
 */
export function nextOrder(s: Shift, orders: readonly CafeOrder[], rightCount: (orderId: string) => number): CafeOrder | null {
  const used = new Set(s.lines.map((l) => l.orderId));
  const last = orders.find((o) => o.id === s.lines[s.lines.length - 1]?.orderId)?.placeId;
  const rand = rng(s.seed + s.lines.length * 7919);
  const want = levelFor(s.skill, rand());
  const free = orders.filter((o) => !used.has(o.id));
  if (free.length === 0) return null;
  for (const level of [want, want - 1, want + 1, want - 2, want + 2]) {
    let pool = free.filter((o) => o.level === level);
    if (pool.length === 0) continue;
    const others = pool.filter((o) => o.placeId !== last);
    if (others.length > 0) pool = others;
    const fewest = Math.min(...pool.map((o) => rightCount(o.id)));
    const first = pool.filter((o) => rightCount(o.id) === fewest);
    return first[Math.floor(rand() * first.length)];
  }
  return free[0];
}

/** Right trays of a shift. */
export function servedRight(s: Shift): number {
  return s.lines.filter((l) => l.outcome === 'right').length;
}

// ───────────────────────── stored (version 1) ─────────────────────────
//
// - best: the best score of a shift and when (the higher; the earlier of equals);
// - skill: where the next shift starts and when it was set (the newer; the higher of equals);
// - orders: per order, how often it was served and how often right (max of each: a hint for the picker, not a count
//   that must add up over browsers);
// - days: per local day and browser: shifts, xu paid, best score, bond (1: Emma's friendship of the day was paid);
//   max per field; the newest CAFE_DAYS days are kept.

export const CAFE_VERSION = 1;
export const CAFE_DAYS = 60;

export interface CafeDay {
  runs: number;
  xu: number;
  best: number;
  bond: number;
}

export interface TownCafe {
  version: number;
  best: { score: number; at: number } | null;
  skill: { v: number; at: number } | null;
  orders: Record<string, { n: number; ok: number }>;
  days: Record<string, Record<string, CafeDay>>;
}

export function emptyTownCafe(): TownCafe {
  return { version: CAFE_VERSION, best: null, skill: null, orders: {}, days: {} };
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const count = (v: unknown, max = 1e7): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.min(max, Math.floor(v)) : 0);
const ORDER_ID = /^cf-[a-z]{2,12}-\d{1,3}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DEVICE = /^[a-z0-9-]{4,40}$/;

function parseDay(raw: unknown): CafeDay | null {
  if (!isObj(raw)) return null;
  const d: CafeDay = { runs: count(raw.runs, 1e4), xu: count(raw.xu, 1e4), best: count(raw.best), bond: count(raw.bond, 1) };
  return d.runs || d.xu || d.best || d.bond ? d : null;
}

function trimDays(days: TownCafe['days']): TownCafe['days'] {
  const keys = Object.keys(days).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - CAFE_DAYS))) delete days[k];
  return days;
}

export function parseTownCafe(raw: unknown): TownCafe {
  const out = emptyTownCafe();
  if (!isObj(raw)) return out;
  if (isObj(raw.best) && count(raw.best.score) && count(raw.best.at, 1e15)) out.best = { score: count(raw.best.score), at: count(raw.best.at, 1e15) };
  if (isObj(raw.skill) && typeof raw.skill.v === 'number' && Number.isFinite(raw.skill.v) && count(raw.skill.at, 1e15)) {
    out.skill = { v: Math.round(clamp(raw.skill.v, 0, SKILL_MAX) * 100) / 100, at: count(raw.skill.at, 1e15) };
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
      const row: Record<string, CafeDay> = {};
      for (const [device, d] of Object.entries(v)) {
        const parsed = DEVICE.test(device) ? parseDay(d) : null;
        if (parsed) row[device] = parsed;
      }
      if (Object.keys(row).length > 0) out.days[day] = row;
    }
    trimDays(out.days);
  }
  return out;
}

/** Idempotent, commutative and associative (core/syncMerge.props.test). */
export function mergeTownCafe(x: TownCafe, y: TownCafe): TownCafe {
  const out = emptyTownCafe();
  out.version = Math.max(x.version, y.version, CAFE_VERSION);
  const bests = [x.best, y.best].filter((b): b is NonNullable<TownCafe['best']> => !!b);
  out.best = bests.length ? { ...bests.sort((a, b) => b.score - a.score || a.at - b.at)[0] } : null;
  const skills = [x.skill, y.skill].filter((s): s is NonNullable<TownCafe['skill']> => !!s);
  out.skill = skills.length ? { ...skills.sort((a, b) => b.at - a.at || b.v - a.v)[0] } : null;
  for (const id of new Set([...Object.keys(x.orders), ...Object.keys(y.orders)])) {
    const a = x.orders[id];
    const b = y.orders[id];
    const n = Math.max(a?.n ?? 0, b?.n ?? 0);
    out.orders[id] = { n, ok: Math.min(n, Math.max(a?.ok ?? 0, b?.ok ?? 0)) };
  }
  for (const day of new Set([...Object.keys(x.days), ...Object.keys(y.days)])) {
    const row: Record<string, CafeDay> = {};
    for (const device of new Set([...Object.keys(x.days[day] ?? {}), ...Object.keys(y.days[day] ?? {})])) {
      const a = x.days[day]?.[device];
      const b = y.days[day]?.[device];
      row[device] = { runs: Math.max(a?.runs ?? 0, b?.runs ?? 0), xu: Math.max(a?.xu ?? 0, b?.xu ?? 0), best: Math.max(a?.best ?? 0, b?.best ?? 0), bond: Math.max(a?.bond ?? 0, b?.bond ?? 0) };
    }
    out.days[day] = row;
  }
  trimDays(out.days);
  return out;
}

// ───────────────────────── reading and writing (pure) ─────────────────────────

const dayRows = (cafe: TownCafe, day: string): CafeDay[] => Object.values(cafe.days[day] ?? {});

/** Xu the café can still pay today (all browsers). */
export function cafeXuLeft(cafe: TownCafe, day: string): number {
  return Math.max(0, CAFE_XU_DAY - dayRows(cafe, day).reduce((n, d) => n + d.xu, 0));
}

/** Today's best score over all browsers (0: no shift today). */
export function cafeBestToday(cafe: TownCafe, day: string): number {
  return Math.max(0, ...dayRows(cafe, day).map((d) => d.best));
}

/** Emma's friendship of the day was paid already. */
export function cafeBondPaid(cafe: TownCafe, day: string): boolean {
  return dayRows(cafe, day).some((d) => d.bond > 0);
}

const dayBefore = (day: string): string => {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(y, m - 1, d - 1, 12);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
};

/** Days in a row with a shift, ending today (or yesterday while today has none yet). */
export function cafeStreak(cafe: TownCafe, today: string): number {
  const worked = (day: string) => dayRows(cafe, day).some((d) => d.runs > 0);
  let day = worked(today) ? today : dayBefore(today);
  let n = 0;
  while (worked(day)) {
    n += 1;
    day = dayBefore(day);
  }
  return n;
}

export interface ShiftPay {
  cafe: TownCafe;
  /** Xu this shift pays (after the day's cap). */
  xu: number;
  /** A new all-time best. */
  record: boolean;
  /** Emma's friendship of the day is paid by this shift. */
  bond: boolean;
}

/** A finished shift written down: the day's row of `device`, the best, the skill, the orders' counts. */
export function recordShift(cafe: TownCafe, s: Shift, day: string, device: string, now: number): ShiftPay {
  if (!DAY.test(day) || !DEVICE.test(device)) return { cafe, xu: 0, record: false, bond: false };
  const xu = Math.min(cafeXuLeft(cafe, day), Math.floor(s.score / SCORE_PER_XU));
  const bond = servedRight(s) >= CAFE_BOND_SERVED && !cafeBondPaid(cafe, day);
  const record = s.score > 0 && s.score > (cafe.best?.score ?? 0);
  const was = cafe.days[day]?.[device] ?? { runs: 0, xu: 0, best: 0, bond: 0 };
  const row: CafeDay = { runs: was.runs + 1, xu: was.xu + xu, best: Math.max(was.best, s.score), bond: Math.max(was.bond, bond ? 1 : 0) };
  const orders = { ...cafe.orders };
  for (const l of s.lines) {
    const o = orders[l.orderId] ?? { n: 0, ok: 0 };
    orders[l.orderId] = { n: o.n + 1, ok: o.ok + (l.outcome === 'right' ? 1 : 0) };
  }
  const next: TownCafe = {
    ...cafe,
    best: record ? { score: s.score, at: now } : cafe.best,
    // the next shift starts a little under where this one ended (a warm-up, never from zero again)
    skill: { v: Math.round(clamp(s.skill - 1, 0, SKILL_MAX) * 100) / 100, at: now },
    orders,
    days: trimDays({ ...cafe.days, [day]: { ...(cafe.days[day] ?? {}), [device]: row } }),
  };
  return { cafe: next, xu, record, bond };
}
