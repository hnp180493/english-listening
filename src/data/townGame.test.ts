import { describe, expect, it } from 'vitest';
import { PHENOMENA } from '../core/types';
import { speciesPool } from '../core/town/fishing';
import { goalTarget } from '../core/town/unlocks';
import { TOWN_DECORATIONS, TOWN_PLACES } from './town';
import { ACHIEVEMENTS, EGG_COST, EGG_PITY, FISH_SPECIES, LOOT, LOOT_KINDS, RARITIES, RARITY, TOWN_PROJECTS } from './townGame';
import { TOWN_STORIES } from './townStories';

const ID = /^[a-z][a-z0-9-]{0,39}$/;
const VI = /[ăâđêôơưáàảãạéèẻẽẹíìỉĩịóòỏõọúùủũụýỳỷỹỵ]/i;

describe('data/townGame', () => {
  it('ids are stable-looking, unique across every catalog, and never the id of a place or a decoration', () => {
    const ids = [...FISH_SPECIES.map((f) => f.id), ...LOOT.map((i) => i.id), ...ACHIEVEMENTS.map((a) => a.id), ...TOWN_PROJECTS.map((p) => p.id)];
    for (const id of ids) expect(id).toMatch(ID);
    expect(new Set(ids).size).toBe(ids.length);
    const world = new Set([...TOWN_PLACES.map((p) => p.id), ...TOWN_DECORATIONS.map((d) => d.id), ...TOWN_STORIES.map((e) => e.id)]);
    for (const id of ids) expect(world.has(id)).toBe(false);
    for (const p of TOWN_PROJECTS) expect(world.has(p.decoration)).toBe(false);
    expect(new Set(TOWN_PROJECTS.map((p) => p.decoration)).size).toBe(TOWN_PROJECTS.length);
  });

  it('24 fish in four tiers, every phenomenon in more than one tier, each with a Vietnamese fact and items to say', () => {
    expect(FISH_SPECIES).toHaveLength(24);
    const byTier = Object.fromEntries(RARITIES.map((r) => [r, FISH_SPECIES.filter((f) => f.tier === r).length]));
    expect(byTier).toEqual({ thuong: 8, hiem: 8, quy: 6, 'huyen-thoai': 2 });
    for (const p of PHENOMENA) {
      const tiers = new Set(FISH_SPECIES.filter((f) => f.phenomenon === p).map((f) => f.tier));
      expect(tiers.size, p).toBeGreaterThanOrEqual(2);
    }
    for (const f of FISH_SPECIES) {
      expect(f.name).toMatch(/^Cá /);
      expect(f.fact).toMatch(VI);
      expect(f.fact.length).toBeLessThan(130);
      expect(f.pool.phenomenon).toBe(f.phenomenon);
      // enough items that a species does not say the same thing every time
      expect(speciesPool(f).length, f.id).toBeGreaterThanOrEqual(f.tier === 'huyen-thoai' ? 5 : 7);
    }
  });

  it('rarer tiers are rarer, pay more, give less time and fewer plays', () => {
    for (let i = 1; i < RARITIES.length; i++) {
      const a = RARITY[RARITIES[i - 1]];
      const b = RARITY[RARITIES[i]];
      expect(b.fishWeight).toBeLessThan(a.fishWeight);
      expect(b.catchXu).toBeGreaterThan(a.catchXu);
      expect(b.dupXu).toBeGreaterThan(a.dupXu);
      expect(b.timeFactor).toBeLessThanOrEqual(a.timeFactor);
      expect(b.maxPlays).toBeLessThanOrEqual(a.maxPlays);
    }
    // a duplicate is always worth less than the egg: buying eggs for xu is never a way to make xu
    for (const r of RARITIES) expect(RARITY[r].dupXu).toBeLessThan(EGG_COST);
    expect(EGG_PITY).toBe(10);
  });

  it('the loot: pets, hats, outfit colours and titles in every tier', () => {
    expect(LOOT.length).toBeGreaterThanOrEqual(30);
    for (const kind of LOOT_KINDS) {
      for (const r of RARITIES) expect(LOOT.some((i) => i.kind === kind && i.tier === r), `${kind} ${r}`).toBe(true);
    }
    for (const i of LOOT) {
      expect(i.name).toMatch(/^[A-ZÁÀẢÃẠĂÂĐÉÊÍÓÔƠÚƯÝa-z]/);
      if (i.kind === 'outfit') expect(i.color).toMatch(/^#[0-9a-f]{6}$/);
      else expect(i.color).toBeUndefined();
    }
    // the cat of the town is a decoration (data/town), the pets are other animals or a different cat
    expect(LOOT.some((i) => i.id === 'cat')).toBe(false);
  });

  it('about 30 achievements and a handful of projects, every goal reachable and every title its own', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(30);
    expect(TOWN_PROJECTS.length).toBeGreaterThanOrEqual(3);
    expect(TOWN_PROJECTS.length).toBeLessThanOrEqual(5);
    for (const g of [...ACHIEVEMENTS, ...TOWN_PROJECTS]) {
      const target = goalTarget(g);
      expect(Number.isFinite(target), g.id).toBe(true);
      expect(target).toBeGreaterThan(0);
      if (g.metric === 'phenomenon') expect(g.phenomenon).toBeDefined();
      if (g.goal === 'all') expect(['episodes', 'species', 'legendary', 'phenomenon']).toContain(g.metric);
      expect(g.blurb).toMatch(VI);
    }
    // "Nhà sưu tầm" = half the fish
    expect(goalTarget(ACHIEVEMENTS.find((a) => a.id === 'nha-suu-tam')!)).toBe(FISH_SPECIES.length / 2);
    // one "Bậc thầy" per phenomenon
    expect(ACHIEVEMENTS.filter((a) => a.metric === 'phenomenon').map((a) => a.phenomenon).sort()).toEqual([...PHENOMENA].sort());
    const titles = [...ACHIEVEMENTS.map((a) => a.title), ...TOWN_PROJECTS.map((p) => p.title), ...LOOT.filter((i) => i.kind === 'title').map((i) => i.name)];
    expect(new Set(titles).size).toBe(titles.length);
    for (const t of titles) expect(t.length).toBeLessThanOrEqual(24);
  });
});
