import { describe, expect, it } from 'vitest';
import { CITY_HOURS, hourLabel, openAt, opensAt, shutAt } from './hours';
import { cityPlace } from '../cityWorld';
import { withHours } from '../../features/town/city/hoursQuest';

describe('Westbay\'s opening hours (docs/town.md §33)', () => {
  it('are of real places, each open at least eight hours and shut at most sixteen', () => {
    for (const [id, h] of Object.entries(CITY_HOURS)) {
      expect(cityPlace(id), id).toBeDefined();
      let open = 0;
      for (let t = 0; t < 24; t += 0.25) if (openAt(id, t)) open += 0.25;
      expect(open, id).toBeGreaterThanOrEqual(8);
      expect(24 - open, id).toBeLessThanOrEqual(16);
      expect(openAt(id, h.open), id).toBe(true);
      expect(openAt(id, h.close), id).toBe(false);
    }
  });

  it('the night market opens at dusk and runs past midnight; the offices close in the evening', () => {
    expect(openAt('mei', 12)).toBe(false);
    expect(openAt('mei', 18)).toBe(true);
    expect(openAt('mei', 1.5)).toBe(true);
    expect(openAt('mei', 2)).toBe(false);
    expect(openAt('priya', 10)).toBe(true);
    expect(openAt('priya', 22)).toBe(false);
    // a place without hours is always open
    expect(openAt('rico', 3)).toBe(true);
    expect(opensAt('rico', 3)).toBeNull();
  });

  it('says when a shut place opens, and which places are shut', () => {
    expect(opensAt('mei', 12)).toBe(17);
    expect(opensAt('mei', 20)).toBeNull();
    expect(hourLabel(17)).toBe('17:00');
    expect(hourLabel(5)).toBe('05:00');
    expect(shutAt(12)).toEqual(expect.arrayContaining(['mei', 'sol']));
    expect(shutAt(12)).not.toContain('priya');
    expect(shutAt(23)).toEqual(expect.arrayContaining(['priya', 'vivian', 'colin', 'finch', 'hal']));
  });

  it('a quest card to somebody shut says when they open; the admin sandbox ignores the hours', () => {
    const q = { id: 'x', tag: 't', title: 'Mei', step: 'Tới sạp Mei', target: { kind: 'resident' as const, id: 'mei' as never } };
    expect(withHours([q], 12, false)[0].step).toContain('17:00');
    expect(withHours([q], 20, false)[0].step).toBe('Tới sạp Mei');
    expect(withHours([q], 12, true)[0].step).toBe('Tới sạp Mei');
  });
});
