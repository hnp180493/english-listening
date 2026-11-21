import { describe, expect, it } from 'vitest';
import { townOverview, type PlaceView } from '../../../core/town/overview';
import { emptyTownProgress } from '../../../core/town/progress';
import { worldPlace } from '../../../data/townWorld';
import type { MapResident } from '../engine/stage';
import { badgeLegend, cardFor, mainMode, mapBadges, sameTarget, waitingAt, WARP_FAR, whereIs } from './mapCard';

const NOW = new Date(2026, 10, 21, 12).getTime();
const DEVICE = 'd-test0001';
const overview = townOverview({ ...emptyTownProgress(), earned: { [DEVICE]: 25 } }, NOW, DEVICE);
const place = (id: string) => overview.places.find((p) => p.place.id === id)!;
const at = (id: string, x: number, y: number, inside = false): MapResident => ({ id: id as MapResident['id'], x, y, marker: null, inside });

describe('what waits at a place', () => {
  const base: Pick<PlaceView, 'episode' | 'marker' | 'stats' | 'built' | 'homeEpisode'> = {
    episode: null,
    marker: 'new',
    stats: { total: 5, understood: 0, first: 0 } as PlaceView['stats'],
    built: true,
    homeEpisode: null,
  };
  it('names an episode, a re-listen, or the lines', () => {
    expect(waitingAt({ ...base, episode: { id: 'cafe-1', order: 1, title: 'Gọi đồ', mode: 'new' } })).toBe('Tập 1 · Gọi đồ');
    expect(waitingAt({ ...base, episode: { id: 'cafe-1', order: 2, title: 'Gọi đồ', mode: 'relisten' } })).toBe('Nghe lại tập 2 · Gọi đồ');
    expect(waitingAt(base)).toBe('Có câu chưa nghe hiểu');
    expect(waitingAt({ ...base, marker: 'repeat' })).toBe('Đáng nghe lại vài câu');
    expect(waitingAt({ ...base, marker: 'heart' })).toBe('Đã hiểu hết các câu');
    expect(waitingAt({ ...base, stats: { total: 0, understood: 0, first: 0 } as PlaceView['stats'] })).toBeNull();
  });
});

describe('where a resident is, in words', () => {
  const cafe = worldPlace('cafe')!;
  it('in front of their house, indoors, or in a part of town', () => {
    const p = { ...place('cafe'), built: true };
    expect(whereIs(at('cafe', cafe.spot.x + 0.5, cafe.spot.y + 0.5), p)).toBe('đang ở trước nhà');
    expect(whereIs(at('cafe', 3, 3, true), p)).toBe('đang ở trong nhà');
    expect(whereIs(at('cafe', 40.5, 3.5), p)).toBe('đang ở Nông trại');
    expect(whereIs(undefined, p)).toBeNull();
  });
  it('a lodger by the boarding house is at the boarding house', () => {
    const p = { ...place('cinema'), built: false };
    expect(whereIs(at('cinema', 4.5, 33.5), p)).toBe('đang ở nhà trọ');
    expect(whereIs(at('cinema', 4.5, 33.5, true), p)).toBe('đang ở nhà trọ');
  });
});

describe('the card', () => {
  it('a built place: its name, who lives there and what waits', () => {
    const built = overview.places.find((p) => p.built)!;
    const c = cardFor({ kind: 'place', id: built.place.id as 'cafe' }, overview.places, [])!;
    expect(c.title).toBe(built.place.name);
    expect(c.sub).toContain(built.place.resident);
    expect(c.portrait).toBe(built.place.id);
  });
  it('an empty lot: honest about it, with its price', () => {
    const lot = overview.places.find((p) => !p.built)!;
    const c = cardFor({ kind: 'place', id: lot.place.id as 'cafe' }, overview.places, [])!;
    expect(c.sub).toMatch(/^Đất trống · /);
    expect(c.wait).toContain(`${lot.cost} xu`);
  });
  it('a resident: their name and their place', () => {
    const c = cardFor({ kind: 'resident', id: 'cafe' }, overview.places, [at('cafe', 21.5, 21.5)])!;
    expect(c.title).toBe('Emma');
    expect(c.sub).toContain('Quán cà phê');
    expect(c.sub).toContain('đang ở Quảng trường');
  });
  it('an activity and a patch of ground', () => {
    expect(cardFor({ kind: 'activity', id: 'fish' }, overview.places, [])).toMatchObject({ title: 'Câu cá', activity: 'fish' });
    expect(cardFor({ kind: 'tile', x: 24.5, y: 36.5 }, overview.places, [])).toMatchObject({ title: 'Bãi cỏ', sub: 'Đi tới đây' });
  });
});

describe('the main button', () => {
  it('walks to somewhere near and warps to somewhere far', () => {
    const door = worldPlace('cafe')!.door;
    expect(mainMode({ kind: 'place', id: 'cafe' }, { x: door.x + 2, y: door.y + 2 }, [])).toBe('walk');
    expect(mainMode({ kind: 'place', id: 'cafe' }, { x: door.x + WARP_FAR + 3, y: door.y }, [])).toBe('warp');
  });
  it('compares targets', () => {
    expect(sameTarget({ kind: 'place', id: 'cafe' }, { kind: 'place', id: 'cafe' })).toBe(true);
    expect(sameTarget({ kind: 'place', id: 'cafe' }, { kind: 'resident', id: 'cafe' })).toBe(false);
    expect(sameTarget({ kind: 'tile', x: 3.2, y: 4.9 }, { kind: 'tile', x: 3.7, y: 4.1 })).toBe(true);
    expect(sameTarget(null, { kind: 'tile', x: 3, y: 4 })).toBe(false);
  });
});

describe('the badges on the map', () => {
  it('only the suggested resident and the re-listens that are due', () => {
    const marker = { cafe: 'story', shop: 'story', home: 'relisten', friend: 'new', clinic: 'heart', office: 'repeat' } as const;
    expect(mapBadges(marker, 'shop')).toEqual({ shop: 'story', home: 'relisten' });
    expect(mapBadges(marker, 'friend')).toEqual({ friend: 'new', home: 'relisten' });
    // a heart is nothing to go for
    expect(mapBadges(marker, 'clinic')).toEqual({ home: 'relisten' });
    expect(mapBadges(marker, null)).toEqual({ home: 'relisten' });
  });

  it('the legend names what is on the map, the suggested one first', () => {
    expect(badgeLegend({ shop: 'story', home: 'relisten' }, 'shop')).toEqual([
      { marker: 'story', text: 'Nên gặp tiếp' },
      { marker: 'relisten', text: 'Đến hạn nghe lại' },
    ]);
    // the suggested one IS the re-listen: one entry
    expect(badgeLegend({ home: 'relisten' }, 'home')).toEqual([{ marker: 'relisten', text: 'Nên gặp tiếp: đến hạn nghe lại' }]);
    expect(badgeLegend({}, null)).toEqual([]);
  });
});
