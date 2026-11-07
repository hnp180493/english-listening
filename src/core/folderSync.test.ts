import { describe, expect, it, vi } from 'vitest';
import { serializeBackup, validateBackup, type StorageLike } from './backup';
import {
  buildSyncFile,
  dataHash,
  decideSync,
  isConflictCopyName,
  LINEAGE_MAX,
  startupWindow,
  defaultMeta,
  deviceLabelFrom,
  parseMeta,
  parseSyncFile,
  runCycle,
  serializeSyncFile,
  SYNC_META_KEY,
  type CycleOptions,
  type SyncContext,
  type SyncFolder,
  type SyncMeta,
} from './folderSync';
import { STORAGE_PREFIX } from './storage';

class MemoryStorage implements StorageLike {
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

class FakeFolder implements SyncFolder {
  name = 'NgheNoiAm';
  content: string | null = null;
  writes = 0;
  readError: Error | null = null;
  writeError: Error | null = null;
  /** Other files in the folder (OneDrive conflict copies and anything else). */
  others = new Map<string, string>();
  removeError: Error | null = null;
  async listConflicts() {
    return [...this.others].filter(([name]) => isConflictCopyName(name)).map(([name, text]) => ({ name, text }));
  }
  async removeConflict(name: string) {
    if (this.removeError) throw this.removeError;
    this.others.delete(name);
  }
  async read() {
    if (this.readError) throw this.readError;
    return this.content;
  }
  async write(text: string) {
    if (this.writeError) throw this.writeError;
    this.writes++;
    this.content = text;
  }
  json() {
    return JSON.parse(this.content ?? 'null');
  }
}

const K = (k: string) => STORAGE_PREFIX + k;
const stats = (...ats: number[]) =>
  JSON.stringify({
    attempts: ats.map((at) => ({ at, module: 'dictation', itemId: 's' + at, correct: true, seen: ['linking'], missed: [] })),
    byPhenomenon: { linking: { seen: ats.length, missed: 0 } },
    activeDays: ['2026-11-06'],
  });

function setup(meta: Partial<SyncMeta> = {}, now = 10_000) {
  const storage = new MemoryStorage();
  const folder = new FakeFolder();
  let m: SyncMeta = { ...defaultMeta('d-local'), ...meta };
  let counter = 0;
  const ctx: SyncContext = {
    storage,
    meta: { load: () => ({ ...m }), save: (x) => (m = { ...x }) },
    now: () => now,
    deviceLabel: 'Edge · Windows',
    changeCount: () => counter,
  };
  return {
    storage,
    folder,
    ctx,
    meta: () => m,
    bump: () => counter++,
  };
}

/** A folder file as another machine would have written it. */
function remoteFile(data: Record<string, string>, savedAt: number, device = 'd-other', lineage: number[] = []) {
  const s = new MemoryStorage();
  for (const [k, v] of Object.entries(data)) s.setItem(k, v);
  return serializeSyncFile(buildSyncFile(s, { savedAt, device, deviceLabel: 'Chrome · Windows', lineage }));
}

const bg: CycleOptions = { canApply: () => true, onFirstConnect: 'merge' };

describe('decideSync', () => {
  const base = { fileHasData: true, localHasData: true, dirty: false, fileDescends: true };
  it.each([
    [{ ...base, fileSavedAt: null, lastSyncedSavedAt: 5 }, 'push'],
    [{ ...base, fileSavedAt: null, lastSyncedSavedAt: null }, 'push'],
    [{ ...base, fileSavedAt: 5, lastSyncedSavedAt: null }, 'ask'],
    [{ ...base, fileSavedAt: 5, lastSyncedSavedAt: null, localHasData: false }, 'pull'],
    [{ ...base, fileSavedAt: 5, lastSyncedSavedAt: null, fileHasData: false }, 'push'],
    [{ ...base, fileSavedAt: 5, lastSyncedSavedAt: 5 }, 'noop'],
    [{ ...base, fileSavedAt: 5, lastSyncedSavedAt: 5, dirty: true }, 'push'],
    [{ ...base, fileSavedAt: 9, lastSyncedSavedAt: 5 }, 'pull'],
    [{ ...base, fileSavedAt: 9, lastSyncedSavedAt: 5, dirty: true }, 'merge'],
    // written without seeing this browser's last sync (OneDrive kept the other copy): never replace
    [{ ...base, fileSavedAt: 9, lastSyncedSavedAt: 5, fileDescends: false }, 'merge'],
    [{ ...base, fileSavedAt: 3, lastSyncedSavedAt: 5 }, 'merge'],
  ] as const)('%o → %s', (input, expected) => {
    expect(decideSync(input)).toBe(expected);
  });
});

describe('file format', () => {
  it('round-trips and stays importable as a normal backup', () => {
    const s = new MemoryStorage();
    s.setItem(K('stats'), stats(1));
    s.setItem('unrelated', 'x');
    const text = serializeSyncFile(buildSyncFile(s, { savedAt: 1234, device: 'd-abc', deviceLabel: 'Edge · Windows' }));
    const parsed = parseSyncFile(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.file.sync).toEqual({ savedAt: 1234, device: 'd-abc', deviceLabel: 'Edge · Windows', lineage: [1234] });
    expect(parsed.file.data).toEqual({ [K('stats')]: stats(1) });
    expect(validateBackup(text).ok).toBe(true); // manual "Nhập bản sao lưu" accepts the sync file
  });

  it('accepts an old backup without sync (savedAt from exportedAt) and an empty data file', () => {
    const old = serializeBackup({ app: 'nghe-noi-am', version: 1, exportedAt: '2026-01-02T03:04:05.000Z', data: { [K('x')]: '1' } });
    const p = parseSyncFile(old);
    expect(p.ok && p.file.sync.savedAt).toBe(Date.parse('2026-01-02T03:04:05.000Z'));
    const empty = JSON.stringify({ app: 'nghe-noi-am', version: 1, exportedAt: '', sync: { savedAt: 7, device: 'd-x' }, data: {} });
    expect(parseSyncFile(empty).ok).toBe(true);
    expect(validateBackup(empty).ok).toBe(false); // manual import still refuses an empty backup
  });

  it('rejects broken or foreign files with a Vietnamese message', () => {
    const bad = parseSyncFile('{"app":"nghe-noi-am",');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.error).toMatch(/JSON/);
    expect(parseSyncFile(JSON.stringify({ app: 'other', version: 1, data: {} })).ok).toBe(false);
  });

  it('meta parsing repairs junk and keeps the device id', () => {
    expect(parseMeta(null, () => 'd-new')).toEqual(defaultMeta('d-new'));
    expect(parseMeta('{bad', () => 'd-new').device).toBe('d-new');
    const m = parseMeta(JSON.stringify({ device: 'd-keep', lastSyncedSavedAt: 5, dirty: true, folderName: 'X' }), () => 'd-new');
    expect(m).toMatchObject({ device: 'd-keep', lastSyncedSavedAt: 5, dirty: true, folderName: 'X' });
    expect(SYNC_META_KEY.startsWith(STORAGE_PREFIX)).toBe(false); // never part of the synced data
  });

  it('labels the device', () => {
    const edge = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0';
    expect(deviceLabelFrom(edge)).toBe('Edge · Windows');
    expect(deviceLabelFrom('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605 Version/17 Safari/605')).toBe('Safari · macOS');
  });
});

describe('runCycle', () => {
  it('creates the file when the folder has none', async () => {
    const t = setup();
    t.storage.setItem(K('stats'), stats(1));
    const r = await runCycle(t.folder, t.ctx, { ...bg, firstConnect: true });
    expect(r).toEqual({ kind: 'pushed', savedAt: 10_000 });
    expect(t.folder.json().sync).toMatchObject({ savedAt: 10_000, device: 'd-local' });
    expect(t.folder.json().data[K('stats')]).toBe(stats(1));
    expect(t.meta()).toMatchObject({ lastSyncedSavedAt: 10_000, dirty: false, folderName: 'NgheNoiAm' });
  });

  it('first connect with data on both sides asks, then pulls or merges as chosen', async () => {
    const t = setup();
    t.storage.setItem(K('stats'), stats(1));
    t.folder.content = remoteFile({ [K('stats')]: stats(2) }, 5000);
    const ask = await runCycle(t.folder, t.ctx, { canApply: () => true, onFirstConnect: 'ask', firstConnect: true });
    expect(ask.kind).toBe('ask');
    expect(t.storage.getItem(K('stats'))).toBe(stats(1));

    const merged = await runCycle(t.folder, t.ctx, { ...bg, firstConnect: true, force: 'merge' });
    expect(merged).toMatchObject({ kind: 'applied', how: 'merge', localChanged: true });
    expect(JSON.parse(t.storage.getItem(K('stats'))!).attempts).toHaveLength(2);
    expect(JSON.parse(t.folder.json().data[K('stats')]).attempts).toHaveLength(2);
    expect(t.folder.json().sync.savedAt).toBeGreaterThan(5000);
    expect(t.meta().dirty).toBe(false);
  });

  it('"use folder data" replaces local data and returns the previous data for undo', async () => {
    const t = setup();
    t.storage.setItem(K('stats'), stats(1));
    t.storage.setItem(K('only-here'), '1');
    t.folder.content = remoteFile({ [K('stats')]: stats(2) }, 5000);
    const r = await runCycle(t.folder, t.ctx, { ...bg, firstConnect: true, force: 'pull' });
    expect(r).toMatchObject({ kind: 'applied', how: 'pull', savedAt: 5000 });
    if (r.kind === 'applied') expect(r.previous[K('only-here')]).toBe('1');
    expect(t.storage.getItem(K('only-here'))).toBeNull();
    expect(t.storage.getItem(K('stats'))).toBe(stats(2));
    expect(t.folder.writes).toBe(0);
    expect(t.meta()).toMatchObject({ lastSyncedSavedAt: 5000, dirty: false });
  });

  it('newer file and no local changes: pulls', async () => {
    const t = setup({ lastSyncedSavedAt: 4000 });
    t.storage.setItem(K('stats'), stats(1));
    t.folder.content = remoteFile({ [K('stats')]: stats(1, 2) }, 5000, 'd-other', [4000]);
    const r = await runCycle(t.folder, t.ctx, bg);
    expect(r).toMatchObject({ kind: 'applied', how: 'pull', localChanged: true });
    expect(t.storage.getItem(K('stats'))).toBe(stats(1, 2));
  });

  it('newer file and local changes: merges and writes back, nothing lost', async () => {
    const t = setup({ lastSyncedSavedAt: 4000, dirty: true, localChangedAt: 4500 });
    t.storage.setItem(K('stats'), stats(1, 3));
    t.storage.setItem(K('settings'), JSON.stringify({ rate: 0.8 }));
    t.folder.content = remoteFile({ [K('stats')]: stats(1, 2), [K('settings')]: JSON.stringify({ rate: 1.2 }) }, 5000);
    const r = await runCycle(t.folder, t.ctx, bg);
    expect(r).toMatchObject({ kind: 'applied', how: 'merge' });
    const local = JSON.parse(t.storage.getItem(K('stats'))!);
    expect(local.attempts.map((a: { at: number }) => a.at)).toEqual([1, 2, 3]);
    expect(JSON.parse(t.storage.getItem(K('settings'))!)).toEqual({ rate: 1.2 }); // file saved after the local change
    expect(t.folder.json().data[K('stats')]).toBe(t.storage.getItem(K('stats')));
    expect(t.meta().dirty).toBe(false);
  });

  it('never replaces local data while not allowed (page already open)', async () => {
    const t = setup({ lastSyncedSavedAt: 4000, dirty: true });
    t.storage.setItem(K('stats'), stats(1));
    const remote = remoteFile({ [K('stats')]: stats(2) }, 5000);
    t.folder.content = remote;
    const r = await runCycle(t.folder, t.ctx, { canApply: () => false, onFirstConnect: 'merge' });
    expect(r).toEqual({ kind: 'remote-newer' });
    expect(t.storage.getItem(K('stats'))).toBe(stats(1));
    expect(t.folder.content).toBe(remote);
    expect(t.meta().dirty).toBe(true);
  });

  it('a broken folder file is reported and never overwritten', async () => {
    const t = setup({ lastSyncedSavedAt: 4000, dirty: true });
    t.storage.setItem(K('stats'), stats(1));
    t.folder.content = '{"app":"nghe-noi-am", trunc';
    const r = await runCycle(t.folder, t.ctx, bg);
    expect(r).toMatchObject({ kind: 'error', stage: 'parse' });
    expect(t.folder.content).toBe('{"app":"nghe-noi-am", trunc');
    expect(t.storage.getItem(K('stats'))).toBe(stats(1));
  });

  it('read and write failures leave everything as it was', async () => {
    const t = setup({ lastSyncedSavedAt: 4000, dirty: true });
    t.storage.setItem(K('stats'), stats(1));
    t.folder.readError = Object.assign(new Error('x'), { name: 'NotFoundError' });
    const r1 = await runCycle(t.folder, t.ctx, bg);
    expect(r1).toMatchObject({ kind: 'error', stage: 'read' });
    if (r1.kind === 'error') expect(r1.message).toMatch(/Không tìm thấy thư mục/);

    t.folder.readError = null;
    t.folder.content = remoteFile({ [K('stats')]: stats(1) }, 4000);
    t.storage.setItem(K('stats'), stats(1, 2));
    t.folder.writeError = Object.assign(new Error('x'), { name: 'NotAllowedError' });
    const r2 = await runCycle(t.folder, t.ctx, bg);
    expect(r2).toMatchObject({ kind: 'error', stage: 'write' });
    expect(t.meta()).toMatchObject({ dirty: true, lastSyncedSavedAt: 4000 });
  });

  it('pushes local changes with a savedAt newer than the file even when this clock is behind', async () => {
    const t = setup({ lastSyncedSavedAt: 50_000, dirty: true }, 10_000);
    t.storage.setItem(K('stats'), stats(1, 2));
    t.folder.content = remoteFile({ [K('stats')]: stats(1) }, 50_000);
    const r = await runCycle(t.folder, t.ctx, bg);
    expect(r).toEqual({ kind: 'pushed', savedAt: 50_001 });
    expect(t.meta()).toMatchObject({ lastSyncedSavedAt: 50_001, dirty: false });
  });

  it('does not rewrite the file when nothing actually changed', async () => {
    const t = setup({ lastSyncedSavedAt: 4000, dirty: true });
    t.storage.setItem(K('stats'), stats(1));
    t.folder.content = remoteFile({ [K('stats')]: stats(1) }, 4000);
    expect(await runCycle(t.folder, t.ctx, bg)).toEqual({ kind: 'noop' });
    expect(t.folder.writes).toBe(0);
    expect(t.meta().dirty).toBe(false);
  });

  it('stays dirty when the learner saved something while the file was being written', async () => {
    const t = setup({ lastSyncedSavedAt: 4000, dirty: true });
    t.storage.setItem(K('stats'), stats(1, 2));
    t.folder.content = remoteFile({ [K('stats')]: stats(1) }, 4000);
    const write = t.folder.write.bind(t.folder);
    t.folder.write = async (text: string) => {
      t.bump(); // a saveJSON happened meanwhile
      await write(text);
    };
    const r = await runCycle(t.folder, t.ctx, bg);
    expect(r.kind).toBe('pushed');
    expect(t.meta().dirty).toBe(true);
  });

  it('nothing to do when in step', async () => {
    const t = setup({ lastSyncedSavedAt: 4000 });
    t.storage.setItem(K('stats'), stats(1));
    t.folder.content = remoteFile({ [K('stats')]: stats(1) }, 4000);
    expect(await runCycle(t.folder, t.ctx, bg)).toEqual({ kind: 'noop' });
    expect(t.folder.writes).toBe(0);
  });
});

describe('storage write notifications (marks local data dirty)', () => {
  it('fires after successful saves and removals only', async () => {
    const { vi } = await import('vitest');
    const map = new Map<string, string>();
    let blocked = false;
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => {
          if (blocked) throw new Error('QuotaExceededError');
          map.set(k, v);
        },
        removeItem: (k: string) => void map.delete(k),
      },
    });
    try {
      const { onAppWrite, saveJSON, removeKey } = await import('./storage');
      const seen: string[] = [];
      const off = onAppWrite((k) => seen.push(k));
      onAppWrite(() => {
        throw new Error('a broken listener must not break saving');
      });
      expect(saveJSON('stats', { a: 1 })).toBe(true);
      removeKey('stats');
      blocked = true;
      expect(saveJSON('stats', { a: 2 })).toBe(false);
      off();
      blocked = false;
      saveJSON('stats', { a: 3 });
      expect(seen).toEqual(['stats', 'stats']);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

// ───────────────────────── multi-machine scenarios (review fixes) ─────────────────────────

const attemptsOf = (raw: string | null | undefined) =>
  (JSON.parse(raw ?? '{"attempts":[]}') as { attempts: { at: number }[] }).attempts.map((a) => a.at);

describe('folder file edge cases', () => {
  it('an empty data file (creating it failed half way) counts as no file, not as a broken one', async () => {
    const t = setup({ lastSyncedSavedAt: 4000, dirty: true });
    t.storage.setItem(K('stats'), stats(1));
    t.folder.content = '';
    const r = await runCycle(t.folder, t.ctx, bg);
    expect(r.kind).toBe('pushed');
    expect(attemptsOf(t.folder.json().data[K('stats')])).toEqual([1]);
  });

  it('a browser with no data never creates the folder file (a new computer may connect before OneDrive downloaded it)', async () => {
    const t = setup();
    const r = await runCycle(t.folder, t.ctx, { ...bg, firstConnect: true });
    expect(r).toEqual({ kind: 'noop' });
    expect(t.folder.writes).toBe(0);
    expect(t.folder.content).toBeNull();
    // OneDrive then brings the other computer's file: it is taken as is.
    t.folder.content = remoteFile({ [K('stats')]: stats(1, 2) }, 5000);
    const r2 = await runCycle(t.folder, t.ctx, bg);
    expect(r2).toMatchObject({ kind: 'applied', how: 'pull' });
    expect(attemptsOf(t.storage.getItem(K('stats')))).toEqual([1, 2]);
  });

  it('parses and caps the lineage, ignoring junk', () => {
    const many = Array.from({ length: LINEAGE_MAX + 50 }, (_, i) => i + 1);
    const text = JSON.stringify({
      app: 'nghe-noi-am',
      version: 1,
      exportedAt: '',
      sync: { savedAt: 9999, device: 'd-x', lineage: [...many, 'x', -5, null] },
      data: {},
    });
    const p = parseSyncFile(text);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(p.file.sync.lineage).toHaveLength(LINEAGE_MAX);
    expect(p.file.sync.lineage?.at(-1)).toBe(LINEAGE_MAX + 50);
  });
});

describe('replacing local data only when nothing can be lost', () => {
  it('a newer file written without seeing this browser\'s last write is merged, not taken', async () => {
    // B pushed 6000 (attempt 3); OneDrive then kept A's version written from 5000 (attempt 2).
    const t = setup({ lastSyncedSavedAt: 6000 });
    t.storage.setItem(K('stats'), stats(1, 3));
    t.ctx.meta.save({ ...t.meta(), syncedHash: dataHash({ [K('stats')]: stats(1, 3) }) });
    t.folder.content = remoteFile({ [K('stats')]: stats(1, 2) }, 7000, 'd-a', [5000]);
    const r = await runCycle(t.folder, t.ctx, bg);
    expect(r).toMatchObject({ kind: 'applied', how: 'merge' });
    expect(attemptsOf(t.storage.getItem(K('stats')))).toEqual([1, 2, 3]);
    expect(attemptsOf(t.folder.json().data[K('stats')])).toEqual([1, 2, 3]);
  });

  it('local changes are detected from the data itself when the dirty flag was lost', async () => {
    const synced = { [K('stats')]: stats(1) };
    const t = setup({ lastSyncedSavedAt: 4000, dirty: false, syncedHash: dataHash(synced) });
    t.storage.setItem(K('stats'), stats(1, 3)); // practised; the flag never reached the bookkeeping
    t.folder.content = remoteFile({ [K('stats')]: stats(1, 2) }, 5000, 'd-a', [4000]);
    const r = await runCycle(t.folder, t.ctx, bg);
    expect(r).toMatchObject({ kind: 'applied', how: 'merge' });
    expect(attemptsOf(t.storage.getItem(K('stats')))).toEqual([1, 2, 3]);

    // In step with the file but the flag lost: still written to the folder.
    const t2 = setup({ lastSyncedSavedAt: 4000, dirty: false, syncedHash: dataHash(synced) });
    t2.storage.setItem(K('stats'), stats(1, 3));
    t2.folder.content = remoteFile(synced, 4000);
    expect((await runCycle(t2.folder, t2.ctx, bg)).kind).toBe('pushed');
    expect(attemptsOf(t2.folder.json().data[K('stats')])).toEqual([1, 3]);
  });

  it('a pushed file lists its ancestors, so a browser in step with an older one may take it', async () => {
    const a = setup({ lastSyncedSavedAt: 4000, dirty: true }, 8000);
    a.storage.setItem(K('stats'), stats(1, 2));
    a.folder.content = remoteFile({ [K('stats')]: stats(1) }, 4000, 'd-x', [3000]);
    await runCycle(a.folder, a.ctx, bg);
    expect(a.folder.json().sync.lineage).toEqual([3000, 4000, 8000]);
    expect(a.meta().syncedHash).toBe(dataHash({ [K('stats')]: stats(1, 2) }));

    const b = setup({ lastSyncedSavedAt: 4000, syncedHash: dataHash({ [K('stats')]: stats(1) }) });
    b.storage.setItem(K('stats'), stats(1));
    b.folder.content = a.folder.content;
    expect(await runCycle(b.folder, b.ctx, bg)).toMatchObject({ kind: 'applied', how: 'pull' });
    expect(b.meta()).toMatchObject({ lastSyncedSavedAt: 8000, dirty: false, syncedHash: dataHash({ [K('stats')]: stats(1, 2) }) });
  });

  it('"Xóa dữ liệu" on one computer still empties a computer that had no changes of its own', async () => {
    const t = setup({ lastSyncedSavedAt: 4000, syncedHash: dataHash({ [K('stats')]: stats(1) }) });
    t.storage.setItem(K('stats'), stats(1));
    t.folder.content = remoteFile({}, 5000, 'd-a', [4000]);
    expect(await runCycle(t.folder, t.ctx, bg)).toMatchObject({ kind: 'applied', how: 'pull' });
    expect(t.storage.length).toBe(0);
  });
});

describe('OneDrive conflict copies', () => {
  it('folds a conflict copy into the data file, deletes it, and both computers end up with everything', async () => {
    // Both started from 5000. B wrote 6000 (attempt 3), A wrote 7000 (attempt 2); OneDrive kept
    // A's as the data file and renamed B's.
    const bFile = remoteFile({ [K('stats')]: stats(1, 3) }, 6000, 'd-b', [5000]);
    const aFile = remoteFile({ [K('stats')]: stats(1, 2) }, 7000, 'd-a', [5000]);

    const b = setup({ lastSyncedSavedAt: 6000, syncedHash: dataHash({ [K('stats')]: stats(1, 3) }) }, 9000);
    b.storage.setItem(K('stats'), stats(1, 3));
    b.folder.content = aFile;
    b.folder.others.set('nghe-noi-am-data-LAPTOP-B.json', bFile);
    b.folder.others.set('nghe-noi-am-backup-2026-11-01.json', bFile); // a manual backup: not touched

    // Page already open: the folder is repaired, local data waits for the reload.
    const r1 = await runCycle(b.folder, b.ctx, { canApply: () => false, onFirstConnect: 'merge' });
    expect(r1).toEqual({ kind: 'remote-newer' });
    expect([...b.folder.others.keys()]).toEqual(['nghe-noi-am-backup-2026-11-01.json']);
    const main = b.folder.json();
    expect(attemptsOf(main.data[K('stats')])).toEqual([1, 2, 3]);
    expect(main.sync.lineage).toEqual([5000, 6000, 7000, 9000]);
    expect(attemptsOf(b.storage.getItem(K('stats')))).toEqual([1, 3]);

    const r2 = await runCycle(b.folder, b.ctx, bg);
    expect(r2).toMatchObject({ kind: 'applied', how: 'pull' });
    expect(attemptsOf(b.storage.getItem(K('stats')))).toEqual([1, 2, 3]);

    // A (in step with its own 7000) takes the repaired file without losing anything either.
    const a = setup({ lastSyncedSavedAt: 7000, syncedHash: dataHash({ [K('stats')]: stats(1, 2) }) });
    a.storage.setItem(K('stats'), stats(1, 2));
    a.folder.content = b.folder.content;
    expect(await runCycle(a.folder, a.ctx, bg)).toMatchObject({ kind: 'applied', how: 'pull' });
    expect(attemptsOf(a.storage.getItem(K('stats')))).toEqual([1, 2, 3]);
  });

  it('uses a conflict copy when the data file itself is missing', async () => {
    const t = setup({ lastSyncedSavedAt: 6000, syncedHash: dataHash({ [K('stats')]: stats(1) }) }, 9000);
    t.storage.setItem(K('stats'), stats(1));
    t.folder.others.set('nghe-noi-am-data (1).json', remoteFile({ [K('stats')]: stats(1, 2) }, 7000, 'd-a', [6000]));
    const r = await runCycle(t.folder, t.ctx, bg);
    expect(r).toMatchObject({ kind: 'applied', how: 'pull' });
    expect(attemptsOf(t.folder.json().data[K('stats')])).toEqual([1, 2]);
    expect(t.folder.others.size).toBe(0);
  });

  it('leaves a broken copy alone, and does not rewrite the file again when deleting a copy failed', async () => {
    const t = setup({ lastSyncedSavedAt: 5000, syncedHash: dataHash({ [K('stats')]: stats(1) }) }, 9000);
    t.storage.setItem(K('stats'), stats(1));
    t.folder.content = remoteFile({ [K('stats')]: stats(1) }, 5000);
    t.folder.others.set('nghe-noi-am-data-PC.json', '{"app":"nghe-noi-am", trunc');
    expect(await runCycle(t.folder, t.ctx, bg)).toEqual({ kind: 'noop' });
    expect(t.folder.writes).toBe(0);
    expect(t.folder.others.has('nghe-noi-am-data-PC.json')).toBe(true);

    t.folder.others.set('nghe-noi-am-data-PC.json', remoteFile({ [K('stats')]: stats(1, 2) }, 6000, 'd-a', [5000]));
    t.folder.removeError = Object.assign(new Error('x'), { name: 'NotAllowedError' });
    await runCycle(t.folder, t.ctx, bg);
    expect(t.folder.writes).toBe(1);
    expect(attemptsOf(t.storage.getItem(K('stats')))).toEqual([1, 2]);
    await runCycle(t.folder, t.ctx, bg);
    await runCycle(t.folder, t.ctx, bg);
    expect(t.folder.writes).toBe(1); // already folded in: no rewrite churn
  });

  it('a conflict copy that cannot be written back reports an error and changes nothing', async () => {
    const t = setup({ lastSyncedSavedAt: 5000 }, 9000);
    t.storage.setItem(K('stats'), stats(1));
    const main = remoteFile({ [K('stats')]: stats(1) }, 5000);
    t.folder.content = main;
    t.folder.others.set('nghe-noi-am-data-PC.json', remoteFile({ [K('stats')]: stats(1, 2) }, 6000, 'd-a', [5000]));
    t.folder.writeError = Object.assign(new Error('x'), { name: 'NoModificationAllowedError' });
    expect(await runCycle(t.folder, t.ctx, bg)).toMatchObject({ kind: 'error', stage: 'write' });
    expect(t.folder.content).toBe(main);
    expect(t.folder.others.size).toBe(1);
    expect(attemptsOf(t.storage.getItem(K('stats')))).toEqual([1]);
  });

  it('recognises conflict copies from OneDrive, Google Drive, Dropbox, iCloud and Syncthing only', () => {
    expect(isConflictCopyName("nghe-noi-am-data (Phuoc's conflicted copy 2026-11-06).json")).toBe(true);
    expect(isConflictCopyName('nghe-noi-am-data 2.json')).toBe(true);
    expect(isConflictCopyName('nghe-noi-am-data.sync-conflict-20261106-101500-ABCDEFG.json')).toBe(true);
    expect(isConflictCopyName('nghe-noi-am-data.json.json')).toBe(false);
    expect(isConflictCopyName('nghe-noi-am-data-DESKTOP-AB12.json')).toBe(true);
    expect(isConflictCopyName('nghe-noi-am-data (1).json')).toBe(true);
    expect(isConflictCopyName('NGHE-NOI-AM-DATA-PC-2.JSON')).toBe(true);
    expect(isConflictCopyName('nghe-noi-am-data.json')).toBe(false);
    expect(isConflictCopyName('nghe-noi-am-data.json.crswap')).toBe(false);
    expect(isConflictCopyName('nghe-noi-am-backup-2026-11-06.json')).toBe(false);
    expect(isConflictCopyName('nghe-noi-am-datax.json')).toBe(false);
  });
});

describe('startupWindow', () => {
  it('closes exactly when the budget timer fires, before anything awaiting it runs', async () => {
    vi.useFakeTimers();
    try {
      const w = startupWindow(1500);
      expect(w.canApply()).toBe(true);
      let seen: boolean | null = null;
      void w.expired.then(() => {
        seen = w.canApply();
      });
      vi.advanceTimersByTime(1499);
      expect(w.canApply()).toBe(true);
      vi.advanceTimersByTime(1);
      expect(w.canApply()).toBe(false);
      await Promise.resolve();
      expect(seen).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('can be closed early', () => {
    const w = startupWindow(1000, () => 0);
    w.close();
    expect(w.canApply()).toBe(false);
  });
});

describe('merging without changing local data', () => {
  it('an older file put back (a subset of local data) is overwritten while the page is open, without a banner', async () => {
    const t = setup({ lastSyncedSavedAt: 6000, syncedHash: dataHash({ [K('stats')]: stats(1, 2) }) }, 9000);
    t.storage.setItem(K('stats'), stats(1, 2));
    t.folder.content = remoteFile({ [K('stats')]: stats(1) }, 5000); // restored from OneDrive history
    const r = await runCycle(t.folder, t.ctx, { canApply: () => false, onFirstConnect: 'merge' });
    expect(r).toMatchObject({ kind: 'applied', how: 'merge', localChanged: false });
    expect(attemptsOf(t.folder.json().data[K('stats')])).toEqual([1, 2]);
    expect(t.folder.json().sync.savedAt).toBe(9000);
    expect(t.meta()).toMatchObject({ lastSyncedSavedAt: 9000, dirty: false });
  });
});
