import { describe, expect, it } from 'vitest';
import { eggOdds } from '../../../../core/town/eggs';
import { lootItem } from '../../../../data/townGame';
import { eggAction, grantCounts, hatchLabel, hatchPhase, HATCH_SHOW, HATCH_SHOW_STILL, oddsRows, percent, pityText, revealText } from './eggModel';

describe('egg shop words', () => {
  it('offers one main action: open an egg first, else buy one, else nothing', () => {
    expect(eggAction({ inHand: 2, canBuy: true })).toBe('hatch');
    expect(eggAction({ inHand: 1, canBuy: false })).toBe('hatch');
    expect(eggAction({ inHand: 0, canBuy: true })).toBe('buy');
    expect(eggAction({ inHand: 0, canBuy: false })).toBe('none');
  });

  it('says the pity count honestly', () => {
    expect(pityText(1)).toMatch(/Quả tiếp theo chắc chắn/);
    expect(pityText(4)).toBe('Còn 4 quả nữa là chắc chắn có một món Quý trở lên.');
  });

  it('writes shares the Vietnamese way and never rounds a real chance to 0', () => {
    expect(percent(0.6)).toBe('60%');
    expect(percent(0.025)).toBe('2,5%');
    expect(percent(0.0001)).toBe('< 0,1%');
    expect(percent(0)).toBe('0%');
  });

  it('lists the odds of every tier, adding up to 100%, with what a duplicate gives', () => {
    const rows = oddsRows(eggOdds());
    expect(rows.map((r) => r.name)).toEqual(['Thường', 'Hiếm', 'Quý', 'Huyền thoại']);
    expect(rows.map((r) => r.share)).toEqual(['60%', '28%', '9%', '3%']);
    expect(rows.every((r) => r.dupXu > 0 && r.dupXu < 40)).toBe(true);
  });

  it('counts the eggs given by why, most first', () => {
    const c = grantCounts([{ kind: 'farm' }, { kind: 'gist' }, { kind: 'farm' }]);
    expect(c.map((x) => [x.kind, x.count])).toEqual([
      ['farm', 2],
      ['gist', 1],
    ]);
    expect(c[0].label).toMatch(/nông trại/);
  });

  it('tells a new item from a duplicate', () => {
    const hat = lootItem('vuong-mien')!;
    const fresh = revealText({ item: hat, tier: 'huyen-thoai', duplicate: false, xu: 0, pity: false });
    expect(fresh.badge).toBe('Mới!');
    expect(fresh.kindLine).toBe('Mũ · Huyền thoại');
    expect(fresh.big).toBe(true);
    const dup = revealText({ item: lootItem('vit')!, tier: 'thuong', duplicate: true, xu: 4, pity: false });
    expect(dup.badge).toBe('Đã có');
    expect(dup.note).toMatch(/4 xu/);
    expect(dup.big).toBe(false);
    expect(hatchLabel(1)).toBe('Ấp trứng');
    expect(hatchLabel(3)).toBe('Ấp trứng (còn 3 quả)');
  });

  it('runs the hatching show in order, and straight to the item under reduced motion', () => {
    expect(hatchPhase(0)).toBe('wobble');
    expect(hatchPhase(HATCH_SHOW.crack)).toBe('crack');
    expect(hatchPhase(HATCH_SHOW.burst)).toBe('burst');
    expect(hatchPhase(HATCH_SHOW.reveal)).toBe('reveal');
    expect(hatchPhase(0, true)).toBe('wobble');
    expect(hatchPhase(HATCH_SHOW_STILL, true)).toBe('reveal');
  });
});
