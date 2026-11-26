import { describe, expect, it } from 'vitest';
import { GAME_DAY_MS } from './sky';
import {
  APPOINT_AHEAD,
  appointment,
  arrivedLate,
  chooseTurn,
  CLARITY_VOLUME,
  clockOf,
  fillLine,
  GAME_MINUTE_MS,
  jobPay,
  lineRef,
  minutesPast,
  noteAnswer,
  noteOptions,
  notesWrong,
  overhearClarity,
  parseLineRef,
  realTimeOf,
  templatedRefs,
  timeSide,
  timeOptions,
  timeWords,
  waysOf,
  type Junction,
  type NoteEntry,
} from './job';

/** A real time at which the game's clock shows `minute` (of day 0). */
const at = (minute: number) => minute * GAME_MINUTE_MS + 5 * GAME_DAY_MS;

describe('the appointment', () => {
  it('is a quarter past or to, at least APPOINT_AHEAD minutes ahead, within the next hour after that', () => {
    for (let m = 0; m < 1440; m += 7) {
      const a = appointment(at(m));
      expect([15, 45]).toContain(a % 60);
      const ahead = (a - m + 1440) % 1440;
      expect(ahead).toBeGreaterThanOrEqual(APPOINT_AHEAD);
      expect(ahead).toBeLessThan(APPOINT_AHEAD + 31);
    }
  });

  it('is said the everyday way', () => {
    expect(timeWords(18 * 60 + 45)).toBe('quarter to seven');
    expect(timeWords(19 * 60 + 15)).toBe('quarter past seven');
    expect(timeWords(23 * 60 + 45)).toBe('quarter to twelve');
    expect(timeWords(12 * 60)).toBe("twelve o'clock");
    expect(timeWords(6 * 60 + 30)).toBe('half past six');
    expect(clockOf(18 * 60 + 45)).toBe('18:45');
    expect(clockOf(-15)).toBe('23:45');
  });

  it('offers the right time, "past" for "to", and the hour heard without its side', () => {
    expect(timeOptions(18 * 60 + 45).map(clockOf)).toEqual(['18:45', '19:15', '19:45']);
    expect(timeOptions(19 * 60 + 15).map(clockOf)).toEqual(['19:15', '18:45', '19:45']);
    expect(timeOptions(23 * 60 + 45).map(clockOf)).toEqual(['23:45', '00:15', '00:45']);
    for (const m of [15, 45, 615, 1425]) expect(new Set(timeOptions(m)).size).toBe(3);
  });

  it('other clocks: "half five" (5:30) and "ten past / to"', () => {
    for (const style of ['half', 'ten'] as const)
      for (let m = 0; m < 1440; m += 7) {
        const a = appointment(at(m), style);
        expect(style === 'half' ? [30] : [10, 50]).toContain(a % 60);
        expect((a - m + 1440) % 1440).toBeGreaterThanOrEqual(APPOINT_AHEAD);
        expect(new Set(timeOptions(a, style)).size).toBe(3);
      }
    expect(timeWords(17 * 60 + 30, 'half')).toBe('half five');
    expect(timeWords(17 * 60 + 30)).toBe('half past five');
    expect(timeWords(18 * 60 + 10, 'ten')).toBe('ten past six');
    expect(timeWords(17 * 60 + 50, 'ten')).toBe('ten to six');
    expect(timeOptions(17 * 60 + 30, 'half').map(clockOf)).toEqual(['17:30', '16:30', '17:00']);
    expect(timeOptions(18 * 60 + 10, 'ten').map(clockOf)).toEqual(['18:10', '17:50', '19:10']);
    expect(timeOptions(17 * 60 + 50, 'ten').map(clockOf)).toEqual(['17:50', '18:10', '18:50']);
    expect(fillLine({ id: 'x', who: 'jun', text: 'Till {time} today.', vi: 'v' }, 17 * 60 + 30, 'half').text).toBe('Till half five today.');
    const refs = templatedRefs({ id: 'x', text: 'Till {time}.' }, 'ten');
    expect(refs).toHaveLength(48);
    expect(refs.every((r) => /-t\d\d[15]0$/.test(r))).toBe(true);
  });

  it('a harder speech level offers a fourth look-alike time: the same words an hour (or half an hour) off', () => {
    for (const style of ['quarter', 'half', 'ten'] as const)
      for (const m of [18 * 60 + 45, 19 * 60 + 15, 17 * 60 + 30, 18 * 60 + 10, 17 * 60 + 50]) {
        const four = timeOptions(m, style, 4);
        expect(four.slice(0, 3)).toEqual(timeOptions(m, style));
        expect(new Set(four).size).toBe(4);
      }
    expect(timeOptions(17 * 60 + 30, 'half', 4).map(clockOf)).toEqual(['17:30', '16:30', '17:00', '18:30']);
  });

  it('knows how late the learner is, and the real time a minute of the game comes round', () => {
    expect(minutesPast(600, at(610))).toBeCloseTo(10);
    expect(minutesPast(600, at(590))).toBeCloseTo(-10);
    expect(minutesPast(5, at(1435))).toBeCloseTo(-10);
    expect(arrivedLate(600, at(603))).toBe(false);
    expect(arrivedLate(600, at(620))).toBe(true);
    expect(realTimeOf(700, at(600))).toBeCloseTo(at(700));
  });
});

const ENTRIES: NoteEntry[] = [
  { key: 'pickup', label: 'Đón ở đâu', line: 'c03', answer: 'loom', options: [{ value: 'loom', label: 'Loom' }, { value: 'lumen', label: 'Lumen' }, { value: 'ferry', label: 'Phà' }] },
  { key: 'time', label: 'Mấy giờ', line: 'c04', answer: '', options: [] },
];

describe('the notebook', () => {
  it('offers each entry three ways, the right one among them, in an order by seed', () => {
    for (let seed = 0; seed < 6; seed++) {
      const o = noteOptions(ENTRIES[0], 0, seed);
      expect(o).toHaveLength(3);
      expect(o.map((x) => x.value)).toContain('loom');
    }
    expect(noteOptions(ENTRIES[0], 0, 0)[0].value).not.toBe(noteOptions(ENTRIES[0], 0, 1)[0].value);
    const t = noteOptions(ENTRIES[1], 1125, 2);
    expect(t.map((x) => x.label).sort()).toEqual(['18:45', '19:15', '19:45']);
    expect(noteAnswer(ENTRIES[1], 1125)).toBe('1125');
  });

  it('says which entries were written wrong, without telling the learner then', () => {
    expect(notesWrong(ENTRIES, { pickup: 'loom', time: '1125' }, 1125)).toEqual([]);
    expect(notesWrong(ENTRIES, { pickup: 'lumen', time: '1155' }, 1125)).toEqual(['pickup', 'time']);
    expect(notesWrong(ENTRIES, {}, 1125)).toEqual(['pickup', 'time']);
  });

  it('fills the appointment into a line: words in English, digits in Vietnamese', () => {
    const l = fillLine({ text: 'Be there at {time}.', vi: 'Có mặt lúc {time}.' }, 1125);
    expect(l).toEqual({ text: 'Be there at quarter to seven.', vi: 'Có mặt lúc 18:45.' });
  });
});

const J: Junction = {
  id: 'a-b',
  name: 'A × B',
  at: { x: 10, y: 10 },
  line: 'd1',
  right: 'left',
  ways: { left: { to: { x: 10, y: 16 } }, right: { to: { x: 10, y: 4 }, line: 'd1-right' } },
};

describe('the junctions', () => {
  it('offers only the ways that leave the junction, left to right, and judges the one picked', () => {
    expect(waysOf(J)).toEqual(['left', 'right']);
    expect(chooseTurn(J, 'left')).toBe('right');
    expect(chooseTurn(J, 'right')).toBe('wrong');
    expect(chooseTurn(J, 'straight')).toBe('none');
  });
});

describe('overhearing', () => {
  it('is heard clearly near, faintly further, not at all far off; rain takes it down a step', () => {
    expect(overhearClarity(1, 0)).toBe('clear');
    expect(overhearClarity(3.5, 0)).toBe('clear');
    expect(overhearClarity(5, 0)).toBe('faint');
    expect(overhearClarity(8, 0)).toBe('none');
    expect(overhearClarity(1, 0.8)).toBe('faint');
    expect(overhearClarity(5, 0.8)).toBe('none');
    expect(overhearClarity(5, 0.3)).toBe('faint');
    expect(CLARITY_VOLUME.clear).toBe(1);
    expect(CLARITY_VOLUME.faint).toBeGreaterThan(0);
    expect(CLARITY_VOLUME.faint).toBeLessThan(1);
    expect(CLARITY_VOLUME.none).toBe(0);
  });
});

describe('the outcome', () => {
  it('pays by grade, the first run of a day only', () => {
    expect(jobPay('clean', false)).toBeGreaterThan(jobPay('messy', false));
    expect(jobPay('messy', false)).toBeGreaterThan(jobPay('broken', false));
    expect(jobPay('clean', true)).toBe(0);
  });

  it('tells a time noted early from one noted late, round midnight too', () => {
    expect(timeSide(18 * 60 + 45, 18 * 60 + 45)).toBe('right');
    expect(timeSide(18 * 60 + 15, 18 * 60 + 45)).toBe('early');
    expect(timeSide(19 * 60 + 15, 18 * 60 + 45)).toBe('late');
    expect(timeSide(23 * 60 + 45, 15)).toBe('early');
    expect(timeSide(45, 23 * 60 + 45)).toBe('late');
  });
});

describe('review refs of a line said with a time', () => {
  it('carry the time and come back from it', () => {
    const line = { id: 'job-x-c04', text: 'Be there at {time}.' };
    expect(lineRef(line, 1125)).toBe('job-x-c04-t1845');
    expect(parseLineRef('job-x-c04-t1845')).toEqual({ id: 'job-x-c04', minute: 1125 });
    expect(parseLineRef('job-x-c03')).toEqual({ id: 'job-x-c03', minute: null });
    expect(lineRef({ id: 'job-x-c03', text: 'Hi.' }, 1125)).toBe('job-x-c03');
    const refs = templatedRefs(line);
    expect(refs).toHaveLength(48);
    expect(refs).toContain('job-x-c04-t0015');
    expect(refs).toContain('job-x-c04-t2345');
  });
});
