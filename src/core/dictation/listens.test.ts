import { describe, expect, it } from 'vitest';
import { dictationRate } from '../playback';
import { RATE_MAX, RATE_MIN, RATE_STEP, clampRate, rateHint } from '../../features/settings/settingsModel';
import {
  addListen,
  carriedListens,
  firstListenOutcome,
  forgetSentence,
  heardOnce,
  knownAtStart,
  listensLabelVi,
  newListenMemory,
  NO_LISTENS,
  NORMAL_RATE_MIN,
  noteChecked,
  noteListen,
  noteShown,
  rightOnFirstListen,
  tallyKindFor,
  totalListens,
  wasShown,
  type ListenTally,
} from './listens';

const t = (normal = 0, slow = 0, chunks = 0): ListenTally => ({ normal, slow, chunks });

describe('tallyKindFor: "Nghe" counts as normal speed only when Tốc độ đọc is normal', () => {
  it('"Nghe" below the normal-speed boundary is a slowed play', () => {
    expect(tallyKindFor('normal', 1)).toBe('normal');
    expect(tallyKindFor('normal', 1.5)).toBe('normal');
    expect(tallyKindFor('normal', NORMAL_RATE_MIN)).toBe('normal');
    expect(tallyKindFor('normal', 0.9)).toBe('slow');
    expect(tallyKindFor('normal', 0.6)).toBe('slow');
    expect(tallyKindFor('normal', 0.5)).toBe('slow');
  });

  it('"Chậm" and "Từng cụm" keep their own counter at any speed', () => {
    for (const rate of [0.5, 0.9, 1, 1.5]) {
      expect(tallyKindFor('slow', rate)).toBe('slow');
      expect(tallyKindFor('chunks', rate)).toBe('chunks');
    }
  });

  it('uses the same boundary as the hint under the speed slider, on every step of the slider', () => {
    expect(rateHint(NORMAL_RATE_MIN)).toBe('tốc độ thường');
    for (let r = RATE_MIN; r <= RATE_MAX + 1e-9; r += RATE_STEP) {
      const rate = clampRate(r);
      const slowed = tallyKindFor('normal', rate) === 'slow';
      expect(slowed, `rate ${rate}`).toBe(['chậm, dễ nghe', 'hơi chậm'].includes(rateHint(rate)));
    }
  });

  it('judges the Settings rate, not the rate the clip ran at: a level-1 sentence at 1× (played at 0.9×) is normal', () => {
    expect(dictationRate(1, 1)).toBeLessThan(NORMAL_RATE_MIN); // the app's own slow-down of easy sentences
    expect(tallyKindFor('normal', 1)).toBe('normal'); // the caller passes the Settings rate
    expect(tallyKindFor('normal', 0.9)).toBe('slow'); // the learner slowing down still counts, at any level
  });

  it('a single play at 0,6× is neither praised nor a first-listen success', () => {
    const tally = addListen(NO_LISTENS, tallyKindFor('normal', 0.6));
    expect(tally).toEqual(t(0, 1));
    expect(rightOnFirstListen({ score: 1, hinted: false, listens: tally })).toBe(false);
    expect(firstListenOutcome({ listens: tally }, { cloze: false, retry: false, prevAttempts: 0 })).toBe(false);
    expect(listensLabelVi(tally)).toBe('nghe 1 lần (chậm)');
  });
});

describe('addListen', () => {
  it('adds one play without touching the tally it was given', () => {
    const a = t(1);
    expect(addListen(a, 'normal')).toEqual(t(2));
    expect(addListen(a, 'slow')).toEqual(t(1, 1));
    expect(addListen(a, 'chunks')).toEqual(t(1, 0, 1));
    expect(a).toEqual(t(1));
    expect(addListen(undefined, 'normal')).toEqual(t(1));
    expect(addListen(NO_LISTENS, 'slow')).toEqual(t(0, 1));
    expect(NO_LISTENS).toEqual(t(0));
    expect(addListen({ normal: Number.NaN, slow: -1, chunks: 2.7 }, 'normal')).toEqual(t(1, 0, 2));
  });
});

describe('listen tally', () => {
  it('counts every kind of play', () => {
    expect(totalListens(NO_LISTENS)).toBe(0);
    expect(totalListens(t(2, 1, 1))).toBe(4);
    expect(totalListens(undefined)).toBe(0);
    expect(totalListens({ normal: Number.NaN, slow: -2, chunks: 1.9 })).toBe(1);
  });

  it('heard once = exactly one normal-speed play', () => {
    expect(heardOnce(t(1))).toBe(true);
    expect(heardOnce(t(2))).toBe(false);
    expect(heardOnce(t(0))).toBe(false);
    expect(heardOnce(t(1, 1))).toBe(false);
    expect(heardOnce(t(1, 0, 1))).toBe(false);
    expect(heardOnce(t(0, 1))).toBe(false); // one play, but slowed down
    expect(heardOnce(null)).toBe(false);
  });
});

describe('rightOnFirstListen', () => {
  it('needs a perfect, unaided answer after one play', () => {
    expect(rightOnFirstListen({ score: 1, hinted: false, listens: t(1) })).toBe(true);
    expect(rightOnFirstListen({ score: 0.9, hinted: false, listens: t(1) })).toBe(false);
    expect(rightOnFirstListen({ score: 1, hinted: true, listens: t(1) })).toBe(false);
    expect(rightOnFirstListen({ score: 1, hinted: false, revealed: true, listens: t(1) })).toBe(false);
    expect(rightOnFirstListen({ score: 1, hinted: false, listens: t(2) })).toBe(false);
    expect(rightOnFirstListen({ score: 1, hinted: false })).toBe(false);
  });
});

describe('firstListenOutcome', () => {
  const fresh = { cloze: false, retry: false, prevAttempts: 0 };

  it('measures a new sentence that was played', () => {
    expect(firstListenOutcome({ listens: t(1) }, fresh)).toBe(true);
    expect(firstListenOutcome({ listens: t(3) }, fresh)).toBe(false);
    expect(firstListenOutcome({ listens: t(1, 1) }, fresh)).toBe(false);
  });

  it('does not measure memory, retries, cloze or an answer given without listening', () => {
    expect(firstListenOutcome({ listens: t(1) }, { ...fresh, prevAttempts: 2 })).toBeUndefined();
    expect(firstListenOutcome({ listens: t(1) }, { ...fresh, retry: true })).toBeUndefined();
    expect(firstListenOutcome({ listens: t(1) }, { ...fresh, cloze: true })).toBeUndefined();
    expect(firstListenOutcome({ listens: t(0) }, fresh)).toBeUndefined();
    expect(firstListenOutcome({}, fresh)).toBeUndefined();
  });

  it('does not measure a sentence the learner already knew when the exercise started', () => {
    expect(firstListenOutcome({ listens: t(1) }, { ...fresh, known: true })).toBeUndefined();
    expect(firstListenOutcome({ listens: t(4) }, { ...fresh, known: true })).toBeUndefined();
    expect(firstListenOutcome({ listens: t(1) }, { ...fresh, known: false })).toBe(true);
  });
});

// What the dictation page does with the memory, step by step: an exercise starts from the carried plays and from
// "known at start", every play before the check is noted, and the check spends the plays and marks the sentence.
describe('ListenMemory: the plays of a sentence outlive the exercise that made them', () => {
  type Mem = ReturnType<typeof newListenMemory>;
  const start = (m: Mem, id: string, o: { retry?: boolean; own?: boolean } = {}) => ({
    known: knownAtStart(m, id, o),
    retry: !!o.retry,
    listens: carriedListens(m, id),
  });
  /** One mount of the exercise: `plays` presses of "Nghe" at `rate`, then a perfect unaided check (or none). */
  const mount = (m: Mem, id: string, plays: number, o: { retry?: boolean; own?: boolean; rate?: number; check?: boolean } = {}) => {
    const ex = start(m, id, o);
    let listens = ex.listens;
    for (let i = 0; i < plays; i++) listens = noteListen(m, id, tallyKindFor('normal', o.rate ?? 1));
    if (o.check === false) return null;
    const praised = !ex.known && rightOnFirstListen({ score: 1, hinted: false, listens });
    const archived = firstListenOutcome({ listens }, { cloze: false, retry: ex.retry, prevAttempts: 0, known: ex.known });
    noteChecked(m, id);
    return { praised, archived, label: listensLabelVi(listens) };
  };

  it('a new sentence heard once is a first listen', () => {
    const m = newListenMemory();
    expect(mount(m, 's1', 1)).toEqual({ praised: true, archived: true, label: 'nghe 1 lần' });
  });

  it('leaving after 3 plays and coming back: the next play is the 4th, not the 1st', () => {
    const m = newListenMemory();
    expect(mount(m, 's1', 3, { check: false })).toBeNull(); // the page unmounts, nothing was checked
    expect(carriedListens(m, 's1')).toEqual(t(3));
    expect(mount(m, 's1', 1)).toEqual({ praised: false, archived: false, label: 'nghe 4 lần' });
  });

  it('a skipped sentence that returns keeps its plays, and other sentences are not affected', () => {
    const m = newListenMemory();
    mount(m, 's1', 5, { check: false }); // "Bỏ qua"
    expect(mount(m, 's2', 1)).toEqual({ praised: true, archived: true, label: 'nghe 1 lần' });
    expect(mount(m, 's1', 1)).toEqual({ praised: false, archived: false, label: 'nghe 6 lần' });
  });

  it('coming back without playing again still counts the earlier play', () => {
    const m = newListenMemory();
    mount(m, 's1', 1, { check: false });
    // typed after the return with no new play: one play in all, so it is a first listen
    expect(mount(m, 's1', 0)).toEqual({ praised: true, archived: true, label: 'nghe 1 lần' });
  });

  it('a slowed play made before leaving is remembered as slowed', () => {
    const m = newListenMemory();
    mount(m, 's1', 1, { rate: 0.7, check: false });
    expect(mount(m, 's1', 1)).toEqual({ praised: false, archived: false, label: 'nghe 2 lần, có nghe chậm' });
  });

  it('"Làm lại câu này" is never a first listen, and counts its own plays from zero', () => {
    const m = newListenMemory();
    expect(mount(m, 's1', 3)).toEqual({ praised: false, archived: false, label: 'nghe 3 lần' });
    expect(carriedListens(m, 's1')).toEqual(NO_LISTENS); // spent by the check
    expect(mount(m, 's1', 1, { retry: true })).toEqual({ praised: false, archived: undefined, label: 'nghe 1 lần' });
  });

  it('a sentence whose answer was shown is never a first listen again, even when the retry flag is lost', () => {
    const m = newListenMemory();
    mount(m, 's1', 2); // checked: the answer is on screen
    expect(wasShown(m, 's1')).toBe(true);
    // the learner leaves the page and comes back: a fresh exercise of the same sentence, no retry flag
    expect(mount(m, 's1', 1)).toEqual({ praised: false, archived: undefined, label: 'nghe 1 lần' });
    // and again later in the session (the queue came round)
    expect(mount(m, 's1', 1)).toEqual({ praised: false, archived: undefined, label: 'nghe 1 lần' });
  });

  it('"Điền từ" or the hint puts the words on screen: no first listen afterwards', () => {
    const m = newListenMemory();
    noteShown(m, 's1'); // shown in "Điền từ"
    expect(mount(m, 's1', 1)).toEqual({ praised: false, archived: undefined, label: 'nghe 1 lần' });

    // the hint is opened during an exercise that started as new: that exercise is still measured (the hint makes
    // it "not right unaided" by itself), the next one is not
    const ex = start(m, 's2');
    noteListen(m, 's2', 'normal');
    noteShown(m, 's2');
    expect(ex.known).toBe(false);
    expect(mount(m, 's2', 0, { check: false })).toBeNull(); // left without checking
    expect(mount(m, 's2', 0)).toEqual({ praised: false, archived: undefined, label: 'nghe 1 lần' });
  });

  it("the learner's own sentence is never a first listen", () => {
    const m = newListenMemory();
    expect(mount(m, 'custom-1', 1, { own: true })).toEqual({ praised: false, archived: undefined, label: 'nghe 1 lần' });
  });

  it('forgetSentence drops everything known about an id (its words were edited)', () => {
    const m = newListenMemory();
    mount(m, 'c1', 2, { check: false });
    noteShown(m, 'c1');
    forgetSentence(m, 'c1');
    expect(carriedListens(m, 'c1')).toEqual(NO_LISTENS);
    expect(wasShown(m, 'c1')).toBe(false);
    forgetSentence(m, 'never-seen'); // no-op
  });

  it('never hands out the shared empty tally for writing', () => {
    const m = newListenMemory();
    expect(carriedListens(m, 's1')).toBe(NO_LISTENS);
    noteListen(m, 's1', 'normal');
    expect(NO_LISTENS).toEqual(t(0));
    expect(carriedListens(m, 's1')).toEqual(t(1));
  });
});

describe('listensLabelVi', () => {
  it('describes the plays in Vietnamese', () => {
    expect(listensLabelVi(t(0))).toBe('');
    expect(listensLabelVi(null)).toBe('');
    expect(listensLabelVi(t(1))).toBe('nghe 1 lần');
    expect(listensLabelVi(t(0, 1))).toBe('nghe 1 lần (chậm)');
    expect(listensLabelVi(t(3))).toBe('nghe 3 lần');
    expect(listensLabelVi(t(1, 1, 1))).toBe('nghe 3 lần, có nghe chậm');
  });
});
