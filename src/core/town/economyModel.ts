// The game's economy on one page (docs/town.md §31 "Kinh tế"; docs/gta-plan.md §6): every source of xu and every sink,
// each with its REAL constant imported from where it lives, and a small simulation of three learners over 60 days.
// It is a model for deciding numbers, used by its tests and to write the docs' table, never by the app (nothing here
// is in a page's bundle). Every rate in it (minutes a thing takes, share understood, when the city opens) is a GUESS
// until somebody really plays; the tests pin the properties the numbers must keep, not the numbers.
//
// A learner: minutes a day, the share of what they hear that they understand, and a mix: how much they like each
// thing. Each day the minutes go, one session at a time, to the source most behind its share of the mix among those
// open and not yet at their daily cap; then the learner buys, in order: the town's lots, its decorations, the hideout
// (once the city's story has opened it), the office's upgrades, then vehicles. A fine comes now and then once they
// drive in Westbay.

import { CAFE_XU_DAY } from './cafe';
import { CHAPTER_XU, STAR_XU } from './cases';
import { CITY_XU } from './city';
import { DAILY_TASKS_XU } from './daily';
import { DELIVERY_CLEAN_XU, DELIVERY_DAY, DELIVERY_XU } from './delivery';
import { DISPATCH_FIRST_XU, DISPATCH_SHIFTS_A_DAY, DISPATCH_XU } from './dispatch';
import { CONVERSATION_BONUS, LINE_REWARD, TYPED_BONUS } from './economy';
import { EPISODE_FINISH_XU, EPISODE_GIST_FIRST_XU, EPISODE_RELISTEN_XU } from './episodes';
import { FARM_DAILY_CARDS, FARM_GOLDEN_XU, FARM_XU_PER_CARD } from './farm';
import { FISH_DAILY_XU } from './fishing';
import { JOB_PAY, JOBS_PAID_A_DAY, jobLevelPay, type JobGrade } from './job';
import { SPEECH_RULES, type SpeechLevel } from './difficulty';
import { OFFICE_UPGRADES, officeTakings, shiftSetup, WORDS_PAID_A_DAY, wordPay } from './office';
import { fineFor } from './police';
import { SHIFT_XU_DAY } from './shift';
import { TAXI_FIRST_XU, TAXI_PAID_A_DAY, TAXI_XU } from './taxi';
import { VISIT_SIZE } from './types';
import { EVENT_COME_XU, SCENE_PAID_A_DAY, SCENE_XU } from './world';
import { HIDEOUT_COST } from '../../data/city/hideout';
import { CITY_SHIFTS } from '../../data/city/shifts';
import { TOWN_DECORATIONS, TOWN_PLACES } from '../../data/town';
import { GARAGE } from '../../data/townGarage';
import { RARITY } from '../../data/townGame';

/** Where a source is: the town from the first day, Westbay once its bus station is built, the office later. */
export type Opens = 'town' | 'city' | 'office';

export type SourceId =
  | 'chat'
  | 'episode'
  | 'relisten'
  | 'tasks'
  | 'fish'
  | 'farm'
  | 'cafe'
  | 'delivery'
  | 'case'
  | 'overheard'
  | 'radio'
  | 'event'
  | 'ride'
  | 'cityScene'
  | 'taxi'
  | 'workShift'
  | 'job'
  | 'dispatch'
  | 'takings';

/** What the learner's state is when a session is played (some sources pay less once their fresh content is used). */
export interface ModelState {
  /** Quick-chat lines never understood yet (each pays LINE_REWARD.first the first time). */
  freshLines: number;
  /** Episodes not heard through yet. */
  episodesLeft: number;
  /** Case chapters not played yet. */
  chaptersLeft: number;
  /** City scenes not heard yet. */
  cityLeft: number;
  /** Office upgrades owned. */
  upgrades: readonly string[];
}

export interface Source {
  id: SourceId;
  /** In English: for the docs' table only (never shown in the app). */
  name: string;
  opens: Opens;
  /** Minutes one session takes (a guess). */
  minutes: number;
  /** Sessions that pay in a day (Infinity: no cap but the minutes). */
  perDay: number;
  /** Expected xu of one session for a learner who understands `p` (0 … 1) of what they hear. */
  xu(p: number, s: ModelState): number;
  /** Sessions its content still allows (absent: as many as the cap). */
  left?(s: ModelState): number;
  /** `n` sessions (may be a fraction: an expected value) use up fresh content. */
  use?(s: ModelState, n: number): ModelState;
}

/**
 * The speech level a learner who understands `p` settles at (core/town/difficulty.ts follows them to about 85% right):
 * a guess of the model, so that a better learner's jobs and shifts pay a little more (SPEECH_RULES pay).
 */
export function speechLevelFor(p: number): SpeechLevel {
  if (p < 0.6) return 1;
  if (p < 0.75) return 2;
  if (p < 0.88) return 3;
  if (p < 0.94) return 4;
  return 5;
}
export const speechPay = (p: number): number => SPEECH_RULES[speechLevelFor(p)].pay;

/** The chance a job ends clean, messy or broken for a learner at `p` (four facts to hear, one consequence each). */
export function gradeOdds(p: number, facts = 4): Record<JobGrade, number> {
  const c = (n: number, k: number): number => {
    let r = 1;
    for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
    return r;
  };
  const hits = (k: number) => c(facts, k) * (1 - p) ** k * p ** (facts - k);
  const clean = hits(0);
  const messy = hits(1) + hits(2);
  return { clean, messy, broken: Math.max(0, 1 - clean - messy) };
}

const avgCatch = (() => {
  const all = Object.values(RARITY);
  const w = all.reduce((n, r) => n + r.fishWeight, 0);
  return all.reduce((n, r) => n + r.fishWeight * r.catchXu, 0) / w;
})();

/** Every source of xu, with its constants from where they live. The minutes are guesses. */
export const SOURCES: readonly Source[] = [
  {
    id: 'chat',
    name: 'Quick chats',
    opens: 'town',
    minutes: 3,
    perDay: Infinity,
    xu: (p, s) => {
      const fresh = Math.min(VISIT_SIZE, s.freshLines);
      const line = fresh * p * LINE_REWARD.first + (VISIT_SIZE - fresh) * p * LINE_REWARD.again;
      return line + p ** VISIT_SIZE * CONVERSATION_BONUS + p * TYPED_BONUS;
    },
    use: (s, n) => ({ ...s, freshLines: Math.max(0, s.freshLines - n * VISIT_SIZE) }),
  },
  {
    id: 'episode',
    name: 'Episodes (first time)',
    opens: 'town',
    minutes: 7,
    perDay: 1,
    // the gist on the first pass, the finish, about eight lines understood for the first time in step 2
    xu: (p) => p * EPISODE_GIST_FIRST_XU + EPISODE_FINISH_XU + 8 * p * LINE_REWARD.first,
    left: (s) => s.episodesLeft,
    use: (s, n) => ({ ...s, episodesLeft: Math.max(0, s.episodesLeft - n) }),
  },
  { id: 'relisten', name: 'Episode re-listens', opens: 'town', minutes: 3, perDay: 2, xu: (p) => p * EPISODE_RELISTEN_XU },
  { id: 'tasks', name: 'Daily tasks', opens: 'town', minutes: 0.5, perDay: 1, xu: (p) => DAILY_TASKS_XU * Math.min(1, p + 0.1) },
  // twelve casts in five minutes, the day's cap shared by two sessions
  { id: 'fish', name: 'Fishing', opens: 'town', minutes: 5, perDay: 2, xu: (p) => Math.min(FISH_DAILY_XU / 2, 12 * p * avgCatch) },
  {
    id: 'farm',
    name: 'Farm (review cards)',
    opens: 'town',
    minutes: 6,
    perDay: 1,
    xu: (p) => FARM_DAILY_CARDS * p * FARM_XU_PER_CARD + p * FARM_GOLDEN_XU,
  },
  { id: 'cafe', name: 'Café counter', opens: 'town', minutes: 4, perDay: 2, xu: (p) => (CAFE_XU_DAY / 2) * p },
  { id: 'delivery', name: 'Deliveries', opens: 'town', minutes: 2, perDay: DELIVERY_DAY, xu: (p) => (DELIVERY_XU + DELIVERY_CLEAN_XU * p) * p },
  {
    id: 'case',
    name: 'Cases (a chapter)',
    opens: 'town',
    minutes: 6,
    perDay: 1,
    xu: (p) => CHAPTER_XU + STAR_XU * (1 + 2 * p),
    left: (s) => s.chaptersLeft,
    use: (s, n) => ({ ...s, chaptersLeft: Math.max(0, s.chaptersLeft - n) }),
  },
  { id: 'overheard', name: 'Benches (overheard)', opens: 'town', minutes: 1, perDay: SCENE_PAID_A_DAY.overheard, xu: (p) => SCENE_XU.overheard * p },
  { id: 'radio', name: 'Bay FM radio', opens: 'town', minutes: 1.5, perDay: SCENE_PAID_A_DAY.radio, xu: (p) => 2 * SCENE_XU.radio * p },
  { id: 'event', name: 'Weekly get-togethers', opens: 'town', minutes: 4, perDay: SCENE_PAID_A_DAY.event, xu: (p) => 2 * SCENE_XU.event * p + EVENT_COME_XU },
  { id: 'ride', name: 'Bus no. 9', opens: 'city', minutes: 1.5, perDay: SCENE_PAID_A_DAY.ride, xu: (p) => 2 * SCENE_XU.ride * p },
  {
    id: 'cityScene',
    name: 'Westbay scenes (first time)',
    opens: 'city',
    minutes: 3,
    perDay: Infinity,
    xu: (p) => 2 * CITY_XU * p,
    left: (s) => s.cityLeft,
    use: (s, n) => ({ ...s, cityLeft: Math.max(0, s.cityLeft - n) }),
  },
  { id: 'taxi', name: "Rico's taxi fares", opens: 'city', minutes: 2.5, perDay: TAXI_PAID_A_DAY, xu: (p) => (TAXI_XU + TAXI_FIRST_XU * p) * p },
  { id: 'workShift', name: 'Westbay work shifts', opens: 'city', minutes: 5, perDay: CITY_SHIFTS.length, xu: (p) => SHIFT_XU_DAY * p * 0.8 },
  {
    id: 'job',
    name: 'Jobs',
    opens: 'city',
    minutes: 12,
    perDay: JOBS_PAID_A_DAY,
    // a level-2 job, the odds of each grade at p
    xu: (p) => {
      const o = gradeOdds(p);
      return (o.clean * jobLevelPay('clean', 2) + o.messy * jobLevelPay('messy', 2) + o.broken * jobLevelPay('broken', 2)) * speechPay(p);
    },
  },
  {
    id: 'dispatch',
    name: 'Dispatch office (a shift)',
    opens: 'office',
    minutes: 5,
    perDay: DISPATCH_SHIFTS_A_DAY,
    xu: (p, s) => shiftSetup(s.upgrades).calls * (DISPATCH_XU + DISPATCH_FIRST_XU * p * 0.6) * p * speechPay(p),
  },
  {
    id: 'takings',
    name: "Takings (Tess's word)",
    opens: 'office',
    minutes: 0.5,
    perDay: WORDS_PAID_A_DAY,
    xu: (p, s) => p * wordPay(officeTakings(s.upgrades), true) + (1 - p) * wordPay(officeTakings(s.upgrades), false),
  },
];

export interface Learner {
  id: string;
  /** In English: for the docs' table only. */
  name: string;
  minutes: number;
  /** The share of what they hear that they understand. */
  understood: number;
  /** How much they like each thing (absent = never plays it). */
  mix: Partial<Record<SourceId, number>>;
}

/** The three learners of the docs' table (their mixes are guesses, stated). */
export const LEARNERS: readonly Learner[] = [
  {
    id: 'ten',
    name: '10 min a day, understands 70%',
    minutes: 10,
    understood: 0.7,
    mix: { chat: 4, episode: 2, tasks: 1, fish: 1, farm: 1, radio: 1, overheard: 1, cityScene: 2, taxi: 1, job: 1, takings: 1 },
  },
  {
    id: 'twenty',
    name: '20 min a day, understands 80%',
    minutes: 20,
    understood: 0.8,
    mix: {
      chat: 3, episode: 2, relisten: 1, tasks: 1, fish: 1, farm: 2, cafe: 1, delivery: 1, case: 1, overheard: 1, radio: 1, event: 1,
      ride: 1, cityScene: 2, taxi: 1, workShift: 1, job: 2, dispatch: 2, takings: 1,
    },
  },
  {
    id: 'forty',
    name: '40 min a day, understands 85%',
    minutes: 40,
    understood: 0.85,
    mix: {
      chat: 2, episode: 2, relisten: 1, tasks: 1, fish: 1, farm: 2, cafe: 1, delivery: 1, case: 1, overheard: 1, radio: 1, event: 1,
      ride: 1, cityScene: 2, taxi: 1, workShift: 1, job: 2, dispatch: 2, takings: 1,
    },
  },
];

/** The town's paid lots in the order they are offered, and its decorations. */
const LOTS = TOWN_PLACES.filter((p) => p.cost > 0);
const STATION = LOTS.findIndex((p) => p.id === 'station');

/** How long after Westbay opens the main story's second part ends (the office and the hideout's card: a guess). */
export const OFFICE_AFTER_CITY_DAYS = 14;
/** A fine every this many days once the learner drives in Westbay (a guess), at this heat. */
export const FINE_EVERY_DAYS = 5;
export const FINE_HEAT = 4;

export interface DayRecord {
  day: number;
  earned: Partial<Record<SourceId, number>>;
  total: number;
  fine: number;
  balance: number;
  bought: string[];
}

export interface Simulation {
  learner: Learner;
  days: DayRecord[];
  /** The day (1-based) each thing was bought, by id. */
  boughtOn: Record<string, number>;
  /** The day Westbay opened, the day the office opened (null: never in the run). */
  cityDay: number | null;
  officeDay: number | null;
}

/** The thing the learner buys next, or null (they save). */
function nextBuy(owned: ReadonlySet<string>, office: boolean): { id: string; cost: number } | null {
  for (const p of LOTS) if (!owned.has(p.id)) return { id: p.id, cost: p.cost };
  for (const d of TOWN_DECORATIONS) if (!owned.has(d.id)) return { id: d.id, cost: d.cost };
  if (!office) return null;
  if (!owned.has('hideout')) return { id: 'hideout', cost: HIDEOUT_COST };
  for (const u of OFFICE_UPGRADES) if (!owned.has(u.id)) return { id: u.id, cost: u.cost };
  for (const g of GARAGE) if (!owned.has(g.id)) return { id: g.id, cost: g.cost };
  return null;
}

/** Sixty days (or `days`) of a learner. */
export function simulate(learner: Learner, days = 60, sources: readonly Source[] = SOURCES): Simulation {
  const p = learner.understood;
  let state: ModelState = { freshLines: 300, episodesLeft: 60, chaptersLeft: 15, cityLeft: 160, upgrades: [] };
  let balance = 0;
  const owned = new Set<string>();
  const boughtOn: Record<string, number> = {};
  const out: DayRecord[] = [];
  let cityDay: number | null = null;
  let officeDay: number | null = null;
  for (let day = 1; day <= days; day++) {
    const open = (o: Opens) => o === 'town' || (o === 'city' && cityDay !== null) || (o === 'office' && officeDay !== null);
    // the minutes shared out by the mix (expected sessions, fractions allowed); a source at its cap or out of content
    // gives its share back to the others
    const earned: Partial<Record<SourceId, number>> = {};
    let left = learner.minutes;
    let active = sources.filter((src) => (learner.mix[src.id] ?? 0) > 0 && open(src.opens) && (src.left ? src.left(state) > 0 : true));
    const sessions = new Map<SourceId, number>();
    for (let round = 0; round < 30 && active.length > 0 && left > 1e-9; round++) {
      const sum = active.reduce((n, src) => n + (learner.mix[src.id] ?? 0), 0);
      const capped = active.filter((src) => {
        const room = Math.min(src.perDay, src.left ? src.left(state) : Infinity) - (sessions.get(src.id) ?? 0);
        return (left * (learner.mix[src.id] ?? 0)) / sum / src.minutes >= room;
      });
      if (capped.length === 0) {
        for (const src of active) sessions.set(src.id, (sessions.get(src.id) ?? 0) + (left * (learner.mix[src.id] ?? 0)) / sum / src.minutes);
        left = 0;
        break;
      }
      for (const src of capped) {
        const room = Math.min(src.perDay, src.left ? src.left(state) : Infinity) - (sessions.get(src.id) ?? 0);
        sessions.set(src.id, (sessions.get(src.id) ?? 0) + room);
        left -= room * src.minutes;
      }
      active = active.filter((src) => !capped.includes(src));
    }
    for (const src of sources) {
      const n = sessions.get(src.id) ?? 0;
      if (n <= 0) continue;
      earned[src.id] = n * src.xu(p, state);
      if (src.use) state = src.use(state, n);
    }
    const total = Object.values(earned).reduce((n, x) => n + (x ?? 0), 0);
    balance += total;
    // a fine now and then once they drive in Westbay: it hurts, it never empties
    let fine = 0;
    if (cityDay !== null && (day - cityDay) % FINE_EVERY_DAYS === FINE_EVERY_DAYS - 1) {
      fine = fineFor(FINE_HEAT, p >= 0.5, balance);
      balance -= fine;
    }
    const bought: string[] = [];
    for (;;) {
      const next = nextBuy(owned, officeDay !== null);
      if (!next || next.cost > balance) break;
      balance -= next.cost;
      owned.add(next.id);
      boughtOn[next.id] = day;
      bought.push(next.id);
    }
    state = { ...state, upgrades: OFFICE_UPGRADES.filter((u) => owned.has(u.id)).map((u) => u.id) };
    // Westbay opens the day after the bus station stands; the office a while into its story
    if (cityDay === null && STATION >= 0 && owned.has(LOTS[STATION].id)) cityDay = day + 1;
    if (officeDay === null && cityDay !== null && day + 1 >= cityDay + OFFICE_AFTER_CITY_DAYS) officeDay = day + 1;
    out.push({ day, earned, total, fine, balance, bought });
  }
  return { learner, days: out, boughtOn, cityDay, officeDay };
}

/** Mean xu a day, by source, over days `from` … `to` (1-based, inclusive). */
export function sourceShares(sim: Simulation, from: number, to: number): { total: number; by: Partial<Record<SourceId, number>> } {
  const days = sim.days.filter((d) => d.day >= from && d.day <= to);
  const by: Partial<Record<SourceId, number>> = {};
  let total = 0;
  for (const d of days) {
    for (const [k, v] of Object.entries(d.earned)) by[k as SourceId] = (by[k as SourceId] ?? 0) + (v ?? 0);
    total += d.total;
  }
  const n = Math.max(1, days.length);
  for (const k of Object.keys(by)) by[k as SourceId]! /= n;
  return { total: total / n, by };
}

/** Xu a minute of a source for a learner at `p` (fresh content where it matters). */
export function perMinute(id: SourceId, p: number, s: Partial<ModelState> = {}): number {
  const src = SOURCES.find((x) => x.id === id)!;
  const state: ModelState = { freshLines: 300, episodesLeft: 60, chaptersLeft: 15, cityLeft: 160, upgrades: [], ...s };
  return src.xu(p, state) / src.minutes;
}

/** The constants the model reads that a rebalance may move (for the docs' before / after table). */
export const JOB_PAY_NOW: Readonly<Record<JobGrade, number>> = JOB_PAY;
