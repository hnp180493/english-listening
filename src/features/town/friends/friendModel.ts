// "Thân thiết" in the game shell (docs/town.md §12): the words around the friendship score, how a resident takes a
// gift, and one resident's page of the Sổ tay (journal). Pure, so it can be tested.

import { episodeWaitingForFriend, isEpisodeFinished, needsHome, nextEpisode } from '../../../core/town/episodes';
import { isBuilt } from '../../../core/town/economy';
import { chosenOption, friendView, MAX_HEARTS, type FriendView, type GiftTaste } from '../../../core/town/friendship';
import { episodeProgress, knowsFact, type TownProgress } from '../../../core/town/progress';
import type { StoryFact } from '../../../core/town/story';
import { residentArc } from '../../../data/stories';
import { townPlace } from '../../../data/town';
import { townGift, type TownGift } from '../../../data/townGifts';
import { storiesOfPlace } from '../../../data/townStories';
import type { EmoteKind } from '../engine/draw/overlay';
import type { PortraitMood } from '../art';

/** The gift shop's one line of rules (core/town/friendship GIFT_POINTS). */
export const GIFT_RULES = 'Mỗi ngày tặng mỗi người một món. Món họ mê: +80 điểm thân thiết, món họ thích: +40, món khác: +10, món họ không thích: −20. Ai thích gì thì họ từng nói trong chuyện của họ; Sổ tay ghi lại điều bạn đã nghe.';

/** "3/10 tim" */
export function heartsText(hearts: number): string {
  return `${hearts}/${MAX_HEARTS} tim`;
}

/** What is left to the next heart: "Còn 35 điểm nữa tới tim thứ 4". */
export function toNextText(f: Pick<FriendView, 'hearts' | 'toNext'>): string {
  if (f.toNext === null) return `Đã đủ ${MAX_HEARTS} tim.`;
  return `Còn ${f.toNext} điểm nữa tới tim thứ ${f.hearts + 1}.`;
}

/** Friendship points won or lost: "+80 điểm thân thiết". */
export function pointsText(n: number): string {
  return `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)} điểm thân thiết`;
}

/** Why the next episode waits: "Cần 4 tim", "Cần biết thêm 1 điều về Emma", or both. */
export function lockText(need: { hearts: number | null; facts: number }, resident: string): string {
  const parts: string[] = [];
  if (need.hearts !== null) parts.push(`${need.hearts} tim`);
  if (need.facts > 0) parts.push(`biết thêm ${need.facts} điều về ${resident}`);
  return parts.length > 0 ? `Cần ${parts.join(' và ')}` : '';
}

export interface GiftReactionView {
  emote: EmoteKind;
  mood: PortraitMood;
  title: string;
}

/** How a resident takes a gift: a picture over their head and the words of the card. */
export function giftReaction(taste: GiftTaste, resident: string): GiftReactionView {
  switch (taste) {
    case 'loves':
      return { emote: 'heart', mood: 'happy', title: `${resident} rất thích món này!` };
    case 'likes':
      return { emote: 'smile', mood: 'happy', title: `${resident} thích món này.` };
    case 'dislikes':
      return { emote: 'frown', mood: 'neutral', title: `${resident} không thích món này lắm.` };
    default:
      return { emote: 'meh', mood: 'neutral', title: `${resident} nhận quà, cảm ơn bạn.` };
  }
}

// ───────────────────────── the Sổ tay ─────────────────────────

export type NextStatus = 'ready' | 'relisten' | 'hearts' | 'home' | 'done' | 'none';

export interface JournalNext {
  status: NextStatus;
  order: number | null;
  title: string | null;
  /** In words: "Sẵn sàng: Tập 3 · …", "Tập 3 cần 4 tim (đang có 2)". */
  text: string;
}

export interface JournalChoice {
  episode: string;
  intent: string;
  vi: string;
}

export interface ResidentJournal {
  placeId: string;
  resident: string;
  friend: FriendView;
  /** What the learner knows about them. */
  about: StoryFact[];
  /** What they remember about the learner. */
  remembers: StoryFact[];
  /** Gifts they love / like / dislike, learned from what they said (facts with a gift). */
  gifts: { taste: 'loves' | 'likes' | 'dislikes'; gift: TownGift }[];
  next: JournalNext;
  choices: JournalChoice[];
}

function journalNext(progress: TownProgress, placeId: string, now: number, resident: string, hearts: number): JournalNext {
  const list = storiesOfPlace(placeId);
  if (list.length === 0) return { status: 'none', order: null, title: null, text: `${resident} chưa có chuyện để kể.` };
  const due = nextEpisode(progress, placeId, now);
  if (due) {
    const e = due.episode;
    return due.mode === 'relisten'
      ? { status: 'relisten', order: e.order, title: e.title, text: `Đến hạn nghe lại Tập ${e.order}: ${e.title}` }
      : { status: 'ready', order: e.order, title: e.title, text: `Sẵn sàng nghe Tập ${e.order}: ${e.title}` };
  }
  const open = list.find((e) => !isEpisodeFinished(episodeProgress(progress, e.id)));
  if (!open) return { status: 'done', order: null, title: null, text: `Đã nghe hết ${list.length} tập chuyện của ${resident}.` };
  const wait = episodeWaitingForFriend(progress, placeId);
  if (wait) {
    const lock = lockText({ hearts: wait.needs.hearts, facts: wait.needs.facts.length }, resident);
    return { status: 'hearts', order: open.order, title: open.title, text: `Tập ${open.order}: ${lock.charAt(0).toLowerCase() + lock.slice(1)} (đang có ${hearts} tim)` };
  }
  if (needsHome(open) && !isBuilt(progress, placeId)) return { status: 'home', order: open.order, title: open.title, text: `Tập ${open.order} kể ở nhà mới: xây ${townPlace(placeId)?.name ?? 'nhà'} trước` };
  return { status: 'none', order: open.order, title: open.title, text: `Tập ${open.order}: nghe xong tập trước đã` };
}

/** One resident's page of the Sổ tay. */
export function residentJournal(progress: TownProgress, placeId: string, now: number): ResidentJournal {
  const resident = townPlace(placeId)?.resident ?? '';
  const friend = friendView(progress, placeId);
  const facts = (residentArc(placeId)?.facts ?? []).filter((f) => f.vi.trim() && knowsFact(progress, f.id));
  const gifts: ResidentJournal['gifts'] = [];
  for (const f of facts) {
    const g = f.gift ? townGift(f.gift.id) : undefined;
    if (g && f.gift && !gifts.some((x) => x.gift.id === g.id)) gifts.push({ taste: f.gift.taste, gift: g });
  }
  const order = { loves: 0, likes: 1, dislikes: 2 } as const;
  gifts.sort((a, b) => order[a.taste] - order[b.taste]);
  const choices: JournalChoice[] = [];
  for (const episode of storiesOfPlace(placeId)) {
    for (const line of episode.lines) {
      const opt = line.choices ? chosenOption(progress, line) : null;
      if (opt) choices.push({ episode: `Tập ${episode.order}: ${episode.title}`, intent: opt.intent, vi: opt.vi });
    }
  }
  return {
    placeId,
    resident,
    friend,
    about: facts.filter((f) => !f.id.startsWith('you:')),
    remembers: facts.filter((f) => f.id.startsWith('you:')),
    gifts,
    next: journalNext(progress, placeId, now, resident, friend.hearts),
    choices,
  };
}
