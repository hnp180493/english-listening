import { describe, expect, it } from 'vitest';
import { storyLinePlayback } from '../../core/town/storyAudio';
import type { TownEpisodeResult, TownEpisodeTurn } from '../../core/town/store';
import { voiceOf } from '../../core/town/voices';
import { TOWN_STORIES } from '../../data/townStories';
import { episodeHeading, episodeSummary, gistFollowUp, gistVerdict, nextListenText, passGap, SAME_SPEAKER_GAP_MS, storyItems, TURN_GAP_MS } from './episodeModel';

const result = (p: Partial<TownEpisodeResult>): TownEpisodeResult => ({
  episodeId: 'cafe-1',
  placeId: 'cafe',
  mode: 'new',
  gistRight: true,
  gistFirstWin: true,
  lines: 6,
  linesRight: 5,
  lineXu: 14,
  gistXu: 5,
  finishXu: 10,
  tasksPaid: [],
  earned: 29,
  balance: 29,
  firstFinish: true,
  stage: 1,
  nextDue: '2026-11-15',
  daysToNext: 1,
  levelTitle: null,
  ...p,
});
const EP = { order: 1, title: 'Ly cà phê đầu tiên' };

describe('what every line of an episode sends', () => {
  it('the text and voice of core/town/storyAudio, the episode level, the bubble on the right head', () => {
    const ep = TOWN_STORIES[0];
    const turns = ep.lines.map((l) => ({ line: { id: l.id, text: l.text, vi: l.vi, level: ep.level }, choices: { options: [l.vi], answer: 0 }, who: l.who, speaker: l.who === 'you' ? 'Bạn' : 'X' })) as TownEpisodeTurn[];
    const items = storyItems(ep, turns);
    expect(items).toHaveLength(ep.lines.length);
    items.forEach((item, i) => {
      const line = ep.lines[i];
      expect(item.audio).toEqual({ connected: storyLinePlayback(line, ep, 'connected').text, careful: storyLinePlayback(line, ep, 'careful').text, level: ep.level });
      expect(item.voice).toEqual(voiceOf(line.who, ep.placeId));
      expect(item.stage).toBe(line.who === 'you' ? 'player' : line.who === 'them' ? ep.placeId : null);
    });
  });
});

describe('the whole exchange', () => {
  it('a breath between two speakers, less for the same one, none before the first line', () => {
    expect(passGap(undefined, { speaker: 'Emma' })).toBe(0);
    expect(passGap({ speaker: 'Emma' }, { speaker: 'Bạn' })).toBe(TURN_GAP_MS);
    expect(passGap({ speaker: 'Emma' }, { speaker: 'Emma' })).toBe(SAME_SPEAKER_GAP_MS);
    expect(SAME_SPEAKER_GAP_MS).toBeLessThan(TURN_GAP_MS);
  });
});

describe('words', () => {
  it('the heading', () => {
    expect(episodeHeading(EP, false)).toBe('Tập 1 · Ly cà phê đầu tiên');
    expect(episodeHeading(EP, true)).toBe('Nghe lại · Tập 1 · Ly cà phê đầu tiên');
  });

  it('praises the first listen only when it was one', () => {
    expect(gistVerdict('new', true, true)).toMatchObject({ tone: 'ok', title: 'Hiểu ý chính ngay lần đầu!', emote: 'heart', sfx: 'first' });
    expect(gistVerdict('new', true, false)).toMatchObject({ tone: 'ok', title: 'Đúng ý chính rồi.', sfx: 'right' });
    expect(gistVerdict('relisten', true, false)).toMatchObject({ tone: 'ok', title: 'Vẫn nắm được ý chính!' });
    expect(gistVerdict('new', false, false)).toMatchObject({ tone: 'bad', sfx: 'wrong' });
    expect(gistFollowUp('new', true)).toBeNull();
    expect(gistFollowUp('new', false)).toBe('Nghe từng câu sẽ rõ hơn.');
    expect(gistFollowUp('relisten', false)).toMatch(/Ngày mai/);
  });

  it('when the episode comes back', () => {
    expect(nextListenText('Emma', 1)).toBe('Emma sẽ kể lại chuyện này ngày mai để bạn nghe lại.');
    expect(nextListenText('Emma', 7)).toBe('Emma sẽ kể lại chuyện này sau 7 ngày để bạn nghe lại.');
    expect(nextListenText('Emma', 0)).toBe('Emma sẽ kể lại chuyện này hôm nay.');
    expect(nextListenText('Emma', null)).toMatch(/không kể lại nữa/);
  });
});

describe('the result card', () => {
  it('a first run: the first-listen gist, the lines, where the xu came from', () => {
    const s = episodeSummary(result({}), EP, true);
    expect(s.title).toBe('Xong Tập 1: Ly cà phê đầu tiên');
    expect(s.checks).toEqual([
      { label: 'Ý chính, ngay lần nghe đầu', tone: 'ok' },
      { label: 'Hiểu 5/6 câu', tone: 'part' },
    ]);
    expect(episodeSummary(result({ gistFirstWin: false, linesRight: 0 }), EP, true).checks.map((c) => c.tone)).toEqual(['bad', 'bad']);
    expect(s.total).toBe(29);
    expect(s.rows).toEqual([
      { label: 'Các câu hiểu được', xu: 14 },
      { label: 'Hiểu ý chính ngay lần đầu', xu: 5 },
      { label: 'Nghe xong tập lần đầu', xu: 10 },
    ]);
  });

  it('a later run says "Ý chính" without the first listen; one source of xu needs no breakdown', () => {
    const s = episodeSummary(result({ gistFirstWin: false, gistXu: 0, finishXu: 0, lineXu: 6, earned: 6, linesRight: 6, firstFinish: false }), EP, false);
    expect(s.checks).toEqual([
      { label: 'Ý chính', tone: 'ok' },
      { label: 'Hiểu 6/6 câu', tone: 'ok' },
    ]);
    expect(s.rows).toEqual([]);
  });

  it('a re-listen: the gist only, the re-listen xu and a task', () => {
    const s = episodeSummary(
      result({ mode: 'relisten', lines: 0, linesRight: 0, lineXu: 0, gistFirstWin: false, gistXu: 3, finishXu: 0, earned: 8, tasksPaid: [{ id: 'talk', label: 'Trò chuyện với 2 người dân', reward: 5 }] }),
      EP,
      false,
    );
    expect(s.title).toBe('Đã nghe lại Tập 1');
    expect(s.checks).toEqual([{ label: 'Ý chính', tone: 'ok' }]);
    expect(s.rows).toEqual([
      { label: 'Nghe lại, vẫn hiểu ý chính', xu: 3 },
      { label: 'Việc hôm nay: Trò chuyện với 2 người dân', xu: 5 },
    ]);
  });
});
