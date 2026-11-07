import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BenchmarkForm, BenchmarkFormId } from '../data/benchmarkTypes';
import {
  buildCheckupResult,
  checkSentence,
  checkupDue,
  combinedScore,
  compare,
  compareAll,
  formatDeltaVi,
  nextForm,
  parseCheckups,
  sanitizeResult,
  scoreComprehension,
  scoreDictation,
  type CheckupResult,
} from './benchmark';
import { STORAGE_PREFIX } from './storage';
import { mergeCheckups, mergeValue } from './syncMerge';

const P = STORAGE_PREFIX;
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
const NOW = at(2026, 11, 6, 20);

// Small inline fixtures (the real content lives in src/data/benchmark.ts).
const FORM: BenchmarkForm = {
  id: 'A',
  sentences: [
    { id: 'tA-s1', text: 'I want to turn it off.', vi: 'Tôi muốn tắt nó.', level: 1, focus: ['reduction', 'linking'] },
    { id: 'tA-s2', text: 'Did you get a lot of water?', vi: 'Bạn có lấy nhiều nước không?', level: 2, focus: ['assimilation', 'flap-t'] },
  ],
  questions: [
    { id: 'tA-q1', lines: ['Hi, it is me.'], question: 'Ai gọi?', options: ['A', 'B', 'C'], answer: 1, why: 'x', focus: ['linking'] },
    { id: 'tA-q2', lines: ['See you at six.'], question: 'Mấy giờ?', options: ['5', '6', '7', '8'], answer: 1, why: 'x', focus: [] },
  ],
};
const form = (id: BenchmarkFormId): Pick<BenchmarkForm, 'id'> => ({ id });
const FORMS = (['A', 'B', 'C', 'D', 'E', 'F'] as BenchmarkFormId[]).map(form);

function result(over: Partial<CheckupResult> & { at: number }): CheckupResult {
  const base = buildCheckupResult({
    form: FORM,
    dictation: { 'tA-s1': { typed: 'I want to turn it off', plays: 1 } },
    comprehension: { 'tA-q1': { chosen: 1, plays: 1 } },
    voiceName: 'Samantha',
    startedAt: over.at - 600_000,
    now: over.at,
  });
  return { ...base, ...over };
}

function stubWindow() {
  const map = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    },
    addEventListener: () => {},
  });
  return map;
}

async function fresh() {
  vi.resetModules();
  return import('./benchmark');
}

describe('scoring', () => {
  it('scores one sentence by words, accepting contractions/reductions and typos', () => {
    const exact = checkSentence(FORM.sentences[0], 'I wanna turn it off', 2);
    expect(exact.item).toMatchObject({ correctWords: 6, totalWords: 6, extraWords: 0, plays: 2 });
    expect(exact.pct).toBe(100);
    expect(exact.missed).toEqual([]);
    expect(exact.seen.length).toBeGreaterThan(0);
    const miss = checkSentence(FORM.sentences[0], 'I want to turn', 5);
    expect(miss.item).toMatchObject({ correctWords: 4, totalWords: 6, plays: 2 }); // plays capped at MAX_PLAYS
    expect(miss.missed).toContain('linking'); // "it off" → tur-ni-doff
    expect(miss.units.some((u) => u.kind === 'missing')).toBe(true);
    const extra = checkSentence(FORM.sentences[0], 'I want to turn it off now please');
    expect(extra.item.extraWords).toBe(2);
    expect(extra.pct).toBe(75); // 6 / (6 + 2)
  });

  it('combines dictation and comprehension 60/40', () => {
    expect(combinedScore(80, 50)).toBe(68);
    expect(combinedScore(100, 100)).toBe(100);
    expect(combinedScore(-5, 150)).toBe(40);
    expect(combinedScore(NaN, 25)).toBe(10);
  });

  it('counts unanswered items as wrong and dedupes phenomena per sentence', () => {
    const d = scoreDictation(FORM.sentences, { 'tA-s1': { typed: 'I want to turn it off', plays: 1 } });
    expect(d.words).toBe(6 + 7);
    expect(d.correct).toBe(6);
    expect(d.pct).toBe(Math.round((6 / 13) * 100));
    for (const v of Object.values(d.byPhenomenon)) {
      expect(v.seen).toBeLessThanOrEqual(2);
      expect(v.missed).toBeLessThanOrEqual(v.seen);
    }
    // s2 unanswered: everything it contains is missed; s1 was perfect
    for (const p of checkSentence(FORM.sentences[1], '').seen) expect(d.byPhenomenon[p].missed).toBe(1);
    expect(Object.values(d.byPhenomenon).reduce((n, v) => n + v.missed, 0)).toBe(new Set(checkSentence(FORM.sentences[1], '').seen).size);
    const c = scoreComprehension(FORM.questions, { 'tA-q1': { chosen: 1, plays: 2 }, 'tA-q2': { chosen: 9, plays: 1 } });
    expect(c).toMatchObject({ correct: 1, total: 2, pct: 50 });
    expect(c.items[1]).toEqual({ id: 'tA-q2', chosen: null, correct: false, plays: 1 });
  });

  it('builds the saved record', () => {
    const r = buildCheckupResult({
      form: FORM,
      dictation: { 'tA-s1': { typed: 'I want to turn it off', plays: 1 }, 'tA-s2': { typed: 'Did you get a lot of water', plays: 2 } },
      comprehension: { 'tA-q1': { chosen: 1, plays: 1 }, 'tA-q2': { chosen: 1, plays: 1 } },
      voiceName: 'Samantha',
      startedAt: NOW - 9 * 60_000,
      now: NOW,
      id: 'k1',
    });
    expect(r).toMatchObject({ id: 'k1', at: NOW, form: 'A', rate: 1, score: 100, durationSec: 540, completed: true, voiceName: 'Samantha' });
    expect(r.dictation).toMatchObject({ words: 13, correct: 13, pct: 100 });
    expect(r.comprehension).toMatchObject({ correct: 2, total: 2, pct: 100 });
    expect(sanitizeResult(r)).toEqual(r);
  });
});

describe('sanitizing', () => {
  it('drops unfinished or broken results and clamps numbers', () => {
    const good = result({ at: NOW, id: 'k1' });
    expect(sanitizeResult({ ...good, completed: false })).toBeNull();
    expect(sanitizeResult({ ...good, form: 'Z' })).toBeNull();
    expect(sanitizeResult({ ...good, at: 'x' })).toBeNull();
    const odd = sanitizeResult({ ...good, score: 140, dictation: { words: 10, correct: 50, items: 'x' }, byPhenomenon: { linking: { seen: 2, missed: 9 } } })!;
    expect(odd.score).toBe(100);
    expect(odd.dictation).toMatchObject({ words: 10, correct: 10, pct: 100, items: [] });
    expect(odd.byPhenomenon.linking).toEqual({ seen: 2, missed: 2 });
    expect(parseCheckups({ results: [good, good, null, result({ at: NOW - 5, id: 'k0' })] }).map((r) => r.id)).toEqual(['k0', 'k1']);
    expect(parseCheckups('junk')).toEqual([]);
  });
});

describe('rotation and cadence', () => {
  it('takes never-used forms first in order, then the least recently used', () => {
    expect(nextForm([], FORMS)?.id).toBe('A');
    expect(nextForm([{ form: 'A', at: 1 }, { form: 'C', at: 2 }], FORMS)?.id).toBe('B');
    const all = FORMS.map((f, i) => ({ form: f.id, at: 10 + i }));
    expect(nextForm(all, FORMS)?.id).toBe('A');
    expect(nextForm([...all, { form: 'A', at: 99 }], FORMS)?.id).toBe('B');
    expect(nextForm([], [])).toBeNull();
  });

  it('asks for a baseline after onboarding, then every 14 days', () => {
    expect(checkupDue([], NOW, false)).toEqual({ kind: null, daysSince: null, lastAt: null, nextDueAt: null });
    expect(checkupDue([], NOW, true).kind).toBe('baseline');
    const last = at(2026, 10, 23, 21);
    expect(checkupDue([{ at: last }], NOW, true)).toEqual({ kind: 'due', daysSince: 14, lastAt: last, nextDueAt: at(2026, 11, 6, 0) });
    expect(checkupDue([{ at: last }, { at: at(2026, 11, 1) }], NOW, true)).toMatchObject({ kind: null, daysSince: 5 });
    expect(checkupDue([{ at: NOW + 1000 }], NOW, true)).toMatchObject({ kind: null, daysSince: 0 });
  });
});

describe('comparison', () => {
  const first = result({ at: at(2026, 9, 1), id: 'k1', score: 54 });
  const prev = result({ at: at(2026, 10, 1), id: 'k2', score: 60 });
  const latest = result({ at: at(2026, 11, 1), id: 'k3', score: 66 });

  it('says when there is only a baseline', () => {
    const c = compareAll([first])!;
    expect(c.isBaseline).toBe(true);
    expect(c.vsFirst).toBeNull();
    expect(c.vsPrev).toBeNull();
    expect(c.phenomena).toEqual([]);
    expect(compareAll([])).toBeNull();
  });

  it('computes deltas against the previous and the first test', () => {
    const c = compareAll([latest, first, prev])!; // any order in
    expect(c.latest.id).toBe('k3');
    expect(c.vsFirst?.score).toBe(12);
    expect(c.vsPrev?.score).toBe(6);
    expect(c.voiceChanged).toBe(false);
    expect(formatDeltaVi(12)).toBe('+12 điểm');
    expect(formatDeltaVi(-3, '%')).toBe('−3 %');
    expect(formatDeltaVi(0)).toBe('không đổi');
  });

  it('reports per-phenomenon change and a voice change', () => {
    const a = { ...first, byPhenomenon: { ...first.byPhenomenon, linking: { seen: 5, missed: 3 }, 'flap-t': { seen: 2, missed: 1 } } };
    const b = { ...latest, voiceName: 'Daniel', byPhenomenon: { ...latest.byPhenomenon, linking: { seen: 5, missed: 1 }, 'flap-t': { seen: 2, missed: 1 } } };
    const c = compare(a, null, b);
    const link = c.phenomena.find((p) => p.phenomenon === 'linking')!;
    expect(link).toMatchObject({ label: 'Nối âm', firstMissPct: 60, latestMissPct: 20, change: -40 });
    expect(c.phenomena.find((p) => p.phenomenon === 'flap-t')?.change).toBe(0);
    expect(c.voiceChanged).toBe(true);
    expect(c.vsPrev).toBeNull();
  });
});

describe('sync merge (checkup-results)', () => {
  const a = result({ at: 1, id: 'k1' });
  const b = result({ at: 2, id: 'k2' });
  const c = result({ at: 3, id: 'k3' });

  it('unions by id; idempotent and commutative', () => {
    const x = { version: 1, results: [a, b] };
    const y = { version: 1, results: [b, c] };
    const m = mergeCheckups(x, y) as { results: CheckupResult[] };
    expect(m.results.map((r) => r.id)).toEqual(['k1', 'k2', 'k3']);
    expect(mergeCheckups(y, x)).toEqual(m);
    expect(mergeCheckups(m, m)).toEqual(m);
    expect(mergeCheckups(mergeCheckups(m, x), y)).toEqual(m);
    const text = mergeValue('checkup-results', JSON.stringify(x), JSON.stringify(y), false);
    expect(parseCheckups(JSON.parse(text))).toHaveLength(3);
  });

  it('survives junk', () => {
    const m = mergeCheckups({ results: [null, { id: 5 }, { id: 'x' }, a] }, 'junk') as { results: unknown[] };
    expect(m.results).toEqual([a]);
  });
});

describe('store and draft', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('saves results (synced key) and clears the draft', async () => {
    const map = stubWindow();
    const B = await fresh();
    expect(B.saveCheckupDraft({ form: 'A', startedAt: NOW, part: 'dictation', index: 3, voiceName: 'x', dictation: { s: { typed: 'hi', plays: 1 } }, comprehension: {} }, NOW)).toBe(true);
    expect(B.loadCheckupDraft(NOW + 1000)).toMatchObject({ form: 'A', part: 'dictation', index: 3 });
    expect(B.loadCheckupDraft(NOW + 25 * 3_600_000)).toBeNull(); // too old to resume
    const snap = B.loadCheckups();
    expect(B.loadCheckups()).toBe(snap);
    expect(B.saveCheckupResult(result({ at: NOW, id: 'k9' }))).toBe(true);
    expect(B.loadCheckups().map((r) => r.id)).toEqual(['k9']);
    expect(map.has(P + 'checkup-draft')).toBe(false);
    expect(JSON.parse(map.get(P + 'checkup-results')!).results).toHaveLength(1);
    expect(B.saveCheckupResult({ id: 'bad' } as unknown as CheckupResult)).toBe(false);
  });

  it('never records practice attempts', async () => {
    const map = stubWindow();
    const B = await fresh();
    B.saveCheckupResult(result({ at: NOW, id: 'k1' }));
    expect(map.has(P + 'stats')).toBe(false);
    expect(map.has(P + 'review-cards')).toBe(false);
    expect(map.has(P + 'progress-history')).toBe(false);
  });
});

describe('review fixes', () => {
  it('accepts apostrophe-less contractions only where the sentence has that contraction', async () => {
    const { checkSentence, restoreBareContractions } = await import('./benchmark');
    expect(checkSentence({ id: 'x1', text: "I'll grab a coffee on my way in." }, 'ill grab a coffee on my way in').pct).toBe(100);
    expect(checkSentence({ id: 'x2', text: "We're going to leave around six." }, 'were going to leave around six').pct).toBe(100);
    // a real "well" in the sentence is not turned into "we'll"
    expect(restoreBareContractions(['Well,', 'see', 'you.'], ['well', 'see', 'you'])).toEqual(['well', 'see', 'you']);
    expect(restoreBareContractions(['We', 'were', 'late.'], ['were'])).toEqual(['were']);
  });

  it('trend leaves out quick retakes; repeated forms are detected', async () => {
    const { trendCheckups, isRepeatForm } = await import('./benchmark');
    const d = (day: number) => new Date(2026, 9, day, 12).getTime();
    const list = [
      { id: 'a', at: d(1), form: 'A' as const },
      { id: 'b', at: d(3), form: 'B' as const },
      { id: 'c', at: d(9), form: 'C' as const },
      { id: 'd', at: d(20), form: 'A' as const },
    ];
    expect(trendCheckups(list).map((r) => r.id)).toEqual(['a', 'c', 'd']);
    expect(isRepeatForm(list, list[3])).toBe(true);
    expect(isRepeatForm(list, list[0])).toBe(false);
  });

  it('shortens TTS voice names to a Vietnamese label', async () => {
    const { shortVoiceName } = await import('./benchmark');
    expect(shortVoiceName('Microsoft Ava Multilingual Online (Natural) - English (United States)')).toBe('Ava (Mỹ)');
    expect(shortVoiceName('Microsoft David - English (United States)')).toBe('David (Mỹ)');
    expect(shortVoiceName('Google UK English Female')).toBe('Google (Anh)');
    expect(shortVoiceName('Samantha')).toBe('Samantha');
    expect(shortVoiceName('Microsoft Libby Online (Natural) - English (United Kingdom)')).toBe('Libby (Anh)');
    expect(shortVoiceName(null)).toBeNull();
  });
});
