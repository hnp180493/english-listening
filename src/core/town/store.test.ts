// IO of "Thị trấn" against a fake localStorage. Each test imports fresh modules (module-level session state).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAllData, exportBackup, restoreBackup, validateBackup, type StorageLike } from '../backup';
import { isDeviceLocalKey, KEYS, STORAGE_PREFIX } from '../storage';
import { placeLines } from '../../data/town';
import { reviewNoteVi } from '../../features/dictation/pageModel';
import type { LineOutcome } from './types';

const NOW = new Date(2026, 10, 13, 12, 0).getTime();
const TODAY = '2026-11-13';
const DAY = 86_400_000;
const P = STORAGE_PREFIX;
const TOWN = P + 'town-progress';
const REVIEW = P + 'review-cards';
const DEVICE = 'd-test0001';
const [L1, L2, L3] = placeLines('cafe');
const EMPTY = { version: 2, lines: {}, earned: {}, bought: [], daily: {}, days: [] };

let map: Map<string, string>;
let failNext: Set<string>;
let storage: StorageLike;

beforeEach(() => {
  map = new Map();
  failNext = new Set();
  storage = {
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (failNext.delete(k)) throw new Error('QuotaExceededError');
      map.set(k, v);
    },
    removeItem: (k: string) => void map.delete(k),
  };
  map.set(P + KEYS.deviceId, JSON.stringify(DEVICE));
  vi.stubGlobal('window', { localStorage: storage, addEventListener: () => {} });
});

afterEach(() => vi.unstubAllGlobals());

async function fresh() {
  vi.resetModules();
  return import('./store');
}

const stored = (key: string) => JSON.parse(map.get(key) ?? 'null');
/** A stored town with `xu` earned on this browser. */
const seed = (xu: number, extra: object = {}) => map.set(TOWN, JSON.stringify({ ...EMPTY, earned: { [DEVICE]: xu }, ...extra }));

describe('town store', () => {
  it('the key is synced, not device-local', () => {
    expect(KEYS.town).toBe('town-progress');
    expect(isDeviceLocalKey(KEYS.town)).toBe(false);
    expect(isDeviceLocalKey(KEYS.deviceId)).toBe(true);
  });

  it('starts empty with a stable snapshot; an answer is saved and gives a new snapshot', async () => {
    const town = await fresh();
    const a = town.loadTownProgress();
    expect(a).toEqual(EMPTY);
    expect(town.loadTownProgress()).toBe(a);
    let calls = 0;
    const off = town.subscribeTown(() => calls++);
    const r = town.recordTownAnswer(L1, 'first', NOW);
    expect(r.saved).toBe(true);
    expect(r.progress.lines[L1.id]).toEqual({ best: 2, tries: 1, at: NOW });
    expect(stored(TOWN)).toEqual({
      version: 2,
      lines: { [L1.id]: { best: 2, tries: 1, at: NOW } },
      earned: { [DEVICE]: 3 },
      bought: [],
      daily: { [TODAY]: { [DEVICE]: { talks: 0, lines: 1, first: 1, met: [], paid: [] } } },
      days: [TODAY],
    });
    expect(calls).toBeGreaterThan(0);
    const b = town.loadTownProgress();
    expect(b).not.toBe(a);
    expect(b).toBe(r.progress);
    expect(town.loadTownProgress()).toBe(b);
    off();
    const before = calls;
    town.recordTownAnswer(L2, 'wrong', NOW + 1);
    expect(calls).toBe(before);
  });

  it('reads junk as empty and picks up a value written behind its back (another tab, folder sync)', async () => {
    map.set(TOWN, '{"lines":"x"');
    const town = await fresh();
    expect(town.loadTownProgress()).toEqual(EMPTY);
    map.set(TOWN, 'null');
    expect(town.loadTownProgress()).toEqual(EMPTY);
    map.set(TOWN, JSON.stringify({ ...EMPTY, lines: { [L2.id]: { best: 1, tries: 2, at: 5 } }, earned: { 'd-other001': 9 } }));
    expect(town.loadTownProgress().lines[L2.id]).toEqual({ best: 1, tries: 2, at: 5 });
    // a write builds on what is stored now, not on an older snapshot
    const r = town.recordTownAnswer(L1, 'replayed', NOW);
    expect(Object.keys(stored(TOWN).lines).sort()).toEqual([L1.id, L2.id].sort());
    expect(stored(TOWN).earned).toEqual({ [DEVICE]: 2, 'd-other001': 9 });
    expect(r.balance).toBe(11);
  });

  it('a town saved by the first version (version 1) loads: its lines and level stay, xu start at 0', async () => {
    map.set(TOWN, JSON.stringify({ version: 1, lines: { [L1.id]: { best: 2, tries: 1, at: 5 }, [L2.id]: { best: 1, tries: 2, at: 6 } } }));
    const town = await fresh();
    const p = town.loadTownProgress();
    expect(p).toEqual({ ...EMPTY, lines: { [L1.id]: { best: 2, tries: 1, at: 5 }, [L2.id]: { best: 1, tries: 2, at: 6 } } });
    const r = town.recordTownAnswer(L1, 'first', NOW); // already at its best: 1 xu
    expect(r).toMatchObject({ reward: 1, prevBest: 2, balance: 1 });
    expect(r.levelBefore.xp).toBe(5);
    expect(stored(TOWN).version).toBe(2);
    expect(stored(TOWN).lines[L2.id]).toEqual({ best: 1, tries: 2, at: 6 });
  });

  it('a refused save keeps the changes for the session and writes them with the next save that works', async () => {
    const town = await fresh();
    failNext.add(TOWN);
    const r = town.recordTownAnswer(L1, 'first', NOW);
    expect(r.saved).toBe(false);
    expect(r.balance).toBe(3);
    expect(map.has(TOWN)).toBe(false);
    expect(town.loadTownProgress().lines[L1.id]).toEqual({ best: 2, tries: 1, at: NOW });
    expect(town.loadTownProgress()).toBe(town.loadTownProgress());
    // meanwhile another tab saved a line: it is kept
    map.set(TOWN, JSON.stringify({ ...EMPTY, lines: { [L3.id]: { best: 1, tries: 1, at: 7 } } }));
    expect(Object.keys(town.loadTownProgress().lines).sort()).toEqual([L1.id, L3.id].sort());
    const ok = town.recordTownAnswer(L2, 'wrong', NOW + 1);
    expect(ok.saved).toBe(true);
    expect(Object.keys(stored(TOWN).lines).sort()).toEqual([L1.id, L2.id, L3.id].sort());
    expect(stored(TOWN).earned).toEqual({ [DEVICE]: 3 });
  });

  it('reloadTown forgets the session copy (folder sync or a restore replaced storage) and tells subscribers', async () => {
    const town = await fresh();
    failNext.add(TOWN);
    town.recordTownAnswer(L1, 'first', NOW);
    let calls = 0;
    town.subscribeTown(() => calls++);
    town.reloadTown();
    expect(calls).toBe(1);
    expect(town.loadTownProgress()).toEqual(EMPTY);
  });

  it('subscribers hear a bulk change ("*": restore, "Xóa dữ liệu") and writes of the town key only', async () => {
    const town = await fresh();
    const { notifyWrite, saveJSON } = await import('../storage');
    let calls = 0;
    town.subscribeTown(() => calls++);
    notifyWrite('*');
    expect(calls).toBe(1);
    saveJSON(KEYS.stats, {});
    expect(calls).toBe(1);
    saveJSON(KEYS.town, EMPTY);
    expect(calls).toBe(2);
  });

  it('townDevice is this browser id, and stays the same', async () => {
    const town = await fresh();
    expect(town.townDevice()).toBe(DEVICE);
    map.delete(P + KEYS.deviceId);
    const made = town.townDevice();
    expect(made).toMatch(/^d-[a-z0-9]{8}$/);
    expect(town.townDevice()).toBe(made);
  });
});

describe('recordTownAnswer', () => {
  it('a right answer: the line, its xu, the daily counters, one practice attempt without phenomena, no review card', async () => {
    const town = await fresh();
    const r = town.recordTownAnswer(L1, 'first', NOW);
    expect(r).toMatchObject({
      outcome: 'first',
      prevBest: 0,
      reward: 3,
      bonus: 0,
      tasksPaid: [],
      earned: 3,
      balance: 3,
      leveledUp: false,
      placeId: 'cafe',
      heartsBefore: 0,
      heartsAfter: 0,
      review: null,
      conversation: null,
      saved: true,
    });
    expect(r.levelBefore).toMatchObject({ index: 0, xp: 0 });
    expect(r.levelAfter).toMatchObject({ index: 0, xp: 3, title: 'Khách lạ', nextAt: 15 });
    expect(r.progress.lines[L1.id]).toEqual({ best: 2, tries: 1, at: NOW });
    const stats = stored(P + 'stats');
    expect(stats.attempts).toEqual([{ at: NOW, module: 'town', itemId: L1.id, correct: true, seen: [], missed: [] }]);
    for (const v of Object.values(stats.byPhenomenon as Record<string, { seen: number; missed: number }>)) expect(v).toEqual({ seen: 0, missed: 0 });
    const history = stored(P + 'progress-history');
    const days = Object.values(history.devices as Record<string, Record<string, { mod?: unknown; once?: unknown }>>)[0];
    const day = Object.values(days)[0];
    expect(day.mod).toEqual({ town: { n: 1, ok: 1 } });
    expect(day.once).toBeUndefined(); // choosing a meaning is not the dictation first-listen measurement
    expect(map.has(REVIEW)).toBe(false);
  });

  it('pays 3 / 2 / 1 / 0 by what the line was before and how it went', async () => {
    const town = await fresh();
    const got = (line: typeof L1, o: LineOutcome, t: number) => {
      const r = town.recordTownAnswer(line, o, t);
      return [r.prevBest, r.reward, r.balance];
    };
    expect(got(L1, 'wrong', NOW)).toEqual([0, 0, 0]);
    expect(got(L1, 'replayed', NOW + 1)).toEqual([0, 2, 2]);
    expect(got(L1, 'replayed', NOW + 2)).toEqual([1, 1, 3]);
    expect(got(L1, 'first', NOW + 3)).toEqual([1, 3, 6]);
    expect(got(L1, 'first', NOW + 4)).toEqual([2, 1, 7]);
    expect(got(L1, 'wrong', NOW + 5)).toEqual([2, 0, 7]);
    expect(got(L2, 'first', NOW + 6)).toEqual([0, 3, 10]);
  });

  it('the fourth first-listen line of the day pays the daily task with it, once', async () => {
    const town = await fresh();
    // lines of three places in turn: no five in a row at one place, so no conversation ends on the way
    const lines = Array.from({ length: 10 }, (_, i) => placeLines(['square', 'cafe', 'friend'][i % 3])[i]);
    for (let i = 0; i < 3; i++) expect(town.recordTownAnswer(lines[i], 'first', NOW + i).tasksPaid).toEqual([]);
    const r = town.recordTownAnswer(lines[3], 'first', NOW + 3);
    expect(r.tasksPaid).toEqual([{ id: 'first', label: 'Hiểu 4 câu ngay lần nghe đầu', reward: 10 }]);
    expect(r).toMatchObject({ reward: 3, earned: 13, balance: 22 });
    expect(town.recordTownAnswer(lines[4], 'first', NOW + 4)).toMatchObject({ tasksPaid: [], earned: 3, balance: 25 });
    expect(stored(TOWN).daily[TODAY][DEVICE]).toEqual({ talks: 0, lines: 5, first: 5, met: [], paid: ['first'] });
    // a reload (fresh module state) on the same day does not pay it again
    const again = await fresh();
    expect(again.recordTownAnswer(lines[5], 'first', NOW + 5).tasksPaid).toEqual([]);
    // the next local day does
    for (let i = 6; i < 9; i++) again.recordTownAnswer(lines[i], 'first', NOW + DAY + i);
    expect(again.recordTownAnswer(lines[9], 'first', NOW + DAY + 9).tasksPaid.map((t) => t.id)).toEqual(['first']);
  });

  it('the level and the hearts move with the lines understood', async () => {
    const town = await fresh();
    const lines = placeLines('cafe');
    const results = lines.slice(0, 5).map((l, i) => town.recordTownAnswer(l, 'first', NOW + i));
    expect(results.map((r) => r.levelAfter.xp)).toEqual([3, 6, 9, 12, 15]);
    expect(results.map((r) => r.leveledUp)).toEqual([false, false, false, false, true]);
    expect(results[4].levelBefore).toMatchObject({ index: 0, title: 'Khách lạ' });
    expect(results[4].levelAfter).toMatchObject({ index: 1, title: 'Người quen', xp: 15, nextAt: 40 });
    // 24 lines at Quán cà phê: the first heart comes with the third line understood
    expect(results.map((r) => [r.heartsBefore, r.heartsAfter])).toEqual([[0, 0], [0, 0], [0, 1], [1, 1], [1, 1]]);
  });

  it('a wrong answer on a sentence without a card enrols its dictation card, once', async () => {
    const town = await fresh();
    const r = town.recordTownAnswer(L1, 'wrong', NOW);
    expect(r.progress.lines[L1.id]).toEqual({ best: 0, tries: 1, at: NOW });
    expect(r).toMatchObject({ reward: 0, earned: 0, balance: 0 });
    expect(r.review).toMatchObject({ reason: 'enrolled', budgeted: false, saved: true });
    const card = stored(REVIEW).cards[`dict:${L1.id}`];
    expect(card).toMatchObject({ id: `dict:${L1.id}`, lastGrade: 'again', interval: 0, born: NOW });
    expect(card.due).toBeGreaterThan(NOW);
    expect(reviewNoteVi(r.review, NOW)).toMatch(/^Câu này sẽ quay lại trong Ôn tập /);
    expect(stored(P + 'stats').attempts[0]).toMatchObject({ module: 'town', correct: false });

    // missed again: the card exists now, so its schedule is left alone
    const again = town.recordTownAnswer(L1, 'wrong', NOW + 5 * 60_000);
    expect(again.review).toBeNull();
    expect(reviewNoteVi(again.review, NOW)).toBeNull();
    expect(stored(REVIEW).cards[`dict:${L1.id}`]).toEqual(card);
    expect(again.progress.lines[L1.id]).toEqual({ best: 0, tries: 2, at: NOW + 5 * 60_000 });
  });

  it('never changes a card that already exists (due, not due or suspended)', async () => {
    const mk = (extra: object) => ({ ease: 2.5, lapses: 0, reps: 3, interval: 12, last: NOW - DAY, born: NOW - 30 * DAY, lastGrade: 'good', ...extra });
    const cards = {
      [`dict:${L1.id}`]: mk({ id: `dict:${L1.id}`, due: NOW + 11 * DAY }),
      [`dict:${L2.id}`]: mk({ id: `dict:${L2.id}`, due: NOW - DAY }),
      [`dict:${L3.id}`]: mk({ id: `dict:${L3.id}`, due: NOW - DAY, suspended: true }),
    };
    map.set(REVIEW, JSON.stringify({ version: 1, cards, daily: { day: '2026-11-13', ids: [], exempt: [], extraSec: 0, enrolled: 0 }, since: NOW - 30 * DAY, notice: null, noticeSeenAt: 0 }));
    const before = map.get(REVIEW);
    const town = await fresh();
    for (const l of [L1, L2, L3]) expect(town.recordTownAnswer(l, 'wrong', NOW).review).toBeNull();
    expect(map.get(REVIEW)).toBe(before);
    expect(stored(TOWN).lines[L2.id]).toEqual({ best: 0, tries: 1, at: NOW });
  });

  it('a sentence practised in Chép chính tả before gets its card from that history, not from the miss here', async () => {
    map.set(P + 'dictation-progress', JSON.stringify({ [L1.id]: { best: 0.5, attempts: 2, lastAt: NOW - 3 * DAY } }));
    const town = await fresh();
    const r = town.recordTownAnswer(L1, 'wrong', NOW);
    expect(r.review).toBeNull();
    const card = stored(REVIEW).cards[`dict:${L1.id}`];
    expect(card).toBeDefined();
    expect(card.lastGrade).toBeUndefined(); // seeded by reconcile, never graded by the town
  });

  it('a line that is no dictation sentence (a later dialogue line) is recorded and paid, without a review card', async () => {
    const town = await fresh();
    const line = { id: 'cafe-d1-2', text: 'For here or to go?', vi: 'Dùng ở đây hay mang đi?', level: 1 as const };
    const r = town.recordTownAnswer(line, 'wrong', NOW);
    expect(r.review).toBeNull();
    expect(r.placeId).toBeUndefined();
    expect(r.progress.lines['cafe-d1-2']).toEqual({ best: 0, tries: 1, at: NOW });
    expect(stored(P + 'stats').attempts[0]).toMatchObject({ module: 'town', itemId: 'cafe-d1-2', correct: false });
    expect(map.has(REVIEW)).toBe(false);
    expect(town.recordTownAnswer(line, 'first', NOW + 1)).toMatchObject({ reward: 3, balance: 3, conversation: null });
  });

  it('still answers when storage refuses everything', async () => {
    const town = await fresh();
    storage.setItem = () => {
      throw new Error('SecurityError');
    };
    const r = town.recordTownAnswer(L1, 'replayed', NOW);
    expect(r.saved).toBe(false);
    expect(r.progress.lines[L1.id]).toEqual({ best: 1, tries: 1, at: NOW });
    expect(r.balance).toBe(2);
    expect(town.recordTownAnswer(L2, 'first', NOW + 1)).toMatchObject({ reward: 3, balance: 5, saved: false });
  });
});

describe('a conversation', () => {
  it('starts with five lines of the place and their three meanings, fixed for the whole conversation', async () => {
    const town = await fresh();
    const start = town.startTownConversation('cafe');
    if (!start.ok) throw new Error(start.reason);
    expect(start.place.id).toBe('cafe');
    expect(start.turns).toHaveLength(5);
    const pool = placeLines('cafe').map((l) => l.id);
    for (const turn of start.turns) {
      expect(pool).toContain(turn.line.id);
      expect(turn.choices.options).toHaveLength(3);
      expect(turn.choices.options[turn.choices.answer]).toBe(turn.line.vi);
    }
    expect(new Set(start.turns.map((t) => t.line.id)).size).toBe(5);
    expect(town.finishTownConversation()).toBeNull();
  });

  it('is refused for an empty lot and for an unknown place', async () => {
    const town = await fresh();
    expect(town.startTownConversation('home')).toEqual({ ok: false, reason: 'empty-lot' });
    expect(town.startTownConversation('nope')).toEqual({ ok: false, reason: 'unknown' });
    expect(town.startTownConversation('lamps1')).toEqual({ ok: false, reason: 'unknown' });
    seed(20);
    expect(town.buyTownItem('home').ok).toBe(true);
    expect(town.startTownConversation('home')).toMatchObject({ ok: true, place: { id: 'home' } });
  });

  it('five right out of five: the last answer pays the bonus and hands over the result', async () => {
    const town = await fresh();
    const start = town.startTownConversation('cafe');
    if (!start.ok) throw new Error(start.reason);
    const outcomes: LineOutcome[] = ['first', 'replayed', 'first', 'first', 'first'];
    const results = start.turns.map((t, i) => town.recordTownAnswer(t.line, outcomes[i], NOW + i));
    expect(results.slice(0, 4).map((r) => [r.bonus, r.conversation])).toEqual([[0, null], [0, null], [0, null], [0, null]]);
    expect(town.finishTownConversation()).toBe(results[4].conversation);
    const last = results[4];
    // 3 + 2 + 3 + 3 = 11 before; the last line: 3 xu, the bonus 5 and "4 câu ngay lần nghe đầu" 10
    expect(last).toMatchObject({ reward: 3, bonus: 5, earned: 18, balance: 29 });
    expect(last.tasksPaid.map((t) => t.id)).toEqual(['first']);
    expect(last.conversation).toEqual({
      placeId: 'cafe',
      outcomes,
      summary: { lines: 5, understood: 5, first: 4, wrong: 0, perfect: true },
      bonus: 5,
      tasksPaid: [],
      earned: 29,
      balance: 29,
      heartsBefore: 0,
      heartsAfter: 1,
    });
    expect(stored(TOWN).daily[TODAY][DEVICE]).toEqual({ talks: 1, lines: 5, first: 4, met: ['cafe'], paid: ['first'] });
    expect(stored(TOWN).earned).toEqual({ [DEVICE]: 29 });
    // reading the result again pays nothing again
    expect(town.finishTownConversation()).toBe(last.conversation);
    expect(stored(TOWN).earned).toEqual({ [DEVICE]: 29 });
  });

  it('one wrong line: the conversation counts, there is no bonus', async () => {
    const town = await fresh();
    const start = town.startTownConversation('square');
    if (!start.ok) throw new Error(start.reason);
    const outcomes: LineOutcome[] = ['replayed', 'wrong', 'replayed', 'replayed', 'replayed'];
    const results = start.turns.map((t, i) => town.recordTownAnswer(t.line, outcomes[i], NOW + i));
    expect(results[4]).toMatchObject({ reward: 2, bonus: 0, earned: 2, balance: 8 });
    expect(results[4].conversation).toMatchObject({ bonus: 0, earned: 8, summary: { understood: 4, wrong: 1, perfect: false } });
    expect(stored(TOWN).daily[TODAY][DEVICE]).toMatchObject({ talks: 1, met: ['square'] });
  });

  it('the second resident of the day pays "Trò chuyện với 2 người dân"; the same resident twice does not', async () => {
    const town = await fresh();
    const talk = (placeId: string, t: number) => {
      const start = town.startTownConversation(placeId);
      if (!start.ok) throw new Error(start.reason);
      return start.turns.map((turn, i) => town.recordTownAnswer(turn.line, 'replayed', t + i))[4];
    };
    const one = talk('cafe', NOW);
    expect(one.conversation?.tasksPaid).toEqual([]);
    const same = talk('cafe', NOW + 100);
    expect(same.conversation?.tasksPaid).toEqual([]);
    // the 8th line understood today came on the way: that task is the answer's, not the conversation's
    expect(same.tasksPaid.map((t) => t.id)).toEqual([]);
    const two = talk('square', NOW + 200);
    expect(two.conversation?.tasksPaid).toEqual([{ id: 'talk', label: 'Trò chuyện với 2 người dân', reward: 5 }]);
    expect(two.tasksPaid.map((t) => t.id)).toEqual(['talk']);
    expect(two.bonus).toBe(5);
    expect(stored(TOWN).daily[TODAY][DEVICE]).toEqual({ talks: 3, lines: 15, first: 0, met: ['cafe', 'square'], paid: ['lines', 'talk'] });
    const three = talk('friend', NOW + 300);
    expect(three.conversation?.tasksPaid).toEqual([]);
    // every xu is in the balance exactly once: 20 lines × 2, four bonuses, "Hiểu 8 câu" and the talk task
    expect(three.balance).toBe(20 * 2 + 4 * 5 + 8 + 5);
  });

  it('a line answered twice in one conversation (double click, an effect run twice) is recorded once', async () => {
    const town = await fresh();
    const start = town.startTownConversation('cafe');
    if (!start.ok) throw new Error(start.reason);
    const a = town.recordTownAnswer(start.turns[0].line, 'first', NOW);
    const b = town.recordTownAnswer(start.turns[0].line, 'first', NOW + 1);
    expect(b).toBe(a);
    expect(stored(TOWN).lines[start.turns[0].line.id]).toEqual({ best: 2, tries: 1, at: NOW });
    expect(stored(TOWN).earned).toEqual({ [DEVICE]: 3 });
    expect(stored(P + 'stats').attempts).toHaveLength(1);
    for (let i = 1; i < 5; i++) town.recordTownAnswer(start.turns[i].line, 'first', NOW + 10 + i);
    const done = town.finishTownConversation();
    expect(done?.outcomes).toHaveLength(5);
    // the last line again, after the end: still the same result, nothing paid twice
    const earned = stored(TOWN).earned[DEVICE];
    expect(town.recordTownAnswer(start.turns[4].line, 'first', NOW + 99).conversation).toBe(done);
    expect(stored(TOWN).earned[DEVICE]).toBe(earned);
  });

  it('leaving in the middle keeps the answered lines and their xu; the next start is a new conversation', async () => {
    const town = await fresh();
    const first = town.startTownConversation('cafe');
    if (!first.ok) throw new Error(first.reason);
    town.recordTownAnswer(first.turns[0].line, 'first', NOW);
    town.recordTownAnswer(first.turns[1].line, 'first', NOW + 1);
    expect(town.finishTownConversation()).toBeNull();
    const second = town.startTownConversation('cafe');
    if (!second.ok) throw new Error(second.reason);
    // the two understood lines moved to the back of the queue
    expect(second.turns.map((t) => t.line.id)).not.toContain(first.turns[0].line.id);
    const results = second.turns.map((t, i) => town.recordTownAnswer(t.line, 'first', NOW + 10 + i));
    expect(results[4].conversation).toMatchObject({ bonus: 5, earned: 5 * 3 + 5 + 10, outcomes: ['first', 'first', 'first', 'first', 'first'] });
    expect(results[4].balance).toBe(7 * 3 + 5 + 10);
    expect(stored(TOWN).daily[TODAY][DEVICE]).toMatchObject({ talks: 1, lines: 7, first: 7 });
  });

  it('answers without a started conversation still make one: five lines of the same built place', async () => {
    const town = await fresh();
    const lines = placeLines('friend');
    const results = lines.slice(0, 5).map((l, i) => town.recordTownAnswer(l, 'first', NOW + i));
    expect(results[3].conversation).toBeNull();
    expect(results[4]).toMatchObject({ bonus: 5 });
    expect(results[4].conversation).toMatchObject({ placeId: 'friend', bonus: 5 });
    // the next line begins another one
    expect(town.recordTownAnswer(lines[5], 'first', NOW + 9).conversation).toBeNull();
    expect(town.finishTownConversation()).toBeNull();
  });

  it('the meanings of a turn are the ones choicesFor gives for the tries so far, so a repeat moves the right one', async () => {
    const town = await fresh();
    const { choicesFor, choiceSeed } = await import('./visit');
    const start = town.startTownConversation('cafe');
    if (!start.ok) throw new Error(start.reason);
    const pool = placeLines('cafe');
    for (const turn of start.turns) expect(turn.choices).toEqual(choicesFor(turn.line, pool, 0));
    town.recordTownAnswer(start.turns[0].line, 'wrong', NOW);
    const again = town.startTownConversation('cafe');
    if (!again.ok) throw new Error(again.reason);
    const repeat = again.turns.find((t) => t.line.id === start.turns[0].line.id)!;
    expect(repeat).toBeDefined(); // a missed line stays in
    expect(choiceSeed(town.loadTownProgress(), repeat.line.id)).toBe(1);
    expect(repeat.choices.answer).not.toBe(start.turns[0].choices.answer);
  });
});

describe('buyTownItem', () => {
  it('builds a lot when the xu are there, in any order, and the balance goes down', async () => {
    seed(125);
    const town = await fresh();
    const park = town.buyTownItem('park');
    expect(park).toMatchObject({ ok: true, item: { id: 'park', kind: 'place', name: 'Công viên', cost: 100 }, balance: 25, saved: true });
    expect(stored(TOWN).bought).toEqual(['park']);
    expect(stored(TOWN).earned).toEqual({ [DEVICE]: 125 });
    const cat = town.buyTownItem('cat');
    expect(cat).toEqual({ ok: false, reason: 'poor', item: { id: 'cat', kind: 'decoration', name: 'Chú mèo', cost: 35 }, missing: 10, balance: 25 });
    expect(town.buyTownItem('home')).toMatchObject({ ok: true, balance: 5 });
    expect(town.buyTownItem('park')).toMatchObject({ ok: false, reason: 'owned', balance: 5 });
    expect(town.buyTownItem('cafe')).toMatchObject({ ok: false, reason: 'owned' });
    expect(town.buyTownItem('nope')).toEqual({ ok: false, reason: 'unknown', item: null, missing: 0, balance: 5 });
    expect(stored(TOWN).bought).toEqual(['home', 'park']);
  });

  it('a refused purchase writes nothing and tells nobody', async () => {
    seed(5);
    const before = map.get(TOWN);
    const town = await fresh();
    let calls = 0;
    town.subscribeTown(() => calls++);
    expect(town.buyTownItem('home')).toMatchObject({ ok: false, reason: 'poor', missing: 15 });
    expect(map.get(TOWN)).toBe(before);
    expect(calls).toBe(0);
  });

  it('xu earned by listening buy the first decoration', async () => {
    const town = await fresh();
    const lines = placeLines('cafe');
    expect(town.buyTownItem('flowers')).toMatchObject({ ok: false, reason: 'poor', missing: 8 });
    town.recordTownAnswer(lines[0], 'first', NOW);
    town.recordTownAnswer(lines[1], 'first', NOW + 1);
    expect(town.buyTownItem('flowers')).toMatchObject({ ok: false, missing: 2 });
    town.recordTownAnswer(lines[2], 'replayed', NOW + 2);
    expect(town.buyTownItem('flowers')).toMatchObject({ ok: true, balance: 0 });
    expect(town.loadTownProgress().bought).toEqual(['flowers']);
  });

  it('a purchase survives a refused save for the session', async () => {
    seed(40);
    const town = await fresh();
    failNext.add(TOWN);
    const r = town.buyTownItem('home');
    expect(r).toMatchObject({ ok: true, saved: false, balance: 20 });
    expect(town.loadTownProgress().bought).toEqual(['home']);
    expect(town.startTownConversation('home').ok).toBe(true);
    expect(stored(TOWN).bought).toEqual([]);
    expect(town.buyTownItem('lamps1')).toMatchObject({ ok: true, saved: true, balance: 10 });
    expect(stored(TOWN).bought).toEqual(['home', 'lamps1']);
  });
});

describe('town progress in backup, restore and "Xóa dữ liệu" (like pairs-progress)', () => {
  it('travels in a backup, is replaced by a restore and removed by "Xóa dữ liệu", each leaving a reset marker', async () => {
    seed(30);
    const town = await fresh();
    town.recordTownAnswer(L1, 'first', NOW);
    town.buyTownItem('home');
    const backup = exportBackup(storage, NOW);
    expect(JSON.parse(backup.data[TOWN])).toMatchObject({ lines: { [L1.id]: { best: 2, tries: 1, at: NOW } }, earned: { [DEVICE]: 33 }, bought: ['home'] });

    town.recordTownAnswer(L2, 'replayed', NOW + 1);
    town.buyTownItem('lamps1');
    const valid = validateBackup(JSON.parse(JSON.stringify(backup)));
    if (!valid.ok) throw new Error(valid.error);
    restoreBackup(storage, valid.backup, NOW + 2);
    expect(Object.keys(town.loadTownProgress().lines)).toEqual([L1.id]); // read fresh, no reload step needed
    expect(town.loadTownProgress().bought).toEqual(['home']);
    expect(stored(P + 'reset').all).toBeGreaterThanOrEqual(NOW + 2);

    clearAllData(storage, NOW + 3);
    expect(map.has(TOWN)).toBe(false);
    expect(town.loadTownProgress()).toEqual(EMPTY);
    expect(town.buyTownItem('flowers')).toMatchObject({ ok: false, reason: 'poor' });
  });
});
