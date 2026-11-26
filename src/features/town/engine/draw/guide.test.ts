import { describe, expect, it } from 'vitest';
import { metres } from './guide';

describe('how far the quest followed is', () => {
  it('says how far in metres, rounded to five past ten', () => {
    expect(metres(2)).toBe('4 m');
    expect(metres(17)).toBe('35 m');
    expect(metres(0.1)).toBe('1 m');
  });
});
