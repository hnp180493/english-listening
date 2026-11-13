import { describe, expect, it } from 'vitest';
import { firstListenOutcome, rightOnFirstListen } from '../../core/dictation/listens';
import { lineIsFresh, lineTally, newListenSession, noteLinePlay, noteLineShown } from './lineListens';

const NONE = { done: [] as number[], scores: {} as Record<number, number> };

describe('line plays during one visit', () => {
  it('counts plays per line; below 1× is a slowed play', () => {
    const s = newListenSession({});
    expect(noteLinePlay(s, 2, 1)).toBe(true); // first play this visit: the caller persists "heard"
    expect(noteLinePlay(s, 2, 1)).toBe(false);
    expect(noteLinePlay(s, 2, 0.75)).toBe(false);
    expect(noteLinePlay(s, 5, 0.5)).toBe(true);
    expect(lineTally(s, 2)).toEqual({ normal: 2, slow: 1, chunks: 0 });
    expect(lineTally(s, 5)).toEqual({ normal: 0, slow: 1, chunks: 0 });
    expect(lineTally(s, 9)).toEqual({ normal: 0, slow: 0, chunks: 0 });
  });
});

describe('lineIsFresh', () => {
  it('a line never played, dictated, ticked or shown is a first meeting', () => {
    const s = newListenSession({});
    noteLinePlay(s, 0, 1);
    expect(lineIsFresh(s, 0, NONE)).toBe(true);
    expect(lineIsFresh(s, 1, NONE)).toBe(true);
  });

  it('not when it was played in an earlier visit', () => {
    const s = newListenSession({ heard: [0, 3] });
    noteLinePlay(s, 3, 1);
    expect(lineIsFresh(s, 3, NONE)).toBe(false);
    expect(lineIsFresh(s, 0, NONE)).toBe(false);
    expect(lineIsFresh(s, 1, NONE)).toBe(true);
  });

  it('not when it was dictated or ticked before', () => {
    const s = newListenSession({});
    expect(lineIsFresh(s, 0, { done: [], scores: { 0: 0.4 } })).toBe(false);
    expect(lineIsFresh(s, 1, { done: [1], scores: {} })).toBe(false);
    expect(lineIsFresh(s, 2, { done: [1], scores: { 0: 0.4 } })).toBe(true);
  });

  it('not when its text may have been read: shown in "Nghe & xem", or the whole list with subtitles on', () => {
    const hidden = newListenSession({});
    noteLineShown(hidden, 4, false); // subtitles off: only the line on screen could be revealed
    expect(lineIsFresh(hidden, 4, NONE)).toBe(false);
    expect(lineIsFresh(hidden, 5, NONE)).toBe(true);

    const subs = newListenSession({});
    noteLineShown(subs, 4, true);
    expect(lineIsFresh(subs, 5, NONE)).toBe(false);
    expect(lineIsFresh(subs, 0, NONE)).toBe(false);
  });
});

describe('what the player records (firstListenOutcome with prevAttempts = fresh ? 0 : 1)', () => {
  const outcome = (s: ReturnType<typeof newListenSession>, i: number, retry = false) =>
    firstListenOutcome({ listens: lineTally(s, i) }, { cloze: false, retry, prevAttempts: lineIsFresh(s, i, NONE) ? 0 : 1 });

  it('one play at 1× of a new line is a first listen; a replay or a slowed play is measured as "needed more"', () => {
    const s = newListenSession({});
    noteLinePlay(s, 0, 1);
    expect(outcome(s, 0)).toBe(true);
    expect(rightOnFirstListen({ score: 1, hinted: false, listens: lineTally(s, 0) })).toBe(true);
    noteLinePlay(s, 0, 1);
    expect(outcome(s, 0)).toBe(false);
    noteLinePlay(s, 1, 0.75);
    expect(outcome(s, 1)).toBe(false);
  });

  it('nothing is measured for a known line, a retry, or a line that was not played', () => {
    const s = newListenSession({ heard: [0] });
    noteLinePlay(s, 0, 1);
    expect(outcome(s, 0)).toBeUndefined();
    noteLinePlay(s, 1, 1);
    expect(outcome(s, 1, true)).toBeUndefined();
    expect(outcome(s, 2)).toBeUndefined();
  });
});
