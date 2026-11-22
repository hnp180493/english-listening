// One conversation at a place in "Thị trấn": which lines are said, the three meanings offered, how an answer
// counts. Pure and deterministic (a seeded generator, never Math.random), so tests are stable.

import { addListen, heardOnce, tallyKindFor, totalListens, type ListenTally } from '../dictation/listens';
import { placeLines } from '../../data/town';
import { isPerfect } from './economy';
import { lineProgress, type TownProgress } from './progress';
import { soundAlikesOf } from './soundAlike';
import { VISIT_SIZE, type LineOutcome, type SoundAlikeKind, type TownLine } from './types';

export { VISIT_SIZE };
/** Meanings offered per line: the right one and two others. */
export const CHOICE_COUNT = 3;

// ───────────────────────── which lines ─────────────────────────

/**
 * The lines of a visit, most useful first: lines never understood (easiest first, then by id), then lines
 * understood only with replays (oldest first), then lines understood on the first listen (oldest first).
 */
export function pickVisitLines(lines: readonly TownLine[], progress: TownProgress, size: number = VISIT_SIZE): TownLine[] {
  const byId = (a: TownLine, b: TownLine) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const info = (l: TownLine) => {
    const p = lineProgress(progress, l.id);
    return { best: p?.best ?? 0, at: p?.at ?? 0 };
  };
  const sorted = [...lines].sort((a, b) => {
    const x = info(a);
    const y = info(b);
    if (x.best !== y.best) return x.best - y.best;
    if (x.best === 0) return a.level - b.level || byId(a, b);
    return x.at - y.at || a.level - b.level || byId(a, b);
  });
  return sorted.slice(0, Math.max(0, Math.floor(size)));
}

/**
 * Every resident can be talked to from the first day, their place built or not (one whose place is not built yet
 * lodges at the boarding house: docs/town.md §7 "Life"); a conversation only needs a place with something to say.
 * `progress` stays in the signature: what can be said may depend on it again (episodes do: ./episodes needsHome).
 */
export function canTalk(_progress: TownProgress, placeId: string): boolean {
  return placeLines(placeId).length > 0;
}

/** The lines of the next conversation at `placeId` (pickVisitLines over its lines). An unknown place says nothing. */
export function conversationLines(progress: TownProgress, placeId: string, size: number = VISIT_SIZE): TownLine[] {
  return canTalk(progress, placeId) ? pickVisitLines(placeLines(placeId), progress, size) : [];
}

// ───────────────────────── the three meanings ─────────────────────────

/** FNV-1a (32 bit): a stable number for a line id. */
function hashText(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a small seeded generator of numbers in [0, 1). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(list: readonly T[], rand: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Two meanings that read the same are one choice (case, spacing and punctuation aside). */
const meaningKey = (vi: string): string =>
  vi
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\s.!?…,;:"'“”‘’()\-–—]+/g, ' ')
    .trim();

/** Words that close a Vietnamese sentence without changing what it says ("Cảm ơn nhé" = "Cảm ơn"). */
const END_PARTICLES = new Set(['nhé', 'nha', 'nhá', 'ạ', 'à', 'nhỉ', 'hả', 'nè', 'đấy', 'vậy', 'thế', 'chứ', 'mà', 'cơ', 'ha']);
/** One of these more or less turns the meaning around: such a pair is a fair (and hard) choice, not a duplicate. */
const NEGATIONS = new Set(['không', 'chưa', 'chẳng', 'chả', 'đừng']);

interface Meaning {
  key: string;
  /** Words without the closing particles. */
  words: string[];
  set: Set<string>;
  question: boolean;
}

function meaningOf(vi: string): Meaning {
  const key = meaningKey(vi);
  const words = key ? key.split(' ') : [];
  while (words.length > 1 && END_PARTICLES.has(words[words.length - 1])) words.pop();
  return { key, words, set: new Set(words), question: vi.includes('?') };
}

/**
 * Two meanings a learner could not fairly tell apart: the same words (closing particles aside), or one is the other
 * plus a single word that is not a negation ("Bạn khỏe không?" / "Bạn có khỏe không?").
 */
function nearSame(a: Meaning, b: Meaning): boolean {
  if (!a.key || !b.key) return true;
  if (a.key === b.key || a.words.join(' ') === b.words.join(' ')) return true;
  const [short, long] = a.words.length <= b.words.length ? [a.words, b.words] : [b.words, a.words];
  if (short.length < 2 || long.length !== short.length + 1) return false;
  // `short` must be `long` with exactly one word taken out, in the same order
  let skipped = -1;
  for (let i = 0, j = 0; j < long.length; j++) {
    if (i < short.length && short[i] === long[j]) i += 1;
    else if (skipped < 0) skipped = j;
    else return false;
  }
  return skipped >= 0 && !NEGATIONS.has(long[skipped]);
}

/**
 * 0..1: how easily `b` is taken for `a` by someone who caught only part of the sentence: shared words weigh most,
 * then the same kind of sentence (a question for a question), then a similar length.
 */
export function confusability(aVi: string, bVi: string): number {
  return score(meaningOf(aVi), meaningOf(bVi));
}

function score(a: Meaning, b: Meaning): number {
  let shared = 0;
  for (const w of a.set) if (b.set.has(w)) shared += 1;
  const all = a.set.size + b.set.size - shared;
  const words = all > 0 ? shared / all : 0;
  const longer = Math.max(a.key.length, b.key.length);
  const length = longer > 0 ? Math.min(a.key.length, b.key.length) / longer : 0;
  return 0.55 * words + 0.25 * (a.question === b.question ? 1 : 0) + 0.2 * length;
}

/** The wrong meanings are drawn from this many most confusable candidates (of the nearest level). */
export const DISTRACTOR_WINDOW = 4;

export interface LineChoices {
  /** Vietnamese meanings, in the order to show them. */
  options: string[];
  /** Index of the right one in `options`. */
  answer: number;
  /**
   * Per option: the kind of sound-alike it is of THIS line (./soundAlike, docs/town.md §13), null for any other
   * option. Absent when no option is one.
   */
  alike?: (SoundAlikeKind | null)[];
}

interface Candidate {
  vi: string;
  id: string;
  meaning: Meaning;
  score: number;
  level: number;
}

/**
 * Up to `count` wrong meanings from the other lines of `pool`, the old way (docs/town.md §2 "The three meanings"):
 * lines of the same level first (then the nearest level), and among those drawn with `rand` from the
 * DISTRACTOR_WINDOW most confusable ones; never one nearly the same as the right one, as another pick or as a meaning
 * in `avoid`.
 */
function topicPicks(line: TownLine, pool: readonly TownLine[], right: Meaning, rand: () => number, count: number, avoid: readonly Meaning[] = []): { vi: string; meaning: Meaning }[] {
  const tiers = new Map<number, Candidate[]>();
  const seen = new Set<string>([right.key, ...avoid.map((m) => m.key)]);
  for (const l of pool) {
    if (l.id === line.id) continue;
    const meaning = meaningOf(l.vi);
    if (seen.has(meaning.key) || nearSame(right, meaning) || avoid.some((m) => nearSame(m, meaning))) continue;
    seen.add(meaning.key);
    const distance = Math.abs(l.level - line.level);
    const tier = tiers.get(distance);
    const cand = { vi: l.vi, id: l.id, meaning, score: score(right, meaning), level: l.level };
    if (tier) tier.push(cand);
    else tiers.set(distance, [cand]);
  }

  const picked: { vi: string; meaning: Meaning }[] = [];
  const take = (cand: { vi: string; meaning: Meaning }): void => {
    if (picked.length < count && !picked.some((p) => nearSame(p.meaning, cand.meaning))) picked.push(cand);
  };
  for (const distance of [...tiers.keys()].sort((a, b) => a - b)) {
    if (picked.length >= count) break;
    const ranked = tiers.get(distance)!.sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    // the seed chooses among the most confusable ones; the rest of the tier only fills up what they could not
    for (const cand of shuffled(ranked.slice(0, DISTRACTOR_WINDOW), rand)) take(cand);
    for (const cand of ranked.slice(DISTRACTOR_WINDOW)) take(cand);
  }
  return picked;
}

/**
 * A pair from ANOTHER line of `pool`: that line's meaning and the meaning of its own sound-alike. Offered next to the
 * right meaning and the right line's own sound-alike, it makes two look-alike pairs out of four options, so spotting
 * "the two that look alike" says nothing about which one was said (docs/town.md §13 "Why four"). Lines of the nearest
 * level; among those the most confusable, drawn with `rand`. null when no line of the pool has a fair pair.
 */
function decoyPair(line: TownLine, pool: readonly TownLine[], right: Meaning, twin: Meaning, rand: () => number, skip?: ReadonlySet<string>): [string, string] | null {
  const taken = [right, twin];
  const fair = (m: Meaning, also: readonly Meaning[]): boolean => !!m.key && ![...taken, ...also].some((x) => x.key === m.key || nearSame(x, m));
  const found: (Candidate & { pairVi: string })[] = [];
  for (const l of pool) {
    if (l.id === line.id || skip?.has(l.id)) continue;
    const meaning = meaningOf(l.vi);
    if (!fair(meaning, [])) continue;
    for (const a of soundAlikesOf(l)) {
      const other = meaningOf(a.vi);
      if (!fair(other, [meaning])) continue;
      found.push({ vi: l.vi, id: l.id, meaning, score: score(right, meaning), level: l.level, pairVi: a.vi });
      break;
    }
  }
  if (found.length === 0) return null;
  const nearest = Math.min(...found.map((c) => Math.abs(c.level - line.level)));
  const ranked = found
    .filter((c) => Math.abs(c.level - line.level) === nearest)
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const pick = shuffled(ranked.slice(0, DISTRACTOR_WINDOW), rand)[0];
  return [pick.vi, pick.pairVi];
}

/**
 * The meanings offered for `line`: its own and others. Deterministic for (line, pool, seed). The right meaning is at a
 * different position for seed n and n + 1: pass the tries so far (choiceSeed), so a line asked again never shows the
 * answer where it was. A pool too small gives fewer options; the right one is always there.
 *
 * Sound-alikes first (./soundAlike, docs/town.md §13): when the line has one, a wrong option is the meaning of what a
 * careless ear would hear instead ("I can do it" next to "I can't do it"), so only listening tells them apart:
 * - two or more of its own: the right meaning and two of them (three look-alikes);
 * - one: the right meaning, its sound-alike, and a look-alike pair of another line of the pool (decoyPair): four
 *   options in two pairs; when no other line has a pair, one wrong meaning the old way (three options).
 * No sound-alike: the old way (topicPicks): two wrong meanings from other lines of `pool` (the lines of the same
 * place = the same topic), the same level first, the most confusable ones (confusability), never one that reads the
 * same or nearly the same as the right one or as each other (nearSame): two fair answers would make it a coin toss.
 *
 * `decoySkip`: lines never used for the look-alike pair (the other lines of the same conversation: a meaning just
 * heard and answered would be easy to rule out).
 */
export function choicesFor(line: TownLine, pool: readonly TownLine[], seed: number, decoySkip?: ReadonlySet<string>): LineChoices {
  const s = Number.isFinite(seed) ? Math.floor(Math.abs(seed)) : 0;
  const h = hashText(line.id);
  const rand = seededRandom(h ^ Math.imul(s + 1, 0x9e3779b1));
  const right = meaningOf(line.vi);

  // the line's own sound-alikes that are fair next to its meaning (and next to each other)
  const own: { vi: string; meaning: Meaning; kind: SoundAlikeKind }[] = [];
  for (const a of soundAlikesOf(line)) {
    const meaning = meaningOf(a.vi);
    if (!meaning.key || meaning.key === right.key || nearSame(right, meaning)) continue;
    if (own.some((o) => o.meaning.key === meaning.key || nearSame(o.meaning, meaning))) continue;
    own.push({ vi: a.vi, meaning, kind: a.kind });
  }

  if (own.length === 0) {
    const options = topicPicks(line, pool, right, rand, CHOICE_COUNT - 1).map((p) => p.vi);
    const answer = answerAt(h, s, options.length + 1);
    options.splice(answer, 0, line.vi);
    return { options, answer };
  }

  let wrong: { vi: string; kind: SoundAlikeKind | null }[];
  if (own.length >= 2) {
    wrong = shuffled(own, rand)
      .slice(0, CHOICE_COUNT - 1)
      .map((o) => ({ vi: o.vi, kind: o.kind }));
  } else {
    const twin = own[0];
    const pair = decoyPair(line, pool, right, twin.meaning, rand, decoySkip);
    const rest: { vi: string; kind: SoundAlikeKind | null }[] = pair
      ? pair.map((vi) => ({ vi, kind: null }))
      : topicPicks(line, pool, right, rand, 1, [twin.meaning]).map((p) => ({ vi: p.vi, kind: null }));
    wrong = shuffled([{ vi: twin.vi, kind: twin.kind }, ...rest], rand);
  }
  const answer = answerAt(h, s, wrong.length + 1);
  const options = wrong.map((w) => w.vi);
  const alike = wrong.map((w) => w.kind);
  options.splice(answer, 0, line.vi);
  alike.splice(answer, 0, null);
  return { options, answer, alike };
}

/**
 * Where the right meaning goes among `n` options for (line hash, seed): consecutive seeds never share a position, and
 * a step that shares no factor with `n` visits every position.
 */
function answerAt(h: number, s: number, n: number): number {
  if (n <= 1) return 0;
  const stride = n === 3 ? 1 + ((h >>> 8) % 2) : n === 4 ? ((h >>> 8) % 2 === 0 ? 1 : 3) : 1;
  return ((h % n) + (s % n) * stride) % n;
}

/** The seed for a line's choices: how often it was answered before (0 the first time). */
export function choiceSeed(progress: TownProgress, lineId: string): number {
  return lineProgress(progress, lineId)?.tries ?? 0;
}

// ───────────────────────── how an answer counts ─────────────────────────

/**
 * The tally after one more play. `mode` = the button ("Nghe lại" and the automatic first play are 'normal', "Chậm"
 * is 'slow'), `baseRate` = Settings → Tốc độ đọc when the play starts: a normal play below normal speed counts as a
 * slowed one, exactly as in Chép chính tả (core/dictation/listens tallyKindFor).
 */
export function notePlay(tally: ListenTally | null | undefined, mode: 'normal' | 'slow', baseRate: number): ListenTally {
  return addListen(tally, tallyKindFor(mode, baseRate));
}

/** Nothing was played yet: there is nothing to understand, so the meanings must not be answerable. */
export function canAnswer(listens: ListenTally | null | undefined): boolean {
  return totalListens(listens) > 0;
}

/**
 * How an answered line counts: 'first' = right after exactly one play at the normal speed, 'replayed' = right after
 * more plays or a slower one, 'wrong'. null when the line was never played (see canAnswer): a guess is not listening,
 * so it is recorded nowhere.
 */
export function lineOutcome(correct: boolean, listens: ListenTally | null | undefined): LineOutcome | null {
  if (!canAnswer(listens)) return null;
  if (!correct) return 'wrong';
  return heardOnce(listens) ? 'first' : 'replayed';
}

// ───────────────────────── the end of a conversation ─────────────────────────

export interface VisitSummary {
  /** Lines answered in this conversation. */
  lines: number;
  /** Answered right (on the first listen or not). */
  understood: number;
  /** Of those, right on the first listen. */
  first: number;
  wrong: number;
  /** All its lines answered, none wrong (what the conversation bonus pays for: ./economy conversationBonus). */
  perfect: boolean;
}

/** The counts of a conversation from its outcomes. What it paid is the store's answer (./store), not derived here. */
export function visitSummary(outcomes: readonly LineOutcome[], size: number = VISIT_SIZE): VisitSummary {
  let first = 0;
  let wrong = 0;
  for (const o of outcomes) {
    if (o === 'first') first += 1;
    else if (o === 'wrong') wrong += 1;
  }
  return { lines: outcomes.length, understood: outcomes.length - wrong, first, wrong, perfect: isPerfect(outcomes, size) };
}
