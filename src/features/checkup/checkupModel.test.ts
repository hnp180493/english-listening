import { describe, expect, it } from 'vitest';
import { buildCheckupResult, MAX_PLAYS, type CheckupDraft, type CheckupResult } from '../../core/benchmark';
import { BENCHMARK_FORMS } from '../../data/benchmark';
import type { BenchmarkForm } from '../../data/benchmarkTypes';
import {
  advance,
  beginTest,
  blocker,
  choose,
  chosenOf,
  comparisonFor,
  comparisonSummary,
  currentItem,
  dateVi,
  deltaInfo,
  durationVi,
  newTest,
  nextLabel,
  phenomenonRows,
  playLabel,
  playsLeft,
  playsUsed,
  progressPct,
  recordPlay,
  resumeDraft,
  setTyped,
  stepLabel,
  typedOf,
  weakestPhenomenon,
  type TestState,
} from './checkupModel';

const FORM: BenchmarkForm = BENCHMARK_FORMS[0];
const T0 = new Date(2026, 10, 6, 9, 0).getTime();

/** Play once, type the sentence (or pick the answer) and go next, for every item. */
function runAll(s0: TestState, form: BenchmarkForm, wrong = new Set<number>()) {
  let s = s0;
  let done = false;
  let step = 0;
  while (!done && step < 100) {
    const item = currentItem(s, form)!;
    s = recordPlay(s, form)!;
    if (item.kind === 'sentence') s = setTyped(s, form, wrong.has(step) ? 'something else' : item.sentence.text);
    else s = choose(s, form, wrong.has(step) ? (item.question.answer + 1) % item.question.options.length : item.question.answer);
    ({ state: s, done } = advance(s, form));
    step++;
  }
  return { s, steps: step, done };
}

describe('step machine', () => {
  it('goes intro → 10 sentences → 4 passages → done', () => {
    let s = newTest(FORM.id, T0, 'Ava');
    expect(s.part).toBe('intro');
    expect(currentItem(s, FORM)).toBeNull();
    expect(nextLabel(s, FORM)).toBe('Bắt đầu');
    s = beginTest(s, T0 + 5000);
    expect(s.startedAt).toBe(T0 + 5000);
    expect(stepLabel(s, FORM)).toBe('Câu 1/10');
    expect(progressPct(s, FORM)).toBe(0);
    const { s: end, steps, done } = runAll(s, FORM);
    expect(done).toBe(true);
    expect(steps).toBe(FORM.sentences.length + FORM.questions.length);
    expect(end.part).toBe('comprehension');
    expect(stepLabel(end, FORM)).toBe('Đoạn 4/4');
  });

  it('labels the next button per position', () => {
    let s = beginTest(newTest(FORM.id, T0, null), T0);
    expect(nextLabel(s, FORM)).toBe('Câu tiếp');
    s = { ...s, index: 9 };
    expect(nextLabel(s, FORM)).toBe('Sang phần 2');
    s = advance(s, FORM).state;
    expect(s.part).toBe('comprehension');
    expect(s.index).toBe(0);
    expect(stepLabel(s, FORM)).toBe('Đoạn 1/4');
    expect(nextLabel(s, FORM)).toBe('Đoạn tiếp');
    expect(progressPct(s, FORM)).toBe(Math.round((10 / 14) * 100));
    s = { ...s, index: 3 };
    expect(nextLabel(s, FORM)).toBe('Nộp bài');
  });

  it('blocks "next" until the item was played, then asks once for an empty answer', () => {
    let s = beginTest(newTest(FORM.id, T0, null), T0);
    expect(blocker(s, FORM)).toBe('not-played');
    s = recordPlay(s, FORM)!;
    expect(blocker(s, FORM)).toBe('empty');
    s = setTyped(s, FORM, '   ');
    expect(blocker(s, FORM)).toBe('empty');
    s = setTyped(s, FORM, 'I will grab');
    expect(blocker(s, FORM)).toBeNull();
    expect(typedOf(s, FORM)).toBe('I will grab');

    s = { ...s, part: 'comprehension', index: 0 };
    expect(blocker(s, FORM)).toBe('not-played');
    s = recordPlay(s, FORM)!;
    expect(blocker(s, FORM)).toBe('empty');
    s = choose(s, FORM, 2);
    expect(chosenOf(s, FORM)).toBe(2);
    expect(blocker(s, FORM)).toBeNull();
  });

  it('ignores typing on a passage, choosing on a sentence and invalid options', () => {
    let s = beginTest(newTest(FORM.id, T0, null), T0);
    expect(choose(s, FORM, 1)).toBe(s);
    s = { ...s, part: 'comprehension', index: 0 };
    expect(setTyped(s, FORM, 'x')).toBe(s);
    expect(choose(s, FORM, -1)).toBe(s);
    expect(choose(s, FORM, 99)).toBe(s);
    expect(choose(s, FORM, 1.5)).toBe(s);
  });

  it('caps typed answers at 500 characters', () => {
    const s = setTyped(beginTest(newTest(FORM.id, T0, null), T0), FORM, 'a'.repeat(900));
    expect(typedOf(s, FORM)).toHaveLength(500);
  });
});

describe('play-count limit', () => {
  it(`allows exactly ${MAX_PLAYS} plays per item`, () => {
    let s = beginTest(newTest(FORM.id, T0, null), T0);
    expect(playsLeft(s, FORM)).toBe(2);
    expect(playLabel(playsUsed(s, FORM), false)).toBe('Nghe');
    s = recordPlay(s, FORM)!;
    expect(playsLeft(s, FORM)).toBe(1);
    expect(playLabel(playsUsed(s, FORM), false)).toBe('Nghe (còn 1 lần)');
    s = recordPlay(s, FORM)!;
    expect(playsLeft(s, FORM)).toBe(0);
    expect(playLabel(playsUsed(s, FORM), false)).toBe('Hết lượt nghe');
    expect(recordPlay(s, FORM)).toBeNull();
    expect(playLabel(1, true)).toBe('Đang phát…');
  });

  it('counts plays per item, separately for sentences and passages', () => {
    let s = beginTest(newTest(FORM.id, T0, null), T0);
    s = recordPlay(recordPlay(s, FORM)!, FORM)!;
    s = advance(s, FORM).state;
    expect(playsLeft(s, FORM)).toBe(2);
    s = { ...s, part: 'comprehension', index: 0 };
    s = recordPlay(s, FORM)!;
    expect(s.comprehension[FORM.questions[0].id].plays).toBe(1);
    expect(s.dictation[FORM.sentences[0].id].plays).toBe(2);
  });

  it('records the voice on the first play when the test has none yet, and never replaces it', () => {
    let s = beginTest(newTest(FORM.id, T0, null), T0);
    s = recordPlay(s, FORM, 'Microsoft Ava')!;
    expect(s.voiceName).toBe('Microsoft Ava');
    s = advance(s, FORM).state;
    s = recordPlay(s, FORM, 'Google US English')!;
    expect(s.voiceName).toBe('Microsoft Ava');
  });

  it('has no play on the intro', () => {
    const s = newTest(FORM.id, T0, null);
    expect(playsLeft(s, FORM)).toBe(0);
    expect(recordPlay(s, FORM)).toBeNull();
  });
});

describe('draft resume', () => {
  const draftOf = (s: TestState): CheckupDraft => ({ ...s, savedAt: T0 + 60_000 });

  it('resumes at the same item with the same answers and plays (a reload gives no free play)', () => {
    let s = beginTest(newTest(FORM.id, T0, 'Ava'), T0);
    s = recordPlay(setTyped(recordPlay(s, FORM)!, FORM, 'hello'), FORM)!;
    s = advance(s, FORM).state;
    s = recordPlay(s, FORM)!;
    const back = resumeDraft(draftOf(s), BENCHMARK_FORMS)!;
    expect(back).toEqual(s);
    expect(playsLeft(back, FORM)).toBe(1);
    expect(back.dictation[FORM.sentences[0].id]).toEqual({ typed: 'hello', plays: 2 });
  });

  it('does not resume a draft still on the intro, or of an unknown form', () => {
    expect(resumeDraft(draftOf(newTest(FORM.id, T0, null)), BENCHMARK_FORMS)).toBeNull();
    expect(resumeDraft(null, BENCHMARK_FORMS)).toBeNull();
    const s = beginTest(newTest(FORM.id, T0, null), T0);
    expect(resumeDraft(draftOf(s), [])).toBeNull();
  });

  it('drops foreign ids, clamps plays and invalid choices, and fixes an out-of-range index', () => {
    const s = beginTest(newTest(FORM.id, T0, null), T0);
    const q0 = FORM.questions[0];
    const raw: CheckupDraft = {
      ...draftOf(s),
      index: 42,
      dictation: { [FORM.sentences[0].id]: { typed: 'x', plays: 9 }, 'zz-s01': { typed: 'y', plays: 1 } },
      comprehension: { [q0.id]: { chosen: 17, plays: 1 } },
    };
    const back = resumeDraft(raw, BENCHMARK_FORMS)!;
    expect(back.part).toBe('comprehension');
    expect(back.index).toBe(0);
    expect(back.dictation).toEqual({ [FORM.sentences[0].id]: { typed: 'x', plays: MAX_PLAYS } });
    expect(back.comprehension[q0.id]).toEqual({ chosen: null, plays: 1 });
    const last = resumeDraft({ ...raw, part: 'comprehension', index: 99 }, BENCHMARK_FORMS)!;
    expect(last.index).toBe(FORM.questions.length - 1);
  });
});

describe('result helpers', () => {
  const finish = (form: BenchmarkForm, at: number, wrong: number[], voice: string | null = 'Ava'): CheckupResult => {
    const s = beginTest(newTest(form.id, at - 600_000, voice), at - 600_000);
    const { s: end } = runAll(s, form, new Set(wrong));
    return buildCheckupResult({ form, dictation: end.dictation, comprehension: end.comprehension, voiceName: end.voiceName, startedAt: end.startedAt, now: at, id: 'k-' + at });
  };

  it('scores a full run: all right = 100, wrong items lower both parts', () => {
    const perfect = finish(FORM, T0, []);
    expect(perfect.score).toBe(100);
    expect(perfect.dictation.items).toHaveLength(10);
    expect(perfect.comprehension.correct).toBe(4);
    expect(weakestPhenomenon(perfect)).toBeNull();
    const some = finish(FORM, T0, [0, 3, 7, 11]);
    expect(some.comprehension.correct).toBe(3);
    expect(some.dictation.pct).toBeLessThan(100);
    expect(some.score).toBeLessThan(100);
    const rows = phenomenonRows(some, null);
    expect(rows.length).toBeGreaterThan(0);
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].missPct).toBeGreaterThanOrEqual(rows[i].missPct);
    expect(weakestPhenomenon(some)).toBe(rows.find((r) => r.missed > 0 && r.seen >= 2)?.p ?? rows[0].p);
  });

  it('compares with the first and the previous test, and says baseline for the first one', () => {
    const DAY = 86_400_000;
    const a = finish(BENCHMARK_FORMS[0], T0, [0, 1, 2, 3, 4, 10, 11]);
    const b = finish(BENCHMARK_FORMS[1], T0 + 14 * DAY, [0, 1, 10]);
    const c = finish(BENCHMARK_FORMS[2], T0 + 28 * DAY, [0], 'Google US English');
    const list = [c, a, b];
    const first = comparisonFor(list, a.id)!;
    expect(first.cmp.isBaseline).toBe(true);
    expect(comparisonSummary(first)).toMatch(/mốc/);
    const second = comparisonFor(list, b.id)!;
    expect(second.prev?.id).toBe(a.id);
    expect(second.count).toBe(2);
    const third = comparisonFor(list, c.id)!;
    expect(third.first.id).toBe(a.id);
    expect(third.prev?.id).toBe(b.id);
    expect(third.cmp.voiceChanged).toBe(true);
    expect(third.cmp.vsFirst!.score).toBe(c.score - a.score);
    expect(comparisonSummary(third)).toContain(`${a.score}`);
    expect(phenomenonRows(c, third.cmp).some((r) => r.firstMissPct !== null)).toBe(true);
    expect(comparisonFor(list, 'nope')).toBeNull();
  });

  it('hedges small changes and short histories', () => {
    expect(deltaInfo(2)).toEqual({ text: '+2 điểm', tone: 'up', small: true });
    expect(deltaInfo(-12)).toEqual({ text: '−12 điểm', tone: 'down', small: false });
    expect(deltaInfo(0).text).toBe('không đổi');
    expect(deltaInfo(Number.NaN).tone).toBe('flat');
    const mk = (id: string, at: number, score: number): CheckupResult => ({ ...finish(FORM, at, []), id, score });
    const a = mk('a', T0, 50);
    const b = mk('b', T0 + 1, 52);
    expect(comparisonSummary(comparisonFor([a, b], 'b')!)).toMatch(/chưa thay đổi rõ/);
    // one comprehension answer (10 points) is still noise
    expect(comparisonSummary(comparisonFor([a, mk('b2', T0 + 1, 60)], 'b2')!)).toMatch(/chưa thay đổi rõ/);
    const c = mk('c', T0 + 1, 64);
    expect(comparisonSummary(comparisonFor([a, c], 'c')!)).toMatch(/Mới có 2 lần/);
    expect(comparisonSummary(comparisonFor([a, c], 'c')!)).not.toMatch(/bản ngữ/);
  });

  it('formats durations and dates in Vietnamese', () => {
    expect(durationVi(45)).toBe('45 giây');
    expect(durationVi(580)).toBe('9 phút 40 giây');
    expect(durationVi(600)).toBe('10 phút');
    expect(durationVi(3700)).toBe('1 giờ 1 phút');
    expect(durationVi(Number.NaN)).toBe('0 giây');
    expect(dateVi(T0)).toBe('06/11/2026');
  });
});

describe('option order', () => {
  it('shuffles per attempt, stays stable for the same test, and keeps every option', async () => {
    const { optionOrder } = await import('./checkupModel');
    const q = { id: 'bA-q1', options: ['a', 'b', 'c', 'd'] };
    const o1 = optionOrder({ startedAt: 1 }, q);
    expect([...o1].sort()).toEqual([0, 1, 2, 3]);
    expect(optionOrder({ startedAt: 1 }, q)).toEqual(o1);
    const seen = new Set<string>();
    for (let t = 0; t < 40; t++) seen.add(optionOrder({ startedAt: 1000 + t * 7919 }, q).join(''));
    expect(seen.size).toBeGreaterThan(8);
    // the right answer lands on every position across attempts
    const pos = new Set<number>();
    for (let t = 0; t < 40; t++) pos.add(optionOrder({ startedAt: 1000 + t * 7919 }, q).indexOf(1));
    expect(pos.size).toBe(4);
  });
});
