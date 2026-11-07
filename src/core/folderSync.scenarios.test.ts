// Two (or three) machines syncing through one folder, as in normal use: the red-team scenarios of 2026-11-07.
// Each machine has its own storage and bookkeeping; app writes go through the real helpers where they exist.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearAllData, importBackup, restoreBackup, validateBackup, type StorageLike } from './backup';
import { updateCustom, type CustomSentence } from './dictation/custom';
import { defaultMeta, runCycle, type SyncContext, type SyncFolder, type SyncMeta } from './folderSync';
import { STORAGE_PREFIX } from './storage';
import { recordKeyReset, recordTombstone } from './syncMarkers';

const P = STORAGE_PREFIX;

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

class Folder implements SyncFolder {
  name = 'F';
  content: string | null = null;
  async read() {
    return this.content;
  }
  async write(t: string) {
    this.content = t;
  }
  keys() {
    return Object.keys(JSON.parse(this.content ?? '{"data":{}}').data as object).sort();
  }
}

function machine(id: string, folder: Folder, clock: { t: number }) {
  const storage = new Mem();
  let meta: SyncMeta = defaultMeta(id);
  let changes = 0;
  const touched = () => {
    changes++;
    meta = { ...meta, dirty: true, localChangedAt: clock.t };
  };
  const ctx: SyncContext = { storage, meta: { load: () => meta, save: (m) => (meta = m) }, now: () => clock.t, changeCount: () => changes };
  /** Run an app helper that writes through window.localStorage against this machine's storage. */
  const asWindow = <T,>(fn: () => T): T => {
    vi.stubGlobal('window', { localStorage: storage });
    try {
      return fn();
    } finally {
      vi.unstubAllGlobals();
    }
  };
  return {
    storage,
    get: (k: string) => {
      const v = storage.getItem(P + k);
      return v == null ? null : (JSON.parse(v) as unknown);
    },
    write(k: string, v: unknown) {
      storage.setItem(P + k, JSON.stringify(v));
      touched();
    },
    act<T>(fn: (s: Mem) => T): T {
      const r = asWindow(() => fn(storage));
      touched();
      return r;
    },
    sync: (first = false) => runCycle(folder, ctx, { canApply: () => true, onFirstConnect: 'merge', firstConnect: first }),
  };
}

const lessons = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, { completedAt: 5, bestScore: 1, attempts: 1 }]));
const cs = (list: [string, string][]): CustomSentence[] => list.map(([id, text], i) => ({ id, text, vi: '', level: 1, createdAt: 100 + i }));

async function pair() {
  const folder = new Folder();
  const clock = { t: 1_800_000_000_000 };
  const A = machine('d-aaaa', folder, clock);
  const B = machine('d-bbbb', folder, clock);
  return { folder, clock, A, B, tick: () => (clock.t += 1000) };
}

afterEach(() => vi.unstubAllGlobals());

describe('edits are decided by when that value changed, not by which machine wrote last', () => {
  it('settings changed on A survive unrelated practice on B', async () => {
    const { A, B, tick } = await pair();
    A.write('settings', { theme: 'light', reviewMinutes: 10, changedAt: 1 });
    await A.sync(true);
    tick();
    await B.sync(true);
    tick();
    A.write('settings', { theme: 'dark', reviewMinutes: 20, changedAt: 2 });
    await A.sync();
    tick();
    B.write('lessons-progress', lessons(['l9'])); // B practises later, before its own sync
    tick();
    await B.sync();
    tick();
    await A.sync();
    for (const m of [A, B]) expect(m.get('settings')).toMatchObject({ theme: 'dark', reviewMinutes: 20 });
    expect(A.get('lessons-progress')).toMatchObject({ l9: {} });
  });

  it('a custom sentence edited on A survives B changing something else later', async () => {
    const { A, B, tick, clock } = await pair();
    A.write('custom-sentences', cs([['u-1', 'Old text']]));
    await A.sync(true);
    tick();
    await B.sync(true);
    tick();
    const edited = updateCustom(A.get('custom-sentences') as CustomSentence[], 'u-1', { text: 'Edited text' }, undefined, clock.t).list;
    A.write('custom-sentences', edited);
    tick();
    await A.sync();
    tick();
    B.write('lessons-progress', lessons(['l9']));
    tick();
    await B.sync();
    tick();
    await A.sync();
    for (const m of [A, B]) expect((m.get('custom-sentences') as CustomSentence[]).map((c) => c.text)).toEqual(['Edited text']);
  });
});

describe('deletes stick', () => {
  it('a deleted custom sentence does not come back from a machine that still has it', async () => {
    const { A, B, tick } = await pair();
    A.write('custom-sentences', cs([['u-1', 'Keep me'], ['u-2', 'Delete me']]));
    await A.sync(true);
    tick();
    await B.sync(true);
    tick();
    A.act(() => recordTombstone('custom', 'u-2'));
    A.write('custom-sentences', cs([['u-1', 'Keep me']]));
    tick();
    B.write('lessons-progress', lessons(['l9']));
    tick();
    await A.sync();
    tick();
    await B.sync();
    tick();
    await A.sync();
    for (const m of [A, B]) expect((m.get('custom-sentences') as CustomSentence[]).map((c) => c.id)).toEqual(['u-1']);
  });

  it('a deleted media item does not come back', async () => {
    const { A, B, tick } = await pair();
    A.write('media-library', { items: [{ id: 'm1', title: 'x', createdAt: 1, openedAt: 1, units: [], progress: { done: [], scores: {} } }], prefs: {} });
    await A.sync(true);
    tick();
    await B.sync(true);
    tick();
    A.act(() => recordTombstone('media', 'm1'));
    A.write('media-library', { items: [], prefs: {} });
    tick();
    B.write('lessons-progress', lessons(['l9']));
    await B.sync();
    tick();
    await A.sync();
    tick();
    await B.sync();
    for (const m of [A, B]) expect((m.get('media-library') as { items: unknown[] }).items).toEqual([]);
  });

  it('"Xóa dữ liệu" on A empties B even when B has unsynced practice (the confirm text promises it)', async () => {
    const { A, B, folder, tick } = await pair();
    A.write('lessons-progress', lessons(['l1', 'l2']));
    A.write('settings', { theme: 'dark', changedAt: 1 });
    await A.sync(true);
    tick();
    await B.sync(true);
    tick();
    B.write('lessons-progress', lessons(['l1', 'l2', 'l3'])); // offline practice on B
    tick();
    A.act((s) => clearAllData(s));
    await A.sync();
    expect(folder.keys()).toEqual([P + 'reset']);
    tick();
    await B.sync();
    tick();
    await A.sync();
    for (const m of [A, B]) expect([...m.storage.map.keys()]).toEqual([P + 'reset']);
    expect(folder.keys()).toEqual([P + 'reset']);
    // practice after the reset syncs normally again
    tick();
    B.write('lessons-progress', lessons(['l7']));
    await B.sync();
    tick();
    await A.sync();
    expect(A.get('lessons-progress')).toEqual(lessons(['l7']));
  });

  it('restoring a backup on A wins over B instead of being merged back', async () => {
    const { A, B, folder, tick } = await pair();
    A.write('lessons-progress', lessons(['l1']));
    await A.sync(true);
    tick();
    await B.sync(true);
    tick();
    A.write('lessons-progress', lessons(['l1', 'l2']));
    await A.sync();
    tick();
    B.write('pairs-progress', { items: {}, sets: {} }); // B dirty, never saw the restore
    const backup = validateBackup({ app: 'nghe-noi-am', version: 1, exportedAt: '', data: { [P + 'lessons-progress']: JSON.stringify(lessons(['l1'])) } });
    if (!backup.ok) throw new Error(backup.error);
    tick();
    A.act((s) => restoreBackup(s, backup.backup));
    await A.sync();
    tick();
    await B.sync();
    tick();
    await A.sync();
    for (const m of [A, B]) {
      expect(m.get('lessons-progress')).toEqual(lessons(['l1']));
      expect(m.get('pairs-progress')).toBeNull();
    }
    expect(JSON.parse(JSON.parse(folder.content!).data[P + 'lessons-progress'])).toEqual(lessons(['l1']));
  });

  it('"Xóa lịch sử luyện tập" on A drops only B\'s older practice history', async () => {
    const { A, B, tick } = await pair();
    const st = (n: number) => ({ attempts: Array.from({ length: n }, (_, i) => ({ at: 10 + i, module: 'dictation', itemId: 's' + i, seen: [], missed: [] })), byPhenomenon: {}, activeDays: ['2026-11-01'] });
    A.write('stats', st(3));
    A.write('lessons-progress', lessons(['l1']));
    await A.sync(true);
    tick();
    await B.sync(true);
    tick();
    B.write('stats', st(5));
    B.write('lessons-progress', lessons(['l1', 'l2']));
    tick();
    A.act(() => recordKeyReset(['stats']));
    A.write('stats', { attempts: [], byPhenomenon: {}, activeDays: [] });
    await A.sync();
    tick();
    await B.sync();
    tick();
    await A.sync();
    for (const m of [A, B]) {
      expect((m.get('stats') as { attempts: unknown[] }).attempts).toEqual([]);
      expect(m.get('lessons-progress')).toEqual(lessons(['l1', 'l2']));
    }
  });

  it('a first connection with "Gộp" combines both copies, even over a reset marker', async () => {
    const { A, folder, clock, tick } = await pair();
    A.write('lessons-progress', lessons(['l1']));
    await A.sync(true);
    tick();
    A.act((s) => clearAllData(s));
    await A.sync();
    tick();
    const C = machine('d-cccc', folder, clock); // a new computer with its own progress
    C.write('lessons-progress', lessons(['c1']));
    await C.sync(true);
    expect(C.get('lessons-progress')).toEqual(lessons(['c1']));
    // the marker stays in the folder for machines that still hold pre-reset data
    expect(folder.keys()).toEqual([P + 'lessons-progress', P + 'reset']);
  });
});

describe('the paid AI voice never arrives through sync or a backup', () => {
  it("an 'ai' in another machine's settings (older build) arrives as 'clips'", async () => {
    const { A, B, tick } = await pair();
    A.write('lessons-progress', lessons(['l1']));
    await A.sync(true);
    tick();
    await B.sync(true);
    tick();
    // older build on A: wrote 'ai' into the synced settings
    A.write('settings', { voiceEngine: 'ai', voiceChosen: true, changedAt: 5 });
    await A.sync();
    tick();
    B.write('lessons-progress', lessons(['l1', 'l2'])); // B dirty: merge path
    await B.sync();
    expect(B.get('settings')).toMatchObject({ voiceEngine: 'clips', voiceChosen: true });
    // a new machine pulling the file, and a backup import
    const { folder, clock } = await pair();
    folder.content = JSON.stringify({
      app: 'nghe-noi-am',
      version: 1,
      exportedAt: '',
      sync: { savedAt: 5, device: 'd-old' },
      data: { [P + 'settings']: JSON.stringify({ voiceEngine: 'ai', voiceChosen: true }) },
    });
    const C = machine('d-cccc', folder, clock);
    expect((await C.sync(true)).kind).toBe('applied');
    expect(C.get('settings')).toEqual({ voiceEngine: 'clips', voiceChosen: true });
    const imported = validateBackup({ app: 'nghe-noi-am', version: 1, exportedAt: '', data: { [P + 'settings']: JSON.stringify({ voiceEngine: 'ai', voiceChosen: true }) } });
    if (!imported.ok) throw new Error(imported.error);
    importBackup(C.storage, imported.backup);
    expect(C.get('settings')).toEqual({ voiceEngine: 'clips', voiceChosen: true });
  });
});
