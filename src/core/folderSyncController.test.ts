// Browser glue of folder sync, run in node with small fakes: localStorage / sessionStorage,
// IndexedDB (key/value only), a File System Access folder handle, window and document events.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { serializeSyncFile, SYNC_APPLIED_KEY, SYNC_FILE_NAME, SYNC_META_KEY, type SyncFile } from './folderSync';
import { STORAGE_PREFIX } from './storage';

const K = (k: string) => STORAGE_PREFIX + k;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class MemStorage {
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
    this.map.set(k, String(v));
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

function fakeIndexedDB(stores: Map<string, unknown>) {
  return {
    open() {
      const req: Record<string, unknown> & { onsuccess?: () => void } = {};
      setTimeout(() => {
        req.result = {
          objectStoreNames: { contains: () => true },
          createObjectStore() {},
          close() {},
          transaction() {
            const tx: { oncomplete?: () => void; objectStore: () => unknown } = {
              objectStore: () => ({
                get: (k: string) => ({ result: stores.get(k) }),
                put: (v: unknown, k: string) => (stores.set(k, v), { result: k }),
                delete: (k: string) => (stores.delete(k), { result: undefined }),
              }),
            };
            setTimeout(() => tx.oncomplete?.(), 0);
            return tx;
          },
        };
        req.onsuccess?.();
      }, 0);
      return req;
    },
  };
}

class FakeDir {
  readonly kind = 'directory' as const;
  name = 'NgheNoiAm';
  files = new Map<string, string>();
  readDelay = 0;
  writes = 0;
  async getFileHandle(name: string, opts?: { create?: boolean }) {
    if (!this.files.has(name)) {
      if (!opts?.create) throw Object.assign(new Error('missing'), { name: 'NotFoundError' });
      this.files.set(name, '');
    }
    return {
      kind: 'file' as const,
      getFile: async () => {
        if (this.readDelay) await sleep(this.readDelay);
        const text = this.files.get(name) ?? '';
        return { size: text.length, text: async () => text } as unknown as File;
      },
      createWritable: async () => {
        let buf = '';
        return {
          write: async (d: string) => void (buf += d),
          close: async () => {
            this.files.set(name, buf);
            this.writes++;
          },
          abort: async () => {},
        };
      },
    };
  }
  async *entries(): AsyncIterableIterator<[string, { kind: 'file' }]> {
    for (const name of [...this.files.keys()]) yield [name, await this.getFileHandle(name)];
  }
  async removeEntry(name: string) {
    this.files.delete(name);
  }
  async queryPermission() {
    return 'granted' as const;
  }
  async requestPermission() {
    return 'granted' as const;
  }
}

function fileText(data: Record<string, string>, savedAt: number, lineage: number[] = []): string {
  const f: SyncFile = { app: 'nghe-noi-am', version: 1, exportedAt: '', sync: { savedAt, device: 'd-other', lineage: [...lineage, savedAt] }, data };
  return serializeSyncFile(f);
}

const stats = (...ats: number[]) =>
  JSON.stringify({
    attempts: ats.map((at) => ({ at, module: 'dictation', itemId: 's' + at, correct: true, seen: [], missed: [] })),
    byPhenomenon: {},
    activeDays: [],
  });

interface Env {
  local: MemStorage;
  idb: Map<string, unknown>;
  dir: FakeDir;
  reload: ReturnType<typeof vi.fn>;
  fire(type: string, event?: unknown): void;
}

function installBrowser(): Env {
  const local = new MemStorage();
  const session = new MemStorage();
  const idb = new Map<string, unknown>();
  const dir = new FakeDir();
  const reload = vi.fn();
  const handlers = new Map<string, ((e: unknown) => void)[]>();
  const on = (type: string, fn: (e: unknown) => void) => handlers.set(type, [...(handlers.get(type) ?? []), fn]);
  const win = {
    localStorage: local,
    sessionStorage: session,
    location: { reload },
    showDirectoryPicker: async () => dir,
    addEventListener: on,
  };
  vi.stubGlobal('window', win);
  vi.stubGlobal('sessionStorage', session);
  vi.stubGlobal('indexedDB', fakeIndexedDB(idb));
  vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: on });
  return {
    local,
    idb,
    dir,
    reload,
    fire: (type, event = {}) => (handlers.get(type) ?? []).forEach((fn) => fn(event)),
  };
}

describe('folderSyncController', () => {
  let env: Env;
  beforeEach(() => {
    vi.resetModules();
    env = installBrowser();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('applies newer folder data before the first render when it arrives in time', async () => {
    env.idb.set('dir', env.dir);
    env.local.setItem(SYNC_META_KEY, JSON.stringify({ device: 'd-me12', lastSyncedSavedAt: 4000, dirty: false }));
    env.local.setItem(K('stats'), stats(1));
    env.dir.files.set(SYNC_FILE_NAME, fileText({ [K('stats')]: stats(1, 2) }, 5000, [4000]));
    const c = await import('./folderSyncController');
    await c.initFolderSync(1000);
    expect(env.local.getItem(K('stats'))).toBe(stats(1, 2));
    expect(env.local.getItem(SYNC_APPLIED_KEY)).not.toBeNull(); // other tabs are told to reload
    expect(c.getFolderSyncState().status).toBe('synced');
  });

  it('never replaces data after the startup budget ran out, even when the read finishes later', async () => {
    env.idb.set('dir', env.dir);
    env.local.setItem(SYNC_META_KEY, JSON.stringify({ device: 'd-me12', lastSyncedSavedAt: 4000, dirty: false }));
    env.local.setItem(K('stats'), stats(1));
    env.dir.files.set(SYNC_FILE_NAME, fileText({ [K('stats')]: stats(1, 2) }, 5000, [4000]));
    env.dir.readDelay = 120;
    const c = await import('./folderSyncController');
    await c.initFolderSync(30); // the page renders now
    await sleep(250);
    expect(env.local.getItem(K('stats'))).toBe(stats(1));
    expect(c.getFolderSyncState().status).toBe('remote-newer');
  });

  it('another tab applying folder data makes this tab reload', async () => {
    const c = await import('./folderSyncController');
    await c.initFolderSync(50);
    env.fire('storage', { key: 'unrelated', newValue: '1' });
    expect(env.reload).not.toHaveBeenCalled();
    env.fire('storage', { key: SYNC_APPLIED_KEY, newValue: '123' });
    expect(env.reload).toHaveBeenCalledTimes(1);
  });

  it('"Hoàn tác" restores this browser and disconnects, leaving the folder file (other computers\' progress) as it is', async () => {
    env.local.setItem(K('stats'), stats(1));
    const folderText = fileText({ [K('stats')]: stats(2) }, 5000);
    env.dir.files.set(SYNC_FILE_NAME, folderText);
    const c = await import('./folderSyncController');
    await c.initFolderSync(50);
    const ask = await c.connectFolder();
    expect(ask.kind).toBe('ask');
    const done = await c.resolveConnect('pull');
    expect(done).toEqual({ kind: 'connected', reload: true });
    expect(env.local.getItem(K('stats'))).toBe(stats(2));
    expect(c.getFolderSyncState().undoAt).not.toBeNull();

    const writesBefore = env.dir.writes;
    expect(await c.undoLastApply()).toBe(true);
    expect(env.local.getItem(K('stats'))).toBe(stats(1));
    expect(env.idb.has('dir')).toBe(false);
    expect(c.getFolderSyncState().status).toBe('off');
    expect(env.reload).toHaveBeenCalled();
    await sleep(20);
    expect(env.dir.writes).toBe(writesBefore);
    expect(env.dir.files.get(SYNC_FILE_NAME)).toBe(folderText);
  });

  it('a write finishing after "Ngắt kết nối" does not bring the connected state back', async () => {
    env.local.setItem(K('stats'), stats(1));
    const c = await import('./folderSyncController');
    await c.initFolderSync(50);
    expect(await c.connectFolder()).toEqual({ kind: 'connected', reload: false });
    expect(c.getFolderSyncState().status).toBe('synced');

    env.local.setItem(K('stats'), stats(1, 2));
    env.dir.readDelay = 80;
    const { notifyWrite } = await import('./storage');
    notifyWrite('stats');
    const flushing = c.flushFolderSync(1000);
    await c.disconnectFolder();
    await flushing;
    await sleep(120);
    expect(c.getFolderSyncState()).toMatchObject({ status: 'off', folderName: null });
    expect(JSON.parse(env.local.getItem(SYNC_META_KEY)!)).toMatchObject({ lastSyncedSavedAt: null, folderName: null });
  });

  it('writes to device-local keys (listening timer, checkup draft) do not mark the folder file stale', async () => {
    env.local.setItem(K('stats'), stats(1));
    const c = await import('./folderSyncController');
    await c.initFolderSync(50);
    expect(await c.connectFolder()).toEqual({ kind: 'connected', reload: false });
    const writesBefore = env.dir.writes;
    const { notifyWrite, KEYS } = await import('./storage');
    env.local.setItem(K(KEYS.listeningTimer), '{"startedAt":1,"runningSince":1,"accumulatedMs":0}');
    notifyWrite(KEYS.listeningTimer);
    notifyWrite(KEYS.checkupDraft);
    expect(c.getFolderSyncState().status).toBe('synced');
    expect(JSON.parse(env.local.getItem(SYNC_META_KEY)!).dirty).toBeFalsy();
    await sleep(50);
    expect(env.dir.writes).toBe(writesBefore);
    expect(env.dir.files.get(SYNC_FILE_NAME)).not.toContain('listening-timer');
  });
});
