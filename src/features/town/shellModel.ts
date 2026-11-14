// The game shell's own little decisions, kept pure so they can be tested: what the stage is told to draw, whom to
// talk to next, what to say after an answer, what a finished conversation came to, the words of every action.

import { residentTile, walkable } from '../../core/town/map';
import type { TaskPayout, TownTaskView } from '../../core/town/daily';
import type { DecorationView, PlaceView, TownOverview } from '../../core/town/overview';
import type { TownAnswerResult } from '../../core/town/store';
import type { LineOutcome } from '../../core/town/types';
import type { PlaceId, Tile } from '../../data/townWorld';
import type { EmoteKind } from './engine/draw/overlay';
import type { TownTheme } from './engine/palette';
import type { Marker, StageState } from './engine/sim';
import type { SfxName } from './sfx';

export const xu = (n: number): string => `${n} xu`;

/** What the canvas draws, from what the learner has understood, built and bought. */
export function stageStateOf(o: Pick<TownOverview, 'places' | 'decorations'>, theme: TownTheme): StageState {
  const lit: Record<string, number> = {};
  const marker: Record<string, Marker> = {};
  const built: string[] = [];
  for (const p of o.places) {
    if (!p.built) continue;
    built.push(p.place.id);
    lit[p.place.id] = p.lit;
    if (p.marker) marker[p.place.id] = p.marker;
  }
  return { built, decorations: o.decorations.filter((d) => d.bought).map((d) => d.decoration.id), lit, marker, theme };
}

/** The price written over every empty lot. */
export function lotLabelsOf(o: Pick<TownOverview, 'places'>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of o.places) if (!p.built) out[p.place.id] = xu(p.cost);
  return out;
}

const MARKER_RANK: Readonly<Record<string, number>> = { new: 0, repeat: 1, heart: 2 };

/**
 * Whom to talk to next: somebody with lines not understood yet before somebody worth hearing again, and among
 * those the one the learner knows least. Null only when nothing is built (never: three places are free).
 */
export function suggestedPlace(places: readonly PlaceView[]): PlaceView | null {
  let best: PlaceView | null = null;
  for (const p of places) {
    if (!p.built || p.stats.total === 0) continue;
    if (!best) {
      best = p;
      continue;
    }
    const a = MARKER_RANK[p.marker ?? 'heart'];
    const b = MARKER_RANK[best.marker ?? 'heart'];
    if (a < b || (a === b && p.lit < best.lit)) best = p;
  }
  return best;
}

/** Neighbours of a resident, best place to stand first: beside them on the screen, then in front, never hidden behind when it can be helped. */
const BESIDE: readonly Tile[] = [
  { x: -1, y: 1 },
  { x: 1, y: -1 },
  { x: 0, y: 1 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
  { x: -1, y: -1 },
];

/** The tile to stand on when a link opens straight into a conversation: beside the resident. */
export function talkStartTile(placeId: PlaceId): Tile | undefined {
  const at = residentTile(placeId);
  if (!at) return undefined;
  for (const d of BESIDE) {
    const t = { x: at.x + d.x, y: at.y + d.y };
    if (walkable(t)) return t;
  }
  return undefined;
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

export function talkLabel(p: Pick<PlaceView, 'place'>): string {
  return `Tới chỗ ${p.place.resident} ở ${p.place.name} và bắt chuyện`;
}

export function lotLabel(p: Pick<PlaceView, 'place' | 'cost'>): string {
  return `Xây ${p.place.name}, ${xu(p.cost)}`;
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
