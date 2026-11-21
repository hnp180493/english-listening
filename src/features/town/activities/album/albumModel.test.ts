import { describe, expect, it } from 'vitest';
import { TOWN_PROJECTS } from '../../../../data/townGame';
import type { TownCelebration } from '../../../../core/town/store';
import { lockedTitleCount } from '../wardrobe/wardrobeModel';
import { albumOrder, celebrationMs, celebrationView, DECORATION_NAME, DECORATION_WHERE, progressText } from './albumModel';

describe('album words', () => {
  it('names what every project adds and where', () => {
    for (const p of TOWN_PROJECTS) {
      expect(DECORATION_NAME[p.decoration], p.id).toBeTruthy();
      expect(DECORATION_WHERE[p.decoration], p.id).toBeTruthy();
    }
  });

  it('writes progress with its unit, never past the target', () => {
    expect(progressText({ value: 37, target: 100 }, 'lines')).toBe('37 / 100 câu');
    expect(progressText({ value: 120, target: 100 }, 'fish')).toBe('100 / 100 con cá');
  });

  it('lists the unlocked first (newest on top), then the closest to done', () => {
    const list = [
      { id: 'a', unlockedAt: null, progress: 0.2 },
      { id: 'b', unlockedAt: 100, progress: 1 },
      { id: 'c', unlockedAt: null, progress: 0.9 },
      { id: 'd', unlockedAt: 300, progress: 1 },
      { id: 'e', unlockedAt: null, progress: 0.2 },
    ];
    expect(albumOrder(list).map((x) => x.id)).toEqual(['d', 'b', 'c', 'a', 'e']);
  });

  it('says what a project adds to the town when it is celebrated', () => {
    const c: TownCelebration = { key: 'project:du-an-den-ho', kind: 'project', id: 'du-an-den-ho', label: 'Dự án xong: Thắp đèn quanh hồ', detail: 'Danh hiệu “Người thắp đèn”' };
    const v = celebrationView(c);
    expect(v.title).toBe(c.label);
    expect(v.lines[0]).toBe(c.detail);
    expect(v.lines.join(' ')).toMatch(/đèn hoa sen/);
    expect(celebrationMs(v)).toBeGreaterThanOrEqual(3600);
    expect(celebrationMs(v)).toBeLessThanOrEqual(7000);
    const egg = celebrationView({ key: 'egg:farm:2026-11-19', kind: 'egg', id: 'farm:2026-11-19', label: 'Được tặng một quả trứng', detail: 'Thu hoạch sạch nông trại' });
    expect(egg.lines.join(' ')).toMatch(/Tiệm trứng/);
  });

  it('counts the titles still to earn outside the egg shop', () => {
    const all = lockedTitleCount([]);
    expect(all).toBeGreaterThan(30);
    expect(lockedTitleCount([{ from: 'level' }, { from: 'achievement' }, { from: 'egg' }])).toBe(all - 2);
  });
});
