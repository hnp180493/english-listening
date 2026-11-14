// "Chuyện ở thị trấn": the rules of the episodes (contract in ./story, content in data/townStories). Pure.
//
// An episode is heard three times over: once in one go with no text, then the gist question (the honest win: the
// main point understood on the very first listen); then line by line (play, pick the meaning, see how it was
// said); then once more in one go. Afterwards it comes back for a short re-listen (the whole exchange and the gist
// only) after 1, 3, 7 and 21 days: spaced re-listening. Episode 2 of a place opens once episode 1 is finished.
//
//   a line                                   as any line of the town (3 / 2 / 1 xu, ./economy lineReward)
//   the gist right on the very first listen  +5 xu (EPISODE_GIST_FIRST_XU), once per episode
//   the first finish of an episode           +10 xu (EPISODE_FINISH_XU)
//   a re-listen with the gist right          +3 xu (EPISODE_RELISTEN_XU)
//   a finish or a re-listen                  counts as a conversation for the daily task "Trò chuyện với 2 người dân"
//
// Stored per episode in the town progress (./progress episodes): the next re-listen is derived from it, never stored.

import { storiesOfPlace } from '../../data/townStories';
import { townPlace } from '../../data/town';
import { noteConversation, type TaskPayout } from './daily';
import { isBuilt } from './economy';
import { addEarned, daysBefore, EPISODE_MAX_STAGE, episodeProgress, townDay, updateEpisode, type EpisodeProgress, type GistMark, type TownProgress } from './progress';
import type { StoryEpisode, StorySpeaker } from './story';
import { episodeTownLines, placeStoryLines } from './storyLines';
import { choicesFor, seededRandom, type LineChoices } from './visit';

/** Days from one whole listen that counted to the next re-listen, by stage (1 = just finished). */
export const RELISTEN_DAYS: readonly number[] = [1, 3, 7, 21];
/** After a re-listen whose gist was not right: again the next day, at the same stage. */
export const RETRY_DAYS = 1;

export const EPISODE_GIST_FIRST_XU = 5;
export const EPISODE_FINISH_XU = 10;
export const EPISODE_RELISTEN_XU = 3;

export type EpisodeMode = 'new' | 'relisten';

// ───────────────────────── schedule ─────────────────────────

/** Finished at least once (the three steps done). */
export function isEpisodeFinished(e: EpisodeProgress | undefined): boolean {
  return (e?.stage ?? 0) >= 1;
}

/**
 * The local day ('YYYY-MM-DD') the next re-listen is due, or null: not finished yet, or every re-listen done. Counted
 * in local days from the day of the last whole listen (a re-listen is due from the start of its day). A last
 * re-listen whose gist was not right (`at` after `okAt`) brings it back the next day, at the same stage.
 */
export function episodeDueDay(e: EpisodeProgress | undefined): string | null {
  if (!e || e.stage < 1 || e.stage >= EPISODE_MAX_STAGE || e.at <= 0) return null;
  const days = e.at > e.okAt ? RETRY_DAYS : (RELISTEN_DAYS[e.stage - 1] ?? RELISTEN_DAYS[RELISTEN_DAYS.length - 1]);
  return daysBefore(townDay(e.at), -days);
}

export function isEpisodeDue(e: EpisodeProgress | undefined, now: number): boolean {
  const due = episodeDueDay(e);
  return due !== null && townDay(now) >= due;
}

/** Whole days from `now` to the next re-listen (0 = today or overdue), null when none is scheduled. */
export function daysUntilRelisten(e: EpisodeProgress | undefined, now: number): number | null {
  const due = episodeDueDay(e);
  if (due === null) return null;
  const today = townDay(now);
  if (today >= due) return 0;
  let n = 0;
  for (let d = today; d < due && n < 400; n++) d = daysBefore(d, -1);
  return n;
}

/** Episode 1 of a place is open from the start; every later one once the one before it is finished. */
export function isEpisodeUnlocked(progress: TownProgress, episode: Pick<StoryEpisode, 'id' | 'placeId'>): boolean {
  const list = storiesOfPlace(episode.placeId);
  const i = list.findIndex((e) => e.id === episode.id);
  if (i < 0) return false;
  return i === 0 || isEpisodeFinished(episodeProgress(progress, list[i - 1].id));
}

export interface NextEpisode {
  episode: StoryEpisode;
  mode: EpisodeMode;
}

/**
 * What a conversation at `placeId` should be now: a re-listen that is due (the one due longest first), else the
 * next episode not finished yet (if it is open), else null (the quick five-line chat). An empty lot: null.
 */
export function nextEpisode(progress: TownProgress, placeId: string, now: number): NextEpisode | null {
  if (!isBuilt(progress, placeId)) return null;
  const list = storiesOfPlace(placeId);
  let due: { episode: StoryEpisode; day: string } | null = null;
  for (const episode of list) {
    const e = episodeProgress(progress, episode.id);
    if (!isEpisodeDue(e, now)) continue;
    const day = episodeDueDay(e)!;
    if (!due || day < due.day) due = { episode, day };
  }
  if (due) return { episode: due.episode, mode: 'relisten' };
  const open = list.find((episode) => !isEpisodeFinished(episodeProgress(progress, episode.id)));
  return open && isEpisodeUnlocked(progress, open) ? { episode: open, mode: 'new' } : null;
}

// ───────────────────────── who says it ─────────────────────────

/** The learner's own character. */
export const PLAYER_NAME = 'Bạn';

/** The name of whoever says a line: 'Bạn' for the learner's character, else the resident. */
export function speakerName(who: StorySpeaker, placeId: string): string {
  if (who === 'you') return PLAYER_NAME;
  const id = who === 'them' ? placeId : who;
  return townPlace(id)?.resident ?? townPlace(placeId)?.resident ?? PLAYER_NAME;
}

/** Whose head the speech bubble goes over: a place id (its resident), 'player', or null for nobody in the scene. */
export function speakerOnStage(who: StorySpeaker, placeId: string): string | 'player' | null {
  if (who === 'you') return 'player';
  if (who === 'them') return placeId;
  return null; // another resident who joins the talk is only heard
}

// ───────────────────────── the choices ─────────────────────────

/**
 * The three meanings for one line of an episode: its own and two others from the lines of the same place's stories
 * (the same episode included: ./visit choicesFor ranks them by how easily they are confused with the right one).
 * Deterministic for (line, seed); pass the line's tries so far (./visit choiceSeed).
 */
export function storyChoices(lineId: string, episode: StoryEpisode, seed: number): LineChoices {
  const line = episodeTownLines(episode).find((l) => l.id === lineId);
  if (!line) return { options: [], answer: 0 };
  return choicesFor(line, placeStoryLines(episode.placeId), seed);
}

/**
 * The gist question's three options in a seeded order (authors tend to write the right one first): the right one
 * is at a different place for seed n and n + 1.
 */
export function gistChoices(episode: StoryEpisode, seed: number): LineChoices {
  const opts = episode.gist.options;
  const s = Number.isFinite(seed) ? Math.floor(Math.abs(seed)) : 0;
  const rand = seededRandom(hash(episode.id));
  const base = Math.floor(rand() * opts.length);
  const answerAt = (base + s) % opts.length;
  const wrong = opts.filter((_, i) => i !== episode.gist.answer);
  if (rand() < 0.5) wrong.reverse();
  const options = [...wrong];
  options.splice(answerAt, 0, opts[episode.gist.answer]);
  return { options, answer: answerAt };
}

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ───────────────────────── what a gist, a finish, a re-listen do ─────────────────────────

export interface GistEffect {
  progress: TownProgress;
  /** The gist was right after exactly one whole listen, on the episode's very first listen ever (the honest win). */
  firstWin: boolean;
  /** Xu for the gist (EPISODE_GIST_FIRST_XU for a first win; EPISODE_RELISTEN_XU for a right re-listen). */
  reward: number;
  /** Re-listen only: daily tasks the finished re-listen reached (a re-listen counts as a conversation). */
  tasksPaid: TaskPayout[];
}

/**
 * The gist of an episode answered after `passes` whole listens. A new episode: the first answer ever marks
 * `firstGist` (2 = right after one listen, 1 otherwise) and a right one after one listen pays EPISODE_GIST_FIRST_XU;
 * a later run of the same unfinished episode pays nothing for its gist (it was heard before). A re-listen of a
 * finished episode: it is a whole listen that counts (`at`), a right gist moves it a stage on (`okAt`) and pays
 * EPISODE_RELISTEN_XU, and it counts as a conversation for the daily task. The input is not changed.
 */
export function applyEpisodeGist(
  progress: TownProgress,
  episode: Pick<StoryEpisode, 'id' | 'placeId'>,
  mode: EpisodeMode,
  right: boolean,
  passes: number,
  now: number,
  device: string,
): GistEffect {
  const prev = episodeProgress(progress, episode.id);
  if (mode === 'new') {
    if ((prev?.firstGist ?? 0) !== 0) return { progress, firstWin: false, reward: 0, tasksPaid: [] };
    const firstWin = right && passes === 1;
    const mark: GistMark = firstWin ? 2 : 1;
    const marked = updateEpisode(progress, episode.id, (e) => ({ ...e, firstGist: mark }));
    if (marked === progress) return { progress, firstWin: false, reward: 0, tasksPaid: [] };
    const reward = firstWin ? EPISODE_GIST_FIRST_XU : 0;
    return { progress: addEarned(marked, device, reward), firstWin, reward, tasksPaid: [] };
  }
  if (!isEpisodeFinished(prev)) return { progress, firstWin: false, reward: 0, tasksPaid: [] };
  const t = Number.isFinite(now) && now > 0 ? now : 0;
  const listened = updateEpisode(progress, episode.id, (e) =>
    right ? { ...e, at: t, okAt: t, stage: Math.min(EPISODE_MAX_STAGE, e.stage + 1) } : { ...e, at: t },
  );
  if (listened === progress) return { progress, firstWin: false, reward: 0, tasksPaid: [] };
  const reward = right ? EPISODE_RELISTEN_XU : 0;
  const noted = noteConversation(addEarned(listened, device, reward), episode.placeId, now, device);
  return { progress: noted.progress, firstWin: false, reward, tasksPaid: noted.tasksPaid };
}

export interface FinishEffect {
  progress: TownProgress;
  /** This run finished the episode for the first time. */
  firstFinish: boolean;
  /** EPISODE_FINISH_XU on the first finish, 0 otherwise. */
  reward: number;
  /** Daily tasks the finished episode reached (it counts as a conversation). */
  tasksPaid: TaskPayout[];
}

/**
 * A new episode heard through its three steps, with `linesRight` of its lines understood: finished (stage 1 at
 * least), the finish is a whole listen that counts (`at`, `okAt`: the first re-listen is due RELISTEN_DAYS[0] days
 * later), the best run kept, EPISODE_FINISH_XU on the first finish, and a conversation for the daily task. An episode
 * at a place that is not built: nothing.
 */
export function applyEpisodeFinish(progress: TownProgress, episode: Pick<StoryEpisode, 'id' | 'placeId'>, linesRight: number, now: number, device: string): FinishEffect {
  if (!isBuilt(progress, episode.placeId)) return { progress, firstFinish: false, reward: 0, tasksPaid: [] };
  const firstFinish = !isEpisodeFinished(episodeProgress(progress, episode.id));
  const t = Number.isFinite(now) && now > 0 ? now : 0;
  const lines = Number.isFinite(linesRight) ? Math.max(0, Math.floor(linesRight)) : 0;
  const finished = updateEpisode(progress, episode.id, (e) => ({ ...e, stage: Math.max(1, e.stage), at: t, okAt: t, bestLines: lines }));
  // a bad id never sticks: nothing is paid then, so nothing can be paid twice
  if (firstFinish && !isEpisodeFinished(episodeProgress(finished, episode.id))) return { progress, firstFinish: false, reward: 0, tasksPaid: [] };
  const reward = firstFinish ? EPISODE_FINISH_XU : 0;
  const noted = noteConversation(addEarned(finished, device, reward), episode.placeId, now, device);
  return { progress: noted.progress, firstFinish, reward, tasksPaid: noted.tasksPaid };
}
