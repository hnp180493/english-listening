// Westbay, the city (docs/town.md §20, docs/city.md): its people and what is heard there. The map is
// data/cityWorld.ts, the scenes data/city/, the rules ./city.ts.
//
// A city scene is a "cảnh nghe" grown up (./sceneTypes: sound only, then questions, then the words): longer (an
// episode is 12–18 lines between two or three people), with up to three questions. The people of the city speak in
// the BROWSER's voice (owner, 2026-11-25: "nhân vật mới có thể xài giọng trình duyệt"); a town resident who has come
// up to the city keeps their own Gemini voice (./cityAudio.ts).

import type { SceneLine, SceneQuestion } from './sceneTypes';

export type CityDistrict = 'station' | 'market' | 'arts' | 'office' | 'campus' | 'harbour';

/**
 * Somebody of Westbay. 'main': a building of their own and a story in episodes; 'known': a stall, a booth or a pitch
 * on the pavement and a couple of short talks. Everybody is tied to somebody the learner already knows.
 */
export interface CityPerson {
  /** Also the id of their place on the map (data/cityWorld.ts). */
  id: string;
  name: string;
  gender: 'male' | 'female';
  tier: 'main' | 'known';
  district: CityDistrict;
  /** What they do, in Vietnamese (a few words). */
  role: string;
  /** How they are tied to people the learner knows, in Vietnamese: shown once they have been met. */
  tie: string;
  /** The town residents (place ids) of their story. */
  town: readonly string[];
}

/**
 * 'episode': a part of a main person's story (`ct-<person>-<n>`); 'chat': a short talk with somebody known
 * (`ct-<person>-<n>` too); 'visit': a town resident met in Westbay (`cv-<town place id>-<n>`; the second one only
 * when they came up WITH the learner); 'date' / 'family': an outing with the learner's partner, or with partner and
 * child, hosted by somebody of the city (`cx-<host>-<n>`, data/city/outings.ts; once a day each).
 */
export type CitySceneKind = 'episode' | 'chat' | 'visit' | 'date' | 'family' | 'chapter';

/**
 * Speakers of an outing who are not a fixed person: 'partner' is whoever the learner is going out with or married to
 * (their name and face at run time; their lines must suit anybody), 'kid' the learner's child. Both speak in their
 * own Gemini voice, as in the courtship's scenes (docs/town.md §15; core/town/cityAudio.ts).
 */
export const OUTING_ROLES = ['partner', 'kid'] as const;

export interface CityScene {
  id: string;
  kind: CitySceneKind;
  /** Whose scene it is and where it is played: a city person's id, or (a visit) the town resident's place id. */
  at: string;
  /** 1, 2, 3…: the order for that person. */
  n: number;
  /** A short Vietnamese title, shown only after the scene is heard (it must not give the answers away). */
  title: string;
  /** One Vietnamese line before listening: where the learner is and who is there, never what it is about. */
  scene: string;
  /** 1 easy … 3 hard. */
  level: 1 | 2 | 3;
  /**
   * `who`: a city person's id, a town resident's place id, or a key of SCENE_VOICES (somebody only heard). The
   * learner never speaks: people talk to them and to each other.
   */
  lines: readonly SceneLine[];
  /** The first is the gist; an episode has three (gist, a detail that was said, why / what somebody feels or will do). */
  questions: readonly SceneQuestion[];
  /** Scenes that must have been heard before this one opens (ids). */
  needs?: readonly string[];
  /** A season's chapter that is played in the TOWN, at the place of the town resident `at` (left out: in the city). */
  where?: 'town';
}

/**
 * A "mùa truyện" (docs/town.md §21): one long story that runs through both places, a chapter a real day. Its
 * chapters are scenes of kind 'chapter' (`cs-<season>-<n>`): in the city at somebody's place (`at`: a city person),
 * or in the town (`where: 'town'`, `at`: a town place id).
 */
export interface CitySeason {
  /** A short word: 'manuscript', 'home', 'shop', 'film', 'nights', 'offer'. */
  id: string;
  /** Vietnamese. */
  title: string;
  /** One Vietnamese line: whose story, never how it ends. */
  blurb: string;
  /** Scenes that must have been heard before its first chapter opens. */
  needs: readonly string[];
  chapters: readonly CityScene[];
}

/**
 * A get-together of the city's week or a festival of its year (docs/town.md §21): heard as the town's get-togethers
 * are (a "cảnh nghe" of kind 'event', ids `ce-<event>-<n>`, everybody in the browser's voice).
 */
export interface CityEvent {
  id: string;
  /** Vietnamese. */
  name: string;
  blurb: string;
  /** Whose it is and where: a city person's id. */
  host: string;
  /** The weekday it is on (0 Sunday … 6 Saturday); left out for a festival. */
  weekday?: number;
  /** A festival: the months it is on (1–12), every day of them. */
  months?: readonly number[];
}
