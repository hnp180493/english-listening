import { describe, expect, it } from 'vitest';
import { CITY_SEASONS } from '../../data/city/seasons';
import { CITY_EPISODES } from '../../data/city';
import { emptyTownCity, hearScene, seasonNow } from './city';

// The main story (data/city/seasonsMain.ts): a story to play through, not a chapter a real day.
describe('the main story: free', () => {
  const deal = CITY_SEASONS.find((s) => s.id === 'deal')!;
  const other = CITY_SEASONS.find((s) => !s.free)!;
  const now = Date.UTC(2026, 10, 26, 10);
  const hear = (city: ReturnType<typeof emptyTownCity>, id: string, at = now) => {
    const scene = [...CITY_EPISODES, ...deal.chapters, ...other.chapters].find((s) => s.id === id)!;
    return hearScene(city, scene, { right: 1, asked: 1 }, new Set(), at).city;
  };

  it('opens after meeting Rico, and its next chapter the same day', () => {
    let city = emptyTownCity();
    expect(seasonNow(deal, city, now).kind).toBe('locked');
    city = hear(city, 'ct-rico-1');
    expect(seasonNow(deal, city, now)).toMatchObject({ kind: 'open', chapter: { id: 'cs-deal-1' } });
    city = hear(city, 'cs-deal-1');
    expect(seasonNow(deal, city, now + 60_000)).toMatchObject({ kind: 'open', chapter: { id: 'cs-deal-2', rush: 40 } });
  });

  it('its second part waits for the end of the first, then plays through the same way', () => {
    const part2 = CITY_SEASONS.find((s) => s.id === 'bigdeal')!;
    const hear2 = (city: ReturnType<typeof emptyTownCity>, id: string) => hearScene(city, [...deal.chapters, ...part2.chapters].find((s) => s.id === id)!, { right: 1, asked: 1 }, new Set(), now).city;
    expect(CITY_SEASONS.indexOf(part2)).toBe(CITY_SEASONS.indexOf(deal) + 1);
    let city = hear(emptyTownCity(), 'ct-rico-1');
    for (const ch of deal.chapters.slice(0, 5)) city = hear2(city, ch.id);
    expect(seasonNow(part2, city, now)).toMatchObject({ kind: 'locked', needs: 'cs-deal-6' });
    city = hear2(city, 'cs-deal-6');
    expect(seasonNow(part2, city, now + 60_000)).toMatchObject({ kind: 'open', chapter: { id: 'cs-bigdeal-1' } });
    city = hear2(city, 'cs-bigdeal-1');
    expect(seasonNow(part2, city, now + 120_000)).toMatchObject({ kind: 'open', chapter: { id: 'cs-bigdeal-2', rush: 45 } });
    expect(part2.chapters.filter((c) => c.rush).map((c) => c.id)).toEqual(['cs-bigdeal-2', 'cs-bigdeal-5']);
  });

  it('the other long stories still wait for the next day', () => {
    let city = emptyTownCity();
    for (const id of other.needs) city = hear(city, id);
    city = hear(city, other.chapters[0].id);
    expect(seasonNow(other, city, now + 60_000).kind).toBe('tomorrow');
  });
});
