// The game shell's small decisions for "Chuyện ở thị trấn" (core/town/episodes), kept pure so they can be tested:
// what each line sends to the voice, the pause between two turns, the words after the gist, the result card.

import { speakerOnStage } from '../../core/town/episodes';
import type { TownEpisodeResult, TownEpisodeTurn } from '../../core/town/store';
import type { StoryEpisode } from '../../core/town/story';
import { storyLinePlayback } from '../../core/town/storyAudio';
import type { CastVoice } from '../../core/town/voices';
import type { DictationAudio } from '../dictation/decodeCache';
import type { Verdict } from './shellModel';
import { tl } from '../../i18n';

/** One line of the exchange as the players need it: the texts to speak, who says it, whose head gets the bubble. */
export interface StoryItem {
  id: string;
  /** Connected text (the main playback) and written text ("Rõ từng từ"), at the episode's level. */
  audio: DictationAudio;
  voice: CastVoice;
  /** Name shown ('Bạn' for the learner's character). */
  speaker: string;
  /**
   * Who gets the bubble: the resident's place id, 'player', or a neighbour's place id (the stage shows the bubble only
   * over somebody who is there: a neighbour only heard on the phone gets none).
   */
  stage: string | null;
}

/**
 * What every line sends: exactly the text and voice of core/town/storyAudio (the clip the generator makes is the
 * clip that plays), the level for the learner's rate (level 1 a little slower, as in dictation). A turn is the line
 * as said now (a choice line as the option chosen, a line with variants as the variant the learner's facts call for).
 */
export function storyItems(episode: StoryEpisode, turns: readonly TownEpisodeTurn[]): StoryItem[] {
  return turns.map((t) => {
    const line = { text: t.line.text, say: t.line.say, who: t.who };
    const connected = storyLinePlayback(line, episode, 'connected');
    const careful = storyLinePlayback(line, episode, 'careful');
    return {
      id: t.line.id,
      audio: { connected: connected.text, careful: careful.text, level: episode.level },
      voice: connected.voice,
      speaker: t.speaker,
      stage: speakerOnStage(t.who, episode.placeId) ?? t.who,
    };
  });
}

/** The first line a neighbour says (an episode's visitor: data/townStories.ts episodeVisitor), or -1. */
export function firstLineOf(items: readonly Pick<StoryItem, 'stage'>[], who: string | null): number {
  return who ? items.findIndex((it) => it.stage === who) : -1;
}

/**
 * Is the neighbour who drops in (first line `first`, -1: none) in the room? Each pass of the exchange (the whole listen,
 * line by line, the whole again) starts without them, and they come in at their first line of it: `reached` = the
 * furthest line of this pass that has sounded (the whole listen) or is on the screen (line by line), -1 before any.
 * The result card: in.
 */
export function visitorPresent(first: number, step: 'listen' | 'lines' | 'again' | 'result', reached: number): boolean {
  if (first < 0 || step === 'result') return true;
  return reached >= first;
}

/** The pause before a line in the whole exchange: a turn to the other speaker takes a breath, the same one less. */
export const TURN_GAP_MS = 450;
export const SAME_SPEAKER_GAP_MS = 220;

export function passGap(prev: Pick<StoryItem, 'speaker'> | undefined, next: Pick<StoryItem, 'speaker'>): number {
  if (!prev) return 0;
  return prev.speaker === next.speaker ? SAME_SPEAKER_GAP_MS : TURN_GAP_MS;
}

/** "Tập 1 · Ly cà phê đầu tiên", or "Nghe lại · Tập 1 · …". */
export function episodeHeading(episode: Pick<StoryEpisode, 'order' | 'title'>, relisten: boolean): string {
  return tl`${relisten ? 'Nghe lại · ' : ''}Tập ${episode.order} · ${episode.title}`;
}

/**
 * What the game says to the gist. The honest win is a right gist on the episode's very first listen after one
 * whole listen (`firstWin`); a right gist after more listens, or on a later run, is only "right".
 */
export function gistVerdict(mode: 'new' | 'relisten', right: boolean, firstWin: boolean): Verdict {
  if (!right) {
    return {
      tone: 'bad',
      title: mode === 'relisten' ? 'Lần này chưa đúng ý chính.' : 'Chưa đúng ý chính.',
      emote: 'question',
      sfx: 'wrong',
    };
  }
  if (firstWin) return { tone: 'ok', title: 'Hiểu ý chính ngay lần đầu!', emote: 'heart', sfx: 'first' };
  return { tone: 'ok', title: mode === 'relisten' ? 'Vẫn nắm được ý chính!' : 'Đúng ý chính rồi.', emote: 'sparkle', sfx: 'right' };
}

/** What comes after a wrong gist, before the next step. */
export function gistFollowUp(mode: 'new' | 'relisten', right: boolean): string | null {
  if (right) return null;
  return mode === 'relisten' ? 'Đọc lại cả đoạn bên dưới. Ngày mai nghe lại lần nữa nhé.' : 'Nghe từng câu sẽ rõ hơn.';
}

/** When the episode comes back: "ngày mai", "sau 3 ngày", or never again. */
export function nextListenText(resident: string, daysToNext: number | null): string {
  if (daysToNext === null) return tl`Bạn đã nghe lại chuyện này đủ bốn lần. ${resident} sẽ không kể lại nữa.`;
  if (daysToNext <= 0) return tl`${resident} sẽ kể lại chuyện này hôm nay.`;
  if (daysToNext === 1) return tl`${resident} sẽ kể lại chuyện này ngày mai để bạn nghe lại.`;
  return tl`${resident} sẽ kể lại chuyện này sau ${daysToNext} ngày để bạn nghe lại.`;
}

export interface EpisodeSummaryRow {
  label: string;
  xu: number;
}

export interface EpisodeSummary {
  title: string;
  /** What this run measured: ✓ all right, ✗ not right, 'part' some lines (no cross for 6 of 7). */
  checks: { label: string; tone: 'ok' | 'bad' | 'part' }[];
  total: number;
  /** Where the xu came from, only when more than one thing paid. */
  rows: EpisodeSummaryRow[];
}

/** The result card of an episode run (`firstListen`: the run began with the episode's very first listen). */
export function episodeSummary(r: TownEpisodeResult, episode: Pick<StoryEpisode, 'order' | 'title'>, firstListen: boolean): EpisodeSummary {
  const checks: EpisodeSummary['checks'] = [];
  if (r.gistRight !== null) checks.push({ label: firstListen ? 'Ý chính, ngay lần nghe đầu' : 'Ý chính', tone: (firstListen ? r.gistFirstWin : r.gistRight) ? 'ok' : 'bad' });
  if (r.mode === 'new') {
    const tone = r.lines > 0 && r.linesRight === r.lines ? 'ok' : r.linesRight === 0 ? 'bad' : 'part';
    checks.push({ label: tl`Hiểu ${r.linesRight}/${r.lines} câu`, tone });
  }
  const rows: EpisodeSummaryRow[] = [];
  if (r.lineXu > 0) rows.push({ label: 'Các câu hiểu được', xu: r.lineXu });
  if (r.gistXu > 0) rows.push({ label: r.mode === 'relisten' ? 'Nghe lại, vẫn hiểu ý chính' : 'Hiểu ý chính ngay lần đầu', xu: r.gistXu });
  if (r.finishXu > 0) rows.push({ label: 'Nghe xong tập lần đầu', xu: r.finishXu });
  for (const t of r.tasksPaid) rows.push({ label: tl`Việc hôm nay: ${t.label}`, xu: t.reward });
  const title = r.mode === 'relisten' ? tl`Đã nghe lại Tập ${episode.order}` : tl`Xong Tập ${episode.order}: ${episode.title}`;
  return { title, checks, total: r.earned, rows: rows.length > 1 ? rows : [] };
}
