import { afterEach, describe, expect, it, vi } from 'vitest';
import { createItem } from './library';

function stubWindow() {
  const map = new Map<string, string>();
  const state = { full: false };
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (state.full) throw new Error('QuotaExceededError');
        map.set(k, v);
      },
      removeItem: (k: string) => void map.delete(k),
    },
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  return state;
}

async function freshStore() {
  vi.resetModules();
  return import('./store');
}

const UNITS = [{ start: 0, end: 3, text: 'Hello there.' }];

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('media store save warning', () => {
  it('flags a failed progress save for an existing item and clears it on the next successful save', async () => {
    const storage = stubWindow();
    const store = await freshStore();
    const item = createItem({ kind: 'youtube', title: 'Demo', youtubeId: 'dQw4w9WgXcQ', units: UNITS }, 1, 'id1');
    expect(store.addItem(item)).toEqual({ ok: true });

    storage.full = true;
    expect(store.updateItem('id1', (it) => ({ ...it, title: 'Mới' }))).toBe(false);
    // the change stays in memory even though it could not be written
    expect(store.getLibrary().items[0].title).toBe('Mới');

    expect(store.getSaveFailed()).toBe(true);

    storage.full = false;
    expect(store.updateItem('id1', (it) => ({ ...it, title: 'Lại' }))).toBe(true);
    expect(store.getSaveFailed()).toBe(false);
  });

  it('does not report a failure when nothing changed', async () => {
    const storage = stubWindow();
    const store = await freshStore();
    storage.full = true;
    expect(store.updateItem('missing', (it) => it)).toBe(true);
    expect(store.getSaveFailed()).toBe(false);
  });

  it('can be dismissed', async () => {
    const storage = stubWindow();
    const store = await freshStore();
    store.addItem(createItem({ kind: 'youtube', title: 'Demo', youtubeId: 'dQw4w9WgXcQ', units: UNITS }, 1, 'id1'));
    storage.full = true;
    store.updateItem('id1', (it) => ({ ...it, openedAt: 2 }));
    expect(store.getSaveFailed()).toBe(true);
    store.dismissSaveWarning();
    expect(store.getSaveFailed()).toBe(false);
  });

  it('stays dismissed while storage is still full, and returns after a save succeeded then failed again', async () => {
    const storage = stubWindow();
    const store = await freshStore();
    store.addItem(createItem({ kind: 'youtube', title: 'Demo', youtubeId: 'dQw4w9WgXcQ', units: UNITS }, 1, 'id1'));
    storage.full = true;
    store.updateItem('id1', (it) => ({ ...it, openedAt: 2 }));
    store.dismissSaveWarning();
    // every later check fails too: the warning must not pop back after each one
    store.updateItem('id1', (it) => ({ ...it, openedAt: 3 }));
    expect(store.getSaveFailed()).toBe(false);

    storage.full = false;
    expect(store.updateItem('id1', (it) => ({ ...it, openedAt: 4 }))).toBe(true);
    storage.full = true;
    store.updateItem('id1', (it) => ({ ...it, openedAt: 5 }));
    expect(store.getSaveFailed()).toBe(true);
  });

  it('a failed save of a session-only item does not raise the warning', async () => {
    const storage = stubWindow();
    const store = await freshStore();
    storage.full = true;
    const res = store.addItem(createItem({ kind: 'youtube', title: 'Demo', youtubeId: 'dQw4w9WgXcQ', units: UNITS }, 1, 'id1'));
    expect(res.ok).toBe(false);
    expect(store.isSessionOnly('id1')).toBe(true);
    store.updateItem('id1', (it) => ({ ...it, openedAt: 2 }));
    expect(store.getSaveFailed()).toBe(false);
  });
});
