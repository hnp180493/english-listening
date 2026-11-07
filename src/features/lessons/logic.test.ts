import { describe, expect, it } from 'vitest';
import type { LessonProgress } from '../../core/lessons';
import type { ListenChooseItem, ListenTypeItem, SpotItem, WhichRuleItem } from '../../data/lessons';
import {
  letterGroups,
  letterIndices,
  parseMark,
  silentParts,
  checkAnswer,
  checkTyped,
  citationText,
  contextSentence,
  exactSpelling,
  letterDiff,
  letterDiffSummary,
  optionUnit,
  cleanWord,
  correctIndices,
  courseProgress,
  displayOrder,
  expectedAnswer,
  isConnectedSpeechItem,
  isPass,
  itemAudio,
  itemPhenomena,
  itemSentence,
  keyOf,
  lessonStatus,
  nextLessonAfter,
  parseGap,
  parseInline,
  parseMd,
  percent,
  recommendNext,
  scoreOf,
  shuffledOrder,
  speechText,
  spotAnswerIndices,
  spotOptions,
  spokenHint,
} from './logic';

const choose: ListenChooseItem = {
  type: 'listen-choose',
  options: ['I can go.', "I can't go.", 'I could go.'],
  answer: 1,
  explain: '',
};
const typeItem: ListenTypeItem = { type: 'listen-type', text: "I'm [going to] call you.", explain: '' };
const spotBoundary: SpotItem = {
  type: 'spot',
  text: 'Turn it off.',
  prompt: '',
  unit: 'boundary',
  answers: ['turn it', 'IT OFF'],
  explain: '',
};
const spotWord: SpotItem = { type: 'spot', text: "I can't believe it!", prompt: '', unit: 'word', answers: ["can't"], explain: '' };
const rule: WhichRuleItem = {
  type: 'which-rule',
  written: 'meet you (later)',
  spoken: 'mee-chu',
  options: ['linking', 'assimilation', 'elision'],
  answer: 'assimilation',
  explain: '',
};

describe('text helpers', () => {
  it('cleanWord strips outer punctuation but keeps apostrophes', () => {
    expect(cleanWord('it,')).toBe('it');
    expect(cleanWord('"can’t!"')).toBe("can't");
    expect(cleanWord('...')).toBe('');
  });

  it('keyOf normalises case, punctuation and curly quotes', () => {
    expect(keyOf('Turn  It,')).toBe('turn it');
    expect(keyOf('Can’t')).toBe("can't");
  });

  it('citationText separates words with commas', () => {
    expect(citationText('Turn it off.')).toBe('Turn, it, off.');
    expect(citationText("I'm here!")).toBe("I'm, here.");
    expect(citationText('   ')).toBe('');
  });
});

describe('parseGap', () => {
  it('splits a bracketed gap', () => {
    expect(parseGap("I'm [going to] call you.")).toEqual({
      before: "I'm",
      gap: 'going to',
      after: 'call you.',
      full: "I'm going to call you.",
    });
  });

  it('handles gaps at the start and before punctuation', () => {
    expect(parseGap('[Better] late than never.')?.full).toBe('Better late than never.');
    expect(parseGap('Nice to [meet you].')?.full).toBe('Nice to meet you.');
  });

  it('rejects missing, empty or multiple gaps', () => {
    expect(parseGap('No gap here.')).toBeNull();
    expect(parseGap('Empty [ ] gap')).toBeNull();
    expect(parseGap('[two] gaps [here]')).toBeNull();
  });

  it('speechText removes brackets', () => {
    expect(speechText(typeItem.text)).toBe("I'm going to call you.");
  });
});

describe('checkTyped', () => {
  it('accepts exact answers regardless of case and punctuation', () => {
    expect(checkTyped('going to', 'Going To!').correct).toBe(true);
  });

  it('accepts reduced spellings that mean the same words', () => {
    expect(checkTyped('going to', 'gonna').correct).toBe(true);
    expect(checkTyped("It'll", 'it will').correct).toBe(true);
    expect(checkTyped('should have', "should've").correct).toBe(true);
  });

  it('flags empty input', () => {
    expect(checkTyped('water', '   ')).toEqual({ correct: false, typo: false, empty: true });
  });

  it('rejects wrong or missing words', () => {
    expect(checkTyped('going to', 'going').correct).toBe(false);
    expect(checkTyped('him', 'them').correct).toBe(false);
  });

  it('accepts a one-letter slip on long words as a typo', () => {
    const r = checkTyped('water', 'watter');
    expect(r.correct).toBe(true);
    expect(r.typo).toBe(true);
  });

  it('does not treat a missing grammatical ending as a typo', () => {
    expect(checkTyped('missed', 'miss').correct).toBe(false);
  });
});

describe('exact spelling (courses other than connected)', () => {
  const debt: ListenTypeItem = { type: 'listen-type', text: 'I paid the [debt].', explain: '' };
  const cant: ListenTypeItem = { type: 'listen-type', text: "I [can't] swim.", explain: '' };

  it('only course connected (or no course) keeps typo tolerance', () => {
    expect(exactSpelling(undefined)).toBe(false);
    expect(exactSpelling('connected')).toBe(false);
    expect(exactSpelling('spelling')).toBe(true);
    expect(exactSpelling('irregular')).toBe(true);
    expect(exactSpelling('loanwords')).toBe(true);
  });

  it('rejects a one-letter slip that connected speech would accept', () => {
    expect(checkTyped('doubt', 'dout', true)).toEqual({ correct: false, typo: false, empty: false });
    expect(checkTyped('probably', 'probaly', true).correct).toBe(false);
    expect(checkTyped('probably', 'probaly').typo).toBe(true);
    expect(checkAnswer(debt, { kind: 'text', value: 'det' }, 'irregular')).toMatchObject({ correct: false, typo: false });
    expect(checkAnswer(debt, { kind: 'text', value: 'dett' }, 'spelling').correct).toBe(false);
  });

  it('ignores case, surrounding punctuation, whitespace and apostrophe style', () => {
    expect(checkAnswer(debt, { kind: 'text', value: '  Debt. ' }, 'irregular')).toMatchObject({ correct: true, typo: false });
    expect(checkAnswer(debt, { kind: 'text', value: '"DEBT"!' }, 'spelling').correct).toBe(true);
    expect(checkAnswer(cant, { kind: 'text', value: 'can’t' }, 'loanwords').correct).toBe(true);
    expect(checkAnswer(cant, { kind: 'text', value: "Can't" }, 'loanwords').correct).toBe(true);
    expect(checkTyped('ice cream', '  ice   cream ', true).correct).toBe(true);
  });

  it('does not accept equivalent spellings either: the letters are the point', () => {
    expect(checkTyped("can't", 'cannot', true).correct).toBe(false);
    expect(checkTyped("can't", 'cant', true).correct).toBe(false);
  });

  it('flags empty input', () => {
    expect(checkTyped('debt', ' . ', true)).toEqual({ correct: false, typo: false, empty: true });
  });

  it('connected course is unchanged', () => {
    const r = checkAnswer(typeItem, { kind: 'text', value: 'goin to' }, 'connected');
    expect(r).toMatchObject({ correct: true, typo: true });
    expect(checkAnswer(typeItem, { kind: 'text', value: 'goin to' })).toMatchObject({ correct: true, typo: true });
  });
});

describe('letterDiff', () => {
  it('marks a missing letter', () => {
    expect(letterDiff('debt', 'det')).toEqual([
      { text: 'de', kind: 'same' },
      { text: 'b', kind: 'missing' },
      { text: 't', kind: 'same' },
    ]);
    expect(letterDiffSummary(letterDiff('doubt', 'dout'))).toBe('thiếu b');
  });

  it('shows a wrong letter as extra then missing', () => {
    expect(letterDiff('debt', 'dept')).toEqual([
      { text: 'de', kind: 'same' },
      { text: 'p', kind: 'extra' },
      { text: 'b', kind: 'missing' },
      { text: 't', kind: 'same' },
    ]);
    expect(letterDiffSummary(letterDiff('debt', 'dept'))).toBe('gõ p thay vì b');
  });

  it('keeps the capital of a proper noun and names a one-letter swap in drawing order', () => {
    expect(letterDiff('Chicago', 'Shicago')).toEqual([
      { text: 'S', kind: 'extra' },
      { text: 'C', kind: 'missing' },
      { text: 'hicago', kind: 'same' },
    ]);
    expect(letterDiffSummary(letterDiff('Chicago', 'Shicago'))).toBe('gõ S thay vì C');
    expect(letterDiffSummary(letterDiff('debt', 'det'))).toBe('thiếu b');
    // no swap: missing and extra letters listed apart
    expect(letterDiffSummary(letterDiff('knight', 'nite'))).toBe('thiếu k, gh · thừa e');
  });

  it('handles homophones and extra letters', () => {
    expect(letterDiffSummary(letterDiff('know', 'no'))).toBe('thiếu k, w');
    expect(letterDiffSummary(letterDiff('said', 'saidd'))).toBe('thừa d');
  });

  it('compares like checkTyped: case, punctuation and apostrophes do not count', () => {
    expect(letterDiff('debt', 'DEBT.')).toEqual([{ text: 'debt', kind: 'same' }]);
    expect(letterDiffSummary(letterDiff("can't", 'can’t'))).toBe('');
    expect(letterDiff('debt', '  ')).toEqual([]);
  });
});

describe('prompt and word-row helpers', () => {
  it('optionUnit: từ, cụm từ or câu', () => {
    expect(optionUnit(['debt', 'doubt', 'dot'])).toBe('từ');
    expect(optionUnit([' debt ', "can't"])).toBe('từ');
    expect(optionUnit(['a cat', 'a kite', 'a kit'])).toBe('cụm từ');
    expect(optionUnit(['I can go.', 'go'])).toBe('câu');
    expect(optionUnit(['I can go to school', 'go'])).toBe('câu');
    expect(optionUnit(['Can you?', 'can'])).toBe('câu');
    expect(optionUnit([])).toBe('câu');
  });

  it('contextSentence: shows a sentence, never the word itself or a one-word override', () => {
    expect(contextSentence('read', 'I read it yesterday.')).toBe('I read it yesterday.');
    expect(contextSentence('read', ' read ')).toBeNull();
    expect(contextSentence('read', 'Read.')).toBeNull();
    expect(contextSentence('résumé', 'resume')).toBeNull();
    expect(contextSentence('read', undefined)).toBeNull();
  });
});

describe('options', () => {
  it('spotOptions builds word pairs for boundaries', () => {
    expect(spotOptions('Turn it off.', 'boundary')).toEqual(['Turn it', 'it off']);
    expect(spotOptions('Bless you!', 'word')).toEqual(['Bless', 'you']);
    expect(spotOptions('Hi', 'boundary')).toEqual([]);
  });

  it('spotAnswerIndices matches answers case-insensitively', () => {
    expect(spotAnswerIndices(spotBoundary)).toEqual([0, 1]);
    expect(spotAnswerIndices(spotWord)).toEqual([1]);
  });

  it('correctIndices works for every choice type', () => {
    expect(correctIndices(choose)).toEqual([1]);
    expect(correctIndices(rule)).toEqual([1]);
    expect(correctIndices(typeItem)).toEqual([]);
    expect(correctIndices({ ...choose, answer: 9 })).toEqual([]);
  });

  it('shuffledOrder is a deterministic permutation', () => {
    const a = shuffledOrder(4, 42);
    expect([...a].sort()).toEqual([0, 1, 2, 3]);
    expect(shuffledOrder(4, 42)).toEqual(a);
    expect(shuffledOrder(0, 1)).toEqual([]);
  });

  it('displayOrder keeps spot chips in sentence order', () => {
    expect(displayOrder(spotBoundary, 7)).toEqual([0, 1]);
    expect([...displayOrder(choose, 7)].sort()).toEqual([0, 1, 2]);
  });
});

describe('checkAnswer', () => {
  it('checks choice items by authored index', () => {
    expect(checkAnswer(choose, { kind: 'choice', index: 1 }).correct).toBe(true);
    expect(checkAnswer(choose, { kind: 'choice', index: 0 }).correct).toBe(false);
    expect(checkAnswer(rule, { kind: 'choice', index: 1 }).correct).toBe(true);
  });

  it('accepts any of several spot answers', () => {
    expect(checkAnswer(spotBoundary, { kind: 'choice', index: 0 }).correct).toBe(true);
    expect(checkAnswer(spotBoundary, { kind: 'choice', index: 1 }).correct).toBe(true);
  });

  it('checks typed items and reports the expected gap', () => {
    const ok = checkAnswer(typeItem, { kind: 'text', value: 'gonna' });
    expect(ok.correct).toBe(true);
    expect(ok.expected).toBe('going to');
    expect(checkAnswer(typeItem, { kind: 'text', value: 'want to' }).correct).toBe(false);
  });

  it('treats a response of the wrong kind as incorrect', () => {
    expect(checkAnswer(typeItem, { kind: 'choice', index: 0 }).correct).toBe(false);
    expect(checkAnswer(choose, { kind: 'text', value: "I can't go." }).correct).toBe(false);
  });

  it('expectedAnswer lists every accepted option', () => {
    expect(expectedAnswer(spotBoundary)).toBe('Turn it / it off');
    expect(expectedAnswer(choose)).toBe("I can't go.");
  });
});

describe('scoring and item info', () => {
  it('scoreOf and isPass', () => {
    expect(scoreOf([])).toBe(0);
    expect(scoreOf([true, false, true, true])).toBe(0.75);
    expect(isPass(0.75)).toBe(true);
    expect(isPass(0.5)).toBe(false);
  });

  it('percent clamps and rounds', () => {
    expect(percent(0.875)).toBe('88%');
    expect(percent(2)).toBe('100%');
    expect(percent(Number.NaN)).toBe('0%');
  });

  it('itemPhenomena falls back to the lesson phenomenon', () => {
    expect(itemPhenomena(choose, 'contraction')).toEqual(['contraction']);
    expect(itemPhenomena({ ...choose, phenomena: ['linking', 'linking', 'flap-t'] }, 'contraction')).toEqual(['linking', 'flap-t']);
    expect(itemPhenomena(choose, null)).toEqual([]);
    // intro/review: a which-rule item counts towards the phenomenon it asks about
    expect(itemPhenomena(rule, null)).toEqual(['assimilation']);
    expect(itemPhenomena(rule, 'linking')).toEqual(['linking']);
  });

  it('itemAudio and itemSentence', () => {
    expect(itemAudio(choose)).toBe("I can't go.");
    expect(itemAudio({ ...choose, say: 'custom' })).toBe('custom');
    expect(itemAudio(typeItem)).toBe("I'm going to call you.");
    expect(itemAudio(rule)).toBeNull();
    // Parenthesised context stays: the decoder needs "call" to turn "going to" into "gonna".
    expect(itemSentence(rule)).toBe('meet you later');
    expect(itemSentence({ ...rule, written: 'going to (call)' })).toBe('going to call');
    expect(itemSentence({ ...rule, written: "it'll ( be fine )" })).toBe("it'll be fine");
  });

  it('spokenHint shows a respelling only when it differs from the written text', () => {
    expect(spokenHint('Pick it up.', 'pi-ki-dup')).toBe('pi-ki-dup');
    expect(spokenHint('I like it.', 'i like it')).toBeNull();
    expect(spokenHint('Go!', '  ')).toBeNull();
  });
});

describe('course progress', () => {
  const lessons = [
    { id: 'b', order: 2 },
    { id: 'a', order: 1 },
    { id: 'c', order: 3 },
  ];
  const progress: LessonProgress = {
    a: { completedAt: 100, bestScore: 0.9, attempts: 2 },
    b: { completedAt: 0, bestScore: 0.4, attempts: 1 },
  };

  it('lessonStatus distinguishes new, tried and done', () => {
    expect(lessonStatus(progress, 'a')).toEqual({ state: 'done', best: 0.9, attempts: 2 });
    expect(lessonStatus(progress, 'b').state).toBe('tried');
    expect(lessonStatus(progress, 'c')).toEqual({ state: 'new', best: null, attempts: 0 });
  });

  it('courseProgress counts completed lessons', () => {
    expect(courseProgress(lessons, progress)).toEqual({ completed: 1, total: 3, ratio: 1 / 3 });
    expect(courseProgress([], {})).toEqual({ completed: 0, total: 0, ratio: 0 });
  });

  it('recommendNext picks the first unfinished lesson by order', () => {
    expect(recommendNext(lessons, progress)?.id).toBe('b');
    expect(recommendNext(lessons, {})?.id).toBe('a');
    const all: LessonProgress = {
      a: { completedAt: 1, bestScore: 1, attempts: 1 },
      b: { completedAt: 1, bestScore: 1, attempts: 1 },
      c: { completedAt: 1, bestScore: 1, attempts: 1 },
    };
    expect(recommendNext(lessons, all)).toBeNull();
  });

  it('nextLessonAfter follows course order', () => {
    expect(nextLessonAfter(lessons, 'a')?.id).toBe('b');
    expect(nextLessonAfter(lessons, 'c')).toBeNull();
    expect(nextLessonAfter(lessons, 'zzz')).toBeNull();
  });
});

describe('md-lite', () => {
  it('parseInline handles bold and unmatched markers', () => {
    expect(parseInline('a **b** c')).toEqual([
      { text: 'a ', bold: false },
      { text: 'b', bold: true },
      { text: ' c', bold: false },
    ]);
    expect(parseInline('x ** y')).toEqual([{ text: 'x ** y', bold: false }]);
  });

  it('parseMd splits paragraphs and bullet lists', () => {
    const blocks = parseMd('Intro line\nsame para\n\n- one\n- **two**\nafter');
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toEqual({ kind: 'p', spans: [{ text: 'Intro line same para', bold: false }] });
    expect(blocks[1].kind).toBe('ul');
    if (blocks[1].kind === 'ul') expect(blocks[1].items[1]).toEqual([{ text: 'two', bold: true }]);
    expect(blocks[2]).toEqual({ kind: 'p', spans: [{ text: 'after', bold: false }] });
    expect(parseMd('')).toEqual([]);
  });
});

describe('words and letters', () => {
  it('parseMark splits [highlighted] and (silent) groups and checks the letters', () => {
    expect(parseMark('knight', '(k)ni(gh)t')).toEqual([
      { text: 'k', kind: 'silent' },
      { text: 'ni', kind: 'plain' },
      { text: 'gh', kind: 'silent' },
      { text: 't', kind: 'plain' },
    ]);
    expect(parseMark('laugh', 'lau[gh]')).toEqual([
      { text: 'lau', kind: 'plain' },
      { text: 'gh', kind: 'mark' },
    ]);
    expect(parseMark('laugh', undefined)).toEqual([{ text: 'laugh', kind: 'plain' }]);
    for (const bad of ['lau[gh', 'lau[g(h)]', 'lau[]gh', 'lau(gh]', 'law[gh]', 'Laugh']) expect(parseMark('laugh', bad), bad).toBeNull();
  });

  it('letterGroups joins consecutive letters; silentParts marks them', () => {
    expect(letterGroups('knight', [4, 0, 3])).toBe('k, gh');
    expect(letterGroups('island', [1])).toBe('s');
    expect(silentParts('island', [1]).map((p) => p.text)).toEqual(['i', 's', 'land']);
  });

  it('letterIndices skips apostrophes, hyphens and spaces', () => {
    expect(letterIndices("can't")).toEqual([0, 1, 2, 4]);
  });
});

describe('isConnectedSpeechItem', () => {
  const lc: ListenChooseItem = { type: 'listen-choose', options: ['walk', 'work'], answer: 0, explain: '' };
  it('decodes listening items of the connected course (and when no course is given)', () => {
    expect(isConnectedSpeechItem(lc)).toBe(true);
    expect(isConnectedSpeechItem(lc, 'connected')).toBe(true);
  });
  it('does not decode listening items of other courses unless they list phenomena', () => {
    expect(isConnectedSpeechItem(lc, 'irregular')).toBe(false);
    expect(isConnectedSpeechItem({ ...lc, phenomena: ['linking'] }, 'spelling')).toBe(true);
  });
  it('never decodes choose / silent-letter items', () => {
    expect(isConnectedSpeechItem({ type: 'choose', prompt: 'p', options: ['a', 'b'], answer: 0, explain: '' }, 'connected')).toBe(false);
    expect(isConnectedSpeechItem({ type: 'silent-letter', word: 'knee', silent: [0], explain: '' })).toBe(false);
  });
});
