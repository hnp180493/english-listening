import { describe, expect, it } from 'vitest';
import { HEAT_MAX, heatAfter, heatLevel } from './heat';

describe('the heat', () => {
  it('rises with the consequences hit, a fatal one counting double, and falls by two after a clean job', () => {
    expect(heatAfter(0, 'messy', 2, false)).toBe(2);
    expect(heatAfter(2, 'broken', 3, true)).toBe(6);
    expect(heatAfter(6, 'clean', 0, false)).toBe(4);
  });

  it('stays between zero and its top', () => {
    expect(heatAfter(1, 'clean', 0, false)).toBe(0);
    expect(heatAfter(HEAT_MAX - 1, 'broken', 5, true)).toBe(HEAT_MAX);
  });

  it('reads nothing at zero', () => {
    expect(heatLevel(0)).toBe('none');
    expect(heatLevel(1)).toBe('low');
    expect(heatLevel(5)).toBe('mid');
    expect(heatLevel(9)).toBe('high');
  });
});
