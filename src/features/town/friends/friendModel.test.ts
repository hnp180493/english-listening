import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../data/townStories', async () => {
  const f = await import('../../../core/town/friendship.fixture');
  const TOWN_STORIES = f.FIXTURE_EPISODES;
  return {
    TOWN_STORIES,
    BASE_STORIES: TOWN_STORIES.slice(0, 2),
    storiesOfPlace: (placeId: string) => TOWN_STORIES.filter((e) => e.placeId === placeId).sort((a, b) => a.order - b.order),
    storyEpisode: (id: string) => TOWN_STORIES.find((e) => e.id === id),
  };
});
vi.mock('../../../data/stories', async () => {
  const f = await import('../../../core/town/friendship.fixture');
  return { RESIDENT_ARCS: [f.FIXTURE_ARC], residentArc: (id: string) => (id === 'cafe' ? f.FIXTURE_ARC : undefined) };
});

const { giftReaction, heartsText, lockText, pointsText, residentJournal, toNextText } = await import('./friendModel');
const { addChoice, addFacts, addFriendSide, emptyTownProgress, updateEpisode } = await import('../../../core/town/progress');

const NOW = new Date(2026, 10, 21, 10, 0).getTime();
const done = (p = emptyTownProgress(), id: string) => updateEpisode(p, id, (e) => ({ ...e, stage: 1, at: NOW, okAt: NOW, firstGist: 1 }));

describe('the words', () => {
  it('hearts, points, what is left, what an episode waits for', () => {
    expect(heartsText(3)).toBe('3/10 tim');
    expect(toNextText({ hearts: 3, toNext: 35 })).toBe('Còn 35 điểm nữa tới tim thứ 4.');
    expect(toNextText({ hearts: 10, toNext: null })).toBe('Đã đủ 10 tim.');
    expect(pointsText(80)).toBe('+80 điểm thân thiết');
    expect(pointsText(-20)).toBe('−20 điểm thân thiết');
    expect(lockText({ hearts: 4, facts: 0 }, 'Emma')).toBe('Cần 4 tim');
    expect(lockText({ hearts: 4, facts: 1 }, 'Emma')).toBe('Cần 4 tim và biết thêm 1 điều về Emma');
    expect(giftReaction('loves', 'Emma')).toMatchObject({ emote: 'heart', mood: 'love' });
    expect(giftReaction('dislikes', 'Emma')).toMatchObject({ emote: 'frown', mood: 'pout' });
  });
});

describe('a page of the Sổ tay', () => {
  it('a stranger: nothing known, episode 1 ready', () => {
    const j = residentJournal(emptyTownProgress(), 'cafe', NOW);
    expect(j).toMatchObject({ resident: 'Emma', about: [], remembers: [], gifts: [], choices: [], next: { status: 'ready', order: 1 } });
  });

  it('facts known, gifts only once heard, the choices made, and an episode waiting for hearts', () => {
    let p = done(done(undefined, 'cafe-1'), 'cafe-2');
    p = addFriendSide(p, 'cafe', 'down', 'd-laptop01', 30);
    p = addFacts(p, ['cafe:loves-jazz', 'cafe:loves-lemon-cake', 'you:latte'], NOW);
    p = addChoice(p, 'cafe-3-02', 'cafe-3-02-a', NOW);
    const j = residentJournal(p, 'cafe', NOW);
    expect(j.about.map((f) => f.id)).toEqual(['cafe:loves-jazz', 'cafe:loves-lemon-cake']);
    expect(j.remembers.map((f) => f.id)).toEqual(['you:latte']);
    expect(j.gifts.map((g) => [g.taste, g.gift.id])).toEqual([['loves', 'lemon-cake']]);
    expect(j.choices).toEqual([{ episode: 'Tập 3: Buổi nhạc jazz', intent: 'Nhận lời', vi: 'Nghe hay đấy, tôi sẽ tới.' }]);
    // 60 + 60 + 20 (the choice) − 30: 110, one heart: episode 3 is open
    expect(j.friend.points).toBe(110);
    expect(j.next).toMatchObject({ status: 'ready', order: 3 });
    const low = residentJournal(addFriendSide(p, 'cafe', 'down', 'd-laptop01', 20), 'cafe', NOW);
    expect(low.next).toMatchObject({ status: 'hearts', order: 3, text: 'Tập 3: cần 1 tim (đang có 0 tim)' });
  });
});
