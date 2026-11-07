// Regression tests for the AI-task review findings (prompts-*, ux-6, ux-10): hints vs decoder, explain payload,
// honesty marking, generator validation, coach input and filters.

import { describe, expect, it } from 'vitest';
import {
  buildCoachInput,
  buildCoachPrompt,
  buildExplainPrompt,
  buildGeneratePrompt,
  cleanVi,
  coachDataIsSparse,
  EXPLAIN_SCHEMA,
  explainInputFrom,
  focusCount,
  generateAvoidList,
  generateRepairProblem,
  LEVEL_WORDS,
  markGuesses,
  PHENOMENON_HINT,
  phenomenaNamedIn,
  sanitizeCoach,
  sanitizeExplanation,
  stripDishonest,
  typoIsOtherWord,
  validateGenerated,
} from './aiTasks';
import { emptyByPhenomenon, type CheckupResult } from './benchmark';
import { decode } from './decoder';
import { align } from './dictation/align';
import { buildDiff } from './dictation/diff';
import { splitWords } from './dictation/normalize';
import { buildReport } from './progressReport';
import { PHENOMENA, type Phenomenon } from './types';

function explainFor(text: string, typed: string) {
  const d = decode(text);
  const target = d.tokens.map((t) => t.raw);
  const answer = splitWords(typed);
  const al = align(target, answer);
  return explainInputFrom(text, typed, buildDiff(target, answer, al.ops), d.annotations, d);
}

describe('generator hints match the decoder (prompts-1, prompts-2)', () => {
  it.each(PHENOMENA)('every example phrase of %s is marked as that phenomenon', (ph) => {
    for (const ex of PHENOMENON_HINT[ph].examples) {
      const types = decode(ex).annotations.map((a) => a.type);
      expect(types, `${ph}: "${ex}"`).toContain(ph);
    }
  });

  it('assimilation steers away from did/would/could you (the decoder calls them reduction)', () => {
    const p = buildGeneratePrompt({ phenomenon: 'assimilation', topic: '', level: 2, count: 5 });
    expect(p.user).toContain('Do NOT use "did you"');
    expect(p.user).not.toMatch(/Pattern examples:[^\n]*"did you"/);
  });

  it("contraction hint does not lean on I'm (not annotated by the decoder)", () => {
    expect(PHENOMENON_HINT.contraction.examples).not.toContain("I'm");
    expect(buildGeneratePrompt({ phenomenon: 'contraction', topic: '', level: 1, count: 5 }).user).toContain('"I\'m" on its own');
  });
});

describe('explain payload (prompts-2, -4, -7, -16, -17)', () => {
  it('a missed "I\'m" gets a Viết tắt annotation, so it is not shown as a guess', () => {
    const input = explainFor("I'm going home now.", 'I going home now');
    expect(input.annotations).toContainEqual(expect.objectContaining({ type: 'contraction', original: "I'm", missed: true }));
    const out = sanitizeExplanation({ summary: 's', points: [{ heard: 'I', actual: "I'm", why: '«Viết tắt»: âm m rất nhẹ.', tip: 't' }] }, input);
    expect(out?.points[0].why).toBe('Viết tắt: âm m rất nhẹ.');
  });

  it('each mistake carries the spoken chunk; the prompt has the whole sentence as it sounds', () => {
    const input = explainFor("I'm going to turn it off in a minute.", 'I gonna turn noff in a minute');
    const it_ = input.mistakes.find((m) => m.expected === 'it');
    expect(it_?.chunk?.spoken).toBe('tur-ni-dof-fi-nə');
    expect(input.spokenText).toBe("I'm gonna tur-ni-dof-fi-nə minute");
    const p = buildExplainPrompt(input);
    expect(p.user).toContain('How the whole sentence sounds (app respelling): "I\'m gonna tur-ni-dof-fi-nə minute"');
    expect(p.user).toContain('sounds like: "tur-ni-dof-fi-nə"');
  });

  it('tells the model that everything outside Mistakes was accepted, and not to restate the rule cards', () => {
    const p = buildExplainPrompt(explainFor('What do you want to do about it?', 'what you wanna do bout it'));
    expect(p.system).toContain('Everything else the student typed was accepted');
    expect(p.system).toContain('ALREADY SEES');
  });

  it('only a couple of annotations that do not touch a mistake are sent', () => {
    const input = explainFor("I'm going to turn it off in a minute.", "I'm going to turn it off in a minutes");
    expect(input.annotations.filter((a) => !a.missed).length).toBeLessThanOrEqual(2);
  });

  it('schema asks for the points before the summary', () => {
    expect(Object.keys((EXPLAIN_SCHEMA as { properties: object }).properties)).toEqual(['points', 'summary']);
  });

  it('a typo that is really another word (bought → brought) is listed as a minor mistake', () => {
    expect(typoIsOtherWord('bought', 'brought')).toBe(true);
    expect(typoIsOtherWord('tomorrow', 'tomorow')).toBe(false);
    expect(typoIsOtherWord('receive', 'recieve')).toBe(false);
    const units = [
      { kind: 'ok' as const, targetIndex: 0, target: 'She' },
      { kind: 'typo' as const, targetIndex: 1, target: 'bought', answer: 'brought' },
      { kind: 'typo' as const, targetIndex: 2, target: 'tomorrow.', answer: 'tomorow' },
    ];
    const input = explainInputFrom('She bought tomorrow.', 'She brought tomorow', units, []);
    expect(input.mistakes).toEqual([{ expected: 'bought', typed: 'brought', minor: true }]);
    expect(buildExplainPrompt(input).user).toContain('accepted as a typo, but it is a different word');
  });
});

describe('honesty marking (prompts-5, prompts-6)', () => {
  const known = new Set<Phenomenon>(['contraction', 'flap-t']);
  it('ordinary words "rút gọn", "viết tắt", "nguyên âm yếu" are not phenomenon names', () => {
    expect(phenomenaNamedIn("We'd là dạng rút gọn của We had, âm 'd rất nhẹ.")).toEqual([]);
    expect(phenomenaNamedIn('âm d gần như mất, chỉ còn nguyên âm yếu.')).toEqual([]);
    expect(phenomenaNamedIn('«Rút gọn» và «Âm yếu»')).toEqual(['weak-form', 'reduction']);
    const input = { text: "We'd better leave now.", typed: 'we better leave now', mistakes: [{ expected: "We'd", typed: 'we' }], annotations: [{ type: 'contraction' as Phenomenon, name: 'Viết tắt', original: "We'd", spoken: 'weed', missed: true }] };
    const out = sanitizeExplanation({ summary: '', points: [{ heard: 'we', actual: "We'd", why: "We'd là dạng rút gọn của We had, âm 'd rất nhẹ.", tip: 'Nghe âm d.' }] }, input);
    expect(out?.points[0].why).toBe("We'd là dạng rút gọn của We had, âm 'd rất nhẹ.");
  });

  it('a hedge elsewhere in the sentence does not count as marking the guess; the mark goes next to the name', () => {
    expect(markGuesses('Đây là Nuốt âm nên khó đoán.', known)).toBe('Đây là Nuốt âm (đoán) nên khó đoán.');
    expect(markGuesses('Âm t bị nuốt («Nuốt âm»), có lẽ vậy.', known)).toBe('Âm t bị nuốt («Nuốt âm» (đoán)), có lẽ vậy.');
    expect(markGuesses('«Nuốt âm» (đoán) và «T bật»', known)).toBe('«Nuốt âm» (đoán) và «T bật»');
    const input = { text: 't', typed: 't', mistakes: [], annotations: [] };
    const out = sanitizeExplanation({ summary: '', points: [{ heard: '', actual: 'x', why: '«Nối âm» rõ, «Rút gọn» nữa.', tip: '' }] }, input);
    expect(out?.points[0].why).toBe('Nối âm (đoán) rõ, Rút gọn (đoán) nữa.');
  });
});

describe('generator validation (prompts-8, -9, -13, -14, -15)', () => {
  const annotate = (t: string) => decode(t).annotations;

  it('states the word range per level and scales the token budget', () => {
    const easy = buildGeneratePrompt({ phenomenon: 'linking', topic: '', level: 1, count: 5 });
    const hard = buildGeneratePrompt({ phenomenon: 'linking', topic: '', level: 3, count: 10 });
    expect(easy.user).toContain(`between ${LEVEL_WORDS[1][0]} and ${LEVEL_WORDS[1][1]} words`);
    expect(easy.system).toContain('shorter than 5 words are rejected');
    expect(hard.maxTokens).toBeGreaterThanOrEqual(13 * 120);
    expect(hard.maxTokens).toBeGreaterThan(easy.maxTokens);
  });

  it('in-level sentences come first', () => {
    const items = [
      { text: 'Can you pick it up on your way home after work tonight please?', vi: 'Bạn lấy giúp nhé?' },
      { text: 'Pick it up on your way.', vi: 'Lấy giúp nhé.' },
    ];
    const r = validateGenerated({ items }, { phenomenon: 'linking', existing: [], annotate, max: 1, level: 1 });
    expect(r.ok.map((x) => x.text)).toEqual(['Pick it up on your way.']);
  });

  it('weak-form and linking need more than an article', () => {
    expect(focusCount('weak-form', annotate('It is a nice day today.'))).toBe(0);
    expect(focusCount('weak-form', annotate('It is time to go home now.'))).toBeGreaterThan(0);
    expect(focusCount('linking', [{ type: 'linking', original: 'in a' }])).toBe(0);
    expect(focusCount('linking', [{ type: 'linking', original: 'turn it' }])).toBe(1);
  });

  it('blanks an empty, copied or non-Vietnamese translation', () => {
    expect(cleanVi('', 'Turn it on.')).toBe('');
    expect(cleanVi('Turn it on.', 'Turn it on.')).toBe('');
    expect(cleanVi('Turn it on please', 'Turn it on.')).toBe('');
    expect(cleanVi('Bật lên đi.', 'Turn it on.')).toBe('Bật lên đi.');
  });

  it('avoid list: own sentences, built-ins of the same phenomenon/level, and the previous batch', () => {
    const builtIn = [
      { text: 'Pick it up for me.', level: 1 as const, focus: ['linking' as Phenomenon] },
      { text: 'What a nice day.', level: 1 as const, focus: ['weak-form' as Phenomenon] },
      { text: 'Hold on a second, please.', level: 2 as const, focus: ['linking' as Phenomenon] },
    ];
    const avoid = generateAvoidList({ phenomenon: 'linking', level: 1 }, ['My own sentence here.'], builtIn, ['Previous batch one.']);
    expect(avoid).toEqual(['Previous batch one.', 'My own sentence here.', 'Pick it up for me.']);
    const p = buildGeneratePrompt({ phenomenon: 'linking', topic: '', level: 1, count: 5 }, avoid);
    expect(p.user).toContain('- Pick it up for me.');
    expect(p.system).toContain('do not use those exact phrases');
  });

  it('repair problem names the reasons when too few survive, null when enough', () => {
    const items = ["You're late again.", 'We will see you soon, okay?', "They'd love to come with us tonight."].map((text) => ({ text, vi: 'x' }));
    const v = validateGenerated({ items }, { phenomenon: 'contraction', existing: [], annotate, max: 5 });
    const msg = generateRepairProblem(v, 5, { phenomenon: 'contraction', level: 1 });
    expect(msg).toMatch(/not 5-18 words/);
    expect(msg).toMatch(/did not contain the target phenomenon/);
    expect(generateRepairProblem({ ok: Array(5).fill({ text: 'a', vi: '' }), dropped: [] }, 5, { phenomenon: 'linking', level: 1 })).toBeNull();
  });
});

describe('coach (prompts-3, -10, -11, -12, ux-6)', () => {
  const DAY = 86400000;
  const now = new Date(2026, 10, 6, 12).getTime(); // a Friday
  const mk = (i: number, score: number, at: number, form = String.fromCharCode(65 + i)): CheckupResult => {
    const by = emptyByPhenomenon();
    by['flap-t'] = { seen: 5, missed: [4, 4, 2, 1, 1][i] ?? 1 };
    return {
      id: `c${i}`, at, form, voiceName: 'Kore', rate: 1,
      dictation: { words: 100, correct: score, extra: 0, pct: score, items: [] },
      comprehension: { correct: 2, total: 4, pct: 50, items: [] },
      byPhenomenon: by, score, durationSec: 600, completed: true,
    } as unknown as CheckupResult;
  };
  const checkups = [40, 47, 55, 61, 66].map((s, i) => mk(i, s, now - (4 - i) * 15 * DAY));
  const report = buildReport({ log: [], checkups, history: { version: 1, devices: {} } as never, stats: null, settings: { listenGoal: 30 }, now, period: '4w' });
  const input = buildCoachInput(report, checkups[4].byPhenomenon, checkups);

  it('sends the report trend, caveats and the comments already shown', () => {
    expect(input.checkups.trendScores).toEqual([40, 47, 55, 61, 66]);
    expect(input.checkups.testsBeforePeriod).toBe(report.checkups.earlier);
    expect(input.alreadyShown).toEqual(report.insights);
    const ph = input.checkups.phenomenonChanges.find((x) => x.phenomenon.startsWith('T bật'));
    expect(ph).toMatchObject({ earlyTests: 'missed 8/10 sentences', recentTests: 'missed 2/10 sentences', lowSample: false });
    const p = buildCoachPrompt(input);
    expect(p.system).toContain('never repeat those facts');
    expect(p.system).toContain('2 = 30–50%');
    expect(p.system).toContain('partial true');
  });

  it('marks the running week and sends minutes, not decimal hours', () => {
    expect(input.listening.perBucket.at(-1)?.partial).toBe(true);
    expect(JSON.stringify(input)).not.toContain('hours');
  });

  it('little data asks for at most one point', () => {
    const empty = buildCoachInput(buildReport({ log: [], checkups: [], history: { version: 1, devices: {} } as never, stats: null, settings: { listenGoal: 30 }, now, period: '4w' }));
    expect(coachDataIsSparse(empty)).toBe(true);
    expect(buildCoachPrompt(empty).user).toContain('at most 1 point');
    expect(coachDataIsSparse(input)).toBe(false);
  });

  it('removes paraphrased native-like claims and promises', () => {
    expect(stripDishonest('Bạn nghe giống dân Mỹ hơn rồi.')).toBe('');
    expect(stripDishonest('Bạn đã nghe trôi chảy như người nước ngoài.')).toBe('');
    expect(stripDishonest('Bạn sắp nghe hiểu 100% phim Mỹ.')).toBe('');
    expect(stripDishonest('Nghe đều mỗi ngày. Bạn sẽ nghe được hết phim.')).toBe('Nghe đều mỗi ngày.');
  });

  it('drops sentences with invented numbers and leftover filler bullets', () => {
    const out = sanitizeCoach(
      {
        headline: 'Điểm tăng từ 33 lên 66.',
        points: ['Bạn sắp nghe được như người bản ngữ rồi! Tiếp tục nhé.', 'Điểm gần nhất 66, tăng 5 điểm so với lần trước.'],
        nextWeek: ['Chép chính tả 20 câu T bật mỗi ngày.'],
      },
      input,
    );
    expect(out).toEqual({ headline: '', points: ['Điểm gần nhất 66, tăng 5 điểm so với lần trước.'], nextWeek: ['Chép chính tả 20 câu T bật mỗi ngày.'] });
  });
});
