import { describe, expect, it } from 'vitest';
import type { CheckupResult } from './benchmark';
import { emptyByPhenomenon } from './benchmark';
import { emptyHistory, type HistoryStore } from './history';
import type { ListeningEntry } from './listening';
import { AUDIO_MODE_NOTE, buildInsights, buildReport, decimalVi, parseReportPeriod, understoodProse, type ReportInput } from './progressReport';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
const NOW = at(2026, 11, 6, 20); // Friday 6 Nov 2026
let seq = 0;
const entry = (day: string, minutes: number, extra: Partial<ListeningEntry> = {}): ListeningEntry => ({
  id: 'e' + ++seq,
  startedAt: new Date(day + 'T10:00').getTime(),
  day,
  minutes,
  source: 'phim',
  updatedAt: 1,
  ...extra,
});

let formSeq = 0;
const FORMS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

function checkup(
  id: string,
  ts: number,
  score: number,
  opts: {
    voice?: string;
    linking?: [number, number];
    flap?: [number, number];
    form?: CheckupResult['form'];
    dictation?: number;
    audioMode?: 'connected';
  } = {},
): CheckupResult {
  const by = emptyByPhenomenon();
  if (opts.linking) by.linking = { seen: opts.linking[0], missed: opts.linking[1] };
  if (opts.flap) by['flap-t'] = { seen: opts.flap[0], missed: opts.flap[1] };
  return {
    id,
    at: ts,
    form: opts.form ?? FORMS[formSeq++ % 6],
    voiceName: opts.voice ?? 'Samantha',
    ...(opts.audioMode ? { audioMode: opts.audioMode } : {}),
    rate: 1,
    dictation: { words: 100, correct: opts.dictation ?? score, extra: 0, pct: opts.dictation ?? score, items: [] },
    comprehension: { correct: 2, total: 4, pct: 50, items: [] },
    byPhenomenon: by,
    score,
    durationSec: 600,
    completed: true,
  };
}

function input(over: Partial<ReportInput> = {}): ReportInput {
  return {
    log: [],
    checkups: [],
    history: emptyHistory(),
    stats: null,
    lessons: {},
    settings: { listenGoal: 30 },
    now: NOW,
    period: '4w',
    ...over,
  };
}

const NATIVE = /bản ngữ|như người bản xứ|native/i;

describe('empty report', () => {
  it('has a muted line per section that says what to do', () => {
    const r = buildReport(input());
    expect(r.overview.empty).toMatch(/Chưa có dữ liệu/);
    expect(r.listening.empty).toMatch(/Nhật ký nghe/);
    expect(r.checkups.empty).toMatch(/mốc so sánh/);
    expect(r.understood.empty).toMatch(/chọn mức hiểu/);
    expect(r.practice.empty).toMatch(/Luyện vài bài/);
    expect(r.weeks).toHaveLength(4);
    expect(r.insights.length).toBeGreaterThanOrEqual(2);
    expect(r.insights[0]).toMatch(/Chưa có giờ nghe/);
    expect(r.insights[1]).toMatch(/Chưa có bài kiểm tra/);
    expect(r.checkups.nextLabel).toBe('Làm bài đầu tiên để có mốc so sánh');
  });
});

describe('periods', () => {
  it('parses the period param', () => {
    expect(parseReportPeriod('3m')).toBe('3m');
    expect(parseReportPeriod('all')).toBe('all');
    expect(parseReportPeriod('x')).toBe('4w');
  });

  it('4 weeks vs the same-length window before', () => {
    // period: Mon 12 Oct .. Fri 6 Nov (26 days); previous: 16 Sep .. 11 Oct
    const log = [entry('2026-11-06', 60), entry('2026-10-12', 40), entry('2026-10-11', 50), entry('2026-09-16', 30), entry('2026-09-15', 999)];
    const r = buildReport(input({ log }));
    expect(r.overview).toMatchObject({ fromDay: '2026-10-12', toDay: '2026-11-06', listenMinutes: 100, prevListenMinutes: 80, changePct: null, changeLabel: null }); // base under 2 h
    expect(r.overview.periodLabel).toBe('Từ 12/10');
    const big = buildReport(input({ log: [entry('2026-11-06', 200), entry('2026-09-20', 160)] }));
    expect(big.overview).toMatchObject({ changePct: 25, changeLabel: 'nhiều hơn kỳ trước 25%' });
    expect(r.overview.listenLabel).toBe('1 giờ 40 phút');
    expect(r.overview.totalMinutes).toBe(1179);
    expect(r.overview.milestone.nextHours).toBe(25);
    expect(r.weeks.map((w) => w.key)).toEqual(['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02']);
    expect(r.weeks[3].isCurrent).toBe(true);
  });

  it('does not compare with a tiny previous window', () => {
    const r = buildReport(input({ log: [entry('2026-11-06', 60), entry('2026-10-01', 10)] }));
    expect(r.overview.changePct).toBeNull();
    expect(r.overview.changeLabel).toBeNull();
  });

  it('3 months has 13 weeks; "Tất cả" starts at the first data and has no previous window', () => {
    expect(buildReport(input({ period: '3m' })).weeks).toHaveLength(13);
    const r = buildReport(input({ period: 'all', log: [entry('2026-06-03', 30), entry('2026-11-05', 30)] }));
    expect(r.weeks[0].key).toBe('2026-06-01');
    expect(r.weeks).toHaveLength(23);
    expect(r.overview.prevListenMinutes).toBeNull();
    expect(r.overview.periodLabel).toBe('Từ đầu đến nay');
    expect(r.overview.listenMinutes).toBe(60);
    expect(r.unit).toBe('week');
    // more than 26 weeks: charted by month, every point of the period is drawn
    const long = buildReport(input({ period: 'all', log: [entry('2024-01-03', 30), entry('2026-11-05', 30)] }));
    expect(long.unit).toBe('month');
    expect(long.weeks[0]).toMatchObject({ key: '2024-01-01', end: '2024-01-31', label: 'T1/24' });
    expect(long.weeks).toHaveLength(35);
    expect(long.weeks[34]).toMatchObject({ key: '2026-11-01', isCurrent: true });
    expect(long.listening.weeks.reduce((n, w) => n + w.minutes, 0)).toBe(60);
    expect(long.listening.goalPerBar).toBe(900);
    expect(long.overview.listenMinutes).toBe(60);
    expect(long.overview.avgPerWeekLabel).not.toBeNull();
  });
});

describe('listening section', () => {
  it('weekly bars with the goal reference line and the source split', () => {
    const log = [entry('2026-11-06', 45, { source: 'youtube' }), entry('2026-11-02', 30), entry('2026-10-27', 70, { source: 'podcast' })];
    const r = buildReport(input({ log }));
    const cur = r.listening.weeks[3];
    expect(cur).toMatchObject({ minutes: 75, minutesLabel: '1 giờ 15 phút', avgPerDay: 15, goalDays: 2 }); // 5 days elapsed
    expect(r.listening.weeks[2]).toMatchObject({ minutes: 70, avgPerDay: 10 });
    expect(r.listening).toMatchObject({ goalPerDay: 30, goalPerWeek: 210, goalPerBar: 210, goalCurrent: 150, maxMinutes: 210, empty: null }); // 5 days of the week so far
    expect(r.listening.sources.map((s) => s.source)).toEqual(['podcast', 'youtube', 'phim']);
    expect(r.listening.summary).toMatch(/tuần 02\/11 \(chưa hết\): 1 giờ 15 phút/);
    expect(r.listening.summary).toMatch(/Mục tiêu 30 phút mỗi ngày/);
    const off = buildReport(input({ log, settings: { listenGoal: 0 } }));
    expect(off.listening).toMatchObject({ goalPerDay: 0, goalPerWeek: 0, maxMinutes: 75 });
  });
});

describe('checkup section and sentences', () => {
  it('0 checkups: suggestion only', () => {
    const r = buildReport(input());
    expect(r.checkups).toMatchObject({ count: 0, baselineOnly: false, comparison: null, deltaFirstLabel: null });
  });

  it('1 checkup: it is the baseline', () => {
    const r = buildReport(input({ checkups: [checkup('k1', at(2026, 11, 1), 54)] }));
    expect(r.checkups).toMatchObject({ count: 1, baselineOnly: true, deltaFirstLabel: null, firstScore: 54, latestScore: 54 });
    expect(r.checkups.baselineNote).toMatch(/mốc đầu tiên \(54 điểm\)/);
    expect(r.checkups.nextLabel).toBe('Lần kiểm tra tiếp theo: từ 15/11');
    expect(r.insights[1]).toBe('Bài kiểm tra đầu tiên được 54 điểm, đây là mốc để so sánh; làm lại sau 14 ngày để thấy thay đổi.');
    expect(r.checkups.baselineNote).toBe('Đây là mốc đầu tiên (54 điểm). Làm lại từ ngày 15/11 để thấy thay đổi.');
    // already overdue: no "after 14 days" next to a "Đến lúc kiểm tra" banner
    const late = buildReport(input({ checkups: [checkup('k0', at(2026, 10, 20), 40)] }));
    expect(late.insights[1]).toBe('Bài kiểm tra đầu tiên được 40 điểm, đây là mốc để so sánh; đã đủ 2 tuần, làm bài lần 2 để thấy thay đổi.');
    expect(late.checkups.baselineNote).toMatch(/Đã đủ 2 tuần/);
    expect(r.insights.join(' ')).not.toMatch(/tăng|giảm/);
  });

  it('2 checkups: a hedged first signal', () => {
    const r = buildReport(input({ checkups: [checkup('k2', at(2026, 10, 20), 66), checkup('k1', at(2026, 10, 1), 54)] }));
    expect(r.checkups.deltaFirstLabel).toBe('+12 điểm so với lần đầu');
    expect(r.checkups.deltaPrevLabel).toBeNull(); // same as vs first
    expect(r.checkups.points.map((p) => p.id)).toEqual(['k2']); // k1 is before the 4-week period
    expect(r.checkups.earlier).toBe(1);
    expect(r.checkups.nextLabel).toBe('Đến lúc kiểm tra định kỳ'); // 17 days since k2
    expect(r.checkups.deltaHedge).toBe('Mới có 2 lần đo, cần khoảng 4 lần mới chắc được xu hướng.');
    expect(r.insights[1]).toBe('Điểm kiểm tra tăng (54 → 66); phần chép chính tả từ 54% lên 66%. Mới có 2 lần đo nên chưa chắc.');
  });

  it('older standard-text checkups vs a connected-speech one: an audio-mode caveat, like a voice change', () => {
    const list = [
      checkup('k1', at(2026, 9, 1), 70),
      checkup('k2', at(2026, 9, 20), 72),
      checkup('k3', at(2026, 10, 30), 55, { audioMode: 'connected' }),
    ];
    const r = buildReport(input({ checkups: list }));
    expect(r.checkups.comparison?.audioModeChanged).toBe(true);
    expect(r.checkups.comparison?.voiceChanged).toBe(false);
    expect(r.checkups.points[0]).toMatchObject({ id: 'k3', audioMode: 'connected', audioModeChanged: true });
    expect(r.checkups.voiceNote).toBe(AUDIO_MODE_NOTE);
    expect(r.insights[1]).toContain(AUDIO_MODE_NOTE);
    const same = buildReport(input({ checkups: list.map((c) => ({ ...c, audioMode: 'connected' as const })) }));
    expect(same.checkups.voiceNote).toBeNull();
    expect(same.insights[1]).not.toContain(AUDIO_MODE_NOTE);
  });

  it('3+ checkups: trend, deltas, noise band, voice change, per-phenomenon change', () => {
    const list = [
      checkup('k1', at(2026, 9, 1), 54, { linking: [6, 4], flap: [4, 3] }),
      checkup('k2', at(2026, 9, 20), 60),
      checkup('k3', at(2026, 10, 30), 66, { voice: 'Daniel', linking: [6, 1], flap: [4, 3] }),
    ];
    const r = buildReport(input({ checkups: list }));
    expect(r.checkups.deltaFirstLabel).toBe('+12 điểm so với lần đầu');
    expect(r.checkups.deltaPrevLabel).toBe('+6 điểm so với lần trước');
    expect(r.checkups.points.map((p) => p.id)).toEqual(['k3']); // only inside the 4-week period
    expect(r.checkups.earlier).toBe(2);
    expect(r.checkups.points[0].voiceChanged).toBe(true);
    expect(r.checkups.voiceNote).toMatch(/Giọng đọc đã đổi/);
    expect(r.checkups.phenomena[0]).toMatchObject({ phenomenon: 'linking', change: -50, lowSample: false });
    expect(r.checkups.phenomena.find((p) => p.phenomenon === 'flap-t')).toMatchObject({ lowSample: true });
    expect(r.checkups.due.kind).toBe(null);
    expect(r.insights[1]).toBe(
      'Điểm kiểm tra tăng (54 → 66); phần chép chính tả từ 54% lên 66%. Mới có 3 lần đo nên chưa chắc. Giọng đọc đã đổi giữa các lần, nên so sánh có thể lệch.',
    );
    // one test per side (k = 1 of 3) has 6 linking sentences: "có vẻ", with counts, never "rõ"
    expect(r.insights[2]).toBe('Trong bài kiểm tra, nối âm có vẻ tiến bộ: sót 4/6 câu ở các lần đầu, 1/6 câu gần đây.');
    expect(r.insights.join(' ')).not.toMatch(/tiến bộ rõ/);
    const flat = buildReport(input({ checkups: [checkup('a', at(2026, 9, 1), 60), checkup('b', at(2026, 9, 15), 58), checkup('c', at(2026, 10, 1), 62)] }));
    expect(flat.insights[1]).toBe('Điểm kiểm tra chưa thay đổi rõ (60 → 62): chênh từ 10 điểm trở xuống có thể chỉ do đề hoặc may rủi. Lần gần nhất cách đây 36 ngày; làm bài mới để biết hiện tại.');
    const down = buildReport(input({ checkups: [checkup('a', at(2026, 9, 1), 70), checkup('b', at(2026, 9, 15), 64), checkup('c', at(2026, 10, 1), 58)] }));
    expect(down.insights[1]).toMatch(/^Điểm kiểm tra giảm \(70 → 58\)/);
    expect(down.checkups.due.kind).toBe('due');
    expect(down.checkups.nextLabel).toBe('Đến lúc kiểm tra định kỳ');
  });
});

describe('listening sentences', () => {
  const day = (n: number) => {
    const d = new Date(2026, 10, 6 - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  it('speaks about the chosen period (numbers on the tiles), then the goal days of the last 7', () => {
    const log = [entry(day(0), 100), entry(day(1), 100), entry(day(3), 20), entry(day(8), 100), entry(day(10), 50), entry('2026-09-20', 300)];
    const r = buildReport(input({ log }));
    expect(r.insights[0]).toBe('Từ 12/10 đến nay bạn nghe 6 giờ 10 phút, nhiều hơn kỳ trước 23%. 7 ngày qua đạt mục tiêu 30 phút 2/7 ngày.');
    expect(r.overview.changeLabel).toBe('nhiều hơn kỳ trước 23%');
    expect(buildReport(input({ log, period: 'all' })).insights[0]).toMatch(/^Từ đầu đến nay bạn nghe 11,2 giờ\./);
  });

  it('hedges small samples: no comparison on a small base', () => {
    const r = buildReport(input({ log: [entry(day(0), 40), entry(day(30), 10)], settings: { listenGoal: 0 } }));
    expect(r.insights[0]).toBe('Từ 12/10 đến nay bạn nghe 40 phút.');
  });

  it('a big jump is said as a multiple, never a 4-digit percentage', () => {
    const r = buildReport(input({ log: [entry(day(0), 600), entry(day(1), 600), entry('2026-10-01', 130)] }));
    expect(r.overview.changeLabel).toBe('gấp khoảng 9 lần kỳ trước');
    expect(r.insights[0]).toMatch(/gấp khoảng 9 lần kỳ trước/);
    expect(JSON.stringify(r.insights)).not.toMatch(/\d{3,}%/);
  });

  it('goal days skip the days before the first entry, and today until its goal is met', () => {
    expect(buildReport(input({ log: [entry(day(0), 20)] })).insights[0]).toBe('Từ 12/10 đến nay bạn nghe 20 phút.');
    expect(buildReport(input({ log: [entry(day(0), 45)] })).insights[0]).toBe('Từ 12/10 đến nay bạn nghe 45 phút. 7 ngày qua đạt mục tiêu 30 phút 1/1 ngày.');
    expect(buildReport(input({ log: [entry(day(2), 45), entry(day(0), 10)] })).insights[0]).toMatch(/đạt mục tiêu 30 phút 1\/2 ngày\.$/);
  });

  it('says when nothing was logged in the period', () => {
    expect(buildReport(input({ log: [entry('2026-09-01', 600)] })).insights[0]).toBe('Từ 12/10 đến nay bạn chưa ghi giờ nghe nào; tổng cộng bạn đã nghe 10 giờ.');
  });
});

describe('self-rating section', () => {
  it('never rounds an average self-rating up into a better band', () => {
    expect(understoodProse(4.5)).toBe('khoảng 70–90%');
    expect(understoodProse(4.51)).toBe('trên 90%');
    expect(understoodProse(1.4)).toBe('dưới 30%');
  });

  it('is labelled as self-assessment and weighted by minutes', () => {
    const log = [entry('2026-11-05', 30, { understood: 4 }), entry('2026-11-04', 10, { understood: 2 }), entry('2026-11-03', 20)];
    const r = buildReport(input({ log }));
    expect(r.understood).toMatchObject({ empty: null, rated: 2, avg: 3.5, avgLabel: '3,5/5 · khoảng 50–70%' }); // a tie goes to the lower band
    expect(r.understood.note).toMatch(/tùy độ khó/);
    expect(r.understood.note).toMatch(/Tự đánh giá/);
    expect(r.understood.weeks[3].avg).toBe(3.5);
  });
});

describe('practice section', () => {
  const hist: HistoryStore = {
    version: 1,
    devices: {
      d1: {
        '2026-10-13': { mod: { dictation: { n: 20, ok: 12 } } },
        '2026-10-20': { mod: { dictation: { n: 10, ok: 6 } }, ret: { n: 10, again: 2 } },
        '2026-10-28': { mod: { pairs: { n: 15, ok: 12 } }, ret: { n: 15, again: 1 }, words: 2 },
        '2026-11-04': { mod: { dictation: { n: 10, ok: 9 } }, words: 1 },
      },
    },
    base: { until: at(2026, 10, 1), days: { '2026-09-01': { mod: { drill: { n: 50, ok: 20 } } } }, wordsLearned: 7 },
  };

  it('accuracy per week and module, retention, lessons, words', () => {
    const r = buildReport(
      input({
        history: hist,
        lessons: { a: { completedAt: at(2026, 10, 29), bestScore: 1, attempts: 1 }, b: { completedAt: at(2026, 8, 1), bestScore: 1, attempts: 1 }, c: { completedAt: 0, bestScore: 0.2, attempts: 1 } },
        review: { cards: { 'word:x~x': { reps: 1, interval: 3, lapses: 0 } } },
      }),
    );
    const p = r.practice;
    expect(p.empty).toBeNull();
    expect(p.weeks.map((w) => w.total.pct)).toEqual([60, 60, 80, 90]);
    expect(p.total).toEqual({ n: 55, ok: 39, pct: 71 });
    expect(p.modules.map((m) => [m.module, m.label, m.n])).toEqual([
      ['dictation', 'Chép chính tả', 40],
      ['pairs', 'Phân biệt âm', 15],
    ]);
    expect(p.retention).toMatchObject({ n: 25, again: 3, pct: 88, label: 'Nhớ được ở 88% lượt ôn thẻ đã thuộc (25 lượt)' });
    expect(p.lessonsPassed).toBe(1);
    expect(p.lessonsPassedTotal).toBe(2);
    expect(p.lessonsByWeek.map((w) => w.count)).toEqual([0, 0, 1, 0]);
    expect(p.words.total).toBe(10);
    expect(p.words.added).toBe(3);
    expect(p.words.weeks.map((w) => w.total)).toEqual([7, 7, 9, 10]);
    expect(p.archiveSince).toBe('2026-10-01');
    expect(p.summary).toMatch(/tuần 02\/11: 90% \(10 lượt\)/);
    // per module only: dictation has 20 attempts in its first half, 20 in its second (60% → 75%)
    expect(r.insights).toContain('Chép chính tả: độ đúng trên các bài bạn chọn luyện tăng từ 60% (nửa đầu kỳ) lên 75% (nửa sau).');
  });

  it('a shift from a hard module to an easy one is not progress', () => {
    const mix: HistoryStore = {
      version: 1,
      devices: { d: { '2026-10-13': { mod: { dictation: { n: 20, ok: 10 } } }, '2026-11-03': { mod: { lesson: { n: 20, ok: 17 } } } } },
      base: null,
    };
    expect(buildReport(input({ history: mix })).insights.join(' ')).not.toMatch(/tăng từ 50%/);
  });

  it('small practice samples give no trend sentence', () => {
    const small: HistoryStore = { version: 1, devices: { d: { '2026-10-20': { mod: { dictation: { n: 5, ok: 1 } } }, '2026-11-03': { mod: { dictation: { n: 5, ok: 5 } } } } }, base: null };
    const r = buildReport(input({ history: small }));
    expect(r.insights.join(' ')).not.toMatch(/Độ chính xác/);
  });

  it('falls back to the weakest phenomenon in practice when there are not 2 checkups', () => {
    const stats = { byPhenomenon: { 'weak-form': { seen: 20, missed: 9 }, linking: { seen: 20, missed: 2 } } };
    const r = buildReport(input({ stats, log: [entry('2026-11-06', 20)] }));
    expect(r.insights).toContain('Khi luyện, âm yếu là phần bạn hay nghe sót nhất (sót 45% lần gặp).');
  });
});

describe('honesty rules', () => {
  it('never claims native-like listening and keeps 2–4 sentences, whatever the data', () => {
    const big = Array.from({ length: 60 }, (_, i) => entry(`2026-${i < 30 ? '09' : '10'}-${String((i % 28) + 1).padStart(2, '0')}`, 300, { understood: 5 }));
    const checks = [checkup('a', at(2026, 6, 1), 10), checkup('b', at(2026, 8, 1), 60), checkup('c', at(2026, 10, 30), 100, { linking: [6, 0] })];
    for (const period of ['4w', '3m', 'all'] as const) {
      for (const log of [[], big]) {
        for (const ck of [[], checks.slice(0, 1), checks.slice(0, 2), checks]) {
          const r = buildReport(input({ period, log, checkups: ck }));
          expect(r.insights.length).toBeGreaterThanOrEqual(2);
          expect(r.insights.length).toBeLessThanOrEqual(4);
          for (const s of r.insights) {
            expect(s).not.toMatch(NATIVE);
            expect(s.trim()).toMatch(/[.!]$/);
          }
          expect(JSON.stringify(r)).not.toMatch(NATIVE);
        }
      }
    }
  });

  it('buildInsights is deterministic', () => {
    const args = { log: [entry('2026-11-06', 30)], checkups: [], goal: 30, today: '2026-11-06', period: '4w' as const, fromDay: '2026-10-19', listenMinutes: 30, change: null, stats: null, pw: [], ret: { n: 0, again: 0, pct: null }, rated: 0, uAvg: null, daysSinceCheckup: null };
    expect(buildInsights(args)).toEqual(buildInsights(args));
    expect(decimalVi(3.25)).toBe('3,3');
    expect(decimalVi(4)).toBe('4');
  });
});

describe('checkup honesty (review fixes)', () => {
  it('one flipped comprehension answer (10 points) is noise, not progress', () => {
    const r = buildReport(input({ checkups: [checkup('a', at(2026, 9, 20), 54), checkup('b', at(2026, 10, 5), 54), checkup('c', at(2026, 10, 25), 64)] }));
    expect(r.insights[1]).toMatch(/^Điểm kiểm tra chưa thay đổi rõ \(54 → 64\)/);
    expect(r.checkups.deltaHedge).toMatch(/có thể chỉ do đề/);
  });

  it('a series that goes up and down is described as such, not as "tăng"', () => {
    const r = buildReport(input({ checkups: [checkup('a', at(2026, 9, 20), 50), checkup('b', at(2026, 10, 5), 70), checkup('c', at(2026, 10, 25), 55)] }));
    expect(r.insights[1]).toBe('Điểm kiểm tra dao động từ 50 đến 70, chưa thấy xu hướng rõ.');
  });

  it('from 4 tests the trend compares the mean of the first 2 with the last 2', () => {
    const list = [checkup('a', at(2026, 8, 1), 40), checkup('b', at(2026, 8, 20), 50), checkup('c', at(2026, 9, 20), 60), checkup('d', at(2026, 10, 25), 66)];
    const r = buildReport(input({ checkups: list }));
    expect(r.insights[1]).toBe('Điểm kiểm tra tăng (trung bình 2 lần đầu 45, 2 lần gần nhất 63); phần chép chính tả từ 45% lên 63%.');
    expect(r.checkups.deltaHedge).toBeNull();
  });

  it('quick retakes (under 7 days) are left out of the trend', () => {
    const list = [checkup('a', at(2026, 10, 1), 50), checkup('b', at(2026, 10, 20), 52), checkup('c', at(2026, 10, 21), 80), checkup('d', at(2026, 10, 22), 90)];
    const r = buildReport(input({ checkups: list }));
    expect(r.checkups).toMatchObject({ count: 4, trendCount: 2, retakes: 2, latestScore: 52 });
    expect(r.checkups.points.filter((p) => !p.inTrend).map((p) => p.id)).toEqual(['c', 'd']);
    expect(r.insights[1]).toMatch(/chưa thay đổi rõ \(50 → 52\)/);
  });

  it('marks a repeated form and says so', () => {
    const list = [checkup('a', at(2026, 9, 1), 50, { form: 'A' }), checkup('b', at(2026, 10, 25), 75, { form: 'A' })];
    const r = buildReport(input({ checkups: list }));
    expect(r.checkups.points.find((p) => p.id === 'b')?.repeatForm).toBe(true);
    expect(r.checkups.formNote).toMatch(/đã làm đề này trước đây/);
    expect(r.insights[1]).toMatch(/đề đã làm trước đây/);
  });

  it('phenomenon rows: 0 → 0 dropped, low samples flagged and listed last', () => {
    const list = [checkup('a', at(2026, 10, 1), 50, { linking: [6, 0], flap: [2, 1] }), checkup('b', at(2026, 10, 25), 60, { linking: [6, 0], flap: [6, 0] })];
    const r = buildReport(input({ checkups: list }));
    expect(r.checkups.phenomena.map((p) => [p.phenomenon, p.lowSample])).toEqual([['flap-t', true]]);
  });
});

describe('charts by month and partial weeks', () => {
  it('self-rating weeks carry their count so thin weeks can be drawn hollow', () => {
    const r = buildReport(input({ log: [entry('2026-11-05', 30, { understood: 4 })] }));
    expect(r.understood.weeks[3]).toMatchObject({ avg: 4, count: 1 });
    expect(r.understood.summary).toMatch(/4 \(1 lần ghi\)/);
  });
});

describe('7-day period', () => {
  it('charts the last 7 days one bar per day, today last, with the daily goal as the reference', () => {
    const r = buildReport(input({ period: '7d', log: [entry('2026-11-06', 20), entry('2026-11-02', 45), entry('2026-10-30', 60)] }));
    expect(r.unit).toBe('day');
    expect(r.weeks.map((w) => w.key)).toEqual(['2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06']);
    expect(r.weeks[6]).toMatchObject({ label: 'T6', isCurrent: true });
    expect(r.listening.weeks.map((w) => w.minutes)).toEqual([0, 0, 45, 0, 0, 0, 20]); // 30/10 is outside the 7 days
    expect(r.overview.listenMinutes).toBe(65);
    expect(r.listening.goalPerBar).toBe(30);
    expect(r.listening.goalCurrent).toBe(0);
    expect(r.listening.summary).toMatch(/^Giờ nghe theo ngày/);
  });
  it('is a valid stored period', () => {
    expect(parseReportPeriod('7d')).toBe('7d');
    expect(parseReportPeriod('12d')).toBe('4w');
  });
});
