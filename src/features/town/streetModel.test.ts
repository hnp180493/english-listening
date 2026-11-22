import { describe, expect, it } from 'vitest';
import { TOWN_PLACES } from '../../data/town';
import { homeSetting, settingWord, streetTalkView } from './streetModel';

const FREE = new Set(['square', 'cafe', 'friend']);
const places = TOWN_PLACES.map((place) => ({ place, built: FREE.has(place.id) }));
const daniel = TOWN_PLACES.find((p) => p.id === 'school')!;
const emma = TOWN_PLACES.find((p) => p.id === 'cafe')!;
const friend = (hearts: number) => ({ placeId: 'x', points: hearts * 100, hearts, toNext: 100, part: 0, title: '' });
const NOW = new Date(2026, 10, 22, 15).getTime();

describe('met in the street: the page model (docs/town.md §14)', () => {
  it('a lodger is at home at the boarding house; a built place at its own room or front', () => {
    const lodger = homeSetting({ place: daniel, episode: { id: 'school-1', order: 1, title: 'x', mode: 'new' } }, places);
    expect(lodger).toEqual({ kind: 'inside', room: 'inn' });
    expect(settingWord(lodger, places)).toBe('nhà trọ');
    const cafe = homeSetting({ place: emma, episode: null }, places);
    expect(settingWord(cafe, places)).toBe('quán cà phê');
  });

  it('their episode waits at home: they ask you round and the button goes there with them', () => {
    const v = streetTalkView({ place: daniel, episode: { id: 'school-1', order: 1, title: 'Đăng ký lớp tối', mode: 'new' }, friendEpisode: null, friend: friend(0) }, places, () => false, NOW);
    expect(v.scene).toBeTruthy();
    expect(v.invite).toEqual({ text: 'Daniel dặn lúc nào rảnh thì ghé nhà trọ: có chuyện muốn kể với bạn.', go: 'Đi cùng Daniel tới nhà trọ' });
    expect(v.hint).toBeNull();
  });

  it('their next episode needs more friendship: they say how close you must get first', () => {
    const v = streetTalkView({ place: emma, episode: null, friendEpisode: { id: 'cafe-3', order: 3, title: 'x', mode: 'new', hearts: 2, facts: 0 }, friend: friend(1) }, places, () => false, NOW);
    expect(v.invite).toBeNull();
    expect(v.hint).toBe('Thân hơn nữa (cần 2 tim) thì Emma sẽ kể thêm chuyện riêng.');
    // nothing waits and nothing is locked: no parting words
    expect(streetTalkView({ place: emma, episode: null, friendEpisode: null, friend: friend(9) }, places, () => false, NOW).hint).toBeNull();
  });

  it('one meeting reads the same all day; the next one may differ', () => {
    const v = (turn: number, at = NOW) => streetTalkView({ place: emma, episode: null, friendEpisode: null, friend: friend(0) }, places, () => false, at, turn).scene;
    expect(v(1)).toBe(v(1, NOW + 3600_000));
    expect(new Set([v(0), v(1), v(2), v(3)]).size).toBeGreaterThan(1);
  });
});
