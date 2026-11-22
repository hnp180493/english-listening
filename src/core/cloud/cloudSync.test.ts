// Account sync (Supabase) between two or three browsers of the same learner, against an in-memory table that keeps
// the server's rules: one global revision sequence, compare-and-swap writes, all or nothing.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearAllData, restoreBackup, validateBackup, type StorageLike } from '../backup';
import { updateCustom, type CustomSentence } from '../dictation/custom';
import { STORAGE_PREFIX } from '../storage';
import { recordKeyReset, recordTombstone } from '../syncMarkers';
import { emptyCloudMeta, parseCloudMeta, planCycle, runCloudCycle, valueHash, type CloudContext, type CloudMeta } from './cloudSync';
import { CloudError, type Change, type CloudStore, type Row, type WriteResult } from './remote';

const P = STORAGE_PREFIX;
const USER = '11111111-2222-3333-4444-555555555555';

class Mem implements StorageLike {
  map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

/** The `nna_sync` table of one user, with nna_sync_write's rules. */
class Table implements CloudStore {
  rows = new Map<string, Row>();
  seq = 100;
  clock: { t: number };
  /** test hooks */
  beforeWrite: (() => void) | null = null;
  offline = false;
  writes = 0;
  constructor(clock: { t: number }) {
    this.clock = clock;
  }
  async list() {
    if (this.offline) throw new CloudError('network', 'offline');
    return [...this.rows.values()].map(({ key, rev, updatedAt }) => ({ key, rev, updatedAt }));
  }
  async fetch(keys: string[]) {
    if (this.offline) throw new CloudError('network', 'offline');
    return keys.flatMap((k) => (this.rows.has(k) ? [{ ...this.rows.get(k)! }] : []));
  }
  async write(changes: Change[]): Promise<WriteResult> {
    if (this.offline) throw new CloudError('network', 'offline');
    const hook = this.beforeWrite;
    this.beforeWrite = null;
    hook?.();
    for (const c of changes) {
      const cur = this.rows.get(c.key);
      if (c.base === null ? cur !== undefined : cur?.rev !== c.base) return { ok: false, error: 'conflict', key: c.key };
    }
    const revs: Record<string, number> = {};
    for (const c of changes) {
      if (c.value === null) this.rows.delete(c.key);
      else {
        const rev = ++this.seq;
        this.rows.set(c.key, { key: c.key, value: c.value, rev, updatedAt: this.clock.t });
        revs[c.key] = rev;
      }
    }
    this.writes++;
    return { ok: true, revs };
  }
  /** Another app/device writes a row directly (through the same rules). */
  put(key: string, value: unknown) {
    const rev = ++this.seq;
    this.rows.set(key, { key, value: JSON.stringify(value), rev, updatedAt: this.clock.t });
  }
  get(key: string): unknown {
    const r = this.rows.get(key);
    return r ? JSON.parse(r.value) : undefined;
  }
  keys() {
    return [...this.rows.keys()].sort();
  }
}

function browser(table: Table, clock: { t: number }, userId = USER) {
  const storage = new Mem();
  let meta: CloudMeta = emptyCloudMeta();
  let changes = 0;
  const touched = () => {
    changes++;
    meta = { ...meta, dirty: true, localChangedAt: clock.t };
  };
  const ctx: CloudContext = {
    storage,
    meta: { load: () => meta, save: (m) => (meta = m) },
    store: table,
    userId,
    device: 'Test',
    now: () => clock.t,
    changeCount: () => changes,
  };
  return {
    storage,
    ctx,
    meta: () => meta,
    get: (k: string) => {
      const v = storage.getItem(P + k);
      return v == null ? null : (JSON.parse(v) as unknown);
    },
    write(k: string, v: unknown) {
      storage.setItem(P + k, JSON.stringify(v));
      touched();
    },
    remove(k: string) {
      storage.removeItem(P + k);
      touched();
    },
    act<T>(fn: (s: Mem) => T): T {
      vi.stubGlobal('window', { localStorage: storage });
      try {
        return fn(storage);
      } finally {
        vi.unstubAllGlobals();
        touched();
      }
    },
    sync: (canApply = true) => runCloudCycle(ctx, { canApply: () => canApply }),
  };
}

const lessons = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, { completedAt: 5, bestScore: 1, attempts: 1 }]));
const cs = (list: [string, string][]): CustomSentence[] => list.map(([id, text], i) => ({ id, text, vi: '', level: 1, createdAt: 100 + i }));
const log = (ids: string[], at = 10) => ({ version: 1, entries: ids.map((id) => ({ id, minutes: 5, kind: 'podcast', day: '2026-11-20', createdAt: at, updatedAt: at })) });

function setup() {
  const clock = { t: 1_800_000_000_000 };
  const table = new Table(clock);
  const A = browser(table, clock);
  const B = browser(table, clock);
  return { clock, table, A, B, tick: () => (clock.t += 1000) };
}

afterEach(() => vi.unstubAllGlobals());

describe('first connection', () => {
  it('pushes everything when the account is empty, leaving device-local keys at home', async () => {
    const { table, A } = setup();
    A.write('lessons-progress', lessons(['l1']));
    A.write('settings', { theme: 'dark', changedAt: 5 });
    A.write('listening-timer', { startedAt: 1 }); // device-local
    const r = await A.sync();
    expect(r.kind).toBe('pushed');
    expect(table.keys()).toEqual(['lessons-progress', 'settings']);
    expect(Object.keys(A.meta().base).sort()).toEqual(['lessons-progress', 'settings']);
    expect(A.meta().userId).toBe(USER);
  });

  it('a second browser with its own practice merges both instead of replacing', async () => {
    const { A, B, tick } = setup();
    A.write('lessons-progress', lessons(['l1', 'l2']));
    A.write('listening-log', log(['a1']));
    await A.sync();
    tick();
    B.write('lessons-progress', lessons(['l3']));
    B.write('listening-log', log(['b1']));
    const r = await B.sync();
    expect(r.kind).toBe('applied');
    tick();
    await A.sync();
    for (const m of [A, B]) {
      expect(Object.keys(m.get('lessons-progress') as object).sort()).toEqual(['l1', 'l2', 'l3']);
      expect((m.get('listening-log') as { entries: { id: string }[] }).entries.map((e) => e.id)).toEqual(['a1', 'b1']);
    }
  });

  it('signing in with another account is a first connection again', async () => {
    const { table, A, clock } = setup();
    A.write('lessons-progress', lessons(['l1']));
    await A.sync();
    const other = new Table(clock);
    other.put('lessons-progress', lessons(['x9']));
    A.ctx.store = other;
    A.ctx.userId = '99999999-2222-3333-4444-555555555555';
    await A.sync();
    expect(Object.keys(A.get('lessons-progress') as object).sort()).toEqual(['l1', 'x9']);
    expect(table.get('lessons-progress')).toEqual(lessons(['l1']));
  });
});

describe('steady state', () => {
  it('nothing changed: one list request, no fetch, no write', async () => {
    const { table, A } = setup();
    A.write('lessons-progress', lessons(['l1']));
    await A.sync();
    const fetch = vi.spyOn(table, 'fetch');
    const writes = table.writes;
    expect((await A.sync()).kind).toBe('noop');
    expect(fetch).not.toHaveBeenCalled();
    expect(table.writes).toBe(writes);
  });

  it('a local change goes out; the other browser takes it without merging', async () => {
    const { A, B, tick } = setup();
    A.write('lessons-progress', lessons(['l1']));
    await A.sync();
    await B.sync();
    tick();
    A.write('lessons-progress', lessons(['l1', 'l2']));
    expect((await A.sync()).kind).toBe('pushed');
    tick();
    expect((await B.sync()).kind).toBe('applied');
    expect(B.get('lessons-progress')).toEqual(lessons(['l1', 'l2']));
    expect((await B.sync()).kind).toBe('noop');
  });

  it('both changed the same key: merged with its merger, then in step everywhere', async () => {
    const { A, B, table, tick } = setup();
    A.write('listening-log', log(['a1']));
    await A.sync();
    await B.sync();
    tick();
    A.write('listening-log', log(['a1', 'a2']));
    B.write('listening-log', log(['a1', 'b2']));
    await A.sync();
    tick();
    await B.sync();
    tick();
    await A.sync();
    const ids = (v: unknown) => (v as { entries: { id: string }[] }).entries.map((e) => e.id);
    expect(ids(table.get('listening-log'))).toEqual(['a1', 'a2', 'b2']);
    expect(ids(A.get('listening-log'))).toEqual(['a1', 'a2', 'b2']);
    expect(ids(B.get('listening-log'))).toEqual(['a1', 'a2', 'b2']);
    expect((await A.sync()).kind).toBe('noop');
    expect((await B.sync()).kind).toBe('noop');
  });

  it('settings are decided by their own change time, not by who synced last', async () => {
    const { A, B, tick } = setup();
    A.write('settings', { theme: 'light', changedAt: 1 });
    await A.sync();
    await B.sync();
    tick();
    A.write('settings', { theme: 'dark', changedAt: 2 });
    await A.sync();
    tick();
    B.write('lessons-progress', lessons(['l9']));
    B.write('settings', { theme: 'light', changedAt: 1 }); // B re-saves its stale copy
    await B.sync();
    for (const m of [A, B]) {
      await m.sync();
      expect(m.get('settings')).toMatchObject({ theme: 'dark' });
    }
  });

  it('a write between read and write is never lost: the cycle reads again and merges', async () => {
    const { A, B, table, tick } = setup();
    A.write('listening-log', log(['a1']));
    await A.sync();
    await B.sync();
    tick();
    A.write('listening-log', log(['a1', 'a2']));
    // B writes after A listed the rows but before A's write lands
    table.beforeWrite = () => table.put('listening-log', log(['a1', 'b9']));
    const r = await A.sync();
    expect(r.kind).toBe('applied'); // second attempt took b9 in
    const ids = (table.get('listening-log') as { entries: { id: string }[] }).entries.map((e) => e.id);
    expect(ids).toEqual(['a1', 'a2', 'b9']);
  });

  it('keeps writing nothing while it may not change this page, and says so', async () => {
    const { A, B, table, tick } = setup();
    A.write('lessons-progress', lessons(['l1']));
    await A.sync();
    await B.sync();
    tick();
    A.write('lessons-progress', lessons(['l1', 'l2']));
    await A.sync();
    B.write('pairs-progress', { x: 1 });
    const writes = table.writes;
    expect((await B.sync(false)).kind).toBe('remote-newer');
    expect(table.writes).toBe(writes);
    expect(B.get('lessons-progress')).toEqual(lessons(['l1']));
    // the learner reloads: now it applies and writes B's change too
    expect((await B.sync(true)).kind).toBe('applied');
    expect(table.keys()).toContain('pairs-progress');
  });

  it('offline: an error, no change here, and the change goes out once back online', async () => {
    const { A, table } = setup();
    A.write('lessons-progress', lessons(['l1']));
    await A.sync();
    A.write('lessons-progress', lessons(['l1', 'l2']));
    table.offline = true;
    const r = await A.sync();
    expect(r).toMatchObject({ kind: 'error', error: 'network' });
    expect(A.get('lessons-progress')).toEqual(lessons(['l1', 'l2']));
    table.offline = false;
    expect((await A.sync()).kind).toBe('pushed');
    expect(table.get('lessons-progress')).toEqual(lessons(['l1', 'l2']));
  });

  it('ignores a remote value that is not valid JSON or not a synced key, and never deletes it', async () => {
    const { A, table } = setup();
    A.write('lessons-progress', lessons(['l1']));
    await A.sync();
    table.rows.set('drill-cards', { key: 'drill-cards', value: '{broken', rev: 999, updatedAt: 1 });
    table.rows.set('voice-ai', { key: 'voice-ai', value: 'true', rev: 1000, updatedAt: 1 });
    await A.sync();
    expect(A.get('drill-cards')).toBeNull();
    expect(A.get('voice-ai')).toBeNull();
    expect(table.keys()).toEqual(['drill-cards', 'lessons-progress', 'voice-ai']);
  });

  it('a synced settings value is sanitised like a backup import', async () => {
    const { A, table } = setup();
    table.put('settings', { theme: 'dark', voiceEngine: 'ai', changedAt: 3 });
    await A.sync();
    const s = A.get('settings') as Record<string, unknown>;
    expect(s.theme).toBe('dark');
    expect(s.voiceEngine).not.toBe('ai'); // the paid voice never travels
  });
});

describe('deletes and resets stick', () => {
  it('a key removed here is removed from the account and from the other browser', async () => {
    const { A, B, table, tick } = setup();
    A.write('onboarding', { done: true });
    A.write('lessons-progress', lessons(['l1']));
    await A.sync();
    await B.sync();
    tick();
    A.remove('onboarding');
    await A.sync();
    expect(table.keys()).toEqual(['lessons-progress']);
    tick();
    await B.sync();
    expect(B.get('onboarding')).toBeNull();
  });

  it('a deleted custom sentence does not come back from a browser that still has it', async () => {
    const { A, B, tick, clock } = setup();
    A.write('custom-sentences', cs([['u-1', 'Keep me'], ['u-2', 'Delete me']]));
    await A.sync();
    await B.sync();
    tick();
    A.act(() => recordTombstone('custom', 'u-2', clock.t));
    A.write('custom-sentences', cs([['u-1', 'Keep me']]));
    const edited = updateCustom(B.get('custom-sentences') as CustomSentence[], 'u-1', { text: 'Edited' }, undefined, clock.t - 500).list;
    B.write('custom-sentences', edited);
    await A.sync();
    tick();
    await B.sync();
    tick();
    await A.sync();
    for (const m of [A, B]) expect((m.get('custom-sentences') as CustomSentence[]).map((c) => [c.id, c.text])).toEqual([['u-1', 'Edited']]);
  });

  it('"Xóa dữ liệu" on A empties the account and B, even B\'s unsynced practice', async () => {
    const { A, B, table, tick } = setup();
    A.write('lessons-progress', lessons(['l1', 'l2']));
    A.write('settings', { theme: 'dark', changedAt: 1 });
    await A.sync();
    await B.sync();
    tick();
    B.write('lessons-progress', lessons(['l1', 'l2', 'l3'])); // offline practice on B
    tick();
    A.act((s) => clearAllData(s, 1_800_000_005_000));
    await A.sync();
    expect(table.keys()).toEqual(['reset']);
    tick();
    await B.sync();
    tick();
    await A.sync();
    for (const m of [A, B]) expect([...m.storage.map.keys()]).toEqual([P + 'reset']);
    expect(table.keys()).toEqual(['reset']);
    // practice after the reset syncs normally again
    tick();
    B.write('lessons-progress', lessons(['l7']));
    await B.sync();
    tick();
    await A.sync();
    expect(A.get('lessons-progress')).toEqual(lessons(['l7']));
  });

  it('a restored backup on A replaces B\'s copy instead of merging it back', async () => {
    const { A, B, tick, clock } = setup();
    A.write('lessons-progress', lessons(['l1']));
    await A.sync();
    await B.sync();
    tick();
    B.write('lessons-progress', lessons(['l1', 'l2']));
    await B.sync();
    tick();
    const backup = validateBackup({ app: 'nghe-noi-am', version: 1, exportedAt: '', data: { [P + 'lessons-progress']: JSON.stringify(lessons(['old'])) } });
    if (!backup.ok) throw new Error(backup.error);
    A.act((s) => restoreBackup(s, backup.backup, clock.t));
    await A.sync();
    tick();
    await B.sync();
    for (const m of [A, B]) expect(Object.keys(m.get('lessons-progress') as object)).toEqual(['old']);
  });

  it('"Xóa lịch sử" (per-key reset) drops only those keys elsewhere', async () => {
    const { A, B, tick, clock } = setup();
    A.write('stats', { attempts: [{ at: 1, phenomena: ['linking'], correct: true }], activeDays: ['2026-11-20'] });
    A.write('lessons-progress', lessons(['l1']));
    await A.sync();
    await B.sync();
    tick();
    A.act(() => recordKeyReset(['stats'], clock.t));
    A.remove('stats');
    await A.sync();
    tick();
    await B.sync();
    expect(B.get('stats')).toBeNull();
    expect(B.get('lessons-progress')).toEqual(lessons(['l1']));
  });
});

describe('bookkeeping', () => {
  it('parseCloudMeta survives garbage and keeps only valid entries', () => {
    expect(parseCloudMeta(null)).toEqual(emptyCloudMeta());
    expect(parseCloudMeta('{bad')).toEqual(emptyCloudMeta());
    const m = parseCloudMeta(JSON.stringify({ userId: USER, base: { ok: { rev: 3, hash: 'h' }, 'Bad Key': { rev: 1, hash: 'x' }, n: { rev: 'x' } }, dirty: true }));
    expect(m.base).toEqual({ ok: { rev: 3, hash: 'h' } });
    expect(m.userId).toBe(USER);
    expect(m.dirty).toBe(true);
  });

  it('planCycle: unchanged remote + unchanged local = no changes', () => {
    const v = JSON.stringify(lessons(['l1']));
    const meta: CloudMeta = { ...emptyCloudMeta(), userId: USER, base: { 'lessons-progress': { rev: 7, hash: valueHash(v) } } };
    const plan = planCycle({ 'lessons-progress': v }, [{ key: 'lessons-progress', rev: 7, updatedAt: 0 }], new Map(), meta, USER);
    expect(plan.changes).toEqual([]);
    expect(plan.merged).toEqual({ [P + 'lessons-progress']: v });
  });

  it('a failed write keeps the old base, so the change is retried', async () => {
    const { A, table } = setup();
    A.write('lessons-progress', lessons(['l1']));
    await A.sync();
    const before = A.meta().base['lessons-progress'];
    A.write('lessons-progress', lessons(['l1', 'l2']));
    vi.spyOn(table, 'write').mockRejectedValueOnce(new CloudError('network', 'x'));
    expect((await A.sync()).kind).toBe('error');
    expect(A.meta().base['lessons-progress']).toEqual(before);
    expect(A.meta().dirty).toBe(true);
    expect((await A.sync()).kind).toBe('pushed');
    expect(table.get('lessons-progress')).toEqual(lessons(['l1', 'l2']));
  });
});
