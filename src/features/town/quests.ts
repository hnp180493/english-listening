// What there is to do, as quests to follow (owner, 2026-11-26: "hướng dẫn làm nhiệm vụ như GTA"): the one followed
// shows in a card at the top of the stage with how far it is, the stage draws its way on the ground and an arrow to
// it (StageProps.guide); the card opens the list of all of them. Pure: the town's from its overview, the city's from
// its scenes, long stories, get-togethers and shifts. Titles never give a city scene's answers away (a city scene's
// title shows only once it is heard: core/town/cityTypes.ts).

import type { CityEvent, CityScene, CitySeason } from '../../core/town/cityTypes';
import type { PlaceView } from '../../core/town/overview';
import type { ShiftDef } from '../../core/town/shiftTypes';
import { tl, tr } from '../../i18n';
import type { PlaceId } from '../../data/townWorld';
import type { TravelTarget } from './engine/stage';

export interface Quest {
  /** Stable while it is the same thing to do (the followed one is kept by it). */
  id: string;
  /** What kind of thing it is, one or two words ("Truyện", "Nghe lại", "Truyện dài", "Ca làm", "Sự kiện"). */
  tag: string;
  /** What to do, short. */
  title: string;
  /** Where, or the step: one line. */
  step: string;
  /** Where the stage guides to; null = nothing to walk to (it happens elsewhere). */
  target: TravelTarget | null;
  /** Seconds to get there in (a main story chapter: the card counts down; late only starts the clock again). */
  rush?: number;
}

/**
 * The town's quests: every resident with an episode waiting (a re-listen that is due first, then the lowest episode
 * number), the suggested one (the main button's) at the top.
 */
export function townQuests(places: readonly PlaceView[], suggested: string | null, story: { id: string; at: string; title: string; n: number; main: boolean } | null = null): Quest[] {
  const out: (Quest & { rank: number })[] = [];
  // a chapter of a long story of Westbay told here today (the main story's first of all)
  if (story) {
    const who = places.find((p) => p.place.id === story.at)?.place.resident ?? '';
    out.push({
      id: `season:${story.id}`,
      tag: story.main ? tr('Truyện chính') : tr('Truyện dài'),
      title: tl`${story.title} · Chương ${story.n}`,
      step: tl`Tới chỗ ${who}`,
      target: { kind: 'resident', id: story.at as PlaceId },
      rank: story.main ? -2 : -1,
    });
  }
  for (const p of places) {
    const e = p.episode;
    if (!e) continue;
    const who = p.place.resident;
    const where = p.built ? p.place.name : tr('nhà trọ');
    const relisten = e.mode === 'relisten';
    out.push({
      id: `town:${p.place.id}:${e.order}`,
      tag: relisten ? tr('Nghe lại') : tr('Truyện'),
      title: relisten ? tl`Nghe lại chuyện với ${who}` : tl`${who} · Tập ${e.order}: ${e.title}`,
      step: tl`Tới chỗ ${who} ở ${where}`,
      target: { kind: 'resident', id: p.place.id as PlaceId },
      rank: (p.place.id === suggested ? 0 : relisten ? 1 : 2) * 100 + e.order,
    });
  }
  return out.sort((a, b) => a.rank - b.rank).map(({ rank: _rank, ...q }) => q);
}

export interface CityQuestInput {
  /** The scene the main button offers (core/town/city nextToMeet). */
  suggested: CityScene | null;
  /** Today's chapters of the long stories under way. */
  chapters: readonly { season: CitySeason; chapter: CityScene }[];
  /** Everybody with a scene open now, and theirs (sceneNow 'new' / 'again'). */
  open: readonly { at: string; scene: CityScene; again: boolean }[];
  events: readonly { event: CityEvent; done: boolean }[];
  /** The shifts open to the learner (met their person). */
  shifts: readonly ShiftDef[];
  nameOf: (id: string) => string;
}

/**
 * The city's quests: today's chapters of the long stories first (one a day, they wait), then the suggested scene,
 * today's get-togethers, everybody else with a scene open, the shifts last (they are there every day).
 */
export function cityQuests(o: CityQuestInput): Quest[] {
  const out: Quest[] = [];
  const seen = new Set<string>();
  const add = (q: Quest) => {
    if (seen.has(q.id)) return;
    seen.add(q.id);
    out.push(q);
  };
  for (const { season, chapter } of o.chapters) {
    const inTown = chapter.where === 'town';
    add({
      id: `season:${season.id}:${chapter.n}`,
      tag: season.free ? tr('Truyện chính') : tr('Truyện dài'),
      ...(chapter.rush && !inTown ? { rush: chapter.rush } : {}),
      title: tl`${season.title} · Chương ${chapter.n}`,
      step: inTown ? tl`Ở thị trấn, chỗ ${o.nameOf(chapter.at)}: về bằng xe số 9` : tl`Tới chỗ ${o.nameOf(chapter.at)}`,
      target: inTown ? null : { kind: 'resident', id: chapter.at as PlaceId },
    });
  }
  const scene = (at: string, s: CityScene, again: boolean): Quest => ({
    id: `scene:${s.id}`,
    tag: again ? tr('Nghe lại') : s.kind === 'episode' ? tr('Truyện') : tr('Làm quen'),
    title: again ? tl`Nghe lại với ${o.nameOf(at)}` : s.kind === 'episode' ? tl`Nghe chuyện của ${o.nameOf(at)} · Tập ${s.n}` : tl`Nói chuyện với ${o.nameOf(at)}`,
    step: tl`Tới chỗ ${o.nameOf(at)}`,
    target: { kind: 'resident', id: at as PlaceId },
  });
  if (o.suggested) add(scene(o.suggested.at, o.suggested, false));
  for (const { event, done } of o.events) {
    if (done) continue;
    add({ id: `event:${event.id}`, tag: tr('Sự kiện'), title: event.name, step: tl`Tới chỗ ${o.nameOf(event.host)}`, target: { kind: 'resident', id: event.host as PlaceId } });
  }
  const rank = (x: { scene: CityScene; again: boolean }) => (x.again ? 3 : x.scene.kind === 'episode' ? 0 : 1);
  for (const x of [...o.open].sort((a, b) => rank(a) - rank(b) || a.scene.n - b.scene.n)) add(scene(x.at, x.scene, x.again));
  for (const s of o.shifts) add({ id: `shift:${s.id}`, tag: tr('Ca làm'), title: s.name, step: tl`Tới chỗ ${o.nameOf(s.at)}`, target: { kind: 'resident', id: s.at as PlaceId } });
  return out;
}

/** The quest followed: the one picked if it is still there, else the first. */
export function followed(quests: readonly Quest[], picked: string | null): Quest | null {
  return (picked ? quests.find((q) => q.id === picked) : undefined) ?? quests[0] ?? null;
}
