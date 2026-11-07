// Word cards (docs/review-system.md §13): ids, eligibility, the content index, admission (reconcile + queue),
// forecast, budget and a 60-day simulation with words next to sentences.
import { describe, expect, it } from 'vitest';
import { availableAt, type Grade } from '../srs';
import { LESSONS } from '../../data/lessons';
import type { Lesson, WordItem } from '../../data/lessonTypes';
import { emptyDrillStore } from '../../features/drill/drillStore';
import { buildCatalog, staticContentIds, type Catalog } from './catalog';
import { KIND_SECONDS, NEW_ENROL_PER_DAY, SEED_PER_DAY, WORD_NEW_PER_DAY } from './constants';
import { gradeWordChoice } from './grading';
import { makeCardId, parseCardId } from './ids';
import { admitToday, buildReviewQueue, collectEntries, forecast, isNewWord, newWordsLeft, summarize } from './queue';
import { reconcileCards, reconcileWordCards, type ReconcileInput } from './reconcile';
import { applyReview } from './schedule';
import {
  emptyReviewStore,
  parseReviewStore,
  storesEqual,
  withCard,
  withEnrolled,
  withNewWord,
  withReviewed,
} from './store';
import { localDayDiff, startOfLocalDay } from './time';
import type { CardId, ReviewCard, ReviewStore } from './types';
import {
  buildWordIndex,
  isReviewWord,
  lessonWordIds,
  lessonWordMap,
  looseSound,
  normWord,
  soundKey,
  wordAmbiguity,
  wordCardId,
  wordIndex,
  wordRef,
} from './words';

const NOW = new Date(2026, 4, 10, 12, 0).getTime();
const HOUR = 3_600_000;
const DAY_MS = 24 * HOUR;
const ALL: Catalog = { has: () => true };

function lesson(id: string, course: Lesson['course'], items: WordItem[], order = 1): Lesson {
  return {
    id,
    course,
    order,
    title: id,
    summary: '',
    phenomenon: null,
    minutes: 5,
    goal: '',
    sections: [{ title: 's', blocks: [{ type: 'words', items }] }],
    quiz: [],
  };
}

const w = (word: string, sound: string, over: Partial<WordItem> = {}): WordItem => ({ word, sound, ...over });

describe('word ids and eligibility', () => {
  it('normalises the word and keeps stress in the respelling', () => {
    expect(normWord('  Don’t  Know ')).toBe("don't know");
    expect(soundKey(' KER-nəl ')).toBe('KER-nəl');
    expect(soundKey('ri  KORD')).toBe('ri-KORD');
    expect(looseSound('KER-nəl')).toBe('kernəl');
    expect(wordRef('Colonel', 'KER-nəl')).toBe('colonel~KER-nəl');
    expect(wordCardId({ word: 'read', sound: 'red' })).toBe('word:read~red');
  });

  it('heteronyms get distinct ids, also when only the stress differs', () => {
    expect(wordCardId(w('read', 'reed'))).not.toBe(wordCardId(w('read', 'red')));
    expect(wordCardId(w('increase', 'IN-krees'))).not.toBe(wordCardId(w('increase', 'in-KREES')));
    expect(parseCardId(wordCardId(w('increase', 'IN-krees')))).toEqual({
      kind: 'word',
      ref: 'increase~IN-krees',
    });
  });

  it('course defaults: irregular and loanwords on, spelling and connected off; the row flag wins', () => {
    expect(isReviewWord({}, 'irregular')).toBe(true);
    expect(isReviewWord({}, 'loanwords')).toBe(true);
    expect(isReviewWord({}, 'spelling')).toBe(false);
    expect(isReviewWord({}, 'connected')).toBe(false);
    expect(isReviewWord({ review: true }, 'spelling')).toBe(true);
    expect(isReviewWord({ review: false }, 'irregular')).toBe(false);
    expect(isReviewWord({}, 'nope')).toBe(false);
  });

  it('lessonWordIds: distinct, teaching order, flags respected', () => {
    const sp = lesson('sp', 'spelling', [
      w('ghost', 'gohst'),
      w('laugh', 'laf', { review: true }),
      w('laugh', 'laf', { review: true }),
    ]);
    expect(lessonWordIds(sp)).toEqual(['word:laugh~laf']);
    const ir = lesson('ir', 'irregular', [w('read', 'reed'), w('read', 'red'), w('knight', 'nait', { review: false })]);
    expect(lessonWordIds(ir)).toEqual(['word:read~reed', 'word:read~red']);
  });
});

describe('buildWordIndex', () => {
  const lessons = [
    lesson('sp-1', 'spelling', [w('night', 'nait'), w('laugh', 'laf', { review: true })]),
    lesson('ir-1', 'irregular', [w('knight', 'nait', { mark: '(k)night' }), w('laugh', 'laf', { why: 'story' })]),
    lesson('ir-2', 'irregular', [w('laugh', 'laf', { note: 'n' }), w('read', 'reed', { say: 'I read every day.' })], 2),
  ];
  const ix = buildWordIndex(lessons);

  it('one card per word + sound across lessons; first row wins, missing fields filled', () => {
    const laugh = ix.byId.get('word:laugh~laf')!;
    expect(laugh.lessonId).toBe('sp-1');
    expect(laugh.lessons).toEqual(['sp-1', 'ir-1', 'ir-2']);
    expect(laugh.item.why).toBe('story');
    expect(laugh.item.note).toBe('n');
    expect(ix.byId.has('word:night~nait')).toBe(false); // spelling row without review
    expect(ix.byLesson.get('ir-1')).toEqual(['word:knight~nait', 'word:laugh~laf']);
    expect(ix.all.map((s) => s.ref)).toEqual(['laugh~laf', 'knight~nait', 'read~reed']);
  });

  it('ambiguity uses every row of the content, review on or off', () => {
    expect(wordAmbiguity(ix.byId.get('word:knight~nait')!, ix.rows)).toEqual({
      homophone: true,
      heteronym: false,
    });
    expect(wordAmbiguity(ix.byId.get('word:laugh~laf')!, ix.rows)).toEqual({
      homophone: false,
      heteronym: false,
    });
    const het = buildWordIndex([
      lesson('x', 'irregular', [
        w('read', 'reed'),
        w('read', 'red'),
        w('increase', 'IN-krees'),
        w('increase', 'in-KREES'),
      ]),
    ]);
    for (const s of het.all) expect(wordAmbiguity(s, het.rows).heteronym).toBe(true);
  });

  it('the app content: every card id parses, is in the catalog, and heteronyms of the course are separate cards', () => {
    const real = wordIndex();
    expect(real.all.length).toBeGreaterThan(100);
    const refs = staticContentIds().wordRefs;
    for (const s of real.all) {
      expect(parseCardId(s.id)).toEqual({ kind: 'word', ref: s.ref });
      expect(refs.has(s.ref)).toBe(true);
    }
    expect(real.byId.has('word:read~reed')).toBe(true);
    expect(real.byId.has('word:read~red')).toBe(true);
    // the spelling course is off by default: only its rows flagged review: true make cards
    for (const l of LESSONS.filter((x) => x.course === 'spelling')) {
      for (const id of real.byLesson.get(l.id) ?? []) {
        const rows = l.sections.flatMap((s) => s.blocks).flatMap((b) => (b.type === 'words' ? b.items : []));
        expect(rows.some((r) => r.review === true && wordCardId(r) === id)).toBe(true);
      }
    }
    expect(lessonWordMap(real)).toEqual(Object.fromEntries(real.byLesson));
  });

  it('catalog: a word removed from the content is an orphan (skipped, not a crash)', () => {
    const cat = buildCatalog({
      builtinSentenceIds: new Set(),
      customSentenceIds: new Set(),
      lessonIds: new Set(),
      chunkIds: new Set(),
      pairSetIds: new Set(),
      media: new Map(),
      wordRefs: new Set(['read~red']),
    });
    expect(cat.has('word:read~red')).toBe(true);
    expect(cat.has('word:gone~gon')).toBe(false);
    let s = emptyReviewStore(NOW);
    s = withCard(s, card('word:gone~gon'));
    s = withCard(s, card('word:read~red'));
    expect(collectEntries(s, emptyDrillStore(NOW), cat, NOW).map((e) => e.id)).toEqual(['word:read~red']);
    // kept in the store (a later content version may bring it back)
    expect(parseReviewStore(JSON.parse(JSON.stringify(s)), NOW).cards['word:gone~gon']).toBeDefined();
  });
});

// ───────────── admission: reconcile ─────────────

function rinput(over: Partial<ReconcileInput> = {}): ReconcileInput {
  return {
    dictation: {},
    sentenceIds: new Set(),
    pairs: { items: {}, sets: {} },
    pairSets: {},
    lessons: {},
    lessonIds: new Set(['l1', 'l2', 'l3']),
    media: [],
    shadowWeak: [],
    ...over,
  };
}

const ids = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => makeCardId('word', `${prefix}${i}~x${prefix}${i}`));
const dayOf = (c: ReviewCard) => Math.max(0, localDayDiff(NOW, availableAt(c)));

describe('word admission (reconcile)', () => {
  const words = {
    l1: ids('a', 5),
    l2: ids('b', 3),
    l3: [...ids('a', 2), ...ids('c', 2)],
  };

  it('a passed lesson makes its words eligible; a lesson not passed does not', () => {
    const r = reconcileCards(
      rinput({
        lessons: {
          l1: { completedAt: NOW - 3 * DAY_MS, bestScore: 0.8, attempts: 1 },
          l2: { completedAt: 0, bestScore: 0.5, attempts: 2 },
        },
        lessonWords: words,
      }),
      {},
      { since: NOW, now: NOW },
    );
    const wordIds = Object.keys(r.cards).filter((id) => id.startsWith('word:'));
    expect(wordIds.sort()).toEqual([...words.l1].sort());
    for (const id of wordIds) {
      const c = r.cards[id];
      expect(c).toMatchObject({
        interval: 0,
        reps: 0,
        lapses: 0,
        last: 0,
        born: NOW,
      });
      expect(c.lastGrade).toBeUndefined();
    }
  });

  it('dedupes words shared by two passed lessons (one card) and keeps teaching order', () => {
    const r = reconcileCards(
      rinput({
        lessons: {
          l1: { completedAt: NOW - 3 * DAY_MS, bestScore: 1, attempts: 1 },
          l3: { completedAt: NOW - 2 * DAY_MS, bestScore: 1, attempts: 1 },
        },
        lessonWords: words,
      }),
      {},
      { since: NOW, now: NOW },
    );
    const wordIds = Object.keys(r.cards).filter((id) => id.startsWith('word:'));
    expect(wordIds.sort()).toEqual([...words.l1, ...ids('c', 2)].sort()); // a0..a4 + c0, c1
    expect(r.created).toBe(7 + 2); // + the two lesson cards
  });

  it('history from before the feature: every word starts today, outside the seeding load', () => {
    const many = { l1: ids('m', 20) };
    const inp = rinput({ lessons: { l1: { completedAt: NOW - 40 * DAY_MS, bestScore: 1, attempts: 1 } }, lessonWords: many });
    const r = reconcileCards(inp, {}, { since: NOW, now: NOW });
    expect(r.created).toBe(21);
    expect(r.words).toBe(20);
    // the queue paces new words (WORD_NEW_PER_DAY a day): reconcile does not spread them
    for (const id of many.l1) expect(r.cards[id].due).toBe(NOW);
    // the lesson card (KNOWN: from tomorrow) is not pushed back by its 20 words
    expect(dayOf(r.cards['lesson:l1'])).toBe(1);
    // a second run is a no-op
    expect(reconcileCards(inp, r.cards, { since: NOW, now: NOW })).toEqual({ cards: {}, created: 0, words: 0, moved: 0 });
  });

  it('waiting words never push other catch-up or later lessons back, and are never re-spread', () => {
    // 200 words of older lessons still waiting (never answered), seeded on earlier days
    const waiting: Record<string, ReviewCard> = {};
    for (const id of ids('w', 200)) waiting[id] = { ...fresh(id), due: NOW - 5 * DAY_MS, born: NOW - 5 * DAY_MS };
    const inp = rinput({
      dictation: { s1: { attempts: 2, best: 0.4, lastAt: NOW - DAY_MS } as never },
      sentenceIds: new Set(['s1']),
      lessons: {
        l1: { completedAt: NOW - 6 * DAY_MS, bestScore: 1, attempts: 1 },
        l2: { completedAt: NOW - HOUR, bestScore: 1, attempts: 1 },
      },
      lessonWords: { l1: Object.keys(waiting) as CardId[], l2: words.l2 },
    });
    const r = reconcileCards(inp, waiting, { since: NOW, now: NOW });
    expect(r.moved).toBe(0);
    for (const id of Object.keys(waiting)) expect(r.cards[id]).toBeUndefined();
    expect(dayOf(r.cards['dict:s1'])).toBe(0); // WEAK: today, not after the waiting words
    for (const id of words.l2) expect(r.cards[id].due).toBe(startOfLocalDay(NOW, 1)); // passed today: tomorrow
    // the lesson-pass hook places them the same way
    const hook = reconcileWordCards(inp, waiting, { now: NOW, lessonId: 'l2' });
    for (const id of words.l2) expect(hook.cards[id].due).toBe(startOfLocalDay(NOW, 1));
  });

  it('a lesson passed today starts its words tomorrow', () => {
    const r = reconcileWordCards(
      {
        lessons: {
          l2: { completedAt: NOW - HOUR, bestScore: 0.75, attempts: 1 },
        },
        lessonWords: words,
      },
      {},
      { now: NOW, lessonId: 'l2' },
    );
    expect(r.created).toBe(3);
    for (const c of Object.values(r.cards)) expect(c.due).toBe(startOfLocalDay(NOW, 1));
  });

  it('reconcileWordCards: only the given lesson, existing cards kept, outside the seeded load', () => {
    const existing: Record<string, ReviewCard> = {};
    for (const id of ids('z', SEED_PER_DAY)) {
      existing[id] = { ...card(id), due: startOfLocalDay(NOW, 1), last: 0, lastGrade: undefined };
    }
    existing[words.l1[0]] = card(words.l1[0]);
    const r = reconcileWordCards(
      {
        lessons: {
          l1: { completedAt: NOW - HOUR, bestScore: 1, attempts: 1 },
          l2: { completedAt: NOW - HOUR, bestScore: 1, attempts: 1 },
        },
        lessonWords: words,
      },
      existing,
      { now: NOW, lessonId: 'l1' },
    );
    expect(Object.keys(r.cards).sort()).toEqual(words.l1.slice(1).sort());
    for (const c of Object.values(r.cards)) expect(dayOf(c)).toBe(1); // day 1 full of seeded cards: words start anyway
    expect(r.moved).toBe(0);
  });
});

// ───────────── admission: today's queue ─────────────

function card(id: CardId, over: Partial<ReviewCard> = {}): ReviewCard {
  return {
    id,
    due: NOW - HOUR,
    interval: 3,
    ease: 2.5,
    reps: 1,
    lapses: 0,
    last: NOW - 3 * DAY_MS,
    lastGrade: 'good',
    ...over,
  };
}
const fresh = (id: CardId): ReviewCard => ({
  id,
  due: NOW - HOUR,
  interval: 0,
  ease: 2.5,
  reps: 0,
  lapses: 0,
  last: 0,
  born: 1,
});

function storeWith(cards: ReviewCard[], fn: (s: ReviewStore) => ReviewStore = (s) => s): ReviewStore {
  let s = emptyReviewStore(NOW);
  for (const c of cards) s = withCard(s, c);
  return fn(s);
}

describe('word admission (queue)', () => {
  it('new words come last and at most WORD_NEW_PER_DAY a day are admitted', () => {
    const s = storeWith([
      ...ids('n', 12).map(fresh),
      card('dict:s1', { interval: 0, lastGrade: 'again' }),
      card('word:old~old'),
    ]);
    const entries = collectEntries(s, emptyDrillStore(NOW), ALL, NOW);
    const adm = admitToday(entries, s, 3600, NOW);
    const admitted = adm.admitted.map((e) => e.id);
    expect(admitted.slice(0, 2)).toEqual(['dict:s1', 'word:old~old']);
    expect(admitted.filter((id) => isNewWord(entries.find((e) => e.id === id)!))).toHaveLength(WORD_NEW_PER_DAY);
    expect(adm.deferred).toHaveLength(12 - WORD_NEW_PER_DAY);
    expect(adm.held).toHaveLength(0);
    // deferred new words never turn back-pressure on
    expect(summarize(entries, s, 3600, NOW).heldBack).toBe(0);
  });

  it('words answered today and the shared new-item budget reduce the allowance', () => {
    let s = storeWith(ids('n', 10).map(fresh));
    s = withNewWord(withNewWord(s, NOW), NOW);
    expect(s.daily).toMatchObject({ enrolled: 2, newWords: 2 });
    expect(newWordsLeft(s, NOW)).toBe(WORD_NEW_PER_DAY - 2);
    for (let i = 0; i < NEW_ENROL_PER_DAY - 3; i++) s = withEnrolled(s, NOW);
    expect(newWordsLeft(s, NOW)).toBe(1);
    const adm = admitToday(collectEntries(s, emptyDrillStore(NOW), ALL, NOW), s, 3600, NOW);
    expect(adm.admitted).toHaveLength(1);
    // a new day starts a new allowance
    expect(newWordsLeft(s, NOW + DAY_MS)).toBe(WORD_NEW_PER_DAY);
  });

  it('no new word while graded items are held back (back-pressure), none over the time budget', () => {
    const graded = Array.from({ length: 20 }, (_, i) => card(makeCardId('dict', `s${i}`)));
    const s = storeWith([...graded, ...ids('n', 4).map(fresh)]);
    const entries = collectEntries(s, emptyDrillStore(NOW), ALL, NOW);
    const adm = admitToday(entries, s, 300, NOW);
    expect(adm.held.length).toBeGreaterThan(0);
    expect(adm.admitted.some((e) => e.kind === 'word')).toBe(false);
    expect(adm.deferred.filter((e) => e.kind === 'word')).toHaveLength(4);
    // just enough budget for the graded items: words wait (deferred), nothing held
    const s2 = storeWith(ids('n', 4).map(fresh));
    const adm2 = admitToday(collectEntries(s2, emptyDrillStore(NOW), ALL, NOW), s2, KIND_SECONDS.word * 2, NOW);
    expect(adm2.admitted).toHaveLength(2);
    expect(adm2.deferred).toHaveLength(2);
  });

  it('a word card costs KIND_SECONDS.word (15 s) in the budget and the summary', () => {
    expect(KIND_SECONDS.word).toBe(15);
    const s = storeWith(Array.from({ length: 4 }, (_, i) => card(makeCardId('word', `w${i}~w${i}`))));
    const sum = summarize(collectEntries(s, emptyDrillStore(NOW), ALL, NOW), s, 600, NOW);
    expect(sum.dueToday).toBe(4);
    expect(sum.dueTodaySec).toBe(60);
    expect(sum.dueByKind.word).toBe(4);
    const spent = withReviewed(s, 'word:w0~w0', NOW);
    expect(summarize(collectEntries(spent, emptyDrillStore(NOW), ALL, NOW), spent, 600, NOW).spentSec).toBe(15);
  });

  it('the queue serves graded words before new ones, interleaved with the tap kinds', () => {
    const s = storeWith([fresh('word:n~n'), card('word:g~g'), card('pair:p1')]);
    const q = buildReviewQueue(collectEntries(s, emptyDrillStore(NOW), ALL, NOW), s, 600, NOW);
    expect(q.indexOf('word:g~g')).toBeLessThan(q.indexOf('word:n~n'));
    expect(q).toHaveLength(3);
  });

  it('new words: the newest first day first, then teaching order (not alphabetical)', () => {
    const ix = wordIndex();
    const [lessonId, taught] = [...ix.byLesson.entries()].find(([, l]) => l.length >= WORD_NEW_PER_DAY + 2)!;
    expect(lessonId).toBeTruthy();
    const older = ids('o', 3).map((id) => ({ ...fresh(id), due: NOW - 3 * DAY_MS }));
    const s = storeWith([...older, ...taught.map((id) => ({ ...fresh(id), due: startOfLocalDay(NOW) }))]);
    const adm = admitToday(collectEntries(s, emptyDrillStore(NOW), ALL, NOW), s, 3600, NOW);
    // the lesson passed last comes first, in the order the lesson teaches its words
    expect(adm.admitted.map((e) => e.id)).toEqual(taught.slice(0, WORD_NEW_PER_DAY));
    expect(adm.deferred.map((e) => e.id).slice(-3)).toEqual(ids('o', 3));
  });

  it('a skipped graded item is met before any new word (held decided first)', () => {
    const graded = Array.from({ length: 3 }, (_, i) => card(makeCardId('dict', `s${i}`)));
    const s = storeWith([...graded, ...ids('n', 3).map(fresh)]);
    const entries = collectEntries(s, emptyDrillStore(NOW), ALL, NOW);
    // budget for two dictation items: the skipped one is held, so no new word may start
    const later = new Set<CardId>(['dict:s0']);
    const adm = admitToday(entries, s, KIND_SECONDS.dict * 2, NOW, later);
    expect(adm.held.map((e) => e.id)).toEqual(['dict:s0']);
    expect(adm.admitted.some((e) => e.kind === 'word')).toBe(false);
    // the session agrees with the summary (no `later` there)
    const q = buildReviewQueue(entries, s, KIND_SECONDS.dict * 2, NOW, { later });
    expect(q.some((id) => id.startsWith('word:'))).toBe(false);
    expect(summarize(entries, s, KIND_SECONDS.dict * 2, NOW).heldBack).toBe(1);
  });

  it('learn-ahead never pulls in a never-answered word seeded for tomorrow', () => {
    const late = startOfLocalDay(NOW, 1) - 10 * 60_000; // 23:50
    const s = storeWith(ids('n', 3).map((id) => ({ ...fresh(id), due: startOfLocalDay(NOW, 1) })));
    const q = buildReviewQueue(collectEntries(s, emptyDrillStore(late), ALL, late), s, 600, late);
    expect(q).toEqual([]);
    // a learning step due in 10 minutes still fills the session
    const step = storeWith([card('word:g~g', { interval: 0, lastGrade: 'again', due: late + 10 * 60_000 })]);
    expect(buildReviewQueue(collectEntries(step, emptyDrillStore(late), ALL, late), step, 600, late)).toEqual([
      'word:g~g',
    ]);
  });

  it('summary: waiting new words are no postponed due items', () => {
    const s = storeWith(ids('n', 39).map(fresh));
    const sum = summarize(collectEntries(s, emptyDrillStore(NOW), ALL, NOW), s, 600, NOW);
    expect(sum.dueToday).toBe(WORD_NEW_PER_DAY);
    expect(sum.heldBack + sum.deferred).toBe(0);
    expect(sum.wordsWaiting).toBe(39 - WORD_NEW_PER_DAY);
    expect(sum.newWordsLeft).toBe(WORD_NEW_PER_DAY);
  });

  it('forecast: new words start WORD_NEW_PER_DAY a day, the rest move to the next days', () => {
    const s = storeWith(ids('n', WORD_NEW_PER_DAY * 2 + 1).map(fresh), (x) => withNewWord(x, NOW));
    const fc = forecast(collectEntries(s, emptyDrillStore(NOW), ALL, NOW), NOW, 4, s);
    expect(fc.map((d) => d.count)).toEqual([WORD_NEW_PER_DAY - 1, WORD_NEW_PER_DAY, 2, 0]);
    expect(fc[1].seconds).toBe(WORD_NEW_PER_DAY * KIND_SECONDS.word);
  });
});

describe('word grading and the store', () => {
  it('gradeWordChoice: first pick right → good, wrong → again', () => {
    expect(gradeWordChoice(true)).toBe('good');
    expect(gradeWordChoice(false)).toBe('again');
  });

  it('a new word answered: graded by gradeAuto like other stored kinds', () => {
    const id: CardId = 'word:read~red';
    const r = applyReview(fresh(id), id, 'good', {
      ctx: 'review',
      enrol: true,
      enrolLeft: 0,
      now: NOW,
    });
    expect(r.reason).toBe('graded');
    expect(r.card).toMatchObject({
      interval: 1,
      reps: 1,
      lastGrade: 'good',
      born: 1,
    });
    const miss = applyReview(fresh(id), id, 'again', {
      ctx: 'review',
      enrol: true,
      enrolLeft: 0,
      now: NOW,
    });
    expect(miss.card).toMatchObject({
      interval: 0,
      reps: 0,
      lastGrade: 'again',
    });
  });

  it('notice.words is parsed (never above count) and compared', () => {
    const s: ReviewStore = { ...emptyReviewStore(NOW), notice: { count: 30, at: NOW, words: 25 } };
    const back = parseReviewStore(JSON.parse(JSON.stringify(s)), NOW);
    expect(back.notice).toEqual({ count: 30, at: NOW, words: 25 });
    expect(storesEqual(back, s)).toBe(true);
    expect(storesEqual(back, { ...s, notice: { count: 30, at: NOW } })).toBe(false);
    expect(parseReviewStore({ notice: { count: 3, at: NOW, words: 9 } }, NOW).notice).toEqual({ count: 3, at: NOW, words: 3 });
    expect(parseReviewStore({ notice: { count: 3, at: NOW, words: -1 } }, NOW).notice).toEqual({ count: 3, at: NOW });
  });

  it('newWords is parsed, compared and defaults to absent', () => {
    const s = withNewWord(emptyReviewStore(NOW), NOW);
    const back = parseReviewStore(JSON.parse(JSON.stringify(s)), NOW);
    expect(back.daily.newWords).toBe(1);
    expect(storesEqual(back, s)).toBe(true);
    expect(storesEqual(back, emptyReviewStore(NOW))).toBe(false);
    expect(parseReviewStore({ daily: { ...s.daily, newWords: -3 } }, NOW).daily.newWords).toBeUndefined();
    expect(emptyReviewStore(NOW).daily.newWords).toBeUndefined();
  });
});

// ───────────── 60-day simulation: lessons of words + sentences, budget 600 s ─────────────

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function simGrade(id: string, isNew: boolean, day: number, step: number): Grade {
  const r = hash(`${id}|${day}|${step}`) % 100;
  if (isNew) return r < 60 ? 'good' : r < 85 ? 'hard' : 'again';
  return r < 85 ? 'good' : r < 95 ? 'hard' : 'again';
}

/** Learner: passes a 15-word lesson every second day; tries `sentences` new sentences a day when nothing is held. */
function simulate(sentences: number) {
  const drill = emptyDrillStore(NOW);
  const start = new Date(2026, 0, 5, 0, 0).getTime();
  let s = emptyReviewStore(start);
  let next = 0;
  const held: number[] = [];
  const lessonWords: Record<string, CardId[]> = {};
  const progress: Record<string, { completedAt: number; bestScore: number; attempts: number }> = {};
  let newWordsMax = 0;

  for (let d = 0; d < 60; d++) {
    const morning = startOfLocalDay(start, d) + 8 * HOUR;
    const startHeld = summarize(collectEntries(s, drill, ALL, morning), s, 600, morning).heldBack;
    held.push(startHeld);

    // Ôn tập: everything served today
    let t = morning;
    for (let pass = 0; pass < 40; pass++) {
      const q = buildReviewQueue(collectEntries(s, drill, ALL, t), s, 600, t);
      if (!q.length) break;
      for (const id of q) {
        const prev = s.cards[id];
        const isNew = id.startsWith('word:') && prev?.lastGrade === undefined;
        const r = applyReview(prev, id, simGrade(id, isNew, d, pass), {
          ctx: 'review',
          enrol: true,
          enrolLeft: 0,
          now: t,
        });
        if (r.card) s = withCard(s, r.card);
        if (isNew && (r.reason === 'graded' || r.reason === 'lapsed')) s = withNewWord(s, t);
        if (r.reason === 'graded' || r.reason === 'lapsed') s = withReviewed(s, id, t);
        t += (id.startsWith('word:') ? 15 : 40) * 1000;
      }
      t += 2 * 60_000;
    }
    newWordsMax = Math.max(newWordsMax, s.daily.newWords ?? 0);

    // a lesson of 15 words every second day, whatever the backlog
    if (d % 2 === 0) {
      const lid = `l${d}`;
      lessonWords[lid] = ids(`d${d}x`, 15);
      progress[lid] = {
        completedAt: startOfLocalDay(start, d) + 17 * HOUR,
        bestScore: 0.9,
        attempts: 1,
      };
      const r = reconcileWordCards({ lessons: progress, lessonWords }, s.cards, {
        now: progress[lid].completedAt,
        lessonId: lid,
      });
      s = { ...s, cards: { ...s.cards, ...r.cards } };
    }
    // new sentences only when nothing was held back this morning
    if (startHeld === 0) {
      let tt = startOfLocalDay(start, d) + 18 * HOUR;
      for (let i = 0; i < sentences; i++) {
        const id = makeCardId('dict', `n${next++}`);
        const fail = hash(id) % 100 < 20;
        const enrolLeft = summarize(collectEntries(s, drill, ALL, tt), s, 600, tt).enrolLeft;
        const r = applyReview(undefined, id, fail ? 'again' : 'good', {
          ctx: 'practice',
          enrol: true,
          enrolLeft,
          now: tt,
        });
        if (r.card) s = withCard(s, r.card);
        if (r.reason === 'enrolled' && r.budgeted) s = withEnrolled(s, tt);
        tt += 60_000;
      }
    }
  }
  const words = Object.values(s.cards).filter((c) => c.id.startsWith('word:'));
  return {
    held,
    newWordsMax,
    answered: words.filter((c) => c.lastGrade !== undefined).length,
    sentences: Object.keys(s.cards).filter((id) => id.startsWith('dict:')).length,
  };
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('simulation with words (60 days, budget 600 s)', () => {
  it('words alone: they start WORD_NEW_PER_DAY a day and never build a backlog', () => {
    const r = simulate(0);
    expect(r.newWordsMax).toBe(WORD_NEW_PER_DAY);
    expect(Math.max(...r.held)).toBe(0);
    expect(r.answered).toBeGreaterThan(300); // of 450 taught
  });

  it('words next to 8 new sentences a day: backlog bounded, words still flow in', () => {
    const r = simulate(8);
    expect(r.newWordsMax).toBeLessThanOrEqual(WORD_NEW_PER_DAY);
    expect(Math.max(...r.held)).toBeLessThanOrEqual(45);
    expect(mean(r.held.slice(30))).toBeLessThanOrEqual(mean(r.held.slice(0, 30)) + 5);
    // reviews of started words come first, so new words wait on busy days but keep coming
    expect(r.answered).toBeGreaterThan(100);
    expect(r.sentences).toBeGreaterThan(50);
  });
});
