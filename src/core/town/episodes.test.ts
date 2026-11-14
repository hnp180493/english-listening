import { describe, expect, it, vi } from 'vitest';
import type { StoryEpisode } from './story';

// Fixed episodes, so the rules are tested apart from the content (data/townStories grows on its own).
vi.mock('../../data/townStories', () => {
  const ep = (id: string, placeId: string, order: number, lines: [string, string, string][], answer: 0 | 1 | 2): StoryEpisode => ({
    id,
    placeId,
    order,
    title: `Tập ${id}`,
    scene: 'Một buổi sáng.',
    level: 1,
    lines: lines.map(([who, text, vi], i) => ({ id: `${id}-0${i + 1}`, who, text, vi })),
    gist: { q: 'Chuyện gì?', options: ['Ý A', 'Ý B', 'Ý C'], answer },
  });
  const TOWN_STORIES: StoryEpisode[] = [
    ep(
      'cafe-1',
      'cafe',
      1,
      [
        ['them', 'What can I get you?', 'Bạn dùng gì?'],
        ['you', 'A latte, please.', 'Cho tôi một ly latte.'],
        ['them', 'Hot or iced?', 'Nóng hay đá?'],
        ['shop', 'Hey, Emma!', 'Chào Emma!'],
      ],
      1,
    ),
    ep(
      'cafe-2',
      'cafe',
      2,
      [
        ['them', 'The usual?', 'Như mọi khi hả?'],
        ['you', 'Yes, thanks.', 'Ừ, cảm ơn.'],
        ['them', 'Coming right up.', 'Có ngay đây.'],
      ],
      0,
    ),
    ep(
      'shop-1',
      'shop',
      1,
      [
        ['them', 'Can I help you?', 'Tôi giúp gì được bạn?'],
        ['you', 'Just looking.', 'Tôi chỉ xem thôi.'],
        ['them', 'Take your time.', 'Cứ thong thả nhé.'],
      ],
      2,
    ),
  ];
  return {
    TOWN_STORIES,
    storiesOfPlace: (placeId: string) => TOWN_STORIES.filter((e) => e.placeId === placeId).sort((a, b) => a.order - b.order),
    storyEpisode: (id: string) => TOWN_STORIES.find((e) => e.id === id),
  };
});

const { TOWN_STORIES } = await import('../../data/townStories');
const {
  applyEpisodeFinish,
  applyEpisodeGist,
  daysUntilRelisten,
  EPISODE_FINISH_XU,
  EPISODE_GIST_FIRST_XU,
  EPISODE_RELISTEN_XU,
  episodeDueDay,
  gistChoices,
  isEpisodeDue,
  isEpisodeUnlocked,
  nextEpisode,
  RELISTEN_DAYS,
  speakerName,
  speakerOnStage,
  storyChoices,
} = await import('./episodes');
const { addBought, addEarned, dailyCount, earnedTotal, emptyTownProgress, episodeProgress, EPISODE_MAX_STAGE, townDay, updateEpisode } = await import('./progress');
const { allStoryLines, episodeTownLines, placeStoryLines, storyLineById } = await import('./storyLines');
const { storyTotals, townXp } = await import('./economy');

const DEV = 'd-test0001';
const NOW = new Date(2026, 10, 13, 12, 0).getTime();
const DAY = 86_400_000;
const [CAFE1, CAFE2, SHOP1] = TOWN_STORIES;
const at = (days: number, hour = 12) => new Date(2026, 10, 13 + days, hour, 0).getTime();

describe('the schedule of re-listens', () => {
  const e = (stage: number, last: number, ok = last) => ({ stage, at: last, okAt: ok, firstGist: 2 as const, bestLines: 3 });

  it('after the finish: 1, 3, 7, 21 days, then nothing more', () => {
    expect(RELISTEN_DAYS).toEqual([1, 3, 7, 21]);
    expect(episodeDueDay(undefined)).toBeNull();
    expect(episodeDueDay({ stage: 0, at: 0, okAt: 0, firstGist: 1, bestLines: 0 })).toBeNull();
    expect(episodeDueDay(e(1, NOW))).toBe('2026-11-14');
    expect(episodeDueDay(e(2, NOW))).toBe('2026-11-16');
    expect(episodeDueDay(e(3, NOW))).toBe('2026-11-20');
    expect(episodeDueDay(e(4, NOW))).toBe('2026-12-04');
    expect(episodeDueDay(e(EPISODE_MAX_STAGE, NOW))).toBeNull();
  });

  it('counts local days: due from the start of its day, late in the evening or early in the morning alike', () => {
    expect(episodeDueDay(e(1, at(0, 23)))).toBe('2026-11-14');
    expect(isEpisodeDue(e(1, at(0, 23)), at(1, 0))).toBe(true);
    expect(isEpisodeDue(e(1, at(0, 1)), at(0, 23))).toBe(false);
    expect(isEpisodeDue(e(2, NOW), at(2))).toBe(false);
    expect(isEpisodeDue(e(2, NOW), at(3, 0))).toBe(true);
    expect(isEpisodeDue(e(2, NOW), at(30))).toBe(true); // overdue stays due
  });

  it('a re-listen whose gist was not right comes back the next day, at the same stage', () => {
    expect(episodeDueDay(e(3, at(2), at(0)))).toBe('2026-11-16');
  });

  it('days until the next re-listen', () => {
    expect(daysUntilRelisten(e(2, NOW), NOW)).toBe(3);
    expect(daysUntilRelisten(e(1, NOW), at(1))).toBe(0);
    expect(daysUntilRelisten(e(EPISODE_MAX_STAGE, NOW), NOW)).toBeNull();
  });
});

describe('which episode a conversation is', () => {
  const finished = (p = emptyTownProgress(), id = 'cafe-1', when = NOW) => updateEpisode(p, id, (x) => ({ ...x, stage: 1, at: when, okAt: when }));

  it('episode 1 is open from the start, episode 2 once episode 1 is finished', () => {
    const p = emptyTownProgress();
    expect(isEpisodeUnlocked(p, CAFE1)).toBe(true);
    expect(isEpisodeUnlocked(p, CAFE2)).toBe(false);
    // begun (the gist answered) is not finished
    expect(isEpisodeUnlocked(updateEpisode(p, 'cafe-1', (x) => ({ ...x, firstGist: 2 })), CAFE2)).toBe(false);
    expect(isEpisodeUnlocked(finished(), CAFE2)).toBe(true);
    expect(isEpisodeUnlocked(p, { id: 'nope-1', placeId: 'cafe' })).toBe(false);
  });

  it('the next episode to hear, a due re-listen before it, nothing once all is heard and nothing is due', () => {
    const p0 = emptyTownProgress();
    expect(nextEpisode(p0, 'cafe', NOW)).toEqual({ episode: CAFE1, mode: 'new' });
    const p1 = finished(p0);
    // the same day: episode 2 (episode 1 comes back tomorrow)
    expect(nextEpisode(p1, 'cafe', NOW)).toEqual({ episode: CAFE2, mode: 'new' });
    // tomorrow: the re-listen of episode 1 first
    expect(nextEpisode(p1, 'cafe', at(1))).toEqual({ episode: CAFE1, mode: 'relisten' });
    const p2 = finished(p1, 'cafe-2', NOW);
    expect(nextEpisode(p2, 'cafe', NOW)).toBeNull();
    // both due: the one due longest first
    const p3 = finished(finished(p0, 'cafe-1', at(-3)), 'cafe-2', at(-1));
    expect(nextEpisode(p3, 'cafe', NOW)).toEqual({ episode: CAFE1, mode: 'relisten' });
  });

  it('an empty lot has no episode; built, it has its own; a place without stories has none', () => {
    expect(nextEpisode(emptyTownProgress(), 'shop', NOW)).toBeNull();
    expect(nextEpisode(addBought(emptyTownProgress(), 'shop'), 'shop', NOW)).toEqual({ episode: SHOP1, mode: 'new' });
    expect(nextEpisode(emptyTownProgress(), 'square', NOW)).toBeNull();
    expect(nextEpisode(emptyTownProgress(), 'nowhere', NOW)).toBeNull();
  });
});

describe('who says a line', () => {
  it('names and the head the bubble goes over', () => {
    expect(speakerName('them', 'cafe')).toBe('Emma');
    expect(speakerName('you', 'cafe')).toBe('Bạn');
    expect(speakerName('shop', 'cafe')).toBe('Ben');
    expect(speakerOnStage('them', 'cafe')).toBe('cafe');
    expect(speakerOnStage('you', 'cafe')).toBe('player');
    expect(speakerOnStage('shop', 'cafe')).toBeNull();
  });
});

describe('the lines as town lines', () => {
  it('carry the episode level, no sentence id, and are found by id', () => {
    const lines = episodeTownLines(CAFE1);
    expect(lines.map((l) => l.id)).toEqual(['cafe-1-01', 'cafe-1-02', 'cafe-1-03', 'cafe-1-04']);
    expect(lines[0]).toEqual({ id: 'cafe-1-01', text: 'What can I get you?', vi: 'Bạn dùng gì?', level: 1 });
    expect(episodeTownLines(CAFE1)).toBe(lines);
    expect(placeStoryLines('cafe')).toHaveLength(7);
    expect(allStoryLines()).toHaveLength(10);
    expect(storyLineById('cafe-2-03')?.episode).toBe(CAFE2);
    expect(storyLineById('s001')).toBeUndefined();
  });

  it('count for xp like any line (hearts stay on the place sentences)', () => {
    let p = emptyTownProgress();
    expect(storyTotals(p)).toEqual({ total: 10, understood: 0, first: 0 });
    p = { ...p, lines: { 'cafe-1-01': { best: 2, tries: 1, at: NOW }, 'cafe-1-02': { best: 1, tries: 2, at: NOW } } };
    expect(storyTotals(p)).toEqual({ total: 10, understood: 2, first: 1 });
    expect(townXp(p)).toBe(3 + 2);
  });
});

describe('the meanings', () => {
  it('a line: its own meaning and two others from the stories of the place, deterministic, never twice the same spot', () => {
    for (const line of placeStoryLines('cafe')) {
      const ep = storyLineById(line.id)!.episode;
      const c = storyChoices(line.id, ep, 0);
      expect(c.options).toHaveLength(3);
      expect(new Set(c.options).size).toBe(3);
      expect(c.options[c.answer]).toBe(line.vi);
      const pool = new Set(placeStoryLines('cafe').map((l) => l.vi));
      for (const o of c.options) expect(pool.has(o)).toBe(true);
      expect(storyChoices(line.id, ep, 0)).toEqual(c);
      expect(storyChoices(line.id, ep, 1).answer).not.toBe(c.answer);
    }
    expect(storyChoices('nope', CAFE1, 0)).toEqual({ options: [], answer: 0 });
  });

  it('the gist: the three authored options, the right one where `answer` says, moved by the seed', () => {
    for (const ep of TOWN_STORIES) {
      const seen = new Set<number>();
      for (let s = 0; s < 3; s++) {
        const g = gistChoices(ep, s);
        expect([...g.options].sort()).toEqual([...ep.gist.options].sort());
        expect(g.options[g.answer]).toBe(ep.gist.options[ep.gist.answer]);
        expect(gistChoices(ep, s + 1).answer).not.toBe(g.answer);
        seen.add(g.answer);
      }
      expect(seen.size).toBe(3);
    }
  });
});

describe('the gist, the finish and a re-listen', () => {
  it('the gist right after one whole listen, on the very first listen: the win, +5 xu, once', () => {
    const p0 = emptyTownProgress();
    const g = applyEpisodeGist(p0, CAFE1, 'new', true, 1, NOW, DEV);
    expect(p0).toEqual(emptyTownProgress());
    expect(g).toMatchObject({ firstWin: true, reward: EPISODE_GIST_FIRST_XU, tasksPaid: [] });
    expect(episodeProgress(g.progress, 'cafe-1')).toEqual({ stage: 0, at: 0, okAt: 0, firstGist: 2, bestLines: 0 });
    expect(earnedTotal(g.progress)).toBe(5);
    // a later run of the same episode: heard before, nothing more
    const again = applyEpisodeGist(g.progress, CAFE1, 'new', true, 1, NOW + 1, DEV);
    expect(again).toMatchObject({ firstWin: false, reward: 0 });
    expect(again.progress).toBe(g.progress);
  });

  it('right only after two whole listens, or wrong: marked "not on the first listen", nothing paid', () => {
    for (const [right, passes] of [
      [true, 2],
      [false, 1],
    ] as const) {
      const g = applyEpisodeGist(emptyTownProgress(), CAFE1, 'new', right, passes, NOW, DEV);
      expect(g).toMatchObject({ firstWin: false, reward: 0 });
      expect(episodeProgress(g.progress, 'cafe-1')?.firstGist).toBe(1);
      expect(earnedTotal(g.progress)).toBe(0);
    }
  });

  it('the first finish: stage 1, +10 xu, a conversation for the daily task; a second finish pays nothing more', () => {
    const f = applyEpisodeFinish(emptyTownProgress(), CAFE1, 3, NOW, DEV);
    expect(f).toMatchObject({ firstFinish: true, reward: EPISODE_FINISH_XU });
    expect(episodeProgress(f.progress, 'cafe-1')).toEqual({ stage: 1, at: NOW, okAt: NOW, firstGist: 0, bestLines: 3 });
    expect(dailyCount(f.progress, townDay(NOW), DEV)).toMatchObject({ talks: 1, met: ['cafe'] });
    expect(earnedTotal(f.progress)).toBe(10);
    const g = applyEpisodeFinish(f.progress, CAFE1, 2, NOW + 5, DEV);
    expect(g).toMatchObject({ firstFinish: false, reward: 0 });
    expect(episodeProgress(g.progress, 'cafe-1')?.bestLines).toBe(3); // the best run is kept
    expect(earnedTotal(g.progress)).toBe(10);
  });

  it('two finishes at two places in a day pay the "talk to 2 residents" task', () => {
    let p = addEarned(addBought(emptyTownProgress(), 'shop'), DEV, 30);
    p = applyEpisodeFinish(p, CAFE1, 4, NOW, DEV).progress;
    const r = applyEpisodeFinish(p, SHOP1, 3, NOW + 1, DEV);
    expect(r.tasksPaid.map((t) => t.id)).toEqual(['talk']);
  });

  it('a finish at an empty lot does nothing', () => {
    const p = emptyTownProgress();
    expect(applyEpisodeFinish(p, SHOP1, 3, NOW, DEV)).toEqual({ progress: p, firstFinish: false, reward: 0, tasksPaid: [] });
  });

  it('re-listens: a right gist moves a stage on (+3 xu), a wrong one brings it back tomorrow; four right ones and it is done', () => {
    let p = applyEpisodeFinish(emptyTownProgress(), CAFE1, 4, NOW, DEV).progress;
    const xu0 = earnedTotal(p);
    // not finished: a re-listen of another episode changes nothing
    expect(applyEpisodeGist(p, CAFE2, 'relisten', true, 1, at(1), DEV).progress).toBe(p);

    const miss = applyEpisodeGist(p, CAFE1, 'relisten', false, 1, at(1), DEV);
    expect(miss.reward).toBe(0);
    expect(episodeProgress(miss.progress, 'cafe-1')).toMatchObject({ stage: 1, at: at(1), okAt: NOW });
    expect(episodeDueDay(episodeProgress(miss.progress, 'cafe-1'))).toBe('2026-11-15');
    expect(dailyCount(miss.progress, townDay(at(1)), DEV).met).toEqual(['cafe']);
    p = miss.progress;

    let when = at(2);
    for (const stage of [2, 3, 4, 5]) {
      expect(isEpisodeDue(episodeProgress(p, 'cafe-1'), when)).toBe(true);
      const r = applyEpisodeGist(p, CAFE1, 'relisten', true, 1, when, DEV);
      expect(r.reward).toBe(EPISODE_RELISTEN_XU);
      expect(episodeProgress(r.progress, 'cafe-1')).toMatchObject({ stage, at: when, okAt: when });
      p = r.progress;
      when += (RELISTEN_DAYS[stage - 1] ?? 0) * DAY;
    }
    expect(episodeDueDay(episodeProgress(p, 'cafe-1'))).toBeNull();
    expect(earnedTotal(p) - xu0).toBe(4 * EPISODE_RELISTEN_XU);
  });
});

describe('updateEpisode', () => {
  it('never lowers a field and refuses a bad id', () => {
    const p = updateEpisode(emptyTownProgress(), 'cafe-1', (e) => ({ ...e, stage: 3, at: 50, okAt: 40, firstGist: 2, bestLines: 4 }));
    const q = updateEpisode(p, 'cafe-1', () => ({ stage: 1, at: 10, okAt: 10, firstGist: 1, bestLines: 1 }));
    expect(q).toBe(p);
    expect(updateEpisode(p, 'Bad Id', (e) => ({ ...e, stage: 1 }))).toBe(p);
    expect(updateEpisode(p, '__proto__', (e) => ({ ...e, stage: 1 }))).toBe(p);
    expect(updateEpisode(p, 'cafe-2', (e) => e)).toBe(p); // nothing to keep
  });
});
