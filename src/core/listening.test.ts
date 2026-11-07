import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  addDays,
  createListenMeter,
  daysBetween,
  formatClock,
  formatHoursVi,
  formatMinutesVi,
  isDay,
  listeningToday,
  makeEntry,
  minutesBetween,
  minutesOnDay,
  nextMilestone,
  parseListeningLog,
  pruneTombstones,
  sourceSplit,
  timerElapsedMs,
  totalMinutes,
  understoodByWeek,
  understoodLabelFor,
  validateMinutes,
  weekBuckets,
  weekStartDay,
  type ListeningEntry,
} from './listening';
import { STORAGE_PREFIX } from './storage';

const P = STORAGE_PREFIX;
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const NOW = at(2026, 11, 6, 20); // Friday

function entry(day: string, minutes: number, extra: Partial<ListeningEntry> = {}): ListeningEntry {
  return { id: `e-${day}-${minutes}-${extra.source ?? 'phim'}`, startedAt: new Date(day + 'T10:00').getTime(), day, minutes, source: 'phim', updatedAt: 1, ...extra };
}

function stubWindow(opts: { blocked?: boolean } = {}) {
  const map = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => {
        if (opts.blocked) throw new Error('SecurityError');
        return map.get(k) ?? null;
      },
      setItem: (k: string, v: string) => {
        if (opts.blocked) throw new Error('SecurityError');
        map.set(k, v);
      },
      removeItem: (k: string) => void map.delete(k),
    },
    addEventListener: () => {},
  });
  return map;
}

async function fresh() {
  vi.resetModules();
  return import('./listening');
}

describe('formatting', () => {
  it('formats minutes and hours in Vietnamese', () => {
    expect(formatMinutesVi(200)).toBe('3 giờ 20 phút');
    expect(formatMinutesVi(45)).toBe('45 phút');
    expect(formatMinutesVi(120)).toBe('2 giờ');
    expect(formatMinutesVi(0)).toBe('0 phút');
    expect(formatMinutesVi(NaN)).toBe('0 phút');
    expect(formatHoursVi(750)).toBe('12,5 giờ');
    expect(formatHoursVi(180)).toBe('3 giờ');
    expect(formatClock(754_000)).toBe('12:34');
    expect(formatClock(3_723_000)).toBe('1:02:03');
    expect(formatClock(-5)).toBe('0:00');
  });

  it('validates minutes', () => {
    expect(validateMinutes(30)).toBe(30);
    expect(validateMinutes('45')).toBe(45);
    expect(validateMinutes(0.6)).toBe(1);
    expect(validateMinutes(0.4)).toBeNull();
    expect(validateMinutes(9999)).toBe(600);
    expect(validateMinutes(-3)).toBeNull();
    expect(validateMinutes('abc')).toBeNull();
    expect(validateMinutes(NaN)).toBeNull();
  });

  it('knows real calendar days', () => {
    expect(isDay('2026-02-28')).toBe(true);
    expect(isDay('2026-02-30')).toBe(false);
    expect(isDay('2026-2-3')).toBe(false);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(weekStartDay('2026-11-08')).toBe('2026-11-02'); // Sunday → its Monday
    expect(weekStartDay('2026-11-02')).toBe('2026-11-02');
    expect(daysBetween('2026-10-30', '2026-11-06')).toBe(7);
  });
});

describe('sanitizing', () => {
  it('drops junk, keeps tombstones, and keeps the newer duplicate', () => {
    const list = parseListeningLog({
      version: 1,
      entries: [
        null,
        { id: 'a', startedAt: 1, day: '2026-11-06', minutes: 30, source: 'phim', updatedAt: 1, title: '  Friends   S01 ' },
        { id: 'a', startedAt: 1, day: '2026-11-06', minutes: 40, source: 'phim', updatedAt: 2 },
        { id: 'b', startedAt: 1, day: 'nope', minutes: 30, source: 'phim', updatedAt: 1 },
        { id: 'c', startedAt: 1, day: '2026-11-06', minutes: 30, source: 'tv', updatedAt: 1 },
        { id: 'd', updatedAt: 5, deleted: true, minutes: 'x' },
        { id: 'e', startedAt: 1, day: '2026-11-06', minutes: 30, source: 'youtube', updatedAt: 1, understood: 9, subtitles: 'fr', mediaId: 'm1' },
      ],
    });
    expect(list.map((e) => e.id).sort()).toEqual(['a', 'd', 'e']);
    expect(list.find((e) => e.id === 'a')).toMatchObject({ minutes: 40 });
    expect(list.find((e) => e.id === 'd')).toEqual({ id: 'd', updatedAt: 5, deleted: true });
    const e = list.find((x) => x.id === 'e') as ListeningEntry;
    expect(e.understood).toBeUndefined();
    expect(e.subtitles).toBeUndefined();
    expect(e.mediaId).toBeUndefined(); // only app entries carry a media id
    expect(parseListeningLog('junk')).toEqual([]);
  });

  it('prunes tombstones older than 180 days only', () => {
    const day = 86_400_000;
    const list = pruneTombstones(
      [
        { id: 'old', updatedAt: NOW - 181 * day, deleted: true },
        { id: 'new', updatedAt: NOW - 179 * day, deleted: true },
        entry('2020-01-01', 10),
      ],
      NOW,
    );
    expect(list.map((e) => e.id)).toEqual(['new', 'e-2020-01-01-10-phim']);
  });

  it('builds entries with sensible start times', () => {
    const today = makeEntry({ minutes: 30, source: 'podcast' }, NOW, 'x')!;
    expect(today).toMatchObject({ day: '2026-11-06', startedAt: NOW - 30 * 60_000, minutes: 30 });
    const y = makeEntry({ minutes: 30, source: 'podcast', day: '2026-11-05', title: 'x'.repeat(200), understood: 4, subtitles: 'en' }, NOW, 'y')!;
    expect(y.startedAt).toBe(at(2026, 11, 5, 12));
    expect(y.title).toHaveLength(120);
    expect(y).toMatchObject({ understood: 4, subtitles: 'en' });
    expect(makeEntry({ minutes: 0, source: 'phim' }, NOW)).toBeNull();
    expect(makeEntry({ minutes: 10, source: 'tv' as never }, NOW)).toBeNull();
    expect(makeEntry({ minutes: 10, source: 'phim', day: '2026-13-01' }, NOW)).toBeNull();
  });
});

describe('selectors', () => {
  const list = [
    entry('2026-11-06', 30, { source: 'youtube', understood: 4 }),
    entry('2026-11-06', 20, { source: 'phim', understood: 2 }),
    entry('2026-11-02', 60, { source: 'podcast' }),
    entry('2026-11-01', 45, { source: 'phim', understood: 3 }), // Sunday of the previous week
    entry('2026-09-01', 600, { source: 'khac' }),
  ];

  it('sums per day, range and total', () => {
    expect(minutesOnDay(list, '2026-11-06')).toBe(50);
    expect(minutesBetween(list, '2026-11-01', '2026-11-02')).toBe(105);
    expect(totalMinutes(list)).toBe(755);
    expect(listeningToday(list, NOW, 30)).toEqual({ minutes: 50, goal: 30, pct: 100, done: true });
    expect(listeningToday(list, NOW, 0)).toEqual({ minutes: 50, goal: 0, pct: 0, done: false });
    expect(listeningToday([], NOW, 60)).toEqual({ minutes: 0, goal: 60, pct: 0, done: false });
  });

  it('buckets Monday-based weeks, oldest first, with sources and goal days', () => {
    const w = weekBuckets(list, NOW, 3, 30);
    expect(w.map((x) => x.key)).toEqual(['2026-10-19', '2026-10-26', '2026-11-02']);
    expect(w[2]).toMatchObject({ minutes: 110, days: 2, goalDays: 2, isCurrent: true, label: '02/11', rangeLabel: '02/11 – 08/11' });
    expect(w[2].bySource).toEqual({ phim: 20, youtube: 30, podcast: 60, app: 0, khac: 0 });
    expect(w[1]).toMatchObject({ minutes: 45, days: 1, goalDays: 1 });
    expect(w[0].minutes).toBe(0);
  });

  it('splits by source, largest first', () => {
    const s = sourceSplit(list, '2026-11-01');
    expect(s.map((x) => x.source)).toEqual(['phim', 'podcast', 'youtube']);
    expect(s[0]).toMatchObject({ label: 'Phim/series', minutes: 65 });
    expect(s.reduce((a, b) => a + b.share, 0)).toBeCloseTo(1);
    expect(sourceSplit([], undefined)).toEqual([]);
  });

  it('averages self-rated understanding per week, weighted by minutes', () => {
    const u = understoodByWeek(list, NOW, 2);
    expect(u[1]).toMatchObject({ key: '2026-11-02', avg: 3.2, count: 2, minutes: 50 }); // (4*30 + 2*20) / 50
    expect(u[0]).toMatchObject({ key: '2026-10-26', avg: 3, count: 1 });
    expect(understoodByWeek([entry('2026-11-06', 30)], NOW, 1)[0].avg).toBeNull();
    expect(understoodLabelFor(3.2)).toBe('50–70%');
    expect(understoodLabelFor(4.6)).toBe('>90%');
    // a tie never rounds a self-rating up into the better band
    expect(understoodLabelFor(4.5)).toBe('70–90%');
    expect(understoodLabelFor(1.5)).toBe('<30%');
    expect(understoodLabelFor(0)).toBe('<30%');
    expect(understoodLabelFor(9)).toBe('>90%');
  });

  it('finds the next milestone', () => {
    expect(nextMilestone(0)).toMatchObject({ reachedHours: 0, nextHours: 10, remainingMinutes: 600, progress: 0, label: 'Còn 10 giờ đến mốc 10 giờ' });
    expect(nextMilestone(755)).toMatchObject({ reachedHours: 10, nextHours: 25, remainingMinutes: 745 });
    expect(nextMilestone(755).progress).toBeCloseTo(155 / 900);
    expect(nextMilestone(1000 * 60 + 1)).toMatchObject({ reachedHours: 1000, nextHours: null, progress: 1, label: 'Đã qua mốc 1.000 giờ' });
  });
});

describe('store', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('adds, updates, deletes with a tombstone and restores', async () => {
    const map = stubWindow();
    const L = await fresh();
    let calls = 0;
    const off = L.subscribeListening(() => calls++);
    const a = L.addListeningEntry({ minutes: 30, source: 'phim', title: 'Friends' }, NOW)!;
    expect(a).toMatchObject({ minutes: 30, day: '2026-11-06' });
    const snap = L.getListeningEntries();
    expect(L.getListeningEntries()).toBe(snap); // stable snapshot
    expect(snap).toHaveLength(1);
    const b = L.updateListeningEntry(a.id, { minutes: 40, understood: 3, title: '' }, NOW + 1)!;
    expect(b).toMatchObject({ minutes: 40, understood: 3, updatedAt: NOW + 1 });
    expect(b.title).toBeUndefined();
    expect(L.updateListeningEntry(a.id, { minutes: 0 }, NOW + 2)).toBeNull();
    expect(L.getListeningEntries()).not.toBe(snap);
    const removed = L.deleteListeningEntry(a.id, NOW + 3)!;
    expect(removed.minutes).toBe(40);
    expect(L.getListeningEntries()).toHaveLength(0);
    expect(JSON.parse(map.get(P + 'listening-log')!).entries).toEqual([{ id: a.id, updatedAt: NOW + 3, deleted: true }]);
    expect(L.updateListeningEntry(a.id, { minutes: 5 }, NOW + 4)).toBeNull();
    const back = L.restoreListeningEntry(removed, NOW + 3)!;
    expect(back.updatedAt).toBe(NOW + 4); // newer than the tombstone even with the same clock
    expect(L.getListeningEntries()).toHaveLength(1);
    expect(calls).toBeGreaterThanOrEqual(4);
    off();
  });

  it('picks up data written by folder sync / another tab without a reload call', async () => {
    const map = stubWindow();
    const L = await fresh();
    expect(L.getListeningEntries()).toHaveLength(0);
    map.set(P + 'listening-log', JSON.stringify({ version: 1, entries: [entry('2026-11-05', 25)] }));
    expect(L.getListeningEntries()).toHaveLength(1);
  });

  it('keeps entries in memory when storage is blocked', async () => {
    stubWindow({ blocked: true });
    const L = await fresh();
    L.addListeningEntry({ minutes: 15, source: 'youtube' }, NOW);
    L.addListeningEntry({ minutes: 20, source: 'youtube' }, NOW + 1);
    expect(L.getListeningEntries().map((e) => e.minutes).sort()).toEqual([15, 20]);
  });

  it('auto-logs in-app video: merges per day + item, ignores under a minute', async () => {
    const map = stubWindow();
    const L = await fresh();
    expect(L.addAppListening('m1', 'TED talk', 40, NOW)).toBeNull();
    expect(L.getListeningEntries()).toHaveLength(0);
    expect(map.has(P + 'listening-pending')).toBe(true);
    const e = L.addAppListening('m1', 'TED talk', 40, NOW + 60_000)!;
    expect(e).toMatchObject({ source: 'app', mediaId: 'm1', seconds: 80, minutes: 1, title: 'TED talk', day: '2026-11-06' });
    expect(map.has(P + 'listening-pending')).toBe(false);
    const e2 = L.addAppListening('m1', 'TED talk', 100, NOW + 120_000)!;
    expect(e2.id).toBe(e.id);
    expect(e2).toMatchObject({ seconds: 180, minutes: 3 });
    expect(L.addAppListening('m2', 'Other', 300, NOW)!.id).not.toBe(e.id);
    // next day: a new entry; yesterday's sub-minute leftovers are dropped
    L.addAppListening('m3', 'x', 30, NOW);
    expect(L.addAppListening('m3', 'x', 45, at(2026, 11, 7, 9))).toBeNull();
    expect(L.getListeningEntries()).toHaveLength(2);
    // junk
    expect(L.addAppListening('', 'x', 100, NOW)).toBeNull();
    expect(L.addAppListening('m1', 'x', NaN, NOW)).toBeNull();
    // a hand edit replaces the measured seconds
    const edited = L.updateListeningEntry(e.id, { minutes: 10 }, NOW + 200_000)!;
    expect(edited.seconds).toBe(600);
    expect(L.addAppListening('m1', 'TED talk', 60, NOW + 300_000)).toMatchObject({ seconds: 660, minutes: 11 });
  });
});

describe('listen meter', () => {
  it('counts only playing time between flushes', () => {
    const m = createListenMeter();
    m.setPlaying(true, 0);
    m.setPlaying(false, 30_000);
    m.setPlaying(false, 40_000); // repeated pause: no effect
    m.setPlaying(true, 100_000);
    expect(m.playing).toBe(true);
    expect(m.flush(110_000)).toBe(40);
    expect(m.flush(120_000)).toBe(10); // still playing: counts from the last flush
    m.setPlaying(false, 125_000);
    expect(m.flush(500_000)).toBe(5);
    expect(m.flush(600_000)).toBe(0);
  });
});

describe('timer (device-local)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('starts, pauses, resumes and survives a reload', async () => {
    const map = stubWindow();
    let L = await fresh();
    const t0 = NOW;
    L.startTimer({ source: 'podcast' }, t0);
    expect(L.timerStatus(L.getTimer()!)).toBe('running');
    L.pauseTimer(t0 + 10 * 60_000);
    L.resumeTimer(t0 + 20 * 60_000);
    expect(map.has(P + 'listening-timer')).toBe(true);
    L = await fresh(); // reload / tab closed and reopened
    const t = L.getTimer()!;
    expect(t.source).toBe('podcast');
    expect(L.timerElapsedMs(t, t0 + 25 * 60_000)).toBe(15 * 60_000);
    expect(L.startTimer({}, t0 + 26 * 60_000)).toBe(t); // already running: kept
    const sum = L.stopTimer(t0 + 30 * 60_000)!;
    expect(sum).toMatchObject({ minutes: 20, tooLong: false, tooShort: false, source: 'podcast', day: '2026-11-06' });
    L = await fresh(); // the stopped timer waits for its form across a reload
    expect(L.timerStatus(L.getTimer()!)).toBe('stopped');
    expect(L.timerSummary(L.getTimer()!, t0 + 99 * 60_000).minutes).toBe(20);
    const e = L.saveTimer({ minutes: 18, source: 'podcast', understood: 4 }, t0 + 31 * 60_000)!;
    expect(e).toMatchObject({ minutes: 18, startedAt: t0, day: '2026-11-06', understood: 4 });
    expect(L.getTimer()).toBeNull();
    expect(map.has(P + 'listening-timer')).toBe(false);
  });

  it('flags a forgotten timer and a too-short one, and counts the start day', async () => {
    stubWindow();
    const L = await fresh();
    const start = at(2026, 11, 5, 22);
    L.startTimer({}, start);
    const s = L.stopTimer(start + 5 * 3_600_000)!;
    expect(s).toMatchObject({ tooLong: true, minutes: 300, day: '2026-11-05' });
    L.discardTimer();
    L.startTimer({}, NOW);
    expect(L.stopTimer(NOW + 20_000)).toMatchObject({ tooShort: true, minutes: 1 });
    L.discardTimer();
    expect(L.stopTimer(NOW)).toBeNull();
  });

  it('never runs backwards when the clock jumps back', () => {
    expect(timerElapsedMs({ startedAt: 100, runningSince: 100, accumulatedMs: 5000 }, 50)).toBe(5000);
    expect(timerElapsedMs(null)).toBe(0);
  });

  it('stores source and title chosen while running', async () => {
    stubWindow();
    const L = await fresh();
    expect(L.setTimerInfo({ source: 'phim' })).toBeNull();
    L.startTimer({}, NOW);
    L.setTimerInfo({ source: 'phim', title: ' The Office ' });
    expect(L.getTimer()).toMatchObject({ source: 'phim', title: 'The Office' });
    L.setTimerInfo({ title: '' });
    expect(L.getTimer()!.title).toBeUndefined();
  });

  it('ignores a corrupt stored timer', async () => {
    const map = stubWindow();
    map.set(P + 'listening-timer', '{"startedAt":"x"}');
    const L = await fresh();
    expect(L.getTimer()).toBeNull();
    map.set(P + 'listening-timer', 'not json');
    expect(L.getTimer()).toBeNull();
  });
});

describe('review fixes', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('auto-log only grows this browser\'s own entry, so two machines never overwrite each other (merge LWW)', async () => {
    const { mergeListeningLog } = await import('./syncMerge');
    // machine A logs 10 min of video X
    const mapA = stubWindow();
    mapA.set(P + 'device-id', JSON.stringify('d-aaaa1111'));
    let L = await fresh();
    L.addAppListening('vidX', 'Video X', 600, NOW);
    const afterA = JSON.parse(mapA.get(P + 'listening-log')!);
    // folder sync copies the log to machine B; B watches 10 more minutes
    const mapB = stubWindow();
    mapB.set(P + 'device-id', JSON.stringify('d-bbbb2222'));
    mapB.set(P + 'listening-log', JSON.stringify(afterA));
    L = await fresh();
    L.addAppListening('vidX', 'Video X', 600, NOW + 3_600_000);
    const logB = JSON.parse(mapB.get(P + 'listening-log')!);
    // A, not synced yet, watches 5 more minutes
    vi.unstubAllGlobals();
    const mapA2 = stubWindow();
    mapA2.set(P + 'device-id', JSON.stringify('d-aaaa1111'));
    mapA2.set(P + 'listening-log', JSON.stringify(afterA));
    L = await fresh();
    L.addAppListening('vidX', 'Video X', 300, NOW + 7_200_000);
    const logA = JSON.parse(mapA2.get(P + 'listening-log')!);
    const merged = parseListeningLog(mergeListeningLog(logA, logB));
    const live = merged.filter((e): e is ListeningEntry => !('deleted' in e));
    expect(totalMinutes(live)).toBe(25);
    expect(live).toHaveLength(2);
  });

  it('a timer paused at night and resumed the next morning counts for the morning', async () => {
    stubWindow();
    const L = await fresh();
    L.startTimer({}, at(2026, 11, 5, 22));
    L.pauseTimer(at(2026, 11, 5, 22, 5));
    L.resumeTimer(at(2026, 11, 6, 8));
    const sum = L.stopTimer(at(2026, 11, 6, 8, 55))!;
    expect(sum).toMatchObject({ minutes: 60, day: '2026-11-06' });
    const e = L.saveTimer({ minutes: 60, source: 'phim' }, at(2026, 11, 6, 9))!;
    expect(e.day).toBe('2026-11-06');
    expect(L.minutesOnDay(L.getListeningEntries(), '2026-11-06')).toBe(60);
  });

  it('a timer run across midnight without a pause counts for the day it started; the form can change it', async () => {
    stubWindow();
    const L = await fresh();
    L.startTimer({}, at(2026, 11, 5, 23, 30));
    expect(L.stopTimer(at(2026, 11, 6, 0, 20))).toMatchObject({ minutes: 50, day: '2026-11-05' });
    expect(L.saveTimer({ minutes: 50, source: 'phim', day: '2026-11-06' }, at(2026, 11, 6, 0, 21))!.day).toBe('2026-11-06');
  });

  it('formats one duration style per magnitude, with Vietnamese thousands dots', async () => {
    const L = await fresh();
    expect(L.formatDurationVi(200)).toBe('3 giờ 20 phút');
    expect(L.formatDurationVi(2766)).toBe('46,1 giờ');
    expect(L.formatDurationVi(144_779)).toBe('2.413 giờ');
    expect(L.groupVi(1000)).toBe('1.000');
    expect(L.groupVi(950)).toBe('950');
  });
});
