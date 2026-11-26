import { describe, expect, it } from 'vitest';
import type { CityScene, CitySeason } from '../../core/town/cityTypes';
import type { PlaceView } from '../../core/town/overview';
import type { ShiftDef } from '../../core/town/shiftTypes';
import { cityQuests, followed, taxiQuest, townQuests } from './quests';

const view = (id: string, resident: string, episode: { order: number; title: string; mode?: string } | null, built = true): PlaceView =>
  ({ place: { id, resident, name: `nhà ${resident}` }, built, episode }) as unknown as PlaceView;

describe('the town as quests', () => {
  const places = [view('cafe', 'Emma', { order: 2, title: 'B' }), view('square', 'Leo', { order: 1, title: 'A' }), view('home', 'Grace', { order: 1, title: 'C', mode: 'relisten' }, false), view('shop', 'Ben', null)];

  it('the suggested one first, then a re-listen due, then the lowest episode; nobody without an episode', () => {
    const q = townQuests(places, 'cafe');
    expect(q.map((x) => x.id)).toEqual(['town:cafe:2', 'town:home:1', 'town:square:1']);
    expect(q[0]).toMatchObject({ tag: 'Truyện', title: 'Emma · Tập 2: B', step: 'Tới chỗ Emma ở nhà Emma', target: { kind: 'resident', id: 'cafe' } });
    expect(q[1]).toMatchObject({ tag: 'Nghe lại', step: 'Tới chỗ Grace ở nhà trọ' });
  });

  it("the day's games come after the suggested episode; an order in hand never names who it is for", () => {
    const q = townQuests(places, 'cafe', null, { cafe: true, carrying: true, deliveries: 2, caseToday: { title: 'Ai lấy xu?', n: 3 } });
    expect(q.map((x) => x.id)).toEqual(['town:cafe:2', 'job:carry', 'job:cafe', 'job:case', 'town:home:1', 'town:square:1']);
    expect(q[1]).toMatchObject({ title: 'Giao đơn của Emma', target: null });
    expect(q[3].title).toBe('Ai lấy xu? · Kỳ 3');
    const none = townQuests(places, 'cafe', null, { cafe: false, carrying: false, deliveries: 2, caseToday: null });
    expect(none.map((x) => x.id)).toContain('job:delivery');
    expect(none.find((x) => x.id === 'job:delivery')?.target).toEqual({ kind: 'place', id: 'cafe' });
  });

  it('follows the one picked while it is there, else the first', () => {
    const q = townQuests(places, null);
    expect(followed(q, 'town:square:1')?.id).toBe('town:square:1');
    expect(followed(q, 'town:square:9')?.id).toBe(q[0].id);
    expect(followed([], null)).toBeNull();
  });
});

describe('the city as quests', () => {
  const scene = (id: string, at: string, kind: CityScene['kind'], n: number, where?: 'town') => ({ id, at, kind, n, ...(where ? { where } : {}) }) as unknown as CityScene;
  const names: Record<string, string> = { nora: 'Nora', rico: 'Rico', frank: 'Frank', square: 'Leo' };
  const q = cityQuests({
    suggested: scene('ct-rico-1', 'rico', 'episode', 1),
    chapters: [
      { season: { id: 'home', title: 'Về hay ở' } as CitySeason, chapter: scene('cs-home-2', 'nora', 'chapter', 2) },
      { season: { id: 'shop', title: 'Tiệm' } as CitySeason, chapter: scene('cs-shop-1', 'square', 'chapter', 1, 'town') },
    ],
    open: [
      { at: 'frank', scene: scene('cc-frank-1', 'frank', 'chat', 1), again: false },
      { at: 'rico', scene: scene('ct-rico-1', 'rico', 'episode', 1), again: false },
    ],
    events: [{ event: { id: 'quiz', name: 'Đố vui', host: 'frank' } as never, done: false }, { event: { id: 'old', name: 'Cũ', host: 'nora' } as never, done: true }],
    shifts: [{ id: 'taxi', name: 'Tổng đài taxi của Rico', at: 'rico' } as ShiftDef],
    nameOf: (id) => names[id] ?? id,
  });

  it('long stories first, then the suggested, events not done yet, everybody else, shifts last; no repeats', () => {
    expect(q.map((x) => x.id)).toEqual(['season:home:2', 'season:shop:1', 'scene:ct-rico-1', 'event:quiz', 'scene:cc-frank-1', 'shift:taxi']);
  });

  it('a chapter told in the town has nowhere in the city to walk to', () => {
    expect(q[1]).toMatchObject({ target: null, step: 'Ở thị trấn, chỗ Leo: về bằng xe số 9' });
    expect(q[0].target).toEqual({ kind: 'resident', id: 'nora' });
  });

  it('never names a city scene by its title (the answers)', () => {
    expect(q[2].title).toBe('Nghe chuyện của Rico · Tập 1');
    expect(q[4].title).toBe('Nói chuyện với Frank');
  });
});

describe("Rico's taxi as a quest", () => {
  it('a passenger in the car: where to, with the place to drive to; else the job, with nowhere to walk', () => {
    expect(taxiQuest({ to: 'osei', name: 'Bệnh viện Westbay' })).toMatchObject({ id: 'taxi:ride', title: 'Chở khách tới Bệnh viện Westbay', target: { kind: 'resident', id: 'osei' } });
    expect(taxiQuest(null)).toMatchObject({ id: 'taxi:fare', title: 'Chạy taxi cho Rico', target: null });
  });
});
