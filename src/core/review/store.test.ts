import { describe, expect, it } from 'vitest';
import { MIN_EASE, START_EASE } from '../srs';
import { EXTRA_STEP_SEC } from './constants';
import {
  cardsOfKind,
  emptyReviewStore,
  parseReviewStore,
  rollReviewDaily,
  storesEqual,
  withCard,
  withEnrolled,
  withExtra,
  withReviewed,
  withSince,
} from './store';
import { localDay } from './time';
import type { ReviewCard, ReviewStore } from './types';

const NOW = new Date(2026, 4, 10, 12, 0).getTime();
const TODAY = localDay(NOW);
const TOMORROW = new Date(2026, 4, 11, 9, 0).getTime();

const card = (id: string, over: Partial<ReviewCard> = {}): ReviewCard =>
  ({
    id,
    due: NOW,
    interval: 3,
    ease: 2.5,
    reps: 1,
    lapses: 0,
    last: NOW - 1000,
    ...over,
  }) as ReviewCard;

describe('parseReviewStore', () => {
  it('turns junk into an empty store for today', () => {
    for (const raw of [null, undefined, 'x', 42, [], { cards: 'nope', daily: [] }]) {
      expect(parseReviewStore(raw, NOW)).toEqual(emptyReviewStore(NOW));
    }
    expect(emptyReviewStore(NOW)).toEqual({
      version: 1,
      cards: {},
      daily: { day: TODAY, ids: [], exempt: [], extraSec: 0, enrolled: 0 },
      since: 0,
      notice: null,
      noticeSeenAt: 0,
    });
  });

  it('drops unsafe, chunk, unknown and empty keys', () => {
    // JSON.parse makes "__proto__" an own key, as a stored value would.
    const raw = JSON.parse(
      '{"cards":{"__proto__":{"due":1},"constructor":{"due":1},"chunk:gonna":{"due":1},"bogus:x":{"due":1},' +
        '"dict:":{"due":1},"dict:s1":{"due":5},"pair:can-cant":{"due":6},"lesson:intro":{"due":7},"media:m1:2":{"due":8}}}',
    );
    const s = parseReviewStore(raw, NOW);
    expect(Object.keys(s.cards).sort()).toEqual(['dict:s1', 'lesson:intro', 'media:m1:2', 'pair:can-cant']);
    expect(Object.getPrototypeOf(s.cards)).toBe(Object.prototype);
  });

  it('clamps numbers, keeps a future last raw, keeps suspended only when true, overwrites id', () => {
    const s = parseReviewStore(
      {
        cards: {
          'dict:a': {
            id: 'evil',
            due: 'x',
            interval: -5,
            ease: 99,
            reps: 2.7,
            lapses: -1,
            lastGrade: 'meh',
            last: 'x',
            suspended: 'yes',
          },
          'dict:b': {
            due: 10,
            interval: 1e9,
            ease: 0.1,
            reps: 3,
            lapses: 2,
            lastGrade: 'hard',
            last: NOW + 1e9,
            suspended: true,
          },
          'dict:c': { last: -4 },
          'dict:d': 'not a card',
        },
      },
      NOW,
    );
    expect(s.cards['dict:a']).toEqual({
      id: 'dict:a',
      due: NOW,
      interval: 0,
      ease: 5,
      reps: 2,
      lapses: 0,
      last: 0,
    });
    expect(s.cards['dict:b']).toEqual({
      id: 'dict:b',
      due: 10,
      interval: 36500,
      ease: MIN_EASE,
      reps: 3,
      lapses: 2,
      lastGrade: 'hard',
      last: NOW + 1e9,
      suspended: true,
    });
    expect(s.cards['dict:c']).toMatchObject({ ease: START_EASE, last: 0 });
    expect(s.cards['dict:d']).toBeUndefined();
  });

  it('daily: another day → empty; today → deduped valid ids, clamped counters, legacy extra ignored', () => {
    expect(
      parseReviewStore(
        {
          daily: {
            day: '2001-01-01',
            ids: ['dict:a'],
            extraSec: 300,
            enrolled: 4,
          },
        },
        NOW,
      ).daily,
    ).toEqual({
      day: TODAY,
      ids: [],
      exempt: [],
      extraSec: 0,
      enrolled: 0,
    });
    const d = parseReviewStore(
      {
        daily: {
          day: TODAY,
          ids: ['dict:a', 'dict:a', 'chunk:x', 'nope', 7, 'pair:p'],
          extraSec: -3,
          enrolled: 2.9,
          extra: 5,
        },
      },
      NOW,
    ).daily;
    expect(d).toEqual({
      day: TODAY,
      ids: ['dict:a', 'chunk:x', 'pair:p'],
      exempt: [],
      extraSec: 0,
      enrolled: 2,
    });
  });

  it('since / noticeSeenAt / notice', () => {
    expect(parseReviewStore({ since: -1, noticeSeenAt: 'x', notice: { count: 'x', at: 1 } }, NOW)).toMatchObject({
      since: 0,
      noticeSeenAt: 0,
      notice: null,
    });
    expect(
      parseReviewStore(
        {
          since: 5,
          noticeSeenAt: 6,
          notice: { count: 7.6, at: 8 },
          version: 9,
        },
        NOW,
      ),
    ).toMatchObject({
      version: 1,
      since: 5,
      noticeSeenAt: 6,
      notice: { count: 7, at: 8 },
    });
  });

  it('round-trips through JSON', () => {
    let s = emptyReviewStore(NOW);
    s = withCard(s, card('dict:a', { lastGrade: 'good', suspended: true }));
    s = withReviewed(s, 'pair:p', NOW);
    s = {
      ...withExtra(withEnrolled(s, NOW), NOW),
      since: 3,
      notice: { count: 5, at: 4 },
      noticeSeenAt: 2,
    };
    expect(parseReviewStore(JSON.parse(JSON.stringify(s)), NOW)).toEqual(s);
  });
});

describe('store transitions', () => {
  const base = emptyReviewStore(NOW);

  it('rollReviewDaily: same object on the same day, empty counters on a new day', () => {
    const s = withEnrolled(base, NOW);
    expect(rollReviewDaily(s, NOW + 1000)).toBe(s);
    const next = rollReviewDaily(s, TOMORROW);
    expect(next.daily).toEqual({
      day: localDay(TOMORROW),
      ids: [],
      exempt: [],
      extraSec: 0,
      enrolled: 0,
    });
  });

  it('withReviewed appends once, rolling the day first', () => {
    const a = withReviewed(withReviewed(base, 'dict:a', NOW), 'dict:a', NOW);
    expect(a.daily.ids).toEqual(['dict:a']);
    expect(withReviewed(a, 'chunk:b', NOW).daily.ids).toEqual(['dict:a', 'chunk:b']);
    expect(withReviewed(a, 'dict:c', TOMORROW).daily.ids).toEqual(['dict:c']);
  });

  it('withEnrolled / withExtra count today', () => {
    expect(withEnrolled(withEnrolled(base, NOW), NOW).daily.enrolled).toBe(2);
    expect(withExtra(withExtra(base, NOW), NOW).daily.extraSec).toBe(2 * EXTRA_STEP_SEC);
    expect(withExtra(withExtra(base, NOW), TOMORROW).daily.extraSec).toBe(EXTRA_STEP_SEC);
  });

  it('withSince sets it once', () => {
    const s = withSince(base, 123);
    expect(s.since).toBe(123);
    expect(withSince(s, 456)).toBe(s);
    expect(withSince(base, 0)).toBe(base);
  });

  it('cardsOfKind keys by ref', () => {
    const s = withCard(withCard(withCard(base, card('dict:a')), card('media:m1:2')), card('dict:b'));
    expect(Object.keys(cardsOfKind(s, 'dict')).sort()).toEqual(['a', 'b']);
    expect(Object.keys(cardsOfKind(s, 'media'))).toEqual(['m1:2']);
    expect(cardsOfKind(s, 'pair')).toEqual({});
  });

  it('storesEqual compares deeply and cheaply', () => {
    const a: ReviewStore = withReviewed(withCard(base, card('dict:a')), 'dict:a', NOW);
    const b: ReviewStore = JSON.parse(JSON.stringify(a));
    expect(storesEqual(a, b)).toBe(true);
    expect(storesEqual(a, a)).toBe(true);
    expect(storesEqual(a, { ...b, since: 1 })).toBe(false);
    expect(storesEqual(a, { ...b, noticeSeenAt: 1 })).toBe(false);
    expect(storesEqual(a, { ...b, notice: { count: 1, at: 1 } })).toBe(false);
    expect(storesEqual(a, withExtra(b, NOW))).toBe(false);
    expect(storesEqual(a, withEnrolled(b, NOW))).toBe(false);
    expect(storesEqual(a, withReviewed(b, 'dict:z', NOW))).toBe(false);
    expect(storesEqual(a, withCard(b, card('dict:a', { due: 1 })))).toBe(false);
    expect(storesEqual(a, withCard(b, card('dict:a', { suspended: true })))).toBe(false);
    expect(storesEqual(a, withCard(b, card('dict:x')))).toBe(false);
    expect(storesEqual(a, withCard(b, card('dict:a', { lastGrade: 'good' })))).toBe(false);
  });
});
