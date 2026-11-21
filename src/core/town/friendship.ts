// "Thân thiết": the residents remember the learner and grow closer (docs/town.md §12). Pure: storage is in ./store,
// the stored fields in ./progress (version 5: friends, facts, choices, gifts), the content in data/stories (each
// resident's arc: episodes 3+, facts, gift taste, reactions, greetings) and data/townGifts.
//
// Friendship points with a resident, 0..FRIEND_MAX_POINTS (100 a heart, 10 hearts). Every point comes from LISTENING
// to them (or a gift chosen from what they said they like); nothing decays:
//
//   an episode heard through, the first time            +60  (derived from the episode's record)
//   … and its gist right on the very first listen       +30  (derived)
//   a re-listen with the gist right                     +10  (derived: one per stage after the finish)
//   a choice in an episode                              its `points` (−20…+30, derived from the choice first made)
//   a quick chat with at least 3 of 5 lines understood  +15, once per resident per day (stored per browser)
//   the first finished conversation of the day with them +5  (stored per browser)
//   a gift: loved +80, liked +40, neutral +10, disliked −20, one gift per resident per day (stored per browser)
//
// The derived part cannot be counted twice by two machines (the episode and choice records merge by max / first);
// the stored part is per browser and only grows (progress.friends up / down), so two machines that each paid the same
// day's chat before a sync both keep theirs (the same trade-off as xu, docs/town.md §12 Stored). A negative change
// never takes the score below 0 and a positive one never above the maximum where it is written.
//
// Hearts are a game score: how much the learner has listened to someone, never a measurement of hearing.

import { TOWN_PLACES, townPlace } from '../../data/town';
import { TOWN_GIFTS, townGift, type TownGift } from '../../data/townGifts';
import { RESIDENT_ARCS, residentArc } from '../../data/stories';
import { storiesOfPlace } from '../../data/townStories';
import { rawBalance } from './economy';
import {
  addChoice,
  addFacts,
  addFriendSide,
  addGiftCount,
  choiceOf,
  dayHas,
  episodeProgress,
  friendSide,
  giftCount,
  isDeviceId,
  knowsFact,
  townDay,
  updateDaily,
  type TownProgress,
} from './progress';
import type { FactId, ResidentArc, StoryChoice, StoryEpisode, StoryFact, StoryLine } from './story';

export const FRIEND_MAX_POINTS = 1000;
export const HEART_POINTS = 100;
export const MAX_HEARTS = FRIEND_MAX_POINTS / HEART_POINTS;

export const FRIEND_POINTS = {
  finish: 60,
  gistFirst: 30,
  relisten: 10,
  chat: 15,
  hello: 5,
} as const;

export type GiftTaste = 'loves' | 'likes' | 'neutral' | 'dislikes';
export const GIFT_POINTS: Readonly<Record<GiftTaste, number>> = { loves: 80, likes: 40, neutral: 10, dislikes: -20 };

/** Lines of a quick chat to understand for its friendship points. */
export const CHAT_BOND_LINES = 3;

// ───────────────────────── the score ─────────────────────────

/** Points from the episodes of a place: their finishes, first-listen gists and right re-listens. */
export function episodePoints(progress: TownProgress, placeId: string): number {
  let sum = 0;
  for (const episode of storiesOfPlace(placeId)) {
    const e = episodeProgress(progress, episode.id);
    if (!e || e.stage < 1) continue;
    sum += FRIEND_POINTS.finish + (e.firstGist === 2 ? FRIEND_POINTS.gistFirst : 0) + FRIEND_POINTS.relisten * Math.max(0, e.stage - 1);
  }
  return sum;
}

/** The option first chosen on a choice line, if any (and still in the content). */
export function chosenOption(progress: TownProgress, line: Pick<StoryLine, 'id' | 'choices'>): StoryChoice | null {
  const rec = choiceOf(progress, line.id);
  if (!rec || !line.choices) return null;
  return line.choices.find((c) => c.id === rec.o) ?? null;
}

/** Points from the choices made in the episodes of a place. */
export function choicePoints(progress: TownProgress, placeId: string): number {
  let sum = 0;
  for (const episode of storiesOfPlace(placeId)) {
    for (const line of episode.lines) {
      const opt = line.choices ? chosenOption(progress, line) : null;
      if (opt && Number.isFinite(opt.points)) sum += Math.round(opt.points ?? 0);
    }
  }
  return sum;
}

/** Friendship points with the resident of `placeId`, 0..FRIEND_MAX_POINTS. */
export function friendPoints(progress: TownProgress, placeId: string): number {
  const raw = episodePoints(progress, placeId) + choicePoints(progress, placeId) + friendSide(progress, placeId, 'up') - friendSide(progress, placeId, 'down');
  return Math.max(0, Math.min(FRIEND_MAX_POINTS, raw));
}

/** Full hearts for `points` (0..10). */
export function heartsOf(points: number): number {
  return Math.max(0, Math.min(MAX_HEARTS, Math.floor((Number.isFinite(points) ? points : 0) / HEART_POINTS)));
}

export function friendHearts(progress: TownProgress, placeId: string): number {
  return heartsOf(friendPoints(progress, placeId));
}

/** What a resident calls the learner at a number of hearts (a game title, not a measurement). */
export function friendTitle(hearts: number): string {
  if (hearts >= 10) return 'tri kỷ';
  if (hearts >= 7) return 'bạn thân';
  if (hearts >= 5) return 'bạn tốt';
  if (hearts >= 3) return 'bạn';
  if (hearts >= 1) return 'người quen';
  return 'người lạ';
}

export interface FriendView {
  placeId: string;
  points: number;
  hearts: number;
  /** Points to the next heart; null at the last one. */
  toNext: number | null;
  /** 0..1 of the way to the next heart (1 at the last one). */
  part: number;
  title: string;
}

export function friendView(progress: TownProgress, placeId: string): FriendView {
  const points = friendPoints(progress, placeId);
  const hearts = heartsOf(points);
  const max = hearts >= MAX_HEARTS;
  return { placeId, points, hearts, toNext: max ? null : (hearts + 1) * HEART_POINTS - points, part: max ? 1 : (points - hearts * HEART_POINTS) / HEART_POINTS, title: friendTitle(hearts) };
}

/** Hearts with every resident (the celebrations compare two of these). */
export function allHearts(progress: TownProgress): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of TOWN_PLACES) out[p.id] = friendHearts(progress, p.id);
  return out;
}

/** The words of a new heart: a new title says so ("Emma giờ coi bạn là bạn thân!"), else the count. */
export function heartCheer(placeId: string, before: number, after: number): { label: string; detail: string } {
  const name = townPlace(placeId)?.resident ?? '';
  const title = friendTitle(after);
  if (title !== friendTitle(before) && after > 0) return { label: `${name} giờ coi bạn là ${title}!`, detail: `Thân thiết: ${after}/${MAX_HEARTS} tim` };
  return { label: `Thân với ${name} hơn`, detail: `Thân thiết: ${after}/${MAX_HEARTS} tim` };
}

export interface FriendWrite {
  progress: TownProgress;
  /** The points this write really moved (after the 0 / maximum bounds). */
  points: number;
}

/**
 * `delta` friendship points with `placeId` added for `device`: a gain never above FRIEND_MAX_POINTS, a loss never
 * below 0 (only what is there is taken). Nothing for an unknown place or device.
 */
export function addFriendPoints(progress: TownProgress, placeId: string, delta: number, device: string): FriendWrite {
  const d = Number.isFinite(delta) ? Math.round(delta) : 0;
  if (d === 0 || !townPlace(placeId) || !isDeviceId(device)) return { progress, points: 0 };
  const cur = friendPoints(progress, placeId);
  if (d > 0) {
    const n = Math.min(d, FRIEND_MAX_POINTS - cur);
    return n > 0 ? { progress: addFriendSide(progress, placeId, 'up', device, n), points: n } : { progress, points: 0 };
  }
  const n = Math.min(-d, cur);
  return n > 0 ? { progress: addFriendSide(progress, placeId, 'down', device, n), points: -n } : { progress, points: 0 };
}

// ───────────────────────── conversations ─────────────────────────

/** A conversation with `placeId` was already finished today (on any browser): the +5 of the day is paid. */
export function metToday(progress: TownProgress, placeId: string, now: number): boolean {
  return dayHas(progress, townDay(now), 'met', placeId);
}

/**
 * A quick chat with `placeId` just ended with `understood` of its lines right. `firstToday`: no conversation with them
 * was finished today before this one (metToday, read BEFORE the conversation is noted). +15 once per resident per day
 * for CHAT_BOND_LINES lines understood, +5 for the first of the day.
 */
export function applyChatFriendship(progress: TownProgress, placeId: string, understood: number, firstToday: boolean, now: number, device: string): FriendWrite {
  if (!townPlace(placeId) || !isDeviceId(device)) return { progress, points: 0 };
  const day = townDay(now);
  let next = progress;
  let points = 0;
  if (understood >= CHAT_BOND_LINES && !dayHas(progress, day, 'bond', placeId)) {
    const w = addFriendPoints(next, placeId, FRIEND_POINTS.chat, device);
    next = updateDaily(w.progress, day, device, (c) => ({ ...c, bond: [...(c.bond ?? []), placeId] }), false);
    points += w.points;
  }
  if (firstToday) {
    const w = addFriendPoints(next, placeId, FRIEND_POINTS.hello, device);
    next = w.progress;
    points += w.points;
  }
  return { progress: next, points };
}

/** The first finished conversation of the day with `placeId` (an episode, a re-listen): +5. */
export function applyHello(progress: TownProgress, placeId: string, firstToday: boolean, device: string): FriendWrite {
  return firstToday ? addFriendPoints(progress, placeId, FRIEND_POINTS.hello, device) : { progress, points: 0 };
}

// ───────────────────────── facts ─────────────────────────

let factIndex: Map<string, { fact: StoryFact; placeId: string }> | null = null;

/** A fact and the resident whose arc lists it. */
export function storyFact(id: FactId): { fact: StoryFact; placeId: string } | undefined {
  if (!factIndex) {
    factIndex = new Map();
    for (const arc of RESIDENT_ARCS) for (const fact of arc.facts) if (!factIndex.has(fact.id)) factIndex.set(fact.id, { fact, placeId: arc.placeId });
  }
  return factIndex.get(id);
}

/** The facts an episode teaches when it is heard through (its `learn`). */
export function episodeFacts(episode: Pick<StoryEpisode, 'learn'>): FactId[] {
  return [...(episode.learn ?? [])];
}

/**
 * Facts the finished episodes teach, recorded (idempotent: a progress that has them all comes back as it is). Run on
 * every write (./store), so a finish on another machine, or one before this build, teaches them too.
 */
export function settleFacts(progress: TownProgress, now: number): TownProgress {
  const ids: FactId[] = [];
  for (const p of TOWN_PLACES) {
    for (const episode of storiesOfPlace(p.id)) {
      if ((episodeProgress(progress, episode.id)?.stage ?? 0) < 1) continue;
      for (const id of episode.learn ?? []) if (!knowsFact(progress, id)) ids.push(id);
    }
  }
  return ids.length > 0 ? addFacts(progress, ids, now) : progress;
}

// ───────────────────────── unlocking episodes ─────────────────────────

export interface EpisodeNeeds {
  /** Hearts the episode needs, when more than the learner has (null: enough). */
  hearts: number | null;
  /** Facts it needs that are not known yet. */
  facts: FactId[];
}

/** What an episode's `requires` still needs (both empty: met). */
export function episodeNeeds(progress: TownProgress, episode: Pick<StoryEpisode, 'placeId' | 'requires'>): EpisodeNeeds {
  const r = episode.requires;
  const need = r?.hearts ?? 0;
  return {
    hearts: need > 0 && friendHearts(progress, episode.placeId) < need ? need : null,
    facts: (r?.facts ?? []).filter((id) => !knowsFact(progress, id)),
  };
}

export function needsMet(n: EpisodeNeeds): boolean {
  return n.hearts === null && n.facts.length === 0;
}

// ───────────────────────── choices ─────────────────────────

export interface ChoiceWrite {
  progress: TownProgress;
  /** This pick is the first on that line: it counts (points, facts). */
  first: boolean;
  /** The option that stays chosen (the first one ever). */
  chosen: string;
  /** Points the pick brought (0 when it was not the first). */
  points: number;
  /** Facts newly known. */
  learned: FactId[];
}

/**
 * Option `optionId` picked on choice line `lineId` of `episode`. Only the first pick on a line counts: it is kept (with
 * its time), its facts are learned, and its points count (derived: ./friendship choicePoints). A later pick changes
 * nothing. null for an unknown line or option.
 */
export function recordChoice(progress: TownProgress, episode: StoryEpisode, lineId: string, optionId: string, now: number): ChoiceWrite | null {
  const line = episode.lines.find((l) => l.id === lineId);
  const opt = line?.choices?.find((c) => c.id === optionId);
  if (!line || !opt) return null;
  const prev = chosenOption(progress, line);
  if (prev) return { progress, first: false, chosen: prev.id, points: 0, learned: [] };
  const before = friendPoints(progress, episode.placeId);
  const picked = addChoice(progress, line.id, opt.id, now);
  if (picked === progress) return { progress, first: false, chosen: choiceOf(progress, line.id)?.o ?? opt.id, points: 0, learned: [] };
  const learned = (opt.learn ?? []).filter((id) => !knowsFact(picked, id));
  const next = addFacts(picked, learned, now);
  return { progress: next, first: true, chosen: opt.id, points: friendPoints(next, episode.placeId) - before, learned: learned.filter((id) => knowsFact(next, id)) };
}

// ───────────────────────── gifts ─────────────────────────

/** Gifts of a kind in hand: bought − given (never below 0). */
export function giftInHand(progress: TownProgress, giftId: string): number {
  return Math.max(0, giftCount(progress, 'bought', giftId) - giftCount(progress, 'given', giftId));
}

export interface GiftHeld {
  gift: TownGift;
  n: number;
}

/** Every gift in hand, in the shop's order. */
export function giftsInHand(progress: TownProgress): GiftHeld[] {
  return TOWN_GIFTS.map((gift) => ({ gift, n: giftInHand(progress, gift.id) })).filter((g) => g.n > 0);
}

/** What the resident of `placeId` thinks of a gift (anything their arc does not list: 'neutral'). */
export function tasteOf(placeId: string, giftId: string, arc: ResidentArc | undefined = residentArc(placeId)): GiftTaste {
  if (!arc) return 'neutral';
  if (arc.taste.loves.includes(giftId)) return 'loves';
  if (arc.taste.likes.includes(giftId)) return 'likes';
  if (arc.taste.dislikes.includes(giftId)) return 'dislikes';
  return 'neutral';
}

/** A gift was already given to `placeId` today (on any browser): one a day. */
export function giftedToday(progress: TownProgress, placeId: string, now: number): boolean {
  return dayHas(progress, townDay(now), 'gifted', placeId);
}

export type GiftRefusal = 'unknown' | 'none' | 'today' | 'device';

export type GiveResult =
  | {
      ok: true;
      progress: TownProgress;
      taste: GiftTaste;
      /** The points it really moved. */
      points: number;
      /** The resident's voiced reaction (null while the content has none). */
      reaction: StoryLine | null;
    }
  | { ok: false; reason: GiftRefusal };

/** Give `giftId` to the resident of `placeId`: one less in hand, their reaction, the points; once per resident a day. */
export function giveGift(progress: TownProgress, placeId: string, giftId: string, now: number, device: string): GiveResult {
  if (!townPlace(placeId) || !townGift(giftId)) return { ok: false, reason: 'unknown' };
  if (!isDeviceId(device)) return { ok: false, reason: 'device' };
  if (giftInHand(progress, giftId) <= 0) return { ok: false, reason: 'none' };
  if (giftedToday(progress, placeId, now)) return { ok: false, reason: 'today' };
  const arc = residentArc(placeId);
  const taste = tasteOf(placeId, giftId, arc);
  const day = townDay(now);
  const given = updateDaily(addGiftCount(progress, 'given', giftId, device), day, device, (c) => ({ ...c, gifted: [...(c.gifted ?? []), placeId] }), false);
  const w = addFriendPoints(given, placeId, GIFT_POINTS[taste], device);
  const line = arc?.reactions[taste];
  return { ok: true, progress: w.progress, taste, points: w.points, reaction: line && line.text.trim() ? line : null };
}

export type GiftBuyResult = { ok: true; progress: TownProgress } | { ok: false; reason: 'unknown' | 'poor' | 'device'; missing: number };

/** Buy one `giftId` with xu (./economy spentTotal counts it). */
export function buyGift(progress: TownProgress, giftId: string, device: string): GiftBuyResult {
  const gift = townGift(giftId);
  if (!gift) return { ok: false, reason: 'unknown', missing: 0 };
  if (!isDeviceId(device)) return { ok: false, reason: 'device', missing: 0 };
  const missing = gift.cost - rawBalance(progress);
  if (missing > 0) return { ok: false, reason: 'poor', missing };
  return { ok: true, progress: addGiftCount(progress, 'bought', giftId, device) };
}

// ───────────────────────── greetings ─────────────────────────

export type Greeting = ResidentArc['greetings'][number];

/** A memory greeting (one with `if`) is said only this long after its fact was learned… */
export const MEMORY_GREETING_DAYS = 7;
/** …and at most this many times on this browser: then the resident moves on ("I fixed the soup!" is news once). */
export const MEMORY_GREETING_PLAYS = 2;

export interface GreetingContext {
  now: number;
  /** When a fact was learned (epoch ms), 0 = not known. */
  learnedAt: (fact: FactId) => number;
  /** How often this browser has said a greeting already. */
  plays: (greetingId: string) => number;
}

/**
 * The greeting a resident says when the learner walks up. A memory callback (`if` a fact) while it is news (its fact
 * learned within MEMORY_GREETING_DAYS, said fewer than MEMORY_GREETING_PLAYS times) comes first; otherwise the plain
 * ones of the highest tier the hearts allow (tier ≤ hearts). Never `lastId` again while another fits; `seed` turns
 * among equals. null when none fits (or the content has none yet).
 */
export function pickGreeting(placeId: string, hearts: number, ctx: GreetingContext, lastId: string | null, seed = 0, arc: ResidentArc | undefined = residentArc(placeId)): Greeting | null {
  if (!arc) return null;
  const news = (g: Greeting): boolean => {
    if (!g.if) return false;
    const at = ctx.learnedAt(g.if);
    return at > 0 && ctx.now - at <= MEMORY_GREETING_DAYS * 24 * 3600_000 && ctx.plays(g.id) < MEMORY_GREETING_PLAYS;
  };
  const fits = (g: Greeting) => g.text.trim().length > 0 && g.tier <= hearts && (!g.if || news(g));
  let list = arc.greetings.filter(fits);
  if (list.length > 1 && lastId) list = list.filter((g) => g.id !== lastId);
  if (list.length === 0) return null;
  const callbacks = list.filter((g) => g.if);
  let pool = callbacks.length > 0 ? callbacks : list;
  const top = Math.max(...pool.map((g) => g.tier));
  pool = pool.filter((g) => g.tier === top);
  const s = Number.isFinite(seed) ? Math.floor(Math.abs(seed)) : 0;
  return pool[s % pool.length];
}
