// The game shell's own little decisions, kept pure so they can be tested: what the stage is told to draw, whom to
// talk to next, what to say after an answer, what a finished conversation came to, the words of every action.

import { HOME_EPISODE_FROM } from '../../core/town/episodes';
import { storiesOfPlace } from '../../data/townStories';
import type { TaskPayout, TownTaskView } from '../../core/town/daily';
import type { DecorationView, PlaceView, TownOverview } from '../../core/town/overview';
import type { TownAnswerResult } from '../../core/town/store';
import type { LineOutcome } from '../../core/town/types';
import type { EmoteKind } from './engine/draw/overlay';
import type { TownTheme } from './engine/palette';
import type { Marker, StageState } from './engine/sim';
import type { SfxName } from './sfx';

export const xu = (n: number): string => `${n} xu`;

/** How many empty lots the town shows as construction sites at once. */
export const LOTS_ON_OFFER = 3;

/**
 * The empty lots the learner works toward next: the cheapest ones not built yet (ties: in the listed order), at
 * most LOTS_ON_OFFER. Only these stand in the world as construction sites with their price; every other lot is a
 * corner of grass and trees until one of these is built and it comes up. The build panel still lists every lot.
 */
export function lotsOnOffer(places: readonly Pick<PlaceView, 'place' | 'built' | 'cost'>[], max = LOTS_ON_OFFER): string[] {
  return places
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !p.built)
    .sort((a, b) => a.p.cost - b.p.cost || a.i - b.i)
    .slice(0, Math.max(0, max))
    .map(({ p }) => p.place.id);
}

/**
 * What floats over a resident: an episode due for its re-listen or one to hear comes before the lines (its own
 * markers, 'relisten' / 'story'), then what waits among the place's lines.
 */
export function markerOf(p: Pick<PlaceView, 'marker' | 'episode'>): Marker | null {
  if (p.episode) return p.episode.mode === 'relisten' ? 'relisten' : 'story';
  return p.marker;
}

/**
 * What the canvas draws, from what the learner has understood, built and bought. Every resident gets their marker,
 * a lodger too (whose place is not built yet: they talk all the same); lit windows only where a house stands.
 */
export function stageStateOf(o: Pick<TownOverview, 'places' | 'decorations'>, theme: TownTheme): StageState {
  const lit: Record<string, number> = {};
  const marker: Record<string, Marker> = {};
  const built: string[] = [];
  for (const p of o.places) {
    const m = markerOf(p);
    if (m) marker[p.place.id] = m;
    if (!p.built) continue;
    built.push(p.place.id);
    lit[p.place.id] = p.lit;
  }
  return { built, sites: lotsOnOffer(o.places), decorations: o.decorations.filter((d) => d.bought).map((d) => d.decoration.id), lit, marker, theme };
}

/** The price written over the lots on offer (lotsOnOffer): the others show nothing. */
export function lotLabelsOf(o: Pick<TownOverview, 'places'>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const id of lotsOnOffer(o.places)) {
    const p = o.places.find((q) => q.place.id === id);
    if (p) out[id] = xu(p.cost);
  }
  return out;
}

const MARKER_RANK: Readonly<Record<Marker, number>> = { relisten: 0, story: 1, new: 2, repeat: 3, heart: 4 };

/**
 * Whom to talk to next: a re-listen that is due first (spaced re-listening only works on its day), then an episode
 * to hear, then somebody with lines not understood yet, then somebody worth hearing again. Lodgers (their place not
 * built yet) are suggested too. Among equals: the lowest episode number first (everybody's episode 1 before anybody's
 * episode 2), then a resident in their own home before a lodger (easier to find, and the free places come first),
 * then the place the learner knows least. Null only when nobody has anything to say.
 */
export function suggestedPlace(places: readonly PlaceView[]): PlaceView | null {
  let best: PlaceView | null = null;
  for (const p of places) {
    if (p.stats.total === 0 && !p.episode) continue;
    if (!best) {
      best = p;
      continue;
    }
    const a = MARKER_RANK[markerOf(p) ?? 'heart'];
    const b = MARKER_RANK[markerOf(best) ?? 'heart'];
    if (a !== b) {
      if (a < b) best = p;
      continue;
    }
    const order = (p.episode?.order ?? 0) - (best.episode?.order ?? 0);
    if (order !== 0) {
      if (order < 0) best = p;
      continue;
    }
    if (p.built !== best.built) {
      if (p.built) best = p;
      continue;
    }
    if (p.lit < best.lit) best = p;
  }
  return best;
}

/**
 * The words of the main button for a resident: `near` = the player stands beside them ("Bắt chuyện"), else walk
 * there first ("Tới gặp"). An episode says which one; a re-listen says so.
 */
export function talkPrompt(p: Pick<PlaceView, 'place' | 'episode'>, near: boolean): string {
  const who = p.place.resident;
  if (p.episode?.mode === 'relisten') return `Nghe lại chuyện với ${who}`;
  if (p.episode) return `${near ? 'Bắt chuyện với' : 'Tới gặp'} ${who} · Tập ${p.episode.order}`;
  return `${near ? 'Bắt chuyện với' : 'Tới gặp'} ${who}`;
}

// ───────────────────────── after an answer ─────────────────────────

export interface Verdict {
  tone: 'ok' | 'bad';
  title: string;
  emote: EmoteKind;
  sfx: SfxName;
}

/**
 * What the game says to an answer. `met`: the learner has answered this line before (its words were shown then), so
 * getting it after one listen is no proof of hearing: no first-listen praise for it.
 */
export function verdictOf(outcome: LineOutcome, met: boolean): Verdict {
  if (outcome === 'wrong') return { tone: 'bad', title: 'Chưa phải…', emote: 'question', sfx: 'wrong' };
  if (outcome === 'first' && !met) return { tone: 'ok', title: 'Chuẩn luôn, nghe một lần đã hiểu!', emote: 'heart', sfx: 'first' };
  return { tone: 'ok', title: 'Đúng rồi!', emote: 'sparkle', sfx: 'right' };
}

export interface TalkSummary {
  lines: number;
  understood: number;
  /** Understood after one listen, lines met before left out (see verdictOf). */
  firstNew: number;
  /** Xu for the lines themselves. */
  lineXu: number;
  /** Xu for understanding every line (0 otherwise). */
  bonus: number;
  /** Daily tasks paid during the conversation. */
  tasks: TaskPayout[];
  /** Everything it added. */
  total: number;
  heartsBefore: number;
  heartsAfter: number;
  /** The new title when a level was reached during the conversation. */
  levelTitle: string | null;
  title: string;
}

/** What a conversation came to, from its answers in order (`met[i]`: line i had been answered before). */
export function talkSummary(results: readonly TownAnswerResult[], met: readonly boolean[], resident: string): TalkSummary {
  let understood = 0;
  let firstNew = 0;
  let lineXu = 0;
  let bonus = 0;
  let levelTitle: string | null = null;
  const tasks: TaskPayout[] = [];
  results.forEach((r, i) => {
    if (r.outcome !== 'wrong') understood += 1;
    if (r.outcome === 'first' && !met[i]) firstNew += 1;
    lineXu += r.reward;
    bonus += r.bonus;
    tasks.push(...r.tasksPaid);
    if (r.leveledUp) levelTitle = r.levelAfter.title;
  });
  const lines = results.length;
  const total = lineXu + bonus + tasks.reduce((sum, t) => sum + t.reward, 0);
  const title =
    lines > 0 && understood === lines
      ? `Bạn hiểu hết ${lines} câu ${resident} nói!`
      : understood === 0
        ? `Chưa hiểu câu nào ${resident} nói`
        : `Bạn hiểu ${understood}/${lines} câu ${resident} nói`;
  return {
    lines,
    understood,
    firstNew,
    lineXu,
    bonus,
    tasks,
    total,
    heartsBefore: results[0]?.heartsBefore ?? 0,
    heartsAfter: results[results.length - 1]?.heartsAfter ?? 0,
    levelTitle,
    title,
  };
}

// ───────────────────────── the build panel ─────────────────────────

/** Empty lots, the ones the learner can pay for first, then the cheapest. */
export function lotRows(places: readonly PlaceView[]): PlaceView[] {
  return places.filter((p) => !p.built).sort((a, b) => Number(b.affordable) - Number(a.affordable) || a.cost - b.cost);
}

/** Decorations still to buy (affordable first, then the cheapest), and after them the ones already there. */
export function decorationRows(list: readonly DecorationView[]): DecorationView[] {
  const open = list.filter((d) => !d.bought).sort((a, b) => Number(b.affordable) - Number(a.affordable) || a.cost - b.cost);
  return [...open, ...list.filter((d) => d.bought)];
}

/** The one row whose button is the panel's main action: the asked-for lot when it can be paid, else the first affordable thing. */
export function primaryBuy(lots: readonly PlaceView[], decorations: readonly DecorationView[], wanted?: string | null): string | null {
  const asked = wanted ? lots.find((p) => p.place.id === wanted && p.affordable) : undefined;
  if (asked) return asked.place.id;
  return lots.find((p) => p.affordable)?.place.id ?? decorations.find((d) => d.affordable)?.decoration.id ?? null;
}

// ───────────────────────── words ─────────────────────────

/** The hidden list's talk button. A lodger (`built` false) is found at the boarding house, not at their empty lot. */
export function talkLabel(p: Pick<PlaceView, 'place'> & Partial<Pick<PlaceView, 'episode' | 'built'>>): string {
  const at = `Tới chỗ ${p.place.resident} ở ${p.built === false ? 'nhà trọ' : p.place.name}`;
  if (p.episode?.mode === 'relisten') return `${at} và nghe lại Tập ${p.episode.order}: ${p.episode.title}`;
  if (p.episode) return `${at} và nghe Tập ${p.episode.order}: ${p.episode.title}`;
  return `${at} và bắt chuyện`;
}

export function lotLabel(p: Pick<PlaceView, 'place' | 'cost'>): string {
  return `Xây ${p.place.name}, ${xu(p.cost)}`;
}

/**
 * What building a lot adds, for its row in the build panel: its resident moves out of the boarding house, and the
 * episodes told at home open (HOME_EPISODE_FROM on; "ngay" when one is ready to hear the moment it stands). null for
 * a place already built.
 */
export function homePerk(p: Pick<PlaceView, 'place' | 'built' | 'homeEpisode'>): string | null {
  if (p.built) return null;
  const who = p.place.resident;
  if (p.homeEpisode) return `${who} dọn về ở, mở ngay Tập ${p.homeEpisode.order}: ${p.homeEpisode.title}`;
  return storiesOfPlace(p.place.id).length >= HOME_EPISODE_FROM ? `${who} dọn về ở, có thêm Tập ${HOME_EPISODE_FROM} ở nhà mới` : `${who} dọn từ nhà trọ về ở`;
}

/** "1/2" while a task is open; nothing once it is done (the tick says it). */
export function taskCount(t: Pick<TownTaskView, 'done' | 'goal' | 'reached'>): string {
  return t.reached ? '' : `${t.done}/${t.goal}`;
}

/** The level chip for a screen reader. */
export function levelLabel(level: TownOverview['level']): string {
  if (level.nextAt === null || !level.nextTitle) return `Danh hiệu: ${level.title}`;
  return `Danh hiệu: ${level.title}. Còn ${Math.max(0, level.nextAt - level.xp)} điểm nữa thành ${level.nextTitle}`;
}
