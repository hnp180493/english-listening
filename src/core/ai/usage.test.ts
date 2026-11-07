import { afterEach, describe, expect, it, vi } from 'vitest';
import { stubStorage } from './aiTestUtils';

async function fresh() {
  vi.resetModules();
  return import('./usage');
}

describe('usage counters', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('accumulates per day and provider, sums totals', async () => {
    const { map } = stubStorage();
    const u = await fresh();
    const day1 = new Date(2026, 10, 6, 10).getTime();
    u.recordAiUsage('p1', { requests: 1, inputTokens: 100, outputTokens: 50 }, day1);
    u.recordAiUsage('p1', { requests: 1, inputTokens: 10, outputTokens: 5 }, day1);
    u.recordAiUsage('p2', { requests: 1, ttsChars: 42 }, day1);
    u.recordAiUsage('p2', { errors: 1, cacheHits: 2 }, day1);
    const r = u.getAiUsage(day1);
    expect(r.day).toBe('2026-11-06');
    expect(r.byProvider.p1).toMatchObject({ requests: 2, inputTokens: 110, outputTokens: 55 });
    expect(r.total).toEqual({ requests: 3, errors: 1, inputTokens: 110, outputTokens: 55, ttsChars: 42, cacheHits: 2 });
    expect([...map.keys()]).toEqual(['nghe-noi-am-device:ai-usage']);
    // next day starts at zero
    expect(u.getAiUsage(day1 + 86400000).total.requests).toBe(0);
  });

  it('enforces the soft cap and prunes old days', async () => {
    stubStorage();
    const u = await fresh();
    const now = new Date(2026, 10, 6, 10).getTime();
    expect(u.isOverDailyCap(2, now)).toBe(false);
    u.recordAiUsage('p', { requests: 2 }, now);
    expect(u.isOverDailyCap(2, now)).toBe(true);
    expect(u.isOverDailyCap(undefined, now)).toBe(false);
    for (let i = 1; i <= 40; i++) u.recordAiUsage('p', { requests: 1 }, now - i * 86400000);
    expect(Object.keys(u.loadAiUsage().days)).toHaveLength(30);
  });

  it('sanitizes garbage', async () => {
    stubStorage();
    const u = await fresh();
    expect(u.sanitizeUsage({ days: { bad: {}, '2026-01-01': { p: { requests: -3, inputTokens: 'x', ttsChars: 5.7 } } } })).toEqual({
      v: 1,
      days: { '2026-01-01': { p: { requests: 0, errors: 0, inputTokens: 0, outputTokens: 0, ttsChars: 5, cacheHits: 0 } } },
    });
  });
});
