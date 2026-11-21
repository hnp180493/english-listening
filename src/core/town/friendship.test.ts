// "Thân thiết" (./friendship): the rules, apart from the content (a small fixture arc, ./friendship.fixture).
import { describe, expect, it, vi } from 'vitest';

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

const {
  addFriendPoints,
  applyChatFriendship,
  buyGift,
  choicePoints,
  episodeNeeds,
  episodePoints,
  friendPoints,
  friendView,
  giftInHand,
  giftedToday,
  giveGift,
  heartCheer,
  heartsOf,
  pickGreeting,
  recordChoice,
  settleFacts,
  tasteOf,
} = await import('./friendship');
const { isEpisodeUnlocked, nextEpisode, episodeWaitingForFriend, storyChoices } = await import('./episodes');
const { addEarned, emptyTownProgress, mergeTownProgress, parseTownProgress, townDay, updateEpisode, knowsFact, choiceOf, addChoice, addFacts, addFriendSide } = await import('./progress');
const { balance } = await import('./economy');
const { resolveEpisode, storyLineById, allStoryLines } = await import('./storyLines');
const { FIXTURE_EPISODES } = await import('./friendship.fixture');

const NOW = new Date(2026, 10, 21, 10, 0).getTime();
const DAY = 24 * 3600 * 1000;
const LAPTOP = 'd-laptop01';
const PHONE = 'd-phone001';
const EP3 = FIXTURE_EPISODES[2];

const finished = (p = emptyTownProgress(), id = 'cafe-1', firstGist: 0 | 1 | 2 = 1, stage = 1) =>
  updateEpisode(p, id, (e) => ({ ...e, stage, at: NOW, okAt: NOW, firstGist }));

describe('the score', () => {
  it('episodes count by their record: +60 a finish, +30 the gist on the first listen, +10 a right re-listen', () => {
    expect(episodePoints(emptyTownProgress(), 'cafe')).toBe(0);
    expect(episodePoints(finished(), 'cafe')).toBe(60);
    expect(episodePoints(finished(undefined, 'cafe-1', 2), 'cafe')).toBe(90);
    expect(episodePoints(finished(undefined, 'cafe-1', 2, 3), 'cafe')).toBe(110);
    // begun only: nothing
    expect(episodePoints(updateEpisode(emptyTownProgress(), 'cafe-1', (e) => ({ ...e, firstGist: 2 })), 'cafe')).toBe(0);
    // two machines that both finished it: the record merges by max, so it counts once
    const a = finished(undefined, 'cafe-1', 2);
    expect(friendPoints(mergeTownProgress(a, a), 'cafe')).toBe(90);
  });

  it('hearts: 100 points each, 0..10; the view says what is left to the next one', () => {
    expect([0, 99, 100, 250, 999, 1000, 5000, -5, Number.NaN].map(heartsOf)).toEqual([0, 0, 1, 2, 9, 10, 10, 0, 0]);
    const v = friendView(finished(undefined, 'cafe-1', 2), 'cafe');
    expect(v).toEqual({ placeId: 'cafe', points: 90, hearts: 0, toNext: 10, part: 0.9, title: 'người lạ' });
  });

  it('a gain never above 1000, a loss never below 0; unknown place or device: nothing', () => {
    let p = emptyTownProgress();
    const lost = addFriendPoints(p, 'cafe', -20, LAPTOP);
    expect(lost.points).toBe(0);
    expect(lost.progress).toBe(p);
    p = addFriendPoints(p, 'cafe', 990, LAPTOP).progress;
    const w = addFriendPoints(p, 'cafe', 80, LAPTOP);
    expect(w.points).toBe(10);
    expect(friendPoints(w.progress, 'cafe')).toBe(1000);
    expect(addFriendPoints(w.progress, 'cafe', -20, LAPTOP).points).toBe(-20);
    expect(addFriendPoints(p, 'nowhere', 10, LAPTOP).progress).toBe(p);
    expect(addFriendPoints(p, 'cafe', 10, 'NOT A DEVICE').progress).toBe(p);
  });

  it('per browser buckets: two machines add up, a copy merged twice counts once', () => {
    const a = addFriendSide(emptyTownProgress(), 'cafe', 'up', LAPTOP, 40);
    const b = addFriendSide(emptyTownProgress(), 'cafe', 'up', PHONE, 25);
    const m = mergeTownProgress(a, b);
    expect(friendPoints(m, 'cafe')).toBe(65);
    expect(friendPoints(mergeTownProgress(m, a), 'cafe')).toBe(65);
    // and they survive a write and a read
    expect(friendPoints(parseTownProgress(JSON.parse(JSON.stringify(m))), 'cafe')).toBe(65);
  });

  it('the words of a new heart: a new title is named', () => {
    expect(heartCheer('cafe', 6, 7).label).toBe('Emma giờ coi bạn là bạn thân!');
    expect(heartCheer('cafe', 7, 8)).toEqual({ label: 'Thân với Emma hơn', detail: 'Thân thiết: 8/10 tim' });
  });
});

describe('quick chats', () => {
  it('+15 once per resident a day for 3 of 5 lines understood, +5 for the first conversation of the day', () => {
    const p = emptyTownProgress();
    const one = applyChatFriendship(p, 'cafe', 3, true, NOW, LAPTOP);
    expect(one.points).toBe(20);
    expect(one.progress.daily[townDay(NOW)][LAPTOP].bond).toEqual(['cafe']);
    // the same day, another chat: nothing more (the +5 only when it is the first of the day)
    expect(applyChatFriendship(one.progress, 'cafe', 5, false, NOW + 1000, LAPTOP).points).toBe(0);
    // another browser the same day sees the day's row once synced: no second +15
    expect(applyChatFriendship(one.progress, 'cafe', 5, false, NOW + 1000, PHONE).points).toBe(0);
    // two lines only: the +5 alone
    expect(applyChatFriendship(p, 'cafe', 2, true, NOW, LAPTOP).points).toBe(5);
    // the next day: again
    expect(applyChatFriendship(one.progress, 'cafe', 3, false, NOW + DAY, LAPTOP).points).toBe(15);
  });
});

describe('episodes that wait for friendship', () => {
  it('episode 3 opens with 1 heart (and the house, and episode 2 done); the overview can say why it waits', () => {
    let p = finished(finished(undefined, 'cafe-1'), 'cafe-2');
    // 120 points from two finishes: 1 heart already
    expect(isEpisodeUnlocked(p, EP3)).toBe(true);
    p = finished(finished(undefined, 'cafe-1'), 'cafe-2');
    // a choice that cost points elsewhere could hold it back: here, a gift that was disliked twice
    const low = addFriendSide(p, 'cafe', 'down', LAPTOP, 30);
    expect(friendPoints(low, 'cafe')).toBe(90);
    expect(isEpisodeUnlocked(low, EP3)).toBe(false);
    expect(episodeNeeds(low, EP3)).toEqual({ hearts: 1, facts: [] });
    expect(episodeWaitingForFriend(low, 'cafe')).toMatchObject({ episode: { id: 'cafe-3' }, needs: { hearts: 1 } });
    expect(nextEpisode(low, 'cafe', NOW + 30 * DAY)?.episode.id).not.toBe('cafe-3');
    expect(episodeWaitingForFriend(p, 'cafe')).toBeNull();
    // facts it needs
    expect(episodeNeeds(p, { placeId: 'cafe', requires: { facts: ['you:latte', 'cafe:loves-jazz'] } })).toEqual({ hearts: null, facts: ['you:latte', 'cafe:loves-jazz'] });
  });

  it('facts of finished episodes are learned with the next write (settleFacts), once', () => {
    const p = finished();
    const s = settleFacts(p, NOW);
    expect(knowsFact(s, 'you:latte')).toBe(true);
    expect(settleFacts(s, NOW + 5)).toBe(s);
    expect(settleFacts(emptyTownProgress(), NOW)).toEqual(emptyTownProgress());
  });
});

describe('choices and variants', () => {
  it('a choice line plays its first option until one is chosen; a variant plays when its fact is known', () => {
    const none = resolveEpisode(EP3, () => false, () => null);
    expect(none.map((l) => l.id)).toEqual(['cafe-3-01', 'cafe-3-02-a', 'cafe-3-03']);
    expect(none[1]).toMatchObject({ base: 'cafe-3-02', who: 'you', choice: { chosen: null } });
    const no = resolveEpisode(EP3, (f) => f === 'you:jazz-no', (id) => (id === 'cafe-3-02' ? 'cafe-3-02-b' : null));
    expect(no.map((l) => [l.id, l.text])).toEqual([
      ['cafe-3-01', "There's a jazz night on Friday."],
      ['cafe-3-02-b', "Sorry, I'm busy that night."],
      ['cafe-3-03-v2', 'No worries, maybe next time.'],
    ]);
    // order is priority: with both facts the first variant
    expect(resolveEpisode(EP3, () => true, () => null)[2].id).toBe('cafe-3-03-v1');
  });

  it('options and variants are story lines of their own (review cards, xp), with the speaker of their line', () => {
    expect(storyLineById('cafe-3-02-b')).toMatchObject({ line: { who: 'you', base: 'cafe-3-02', text: "Sorry, I'm busy that night." }, episode: { id: 'cafe-3' } });
    expect(storyLineById('cafe-3-03-v1')?.line).toMatchObject({ who: 'them', base: 'cafe-3-03' });
    expect(storyLineById('cafe-3-02')?.base.id).toBe('cafe-3-02');
    expect(allStoryLines().map((l) => l.id)).toContain('cafe-3-03-v2');
  });

  it('the meanings of a variant never offer another form of the same moment', () => {
    for (let seed = 0; seed < 6; seed++) {
      const c = storyChoices('cafe-3-03-v1', EP3, seed);
      expect(c.options[c.answer]).toBe('Tuyệt, tôi giữ chỗ cho bạn rồi.');
      expect(c.options).not.toContain('Được, hẹn gặp nhé.');
      expect(c.options).not.toContain('Không sao, để lần sau nhé.');
    }
  });

  it('only the first pick counts: its points (derived) and its facts; a later pick changes nothing', () => {
    const p = emptyTownProgress();
    const w = recordChoice(p, EP3, 'cafe-3-02', 'cafe-3-02-b', NOW)!;
    expect(w).toMatchObject({ first: true, chosen: 'cafe-3-02-b', learned: ['you:jazz-no'] });
    expect(choicePoints(w.progress, 'cafe')).toBe(-10);
    // a negative choice at 0 points leaves the score at 0
    expect(friendPoints(w.progress, 'cafe')).toBe(0);
    const again = recordChoice(w.progress, EP3, 'cafe-3-02', 'cafe-3-02-a', NOW + 5)!;
    expect(again).toMatchObject({ first: false, chosen: 'cafe-3-02-b', points: 0, learned: [] });
    expect(again.progress).toBe(w.progress);
    expect(recordChoice(p, EP3, 'cafe-3-01', 'cafe-3-02-a', NOW)).toBeNull();
    expect(recordChoice(p, EP3, 'cafe-3-02', 'nope', NOW)).toBeNull();
    // with points to spare a +20 shows in the score
    const rich = finished(finished(undefined, 'cafe-1'), 'cafe-2');
    expect(recordChoice(rich, EP3, 'cafe-3-02', 'cafe-3-02-a', NOW)!.points).toBe(20);
  });

  it('two machines that chose differently keep the earlier choice everywhere', () => {
    const a = addChoice(emptyTownProgress(), 'cafe-3-02', 'cafe-3-02-b', NOW + 10);
    const b = addChoice(emptyTownProgress(), 'cafe-3-02', 'cafe-3-02-a', NOW);
    expect(choiceOf(mergeTownProgress(a, b), 'cafe-3-02')).toEqual({ o: 'cafe-3-02-a', at: NOW });
    expect(mergeTownProgress(a, b)).toEqual(mergeTownProgress(b, a));
    const tie = addChoice(emptyTownProgress(), 'cafe-3-02', 'cafe-3-02-b', NOW);
    expect(choiceOf(mergeTownProgress(tie, b), 'cafe-3-02')?.o).toBe('cafe-3-02-a');
    // facts: a union with the first time
    const f1 = addFacts(emptyTownProgress(), ['you:latte', 'Bad fact'], NOW + 5);
    const f2 = addFacts(emptyTownProgress(), ['you:latte', 'cafe:loves-jazz'], NOW);
    expect(mergeTownProgress(f1, f2).facts).toEqual({ 'cafe:loves-jazz': NOW, 'you:latte': NOW });
  });
});

describe('gifts', () => {
  const rich = () => addEarned(emptyTownProgress(), LAPTOP, 50);

  it('bought with xu (the balance goes down), given one a day per resident, the taste decides the points', () => {
    const bought = buyGift(rich(), 'lemon-cake', LAPTOP);
    if (!bought.ok) throw new Error(bought.reason);
    expect(balance(bought.progress)).toBe(42);
    expect(giftInHand(bought.progress, 'lemon-cake')).toBe(1);
    expect(buyGift(emptyTownProgress(), 'lemon-cake', LAPTOP)).toEqual({ ok: false, reason: 'poor', missing: 8 });
    expect(buyGift(rich(), 'nope', LAPTOP)).toMatchObject({ ok: false, reason: 'unknown' });

    const g = giveGift(bought.progress, 'cafe', 'lemon-cake', NOW, LAPTOP);
    if (!g.ok) throw new Error(g.reason);
    expect(g).toMatchObject({ taste: 'loves', points: 80, reaction: { id: 'cafe-gift-loves' } });
    expect(giftInHand(g.progress, 'lemon-cake')).toBe(0);
    expect(giftedToday(g.progress, 'cafe', NOW)).toBe(true);
    expect(friendPoints(g.progress, 'cafe')).toBe(80);
    // nothing in hand, or already one today
    expect(giveGift(g.progress, 'cafe', 'lemon-cake', NOW, LAPTOP)).toEqual({ ok: false, reason: 'none' });
    const more = buyGift(addEarned(g.progress, LAPTOP, 50), 'spicy-noodles', LAPTOP);
    if (!more.ok) throw new Error('poor');
    expect(giveGift(more.progress, 'cafe', 'spicy-noodles', NOW + 1000, LAPTOP)).toEqual({ ok: false, reason: 'today' });
    // the next day: disliked, −20
    const d = giveGift(more.progress, 'cafe', 'spicy-noodles', NOW + DAY, LAPTOP);
    expect(d).toMatchObject({ ok: true, taste: 'dislikes', points: -20, reaction: { id: 'cafe-gift-dislikes' } });
    if (d.ok) expect(friendPoints(d.progress, 'cafe')).toBe(60);
  });

  it('taste: loves / likes / dislikes from the arc, anything else neutral; a resident without content is neutral to all', () => {
    expect(['lemon-cake', 'iced-latte', 'spicy-noodles', 'roses'].map((g) => tasteOf('cafe', g))).toEqual(['loves', 'likes', 'dislikes', 'neutral']);
    expect(tasteOf('home', 'lemon-cake')).toBe('neutral');
    // a resident whose reactions are not written yet: the points, no voice
    const p = buyGift(rich(), 'roses', LAPTOP);
    if (!p.ok) throw new Error('poor');
    expect(giveGift(p.progress, 'home', 'roses', NOW, LAPTOP)).toMatchObject({ ok: true, taste: 'neutral', points: 10, reaction: null });
  });

  it('gifts bought and given merge per browser', () => {
    const a = buyGift(rich(), 'roses', LAPTOP);
    const b = buyGift(addEarned(emptyTownProgress(), PHONE, 50), 'roses', PHONE);
    if (!a.ok || !b.ok) throw new Error('poor');
    const m = mergeTownProgress(a.progress, b.progress);
    expect(giftInHand(m, 'roses')).toBe(2);
    expect(balance(m)).toBe(80);
  });
});

describe('greetings', () => {
  const ctx = (known: Record<string, number> = {}, plays: Record<string, number> = {}) => ({ now: NOW, learnedAt: (f: string) => known[f] ?? 0, plays: (id: string) => plays[id] ?? 0 });
  it('a memory callback while it is news, then the highest tier the hearts allow; never the same twice in a row', () => {
    expect(pickGreeting('cafe', 0, ctx(), null)?.id).toBe('cafe-hi-01');
    expect(pickGreeting('cafe', 0, ctx(), null, 1)?.id).toBe('cafe-hi-02');
    expect(pickGreeting('cafe', 0, ctx(), 'cafe-hi-01')?.id).toBe('cafe-hi-02');
    expect(pickGreeting('cafe', 3, ctx(), null)?.id).toBe('cafe-hi-03');
    expect(pickGreeting('cafe', 3, ctx({ 'you:jazz-yes': NOW - DAY }), null)?.id).toBe('cafe-hi-04');
    // the callback was just said: another one
    expect(pickGreeting('cafe', 3, ctx({ 'you:jazz-yes': NOW - DAY }), 'cafe-hi-04')?.id).toBe('cafe-hi-03');
    expect(pickGreeting('home', 5, ctx(), null)).toBeNull();
  });

  it('a memory greeting rotates out: a week after its fact, or once said twice', () => {
    expect(pickGreeting('cafe', 3, ctx({ 'you:jazz-yes': NOW - 8 * DAY }), null)?.id).toBe('cafe-hi-03');
    expect(pickGreeting('cafe', 3, ctx({ 'you:jazz-yes': NOW - DAY }, { 'cafe-hi-04': 2 }), null)?.id).toBe('cafe-hi-03');
    expect(pickGreeting('cafe', 3, ctx({ 'you:jazz-yes': NOW - DAY }, { 'cafe-hi-04': 1 }), null)?.id).toBe('cafe-hi-04');
  });
});

describe('stored (version 5)', () => {
  it('reads defensively: junk ids, devices and values dropped', () => {
    const p = parseTownProgress({
      version: 5,
      friends: { cafe: { up: { [LAPTOP]: 12.7, 'NOT A DEVICE': 5 }, down: { [PHONE]: -3 } }, 'Bad Id': { up: { [LAPTOP]: 1 } }, home: 'x' },
      facts: { 'you:latte': NOW, 'cafe:': NOW, 'you:jazz-no': -1, __proto__: NOW },
      choices: { 'cafe-3-02': { o: 'cafe-3-02-b', at: NOW }, 'cafe-3-03': { o: 'Bad', at: NOW }, 'cafe-3-04': { o: 'cafe-3-04-a', at: 0 } },
      gifts: { bought: { roses: { [LAPTOP]: 2 }, 'Bad Id': { [LAPTOP]: 1 } }, given: 'x' },
      daily: { '2026-11-21': { [LAPTOP]: { bond: ['cafe', 'Bad Id'], gifted: 'x' } } },
    });
    expect(p.friends).toEqual({ cafe: { up: { [LAPTOP]: 12 }, down: {} } });
    expect(p.facts).toEqual({ 'you:latte': NOW });
    expect(p.choices).toEqual({ 'cafe-3-02': { o: 'cafe-3-02-b', at: NOW } });
    expect(p.gifts).toEqual({ bought: { roses: { [LAPTOP]: 2 } }, given: {} });
    expect(p.daily['2026-11-21'][LAPTOP]).toEqual({ talks: 0, lines: 0, first: 0, met: [], paid: [], bond: ['cafe'] });
  });

  it('a version 4 value reads with no friendship', () => {
    const p = parseTownProgress({ version: 4, lines: {}, earned: { [LAPTOP]: 5 } });
    expect(p).toMatchObject({ version: 5, friends: {}, facts: {}, choices: {}, gifts: { bought: {}, given: {} } });
  });
});
