// The shapes of "Hẹn hò, cưới, con" (docs/town.md §15): who can be courted, the text scenes of a courtship, the
// married life and the children. Text dialogue only (owner, 2026-11-22: "không nhất thiết là cứ phải dùng hội thoại
// gemini, nhiều cái cứ trò chuyện bình thường là được"): every English line shows with its Vietnamese meaning and its ▶
// speaks it with the browser voice (no shipped clip, no paid request).

/** The learner's character (the creator, docs/town.md §15): who they court follows from it. */
export type PlayerGender = 'male' | 'female';

/**
 * One line of a text scene. 'them': the one courted (or the spouse); 'you': the learner's character; 'kid': a child of
 * the two; 'narr': narration (Vietnamese only, no `en`). `{name}` in a line is the learner's character's name,
 * `{kid}` the child's name.
 */
export interface ChatLine {
  who: 'them' | 'you' | 'kid' | 'narr';
  /** The English said (absent for narration). Short, everyday, B1 at most. */
  en?: string;
  /** Vietnamese: the meaning of `en`, or the narration itself. */
  vi: string;
}

/** A choice inside a scene: what the learner's character answers. */
export interface ChatChoice {
  /** Index in `lines` after which the choice is asked. */
  after: number;
  /** Vietnamese question shown over the options ("Bạn trả lời sao?"). */
  q: string;
  options: readonly ChatOption[];
}

export interface ChatOption {
  id: string;
  /** The English the learner's character says. */
  en: string;
  vi: string;
  /** Friendship points: a warm answer +10…+20, a clumsy one 0…−10. */
  points: number;
  /** Their answer to this option (1–2 lines), played before the scene goes on. */
  reply: readonly ChatLine[];
}

/** A text scene (a confession, a date, the proposal, a day of married life…). */
export interface RomanceScene {
  /** Stable id `<placeId>-<kind>[-n]`, e.g. 'cafe-date-2'. Never change it. */
  id: string;
  /** Short Vietnamese title ("Hẹn hò lần đầu: dạo công viên"). */
  title: string;
  /** One Vietnamese sentence setting the scene (where, when), shown at the top. */
  scene: string;
  /** 5 to 9 lines. */
  lines: readonly ChatLine[];
  /** At most one choice per scene. */
  choice?: ChatChoice;
}

/** Everything one courtable resident says along the way (data/romance/<placeId>.ts). */
export interface Suitor {
  placeId: string;
  /** Who can court them: the learner's character's gender. */
  courtedBy: PlayerGender;
  /** 8 hearts and a bouquet: the learner says how they feel; they say yes. Starts "đang hẹn hò". */
  confess: RomanceScene;
  /** Three dates, one a day at most, each in a place of the town. */
  dates: readonly [RomanceScene, RomanceScene, RomanceScene];
  /** 10 hearts, the three dates and a ring: the proposal. They say yes. */
  proposal: RomanceScene;
  /** The wedding day at the plaza: their vows (3–5 lines, the learner's lines too). */
  vows: RomanceScene;
  /** Married: one short exchange a day (rotating), 8 of them. */
  daily: readonly RomanceScene[];
}

/** Children: what a child says at each age (data/romance/kids.ts). The child's name is `{kid}`. */
export interface KidLines {
  /** 0–6 days: the baby (narration about the baby; the spouse may speak). 6+ scenes. */
  baby: readonly RomanceScene[];
  /** 7–20 days: a toddler, two- or three-word English. 8+ scenes. */
  toddler: readonly RomanceScene[];
  /** 21+ days: a schoolchild, short simple sentences. 10+ scenes. */
  child: readonly RomanceScene[];
}
