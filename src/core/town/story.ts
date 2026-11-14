// "Chuyện ở thị trấn": short everyday dialogues, told in episodes, one small story per place.
//
// Why (docs/town.md): a single sentence heard on its own, with replays, is not how speech arrives in real life. An
// episode is a whole exchange between a resident and the learner ("you"), heard first in one go (gist), then line by
// line (decoding), then again in one go without stopping. Each resident speaks with their own voice.
//
// This file is the shared contract: content lives in data/townStories.ts, voices in ./voices.ts, progress and
// rewards in the town store.

import type { Level } from '../types';

/**
 * Who says a line: 'them' = the resident of the episode's place, 'you' = the learner's character, or the id of
 * another place whose resident joins the scene (e.g. 'shop' = Ben drops by the café).
 */
export type StorySpeaker = 'them' | 'you' | string;

export interface StoryLine {
  /** Stable id, `<episodeId>-<nn>` (e.g. 'cafe-1-03'): stored in progress and review cards. Never change it. */
  id: string;
  who: StorySpeaker;
  /** Natural written English, as people really say it in that situation. */
  text: string;
  /** Natural Vietnamese meaning (what the learner picks). */
  vi: string;
  /** Authored connected spelling (as Sentence.say): only when the decoder's own speakText is not right. SAPI-safe. */
  say?: string;
}

export interface StoryGist {
  /** Vietnamese question about the main point of the whole exchange (not about one word). */
  q: string;
  /** Three Vietnamese options; all plausible from the place and the characters, only one true. */
  options: [string, string, string];
  answer: 0 | 1 | 2;
}

export interface StoryEpisode {
  /** Stable id `<placeId>-<n>` (e.g. 'cafe-1'). Never change it. */
  id: string;
  placeId: string;
  /** 1, 2, …: episodes of a place unlock in order. */
  order: number;
  /** Short Vietnamese title (e.g. 'Ly cà phê đầu tiên'). */
  title: string;
  /** One Vietnamese sentence setting the scene, shown before the first listen (never the content of the talk). */
  scene: string;
  level: Level;
  /** 5 to 8 lines, alternating speakers mostly; 'you' has at least one line. */
  lines: StoryLine[];
  gist: StoryGist;
}
