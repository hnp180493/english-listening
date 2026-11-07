// Rules for every lesson of every course (docs/courses.md). Content authors: run
//   npx vitest run src/features/lessons src/data/respell.test.ts
// A failure message names the lesson, section/quiz index and what to fix.
import { describe, expect, it } from 'vitest';
import { COURSE_IDS } from '../../core/lessons';
import { COURSES } from '../../data/courses';
import { IRREGULAR_LESSONS } from '../../data/courses/irregular';
import { LOANWORDS_LESSONS } from '../../data/courses/loanwords';
import { SPELLING_LESSONS } from '../../data/courses/spelling';
import type { Lesson, QuizItem } from '../../data/lessonTypes';
import { CONNECTED_LESSONS, LESSONS, lessonsOf } from '../../data/lessons';
import { checkAnswer, isListeningItem, itemAudio, itemPhenomena } from './logic';
import { catalogueProblems, homophoneClashes, lessonProblems } from './validate';

describe('courses', () => {
  it('COURSES follow COURSE_IDS, with short Vietnamese titles and one-line summaries', () => {
    expect(COURSES.map((c) => c.id)).toEqual([...COURSE_IDS]);
    expect(COURSES.map((c) => c.order)).toEqual(COURSES.map((_, i) => i + 1));
    for (const c of COURSES) {
      expect(c.title.trim()).not.toBe('');
      expect(c.summary.trim()).not.toBe('');
      expect(c.summary.length, c.summary).toBeLessThanOrEqual(70);
    }
  });

  it('LESSONS holds every course file, in course order', () => {
    expect(LESSONS).toHaveLength(
      CONNECTED_LESSONS.length + SPELLING_LESSONS.length + IRREGULAR_LESSONS.length + LOANWORDS_LESSONS.length,
    );
    const rank = (l: Lesson) => COURSE_IDS.indexOf(l.course) * 1000 + l.order;
    expect(LESSONS.map(rank)).toEqual([...LESSONS.map(rank)].sort((a, b) => a - b));
    for (const [course, list] of [
      ['spelling', SPELLING_LESSONS],
      ['irregular', IRREGULAR_LESSONS],
      ['loanwords', LOANWORDS_LESSONS],
    ] as const) {
      for (const l of list) expect(l.course, `${l.id} is in the ${course} file`).toBe(course);
      expect(lessonsOf(course).map((l) => l.id)).toEqual([...list].sort((a, b) => a.order - b.order).map((l) => l.id));
    }
  });

  it('lesson ids are unique across courses and orders run 1..n within each course', () => {
    expect(catalogueProblems(LESSONS)).toEqual([]);
  });
});

describe.each(LESSONS.map((l) => [`${l.course}/${l.id}`, l] as const))('lesson %s', (_key, lesson) => {
  it('passes the content rules (blocks, 8 quiz items, types, no monospace)', () => {
    expect(lessonProblems(lesson)).toEqual([]);
  });

  it('items outside course "connected" record no phenomenon in the weakness stats', () => {
    if (lesson.course === 'connected') return;
    lesson.quiz.forEach((q, i) => expect(itemPhenomena(q, lesson.phenomenon), `${lesson.id}:${i}`).toEqual([]));
  });
});

// ---------------------------------------------------------------------------
// The validator itself, on a fixture that uses every new block and quiz type.
// ---------------------------------------------------------------------------

const choose = (over: Partial<Extract<QuizItem, { type: 'choose' }>> = {}): QuizItem => ({
  type: 'choose',
  prompt: 'Chữ "gh" trong từ này đọc thế nào?',
  show: 'laugh',
  options: ['/f/', 'không đọc', '/g/'],
  answer: 0,
  explain: 'gh cuối từ sau "au" đọc /f/.',
  ...over,
});

const FIXTURE: Lesson = {
  id: 'fixture-gh',
  course: 'spelling',
  order: 1,
  title: 'gh: lúc câm, lúc /f/',
  summary: 'Chữ gh có khi không đọc, có khi đọc /f/.',
  goal: 'Nhận ra gh câm và gh = /f/.',
  phenomenon: null,
  minutes: 6,
  sections: [
    {
      title: 'gh câm',
      blocks: [
        { type: 'text', md: 'Trong **night**, chữ gh không đọc.' },
        {
          type: 'words',
          title: 'Nghe từng từ',
          items: [
            { word: 'night', sound: 'nait', ipa: '/naɪt/', mark: 'ni(gh)t', note: 'gh câm.' },
            { word: 'laugh', sound: 'laf', mark: 'lau[gh]', why: 'Ngày xưa gh là một âm khàn trong cổ họng.' },
            { word: 'read', sound: 'red', say: 'I read it yesterday.', note: 'Quá khứ của read.' },
          ],
        },
      ],
    },
    {
      title: 'Vì sao lại thế?',
      blocks: [{ type: 'story', title: 'Âm khàn đã biến mất', md: 'Tiếng Anh cổ có âm /x/…', words: ['night', 'laugh'] }],
    },
  ],
  quiz: [
    choose(),
    choose({ play: 'I read the book last week.', show: undefined, options: ['red', 'reed'], answer: 0 }),
    { type: 'silent-letter', word: 'knight', silent: [0, 3, 4], explain: 'k và gh không đọc: nait.' },
    { type: 'silent-letter', word: 'island', silent: [1], prompt: 'Chữ nào không đọc?', explain: 's câm: ai-lənd.' },
    { type: 'listen-choose', options: ['tough', 'though', 'through'], answer: 0, explain: 'tough = tuf.' },
    { type: 'listen-type', text: 'We [laughed] a lot.', explain: 'laughed = laft.' },
    choose({ options: ['/f/', '/g/'], answer: 1, show: 'ghost' }),
    choose({ show: undefined }),
  ],
};

describe('lessonProblems (fixture)', () => {
  it('accepts a lesson using every new block and quiz type', () => {
    expect(lessonProblems(FIXTURE)).toEqual([]);
  });

  const broken = (patch: (l: Lesson) => void): string[] => {
    const l = structuredClone(FIXTURE);
    patch(l);
    return lessonProblems(l);
  };

  it('rejects malformed content with a message that says what to fix', () => {
    expect(broken((l) => (l.quiz = l.quiz.slice(0, 7))).join()).toMatch(/quiz must have 8 items/);
    expect(broken((l) => ((l as { course: string }).course = 'nope')).join()).toMatch(/unknown course/);
    expect(broken((l) => (l.phenomenon = 'linking')).join()).toMatch(/phenomenon must be null/);
    expect(broken((l) => (l.quiz[0] = choose({ answer: 3 }))).join()).toMatch(/answer out of range/);
    expect(broken((l) => (l.quiz[0] = choose({ options: ['a', 'A', 'b'] }))).join()).toMatch(/options repeat/);
    expect(
      broken((l) => (l.quiz[2] = { type: 'silent-letter', word: 'knight', silent: [0, 9], explain: 'x' })).join(),
    ).toMatch(/silent indices/);
    expect(
      broken((l) => (l.quiz[2] = { type: 'silent-letter', word: "can't", silent: [3], explain: 'x' })).join(),
    ).toMatch(/silent indices/); // index 3 is the apostrophe
    expect(broken((l) => (l.quiz[5] = { type: 'listen-type', text: 'We laughed.', explain: 'x' })).join()).toMatch(/\[gap\]/);
    expect(
      broken((l) => (l.quiz[4] = { type: 'listen-choose', options: ['knight', 'night', 'nine'], answer: 0, explain: 'x' })).join(),
    ).toMatch(/sound the same \(knight \/ night\)/);
    expect(broken((l) => (l.quiz[1] = choose({ play: 'read', options: ['red', 'reed'] }))).join()).toMatch(/lone heteronym/);
    expect(
      broken((l) => {
        const w = l.sections[0].blocks[1];
        if (w.type === 'words') w.items[2] = { word: 'read', sound: 'red' };
      }).join(),
    ).toMatch(/heteronym: add say/);
    expect(
      broken((l) => {
        const w = l.sections[0].blocks[1];
        if (w.type === 'words') w.items[0] = { word: 'night', sound: 'nait', mark: 'nig(h)t)' };
      }).join(),
    ).toMatch(/mark/);
    expect(
      broken((l) => {
        const w = l.sections[0].blocks[1];
        if (w.type === 'words') w.items[0] = { word: 'night', sound: '' };
      }).join(),
    ).toMatch(/sound \(respelling\) is empty/);
    expect(broken((l) => (l.sections[1].blocks[0] = { type: 'story', title: 'x', md: ' ' })).join()).toMatch(/story md is empty/);
    expect(broken((l) => (l.summary = 'đọc là `nait`')).join()).toMatch(/monospace/);
    expect(
      broken((l) => (l.quiz[0] = { ...choose(), phenomena: ['linking'] } as QuizItem)).join(),
    ).toMatch(/only course "connected" items carry phenomena/);
  });

  it('catalogueProblems finds duplicate ids and gaps in the order', () => {
    const second = { ...FIXTURE, order: 3 };
    expect(catalogueProblems([FIXTURE, second]).join('\n')).toMatch(/duplicate lesson id "fixture-gh"[\s\S]*orders must be 1..2, got 1, 3/);
  });

  it('homophoneClashes only flags words that sound the same', () => {
    expect(homophoneClashes(['night', 'knight', 'knit'])).toEqual(['night / knight']);
    expect(homophoneClashes(['read', 'red'])).toEqual(['read / red']);
    expect(homophoneClashes(['tough', 'though', 'through'])).toEqual([]);
  });
});

describe('new quiz types: behaviour', () => {
  const [plainChoose, listenChoose, silent] = FIXTURE.quiz;

  it("'choose' with play is a listening item and auto-plays; without play it is read", () => {
    expect(isListeningItem(listenChoose)).toBe(true);
    expect(itemAudio(listenChoose)).toBe('I read the book last week.');
    expect(isListeningItem(plainChoose)).toBe(false);
    expect(itemAudio(plainChoose)).toBeNull();
    expect(checkAnswer(plainChoose, { kind: 'choice', index: 0 }).correct).toBe(true);
    expect(checkAnswer(plainChoose, { kind: 'choice', index: 1 })).toMatchObject({ correct: false, expected: '/f/' });
  });

  it("'silent-letter' is correct only for the exact set, in any tap order", () => {
    expect(checkAnswer(silent, { kind: 'set', indices: [4, 0, 3] })).toMatchObject({ correct: true, picked: [0, 3, 4] });
    expect(checkAnswer(silent, { kind: 'set', indices: [0] })).toMatchObject({ correct: false, expected: 'k, gh' });
    expect(checkAnswer(silent, { kind: 'set', indices: [0, 3, 4, 5] }).correct).toBe(false);
    expect(checkAnswer(silent, { kind: 'choice', index: 0 }).correct).toBe(false);
    expect(isListeningItem(silent)).toBe(false);
    expect(itemAudio(silent)).toBe('knight');
  });

  it('items of a lesson without phenomenon record none (no "undefined" in stats)', () => {
    for (const q of FIXTURE.quiz) expect(itemPhenomena(q, null)).toEqual([]);
  });
});
