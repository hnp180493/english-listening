import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DictMode } from '../../core/dictation/modes';
import type { ReviewCard } from '../../core/review/types';
import { KEYS, STORAGE_PREFIX } from '../../core/storage';
import { MINE_TOPIC } from './constants';
import {
  hasFilterParams,
  linkedId,
  loadProgressOr,
  paramsOf,
  resolveView,
  reviewGradeFor,
  reviewNoteVi,
  routeSignature,
  scrollBehavior,
  statsOutcome,
  storageEventTouches,
  viewForSentence,
  viewFromParams,
  viewKey,
  withFirst,
  type DictView,
  type LinkedSentence,
} from './pageModel';

const TOPICS = ['Ăn uống', 'Công việc'];
const DEFAULT: DictView = { filters: { mode: 'normal', level: 0, focus: null }, topic: '' };

describe('dictation URL contract', () => {
  it('a link with filter params starts from all topics, even when a topic was picked before', () => {
    const current: DictView = { filters: { mode: 'normal', level: 2, focus: null }, topic: MINE_TOPIC };
    const v = resolveView({ focus: 'h-dropping' }, current, TOPICS);
    expect(v).toEqual({ filters: { mode: 'normal', level: 0, focus: 'h-dropping' }, topic: '' });
    const lv = resolveView({ level: '3' }, { ...current, topic: 'Ăn uống' }, TOPICS);
    expect(lv.topic).toBe('');
    expect(lv.filters.level).toBe(3);
  });

  it('a bare #/dictation keeps the current view (same rule on mount and while open)', () => {
    const current: DictView = { filters: { mode: 'review', level: 1, focus: 'flap-t' }, topic: 'Công việc' };
    expect(resolveView({}, current, TOPICS)).toEqual(current);
    expect(resolveView({ unrelated: 'x' }, current, TOPICS)).toEqual(current);
    // a stale topic that no longer exists falls back to all topics
    expect(resolveView({}, { ...current, topic: 'Gone' }, TOPICS).topic).toBe('');
  });

  it('round-trips the topic through the URL and validates it', () => {
    const v: DictView = { filters: { mode: 'cloze', level: 2, focus: null }, topic: 'Ăn uống' };
    const params = Object.fromEntries(
      Object.entries(paramsOf(v)).filter(([, x]) => x !== undefined).map(([k, x]) => [k, String(x)]),
    );
    expect(params).toEqual({ mode: 'cloze', level: '2', topic: 'Ăn uống' });
    expect(viewFromParams(params, TOPICS)).toEqual(v);
    expect(viewFromParams({ topic: MINE_TOPIC }, TOPICS).topic).toBe(MINE_TOPIC);
    expect(viewFromParams({ topic: 'nope' }, TOPICS).topic).toBe('');
    expect(hasFilterParams({ topic: 'Ăn uống' })).toBe(true);
    expect(hasFilterParams({})).toBe(false);
  });

  it('modes without a topic select leave the topic out of the URL and the key', () => {
    const v: DictView = { filters: { mode: 'review', level: 0, focus: null }, topic: 'Ăn uống' };
    expect(paramsOf(v).topic).toBeUndefined();
    expect(viewKey(v)).toBe(viewKey({ ...v, topic: '' }));
    expect(viewKey({ ...DEFAULT, topic: 'Ăn uống' })).not.toBe(viewKey(DEFAULT));
    expect(viewFromParams({ mode: 'custom', topic: 'Ăn uống' }, TOPICS).topic).toBe('');
  });
});

describe('statsOutcome', () => {
  it('does not record retries of the same sentence', () => {
    expect(statsOutcome({ score: 1, hinted: false }, true).record).toBe(false);
    expect(statsOutcome({ score: 0.5, hinted: false }, false)).toEqual({ record: true, correct: false });
  });

  it('a perfect answer made with the hint is not correct', () => {
    expect(statsOutcome({ score: 1, hinted: true }, false)).toEqual({ record: true, correct: false });
    expect(statsOutcome({ score: 1, hinted: false }, false)).toEqual({ record: true, correct: true });
  });
});

describe('stored progress', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const stubStorage = (data: Record<string, string>) => {
    vi.stubGlobal('window', {
      localStorage: { getItem: (k: string) => (k in data ? data[k] : null) },
    });
  };

  it('reads the stored map fresh instead of the in-memory copy', () => {
    const stored = { s1: { best: 1, attempts: 2, lastAt: 5 } };
    stubStorage({ [STORAGE_PREFIX + KEYS.dictation]: JSON.stringify(stored) });
    expect(loadProgressOr({ old: { best: 0.5, attempts: 1, lastAt: 1 } })).toEqual(stored);
  });

  it('a wiped store (key removed in another tab) reads as empty, not as the stale copy', () => {
    stubStorage({});
    expect(loadProgressOr({ old: { best: 0.5, attempts: 1, lastAt: 1 } })).toEqual({});
  });

  it('falls back to memory when storage cannot be read', () => {
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => {
          throw new Error('blocked');
        },
      },
    });
    const mem = { old: { best: 0.5, attempts: 1, lastAt: 1 } };
    expect(loadProgressOr(mem)).toBe(mem);
  });

  it('matches storage events for its key or a full clear', () => {
    expect(storageEventTouches(null, KEYS.dictation)).toBe(true);
    expect(storageEventTouches(STORAGE_PREFIX + KEYS.dictation, KEYS.dictation)).toBe(true);
    expect(storageEventTouches(STORAGE_PREFIX + KEYS.stats, KEYS.dictation)).toBe(false);
  });
});

describe('scrollBehavior', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('honours prefers-reduced-motion and survives a missing matchMedia', () => {
    vi.stubGlobal('window', { matchMedia: (q: string) => ({ matches: q.includes('reduce') }) });
    expect(scrollBehavior()).toBe('auto');
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) });
    expect(scrollBehavior()).toBe('smooth');
    vi.stubGlobal('window', {});
    expect(scrollBehavior()).toBe('smooth');
  });
});

describe('sentence links (#/dictation?id=…)', () => {
  const builtin: LinkedSentence = { custom: false, topic: 'Ăn uống', cloze: true, review: false };
  const mine: LinkedSentence = { custom: true, topic: '', cloze: true, review: false };
  const view = (mode: DictView['filters']['mode'], topic = '', level: 0 | 1 | 2 | 3 = 0): DictView => ({
    filters: { mode, level, focus: null },
    topic,
  });

  it('only accepts ids the page knows', () => {
    const known = (id: string) => id === 's001' || id === 'u-abc';
    expect(linkedId('s001', known)).toBe('s001');
    expect(linkedId('u-abc', known)).toBe('u-abc');
    expect(linkedId('s999', known)).toBe('');
    expect(linkedId('', known)).toBe('');
    expect(linkedId(undefined, known)).toBe('');
  });

  it('keeps a view that already contains the sentence (same object, so nothing is rebuilt)', () => {
    const n = view('normal', '', 2);
    expect(viewForSentence(n, builtin)).toBe(n);
    const c = view('custom');
    expect(viewForSentence(c, mine)).toBe(c);
    const m = view('normal', MINE_TOPIC);
    expect(viewForSentence(m, mine)).toBe(m);
    const t = view('cloze', 'Ăn uống');
    expect(viewForSentence(t, builtin)).toBe(t);
  });

  it('a built-in sentence linked with mode=custom opens in normal mode, all topics', () => {
    expect(viewForSentence(view('custom', '', 3), builtin)).toEqual(view('normal', '', 3));
  });

  it('a custom sentence linked with mode=normal opens in "Câu của tôi"', () => {
    expect(viewForSentence(view('normal', 'Ăn uống'), mine)).toEqual(view('custom'));
    expect(viewForSentence(view('cloze'), mine)).toEqual(view('custom'));
  });

  it('drops a topic that cannot hold the built-in sentence', () => {
    expect(viewForSentence(view('normal', 'Công việc'), builtin)).toEqual(view('normal'));
    expect(viewForSentence(view('normal', MINE_TOPIC), builtin)).toEqual(view('normal'));
  });

  it('leaves cloze for normal when the sentence has no blank to make', () => {
    expect(viewForSentence(view('cloze'), { ...builtin, cloze: false })).toEqual(view('normal'));
    expect(viewForSentence(view('cloze', MINE_TOPIC), { ...mine, cloze: false })).toEqual(view('normal', MINE_TOPIC));
  });

  it('review mode keeps the sentence only when it needs review', () => {
    const r = view('review');
    expect(viewForSentence(r, { ...builtin, review: true })).toBe(r);
    expect(viewForSentence(r, builtin)).toEqual(view('normal'));
    expect(viewForSentence(r, mine)).toEqual(view('custom'));
  });

  it('the route signature notices a new link but settles once the id is stripped', () => {
    const v = view('normal');
    expect(routeSignature(v, 's001')).not.toBe(routeSignature(v, 's002'));
    expect(routeSignature(v, 's001')).not.toBe(routeSignature(v, ''));
    // without an id it is the plain view key, so the URL sync that drops the id does not change the view
    expect(routeSignature(v, '')).toBe(viewKey(v));
  });

  it('puts the linked sentence first, adding it when the filters left it out', () => {
    expect(withFirst(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c']);
    expect(withFirst(['a', 'b'], 'x')).toEqual(['x', 'a', 'b']);
    expect(withFirst([], 'x')).toEqual(['x']);
  });
});

describe('spaced-review grade of a check (reviewGradeFor)', () => {
  const perfect = { hinted: false, total: 6, matched: 6, extra: 0, revealed: false };
  const at = (mode: DictMode, prevAttempts = 0, retry = false) => ({ mode, retry, prevAttempts });

  it('cloze never grades, a retry is practice only', () => {
    expect(reviewGradeFor(perfect, at('cloze'))).toBeNull();
    expect(reviewGradeFor(perfect, at('normal', 0, true))).toBeNull();
    expect(reviewGradeFor(perfect, at('review', 3, true))).toBeNull();
  });
  it('a first-ever perfect answer is easy, a later one good', () => {
    expect(reviewGradeFor(perfect, at('normal', 0))).toEqual({ grade: 'easy', ctx: 'practice' });
    expect(reviewGradeFor(perfect, at('normal', 1))).toEqual({ grade: 'good', ctx: 'practice' });
    expect(reviewGradeFor(perfect, at('custom', 0))).toEqual({ grade: 'easy', ctx: 'practice' });
  });
  it('"Ôn đến hạn" grades in review context and never as a first try', () => {
    expect(reviewGradeFor(perfect, at('review', 0))).toEqual({ grade: 'good', ctx: 'review' });
    expect(reviewGradeFor({ ...perfect, matched: 5 }, at('review', 2))).toEqual({ grade: 'hard', ctx: 'review' });
  });
  it('grades by error count: hint, one miss, extra words, reveal', () => {
    expect(reviewGradeFor({ ...perfect, hinted: true }, at('normal'))?.grade).toBe('hard');
    expect(reviewGradeFor({ ...perfect, matched: 5 }, at('normal'))?.grade).toBe('hard');
    expect(reviewGradeFor({ ...perfect, extra: 1 }, at('normal'))?.grade).toBe('hard');
    expect(reviewGradeFor({ ...perfect, matched: 4 }, at('normal'))?.grade).toBe('again');
    expect(reviewGradeFor({ ...perfect, total: 3, matched: 2 }, at('normal'))?.grade).toBe('again');
    expect(reviewGradeFor({ ...perfect, matched: 0, revealed: true }, at('normal', 4))?.grade).toBe('again');
  });
  it('a check without word counts is not graded', () => {
    expect(reviewGradeFor({ hinted: false }, at('normal'))).toBeNull();
  });
});

describe('spaced-review line under the exercise (reviewNoteVi)', () => {
  const now = new Date(2026, 10, 6, 21, 0).getTime();
  const card = (interval: number, due: number): ReviewCard => ({ id: 'dict:s1', due, interval, ease: 2.5, reps: 1, lapses: 0, last: now });

  it('says when the sentence comes back', () => {
    const tomorrow = new Date(2026, 10, 7, 21, 0).getTime();
    expect(reviewNoteVi({ reason: 'enrolled', current: card(1, tomorrow) }, now)).toBe(
      'Câu này sẽ quay lại trong Ôn tập ngày mai.',
    );
    const in4 = new Date(2026, 10, 10, 21, 0).getTime();
    expect(reviewNoteVi({ reason: 'graded', current: card(4, in4) }, now)).toBe('Câu này sẽ quay lại trong Ôn tập sau 4 ngày.');
    expect(reviewNoteVi({ reason: 'skipped-not-due', current: card(4, in4) }, now)).toContain('sau 4 ngày');
    expect(reviewNoteVi({ reason: 'pulled-in', current: card(4, tomorrow) }, now)).toContain('ngày mai');
    expect(reviewNoteVi({ reason: 'lapsed', current: card(0, now + 10 * 60_000) }, now)).toContain('sau 10 phút');
  });
  it('explains an answer not added because of the new-card budget', () => {
    expect(reviewNoteVi({ reason: 'over-budget', current: null }, now)).toBe('Bạn đã nhớ câu này. Hôm nay Ôn tập đã đủ mục mới.');
  });
  it('says nothing when nothing is scheduled', () => {
    expect(reviewNoteVi(null, now)).toBeNull();
    expect(reviewNoteVi({ reason: 'not-enrolled', current: null }, now)).toBeNull();
    expect(reviewNoteVi({ reason: 'suspended', current: card(4, now) }, now)).toBeNull();
    expect(reviewNoteVi({ reason: 'graded', current: null }, now)).toBeNull();
  });
});
