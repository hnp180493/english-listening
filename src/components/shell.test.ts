import { describe, expect, it, vi } from 'vitest';
import { isChunkLoadError } from './chunkError';
import { lazyPage } from './lazyPage';
import PageBoundary from './PageBoundary';
import { shouldFocusHeading, type FocusNode } from './shellFocus';

describe('PageBoundary reset', () => {
  const derive = PageBoundary.getDerivedStateFromProps;
  const err = new Error('boom');

  it('clears the error when the full route changes (same route id, other params)', () => {
    expect(derive({ children: null, resetKey: '#/media' }, { error: err, resetKey: '#/media?id=bad' })).toEqual({
      error: null,
      resetKey: '#/media',
    });
  });

  it('keeps the error on a re-render with the same route', () => {
    expect(derive({ children: null, resetKey: '#/media?id=bad' }, { error: err, resetKey: '#/media?id=bad' })).toBeNull();
  });

  it('starts healthy and remembers its initial route', () => {
    const b = new PageBoundary({ children: null, resetKey: '#/pairs?set=a' });
    expect(b.state).toEqual({ error: null, resetKey: '#/pairs?set=a' });
  });
});

describe('shouldFocusHeading', () => {
  const body: FocusNode = { isConnected: true };
  const inside: FocusNode = { isConnected: true };
  const outside: FocusNode = { isConnected: true }; // e.g. the AppNav link that was clicked
  const removed: FocusNode = { isConnected: false };
  const main: FocusNode = { isConnected: true, contains: (n) => n === inside || n === main };

  it('route id change: focuses the heading when focus is outside main or lost', () => {
    expect(shouldFocusHeading(true, outside, main, body)).toBe(true);
    expect(shouldFocusHeading(true, body, main, body)).toBe(true);
    expect(shouldFocusHeading(true, null, main, body)).toBe(true);
    expect(shouldFocusHeading(true, removed, main, body)).toBe(true);
    expect(shouldFocusHeading(true, main, main, body)).toBe(true);
  });

  it('route id change: keeps a focus target the new page chose inside main', () => {
    expect(shouldFocusHeading(true, inside, main, body)).toBe(false);
  });

  it('param-only change: refocuses only when focus was lost', () => {
    expect(shouldFocusHeading(false, body, main, body)).toBe(true);
    expect(shouldFocusHeading(false, removed, main, body)).toBe(true);
    expect(shouldFocusHeading(false, inside, main, body)).toBe(false);
    expect(shouldFocusHeading(false, outside, main, body)).toBe(false);
  });

  it('does nothing without a main element', () => {
    expect(shouldFocusHeading(true, body, null, body)).toBe(false);
  });
});

describe('isChunkLoadError', () => {
  it('recognises failed page-chunk imports across browsers', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/a.js'))).toBe(true); // Chrome
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module: https://x/assets/a.js'))).toBe(true); // Firefox
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true); // Safari
    expect(isChunkLoadError(new Error('Unable to preload CSS for /assets/DictationPage-x.css'))).toBe(true); // Vite preload
    const named = new Error('x');
    named.name = 'ChunkLoadError';
    expect(isChunkLoadError(named)).toBe(true);
  });

  it('leaves ordinary page errors alone', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});

describe('lazyPage', () => {
  type Mod = { default: () => null };
  /** A fake React.lazy: records each factory so the test can run the import itself. */
  function setup(load: () => Promise<Mod>) {
    const factories: (() => Promise<Mod>)[] = [];
    const page = lazyPage<() => null>(load, (factory) => {
      factories.push(factory);
      return { id: factories.length } as never;
    });
    return { page, factories };
  }

  it('keeps the failed component after a rejected import, so the boundary sees the error (no retry loop)', async () => {
    const load = vi.fn(() => Promise.reject(new TypeError('Failed to fetch dynamically imported module')));
    const { page, factories } = setup(load);
    const first = page.current;
    await expect(factories[0]()).rejects.toThrow(/dynamically imported/);
    // React re-renders right after the rejection: it must get the same (rejected) lazy back.
    expect(page.current).toBe(first);
    expect(page.failed).toBe(true);
    expect(factories).toHaveLength(1);
  });

  it('renew() swaps in a fresh component only after a failure', async () => {
    let ok = false;
    const load = vi.fn(() => (ok ? Promise.resolve({ default: () => null }) : Promise.reject(new Error('offline'))));
    const { page, factories } = setup(load);
    expect(page.renew()).toBe(false); // nothing failed yet
    const first = page.current;
    await expect(factories[0]()).rejects.toThrow('offline');
    expect(page.renew()).toBe(true);
    expect(page.current).not.toBe(first);
    expect(page.failed).toBe(false);
    ok = true;
    await expect(factories[1]()).resolves.toHaveProperty('default');
    expect(load).toHaveBeenCalledTimes(2);
    expect(page.renew()).toBe(false); // loaded fine: keep it
  });
});
