import { describe, expect, it } from 'vitest';
import { sanitizeChunks } from './chunkData';

describe('sanitizeChunks', () => {
  it('handles empty / missing data', () => {
    expect(sanitizeChunks(undefined)).toEqual([]);
    expect(sanitizeChunks(null)).toEqual([]);
    expect(sanitizeChunks([])).toEqual([]);
  });

  it('drops invalid rows and duplicate ids, filters unknown phenomena, fills missing fields', () => {
    const out = sanitizeChunks([
      null,
      'x',
      { id: 'c1', written: 'want to', spoken: 'wanna', phenomena: ['reduction', 'bogus', 'reduction'], rank: 1 },
      { id: 'c1', written: 'dup', spoken: 'dup' },
      { id: 'c2', written: '' },
      { id: 'c3', written: 'kind of' },
    ]);
    expect(out.map((c) => c.id)).toEqual(['c1', 'c3']);
    expect(out[0]).toMatchObject({ spoken: 'wanna', ttsText: 'wanna', phenomena: ['reduction'], example: '', meaning: '' });
    expect(out[1]).toMatchObject({ spoken: 'kind of', ttsText: 'kind of', phenomena: [] });
    expect(Number.isFinite(out[1].rank)).toBe(true);
    expect(out[1].rank).toBeGreaterThan(out[0].rank);
  });
});
