// The lines of "Chuyện ở thị trấn" as the town's own lines (TownLine), a lookup by line id, and the lines of an
// episode as they are said NOW (a choice line as the option chosen, a line with variants as the variant the learner's
// facts call for: docs/town.md §12). A leaf: only the content and types, so ./economy (xp), the review layer (card
// kind 'talk') and ./episodes can all use it without an import cycle.
//
// Every option of a choice and every variant is a line of its own (its own id, text, voice and review card
// `talk:<id>`): it says something else, so it is heard and learned on its own.

import { storiesOfPlace, TOWN_STORIES } from '../../data/townStories';
import type { FactId, StoryEpisode, StoryLine } from './story';
import type { TownLine } from './types';

/**
 * A story line a learner can hear: a line of an episode, one option of a choice line, or one variant. `base` is the
 * id of the episode's own line it stands for (its own id for a plain line); `who` is always the base line's speaker.
 */
export interface SaidLine extends Pick<StoryLine, 'id' | 'who' | 'text' | 'vi' | 'say'> {
  base: string;
}

/**
 * A story line as a TownLine: recorded, paid and counted like any line of the town. The level is the episode's.
 * No `sentenceId`: it is not a dictation sentence (a miss enrols its own review card, `talk:<line id>`).
 */
export function storyTownLine(line: Pick<StoryLine, 'id' | 'text' | 'vi' | 'say'>, episode: Pick<StoryEpisode, 'level'>): TownLine {
  const out: TownLine = { id: line.id, text: line.text, vi: line.vi, level: episode.level };
  if (line.say) out.say = line.say;
  return out;
}

/** Every line that can be said for `line`: the line itself (or, for a choice line, each option), then its variants. */
export function lineForms(line: StoryLine): SaidLine[] {
  const out: SaidLine[] = [];
  const said = (l: Pick<StoryLine, 'id' | 'text' | 'vi' | 'say'>): SaidLine => {
    const s: SaidLine = { id: l.id, who: line.who, text: l.text, vi: l.vi, base: line.id };
    if (l.say) s.say = l.say;
    return s;
  };
  if (line.choices?.length) for (const c of line.choices) out.push(said(c));
  else out.push(said(line));
  for (const v of line.variants ?? []) out.push(said(v));
  return out.filter((l) => l.text.trim().length > 0);
}

const byEpisode = new WeakMap<StoryEpisode, readonly TownLine[]>();

/** Every line of an episode that can be said (options and variants included) as TownLines, in order (stable identity). */
export function episodeTownLines(episode: StoryEpisode): readonly TownLine[] {
  let lines = byEpisode.get(episode);
  if (!lines) {
    lines = episode.lines.flatMap((l) => lineForms(l).map((f) => storyTownLine(f, episode)));
    byEpisode.set(episode, lines);
  }
  return lines;
}

/** Every line of every episode of a place (the pool the wrong meanings are drawn from). */
export function placeStoryLines(placeId: string): TownLine[] {
  return storiesOfPlace(placeId).flatMap((e) => episodeTownLines(e));
}

let all: readonly TownLine[] | null = null;
let index: Map<string, { line: SaidLine; episode: StoryEpisode; base: StoryLine }> | null = null;

/** Every story line of the town (options and variants included). */
export function allStoryLines(): readonly TownLine[] {
  all ??= TOWN_STORIES.flatMap((e) => episodeTownLines(e));
  return all;
}

/**
 * A story line and its episode by line id ('cafe-1-03', an option 'cafe-3-04-b', a variant 'cafe-3-02-v1'). `line`
 * is what is said (with the base line's speaker), `base` the episode's own line it stands for.
 */
export function storyLineById(id: string): { line: SaidLine; episode: StoryEpisode; base: StoryLine } | undefined {
  if (!index) {
    index = new Map();
    for (const episode of TOWN_STORIES) {
      for (const base of episode.lines) {
        // the base line too (a choice line's own id: an older card, or option 0 under its own id)
        if (base.text.trim()) index.set(base.id, { line: { id: base.id, who: base.who, text: base.text, vi: base.vi, base: base.id, ...(base.say ? { say: base.say } : {}) }, episode, base });
        for (const line of lineForms(base)) index.set(line.id, { line, episode, base });
      }
    }
  }
  return index.get(id);
}

// ───────────────────────── what is said now ─────────────────────────

/** A line of an episode as said now: what `resolveLine` picked, and for a choice line its options. */
export interface ResolvedLine extends SaidLine {
  /** A choice line: its options (the one said is `id`); `chosen` = the option the learner picked before, if any. */
  choice?: { options: NonNullable<StoryLine['choices']>; chosen: string | null };
}

/**
 * How `line` is said now. A choice line: the option the learner chose before (`chosen[line.id]`), else its first
 * option (the default the whole listen plays before the learner has chosen). A line with variants: the first variant
 * whose fact is known (order = priority), else the line itself.
 */
export function resolveLine(line: StoryLine, known: (fact: FactId) => boolean, chosen: (lineId: string) => string | null): ResolvedLine {
  const base = { who: line.who, base: line.id };
  if (line.choices?.length) {
    const picked = chosen(line.id);
    const opt = line.choices.find((c) => c.id === picked) ?? line.choices[0];
    const out: ResolvedLine = { ...base, id: opt.id, text: opt.text, vi: opt.vi, choice: { options: line.choices, chosen: picked && line.choices.some((c) => c.id === picked) ? picked : null } };
    if (opt.say) out.say = opt.say;
    return out;
  }
  const v = (line.variants ?? []).find((x) => x.text.trim() && known(x.if));
  const src = v ?? line;
  const out: ResolvedLine = { ...base, id: src.id, text: src.text, vi: src.vi };
  if (src.say) out.say = src.say;
  return out;
}

/** Every line of an episode as said now (see resolveLine). */
export function resolveEpisode(episode: StoryEpisode, known: (fact: FactId) => boolean, chosen: (lineId: string) => string | null): ResolvedLine[] {
  return episode.lines.map((l) => resolveLine(l, known, chosen));
}
