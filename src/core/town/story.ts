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
  /**
   * The learner chooses what "you" say here (only on a 'you' line): 2–3 options, each a full voiced line. The line's own
   * text/vi are option 0 (kept for older code and tests). The choice is picked by its Vietnamese `intent` (so the
   * learner still LISTENS to the English), then that option is played; it can change hearts and teach facts that later
   * lines (`variants`), episodes and greetings remember.
   */
  choices?: StoryChoice[];
  /**
   * The same moment said differently when the learner has a fact (first matching wins; order = priority): e.g. Emma
   * says "The usual? An iced latte?" only if `you:iced-latte` is known. Each variant is its own voiced line.
   */
  variants?: StoryVariant[];
}

/** One option of a choice. id = `<lineId>-a|b|c` (stable). */
export interface StoryChoice {
  id: string;
  /** What the learner picks: a short Vietnamese intent, e.g. "Nhận lời", "Từ chối khéo", "Hỏi thêm". */
  intent: string;
  text: string;
  vi: string;
  say?: string;
  /** Friendship points with the episode's resident (typically -20…+30; see core/town/friendship.ts). */
  points?: number;
  /** Facts this choice teaches (e.g. 'you:declined-dinner'). */
  learn?: FactId[];
}

/** id = `<lineId>-v1|v2…` (stable). */
export interface StoryVariant {
  id: string;
  if: FactId;
  text: string;
  vi: string;
  say?: string;
}

/**
 * Something a resident (or the town) now knows, or something the learner learned about a resident. Ids:
 * `<placeId>:<slug>` (about that resident, e.g. 'home:loves-roses') or `you:<slug>` (about the learner, e.g.
 * 'you:iced-latte'). Facts are never forgotten (synced, union-merged).
 */
export type FactId = string;

export interface StoryFact {
  id: FactId;
  /** Vietnamese line for the Sổ tay (journal), e.g. "Bà Grace mê hoa hồng". */
  vi: string;
  /** A gift this fact reveals as loved/liked by the resident (shown in the journal once learned). */
  gift?: { id: string; taste: 'loves' | 'likes' | 'dislikes' };
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
  /**
   * Where the talk happens, matching `scene` and the lines (owner: a café talk must happen in the café). Optional only
   * while the data is being filled in; tests require it for every episode. It may name only the episode's own place,
   * one of the three places that stand from the start (square, cafe, friend) or 'inn'.
   */
  setting?: StorySetting;
  /**
   * Where the same talk happens while the resident still lodges at the boarding house (their place not built yet).
   * Only episode 1 can be heard then (episode 2 needs the house: episodes.ts needsHome), so only an episode 1 whose
   * `setting` needs its own unbuilt place has one: usually `{ kind: 'inside', room: 'inn' }` (the boarding house's
   * common room) or `{ kind: 'outside', at: 'square' }` (the plaza). It never needs a place that may be unbuilt, and
   * `scene` is written to be true in both settings. Resolve with `episodeSetting` (data/townStories.ts).
   */
  lodgerSetting?: StorySetting;
  /** Unlock conditions beyond the order (episode n needs n−1 finished): friendship hearts (0–10) and/or facts. */
  requires?: { hearts?: number; facts?: FactId[] };
  /** Facts learned by finishing the episode (in addition to choices' facts). */
  learn?: FactId[];
}

/** A resident's whole relationship content beyond episodes 1–2 (data/stories/<placeId>.ts). */
export interface ResidentArc {
  placeId: string;
  /** Episodes 3, 4, … of this resident (same shape as StoryEpisode; `requires.hearts` rising). */
  episodes: StoryEpisode[];
  /** Every fact this resident's content teaches or tests (ids must be unique town-wide). */
  facts: StoryFact[];
  /** What they think of each gift (ids of data/townGifts.ts); anything not listed is 'neutral'. */
  taste: { loves: string[]; likes: string[]; dislikes: string[] };
  /** Voiced reactions when given a gift (who = 'them'); ids `<placeId>-gift-<taste>`. */
  reactions: { loves: StoryLine; likes: StoryLine; neutral: StoryLine; dislikes: StoryLine };
  /**
   * Short voiced greetings when the learner walks up (who = 'them'); ids `<placeId>-hi-<nn>`. `tier`: from which
   * friendship level (0 stranger, 3 friend, 7 close); `if`: only when a fact is known (memory callbacks, e.g. "So, how
   * was the movie?"). The stage picks the best matching one, never the same twice in a row.
   */
  greetings: (StoryLine & { tier: 0 | 3 | 7; if?: FactId })[];
}

/**
 * Where a conversation happens:
 * - 'inside': in a room (three/interiors): `room` is a place id (that place's room: Leo's community room, the café,
 *   Mia's and Grace's living rooms, the shop, the office, the classroom, the station's waiting area, the clinic's
 *   reception, the cinema's lobby, the phone shop, the park pavilion, the community hall with the notice board) or
 *   'inn' (the boarding house's common room, where lodgers live);
 * - 'outside': in the town, in front of / beside `at` (a place id: its door, terrace or yard), e.g. Mia leaning out of
 *   her window, the bus stop, the park; the stage walks both people there.
 * A setting that names a place needs that place built; the stage can never enter or stand at an unbuilt one.
 */
export type StorySetting = { kind: 'inside'; room: string } | { kind: 'outside'; at: string };
