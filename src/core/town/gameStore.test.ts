// IO of the game loops (fishing, the farm, eggs, the wardrobe, unlocks) against a fake localStorage. Each test imports
// fresh modules (module-level session state: the catch streak, the celebrations).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EGG_COST } from '../../data/townGame';
import { KEYS, STORAGE_PREFIX } from '../storage';
import type { FishCast } from './fishing';

const NOW = new Date(2026, 10, 20, 12, 0).getTime();
const TODAY = '2026-11-20';
const P = STORAGE_PREFIX;
const TOWN = P + 'town-progress';
const REVIEW = P + 'review-cards';
const DEVICE = 'd-test0001';

let map: Map<string, string>;

beforeEach(() => {
  map = new Map();
  const storage = {
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
  map.set(P + KEYS.deviceId, JSON.stringify(DEVICE));
  vi.stubGlobal('window', { localStorage: storage, addEventListener: () => {} });
});

afterEach(() => vi.unstubAllGlobals());

async function fresh() {
  vi.resetModules();
  const game = await import('./gameStore');
  const store = await import('./store');
  return { game, store };
}

const stored = (key: string) => JSON.parse(map.get(key) ?? 'null');
const seed = (value: object) => map.set(TOWN, JSON.stringify({ version: 4, ...value }));

/** The right answer of a cast, given after one play. */
const rightAnswer = (_c: FishCast) => ({ correct: true, plays: 1, ms: 1000 });

describe('fishing', () => {
  it('a cast writes nothing; a catch is recorded, paid and raises the streak; an escape resets it', async () => {
    const { game } = await fresh();
    const cast = game.startCast(NOW);
    expect(map.has(TOWN)).toBe(false);
    expect(cast.options[cast.answer]).toBeDefined();
    const r = game.finishCast(cast, rightAnswer(cast), NOW);
    expect(r.outcome.caught).toBe(true);
    expect(r.newSpecies).toBe(true);
    expect(r.xu).toBe(cast.xu + 2);
    expect(r.streak).toBe(1);
    expect(r.saved).toBe(true);
    expect(stored(TOWN).fish[cast.species.id]).toMatchObject({ seen: 1, caught: 1, firstAt: NOW, bestMs: 1000 });
    expect(stored(TOWN).daily[TODAY][DEVICE]).toMatchObject({ fish: 1, fishFirst: 1 });
    // the first catch is an achievement: recorded with the write and queued to celebrate
    expect(stored(TOWN).unlocks['me-ca-dau']).toBe(NOW);
    expect(r.celebrations.map((c) => c.key)).toContain('achievement:me-ca-dau');
    // the same cast answered twice is recorded once
    expect(game.finishCast(cast, rightAnswer(cast), NOW + 1)).toBe(r);
    const next = game.startCast(NOW + 2);
    const away = game.finishCast(next, { correct: false, plays: 1, ms: 500 }, NOW + 3);
    expect(away).toMatchObject({ xu: 0, streak: 0 });
    expect(game.fishingStreak()).toBe(0);
    // a cast never played is recorded nowhere and leaves the streak alone
    const raw = map.get(TOWN);
    game.finishCast(game.startCast(NOW + 4), { correct: true, plays: 0, ms: 10 }, NOW + 5);
    expect(map.get(TOWN)).toBe(raw);
  });
});

describe('eggs and the wardrobe', () => {
  it('buy an egg with xu, hatch it, wear what came out', async () => {
    seed({ earned: { [DEVICE]: EGG_COST + 2 } });
    const { game, store } = await fresh();
    expect(game.hatchTownEgg(NOW)).toMatchObject({ ok: false, reason: 'no-egg', inHand: 0 });
    const b = game.buyTownEgg(NOW);
    expect(b).toMatchObject({ ok: true, balance: 2, inHand: 1 });
    expect(game.buyTownEgg(NOW)).toMatchObject({ ok: false, reason: 'poor', missing: EGG_COST - 2 });
    const h = game.hatchTownEgg(NOW + 1);
    if (!h.ok) throw new Error('no hatch');
    expect(h.inHand).toBe(0);
    expect(stored(TOWN).owned[h.hatch.item.id]).toBe(NOW + 1);
    expect(stored(TOWN).eggs).toMatchObject({ bought: { [DEVICE]: 1 }, hatched: { [DEVICE]: 1 } });
    const slot = h.hatch.item.kind;
    const worn = game.equipTownItem(slot, h.hatch.item.id, NOW + 2);
    expect(worn.ok).toBe(true);
    expect(stored(TOWN).look[slot]).toBe(h.hatch.item.id);
    expect(stored(TOWN).look.at).toBe(NOW + 2);
    expect(game.townLookView()[slot]).toMatchObject({ id: h.hatch.item.id });
    const notOwned = ['vuong-mien', 'mu-len'].find((id) => id !== h.hatch.item.id)!;
    expect(game.equipTownItem('hat', notOwned, NOW + 3)).toEqual({ ok: false, reason: 'not-owned' });
    // the snapshot of the panels
    const v = game.townGameView(store.loadTownProgress(), NOW, DEVICE);
    expect(v.eggs).toMatchObject({ inHand: 0, cost: EGG_COST, canBuy: false });
    expect(v.owned.map((i) => i.id)).toEqual([h.hatch.item.id]);
    expect(v.album.total).toBe(24);
  });

  it('an egg earned by listening is granted with the next write, and celebrated once', async () => {
    // a version 3 town whose learner already got a gist right on the first listen: the first write grants its egg
    map.set(TOWN, JSON.stringify({ version: 3, lines: {}, earned: {}, bought: [], daily: {}, days: [], episodes: { 'cafe-1': { stage: 1, at: NOW - 5000, okAt: NOW - 5000, firstGist: 2, bestLines: 4 } } }));
    const { game, store } = await fresh();
    expect(store.townCelebrations()).toEqual([]);
    game.finishCast(game.startCast(NOW), { correct: false, plays: 1, ms: 100 }, NOW);
    expect(stored(TOWN).version).toBe(6);
    expect(stored(TOWN).eggs.grants).toEqual(['gist:cafe-1']);
    expect(store.townCelebrations().map((c) => c.key)).toEqual(expect.arrayContaining(['egg:gist:cafe-1', 'achievement:nghe-y-chinh', 'achievement:tap-dau-tien']));
    store.clearTownCelebrations(['egg:gist:cafe-1']);
    expect(store.townCelebrations().map((c) => c.key)).not.toContain('egg:gist:cafe-1');
    store.clearTownCelebrations();
    expect(store.townCelebrations()).toEqual([]);
    expect(game.useTownGame).toBeTypeOf('function');
  });
});

describe('the farm', () => {
  it('claimHarvest pays the reviews of today once, and the golden crop when today is done', async () => {
    // two cards reviewed today, nothing else due: today's review is done
    const cards = {
      'dict:s001': { id: 'dict:s001', due: NOW + 3 * 86_400_000, interval: 3, ease: 2.5, reps: 2, lapses: 0, lastGrade: 'good', last: NOW - 1000 },
      'dict:s002': { id: 'dict:s002', due: NOW + 3 * 86_400_000, interval: 3, ease: 2.5, reps: 2, lapses: 0, lastGrade: 'good', last: NOW - 900 },
    };
    map.set(REVIEW, JSON.stringify({ version: 1, cards, daily: { day: TODAY, ids: ['dict:s001', 'dict:s002'], exempt: [], extraSec: 0, enrolled: 0 }, since: NOW - 30 * 86_400_000, notice: null, noticeSeenAt: 0 }));
    const { game } = await fresh();
    const r = game.claimHarvest(NOW);
    expect(r).toMatchObject({ cards: 2, golden: true, xu: 2 + 10, saved: true });
    expect(stored(TOWN).farmDays).toEqual([TODAY]);
    expect(stored(TOWN).daily[TODAY][DEVICE].harvest).toBe(2);
    expect(stored(TOWN).eggs.grants).toEqual([`farm:${TODAY}`]);
    expect(r.celebrations.map((c) => c.key)).toEqual(expect.arrayContaining(['achievement:mua-dau-tien', `egg:farm:${TODAY}`]));
    expect(game.claimHarvest(NOW + 1)).toMatchObject({ cards: 0, xu: 0, golden: false });
    // nothing new to record: a check writes nothing
    const raw = map.get(TOWN);
    expect(game.checkTownUnlocks(NOW + 2)).toEqual([]);
    expect(map.get(TOWN)).toBe(raw);
  });
});
