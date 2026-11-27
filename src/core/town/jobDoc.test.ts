import { describe, expect, it } from 'vitest';
import { crewTri, evalCond, gradeHits, saidNow, wellFormed, type CondState, type JobDoc, type WorldCheck } from './jobDoc';

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

describe('the crew and the clues', () => {
  it('read who came along and the clues held', () => {
    const s = { ...state({}), crew: 'jun', clue: (id: string) => id === 'fay-heights' };
    expect(evalCond({ crew: 'jun' }, s)).toBe(true);
    expect(evalCond({ crew: 'phone' }, s)).toBe(false);
    expect(evalCond({ crew: 'jun' }, state({}))).toBe(false);
    expect(evalCond({ clue: 'fay-heights' }, s)).toBe(true);
    expect(evalCond({ clue: 'gate-one-call' }, s)).toBe(false);
    expect(crewTri({ crew: 'jun' }, 'jun')).toBe(1);
    expect(crewTri({ crew: 'jun' }, null)).toBe(0);
    expect(crewTri({ all: [{ crew: 'jun' }, { flag: 'x' }] }, 'jun')).toBe(2);
    expect(crewTri({ all: [{ crew: 'jun' }, { flag: 'x' }] }, null)).toBe(0);
    expect(crewTri({ not: { any: [{ crew: 'jun' }, { crew: 'phone' }] } }, null)).toBe(1);
  });

  it('checks each crew choice on its own: a fact played out only without the crew is a problem with them', () => {
    const pk = GOOD.steps[1] as Extract<JobDoc['steps'][number], { kind: 'pickup' }>;
    const doc: JobDoc = {
      ...GOOD,
      crew: { roles: [{ who: 'kemp', role: 'R', listen: 'L', opens: { hearts: 2 }, cut: 0.2 }] },
      steps: [GOOD.steps[0], { ...pk, greet: [{ line: 'l3', if: { all: [{ note: 'name', is: 'wrong' }, { not: { crew: 'kemp' } }] } }] }],
    };
    const p = wellFormed(doc, WORLD);
    expect(p).toContain('with kemp: a wrong name never plays out');
    expect(p.some((x) => x.startsWith('alone:'))).toBe(false);
    const bad: JobDoc = { ...GOOD, crew: { roles: [{ who: 'nobody', role: ' ', listen: 'L', opens: { heard: [] }, cut: 0.9, with: { at: 'mars' } }] }, steps: [...GOOD.steps, { kind: 'scene', lines: ['l1'], if: { crew: 'ghost' } }] };
    const q = wellFormed(bad, WORLD);
    for (const m of ['crew not a person: nobody', 'crew without words: nobody', 'crew cut out of range: nobody', 'no place mars', 'crew opens nothing: nobody', 'crew condition without a role: ghost']) expect(q).toContain(m);
  });

  it('checks the places cars are parked at', () => {
    const doc: JobDoc = { ...GOOD, steps: [...GOOD.steps, { kind: 'scene', lines: ['l1'], park: [{ at: 'nowhere' }] }] };
    expect(wellFormed(doc, WORLD)).toContain('no place nowhere');
  });
});

describe("Act II's engine pieces", () => {
  it('counts conditions, and reads a bare job id as done', () => {
    const s = { ...state({}, ['a', 'b']), past: (ref: string) => ref === 'job-link' };
    expect(evalCond({ count: [{ flag: 'a' }, { flag: 'b' }, { flag: 'c' }], min: 2 }, s)).toBe(true);
    expect(evalCond({ count: [{ flag: 'a' }, { flag: 'b' }, { flag: 'c' }], min: 3 }, s)).toBe(false);
    expect(evalCond({ count: [{ flag: 'a' }, { flag: 'b' }], max: 1 }, s)).toBe(false);
    expect(evalCond({ count: [{ past: 'job-link' }, { past: 'job-night' }], min: 1, max: 1 }, s)).toBe(true);
    expect(crewTri({ count: [{ crew: 'jun' }, { flag: 'x' }], min: 1 }, 'jun')).toBe(1);
    expect(crewTri({ count: [{ crew: 'jun' }, { crew: 'mei' }], min: 2 }, 'jun')).toBe(0);
  });

  it('checks the new steps: a patrol, threads, a pick, a spot, into the warehouse and out', () => {
    const W = { ...WORLD, speaker: (w: string) => WORLD.speaker(w) || w === 'scanner-desk', place: (p: string) => ['gus', 'kiosk', 'jetty', 'w15-water'].includes(p), street: (n: string) => n === 'Quay Street' };
    const doc: JobDoc = {
      ...GOOD,
      lines: [...GOOD.lines, L('s1', 'scanner-desk')],
      consequences: { ...GOOD.consequences, seen: { name: 'S', rejoin: 'r' }, miss: { name: 'M', rejoin: 'r' }, tape: { name: 'T', rejoin: 'r' }, e: { name: 'E', rejoin: 'r' }, l: { name: 'L', rejoin: 'r' }, n: { name: 'N', rejoin: 'r' } },
      steps: [
        ...GOOD.steps,
        { kind: 'patrol', street: 'Quay Street', seconds: 10, lines: [{ line: 's1' }], seen: { consequence: 'seen' } },
        { kind: 'enter', door: 'water' },
        { kind: 'threads', tracks: [{ id: 'a', label: 'A', lines: ['l1'], key: ['l1'], consequence: 'miss' }, { id: 'b', label: 'B', lines: ['l3'] }] },
        { kind: 'pick', clips: ['l1', 'l3'], right: 1, consequence: 'tape', fact: 'tape' },
        { kind: 'spot', lines: ['l1', 'l3'], at: 'l3', early: 'e', late: 'l', never: 'n', fact: 'spot' },
        { kind: 'leave' },
        { kind: 'boat', from: 'jetty', to: 'w15-water', aboard: true },
      ],
    };
    expect(wellFormed(doc, W)).toEqual([]);
    const bad: JobDoc = {
      ...doc,
      lines: [...doc.lines, L('s2')],
      steps: [
        ...GOOD.steps,
        { kind: 'patrol', street: 'Nowhere Lane', seconds: 0, lines: [{ line: 's2' }], seen: { consequence: 'seen' } },
        { kind: 'leave' },
        { kind: 'enter' },
        { kind: 'threads', tracks: [{ id: 'a', label: 'A', lines: ['l1'], key: ['l3'] }] },
        { kind: 'pick', clips: ['l1'], right: 3, consequence: 'tape', fact: 'tape' },
        { kind: 'spot', lines: ['l1'], at: 'l3', early: 'e', late: 'l', never: 'n', fact: 'spot' },
        { kind: 'boat', to: 'mars' },
        { kind: 'scene', lines: ['l1'], if: { count: [{ flag: 'x' }], min: 1 } },
      ],
    };
    const p = wellFormed(bad, W);
    for (const m of ['patrol without a length: Nowhere Lane', 'no street Nowhere Lane', 'patrol line not on the scanner: s2', 'leave while outside', 'enter without a leave', 'threads with fewer than two tracks', 'thread a: key line not on it: l3', 'thread a: key lines without a consequence', 'pick out of range: tape', 'spot line not said in it: l3', 'no place mars']) expect(p).toContain(m);
  });
});

describe("Act III's engine pieces", () => {
  it('reads the heat and an earlier grade', () => {
    const s = { ...state({}), heat: 6, grade: (id: string) => (id === 'job-warehouse' ? ('messy' as const) : null) };
    expect(evalCond({ heat: { min: 6 } }, s)).toBe(true);
    expect(evalCond({ heat: { max: 5 } }, s)).toBe(false);
    expect(evalCond({ heat: { min: 2, max: 7 } }, s)).toBe(true);
    expect(evalCond({ heat: { min: 1 } }, state({}))).toBe(false);
    expect(evalCond({ grade: 'job-warehouse', min: 'messy' }, s)).toBe(true);
    expect(evalCond({ grade: 'job-warehouse', min: 'clean' }, s)).toBe(false);
    expect(evalCond({ grade: 'job-warehouse', min: 'broken' }, s)).toBe(true);
    expect(evalCond({ grade: 'job-live', min: 'broken' }, s)).toBe(false);
    expect(crewTri({ heat: { min: 6 } }, null)).toBe(2);
  });

  it('checks a flag step, why a clip is wrong, who really says a line, the new conditions', () => {
    const good: JobDoc = {
      ...GOOD,
      lines: [...GOOD.lines, { ...L('w1'), as: 'kemp' }, { ...L('w2'), as: 'splice' }],
      consequences: { ...GOOD.consequences, clip: { name: 'C', rejoin: 'r' } },
      steps: [
        ...GOOD.steps,
        { kind: 'pick', clips: ['l1', 'l3', 'w2'], right: 1, consequence: 'clip', fact: 'clip', why: { l1: 'w1' } },
        { kind: 'flag', set: 'end-best', if: { all: [{ heat: { max: 5 } }, { grade: 'job-m2', min: 'clean' }] } },
      ],
    };
    expect(wellFormed(good, WORLD)).toEqual([]);
    const bad: JobDoc = {
      ...good,
      lines: [...good.lines.filter((l) => l.id !== 'w1'), { ...L('w1'), as: 'nobody' }],
      steps: [
        ...GOOD.steps,
        { kind: 'pick', clips: ['l1', 'l3', 'w2'], right: 1, consequence: 'clip', fact: 'clip', why: { l3: 'w1', zz: 'w1' } },
        { kind: 'flag', set: 'End Best' },
        { kind: 'scene', lines: ['l1'], if: { any: [{ heat: { min: 8, max: 3 } }, { grade: 'warehouse', min: 'clean' }] } },
      ],
    };
    const p = wellFormed(bad, WORLD);
    for (const m of ['as not a speaker: nobody (w1)', 'pick why for no wrong clip: l3', 'pick why for no wrong clip: zz', 'flag not a name: End Best', 'heat condition out of range', 'grade condition of no job: warehouse']) expect(p).toContain(m);
  });
});
