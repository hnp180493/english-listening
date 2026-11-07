import { describe, expect, it } from 'vitest';
import { PAIR_SET_ITEMS } from './pairIndex';
import { PAIR_SETS } from './pairs';

describe('PAIR_SET_ITEMS', () => {
  it('equals PAIR_SETS exactly (set order, item ids and item order)', () => {
    const fromData = Object.fromEntries(PAIR_SETS.map((s) => [s.id, s.items.map((i) => i.id)]));
    expect(PAIR_SET_ITEMS).toEqual(fromData);
    expect(Object.keys(PAIR_SET_ITEMS)).toEqual(PAIR_SETS.map((s) => s.id));
  });
});
