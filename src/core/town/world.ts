// "Thế giới sống" (docs/town.md §19, 2026-11-25): the town has a week, weather, and things in it that can be used.
// Pure rules: which get-together is on today, what the weather is, which scene a bench or the radio plays, and what
// hearing it right pays. The scenes are data/scenes (core/town/sceneTypes.ts); what was paid today is the daily set
// `heard` of town-progress (./progress), so nothing new is stored or synced.
//
// As everywhere in the town: every reward comes from LISTENING (a scene understood), never from clicking; xu and
// friendship are a game score, not a measurement.

import { hash2 } from './colliders';
import type { ListenScene, Weather } from './sceneTypes';

// ───────────────────────── the week ─────────────────────────

/** A get-together of the town's week: the residents' own habits, as their stories tell them (data/stories). */
export interface TownEvent {
  id: string;
  /** 0 Sunday … 6 Saturday, by the learner's own clock. */
  weekday: number;
  /** Whose it is (a place id): it happens at their place, which must be built. */
  host: string;
  /** Vietnamese name. */
  name: string;
  /** One Vietnamese line for the day's list. */
  blurb: string;
}

export const TOWN_EVENTS: readonly TownEvent[] = [
  { id: 'roast', weekday: 0, host: 'home', name: 'Bữa trưa Chủ nhật nhà Grace', blurb: 'Grace nấu, hàng xóm sang ăn và kể chuyện tuần qua.' },
  { id: 'games', weekday: 2, host: 'square', name: 'Tối board game của Leo', blurb: 'Tối thứ Ba ở quảng trường: bàn cờ, bánh, và cãi nhau về luật chơi.' },
  { id: 'club', weekday: 4, host: 'school', name: 'CLB hội thoại của Daniel', blurb: 'Tối thứ Năm ở trường: mỗi tuần một chủ đề, ai cũng phải nói.' },
  { id: 'dinner', weekday: 5, host: 'cafe', name: 'Bữa tối thứ Sáu ở quán Emma', blurb: 'Emma đóng quầy sớm, kê bàn dài, ai tới cũng có chỗ.' },
  { id: 'market', weekday: 6, host: 'board', name: 'Chợ phiên thứ Bảy', blurb: 'Tom dựng sạp trên quảng trường từ sáng; cả thị trấn ra chợ.' },
];

/** The local weekday of a moment (0 Sunday … 6 Saturday). */
export function weekdayOf(ts: number): number {
  return new Date(ts).getDay();
}

/** Today's get-together, or null (Monday and Wednesday are quiet). */
export function eventOn(weekday: number): TownEvent | null {
  return TOWN_EVENTS.find((e) => e.weekday === weekday) ?? null;
}

/** The week of a local day (a count that goes up by one each Monday): which telling of a get-together is on. */
export function weekOf(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  // local noon: never a day off across a clock change
  const t = new Date(y, (m || 1) - 1, d || 1, 12).getTime();
  return Math.floor((t / 86400000 + 3) / 7);
}

// ───────────────────────── the weather ─────────────────────────

/** A stable number for a day ("2026-11-25") and a salt. */
function dayHash(day: string, salt: number): number {
  let n = 0;
  for (let i = 0; i < day.length; i++) n = (n * 31 + day.charCodeAt(i)) | 0;
  return hash2(n, salt, 77);
}

/** The day's weather, the same on every machine: about half the days clear, a third cloudy, a sixth rain. */
export function weatherOf(day: string): Weather {
  const h = dayHash(day, 1);
  return h < 0.17 ? 'rain' : h < 0.5 ? 'cloudy' : 'clear';
}

export const WEATHER_NAME: Readonly<Record<Weather, string>> = { clear: 'Trời nắng', cloudy: 'Trời nhiều mây', rain: 'Trời mưa' };

// ───────────────────────── which scene plays ─────────────────────────

/** The scenes of a list not heard in the last days, or all of them once every one was. */
function fresh<T extends ListenScene>(list: readonly T[], recent: ReadonlySet<string>): readonly T[] {
  const left = list.filter((s) => !recent.has(s.id));
  return left.length > 0 ? left : list;
}

/**
 * What is overheard from a bench today: one scene per bench and day (sitting down again plays the same one), another
 * on another bench, never one heard in the last days while others are left. `bench` is the bench's number.
 */
export function overheardAt<T extends ListenScene>(list: readonly T[], bench: number, day: string, recent: ReadonlySet<string>): T | null {
  const pool = fresh(list, recent);
  if (pool.length === 0) return null;
  return pool[Math.floor(dayHash(day, 100 + bench) * pool.length) % pool.length];
}

/**
 * What the radio reads now: the segments that fit today's weather and weekday, `turn` being how many were heard
 * today (the next one each time, round and round).
 */
export function radioNow<T extends ListenScene>(list: readonly T[], day: string, weekday: number, weather: Weather, turn: number, recent: ReadonlySet<string>): T | null {
  const fit = list.filter((s) => (s.weather === undefined || s.weather === weather) && (s.weekday === undefined || s.weekday === weekday));
  if (fit.length === 0) return null;
  // today's own first (the forecast, the day's notice), then the rest, in an order of the day's own
  const order = [...fit].sort((a, b) => {
    const own = Number(b.weather !== undefined || b.weekday !== undefined) - Number(a.weather !== undefined || a.weekday !== undefined);
    return own || dayHash(day, hashOf(a.id)) - dayHash(day, hashOf(b.id));
  });
  const unheard = order.filter((s) => !recent.has(s.id));
  const pool = unheard.length > 0 ? unheard : order;
  return pool[Math.max(0, turn) % pool.length];
}

function hashOf(id: string): number {
  let n = 0;
  for (let i = 0; i < id.length; i++) n = (n * 33 + id.charCodeAt(i)) | 0;
  return n;
}

/** This week's telling of a get-together: the tellings take turns week by week. */
export function eventScene<T extends ListenScene>(list: readonly T[], event: string, day: string): T | null {
  const own = list.filter((s) => s.event === event);
  if (own.length === 0) return null;
  return own[((weekOf(day) % own.length) + own.length) % own.length];
}

// ───────────────────────── what a scene pays ─────────────────────────

/** Scenes of a kind that pay in a day (the rest can still be heard, for nothing). */
export const SCENE_PAID_A_DAY: Readonly<Record<ListenScene['kind'], number>> = { overheard: 4, radio: 3, event: 1 };
/** Xu for a question answered right at the first try. */
export const SCENE_XU: Readonly<Record<ListenScene['kind'], number>> = { overheard: 2, radio: 2, event: 4 };
/** Xu for having been at a get-together to its end, whatever was understood. */
export const EVENT_COME_XU = 2;
/** Friendship with the host of a get-together attended (once a day). */
export const EVENT_BOND = 15;

export interface SceneResult {
  /** Questions answered right at the first try (0–2). */
  right: number;
  /** Questions there were (1–2). */
  asked: number;
  /** Times the whole scene was played before the last answer. */
  plays: number;
}

export interface ScenePay {
  xu: number;
  /** Friendship points for the host (get-togethers). */
  bond: number;
  /** The day's paid scenes of this kind were used up before this one. */
  capped: boolean;
}

/** What a scene pays: `paidToday` = the scene ids paid today (town-progress's daily set `heard`). */
export function scenePay(scene: Pick<ListenScene, 'id' | 'kind'>, result: SceneResult, paidToday: readonly string[]): ScenePay {
  const prefix = scene.kind === 'overheard' ? 'oh-' : scene.kind === 'radio' ? 'fm-' : 'ev-';
  const used = paidToday.filter((id) => id.startsWith(prefix));
  if (used.includes(scene.id) || used.length >= SCENE_PAID_A_DAY[scene.kind]) return { xu: 0, bond: 0, capped: !used.includes(scene.id) };
  const right = Math.max(0, Math.min(result.asked, result.right));
  const xu = right * SCENE_XU[scene.kind] + (scene.kind === 'event' ? EVENT_COME_XU : 0);
  return { xu, bond: scene.kind === 'event' ? EVENT_BOND : 0, capped: false };
}
