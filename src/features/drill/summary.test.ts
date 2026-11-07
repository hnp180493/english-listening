import { describe, expect, it } from 'vitest';
import { DAY, MINUTE, buildQueue, countDue, newCard, type CardState } from '../../core/srs';
import type { Chunk } from '../../core/types';
import { emptyDrillStore, type DrillStore } from './drillStore';
import { computeDrillSummary, drillSummary, EXTRA_NEW, extraAfterLearnMore, newCardQuota } from './summary';

const NOW = new Date(2026, 10, 5, 10, 0, 0).getTime();

function chunk(id: string, rank: number): Chunk {
  return { id, written: `w ${id}`, spoken: id, ttsText: id, phenomena: ['linking'], meaning: '', example: '', exampleVi: '', rank };
}

const CHUNKS = Array.from({ length: 30 }, (_, i) => chunk(`c${i + 1}`, i + 1));

function card(id: string, patch: Partial<CardState>): CardState {
  return { ...newCard(id, NOW), ...patch };
}

function storeWith(cards: CardState[], patch: Partial<DrillStore['daily']> = {}, newPerDay: 5 | 10 | 20 = 10): DrillStore {
  const s = emptyDrillStore(NOW);
  return {
    ...s,
    newPerDay,
    cards: Object.fromEntries(cards.map((c) => [c.id, c])),
    daily: { ...s.daily, ...patch },
  };
}

describe('computeDrillSummary', () => {
  it('is empty-safe', () => {
    expect(computeDrillSummary([], emptyDrillStore(NOW), NOW)).toEqual({ due: 0, newAvailable: 0, learned: 0, newIntroduced: 0 });
    expect(computeDrillSummary(CHUNKS, emptyDrillStore(NOW), NOW)).toEqual({ due: 0, newAvailable: 10, learned: 0, newIntroduced: 0 });
  });

  it('counts due reviews, learned cards (reps > 0) and remaining new cards', () => {
    const store = storeWith(
      [
        card('c1', { due: NOW - DAY, reps: 3, interval: 4 }), // due, learned
        card('c2', { due: NOW + DAY, reps: 1, interval: 1 }), // learned, not due
        card('c3', { due: NOW - 1000, reps: 0, interval: 0 }), // relearning, due, not learned
        card('ghost', { due: NOW - DAY, reps: 5 }), // chunk no longer exists
      ],
      { newIntroduced: 4 },
    );
    expect(computeDrillSummary(CHUNKS, store, NOW)).toEqual({ due: 2, newAvailable: 6, learned: 2, newIntroduced: 4 });
  });

  it('includes extra new cards unlocked today and never goes negative', () => {
    expect(computeDrillSummary(CHUNKS, storeWith([], { newIntroduced: 12, extraNew: 5 }), NOW).newAvailable).toBe(3);
    expect(computeDrillSummary(CHUNKS, storeWith([], { newIntroduced: 30 }, 5), NOW).newAvailable).toBe(0);
  });

  it('newAvailable is capped by the cards never studied', () => {
    const few = CHUNKS.slice(0, 3);
    const store = storeWith([card('c1', { reps: 1, due: NOW + DAY, interval: 1 })], {}, 20);
    expect(computeDrillSummary(few, store, NOW).newAvailable).toBe(2);
  });

  it('drillSummary works without localStorage', () => {
    const s = drillSummary(NOW);
    expect(s.due).toBe(0);
    expect(s.learned).toBe(0);
    expect(s.newAvailable).toBeGreaterThan(0);
    expect(s.newIntroduced).toBe(0);
    expect(drillSummary(NOW, true).newAvailable).toBe(0);
  });

  it('matches the counts the drill page derives from its own queue', () => {
    const states = [
      card('c1', { due: NOW - 2 * DAY, reps: 3, interval: 5 }),
      card('c2', { due: NOW + 5 * MINUTE, reps: 0, interval: 0 }),
      card('c3', { due: NOW - MINUTE, reps: 0, interval: 0, lapses: 1 }),
      card('c4', { due: NOW + 3 * DAY, reps: 2, interval: 3 }),
    ];
    for (const [introduced, extra, npd] of [
      [0, 0, 10],
      [7, 0, 10],
      [12, 5, 10],
      [3, 0, 5],
      [40, 0, 20],
    ] as const) {
      const store = storeWith(states, { newIntroduced: introduced, extraNew: extra }, npd);
      const queue = buildQueue(CHUNKS, store.cards, NOW, {
        newPerDay: store.newPerDay + store.daily.extraNew,
        newIntroducedToday: store.daily.newIntroduced,
        learnAheadMs: 20 * MINUTE,
      });
      const s = computeDrillSummary(CHUNKS, store, NOW);
      expect(s.newAvailable).toBe(queue.filter((c) => !store.cards[c.id]).length);
      expect(s.due).toBe(countDue(CHUNKS, store.cards, NOW));
      // Held back by Ôn tập: the page passes newCardQuota(store, true) to buildQueue.
      const held = buildQueue(CHUNKS, store.cards, NOW, {
        newPerDay: newCardQuota(store, true),
        newIntroducedToday: store.daily.newIntroduced,
        learnAheadMs: 20 * MINUTE,
      });
      const heldNew = held.filter((c) => !store.cards[c.id]).length;
      expect(computeDrillSummary(CHUNKS, store, NOW, true).newAvailable).toBe(heldNew);
    }
  });
});

describe('new-card quota while Ôn tập holds items back', () => {
  it('reports newIntroduced', () => {
    expect(computeDrillSummary(CHUNKS, storeWith([], { newIntroduced: 3 }), NOW).newIntroduced).toBe(3);
  });

  it('drops the daily quota to 0 but keeps the explicit extra cards', () => {
    expect(newCardQuota(storeWith([], {}, 10))).toBe(10);
    expect(newCardQuota(storeWith([], {}, 10), true)).toBe(0);
    expect(newCardQuota(storeWith([], { extraNew: 5 }, 10), true)).toBe(5);
    expect(computeDrillSummary(CHUNKS, storeWith([], {}, 10), NOW, true).newAvailable).toBe(0);
    expect(computeDrillSummary(CHUNKS, storeWith([], { extraNew: 5 }, 10), NOW, true).newAvailable).toBe(5);
  });

  it('"Học thêm" always makes EXTRA_NEW more cards fit', () => {
    for (const held of [false, true]) {
      for (const [introduced, extra, npd] of [
        [0, 0, 10],
        [10, 0, 10],
        [12, 5, 10],
        [3, 0, 5],
        [7, 5, 20],
      ] as const) {
        const store = storeWith([], { newIntroduced: introduced, extraNew: extra }, npd);
        const extraNew = extraAfterLearnMore(store, held);
        const after = { ...store, daily: { ...store.daily, extraNew } };
        expect(computeDrillSummary(CHUNKS, after, NOW, held).newAvailable).toBeGreaterThanOrEqual(EXTRA_NEW);
      }
    }
  });
});
