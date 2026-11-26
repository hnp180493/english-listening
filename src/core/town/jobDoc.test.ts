import { describe, expect, it } from 'vitest';
import { evalCond, gradeHits, saidNow, wellFormed, type CondState, type JobDoc, type WorldCheck } from './jobDoc';

const state = (picks: Record<string, { right: boolean; early?: boolean; late?: boolean; value?: string }>, flags: string[] = [], hits: string[] = []): CondState => ({
  note: (k) => ({ value: picks[k]?.value, right: picks[k]?.right ?? false, early: !!picks[k]?.early, late: !!picks[k]?.late }),
  flags: new Set(flags),
  hits: new Set(hits),
});

describe('conditions', () => {
  it('read the notes, the flags and the consequences hit, and combine', () => {
    const s = state({ name: { right: false, value: 'ken' }, time: { right: false, early: true } }, ['asked'], ['gone']);
    expect(evalCond({ note: 'name', is: 'wrong' }, s)).toBe(true);
    expect(evalCond({ note: 'name', value: 'ken' }, s)).toBe(true);
    expect(evalCond({ note: 'time', is: 'early' }, s)).toBe(true);
    expect(evalCond({ note: 'time', is: 'late' }, s)).toBe(false);
    expect(evalCond({ flag: 'asked' }, s)).toBe(true);
    expect(evalCond({ hit: 'gone' }, s)).toBe(true);
    expect(evalCond({ not: { hit: 'gone' } }, s)).toBe(false);
    expect(evalCond({ all: [{ flag: 'asked' }, { note: 'name', is: 'right' }] }, s)).toBe(false);
    expect(evalCond({ any: [{ flag: 'nope' }, { note: 'name', is: 'wrong' }] }, s)).toBe(true);
    expect(evalCond(undefined, s)).toBe(true);
    expect(saidNow(['a', { line: 'b', if: { flag: 'asked' } }, { line: 'c', if: { flag: 'nope' } }], s)).toEqual(['a', 'b']);
  });

  it('read what an earlier job left (past), false without a reader', () => {
    const s = { ...state({}), past: (ref: string) => ref === 'job-m2:hit:late' };
    expect(evalCond({ past: 'job-m2:hit:late' }, s)).toBe(true);
    expect(evalCond({ past: 'job-m2:kemp-asks-again' }, s)).toBe(false);
    expect(evalCond({ past: 'job-m2:hit:late' }, state({}))).toBe(false);
  });
});

const DOC = { consequences: { a: { name: 'A', rejoin: 'x' }, b: { name: 'B', rejoin: 'x' }, c: { name: 'C', rejoin: 'x' }, f: { name: 'F', rejoin: 'x', fatal: true } } };

describe('the grade', () => {
  it('counts the consequences hit: none Sạch, one or two Lộn xộn, three or a fatal one Hỏng', () => {
    expect(gradeHits(new Set(), DOC)).toBe('clean');
    expect(gradeHits(new Set(['a']), DOC)).toBe('messy');
    expect(gradeHits(new Set(['a', 'b']), DOC)).toBe('messy');
    expect(gradeHits(new Set(['a', 'b', 'c']), DOC)).toBe('broken');
    expect(gradeHits(new Set(['f']), DOC)).toBe('broken');
    // a flag that is not a consequence is not counted
    expect(gradeHits(new Set(['late-flag']), DOC)).toBe('clean');
  });
});

const WORLD: WorldCheck = { speaker: (w) => ['rico', 'kemp', 'player'].includes(w), place: (p) => ['gus', 'kiosk'].includes(p), road: (x, y) => y === 1 && x >= 0 && x < 20 };

const L = (id: string, who = 'rico') => ({ id, who, text: 'Hello there, friend.', vi: 'Chào.' });
const GOOD: JobDoc = {
  id: 'job-t',
  title: 'T',
  blurb: 'b',
  level: 1,
  order: 1,
  opens: [],
  from: 'rico',
  lines: [L('l1'), L('l2', 'kemp'), L('l3'), L('e1'), L('n1')],
  facts: [{ id: 'name', label: 'Tên', line: 'l2', consequence: 'name' }],
  consequences: { name: { name: 'Sai tên', rejoin: 'Vẫn đi tiếp' }, wrongPlace: { name: 'Sai chỗ', rejoin: 'Rico gọi' }, wrongPerson: { name: 'Sai người', rejoin: 'Vẫn đón' } },
  steps: [
    { kind: 'notebook', call: ['l1', 'l2'], entries: [{ key: 'name', label: 'Tên', line: 'l2', answer: 'kemp', options: [{ value: 'kemp', label: 'Kemp' }, { value: 'ken', label: 'Ken' }, { value: 'kent', label: 'Kent' }] }] },
    { kind: 'pickup', entry: 'x', places: {}, place: 'kiosk', wrongPlace: { lines: [], consequence: 'wrongPlace' }, crowd: [], passenger: 'kemp', notMe: {}, wrongPerson: 'wrongPerson', greet: [{ line: 'l3', if: { note: 'name', is: 'wrong' } }] },
  ],
  ending: { clean: ['e1'], messy: ['e1'], broken: ['e1'] },
  news: { clean: ['n1'], messy: ['n1'], broken: ['n1'] },
};

describe('a job document, well formed', () => {
  it('passes when every fact has its consequence and its rejoin, and a wrong note plays out', () => {
    expect(wellFormed(GOOD, WORLD)).toEqual([]);
  });

  it('finds what is missing', () => {
    const bad: JobDoc = {
      ...GOOD,
      lines: [...GOOD.lines, L('l9', 'stranger')],
      consequences: { ...GOOD.consequences, name: { name: 'Sai tên', rejoin: '' }, unused: { name: 'U', rejoin: 'r' } },
      steps: [GOOD.steps[0], { ...(GOOD.steps[1] as Extract<JobDoc['steps'][number], { kind: 'pickup' }>), place: 'nowhere', greet: ['l3'] }],
    };
    const p = wellFormed(bad, WORLD);
    expect(p).toContain('line never said: job-t-l9'.replace('job-t-', ''));
    expect(p).toContain('speaker not allowed: stranger (l9)');
    expect(p).toContain('consequence without a rejoin: name');
    expect(p).toContain('consequence never used: unused');
    expect(p).toContain('a wrong name never plays out');
    expect(p).toContain('no place nowhere');
  });

  it('checks a junction is on the road and has its right way, a line for every wrong way', () => {
    const doc: JobDoc = {
      ...GOOD,
      consequences: { ...GOOD.consequences, lost: { name: 'Lạc', rejoin: 'Quay lại' } },
      steps: [
        ...GOOD.steps,
        { kind: 'ride', place: 'gus', lost: 'lost', arrive: {}, junctions: [{ id: 'j', name: 'J', at: { x: 3, y: 5 }, line: 'l1', right: 'left', ways: { left: { to: { x: 9, y: 1 } }, right: { to: { x: 2, y: 1 } } } }] },
      ],
    };
    const p = wellFormed(doc, WORLD);
    expect(p).toContain('junction off the road: j');
    expect(p).toContain('j right: a wrong way needs a line, the right one none');
  });

  it("counts a goto deadline's consequence as used, checks intent answers and overhearing, keys unique across notebooks", () => {
    const nb = GOOD.steps[0] as Extract<JobDoc['steps'][number], { kind: 'notebook' }>;
    const doc: JobDoc = {
      ...GOOD,
      consequences: { ...GOOD.consequences, late: { name: 'Muộn', rejoin: 'Vẫn tới' }, rude: { name: 'Hỗn', rejoin: 'Bỏ qua' } },
      steps: [
        ...GOOD.steps,
        nb,
        { kind: 'goto', place: 'gus', label: 'Tới', deadline: { seconds: 60, consequence: 'late', lines: ['l1'] } },
        { kind: 'intent', who: 'rico', ask: ['l1'], options: [{ label: 'A', say: 'l1', reply: [] }, { label: 'B', say: 'l3', reply: [] }], check: { right: [0, 2], consequence: 'rude', fact: 'x' } },
        { kind: 'overhear', at: 'gus', who: [], lines: ['l1'], passes: 1 },
      ],
    };
    const p = wellFormed(doc, WORLD);
    expect(p).not.toContain('consequence never used: late');
    expect(p).toContain('intent check out of range: rico');
    expect(p).toContain('overhear without anybody');
    expect(p).toContain('notebook keys repeat across notebooks');
    const fixed: JobDoc = { ...doc, steps: doc.steps.filter((s, i) => s !== nb || i === 0).map((s) => (s.kind === 'intent' ? { ...s, check: { ...s.check!, right: [0, 1] } } : s.kind === 'overhear' ? { ...s, who: ['kemp'] } : s)) };
    expect(wellFormed(fixed, WORLD)).toEqual([]);
  });
});
