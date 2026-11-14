import { describe, expect, it } from 'vitest';
import { residentTile, walkable } from '../../core/town/map';
import { townOverview } from '../../core/town/overview';
import { emptyTownProgress, type TownProgress } from '../../core/town/progress';
import type { TownAnswerResult } from '../../core/town/store';
import type { LineOutcome } from '../../core/town/types';
import { placeLines, TOWN_DECORATIONS, TOWN_PLACES } from '../../data/town';
import { PLACE_IDS } from '../../data/townWorld';
import { gridDistance } from './engine/sim';
import {
  decorationRows,
  levelLabel,
  lotLabel,
  lotLabelsOf,
  lotRows,
  primaryBuy,
  stageStateOf,
  suggestedPlace,
  talkLabel,
  talkStartTile,
  talkSummary,
  taskCount,
  verdictOf,
} from './shellModel';

const NOW = new Date(2026, 10, 14, 12).getTime();
const DEVICE = 'd-test0001';

function progress(patch: Partial<TownProgress> = {}): TownProgress {
  return { ...emptyTownProgress(), ...patch };
}
const withXu = (n: number, bought: string[] = []) => progress({ earned: { [DEVICE]: n }, bought });
const view = (p: TownProgress) => townOverview(p, NOW, DEVICE);

function understood(placeId: string, count: number, best: 1 | 2 = 2): TownProgress['lines'] {
  const out: TownProgress['lines'] = {};
  for (const l of placeLines(placeId).slice(0, count)) out[l.id] = { best, tries: 1, at: NOW };
  return out;
}

describe('what the stage is told', () => {
  it('a new town: three places stand, nothing is lit, every lot shows its price', () => {
    const o = view(progress());
    const s = stageStateOf(o, 'night');
    expect([...s.built].sort()).toEqual(['cafe', 'friend', 'square']);
    expect(s.decorations).toEqual([]);
    expect(s.theme).toBe('night');
    expect(s.lit).toEqual({ square: 0, cafe: 0, friend: 0 });
    expect(s.marker).toEqual({ square: 'new', cafe: 'new', friend: 'new' });
    const labels = lotLabelsOf(o);
    expect(Object.keys(labels)).toHaveLength(10);
    expect(labels.home).toBe('20 xu');
    expect(labels.board).toBe('110 xu');
    expect(labels.cafe).toBeUndefined();
  });

  it('bought things appear and understood lines light the windows', () => {
    const o = view({ ...withXu(200, ['home', 'lamps1', 'cat']), lines: understood('cafe', 6) });
    const s = stageStateOf(o, 'day');
    expect(s.built).toContain('home');
    expect(s.decorations).toEqual(['lamps1', 'cat']);
    expect(s.lit.cafe).toBeGreaterThan(0);
    expect(s.lit.cafe).toBeLessThan(1);
    expect(lotLabelsOf(o).home).toBeUndefined();
  });
});

describe('whom to talk to next', () => {
  it('a new learner is sent to Leo on the square', () => {
    expect(suggestedPlace(view(progress()).places)?.place.id).toBe('square');
  });

  it('never an empty lot, and the least known place first', () => {
    const o = view({ ...progress(), lines: { ...understood('square', 5), ...understood('cafe', 2) } });
    const s = suggestedPlace(o.places);
    expect(s?.place.id).toBe('friend');
    expect(s?.built).toBe(true);
  });

  it('a place with lines still to understand comes before one that is only worth hearing again', () => {
    const all = (id: string) => understood(id, placeLines(id).length, 1);
    const o = view({ ...progress(), lines: { ...all('square'), ...all('cafe'), ...understood('friend', 3) } });
    expect(suggestedPlace(o.places)?.place.id).toBe('friend');
  });
});

describe('where a linked conversation starts', () => {
  it('every resident has a free tile beside them, within talking distance and not straight above or below', () => {
    for (const id of PLACE_IDS) {
      const t = talkStartTile(id);
      expect(t, id).toBeDefined();
      const r = residentTile(id);
      expect(walkable(t!), id).toBe(true);
      expect(Math.max(Math.abs(t!.x - r.x), Math.abs(t!.y - r.y)), id).toBe(1);
      // the engine calls a resident "near" under 70 world pixels
      expect(gridDistance(t!.x + 0.5, t!.y + 0.5, r.x + 0.5, r.y + 0.5), id).toBeLessThan(70);
    }
  });
});

describe('what the game says to an answer', () => {
  it('praises the first listen only for a line never answered before', () => {
    expect(verdictOf('first', false)).toMatchObject({ tone: 'ok', title: 'Chuẩn luôn, nghe một lần đã hiểu!', emote: 'heart', sfx: 'first' });
    expect(verdictOf('first', true)).toMatchObject({ tone: 'ok', title: 'Đúng rồi!', emote: 'sparkle' });
    expect(verdictOf('first', true).title).not.toMatch(/một lần/);
  });

  it('right with replays, and wrong', () => {
    expect(verdictOf('replayed', false)).toMatchObject({ tone: 'ok', title: 'Đúng rồi!', sfx: 'right' });
    expect(verdictOf('wrong', false)).toMatchObject({ tone: 'bad', title: 'Chưa phải…', emote: 'question', sfx: 'wrong' });
  });
});

function answer(outcome: LineOutcome, extra: Partial<TownAnswerResult> = {}): TownAnswerResult {
  const level = { index: 0, title: 'Khách lạ', xp: 0, nextAt: 15, nextTitle: 'Người quen', progress: 0 };
  return {
    outcome,
    prevBest: 0,
    reward: outcome === 'first' ? 3 : outcome === 'replayed' ? 2 : 0,
    bonus: 0,
    tasksPaid: [],
    earned: 0,
    balance: 0,
    levelBefore: level,
    levelAfter: level,
    leveledUp: false,
    placeId: 'cafe',
    heartsBefore: 0,
    heartsAfter: 0,
    review: null,
    conversation: null,
    progress: emptyTownProgress(),
    saved: true,
    ...extra,
  };
}

describe('what a conversation came to', () => {
  it('adds up lines, the bonus and the tasks paid on the way', () => {
    const results = [
      answer('first'),
      answer('first'),
      answer('replayed'),
      answer('first', { tasksPaid: [{ id: 'first', label: 'Hiểu 4 câu ngay lần nghe đầu', reward: 10 }] }),
      answer('first', { bonus: 5, heartsAfter: 1, leveledUp: true, levelAfter: { index: 1, title: 'Người quen', xp: 15, nextAt: 40, nextTitle: 'Hàng xóm', progress: 0 } }),
    ];
    const s = talkSummary(results, [false, true, false, false, false], 'Emma');
    expect(s).toMatchObject({ lines: 5, understood: 5, firstNew: 3, lineXu: 14, bonus: 5, total: 29, heartsBefore: 0, heartsAfter: 1, levelTitle: 'Người quen' });
    expect(s.tasks).toHaveLength(1);
    expect(s.title).toBe('Bạn hiểu hết 5 câu Emma nói!');
  });

  it('says it plainly when some or all lines were missed, and promises nothing', () => {
    const some = talkSummary([answer('first'), answer('wrong'), answer('replayed'), answer('wrong'), answer('wrong')], [false, false, false, false, false], 'Leo');
    expect(some).toMatchObject({ understood: 2, total: 5, bonus: 0, levelTitle: null });
    expect(some.title).toBe('Bạn hiểu 2/5 câu Leo nói');
    const none = talkSummary([answer('wrong'), answer('wrong')], [false, false], 'Leo');
    expect(none.total).toBe(0);
    expect(none.title).toBe('Chưa hiểu câu nào Leo nói');
  });

  it('an empty list is harmless', () => {
    expect(talkSummary([], [], 'Mia')).toMatchObject({ lines: 0, understood: 0, total: 0, heartsBefore: 0, heartsAfter: 0 });
  });
});

describe('the build panel', () => {
  it('lists the ten lots, the ones that can be paid first, then by price', () => {
    const o = view(withXu(45));
    const rows = lotRows(o.places);
    expect(rows).toHaveLength(10);
    expect(rows.map((r) => r.place.id).slice(0, 4)).toEqual(['home', 'shop', 'office', 'school']);
    expect(rows.filter((r) => r.affordable).map((r) => r.place.id)).toEqual(['home', 'shop', 'office']);
    expect(rows[3].missing).toBe(5);
  });

  it('a built place leaves the list; bought decorations sink to the end', () => {
    const o = view(withXu(200, ['home', 'lamps1']));
    expect(lotRows(o.places).map((r) => r.place.id)).not.toContain('home');
    const rows = decorationRows(o.decorations);
    expect(rows).toHaveLength(TOWN_DECORATIONS.length);
    expect(rows[rows.length - 1].decoration.id).toBe('lamps1');
    expect(rows[0].decoration.id).toBe('flowers');
  });

  it('exactly one main action: the lot that was asked for when it can be paid, else the first thing that can', () => {
    const rich = view(withXu(100));
    const lots = lotRows(rich.places);
    const decs = decorationRows(rich.decorations).filter((d) => !d.bought);
    expect(primaryBuy(lots, decs, 'school')).toBe('school');
    expect(primaryBuy(lots, decs, 'board')).toBe('home');
    expect(primaryBuy(lots, decs)).toBe('home');
    const poor = view(withXu(9));
    expect(primaryBuy(lotRows(poor.places), decorationRows(poor.decorations))).toBe('flowers');
    const broke = view(progress());
    expect(primaryBuy(lotRows(broke.places), decorationRows(broke.decorations))).toBeNull();
  });
});

describe('words', () => {
  it('names every action for the hidden list of buttons', () => {
    const o = view(progress());
    const cafe = o.places.find((p) => p.place.id === 'cafe')!;
    const shop = o.places.find((p) => p.place.id === 'shop')!;
    expect(talkLabel(cafe)).toBe('Tới chỗ Emma ở Quán cà phê và bắt chuyện');
    expect(lotLabel(shop)).toBe('Xây Cửa hàng, 30 xu');
    expect(new Set(o.places.map((p) => (p.built ? talkLabel(p) : lotLabel(p)))).size).toBe(TOWN_PLACES.length);
  });

  it('counts a task only while it is open, and reads the level out', () => {
    expect(taskCount({ done: 1, goal: 2, reached: false })).toBe('1/2');
    expect(taskCount({ done: 2, goal: 2, reached: true })).toBe('');
    expect(levelLabel({ index: 0, title: 'Khách lạ', xp: 6, nextAt: 15, nextTitle: 'Người quen', progress: 0.4 })).toBe('Danh hiệu: Khách lạ. Còn 9 điểm nữa thành Người quen');
    expect(levelLabel({ index: 5, title: 'Thị trưởng', xp: 400, nextAt: null, nextTitle: null, progress: 1 })).toBe('Danh hiệu: Thị trưởng');
  });
});
