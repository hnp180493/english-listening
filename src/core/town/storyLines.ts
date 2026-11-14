// The lines of "Chuyện ở thị trấn" as the town's own lines (TownLine), and a lookup by line id. A leaf: only the
// content and types, so ./economy (xp), the review layer (card kind 'talk') and ./episodes can all use it without an
// import cycle.

import { storiesOfPlace, TOWN_STORIES } from '../../data/townStories';
import type { StoryEpisode, StoryLine } from './story';
import type { TownLine } from './types';

/**
 * A story line as a TownLine: recorded, paid and counted like any line of the town. The level is the episode's.
 * No `sentenceId`: it is not a dictation sentence (a miss enrols its own review card, `talk:<line id>`).
 */
export function storyTownLine(line: StoryLine, episode: Pick<StoryEpisode, 'level'>): TownLine {
  const out: TownLine = { id: line.id, text: line.text, vi: line.vi, level: episode.level };
  if (line.say) out.say = line.say;
  return out;
}

const byEpisode = new WeakMap<StoryEpisode, readonly TownLine[]>();

/** The lines of an episode as TownLines, in order (stable identity per episode). */
export function episodeTownLines(episode: StoryEpisode): readonly TownLine[] {
  let lines = byEpisode.get(episode);
  if (!lines) {
    lines = episode.lines.map((l) => storyTownLine(l, episode));
    byEpisode.set(episode, lines);
  }
  return lines;
}

/** Every line of every episode of a place (the pool the wrong meanings are drawn from). */
export function placeStoryLines(placeId: string): TownLine[] {
  return storiesOfPlace(placeId).flatMap((e) => episodeTownLines(e));
}

let all: readonly TownLine[] | null = null;
let index: Map<string, { line: StoryLine; episode: StoryEpisode }> | null = null;

/** Every story line of the town. */
export function allStoryLines(): readonly TownLine[] {
  all ??= TOWN_STORIES.flatMap((e) => episodeTownLines(e));
  return all;
}

/** A story line and its episode by line id ('cafe-1-03'). */
export function storyLineById(id: string): { line: StoryLine; episode: StoryEpisode } | undefined {
  if (!index) {
    index = new Map();
    for (const episode of TOWN_STORIES) for (const line of episode.lines) index.set(line.id, { line, episode });
  }
  return index.get(id);
}
