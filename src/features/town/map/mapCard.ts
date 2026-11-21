// The words of the town map (features/town/map): the small card of what was picked (who lives there, what waits),
// which of its two buttons is the main one, and the names the map writes. Pure.

import type { FriendView } from '../../../core/town/friendship';
import type { PlaceView } from '../../../core/town/overview';
import { lockText } from '../friends/friendModel';
import { TOWN_WORLD, type PlaceId, type TownWorld } from '../../../data/townWorld';
import { ACTIVITIES, type ActivityId } from '../activities/types';
import type { MapResident, Marker, TravelTarget } from '../engine/stage';
import { xu } from '../shellModel';
import { districtAt, targetPoint } from './mapGeo';
import type { Pt } from './mapView';

/** Further than this (tile edges) from the player, "Đến ngay" is the card's main button; nearer, "Đi tới". */
export const WARP_FAR = 12;

export interface MapCard {
  title: string;
  /** Who lives or works there, or where they are now. */
  sub: string | null;
  /** What waits there: an episode, new lines, the price of building it. */
  wait: string | null;
  /** A resident's face for the card. */
  portrait: PlaceId | null;
  activity: ActivityId | null;
  /** The resident's friendship (a resident or their built place), for the hearts on the card; null otherwise. */
  friend?: FriendView | null;
}

/**
 * The badges the map and the minimap show (docs/town.md §11): the resident the main button suggests (whatever waits
 * there) and every re-listen that is due, nobody else. Early on nearly everybody has an episode waiting, and a badge
 * on every face said nothing; what waits elsewhere is in the card of whoever is picked (`waitingAt`).
 */
export function mapBadges(marker: Readonly<Record<string, Marker>>, suggested: string | null): Record<string, Marker> {
  const out: Record<string, Marker> = {};
  for (const [id, m] of Object.entries(marker)) {
    if (m === 'relisten' || (id === suggested && m !== 'heart' && m !== 'repeat')) out[id] = m;
  }
  return out;
}

/** The legend line of the map's header: one entry per kind of badge on it, the suggested one first. */
export function badgeLegend(badges: Readonly<Record<string, Marker>>, suggested: string | null): { marker: Marker; text: string }[] {
  const out: { marker: Marker; text: string }[] = [];
  const hint = suggested ? badges[suggested] : undefined;
  if (hint) out.push({ marker: hint, text: hint === 'relisten' ? 'Nên gặp tiếp: đến hạn nghe lại' : 'Nên gặp tiếp' });
  if (Object.entries(badges).some(([id, m]) => m === 'relisten' && id !== suggested)) out.push({ marker: 'relisten', text: 'Đến hạn nghe lại' });
  return out;
}

/**
 * What waits at a place (its resident): an episode to hear, a re-listen that is due, the next episode waiting for
 * friendship ("Tập 3 · Cần 4 tim"), new lines; null for nothing to say.
 */
export function waitingAt(p: Pick<PlaceView, 'episode' | 'marker' | 'stats' | 'built' | 'homeEpisode'> & Partial<Pick<PlaceView, 'friendEpisode' | 'place'>>): string | null {
  if (p.episode) return `${p.episode.mode === 'relisten' ? 'Nghe lại tập' : 'Tập'} ${p.episode.order} · ${p.episode.title}`;
  if (p.friendEpisode) return `Tập ${p.friendEpisode.order} · ${lockText(p.friendEpisode, p.place?.resident ?? '')}`;
  if (p.stats.total === 0) return null;
  if (p.marker === 'new') return 'Có câu chưa nghe hiểu';
  if (p.marker === 'repeat') return 'Đáng nghe lại vài câu';
  return 'Đã hiểu hết các câu';
}

/** Where a resident is now, in words: in their own house, at the boarding house, or in a part of town. */
export function whereIs(r: MapResident | undefined, p: Pick<PlaceView, 'built' | 'place'>, world: TownWorld = TOWN_WORLD): string | null {
  if (!r) return null;
  const wp = world.places.find((q) => q.id === p.place.id);
  if (r.inside) return p.built ? 'đang ở trong nhà' : 'đang ở nhà trọ';
  if (wp && Math.hypot(r.x - wp.spot.x - 0.5, r.y - wp.spot.y - 0.5) < 3) return p.built ? 'đang ở trước nhà' : 'đang ở chỗ đất trống';
  const inn = world.life?.inn.door;
  if (!p.built && inn && Math.hypot(r.x - inn.x - 0.5, r.y - inn.y - 0.5) < 3) return 'đang ở nhà trọ';
  const d = districtAt(r.x, r.y, world);
  return d ? `đang ở ${d.name}` : null;
}

/** The card of something picked on the map. Null when it is not in the town (an unknown id). */
export function cardFor(target: TravelTarget, places: readonly PlaceView[], residents: readonly MapResident[], world: TownWorld = TOWN_WORLD): MapCard | null {
  if (target.kind === 'activity') {
    const a = ACTIVITIES.find((x) => x.id === target.id);
    return a ? { title: a.name, sub: a.blurb, wait: null, portrait: null, activity: a.id } : null;
  }
  if (target.kind === 'tile') {
    const d = districtAt(target.x, target.y, world);
    return { title: d ? d.name : 'Chỗ này', sub: 'Đi tới đây', wait: null, portrait: null, activity: null };
  }
  const p = places.find((q) => q.place.id === target.id);
  if (!p) return null;
  const r = residents.find((x) => x.id === target.id);
  const where = whereIs(r, p, world);
  if (target.kind === 'resident') {
    return { title: p.place.resident, sub: [p.built ? p.place.name : `${p.place.name} (chưa xây)`, where].filter(Boolean).join(' · '), wait: waitingAt(p), portrait: p.place.id as PlaceId, activity: null, friend: p.friend ?? null };
  }
  if (!p.built) {
    const price = p.affordable ? `Xây được ngay · ${xu(p.cost)}` : `Xây · ${xu(p.cost)} · còn thiếu ${xu(p.missing)}`;
    return { title: p.place.name, sub: `Đất trống · ${p.place.resident} ${where ?? 'đang ở nhà trọ'}`, wait: price, portrait: p.place.id as PlaceId, activity: null };
  }
  return { title: p.place.name, sub: [p.place.resident, where].filter(Boolean).join(' '), wait: waitingAt(p), portrait: p.place.id as PlaceId, activity: null, friend: p.friend ?? null };
}

/** The card's main button: "Đến ngay" ('warp') for somewhere far from the player, "Đi tới" ('walk') nearby. */
export function mainMode(target: TravelTarget, player: Pt, residents: readonly MapResident[], world: TownWorld = TOWN_WORLD): 'walk' | 'warp' {
  const at = targetPoint(target, residents, world);
  if (!at) return 'walk';
  return Math.hypot(at.x - player.x, at.y - player.y) > WARP_FAR ? 'warp' : 'walk';
}

/** Two targets are the same thing. */
export function sameTarget(a: TravelTarget | null, b: TravelTarget | null): boolean {
  if (!a || !b || a.kind !== b.kind) return false;
  if (a.kind === 'tile' && b.kind === 'tile') return Math.floor(a.x) === Math.floor(b.x) && Math.floor(a.y) === Math.floor(b.y);
  return (a as { id: string }).id === (b as { id: string }).id;
}

/** The accessible name of the map's button for a resident. */
export function residentLabel(p: Pick<PlaceView, 'place' | 'episode' | 'marker' | 'stats' | 'built' | 'homeEpisode'>, r: MapResident | undefined, world: TownWorld = TOWN_WORLD): string {
  const where = whereIs(r, p, world);
  const wait = waitingAt(p);
  return [p.place.resident + (where ? ` ${where}` : ''), wait].filter(Boolean).join('. ');
}
