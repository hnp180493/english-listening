// IO of an episode of "Chuyện ở thị trấn" against a fake localStorage, with fixed episodes (the content grows on
// its own). Each test imports fresh modules (module-level run state).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KEYS, STORAGE_PREFIX } from '../storage';
import type { StoryEpisode } from './story';

vi.mock('../../data/townStories', () => {
  const TOWN_STORIES: StoryEpisode[] = [
    {
      id: 'cafe-1',
      placeId: 'cafe',
      order: 1,
      title: 'Ly cà phê đầu tiên',
      scene: 'Bạn ghé quán.',
      level: 1,
      lines: [
        { id: 'cafe-1-01', who: 'them', text: 'What can I get you?', vi: 'Bạn dùng gì?' },
        { id: 'cafe-1-02', who: 'you', text: 'A latte, please.', vi: 'Cho tôi một ly latte.' },
        { id: 'cafe-1-03', who: 'them', text: 'Hot or iced?', vi: 'Nóng hay đá?' },
      ],
      gist: { q: 'Bạn gọi gì?', options: ['Latte', 'Trà', 'Nước cam'], answer: 0 },
    },
    {
      id: 'cafe-2',
      placeId: 'cafe',
      order: 2,
      title: 'Như mọi khi',
      scene: 'Sáng hôm sau.',
      level: 1,
      lines: [
        { id: 'cafe-2-01', who: 'them', text: 'The usual?', vi: 'Như mọi khi hả?' },
        { id: 'cafe-2-02', who: 'you', text: 'Yes, thanks.', vi: 'Ừ, cảm ơn.' },
      ],
      gist: { q: 'Bạn gọi gì?', options: ['Như mọi khi', 'Món mới', 'Không gọi gì'], answer: 0 },
    },
  ];
  return {
    TOWN_STORIES,
    storiesOfPlace: (placeId: string) => TOWN_STORIES.filter((e) => e.placeId === placeId).sort((a, b) => a.order - b.order),
    storyEpisode: (id: string) => TOWN_STORIES.find((e) => e.id === id),
  };
});

const NOW = new Date(2026, 10, 13, 12, 0).getTime();
const TOMORROW = new Date(2026, 10, 14, 9, 0).getTime();
const TODAY = '2026-11-13';
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
  return import('./store');
}

const stored = (key: string) => JSON.parse(map.get(key) ?? 'null');

describe('an episode', () => {
  it('starts with its lines, their meanings, the gist and who says what; nothing at a place without stories', async () => {
    const town = await fresh();
    const s = town.startTownEpisode('cafe', NOW);
    if (!s.ok) throw new Error('not started');
    expect(s.mode).toBe('new');
    expect(s.episode.id).toBe('cafe-1');
    expect(s.firstListen).toBe(true);
    expect(s.turns.map((t) => [t.line.id, t.who, t.speaker])).toEqual([
      ['cafe-1-01', 'them', 'Emma'],
      ['cafe-1-02', 'you', 'Bạn'],
      ['cafe-1-03', 'them', 'Emma'],
    ]);
    for (const t of s.turns) expect(t.choices.options[t.choices.answer]).toBe(t.line.vi);
    expect(s.gist.options[s.gist.answer]).toBe('Latte');
    expect(s.met).toEqual([false, false, false]);
    expect(town.startTownEpisode('square', NOW)).toEqual({ ok: false, reason: 'none' });
    // a lodger is never refused for their place (no story for the shop in these fixtures: the quick chat)
    expect(town.startTownEpisode('shop', NOW)).toEqual({ ok: false, reason: 'none' });
    expect(town.startTownEpisode('nowhere', NOW)).toEqual({ ok: false, reason: 'unknown' });
    // starting writes nothing
    expect(map.has(TOWN)).toBe(false);
  });

  it('runs through: gist on the first listen (+5), the lines (3 / 2 / 0, a miss gets its talk card), the finish (+10)', async () => {
    const town = await fresh();
    const s = town.startTownEpisode('cafe', NOW);
    if (!s.ok) throw new Error('not started');
    expect(town.finishTownEpisode(NOW)).toBeNull(); // nothing answered yet

    const g = town.recordEpisodeGist(true, 1, NOW)!;
    expect(g).toMatchObject({ right: true, firstWin: true, reward: 5, earned: 5, balance: 5, result: null, saved: true });
    expect(town.recordEpisodeGist(false, 3, NOW)).toBe(g); // answered once
    expect(stored(TOWN).episodes['cafe-1']).toEqual({ stage: 0, at: 0, okAt: 0, firstGist: 2, bestLines: 0 });

    const [t1, t2, t3] = s.turns;
    const a1 = town.recordEpisodeLine(t1.line, 'first', NOW + 1);
    expect(a1).toMatchObject({ reward: 3, placeId: 'cafe', review: null });
    expect(town.recordEpisodeLine(t1.line, 'wrong', NOW + 2)).toBe(a1);
    expect(town.recordEpisodeLine(t2.line, 'replayed', NOW + 3).reward).toBe(2);
    expect(town.finishTownEpisode(NOW + 3)).toBeNull(); // a line is still unanswered
    const miss = town.recordEpisodeLine(t3.line, 'wrong', NOW + 4);
    expect(miss.reward).toBe(0);
    expect(miss.review?.reason).toBe('enrolled');
    expect(stored(REVIEW).cards['talk:cafe-1-03']).toMatchObject({ id: 'talk:cafe-1-03', lastGrade: 'again' });
    expect(stored(P + 'stats').attempts.map((a: { itemId: string }) => a.itemId)).toEqual(['cafe-1:gist', 'cafe-1-01', 'cafe-1-02', 'cafe-1-03']);

    const r = town.finishTownEpisode(NOW + 60_000)!;
    expect(r).toMatchObject({
      episodeId: 'cafe-1',
      mode: 'new',
      gistRight: true,
      gistFirstWin: true,
      lines: 3,
      linesRight: 2,
      lineXu: 5,
      gistXu: 5,
      finishXu: 10,
      firstFinish: true,
      stage: 1,
      nextDue: '2026-11-14',
      daysToNext: 1,
      // + 8: 2026-11-13 draws the daily task "Nghe trọn 1 tập chuyện" (core/town/daily), paid with the finish
      earned: 28,
      balance: 28,
    });
    expect(r.tasksPaid.map((x) => x.id)).toEqual(['episode']);
    expect(town.finishTownEpisode(NOW + 70_000)).toBe(r);
    const t = stored(TOWN);
    expect(t.version).toBe(6);
    expect(t.episodes['cafe-1']).toEqual({ stage: 1, at: NOW + 60_000, okAt: NOW + 60_000, firstGist: 2, bestLines: 2 });
    // a step-2 line was heard once already in the whole exchange: it counts for "Hiểu 8 câu", never as a first listen
    expect(t.daily[TODAY][DEVICE]).toMatchObject({ talks: 1, lines: 2, first: 0, met: ['cafe'], eps: 1 });
    expect(t.lines['cafe-1-01']).toMatchObject({ best: 1, tries: 1 });
    expect(t.earned[DEVICE]).toBe(28);
    // the gist right on the very first listen earned an egg (core/town/eggs)
    expect(t.eggs.grants).toEqual(['gist:cafe-1']);

    // the same day the place offers episode 2; the next day the re-listen of episode 1 comes first
    const next = town.startTownEpisode('cafe', NOW + 120_000);
    expect(next.ok && [next.episode.id, next.mode]).toEqual(['cafe-2', 'new']);
    const back = town.startTownEpisode('cafe', TOMORROW);
    if (!back.ok) throw new Error('no re-listen');
    expect([back.episode.id, back.mode, back.firstListen]).toEqual(['cafe-1', 'relisten', false]);
    expect(back.met).toEqual([true, true, true]);
  });

  it('a re-listen: the gist ends it; right moves it a stage on (+3), wrong brings it back tomorrow', async () => {
    map.set(
      TOWN,
      JSON.stringify({ version: 3, lines: {}, earned: { [DEVICE]: 10 }, bought: [], daily: {}, days: [], episodes: { 'cafe-1': { stage: 1, at: NOW - 86_400_000, okAt: NOW - 86_400_000, firstGist: 1, bestLines: 3 } } }),
    );
    let town = await fresh();
    let s = town.startTownEpisode('cafe', NOW);
    expect(s.ok && s.mode).toBe('relisten');
    const miss = town.recordEpisodeGist(false, 1, NOW)!;
    // a re-listen heard through counts for the daily episode task of 2026-11-13 (8 xu), right or not
    expect(miss.result).toMatchObject({ mode: 'relisten', gistRight: false, stage: 1, nextDue: '2026-11-14', gistXu: 0, earned: 8 });
    expect(town.finishTownEpisode(NOW)).toBe(miss.result);

    town = await fresh();
    s = town.startTownEpisode('cafe', TOMORROW);
    expect(s.ok && s.mode).toBe('relisten');
    const ok = town.recordEpisodeGist(true, 1, TOMORROW)!;
    expect(ok.reward).toBe(3);
    expect(ok.result).toMatchObject({ gistRight: true, gistXu: 3, stage: 2, nextDue: '2026-11-17', daysToNext: 3 });
    expect(stored(TOWN).episodes['cafe-1']).toEqual({ stage: 2, at: TOMORROW, okAt: TOMORROW, firstGist: 1, bestLines: 3 });
    expect(stored(TOWN).daily['2026-11-14'][DEVICE].met).toEqual(['cafe']);
  });

  it('a gist after two whole listens, a second run of an episode left in the middle: nothing paid for the gist', async () => {
    let town = await fresh();
    town.startTownEpisode('cafe', NOW);
    expect(town.recordEpisodeGist(true, 2, NOW)).toMatchObject({ firstWin: false, reward: 0 });
    town = await fresh();
    const s = town.startTownEpisode('cafe', NOW + 1000);
    expect(s.ok && s.firstListen).toBe(false);
    expect(town.recordEpisodeGist(true, 1, NOW + 1000)).toMatchObject({ firstWin: false, reward: 0 });
  });
});
