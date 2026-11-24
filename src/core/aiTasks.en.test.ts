// English mode of the AI tasks (docs/i18n.md): the explanation and the coach comment come back in English, the
// checks on them (phenomenon names, "(a guess)", negation, honesty filter, numbers) read English. The Vietnamese path
// is covered by aiTasks.test.ts and aiTasks.review.test.ts, which run in Vietnamese mode.

import { afterEach, describe, expect, it } from 'vitest';
import {
  buildCoachInput,
  buildCoachPrompt,
  buildExplainPrompt,
  COACH_SCHEMA,
  COACH_SCHEMA_EN,
  dropSummaryVi,
  EXPLAIN_SCHEMA,
  EXPLAIN_SCHEMA_EN,
  explainInputFrom,
  markGuesses,
  phenomenaNamedIn,
  phenomenonNames,
  PHENOMENON_EN,
  PHENOMENON_VI,
  sanitizeCoach,
  sanitizeExplanation,
  stripDishonest,
} from './aiTasks';
import { emptyByPhenomenon, type CheckupResult } from './benchmark';
import { decode } from './decoder';
import { align } from './dictation/align';
import { buildDiff } from './dictation/diff';
import { splitWords } from './dictation/normalize';
import { buildReport } from './progressReport';
import type { Phenomenon } from './types';
import { addDictionary, resetDictionary, setActiveLang } from '../i18n/lang';
import ai from '../i18n/en/ui/ai';

afterEach(() => {
  setActiveLang('vi');
  resetDictionary();
});

function explainFor(text: string, typed: string) {
  const d = decode(text);
  const target = d.tokens.map((t) => t.raw);
  const answer = splitWords(typed);
  const al = align(target, answer);
  return explainInputFrom(text, typed, buildDiff(target, answer, al.ops), d.annotations, d);
}

const none = new Set<Phenomenon>();

describe('language is read at call time', () => {
  it('switches the names, the prompt and the schema without reloading the module', () => {
    expect(phenomenonNames()).toBe(PHENOMENON_VI);
    const vi = buildExplainPrompt(explainFor('Turn it off.', 'turn of'));
    setActiveLang('en');
    expect(phenomenonNames()).toBe(PHENOMENON_EN);
    const en = buildExplainPrompt(explainFor('Turn it off.', 'turn of'));
    setActiveLang('vi');
    expect(buildExplainPrompt(explainFor('Turn it off.', 'turn of'))).toEqual(vi);
    expect(en.system).not.toBe(vi.system);
    expect(vi.schema).toBe(EXPLAIN_SCHEMA);
    expect(en.schema).toBe(EXPLAIN_SCHEMA_EN);
  });
});

describe('explain in English', () => {
  it('asks for plain English, lists the English names and the English guess marker', () => {
    setActiveLang('en');
    const input = explainFor('Turn it off.', 'turn of');
    expect(input.annotations.length).toBeGreaterThan(0);
    for (const a of input.annotations) expect(a.name).toBe(PHENOMENON_EN[a.type]);
    const p = buildExplainPrompt(input);
    expect(p.system).toContain('«Linking» (linking)');
    expect(p.system).toContain('«Flap T» (flap-t)');
    expect(p.system).toContain('«Name» (a guess)');
    expect(p.system).toContain('plain, concise English');
    expect(p.system).not.toMatch(/Vietnamese sentence|natural, concise Vietnamese|đoán|«Nối âm»/);
    expect(p.user).toMatch(/- (Linking|Flap T|Elision|Weak form) \|/);
    const props = (p.schema as unknown as { properties: Record<string, { description?: string; items?: { properties: Record<string, { description?: string }> } }> }).properties;
    expect(props.summary.description).toContain('English');
    expect(props.points.items?.properties.why.description).toContain('English');
  });

  it('finds the English names, with « » or bare where the name is never an ordinary word', () => {
    setActiveLang('en');
    expect(phenomenaNamedIn('The «Flap T» and «Elision» here')).toEqual(['elision', 'flap-t']);
    expect(phenomenaNamedIn('This is h-dropping and assimilation')).toEqual(['assimilation', 'h-dropping']);
    // everyday words: only «…» counts
    expect(phenomenaNamedIn('a contraction of "it is", the weak form of "to", a reduction')).toEqual([]);
    expect(phenomenaNamedIn('«Weak form» of to')).toEqual(['weak-form']);
    // the Vietnamese names are not the names in English mode
    expect(phenomenaNamedIn('«Nối âm»')).toEqual([]);
  });

  it('marks an unsupported name "(a guess)", once, right after the name', () => {
    setActiveLang('en');
    expect(markGuesses('«Elision» drops the t.', none)).toBe('«Elision» (a guess) drops the t.');
    expect(markGuesses('«Elision» (a guess) drops the t.', none)).toBe('«Elision» (a guess) drops the t.');
    expect(markGuesses('Maybe elision (guess) here.', none)).toBe('Maybe elision (guess) here.');
    expect(markGuesses('Here flap T makes it a d.', none)).toBe('Here flap T (a guess) makes it a d.');
    // a supported name stays as it is
    expect(markGuesses('«Elision» drops the t.', new Set<Phenomenon>(['elision']))).toBe('«Elision» drops the t.');
    // a hedge elsewhere does not count
    expect(markGuesses('It is hard to guess, but «Linking» joins them.', none)).toBe('It is hard to guess, but «Linking» (a guess) joins them.');
  });

  it('does not mark a name the model rules out', () => {
    setActiveLang('en');
    for (const s of [
      'This is not linking: you just missed the word.',
      'It isn’t «Elision» here.',
      "It isn't «Elision» here.",
      'This is not caused by «Assimilation».',
      'It is not a case of «H-dropping».',
      'A vocabulary problem rather than «Linking».',
    ]) {
      expect(markGuesses(s, none)).toBe(s);
    }
    // the negation is tied to the name right after it
    expect(markGuesses('Not «Linking», but «Elision» here.', none)).toBe('Not «Linking», but «Elision» (a guess) here.');
  });

  it('sanitizes an English answer: marks guesses, then drops the « » marks', () => {
    setActiveLang('en');
    const input = explainFor('I need you to call him.', 'I need to call');
    const known = new Set(input.annotations.map((a) => a.type));
    const missing = (['elision', 'linking', 'flap-t'] as Phenomenon[]).find((p) => !known.has(p))!;
    const name = PHENOMENON_EN[missing];
    const out = sanitizeExplanation(
      {
        points: [{ heard: 'need to', actual: 'need you to', why: `It sounds like one word because of «${name}».`, tip: 'Listen for "nee-jə".' }],
        summary: 'You missed the short words in the middle.',
      },
      input,
    );
    expect(out?.points[0].why).toBe(`It sounds like one word because of ${name} (a guess).`);
    expect(out?.summary).toBe('You missed the short words in the middle.');
  });
});

describe('coach in English', () => {
  const DAY = 86400000;
  const now = new Date(2026, 10, 6, 12).getTime();
  const mk = (i: number, score: number, at: number): CheckupResult => {
    const by = emptyByPhenomenon();
    by['flap-t'] = { seen: 5, missed: [4, 4, 2, 1, 1][i] ?? 1 };
    return {
      id: `c${i}`, at, form: String.fromCharCode(65 + i), voiceName: 'Kore', rate: 1,
      dictation: { words: 100, correct: score, extra: 0, pct: score, items: [] },
      comprehension: { correct: 2, total: 4, pct: 50, items: [] },
      byPhenomenon: by, score, durationSec: 600, completed: true,
    } as unknown as CheckupResult;
  };
  const checkups = [40, 47, 55, 61, 66].map((s, i) => mk(i, s, now - (4 - i) * 15 * DAY));
  const report = () => buildReport({ log: [], checkups, history: { version: 1, devices: {} } as never, stats: null, settings: { listenGoal: 30 }, now, period: '4w' });

  it('sends English names and asks for English with the English section names', () => {
    setActiveLang('en');
    const input = buildCoachInput(report(), checkups[4].byPhenomenon, checkups);
    expect(input.checkups.latestMisses.map((m) => m.phenomenon)).toContain('Flap T');
    expect(input.checkups.phenomenonChanges.find((x) => x.phenomenon === 'Flap T')).toMatchObject({ earlyTests: 'missed 8/10 sentences' });
    const p = buildCoachPrompt(input);
    expect(p.schema).toBe(COACH_SCHEMA_EN);
    expect(p.system).toContain('"Listening log"');
    expect(p.system).toContain('"Real videos"');
    expect(p.system).toContain('the first action is "Checkup"');
    expect(p.system).toContain('"self-rated"');
    expect(p.system).toContain('"2 h 15 min"');
    expect(p.system).not.toMatch(/Vietnamese name|Comment in Vietnamese|Nhật ký nghe|tự đánh giá/);
    setActiveLang('vi');
    const vi = buildCoachPrompt(buildCoachInput(report(), checkups[4].byPhenomenon, checkups));
    expect(vi.schema).toBe(COACH_SCHEMA);
    expect(vi.system).toContain('"Nhật ký nghe"');
  });

  it('removes native-like claims and promises written in English', () => {
    setActiveLang('en');
    expect(stripDishonest('Good progress. You will soon listen like a native speaker! Keep going.')).toBe('Good progress. Keep going.');
    expect(stripDishonest('Your listening is almost native-like.')).toBe('');
    expect(stripDishonest('You are becoming fluent.')).toBe('');
    expect(stripDishonest('You hear it perfectly now.')).toBe('');
    expect(stripDishonest('You have mastered the Flap T.')).toBe('');
    expect(stripDishonest('Soon you will understand 100% of films.')).toBe('');
    expect(stripDishonest('Listen daily. You will understand every word of a movie.')).toBe('Listen daily.');
    expect(stripDishonest('You will understand everything soon.')).toBe('');
    expect(stripDishonest('Listen like an American does.')).toBe('');
    // ordinary words that only contain a banned one
    expect(stripDishonest('An alternative plan: 20 min of Dictation a day.')).toBe('An alternative plan: 20 min of Dictation a day.');
    // the Vietnamese claims are still caught
    expect(stripDishonest('Bạn nghe như người bản xứ.')).toBe('');
  });

  it('reads English numbers: thousands separators and decimal points', () => {
    setActiveLang('en');
    const base = buildCoachInput(report(), checkups[4].byPhenomenon, checkups);
    const input = { ...base, listening: { ...base.listening, minutesInPeriod: 150, minutesAllTime: 1200 } };
    const out = sanitizeCoach(
      {
        headline: 'You logged 2.5 h this period.',
        points: ['1,200 min of listening in all so far.', 'Your score went from 33 to 66.', 'Score 66, up 5 points on the test before.'],
        nextWeek: ['Dictation: 20 sentences a day.'],
      },
      input,
    );
    expect(out).toEqual({
      headline: 'You logged 2.5 h this period.',
      points: ['1,200 min of listening in all so far.', 'Score 66, up 5 points on the test before.'],
      nextWeek: ['Dictation: 20 sentences a day.'],
    });
  });

  it('drops a bullet cut down to a filler without an English section name', () => {
    setActiveLang('en');
    const out = sanitizeCoach({ headline: 'x', points: ['You will be fluent soon! Keep it up.'], nextWeek: ['Shadowing every day. You will sound native.'] });
    expect(out).toEqual({ headline: 'x', points: [], nextWeek: ['Shadowing every day.'] });
  });
});

describe('generator interface text', () => {
  it('"Only N sentences" reads English from the dictionary, Vietnamese stays the same', () => {
    expect(dropSummaryVi(4, 5)).toBe('Chỉ giữ được 4 câu đạt yêu cầu.');
    addDictionary(ai);
    setActiveLang('en');
    expect(dropSummaryVi(4, 5)).toBe('Only 4 sentences passed the checks.');
    expect(dropSummaryVi(1, 5)).toBe('Only 1 sentence passed the checks.');
    expect(dropSummaryVi(5, 5)).toBe('');
  });
});
