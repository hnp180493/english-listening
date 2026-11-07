import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateJson } from './ai';
import {
  aiCacheGet,
  aiCacheKey,
  aiCacheSet,
  buildCoachInput,
  buildCoachPrompt,
  buildExplainPrompt,
  buildGeneratePrompt,
  cleanTopic,
  clearAiTaskCache,
  COACH_SCHEMA,
  dropSummaryVi,
  EXPLAIN_SCHEMA,
  explainInputFrom,
  genSchema,
  phenomenaNamedIn,
  sanitizeCoach,
  sanitizeExplanation,
  spellingProblem,
  stableStringify,
  stripDishonest,
  validateGenerated,
} from './aiTasks';
import { decode } from './decoder';
import { align } from './dictation/align';
import { buildDiff } from './dictation/diff';
import { splitWords } from './dictation/normalize';
import { buildReport } from './progressReport';
import type { ListeningEntry } from './listening';
import type { CheckupResult } from './benchmark';
import { emptyByPhenomenon } from './benchmark';
import type { Phenomenon } from './types';

function explainFor(text: string, typed: string) {
  const d = decode(text);
  const target = d.tokens.map((t) => t.raw);
  const answer = splitWords(typed);
  const al = align(target, answer);
  return explainInputFrom(text, typed, buildDiff(target, answer, al.ops), d.annotations);
}

describe('explain: input + prompt', () => {
  it('lists the wrong words and flags the annotations that touch them', () => {
    const input = explainFor('Turn it off, please.', 'turn of please');
    expect(input.mistakes.length).toBeGreaterThan(0);
    expect(input.mistakes.some((m) => m.expected.toLowerCase().includes('it'))).toBe(true);
    expect(input.annotations.some((a) => a.missed)).toBe(true);
    // missed annotations come first
    expect(input.annotations[0].missed).toBe(true);
    for (const a of input.annotations) expect(a.name).toMatch(/^[\p{Lu}]/u);
  });

  it('merges consecutive left-out words into one mistake', () => {
    const input = explainFor('I am going to call you later.', 'I am call you later');
    expect(input.mistakes).toEqual([{ expected: 'going to', typed: '' }]);
  });

  it('does not merge left-out words that are not next to each other', () => {
    const input = explainFor('I will grab a coffee on my way in.', 'I will a coffee my way');
    expect(input.mistakes.map((m) => m.expected)).toEqual(['grab', 'on', 'in']);
  });

  it('a right answer has no mistakes and no missed annotation', () => {
    const input = explainFor('Turn it off.', 'Turn it off.');
    expect(input.mistakes).toEqual([]);
    expect(input.annotations.every((a) => !a.missed)).toBe(true);
  });

  it('prompt carries sentence, typed text, mistakes and annotation respellings; schema validates a good answer', () => {
    const input = explainFor('Turn it off, please.', 'turn of please');
    const p = buildExplainPrompt(input);
    expect(p.user).toContain('"Turn it off, please."');
    expect(p.user).toContain('"turn of please"');
    for (const a of input.annotations) {
      expect(p.user).toContain(a.spoken);
      expect(p.user).toContain(a.name);
    }
    expect(p.system).toMatch(/Vietnamese/);
    expect(p.system).toContain('Nối âm');
    expect(p.system).toContain('(đoán)');
    const good = { summary: 'Bạn nghe "it off" thành một từ.', points: [{ heard: 'of', actual: 'it off', why: 'Nối âm: "it off" đọc liền thành "i-doff".', tip: 'Nghe phụ âm cuối nối sang nguyên âm.' }] };
    expect(validateJson(good, EXPLAIN_SCHEMA)).toEqual([]);
    expect(validateJson({ summary: 'x', points: [] }, EXPLAIN_SCHEMA).length).toBeGreaterThan(0);
    expect(validateJson({ summary: 'x' }, EXPLAIN_SCHEMA).length).toBeGreaterThan(0);
  });
});

describe('explain: sanitize', () => {
  const input = {
    text: 'Turn it off.',
    typed: 'turn of',
    mistakes: [{ expected: 'it', typed: '' }],
    annotations: [{ type: 'linking' as Phenomenon, name: 'Nối âm', original: 'turn it off', spoken: 'tur-ni-doff', missed: true }],
  };

  it('keeps supported phenomena as stated', () => {
    const out = sanitizeExplanation({ summary: 'Do nối âm.', points: [{ heard: 'of', actual: 'it off', why: 'Nối âm làm "it off" thành "i-doff".', tip: 'Chú ý.' }] }, input);
    expect(out?.points[0].why.startsWith('(Đoán)')).toBe(false);
    expect(out?.summary).toBe('Do nối âm.');
  });

  it('marks an unannotated phenomenon as a guess unless the model already did', () => {
    const out = sanitizeExplanation(
      {
        summary: 'Do T bật.',
        points: [
          { heard: 'of', actual: 'it off', why: 'T bật (giọng Mỹ) làm t thành d.', tip: '' },
          { heard: 'of', actual: 'it off', why: 'Âm yếu (đoán) làm "it" nhẹ đi.', tip: '' },
        ],
      },
      input,
    );
    expect(out?.summary).toBe('Do T bật (đoán).');
    expect(out?.points[0].why).toBe('T bật (giọng Mỹ) (đoán) làm t thành d.');
    expect(out?.points[1].why).toBe('Âm yếu (đoán) làm "it" nhẹ đi.');
  });

  it('drops empty points, caps to 4, rejects garbage', () => {
    const pts = Array.from({ length: 7 }, (_, i) => ({ heard: 'a', actual: 'b', why: `Lý do ${i}`, tip: 'x' }));
    expect(sanitizeExplanation({ summary: 's', points: [{ heard: '', actual: '', why: ' ', tip: '' }, ...pts] }, input)?.points).toHaveLength(4);
    expect(sanitizeExplanation(null, input)).toBeNull();
    expect(sanitizeExplanation({ summary: '', points: [] }, input)).toBeNull();
  });

  it('finds phenomenon names, including "T bật" without its suffix', () => {
    expect(phenomenaNamedIn('Đây là t bật và nuốt âm')).toEqual(['elision', 'flap-t']);
  });
});

describe('generate: prompt', () => {
  it('names the phenomenon, level, topic and count (+ extras), forbids informal spelling', () => {
    const p = buildGeneratePrompt({ phenomenon: 'flap-t', topic: 'Công việc', level: 2, count: 5 }, ['Turn it off, please.']);
    expect(p.user).toContain('Write 8 sentences');
    expect(p.user).toContain('flap-t');
    expect(p.user).toContain('"Công việc"');
    expect(p.user).toContain('medium');
    expect(p.user).toContain('Turn it off, please.');
    expect(p.system).toMatch(/never "gonna"/);
    expect(p.system).toMatch(/No digits/);
    expect(genSchema(5)).toMatchObject({ properties: { items: { maxItems: 8 } } });
  });

  it('an empty topic asks for any everyday situation; topics are cleaned', () => {
    expect(buildGeneratePrompt({ phenomenon: 'linking', topic: '  ', level: 1, count: 10 }).user).toContain('any everyday situation');
    expect(cleanTopic('a\u0000b <script> "x"')).toBe('a b script x');
    expect(cleanTopic('x'.repeat(100))).toHaveLength(60);
  });
});

describe('generate: validation', () => {
  const annotate = (t: string) => decode(t).annotations;
  const detect = (t: string) => [...new Set(annotate(t).map((a) => a.type))];
  const opts = { phenomenon: 'linking' as Phenomenon, existing: ['Turn it off, please.'], annotate, max: 10 };

  it('spelling: rejects informal respellings and respelling style, accepts standard English', () => {
    expect(spellingProblem("I'm going to pick it up later.")).toBeNull();
    expect(spellingProblem('This is a well-known place.')).toBeNull();
    expect(spellingProblem("I'm gonna pick it up.")).toBe('spelling');
    expect(spellingProblem('Tell me about it, wanna go?')).toBe('spelling');
    expect(spellingProblem("Give 'em a call.")).toBe('spelling');
    expect(spellingProblem('We tur-ni-DOFF now.')).toBe('spelling');
    expect(spellingProblem('Tôi muốn đi.')).toBe('not-english');
    expect(spellingProblem('She is goin’ home.')).toBe('spelling');
  });

  it('keeps good items and drops bad ones with a reason', () => {
    const raw = {
      items: [
        { text: 'Can you pick it up on your way home?', vi: 'Bạn lấy giúp trên đường về nhé?' },
        { text: 'I have 3 apples in a bag.', vi: '' },
        { text: 'Turn it off, please!', vi: 'trùng' },
        { text: 'Hi.', vi: 'ngắn' },
        { text: "I'm gonna look at it again.", vi: '' },
        { text: 'Can you pick it up on your way home?', vi: 'trùng trong lô' },
        { text: 'The sky looks blue today.', vi: 'không có nối âm?' },
        { text: '', vi: '' },
      ],
    };
    const r = validateGenerated(raw, opts);
    expect(r.ok.map((x) => x.text)).toEqual(['Can you pick it up on your way home?']);
    const reasons = r.dropped.map((d) => d.reason);
    expect(reasons).toContain('digits');
    expect(reasons).toContain('duplicate');
    expect(reasons).toContain('length');
    expect(reasons).toContain('spelling');
    expect(reasons).toContain('empty');
    // the sky sentence: either no linking found (dropped) or linking found; never silently kept when absent
    const sky = r.dropped.find((d) => d.text.startsWith('The sky'));
    if (!detect('The sky looks blue today.').includes('linking')) expect(sky?.reason).toBe('no-phenomenon');
  });

  it('caps at max (surplus is not reported as dropped) and survives a throwing detector / bad shapes', () => {
    const items = ['Pick it up now, please.', 'Look at it again tonight.', 'Turn it on for a minute.'].map((text) => ({ text, vi: '' }));
    const r = validateGenerated({ items }, { ...opts, existing: [], max: 2 });
    expect(r.ok).toHaveLength(2);
    expect(r.dropped).toHaveLength(0);
    const thrown = validateGenerated({ items }, { ...opts, existing: [], annotate: () => { throw new Error('x'); } });
    expect(thrown.ok).toHaveLength(0);
    expect(thrown.dropped.every((d) => d.reason === 'no-phenomenon')).toBe(true);
    expect(validateGenerated(null, opts)).toEqual({ ok: [], dropped: [] });
    expect(validateGenerated({ items: 'x' }, opts)).toEqual({ ok: [], dropped: [] });
  });

  it('drop summary only says something when fewer sentences than asked are left (ux-10)', () => {
    expect(dropSummaryVi(5, 5)).toBe('');
    expect(dropSummaryVi(0, 5)).toBe('');
    expect(dropSummaryVi(4, 5)).toBe('Chỉ giữ được 4 câu đạt yêu cầu.');
  });
});

describe('coach: input, prompt, honesty filter', () => {
  const DAY = 86400000;
  const now = new Date(2026, 10, 7, 12).getTime();
  const day = (ts: number) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const SECRET_TITLE = 'Friends S01E03 secret-title-xyz';
  const SECRET_NOTE = 'ghi-chu-rieng-tu-abc';
  const log = Array.from({ length: 6 }, (_, i) => {
    const at = now - i * 2 * DAY;
    return { id: `l${i}`, startedAt: at, day: day(at), minutes: 40, source: 'video', title: SECRET_TITLE, note: SECRET_NOTE, understood: 3, updatedAt: at } as unknown as ListeningEntry;
  });
  const byPh = emptyByPhenomenon();
  byPh.linking = { seen: 6, missed: 4 };
  byPh['flap-t'] = { seen: 3, missed: 1 };
  const checkup = {
    id: 'c1',
    at: now - 3 * DAY,
    form: 'A',
    voiceName: 'Kore',
    rate: 1,
    dictation: { words: 100, correct: 70, extra: 0, pct: 70, items: [{ id: 's1', typed: 'typed-secret-words', correctWords: 5, totalWords: 8, extraWords: 0, plays: 1 }] },
    comprehension: { correct: 2, total: 4, pct: 50, items: [] },
    byPhenomenon: byPh,
    score: 62,
    durationSec: 600,
    completed: true,
  } as unknown as CheckupResult;
  const report = buildReport({
    log,
    checkups: [checkup],
    history: { version: 1, devices: {} } as never,
    stats: null,
    settings: { listenGoal: 30 },
    now,
    period: '4w',
  });
  const input = buildCoachInput(report, checkup.byPhenomenon);

  it('contains only aggregate numbers (no titles, notes, typed text)', () => {
    const s = JSON.stringify(input);
    expect(s).not.toContain('secret-title-xyz');
    expect(s).not.toContain(SECRET_NOTE);
    expect(s).not.toContain('typed-secret-words');
    expect(s).not.toContain('Friends');
    expect(input.listening.minutesInPeriod).toBe(240);
    expect(input.checkups.scoresInPeriod).toEqual([{ score: 62, dictationPct: 70, comprehensionPct: 50, repeatForm: false }]);
    expect(input.checkups.latestMisses).toContainEqual({ phenomenon: 'Nối âm', missed: 4, seen: 6 });
    expect(input.selfRated.entries).toBe(6);
    const p = buildCoachPrompt(input);
    expect(p.user).not.toContain('secret-title-xyz');
    expect(p.user).toContain('"minutesInPeriod":240');
  });

  it('system prompt states the honesty rules and the feature names', () => {
    const p = buildCoachPrompt(input);
    expect(p.system).toContain('bản ngữ');
    expect(p.system).toContain('mới có N lần đo');
    expect(p.system).toContain('tự đánh giá');
    expect(p.system).toContain('"Chép chính tả"');
    expect(p.system).toContain('"Nhật ký nghe"');
    expect(validateJson({ headline: 'a', points: ['b'], nextWeek: ['c'] }, COACH_SCHEMA)).toEqual([]);
    expect(validateJson({ headline: 'a', points: ['1', '2', '3', '4', '5'], nextWeek: ['c'] }, COACH_SCHEMA).length).toBeGreaterThan(0);
  });

  it('strips sentences with native-like claims, keeps the rest', () => {
    expect(stripDishonest('Bạn tiến bộ tốt. Sắp nghe như người bản xứ rồi! Cứ tiếp tục.')).toBe('Bạn tiến bộ tốt. Cứ tiếp tục.');
    expect(stripDishonest('Bạn sẽ nghe như người bản ngữ.')).toBe('');
    expect(stripDishonest('Nghe hiểu ở mức native.')).toBe('');
    expect(stripDishonest('Một cách alternative.')).toBe('Một cách alternative.');
    const out = sanitizeCoach({
      headline: 'Bạn gần như bản ngữ rồi.',
      points: ['Nghe 4 giờ. Bạn nghe như người Mỹ.', 'Như người bản xứ!', 'Mới có 1 lần đo.'],
      nextWeek: ['Chép chính tả 10 câu Nối âm mỗi ngày.', 'x'.repeat(10)],
    });
    expect(out).toEqual({ headline: '', points: ['Nghe 4 giờ.', 'Mới có 1 lần đo.'], nextWeek: ['Chép chính tả 10 câu Nối âm mỗi ngày.', 'x'.repeat(10)] });
    expect(sanitizeCoach({ headline: 'x', points: ['bản ngữ'], nextWeek: [] })).toBeNull();
    expect(sanitizeCoach('nope')).toBeNull();
  });
});

describe('cache', () => {
  afterEach(() => {
    clearAiTaskCache();
    vi.unstubAllGlobals();
  });

  it('keys are stable regardless of property order and differ by input', () => {
    expect(stableStringify({ b: 1, a: [1, { d: 2, c: 3 }] })).toBe('{"a":[1,{"c":3,"d":2}],"b":1}');
    expect(aiCacheKey('explain', { a: 1, b: 2 })).toBe(aiCacheKey('explain', { b: 2, a: 1 }));
    expect(aiCacheKey('explain', { a: 1 })).not.toBe(aiCacheKey('explain', { a: 2 }));
    expect(aiCacheKey('explain', { a: 1 })).not.toBe(aiCacheKey('coach', { a: 1 }));
  });

  it('stores in memory and sessionStorage; a full-key mismatch is a miss', () => {
    const map = new Map<string, string>();
    vi.stubGlobal('window', {
      sessionStorage: {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => void map.set(k, v),
        removeItem: (k: string) => void map.delete(k),
        key: (i: number) => [...map.keys()][i] ?? null,
        get length() {
          return map.size;
        },
      },
    });
    aiCacheSet('k1', { x: 1 }, 'full-1');
    expect(aiCacheGet('k1', 'full-1')).toEqual({ x: 1 });
    expect(aiCacheGet('k1', 'other')).toBeUndefined();
    expect([...map.keys()]).toEqual(['nghe-noi-am-aicache:k1']);
    clearAiTaskCache();
    expect(map.size).toBe(0);
    expect(aiCacheGet('k1', 'full-1')).toBeUndefined();
    // sessionStorage alone (fresh memory) still serves
    map.set('nghe-noi-am-aicache:k2', JSON.stringify({ full: 'f', value: 7 }));
    expect(aiCacheGet('k2', 'f')).toBe(7);
  });
});
