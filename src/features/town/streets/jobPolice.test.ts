// A job's scanner lines (./jobPolice.ts): said in the order of their moment, each once.
import { describe, expect, it } from 'vitest';
import { linesDue, type JobScanLine } from './jobPolice';

describe("a job's lines on the scanner", () => {
  const lines: JobScanLine[] = [
    { who: 'unit', text: 'Unit twelve. Turning into Market Street.', at: 6 },
    { who: 'dispatch', text: 'Unit twelve, a slow pass down Market Street.', vi: 'Xe 12, chạy chậm qua Market Street.' },
    { who: 'unit', text: 'Unit twelve. Nothing to report.', at: 15 },
  ];
  it('as it sets off: the lines without a moment; then each at its moment, once', () => {
    const a = linesDue(lines, 0, 0);
    expect(a.due.map((l) => l.who)).toEqual(['dispatch']);
    expect(a.due[0].vi).toBe('Xe 12, chạy chậm qua Market Street.');
    const b = linesDue(lines, a.next, 5.9);
    expect(b.due).toEqual([]);
    const c = linesDue(lines, b.next, 16);
    expect(c.due.map((l) => l.text)).toEqual(['Unit twelve. Turning into Market Street.', 'Unit twelve. Nothing to report.']);
    expect(linesDue(lines, c.next, 99).due).toEqual([]);
    expect(c.due[1].vi).toBe('');
  });
});
