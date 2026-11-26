// "Cảnh nghe" (docs/town.md §19, 2026-11-25): something HEARD in the world, not a talk the learner is part of. The
// learner sits on a bench and overhears two residents, stands by the café's radio, or goes to this evening's get-
// together; the whole scene plays as sound only, then one or two questions, then the words. Content: data/scenes/.
//
// The speakers are residents by place id (their own Gemini voices, core/town/voices.ts) or a voice of SCENE_VOICES
// (people who are only heard, in the browser's voice: the radio's presenter).

/**
 * The learner's own lines in a talk they began (owner, 2026-11-26: "tao chủ động nói chuyện, sao thành ra lại là
 * nghe lén rồi?"): shown with their meaning, said when the learner presses "Nói", in the browser's voice of their
 * character's sex; never a question's answer.
 */
export const YOU = 'you';

/** One line of a scene. */
export interface SceneLine {
  /** Who says it: a place id (its resident) or a key of SCENE_VOICES. */
  who: string;
  /** What is said, as written (3–16 words). */
  text: string;
  /** Its meaning in Vietnamese. */
  vi: string;
  /** How it sounds said naturally, when the decoder's own version would be wrong (rare; see docs/courses.md). */
  say?: string;
}

/** A question about a scene: three Vietnamese answers, one right. */
export interface SceneQuestion {
  /** The question, in Vietnamese. */
  q: string;
  options: readonly [string, string, string];
  /** The right option (0–2). */
  answer: number;
}

export type SceneKind = 'overheard' | 'radio' | 'event' | 'ride';

/** Rain or shine (core/town/world.ts weatherOf): a radio forecast is only read on a day it is true of. */
export type Weather = 'clear' | 'cloudy' | 'rain';

export interface ListenScene {
  /** `oh-<n>` (overheard), `fm-<n>` (radio), `ev-<event>-<n>` (a get-together), `co-<n>` (overheard in the city), `rd-<n>` (on bus no. 9). */
  id: string;
  kind: SceneKind;
  /** A short Vietnamese title, shown only after the scene is heard (never gives the answer away before). */
  title: string;
  /** One Vietnamese line before listening: where the learner is and who is talking, never what about. */
  scene: string;
  /** 1 easy … 3 hard (speed of the exchange, how much is reduced). */
  level: 1 | 2 | 3;
  lines: readonly SceneLine[];
  /** What it was about (the gist). */
  gist: SceneQuestion;
  /** A detail that was said (a number, a time, a reason, who): radio segments and get-togethers. */
  detail?: SceneQuestion;
  /** A radio segment read only in this weather. */
  weather?: Weather;
  /** A radio segment read only on this weekday (0 Sunday … 6 Saturday). */
  weekday?: number;
  /** The get-together this belongs to (core/town/world.ts TOWN_EVENTS). */
  event?: string;
  /** A ride on bus no. 9: which way it goes (to the city, or back to the town). */
  to?: 'city' | 'town';
}

/** Somebody only heard: a name for the tag, and the sex of the browser voice that reads them. */
export interface SceneVoice {
  name: string;
  gender: 'male' | 'female';
}

/**
 * The people who are heard and never met in the town (yet): they speak in the browser's voice and have no shipped
 * clips (owner, 2026-11-25: "nhân vật mới có thể xài giọng trình duyệt"). Marcus is the presenter of Bay FM, the
 * city's radio; he will be met in the city (docs/city-proposal.md).
 */
export const SCENE_VOICES: Readonly<Record<string, SceneVoice>> = {
  marcus: { name: 'Marcus · Bay FM', gender: 'male' },
  // Westbay (docs/city.md): heard, never met
  dot: { name: 'Dot', gender: 'female' },
  tannoy: { name: 'Loa phóng thanh', gender: 'female' },
  bus9: { name: 'Loa xe buýt', gender: 'female' },
  rider1: { name: 'Hành khách', gender: 'male' },
  rider2: { name: 'Hành khách', gender: 'female' },
  // the main story (data/city/seasonsMain.ts): the man with the briefcase, his inspector, the real council
  crane: { name: 'Ông Crane', gender: 'male' },
  hale: { name: 'Thanh tra Hale', gender: 'male' },
  officer: { name: 'Bà Ward · Hội đồng', gender: 'female' },
  // its second part (data/city/seasonsMain2.ts): the woman behind Crane, who only ever rings
  vane: { name: 'Bà Vane', gender: 'female' },
  // Act I of the story (docs/gta-story.md §2): the owner of Bayline, new, met in the jobs (data/city/jobs/)
  kemp: { name: 'Duncan Kemp', gender: 'male' },
};
