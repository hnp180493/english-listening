// "Thân thiết" through the store (./store): an episode with a choice and a variant, gifts, the heart celebrations.
// Fake localStorage, a fixture arc (./friendship.fixture); each test imports fresh modules (module-level run state).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KEYS, STORAGE_PREFIX } from '../storage';

vi.mock('../../data/townStories', async () => {
  const f = await import('./friendship.fixture');
  const TOWN_STORIES = f.FIXTURE_EPISODES;
  return {
    TOWN_STORIES,
    BASE_STORIES: TOWN_STORIES.slice(0, 2),
    storiesOfPlace: (placeId: string) => TOWN_STORIES.filter((e) => e.placeId === placeId).sort((a, b) => a.order - b.order),
    storyEpisode: (id: string) => TOWN_STORIES.find((e) => e.id === id),
  };
});
vi.mock('../../data/stories', async () => {
  const f = await import('./friendship.fixture');
  return { RESIDENT_ARCS: [f.FIXTURE_ARC], residentArc: (id: string) => (id === 'cafe' ? f.FIXTURE_ARC : undefined) };
});

const NOW = new Date(2026, 10, 21, 10, 0).getTime();
const DAY = 24 * 3600 * 1000;
const P = STORAGE_PREFIX;
const TOWN = P + 'town-progress';
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
  return import('./store');
}

const stored = (key: string) => JSON.parse(map.get(key) ?? 'null');

/** Hear a new episode through: gist right on the first listen, every line right, every choice the given option. */
async function hearThrough(town: Awaited<ReturnType<typeof fresh>>, placeId: string, now: number, pick?: string) {
  const s = town.startTownEpisode(placeId, now);
  if (!s.ok) throw new Error('no episode');
  town.recordEpisodeGist(true, 1, now);
  let turns = s.turns;
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i];
    if (t.pick) turns = town.recordEpisodeChoice(t.base, pick ?? t.pick.options[0].id, now)!.turns;
    else town.recordEpisodeLine(t.line, 'first', now);
  }
  return { start: s, turns, result: town.finishTownEpisode(now + 60_000)! };
}

describe('friendship in an episode', () => {
  it('a finish brings +60, +30 for the gist on the first listen, +5 the first talk of the day; facts of `learn` are known', async () => {
    const town = await fresh();
    const { result } = await hearThrough(town, 'cafe', NOW);
    expect(result).toMatchObject({ episodeId: 'cafe-1', friendBefore: 0, friendAfter: 95, learned: [{ id: 'you:latte', vi: 'Bạn hay uống latte' }] });
    expect(stored(TOWN).facts).toEqual({ 'you:latte': NOW + 60_000 });
    expect(stored(TOWN).friends.cafe.up).toEqual({ [DEVICE]: 5 });
  });

  it('episode 3: the choice line is picked (no meaning to answer), the first pick counts and changes the next line', async () => {
    const town = await fresh();
    await hearThrough(town, 'cafe', NOW);
    await hearThrough(town, 'cafe', NOW + 1000);
    // 95 + 90 (the same day: no second +5): one heart, and the hearts celebration was queued
    expect(town.townCelebrations().map((c) => c.key)).toContain('friend:cafe:1');
    const s = town.startTownEpisode('cafe', NOW + 2000);
    if (!s.ok) throw new Error('not open');
    expect(s.episode.id).toBe('cafe-3');
    expect(s.turns.map((t) => [t.line.id, t.base, !!t.pick])).toEqual([
      ['cafe-3-01', 'cafe-3-01', false],
      ['cafe-3-02-a', 'cafe-3-02', true],
      ['cafe-3-03', 'cafe-3-03', false],
    ]);
    expect(s.turns[1].pick).toEqual({ options: expect.arrayContaining([expect.objectContaining({ id: 'cafe-3-02-b', intent: 'Từ chối khéo' })]), chosen: null });
    town.recordEpisodeGist(true, 1, NOW + 2000);
    town.recordEpisodeLine(s.turns[0].line, 'first', NOW + 2000);
    // not finished while the choice is not made
    town.recordEpisodeLine(s.turns[2].line, 'first', NOW + 2000);
    expect(town.finishTownEpisode(NOW + 2000)).toBeNull();
    const c = town.recordEpisodeChoice('cafe-3-02', 'cafe-3-02-a', NOW + 2000)!;
    expect(c).toMatchObject({ first: true, chosen: 'cafe-3-02-a', points: 20, learned: [{ id: 'you:jazz-yes', vi: 'Bạn nhận lời đi nghe jazz' }] });
    // the next line now remembers it
    expect(c.turns[2].line).toMatchObject({ id: 'cafe-3-03-v1', text: 'Great, I saved you a seat.' });
    expect(c.turns[2].choices.options[c.turns[2].choices.answer]).toBe('Tuyệt, tôi giữ chỗ cho bạn rồi.');
    expect(town.recordEpisodeChoice('cafe-3-01', 'x', NOW)).toBeNull();
    const r = town.finishTownEpisode(NOW + 2001)!;
    expect(r.learned.map((f) => f.id).sort()).toEqual(['cafe:loves-jazz', 'you:jazz-yes']);
    expect(r.friendAfter - r.friendBefore).toBe(20 + 60 + 30);
  });

  it('a replay keeps the first choice: it is what plays, and another pick changes nothing', async () => {
    const town = await fresh();
    await hearThrough(town, 'cafe', NOW);
    await hearThrough(town, 'cafe', NOW + 1000);
    await hearThrough(town, 'cafe', NOW + 2000, 'cafe-3-02-b');
    expect(stored(TOWN).choices).toEqual({ 'cafe-3-02': { o: 'cafe-3-02-b', at: NOW + 2000 } });
    // episode 3 as said now: what was chosen and the variant it calls for (a re-listen plays exactly these)
    const turns = town.episodeTurns((await import('./friendship.fixture')).FIXTURE_EPISODES[2], town.loadTownProgress());
    expect(turns.map((t) => t.line.id)).toEqual(['cafe-3-01', 'cafe-3-02-b', 'cafe-3-03-v2']);
    expect(turns[1].pick?.chosen).toBe('cafe-3-02-b');
  });
});

describe('friendship in a quick chat', () => {
  it('3 of 5 understood: +15 once a day and +5 for the first talk of the day', async () => {
    const town = await fresh();
    const s = town.startTownConversation('cafe');
    if (!s.ok) throw new Error('none');
    const outcomes = ['first', 'wrong', 'first', 'replayed', 'wrong'] as const;
    s.turns.forEach((t, i) => town.recordTownAnswer(t.line, outcomes[i], NOW + i));
    expect(town.finishTownConversation()).toMatchObject({ friendBefore: 0, friendAfter: 20 });
    const again = town.startTownConversation('cafe');
    if (!again.ok) throw new Error('none');
    again.turns.forEach((t, i) => town.recordTownAnswer(t.line, 'first', NOW + 100 + i));
    expect(town.finishTownConversation()).toMatchObject({ friendBefore: 20, friendAfter: 20 });
  });
});

describe('gifts through the store', () => {
  it('bought with xu, given once a day, the reaction and the points come back; a new heart is celebrated', async () => {
    const town = await fresh();
    expect(town.buyTownGift('lemon-cake', NOW)).toMatchObject({ ok: false, reason: 'poor', missing: 8 });
    map.set(TOWN, JSON.stringify({ version: 5, earned: { [DEVICE]: 40 } }));
    town.reloadTown();
    expect(town.buyTownGift('lemon-cake', NOW)).toMatchObject({ ok: true, balance: 32, inHand: 1 });
    expect(town.buyTownGift('lemon-cake', NOW)).toMatchObject({ ok: true, balance: 24, inHand: 2 });
    const g = town.giveTownGift('cafe', 'lemon-cake', NOW);
    expect(g).toMatchObject({ ok: true, taste: 'loves', points: 80, friendBefore: 0, friendAfter: 80, reaction: { text: 'Lemon cake? You remembered!' } });
    expect(town.giveTownGift('cafe', 'lemon-cake', NOW + 1)).toEqual({ ok: false, reason: 'today' });
    const next = town.giveTownGift('cafe', 'lemon-cake', NOW + DAY);
    expect(next).toMatchObject({ ok: true, friendAfter: 160 });
    if (next.ok) expect(next.celebrations).toEqual([{ key: 'friend:cafe:1', kind: 'friend', id: 'cafe', label: 'Emma giờ coi bạn là người quen!', detail: 'Thân thiết: 1/10 tim' }]);
    expect(town.giveTownGift('cafe', 'lemon-cake', NOW + 2000)).toEqual({ ok: false, reason: 'none' });
  });
});
