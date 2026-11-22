import { describe, expect, it, vi } from 'vitest';
import { STORAGE_PREFIX } from './storage';
import { dataHash, deviceLabelFrom, startupWindow, SYNC_APPLIED_KEY } from './syncShared';

describe('dataHash', () => {
  it('is order independent and tells values and key/value splits apart', () => {
    expect(dataHash({ a: '1', b: '2' })).toBe(dataHash({ b: '2', a: '1' }));
    expect(dataHash({ a: '1' })).not.toBe(dataHash({ a: '2' }));
    expect(dataHash({ ab: 'c' })).not.toBe(dataHash({ a: 'bc' }));
    expect(dataHash({})).toBe(dataHash({}));
  });
});

describe('deviceLabelFrom', () => {
  it('labels the device', () => {
    const edge = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0';
    expect(deviceLabelFrom(edge)).toBe('Edge · Windows');
    expect(deviceLabelFrom('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605 Version/17 Safari/605')).toBe('Safari · macOS');
    expect(deviceLabelFrom('curl/8')).toBe('Trình duyệt');
  });
});

describe('startupWindow', () => {
  it('closes exactly when the budget timer fires, before anything awaiting it runs', async () => {
    vi.useFakeTimers();
    try {
      const w = startupWindow(1500);
      expect(w.canApply()).toBe(true);
      let seen: boolean | null = null;
      void w.expired.then(() => {
        seen = w.canApply();
      });
      vi.advanceTimersByTime(1499);
      expect(w.canApply()).toBe(true);
      vi.advanceTimersByTime(1);
      expect(w.canApply()).toBe(false);
      await Promise.resolve();
      expect(seen).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('can be closed early', () => {
    const w = startupWindow(1000, () => 0);
    w.close();
    expect(w.canApply()).toBe(false);
  });
});

it('the cross-tab signal key is outside the synced data', () => {
  expect(SYNC_APPLIED_KEY.startsWith(STORAGE_PREFIX)).toBe(false);
});
