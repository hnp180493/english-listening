// What the learner has understood, earned and bought in "Thị trấn". Pure: storage is in ./store, the rules (what a
// line pays, what things cost, the daily tasks) are in ./economy and ./daily, the game loops in ./fishing ./farm
// ./eggs ./wardrobe ./unlocks.
//
// Stored under KEYS.town ('town-progress', synced):
//   {
//     version: 4,
//     lines:  { [lineId]: { best, tries, at } },
//     earned: { [deviceId]: xu },
//     bought: [id, …],
//     daily:  { [day]: { [deviceId]: { talks, lines, first, met: [placeId, …], paid: [taskId, …], fish?, fishFirst?,
//                                      fishXu?, harvest?, eps?, perfect? } } },
//     days:   [day, …],
//     episodes: { [episodeId]: { stage, at, okAt, firstGist, bestLines } },
//     // version 4: the game loops (docs/town.md §10 "Vòng chơi")
//     fish:     { [speciesId]: { seen, caught, firstAt, bestMs, at } },
//     farmDays: [day, …],
//     eggs:     { grants: [grantId, …], bought: { [deviceId]: n }, hatched: { [deviceId]: n }, rare: { [deviceId]: n } },
//     owned:    { [itemId]: firstAt },
//     look:     { hat, outfit, pet, title, at },
//     unlocks:  { [achievementOrProjectId]: firstAt },
//     // version 5: friendship with the residents (docs/town.md §12 "Thân thiết", ./friendship)
//     friends:  { [placeId]: { up: { [deviceId]: n }, down: { [deviceId]: n } } },
//     facts:    { [factId]: firstAt },
//     choices:  { [lineId]: { o: optionId, at } },
//     gifts:    { bought: { [giftId]: { [deviceId]: n } }, given: { [giftId]: { [deviceId]: n } } },
//     // version 6: typed checks (docs/town.md §13 "Gõ lại cụm vừa nghe", ./typing)
//     typed:    { [deviceId]: { n, ok } },
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
// - daily: what the daily tasks need, per local day and browser: conversations finished, lines understood, lines
//   understood on the first listen, the places talked at, the tasks already paid, and (version 4, optional, absent =
//   0) `fish` fish caught, `fishFirst` of them on the first listen, `fishXu` xu paid by fishing (the daily cap),
//   `harvest` review cards paid as a harvest, `eps` episodes heard through (a finish or a re-listen), `perfect` quick
//   chats with every line right. `tasks` (2026-11-21, optional) the day's three tasks of that browser, fixed by its
//   first write of the day (./daily fixDayTasks); a copy without them takes the other's, two lists keep the one whose
//   ids come first. Counters merge by max, the sets as unions. A write keeps the DAILY_KEEP_DAYS days up
//   to today; a read or a merge keeps at most the newest DAILY_MAX_DAYS (so a few days written by a machine with a
//   wrong clock cannot push today out).
// - days: local days with at least one answered line (for the town streak), a union, newest DAYS_KEEP kept.
// - episodes ("Chuyện ở thị trấn", ./episodes): per episode, `stage` 0 = begun, 1 = finished, +1 per spaced
//   re-listen whose gist was right (at most EPISODE_MAX_STAGE); `at` = the last whole listen that counted (the finish
//   or a re-listen), `okAt` = the last one whose gist was right (the finish counts as right); `firstGist` 0 = not
//   asked yet, 1 = not right on the very first listen, 2 = right on it; `bestLines` = most lines understood in one
//   run. Every field only grows (max per field); the next re-listen is derived (./episodes episodeDueDay).
// - fish (./fishing): per species, `seen` casts that hooked it, `caught` catches, `firstAt` the first catch (min of
//   the times > 0), `bestMs` the fastest right answer of a catch (min of the values > 0), `at` the last catch (max).
//   `caught` merges by max: two machines catching the same species before a sync count as the larger of the two (a
//   collection, not a measurement).
// - farmDays (./farm): local days the whole farm was harvested (the "golden crop"), a union, newest DAYS_KEEP kept.
// - eggs (./eggs): `grants` the ids of the eggs earned by listening milestones (a union: 'gist:cafe-1', 'fish:…',
//   'farm:<day>', 'perfect:<day>', 'streak:<day>'), `bought` eggs bought with xu per browser, `hatched` eggs opened
//   per browser, `rare` per browser the number of its hatch that last gave a rare item (the pity rule). The counters
//   are per browser and only that browser adds to them, so they merge by max. Eggs in hand are derived.
// - owned (./eggs, ./wardrobe): items hatched, with the first time (min of the times > 0). Nothing is ever lost.
// - look (./wardrobe): what the player wears, a value replaced as a whole: it carries its own change time `at`, and
//   the copy with the later `at` wins (equal times: the larger canonical string, so every machine picks the same).
// - unlocks (./unlocks): achievements and town projects reached, with the first time (min of the times > 0).
// - friends (version 5, ./friendship): friendship points a browser added with a resident by quick chats and gifts,
//   per browser and only ever growing (`up` the points won, `down` the points lost to a gift they dislike), so they
//   merge by max per device like `earned`. The points of episodes and choices are derived (never stored here).
// - facts: what the residents and the learner know about each other, with the first time (min of the times > 0).
//   Never forgotten.
// - choices: per choice line of an episode, the option first chosen and when: the earlier one wins (equal times: the
//   smaller id), so two machines that chose differently before a sync both keep the first.
// - gifts: gifts bought and given, per gift and browser (max per device). Gifts in hand = bought − given.
// - typed (version 6, ./typing): typed checks per browser: `n` checks answered, `ok` of them typed right at the
//   first check (no hint). Only that browser adds to its own bucket, so they merge by max per device and field (like
//   `earned`); the town's one real measure ("gõ đúng khi nghe") is the sum over browsers.
// - daily rows (version 5, optional): `bond` the residents whose quick-chat friendship points were paid today,
//   `gifted` the residents given a gift today, `street` the residents met in the street today (sets: union).
// Every field only grows (the look aside, which is ordered by its own time), so the merge (core/syncMerge mergeTown)
// is idempotent, commutative and associative. The caps keep those laws: "the newest N keys of a union" does not
// depend on the order of merging.
//
// A version 1 value ({ version: 1, lines }) reads as the same lines with nothing earned or bought; a version 2 value
// (no episodes) reads as it was, with no episode begun; a version 3 value (no game loops) reads with no fish, no
// eggs, nothing owned or worn and nothing unlocked: the first write of version 4 grants the eggs and records the
// achievements the stored listening already earned (./unlocks settleTown).
//
// A value written by a NEWER build (version above TOWN_VERSION) keeps its version and its unknown top-level fields
// through parse, merge and every write (townExtras), so this build relays them instead of stripping them when it
// syncs (an old portable copy beside a new one). Builds from before this guard strip them: docs/town.md §10 Stored.
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
  // the game loops (version 4): optional, absent = 0 (a version 3 row reads and writes as it was)
  /** Fish caught (./fishing). */
  fish?: number;
  /** Of those, caught on the first listen. */
  fishFirst?: number;
  /** Xu paid by fishing today (FISH_DAILY_XU caps the sum over the browsers). */
  fishXu?: number;
  /** Review cards paid as a harvest (./farm; FARM_DAILY_CARDS caps the sum over the browsers). */
  harvest?: number;
  /** Episodes heard through: a first finish, a later finish or a re-listen (./episodes). */
  eps?: number;
  /** Quick chats with every line right (./economy applyConversation). */
  perfect?: number;
  /**
   * The day's tasks of this browser (sorted task ids, ./daily), fixed by its first write of the day so they never
   * change during the day. Absent: not fixed yet (a row of an older build, or nothing written today).
   */
  tasks?: string[];
  /** Residents whose quick-chat friendship points were paid today (version 5, ./friendship; sorted place ids). */
  bond?: string[];
  /** Residents given a gift today (version 5, ./friendship; sorted place ids). */
  gifted?: string[];
  /** Residents met in the street today whose meeting paid its friendship points (./friendship; sorted place ids). */
  street?: string[];
  /** Residents served right at the café counter today whose friendship was paid (./cafeStore; sorted place ids). */
  served?: string[];
  /** Residents who had a delivery from the café today (./deliveryStore; sorted place ids). */
  sent?: string[];
  /** The scenes heard in the world today that paid (./world scenePay; sorted scene ids: oh-…, fm-…, ev-…). */
  heard?: string[];
}

/** The optional sets of DailyCount (merge: union; parse: dropped when empty). */
export const DAILY_SETS = ['bond', 'gifted', 'street', 'served', 'sent', 'heard'] as const;
export type DailySet = (typeof DAILY_SETS)[number];

/** The optional counters of DailyCount (merge: max; parse: dropped when 0). */
export const DAILY_EXTRA = ['fish', 'fishFirst', 'fishXu', 'harvest', 'eps', 'perfect'] as const;
export type DailyExtra = (typeof DAILY_EXTRA)[number];

/** The gist of an episode on its very first listen: 0 = not asked yet, 1 = not right, 2 = right. */
export type GistMark = 0 | 1 | 2;

export interface EpisodeProgress {
  /** 0 = begun, not finished; 1 = finished; +1 per re-listen with the gist right, at most EPISODE_MAX_STAGE. */
  stage: number;
  /** The last whole listen that counted (the finish or a re-listen), epoch ms; 0 before the finish. */
  at: number;
  /** The last of those whose gist was right (the finish counts as right), epoch ms. */
  okAt: number;
  firstGist: GistMark;
  /** Most lines understood in one run of the episode. */
  bestLines: number;
}

/** One fish species in the collection (./fishing). */
export interface FishRecord {
  /** Casts that hooked it (caught or not). */
  seen: number;
  caught: number;
  /** The first catch, epoch ms (0 = never caught). */
  firstAt: number;
  /** The fastest right answer that caught it, ms (0 = none). */
  bestMs: number;
  /** The last catch, epoch ms. */
  at: number;
}

/** Eggs (./eggs): what was earned, bought and opened. Eggs in hand = grants + bought − hatched. */
export interface EggState {
  /** Ids of the eggs earned by listening milestones (sorted). */
  grants: string[];
  /** Eggs bought with xu, per browser. */
  bought: Record<string, number>;
  /** Eggs opened, per browser. */
  hatched: Record<string, number>;
  /** Per browser: the number of its hatch that last gave a rare item (0 = none yet). */
  rare: Record<string, number>;
}

export type LookSlot = 'hat' | 'outfit' | 'pet' | 'title';
export const LOOK_SLOTS: readonly LookSlot[] = ['hat', 'outfit', 'pet', 'title'];

/** What the player wears (./wardrobe). Replaced as a whole, with its own change time. */
export interface TownLook {
  hat: string | null;
  outfit: string | null;
  pet: string | null;
  title: string | null;
  /** When it was last changed, epoch ms (0 = never). */
  at: number;
}

/** Friendship points browsers added with one resident (./friendship): each side only grows, per browser. */
export interface FriendBucket {
  up: Record<string, number>;
  down: Record<string, number>;
}

/** The option of a choice line first chosen, and when (epoch ms > 0). */
export interface ChoiceRecord {
  o: string;
  at: number;
}

/** Typed checks of one browser (./typing): `n` answered, `ok` typed right at the first check. */
export interface TypedBucket {
  n: number;
  ok: number;
}

/** Gifts bought and given (./friendship), per gift and browser. */
export interface GiftState {
  bought: Record<string, Record<string, number>>;
  given: Record<string, Record<string, number>>;
}

export interface TownProgress {
  /** TOWN_VERSION, or the higher version of a newer build whose unknown fields this value carries (see parse). */
  version: number;
  lines: Record<string, LineProgress>;
  earned: Record<string, number>;
  bought: string[];
  daily: Record<string, Record<string, DailyCount>>;
  days: string[];
  episodes: Record<string, EpisodeProgress>;
  fish: Record<string, FishRecord>;
  farmDays: string[];
  eggs: EggState;
  owned: Record<string, number>;
  look: TownLook;
  unlocks: Record<string, number>;
  // version 5: friendship (./friendship)
  friends: Record<string, FriendBucket>;
  facts: Record<string, number>;
  choices: Record<string, ChoiceRecord>;
  gifts: GiftState;
  // version 6: typed checks (./typing)
  typed: Record<string, TypedBucket>;
  /**
   * Fines paid to Westbay's police (docs/town.md §28), xu per browser: like `earned`, a browser only ever adds to its
   * own bucket and copies merge by max, so a fine is never given back by a sync. Absent when there is none (an old
   * value reads the same).
   */
  fines?: Record<string, number>;
}

/** Stage 1 is the finish, stages 2..5 come with the four re-listens (./episodes RELISTEN_DAYS); at 5 nothing is due. */
export const EPISODE_MAX_STAGE = 5;
const MAX_EPISODES = 400;
const MAX_EPISODE_LINES = 50;

/** The most tasks a day row fixes (./daily TASKS_PER_DAY). */
export const DAY_TASKS_MAX = 3;
/** The version this build writes. A stored value with a higher version was written by a newer build (see parse). */
export const TOWN_VERSION = 6;
/** The highest version a stored value may claim (a higher one is junk and reads as this build's). */
const MAX_VERSION = 1000;
/** Unknown top-level fields of a newer build's value kept: how many, and the size of each as JSON. */
const MAX_EXTRA_KEYS = 32;
const MAX_EXTRA_CHARS = 500_000;
const EXTRA_KEY_RE = /^[A-Za-z][A-Za-z0-9_]{0,39}$/;

/** Days of daily counters a write keeps (today included). */
export const DAILY_KEEP_DAYS = 14;
/** Days of daily counters a read or a merge keeps at most (the newest ones). */
export const DAILY_MAX_DAYS = 60;
/** Active days kept for the streak (and farm days kept). */
export const DAYS_KEEP = 400;
const MAX_DEVICES = 64;
const MAX_BOUGHT = 200;
const MAX_SET = 40;
const MAX_XU = 10_000_000;
const MAX_FISH = 100;
const MAX_OWNED = 300;
const MAX_UNLOCKS = 300;
/** Egg grants kept (sorted; about two a day at most: years of play). */
export const MAX_GRANTS = 4000;
const MAX_COUNT = 1_000_000;
const MAX_FRIENDS = 64;
const MAX_FACTS = 600;
const MAX_CHOICES = 600;
const MAX_GIFT_KINDS = 100;
/** Friendship points one browser can hold on one side (the score itself is 0..FRIEND_MAX_POINTS, ./friendship). */
const MAX_FRIEND_POINTS = 1_000_000;

const UNSAFE = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_ID = 200;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DEVICE_RE = /^[a-z0-9-]{4,40}$/;
const ITEM_RE = /^[a-z][a-z0-9-]{0,39}$/;
const GRANT_RE = /^[a-z]+:[a-z0-9][a-z0-9-]{0,39}$/;
const FACT_RE = /^[a-z][a-z0-9-]{0,39}:[a-z0-9][a-z0-9-]{0,59}$/;

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const count = (v: unknown): number => (finite(v) && v > 0 ? Math.floor(v) : 0);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const toBest = (v: unknown): LineBest => Math.min(2, count(v)) as LineBest;
const own = <T>(o: Record<string, T>, k: string): T | undefined => (Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);
const safeKey = (k: string): boolean => !UNSAFE.has(k);

export function emptyLook(): TownLook {
  return { hat: null, outfit: null, pet: null, title: null, at: 0 };
}

export function emptyEggs(): EggState {
  return { grants: [], bought: {}, hatched: {}, rare: {} };
}

export function emptyTownProgress(): TownProgress {
  return {
    version: TOWN_VERSION,
    lines: {},
    earned: {},
    bought: [],
    daily: {},
    days: [],
    episodes: {},
    fish: {},
    farmDays: [],
    eggs: emptyEggs(),
    owned: {},
    look: emptyLook(),
    unlocks: {},
    friends: {},
    facts: {},
    choices: {},
    gifts: emptyGifts(),
    typed: {},
  };
}

export function emptyGifts(): GiftState {
  return { bought: {}, given: {} };
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

/** A storable id of an item, a species, an achievement or a project: lower case letters, digits, hyphens. */
export const isGameId = (s: unknown): s is string => typeof s === 'string' && ITEM_RE.test(s) && safeKey(s);
/** A storable egg grant id: '<kind>:<ref>' ('gist:cafe-1', 'farm:2026-11-20'). */
export const isGrantId = (s: unknown): s is string => typeof s === 'string' && GRANT_RE.test(s);
/** A storable fact id: '<placeId>:<slug>' or 'you:<slug>' (core/town/story FactId). */
export const isFactId = (s: unknown): s is string => typeof s === 'string' && FACT_RE.test(s) && safeKey(s);
/** A storable browser id (core/history deviceId). */
export const isDeviceId = (s: unknown): s is string => typeof s === 'string' && isDevice(s);

// ───────────────────────── parse ─────────────────────────

/** One stored line, or null when nothing in it says the line was ever answered. */
function parseLine(raw: unknown): LineProgress | null {
  if (!isObj(raw)) return null;
  const best = toBest(raw.best);
  const tries = count(raw.tries);
  if (best === 0 && tries === 0) return null;
  return { best, tries: Math.max(1, tries), at: finite(raw.at) && raw.at > 0 ? raw.at : 0 };
}

/** Something in the row is not zero or empty. */
function hasCounts(c: DailyCount): boolean {
  return !!(c.talks || c.lines || c.first || c.met.length || c.paid.length || c.tasks?.length || DAILY_EXTRA.some((k) => (c[k] ?? 0) > 0) || DAILY_SETS.some((k) => (c[k]?.length ?? 0) > 0));
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
  for (const k of DAILY_EXTRA) {
    const n = Math.min(MAX_COUNT, count(raw[k]));
    if (n > 0) c[k] = n;
  }
  const tasks = idSet(raw.tasks, isItemId, DAY_TASKS_MAX);
  if (tasks.length > 0) c.tasks = tasks;
  for (const k of DAILY_SETS) {
    const set = idSet(raw[k], isItemId, MAX_SET);
    if (set.length > 0) c[k] = set;
  }
  return hasCounts(c) ? c : null;
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

const clampInt = (v: unknown, max: number): number => Math.min(max, count(v));
const time = (v: unknown): number => (finite(v) && v > 0 ? v : 0);

/** One stored episode, or null when nothing in it says the episode was ever begun. */
function parseEpisode(raw: unknown): EpisodeProgress | null {
  if (!isObj(raw)) return null;
  const e: EpisodeProgress = {
    stage: clampInt(raw.stage, EPISODE_MAX_STAGE),
    at: time(raw.at),
    okAt: time(raw.okAt),
    firstGist: clampInt(raw.firstGist, 2) as GistMark,
    bestLines: clampInt(raw.bestLines, MAX_EPISODE_LINES),
  };
  return e.stage || e.at || e.okAt || e.firstGist || e.bestLines ? e : null;
}

function parseEpisodes(raw: unknown): Record<string, EpisodeProgress> {
  const out: Record<string, EpisodeProgress> = {};
  if (!isObj(raw)) return out;
  for (const id of Object.keys(raw).filter(isEpisodeId).sort().slice(0, MAX_EPISODES)) {
    const e = parseEpisode(raw[id]);
    if (e) out[id] = e;
  }
  return out;
}

/** Per-device counters (eggs bought / hatched / rare): like `earned`. */
function parseDeviceCounts(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObj(raw)) return out;
  for (const dev of Object.keys(raw).filter(isDevice).sort().slice(0, MAX_DEVICES)) {
    const n = clampInt(raw[dev], MAX_COUNT);
    if (n > 0) out[dev] = n;
  }
  return out;
}

/** One stored species, or null when nothing in it says it was ever hooked. */
function parseFishRecord(raw: unknown): FishRecord | null {
  if (!isObj(raw)) return null;
  const caught = clampInt(raw.caught, MAX_COUNT);
  const f: FishRecord = {
    // a catch implies it was hooked
    seen: Math.max(caught, clampInt(raw.seen, MAX_COUNT)),
    caught,
    firstAt: time(raw.firstAt),
    bestMs: clampInt(raw.bestMs, MAX_COUNT),
    at: time(raw.at),
  };
  return f.seen || f.firstAt || f.bestMs || f.at ? f : null;
}

function parseFish(raw: unknown): Record<string, FishRecord> {
  const out: Record<string, FishRecord> = {};
  if (!isObj(raw)) return out;
  for (const id of Object.keys(raw).filter(isGameId).sort().slice(0, MAX_FISH)) {
    const f = parseFishRecord(raw[id]);
    if (f) out[id] = f;
  }
  return out;
}

/** id → time (> 0) maps: owned items, unlocks. */
function parseTimes(raw: unknown, max: number): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObj(raw)) return out;
  for (const id of Object.keys(raw).filter(isGameId).sort().slice(0, max)) {
    const t = time(raw[id]);
    if (t > 0) out[id] = t;
  }
  return out;
}

function parseLook(raw: unknown): TownLook {
  const out = emptyLook();
  if (!isObj(raw)) return out;
  for (const slot of LOOK_SLOTS) {
    const v = raw[slot];
    out[slot] = isGameId(v) ? v : null;
  }
  out.at = time(raw.at);
  return out;
}

function parseEggs(raw: unknown): EggState {
  if (!isObj(raw)) return emptyEggs();
  return {
    grants: idSet(raw.grants, isGrantId, MAX_GRANTS),
    bought: parseDeviceCounts(raw.bought),
    hatched: parseDeviceCounts(raw.hatched),
    rare: parseDeviceCounts(raw.rare),
  };
}

/** Per-device counters by id (gifts bought / given). */
function parseIdDeviceCounts(raw: unknown, max: number): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  if (!isObj(raw)) return out;
  for (const id of Object.keys(raw).filter(isGameId).sort().slice(0, max)) {
    const counts = parseDeviceCounts(raw[id]);
    if (Object.keys(counts).length > 0) out[id] = counts;
  }
  return out;
}

function parseFriendSide(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObj(raw)) return out;
  for (const dev of Object.keys(raw).filter(isDevice).sort().slice(0, MAX_DEVICES)) {
    const n = clampInt(raw[dev], MAX_FRIEND_POINTS);
    if (n > 0) out[dev] = n;
  }
  return out;
}

function parseFriends(raw: unknown): Record<string, FriendBucket> {
  const out: Record<string, FriendBucket> = {};
  if (!isObj(raw)) return out;
  for (const id of Object.keys(raw).filter(isGameId).sort().slice(0, MAX_FRIENDS)) {
    const b = raw[id];
    if (!isObj(b)) continue;
    const up = parseFriendSide(b.up);
    const down = parseFriendSide(b.down);
    if (Object.keys(up).length > 0 || Object.keys(down).length > 0) out[id] = { up, down };
  }
  return out;
}

function parseFacts(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!isObj(raw)) return out;
  for (const id of Object.keys(raw).filter(isFactId).sort().slice(0, MAX_FACTS)) {
    const t = time(raw[id]);
    if (t > 0) out[id] = t;
  }
  return out;
}

function parseChoices(raw: unknown): Record<string, ChoiceRecord> {
  const out: Record<string, ChoiceRecord> = {};
  if (!isObj(raw)) return out;
  for (const id of Object.keys(raw).filter(isGameId).sort().slice(0, MAX_CHOICES)) {
    const c = raw[id];
    if (!isObj(c) || !isGameId(c.o)) continue;
    const at = time(c.at);
    if (at > 0) out[id] = { o: c.o, at };
  }
  return out;
}

function parseGifts(raw: unknown): GiftState {
  if (!isObj(raw)) return emptyGifts();
  return { bought: parseIdDeviceCounts(raw.bought, MAX_GIFT_KINDS), given: parseIdDeviceCounts(raw.given, MAX_GIFT_KINDS) };
}

function parseTyped(raw: unknown): Record<string, TypedBucket> {
  const out: Record<string, TypedBucket> = {};
  if (!isObj(raw)) return out;
  for (const dev of Object.keys(raw).filter(isDevice).sort().slice(0, MAX_DEVICES)) {
    const b = raw[dev];
    if (!isObj(b)) continue;
    const n = clampInt(b.n, MAX_COUNT);
    // a check typed right is a check answered
    const ok = Math.min(n, clampInt(b.ok, MAX_COUNT));
    if (n > 0) out[dev] = { n, ok };
  }
  return out;
}

/**
 * Defensive parse of whatever storage, a backup or the synced folder holds: junk reads as "nothing understood,
 * nothing earned", never as a crash. Keys come out sorted (equal content gives equal JSON). Any version is read:
 * a version 1 value simply has no earned / bought / daily / days, a version 2 value no episodes, a version 3 value
 * none of the game loops, a version 4 value no friendship (nothing chosen, known, bought or given), a version 5 value
 * no typed checks.
 */
export function parseTownProgress(raw: unknown): TownProgress {
  const out = emptyTownProgress();
  if (!isObj(raw)) return out;
  const version = raw.version;
  const newer = typeof version === 'number' && Number.isInteger(version) && version > TOWN_VERSION && version <= MAX_VERSION;
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
  out.episodes = parseEpisodes(raw.episodes);
  out.fish = parseFish(raw.fish);
  out.farmDays = newest(idSet(raw.farmDays, isDay, Number.MAX_SAFE_INTEGER), DAYS_KEEP);
  out.eggs = parseEggs(raw.eggs);
  out.owned = parseTimes(raw.owned, MAX_OWNED);
  out.look = parseLook(raw.look);
  out.unlocks = parseTimes(raw.unlocks, MAX_UNLOCKS);
  out.friends = parseFriends(raw.friends);
  out.facts = parseFacts(raw.facts);
  out.choices = parseChoices(raw.choices);
  out.gifts = parseGifts(raw.gifts);
  out.typed = parseTyped(raw.typed);
  const fines = parseEarned(raw.fines);
  if (Object.keys(fines).length > 0) out.fines = fines;
  if (!newer) return out;
  out.version = version;
  return withExtras(out, parseExtras(raw));
}

// ───────────────────────── fields of a newer build ─────────────────────────

/** The fields this build knows: anything else at the top level of a newer build's value is carried as it is. */
const KNOWN_FIELDS = new Set<string>([...Object.keys(emptyTownProgress()), 'fines']);

/** The unknown top-level fields of a value written by a newer build (kept so this build never drops them). */
function parseExtras(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const keys = Object.keys(raw)
    .filter((k) => !KNOWN_FIELDS.has(k) && EXTRA_KEY_RE.test(k) && safeKey(k))
    .sort();
  for (const k of keys) {
    if (Object.keys(out).length >= MAX_EXTRA_KEYS) break;
    const v = raw[k];
    let text: string | undefined;
    try {
      text = JSON.stringify(v);
    } catch {
      text = undefined;
    }
    if (typeof text === 'string' && text.length <= MAX_EXTRA_CHARS) out[k] = v;
  }
  return out;
}

/** The unknown fields a value of a newer build carries (none for a value of this build's version). */
export function townExtras(progress: TownProgress): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!(progress.version > TOWN_VERSION)) return out;
  const all = progress as unknown as Record<string, unknown>;
  for (const k of Object.keys(all)) if (!KNOWN_FIELDS.has(k)) out[k] = all[k];
  return out;
}

function withExtras(progress: TownProgress, extras: Record<string, unknown>): TownProgress {
  return Object.keys(extras).length === 0 ? progress : ({ ...progress, ...extras } as TownProgress);
}

/**
 * Unknown fields of two copies: a union of the keys (the first MAX_EXTRA_KEYS, sorted); a field both carry keeps the
 * value with the larger JSON text. This build does not know what they mean, so it only relays one of them whole: the
 * newer build merges them properly once it reads its own copy again. Commutative, idempotent, associative.
 */
function mergeExtras(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().slice(0, MAX_EXTRA_KEYS)) {
    const inA = Object.prototype.hasOwnProperty.call(a, k);
    const inB = Object.prototype.hasOwnProperty.call(b, k);
    if (inA && inB) out[k] = JSON.stringify(a[k]) >= JSON.stringify(b[k]) ? a[k] : b[k];
    else out[k] = inA ? a[k] : b[k];
  }
  return out;
}

// ───────────────────────── merge ─────────────────────────

function mergeDailyCount(a: DailyCount | undefined, b: DailyCount | undefined): DailyCount {
  const x = a ?? emptyDailyCount();
  const y = b ?? emptyDailyCount();
  const out: DailyCount = {
    talks: Math.max(x.talks, y.talks),
    lines: Math.max(x.lines, y.lines),
    first: Math.max(x.first, y.first),
    met: union(x.met, y.met, MAX_SET),
    paid: union(x.paid, y.paid, MAX_SET),
  };
  for (const k of DAILY_EXTRA) {
    const n = Math.max(x[k] ?? 0, y[k] ?? 0);
    if (n > 0) out[k] = n;
  }
  const tasks = mergeDayTasks(x.tasks, y.tasks);
  if (tasks) out.tasks = tasks;
  for (const k of DAILY_SETS) {
    const set = union(x[k] ?? [], y[k] ?? [], MAX_SET);
    if (set.length > 0) out[k] = set;
  }
  return out;
}

/**
 * The day's fixed tasks of one browser in two copies: a copy without them takes the other's; two different lists (the
 * same browser fixed them twice, e.g. a copy put back from before) keep the one whose ids come first, so every machine
 * picks the same. Commutative, idempotent, associative (a minimum, with "none" as the identity).
 */
function mergeDayTasks(a: readonly string[] | undefined, b: readonly string[] | undefined): string[] | undefined {
  if (!a?.length) return b?.length ? [...b] : undefined;
  if (!b?.length) return [...a];
  return a.join(',') <= b.join(',') ? [...a] : [...b];
}

function mergeEpisode(x: EpisodeProgress, y: EpisodeProgress): EpisodeProgress {
  return {
    stage: Math.max(x.stage, y.stage),
    at: Math.max(x.at, y.at),
    okAt: Math.max(x.okAt, y.okAt),
    firstGist: Math.max(x.firstGist, y.firstGist) as GistMark,
    bestLines: Math.max(x.bestLines, y.bestLines),
  };
}

/** The smaller of two values where 0 means "none". */
const minSet = (a: number, b: number): number => (a > 0 && b > 0 ? Math.min(a, b) : Math.max(a, b));

function mergeFish(x: FishRecord, y: FishRecord): FishRecord {
  return {
    seen: Math.max(x.seen, y.seen),
    caught: Math.max(x.caught, y.caught),
    firstAt: minSet(x.firstAt, y.firstAt),
    bestMs: minSet(x.bestMs, y.bestMs),
    at: Math.max(x.at, y.at),
  };
}

function mergeDeviceCounts(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const dev of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().slice(0, MAX_DEVICES)) {
    out[dev] = Math.max(own(a, dev) ?? 0, own(b, dev) ?? 0);
  }
  return out;
}

function mergeTimes(a: Record<string, number>, b: Record<string, number>, max: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().slice(0, max)) out[id] = minSet(own(a, id) ?? 0, own(b, id) ?? 0);
  return out;
}

function mergeIdDeviceCounts(a: Record<string, Record<string, number>>, b: Record<string, Record<string, number>>, max: number): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const id of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().slice(0, max)) out[id] = mergeDeviceCounts(own(a, id) ?? {}, own(b, id) ?? {});
  return out;
}

function mergeFriends(a: Record<string, FriendBucket>, b: Record<string, FriendBucket>): Record<string, FriendBucket> {
  const out: Record<string, FriendBucket> = {};
  for (const id of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().slice(0, MAX_FRIENDS)) {
    const x = own(a, id) ?? { up: {}, down: {} };
    const y = own(b, id) ?? { up: {}, down: {} };
    out[id] = { up: mergeDeviceCounts(x.up, y.up), down: mergeDeviceCounts(x.down, y.down) };
  }
  return out;
}

/** The earlier choice wins; at the same time the smaller option id (every machine keeps the same). */
function earlierChoice(x: ChoiceRecord, y: ChoiceRecord): ChoiceRecord {
  if (x.at !== y.at) return { ...(x.at < y.at ? x : y) };
  return { ...(x.o <= y.o ? x : y) };
}

function mergeChoices(a: Record<string, ChoiceRecord>, b: Record<string, ChoiceRecord>): Record<string, ChoiceRecord> {
  const out: Record<string, ChoiceRecord> = {};
  for (const id of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().slice(0, MAX_CHOICES)) {
    const x = own(a, id);
    const y = own(b, id);
    out[id] = x && y ? earlierChoice(x, y) : { ...(x ?? y)! };
  }
  return out;
}

/** Max per browser and field (each browser only adds to its own bucket). */
function mergeTyped(a: Record<string, TypedBucket>, b: Record<string, TypedBucket>): Record<string, TypedBucket> {
  const out: Record<string, TypedBucket> = {};
  for (const dev of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().slice(0, MAX_DEVICES)) {
    const x = own(a, dev) ?? { n: 0, ok: 0 };
    const y = own(b, dev) ?? { n: 0, ok: 0 };
    out[dev] = { n: Math.max(x.n, y.n), ok: Math.max(x.ok, y.ok) };
  }
  return out;
}

/** A canonical string of a look (the tie-break of two looks changed at the same time). */
const lookKey = (l: TownLook): string => LOOK_SLOTS.map((s) => l[s] ?? '').join('|');

/** The look changed last wins; at the same time, the larger canonical string (every machine picks the same one). */
export function mergeLook(a: TownLook, b: TownLook): TownLook {
  if (a.at !== b.at) return { ...(a.at > b.at ? a : b) };
  return { ...(lookKey(a) >= lookKey(b) ? a : b) };
}

/**
 * Sync merge of two copies (both already parsed): union of lines with the max of each field, max per device of the
 * xu earned, union of what was bought, max / union per day and device of the daily counters, union of the days,
 * union of the episodes with the max of each field; version 4: union of the fish (max of the counts and of the last
 * catch, min of the first catch and of the best time), union of the farm days, union of the egg grants and max per
 * device of the egg counters, union of the owned items and of the unlocks (min of the first time), the later look;
 * version 5: max per resident, side and device of the friendship points, union of the facts (min of the first time),
 * the earlier choice per choice line, max per gift and device of the gifts bought and given; version 6: max per device
 * and field of the typed checks.
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
  for (const id of [...new Set([...Object.keys(a.episodes), ...Object.keys(b.episodes)])].sort().slice(0, MAX_EPISODES)) {
    const x = own(a.episodes, id);
    const y = own(b.episodes, id);
    out.episodes[id] = x && y ? mergeEpisode(x, y) : { ...(x ?? y)! };
  }
  for (const id of [...new Set([...Object.keys(a.fish), ...Object.keys(b.fish)])].sort().slice(0, MAX_FISH)) {
    const x = own(a.fish, id);
    const y = own(b.fish, id);
    out.fish[id] = x && y ? mergeFish(x, y) : { ...(x ?? y)! };
  }
  out.farmDays = newest([...a.farmDays, ...b.farmDays], DAYS_KEEP);
  out.eggs = {
    grants: union(a.eggs.grants, b.eggs.grants, MAX_GRANTS),
    bought: mergeDeviceCounts(a.eggs.bought, b.eggs.bought),
    hatched: mergeDeviceCounts(a.eggs.hatched, b.eggs.hatched),
    rare: mergeDeviceCounts(a.eggs.rare, b.eggs.rare),
  };
  out.owned = mergeTimes(a.owned, b.owned, MAX_OWNED);
  out.look = mergeLook(a.look, b.look);
  out.unlocks = mergeTimes(a.unlocks, b.unlocks, MAX_UNLOCKS);
  out.friends = mergeFriends(a.friends, b.friends);
  out.facts = mergeTimes(a.facts, b.facts, MAX_FACTS);
  out.choices = mergeChoices(a.choices, b.choices);
  out.gifts = { bought: mergeIdDeviceCounts(a.gifts.bought, b.gifts.bought, MAX_GIFT_KINDS), given: mergeIdDeviceCounts(a.gifts.given, b.gifts.given, MAX_GIFT_KINDS) };
  out.typed = mergeTyped(a.typed, b.typed);
  const fines: Record<string, number> = {};
  for (const dev of [...new Set([...Object.keys(a.fines ?? {}), ...Object.keys(b.fines ?? {})])].sort().slice(0, MAX_DEVICES)) {
    fines[dev] = Math.max(own(a.fines ?? {}, dev) ?? 0, own(b.fines ?? {}, dev) ?? 0);
  }
  if (Object.keys(fines).length > 0) out.fines = fines;
  out.version = Math.max(TOWN_VERSION, a.version, b.version);
  return withExtras(out, mergeExtras(townExtras(a), townExtras(b)));
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

/** Fines paid on all browsers together. */
export function finesTotal(progress: TownProgress): number {
  let sum = 0;
  for (const dev of Object.keys(progress.fines ?? {})) sum += own(progress.fines ?? {}, dev) ?? 0;
  return sum;
}

/** A fine paid on `device` (the input is not changed). */
export function addFine(progress: TownProgress, device: string, xu: number): TownProgress {
  const add = count(xu);
  if (add === 0 || !isDevice(device)) return progress;
  const fines = progress.fines ?? {};
  return { ...progress, fines: { ...fines, [device]: Math.min(MAX_XU, (own(fines, device) ?? 0) + add) } };
}

/** One more typed check in the bucket of `device` (the input is not changed): `ok` when typed right at the first check. */
export function addTyped(progress: TownProgress, device: string, ok: boolean): TownProgress {
  if (!isDevice(device)) return progress;
  const prev = own(progress.typed, device) ?? { n: 0, ok: 0 };
  const n = Math.min(MAX_COUNT, prev.n + 1);
  return { ...progress, typed: { ...progress.typed, [device]: { n, ok: Math.min(n, prev.ok + (ok ? 1 : 0)) } } };
}

/** Typed checks on all browsers together: answered, and typed right at the first check. */
export function typedTotals(progress: TownProgress): TypedBucket {
  let n = 0;
  let ok = 0;
  for (const dev of Object.keys(progress.typed)) {
    const b = own(progress.typed, dev);
    if (!b) continue;
    n += b.n;
    ok += b.ok;
  }
  return { n, ok };
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

/** The sum over every browser of one counter of `day` (the daily caps of the game loops are for the whole town). */
export function dailySum(progress: TownProgress, day: string, key: 'talks' | 'lines' | 'first' | DailyExtra): number {
  const bucket = own(progress.daily, day);
  if (!bucket) return 0;
  let sum = 0;
  for (const dev of Object.keys(bucket)) sum += own(bucket, dev)?.[key] ?? 0;
  return sum;
}

/**
 * The progress with the counters of (`day`, `device`) replaced by `change(current)`, `day` noted as an active day,
 * and only the DAILY_KEEP_DAYS days up to `day` kept (plus the day after it: another machine's time zone). Counters
 * never go down and sets never lose a member, whatever `change` returns. A bad day or device changes nothing.
 * `active: false` leaves `days` alone (fishing and the farm do not keep the town streak: only a town line does).
 */
export function updateDaily(progress: TownProgress, day: string, device: string, change: (c: DailyCount) => DailyCount, active = true): TownProgress {
  if (!isDay(day) || !isDevice(device)) return progress;
  const next = mergeDailyCount(dailyCount(progress, day, device), parseDailyCount(change(dailyCount(progress, day, device))) ?? undefined);
  const bucket = { ...own(progress.daily, day) };
  // a day with nothing to count yet (a first answer that was wrong) is an active day, not a stored row of zeros
  if (hasCounts(next)) bucket[device] = next;
  const daily: TownProgress['daily'] = {};
  const from = daysBefore(day, DAILY_KEEP_DAYS - 1);
  const until = daysBefore(day, -1);
  for (const d of [...new Set([...Object.keys(progress.daily), day])].sort()) {
    if (d === day) {
      if (Object.keys(bucket).length > 0) daily[d] = bucket;
    } else if (d >= from && d <= until) daily[d] = progress.daily[d];
  }
  return { ...progress, daily, days: active ? newest([...progress.days, day], DAYS_KEEP) : progress.days };
}

/** The local day `n` days before `day` ('YYYY-MM-DD'); noon keeps it safe across daylight-saving changes. */
export function daysBefore(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return townDay(new Date(y, m - 1, d - n, 12).getTime());
}

// ───────────────────────── episodes (plain updates: the rules are in ./episodes) ─────────────────────────

const NO_EPISODE: EpisodeProgress = { stage: 0, at: 0, okAt: 0, firstGist: 0, bestLines: 0 };

/** The stored record of an episode, if it was ever begun. */
export function episodeProgress(progress: TownProgress, id: string): EpisodeProgress | undefined {
  return own(progress.episodes, id);
}

/** A storable episode id: lower case letters, digits and hyphens ('cafe-1'). */
export function isEpisodeId(id: unknown): id is string {
  return typeof id === 'string' && isItemId(id) && safeKey(id);
}

/**
 * The progress with the record of episode `id` replaced by `change(current)`, kept monotone: no field ever goes
 * down, whatever `change` returns (a write can never undo what the merge would bring back). A bad id, or a change
 * that changes nothing, returns the same progress.
 */
export function updateEpisode(progress: TownProgress, id: string, change: (e: EpisodeProgress) => EpisodeProgress): TownProgress {
  if (!isEpisodeId(id)) return progress;
  const stored = episodeProgress(progress, id);
  const prev = stored ?? NO_EPISODE;
  const next = parseEpisode(mergeEpisode(prev, change({ ...prev })));
  if (!next) return progress;
  if (stored && next.stage === prev.stage && next.at === prev.at && next.okAt === prev.okAt && next.firstGist === prev.firstGist && next.bestLines === prev.bestLines) {
    return progress;
  }
  return { ...progress, episodes: { ...progress.episodes, [id]: next } };
}

// ───────────────────────── the game loops (plain updates: the rules are in ./fishing ./farm ./eggs ./wardrobe ./unlocks) ─────

/** The stored record of a fish species, if it was ever hooked. */
export function fishRecord(progress: TownProgress, id: string): FishRecord | undefined {
  return own(progress.fish, id);
}

/**
 * The progress with species `id` hooked once more at `now`: caught (with the answer time `ms`) or escaped. Monotone
 * like every field (the merge rules). A bad id changes nothing.
 */
export function noteFish(progress: TownProgress, id: string, caught: boolean, ms: number, now: number): TownProgress {
  if (!isGameId(id)) return progress;
  const prev = fishRecord(progress, id) ?? { seen: 0, caught: 0, firstAt: 0, bestMs: 0, at: 0 };
  const t = time(now);
  const answerMs = clampInt(Math.max(1, Math.round(finite(ms) ? ms : 0)), MAX_COUNT);
  const next: FishRecord = caught
    ? { seen: prev.seen + 1, caught: prev.caught + 1, firstAt: minSet(prev.firstAt, t), bestMs: minSet(prev.bestMs, answerMs), at: Math.max(prev.at, t) }
    : { ...prev, seen: prev.seen + 1 };
  return { ...progress, fish: { ...progress.fish, [id]: next } };
}

/** `day` added to the days the whole farm was harvested. */
export function addFarmDay(progress: TownProgress, day: string): TownProgress {
  if (!isDay(day) || progress.farmDays.includes(day)) return progress;
  return { ...progress, farmDays: newest([...progress.farmDays, day], DAYS_KEEP) };
}

/** Egg grants added (the bad and the known ones skipped). The same progress when nothing is new. */
export function addEggGrants(progress: TownProgress, ids: readonly string[]): TownProgress {
  const fresh = ids.filter((id) => isGrantId(id) && !progress.eggs.grants.includes(id));
  if (fresh.length === 0) return progress;
  return { ...progress, eggs: { ...progress.eggs, grants: union(progress.eggs.grants, fresh, MAX_GRANTS) } };
}

/** One per-device egg counter (`bought` / `hatched` / `rare`) set to at least `n`. */
export function raiseEggCount(progress: TownProgress, key: 'bought' | 'hatched' | 'rare', device: string, n: number): TownProgress {
  if (!isDevice(device)) return progress;
  const prev = own(progress.eggs[key], device) ?? 0;
  const next = clampInt(n, MAX_COUNT);
  if (next <= prev) return progress;
  return { ...progress, eggs: { ...progress.eggs, [key]: { ...progress.eggs[key], [device]: next } } };
}

/** The sum over every browser of a per-device egg counter. */
export function eggCountTotal(progress: TownProgress, key: 'bought' | 'hatched'): number {
  let sum = 0;
  for (const dev of Object.keys(progress.eggs[key])) sum += own(progress.eggs[key], dev) ?? 0;
  return sum;
}

/** One per-device egg counter of `device`. */
export function eggCount(progress: TownProgress, key: 'bought' | 'hatched' | 'rare', device: string): number {
  return own(progress.eggs[key], device) ?? 0;
}

export function ownsItem(progress: TownProgress, id: string): boolean {
  return own(progress.owned, id) !== undefined;
}

/** Item `id` owned from `now` on (an item owned already keeps its first time). */
export function addOwned(progress: TownProgress, id: string, now: number): TownProgress {
  if (!isGameId(id) || ownsItem(progress, id)) return progress;
  const owned: Record<string, number> = { ...progress.owned, [id]: time(now) || 1 };
  return { ...progress, owned: Object.fromEntries(Object.keys(owned).sort().map((k) => [k, owned[k]])) };
}

/** Achievements / projects reached at `now` recorded (the ones recorded already keep their first time). */
export function addUnlocks(progress: TownProgress, ids: readonly string[], now: number): TownProgress {
  const fresh = ids.filter((id) => isGameId(id) && own(progress.unlocks, id) === undefined);
  if (fresh.length === 0) return progress;
  const unlocks = { ...progress.unlocks };
  for (const id of fresh) unlocks[id] = time(now) || 1;
  return { ...progress, unlocks: Object.fromEntries(Object.keys(unlocks).sort().map((k) => [k, unlocks[k]])) };
}

export function isUnlocked(progress: TownProgress, id: string): boolean {
  return own(progress.unlocks, id) !== undefined;
}

/** The look replaced as a whole at `now` (its change time moves on, never back). */
export function setLook(progress: TownProgress, look: Omit<TownLook, 'at'>, now: number): TownProgress {
  const at = Math.max(time(now), progress.look.at + 1);
  const next: TownLook = { hat: null, outfit: null, pet: null, title: null, at };
  for (const slot of LOOK_SLOTS) {
    const v = look[slot];
    next[slot] = isGameId(v) ? v : null;
  }
  return { ...progress, look: next };
}

// ───────────────────────── friendship (plain updates: the rules are in ./friendship) ─────────────────────────

/** The points added with resident `placeId` on one side, on all browsers together. */
export function friendSide(progress: TownProgress, placeId: string, side: 'up' | 'down'): number {
  const b = own(progress.friends, placeId);
  if (!b) return 0;
  let sum = 0;
  for (const dev of Object.keys(b[side])) sum += own(b[side], dev) ?? 0;
  return sum;
}

/** `n` more points on one side of (`placeId`, `device`). Nothing for a bad id, device or amount. */
export function addFriendSide(progress: TownProgress, placeId: string, side: 'up' | 'down', device: string, n: number): TownProgress {
  const add = count(n);
  if (add === 0 || !isGameId(placeId) || !isDevice(device)) return progress;
  const prev = own(progress.friends, placeId) ?? { up: {}, down: {} };
  const next: FriendBucket = { up: { ...prev.up }, down: { ...prev.down } };
  next[side][device] = Math.min(MAX_FRIEND_POINTS, (own(prev[side], device) ?? 0) + add);
  const friends: Record<string, FriendBucket> = { ...progress.friends, [placeId]: next };
  return { ...progress, friends: Object.fromEntries(Object.keys(friends).sort().map((k) => [k, friends[k]])) };
}

export function knowsFact(progress: TownProgress, id: string): boolean {
  return own(progress.facts, id) !== undefined;
}

/** Facts known from `now` on (the bad and the known ones skipped). The same progress when nothing is new. */
export function addFacts(progress: TownProgress, ids: readonly string[], now: number): TownProgress {
  const fresh = [...new Set(ids)].filter((id) => isFactId(id) && !knowsFact(progress, id));
  if (fresh.length === 0) return progress;
  const facts = { ...progress.facts };
  for (const id of fresh) facts[id] = time(now) || 1;
  return { ...progress, facts: Object.fromEntries(Object.keys(facts).sort().map((k) => [k, facts[k]])) };
}

/** The option first chosen on choice line `lineId`, if any. */
export function choiceOf(progress: TownProgress, lineId: string): ChoiceRecord | undefined {
  return own(progress.choices, lineId);
}

/** Option `optionId` chosen on `lineId` at `now`, only when nothing was chosen there yet (the first choice stays). */
export function addChoice(progress: TownProgress, lineId: string, optionId: string, now: number): TownProgress {
  if (!isGameId(lineId) || !isGameId(optionId) || choiceOf(progress, lineId)) return progress;
  const choices: Record<string, ChoiceRecord> = { ...progress.choices, [lineId]: { o: optionId, at: time(now) || 1 } };
  return { ...progress, choices: Object.fromEntries(Object.keys(choices).sort().map((k) => [k, choices[k]])) };
}

/** Gifts of kind `giftId` bought / given on all browsers together. */
export function giftCount(progress: TownProgress, key: 'bought' | 'given', giftId: string): number {
  const per = own(progress.gifts[key], giftId);
  if (!per) return 0;
  let sum = 0;
  for (const dev of Object.keys(per)) sum += own(per, dev) ?? 0;
  return sum;
}

/** `n` more gifts of kind `giftId` bought / given by `device`. Nothing for a bad id, device or amount. */
export function addGiftCount(progress: TownProgress, key: 'bought' | 'given', giftId: string, device: string, n = 1): TownProgress {
  const add = count(n);
  if (add === 0 || !isGameId(giftId) || !isDevice(device)) return progress;
  const per: Record<string, number> = { ...(own(progress.gifts[key], giftId) ?? {}) };
  per[device] = Math.min(MAX_COUNT, (own(per, device) ?? 0) + add);
  const side: Record<string, Record<string, number>> = { ...progress.gifts[key], [giftId]: per };
  return { ...progress, gifts: { ...progress.gifts, [key]: Object.fromEntries(Object.keys(side).sort().map((k) => [k, side[k]])) } };
}

/** A row of `day` on any browser has `placeId` in its set `key` (the once-a-day friendship rules, ./friendship). */
export function dayHas(progress: TownProgress, day: string, key: DailySet | 'met', placeId: string): boolean {
  const bucket = own(progress.daily, day);
  if (!bucket) return false;
  return Object.keys(bucket).some((dev) => (own(bucket, dev)?.[key] ?? []).includes(placeId));
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
