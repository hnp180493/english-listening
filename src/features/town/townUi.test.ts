import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEVICE_LOCAL_KEYS, isDeviceLocalKey, KEYS, STORAGE_PREFIX } from '../../core/storage';
import { SFX, sfxSeconds, type SfxName } from './sfx';
import { DEFAULT_TOWN_UI, parseTownUi } from './townUi';

const KEY = STORAGE_PREFIX + KEYS.townUi;
let map: Map<string, string>;

beforeEach(() => {
  map = new Map();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    },
    addEventListener: () => {},
  });
});
afterEach(() => vi.unstubAllGlobals());

async function fresh() {
  vi.resetModules();
  return import('./townUi');
}

describe('town-ui (this browser only)', () => {
  it('is a device-local key: never synced, never in a backup', () => {
    expect(KEYS.townUi).toBe('town-ui');
    expect(DEVICE_LOCAL_KEYS.has(KEYS.townUi)).toBe(true);
    expect(isDeviceLocalKey(KEY)).toBe(true);
  });

  it('sound is on and the welcome not yet seen by default', async () => {
    const ui = await fresh();
    expect(ui.getTownUi()).toEqual({ sound: true, welcomed: false });
    expect(DEFAULT_TOWN_UI).toEqual({ sound: true, welcomed: false });
  });

  it('a change is stored and survives a reload; the other field is kept', async () => {
    const ui = await fresh();
    ui.setTownUi({ sound: false });
    expect(JSON.parse(map.get(KEY)!)).toEqual({ sound: false, welcomed: false });
    ui.setTownUi({ welcomed: true });
    const again = await fresh();
    expect(again.getTownUi()).toEqual({ sound: false, welcomed: true });
  });

  it('reads junk as the defaults', () => {
    for (const junk of [null, 7, 'x', [], { sound: 'yes', welcomed: 1 }, { extra: true }]) expect(parseTownUi(junk)).toEqual(DEFAULT_TOWN_UI);
    expect(parseTownUi({ sound: false, welcomed: true, more: 1 })).toEqual({ sound: false, welcomed: true });
  });

  it('keeps the choice for the session when storage refuses the write', async () => {
    const ui = await fresh();
    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error('QuotaExceededError');
        },
        removeItem: () => {},
      },
      addEventListener: () => {},
    });
    ui.setTownUi({ sound: false });
    expect(ui.getTownUi().sound).toBe(false);
  });
});

describe('sound effects', () => {
  const names = Object.keys(SFX) as SfxName[];

  it('are short and soft: nothing rings longer than a breath, nothing is loud', () => {
    for (const name of names) {
      expect(SFX[name].length, name).toBeGreaterThan(0);
      expect(sfxSeconds(name), name).toBeLessThanOrEqual(name === 'level' ? 1.2 : 0.65);
      for (const tone of SFX[name]) {
        expect(tone.vol, name).toBeLessThanOrEqual(0.7);
        expect(tone.hz, name).toBeGreaterThan(80);
        expect(tone.hz, name).toBeLessThan(2000);
        expect(tone.dur, name).toBeGreaterThan(0);
      }
    }
  });

  it('does nothing (and never throws) when off, or where there is no Web Audio', async () => {
    vi.resetModules();
    const sfx = await import('./sfx');
    expect(() => sfx.playSfx('coin', false)).not.toThrow();
    expect(() => sfx.playSfx('coin', true)).not.toThrow();
    expect(() => sfx.stopSfx()).not.toThrow();
  });
});
