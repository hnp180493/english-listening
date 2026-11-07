import { describe, expect, it } from 'vitest';
import {
  backupFileName,
  clearAll,
  exportBackup,
  importBackup,
  MAX_BACKUP_SIZE,
  sanitizeSettingsJSON,
  serializeBackup,
  summarizeBackup,
  validateBackup,
  type Backup,
  type StorageLike,
} from './backup';
import { STORAGE_PREFIX } from './storage';

class MemoryStorage implements StorageLike {
  map = new Map<string, string>();
  failAfter = Infinity;
  writes = 0;
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
    if (this.writes++ >= this.failAfter) throw new Error('QuotaExceededError');
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

const P = STORAGE_PREFIX;

function seeded(): MemoryStorage {
  const s = new MemoryStorage();
  s.map.set(P + 'settings', JSON.stringify({ rate: 0.9 }));
  s.map.set(P + 'stats', JSON.stringify({ attempts: [{ at: 1 }, { at: 2 }], activeDays: ['2026-11-05'] }));
  s.map.set('other-app:token', 'secret');
  return s;
}

const NOW = new Date(2026, 10, 6, 9, 0).getTime();

describe('exportBackup', () => {
  it('exports only prefixed keys', () => {
    const b = exportBackup(seeded(), NOW);
    expect(b.app).toBe('nghe-noi-am');
    expect(b.version).toBe(1);
    expect(b.exportedAt).toBe(new Date(NOW).toISOString());
    expect(Object.keys(b.data).sort()).toEqual([P + 'settings', P + 'stats']);
    expect(b.data).not.toHaveProperty('other-app:token');
  });

  it('exports an empty storage', () => {
    expect(exportBackup(new MemoryStorage(), NOW).data).toEqual({});
  });

  it('names the file by local date', () => {
    expect(backupFileName(NOW)).toBe('nghe-noi-am-backup-2026-11-06.json');
  });
});

describe('validateBackup', () => {
  const good = (): Backup => exportBackup(seeded(), NOW);

  it('accepts its own export, as object or text', () => {
    expect(validateBackup(good()).ok).toBe(true);
    const r = validateBackup(serializeBackup(good()));
    expect(r.ok).toBe(true);
    if (r.ok) expect(Object.keys(r.backup.data)).toHaveLength(2);
  });

  it.each([
    ['not json', '{oops'],
    ['array', []],
    ['null', null],
    ['wrong app', { app: 'other', version: 1, data: { [P + 'x']: '1' } }],
    ['missing version', { app: 'nghe-noi-am', data: { [P + 'x']: '1' } }],
    ['future version', { app: 'nghe-noi-am', version: 2, data: { [P + 'x']: '1' } }],
    ['no data', { app: 'nghe-noi-am', version: 1 }],
    ['data array', { app: 'nghe-noi-am', version: 1, data: [] }],
    ['empty data', { app: 'nghe-noi-am', version: 1, data: {} }],
    ['foreign key', { app: 'nghe-noi-am', version: 1, data: { 'evil:key': '1' } }],
    ['bare prefix', { app: 'nghe-noi-am', version: 1, data: { [P]: '1' } }],
    ['non-string value', { app: 'nghe-noi-am', version: 1, data: { [P + 'x']: 1 } }],
    ['non-json value', { app: 'nghe-noi-am', version: 1, data: { [P + 'x']: '{bad' } }],
  ])('rejects %s with a Vietnamese message', (_name, input) => {
    const r = validateBackup(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.length).toBeGreaterThan(5);
  });

  it('tolerates a missing exportedAt', () => {
    const r = validateBackup({ app: 'nghe-noi-am', version: 1, data: { [P + 'x']: '1' } });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.backup.exportedAt).toBe('');
  });
});

describe('summarizeBackup', () => {
  it('counts attempts and days', () => {
    expect(summarizeBackup(exportBackup(seeded(), NOW))).toEqual({ keys: 2, exportedAt: NOW, attempts: 2, activeDays: 1 });
  });
  it('is safe on odd content', () => {
    const b: Backup = { app: 'nghe-noi-am', version: 1, exportedAt: '', data: { [P + 'stats']: '"x"' } };
    expect(summarizeBackup(b)).toEqual({ keys: 1, exportedAt: null, attempts: 0, activeDays: 0 });
  });
});

describe('importBackup / clearAll', () => {
  it('replaces app data and leaves other apps alone', () => {
    const target = new MemoryStorage();
    target.map.set(P + 'drill-cards', '{}');
    target.map.set('other-app:token', 'keep');
    const n = importBackup(target, exportBackup(seeded(), NOW), { replace: true });
    expect(n).toBe(2);
    expect(target.getItem(P + 'drill-cards')).toBeNull();
    expect(target.getItem(P + 'settings')).toBe(JSON.stringify({ rate: 0.9 }));
    expect(target.getItem('other-app:token')).toBe('keep');
  });

  it('merges when replace is false', () => {
    const target = new MemoryStorage();
    target.map.set(P + 'drill-cards', '{}');
    importBackup(target, exportBackup(seeded(), NOW), { replace: false });
    expect(target.getItem(P + 'drill-cards')).toBe('{}');
    expect(target.getItem(P + 'stats')).not.toBeNull();
  });

  it('round-trips', () => {
    const src = seeded();
    const dst = new MemoryStorage();
    importBackup(dst, exportBackup(src, NOW));
    expect(exportBackup(dst, NOW).data).toEqual(exportBackup(src, NOW).data);
  });

  it('rethrows when storage stays broken', () => {
    const target = new MemoryStorage();
    target.failAfter = 0;
    expect(() => importBackup(target, exportBackup(seeded(), NOW))).toThrow('QuotaExceededError');
  });

  it('restores the previous data when a write fails midway', () => {
    const target = new MemoryStorage();
    target.map.set(P + 'settings', '"old"');
    let calls = 0;
    const flaky: StorageLike = {
      get length() {
        return target.length;
      },
      key: (i) => target.key(i),
      getItem: (k) => target.getItem(k),
      removeItem: (k) => target.removeItem(k),
      setItem: (k, v) => {
        calls++;
        if (calls === 2) throw new Error('quota');
        target.map.set(k, v);
      },
    };
    expect(() => importBackup(flaky, exportBackup(seeded(), NOW))).toThrow('quota');
    expect(target.getItem(P + 'settings')).toBe('"old"');
    expect(target.getItem(P + 'stats')).toBeNull();
  });

  it('clearAll removes only app keys', () => {
    const s = seeded();
    expect(clearAll(s)).toBe(2);
    expect(s.length).toBe(1);
    expect(s.getItem('other-app:token')).toBe('secret');
  });
});

describe('settings sanitizing on import', () => {
  const wrap = (settings: string) =>
    JSON.stringify({ app: 'nghe-noi-am', version: 1, exportedAt: '2026-11-06T00:00:00.000Z', data: { [P + 'settings']: settings } });

  it('drops invalid fields and clamps numbers', () => {
    const res = validateBackup(
      wrap(JSON.stringify({ theme: 'neon', dailyGoal: 0, rate: 9, showIpa: 'yes', voiceURI: 42, extra: { x: 1 } })),
    );
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(JSON.parse(res.backup.data[P + 'settings'])).toEqual({ rate: 1.5, dailyGoal: 10 });
  });

  it('keeps valid settings unchanged', () => {
    const good = { voiceURI: null, rate: 0.85, showIpa: true, theme: 'dark', dailyGoal: 45 };
    const res = validateBackup(wrap(JSON.stringify(good)));
    expect(res.ok && JSON.parse(res.backup.data[P + 'settings'])).toEqual(good);
  });

  it('rejects a settings entry that is not an object', () => {
    for (const bad of ['"old"', '[1,2]', 'null', '42']) {
      const res = validateBackup(wrap(bad));
      expect(res.ok).toBe(false);
    }
    expect(sanitizeSettingsJSON('{oops')).toBeNull();
  });

  it('rounds NaN-like goals away and snaps to the 5-step grid', () => {
    expect(JSON.parse(sanitizeSettingsJSON(JSON.stringify({ dailyGoal: 33 })) ?? '{}')).toEqual({ dailyGoal: 35 });
    expect(JSON.parse(sanitizeSettingsJSON(JSON.stringify({ dailyGoal: 1e9 })) ?? '{}')).toEqual({ dailyGoal: 100 });
    expect(JSON.parse(sanitizeSettingsJSON('{"dailyGoal":null}') ?? '{}')).toEqual({});
  });
});

describe('review cards (Ôn tập)', () => {
  it('round-trip through export / validate / import', () => {
    const src = seeded();
    const review = JSON.stringify({
      version: 1,
      cards: {
        'dict:s001': { id: 'dict:s001', due: NOW, interval: 3, ease: 2.5, reps: 1, lapses: 0, last: NOW - 1 },
        // word cards (docs/review-system.md §13) travel like every other kind
        'word:read~red': { id: 'word:read~red', due: NOW, interval: 0, ease: 2.5, reps: 0, lapses: 0, last: 0, born: NOW - 9 },
        'word:colonel~KER-nəl': { id: 'word:colonel~KER-nəl', due: NOW, interval: 4, ease: 2.65, reps: 1, lapses: 0, last: NOW - 2, lastGrade: 'easy', suspended: true },
      },
      daily: { day: '2026-11-06', ids: ['dict:s001', 'word:colonel~KER-nəl'], extraSec: 0, enrolled: 2, newWords: 1 },
      since: NOW - 5,
      notice: null,
      noticeSeenAt: 0,
    });
    src.map.set(P + 'review-cards', review);
    src.map.set(P + 'settings', JSON.stringify({ rate: 0.9, reviewMinutes: 15 }));
    const res = validateBackup(JSON.parse(serializeBackup(exportBackup(src, NOW))));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const target = new MemoryStorage();
    importBackup(target, res.backup, { replace: true });
    expect(target.getItem(P + 'review-cards')).toBe(review);
    expect(JSON.parse(target.getItem(P + 'settings')!)).toEqual({ rate: 0.9, reviewMinutes: 15 });
    expect(clearAll(target)).toBeGreaterThan(0);
    expect(target.getItem(P + 'review-cards')).toBeNull();
  });

  it('keeps only valid reviewMinutes in settings', () => {
    expect(JSON.parse(sanitizeSettingsJSON(JSON.stringify({ reviewMinutes: 20 })) ?? '{}')).toEqual({ reviewMinutes: 20 });
    expect(JSON.parse(sanitizeSettingsJSON(JSON.stringify({ reviewMinutes: 7 })) ?? '{}')).toEqual({});
    expect(JSON.parse(sanitizeSettingsJSON(JSON.stringify({ reviewMinutes: '10' })) ?? '{}')).toEqual({});
  });
});

describe('huge files', () => {
  it('rejects raw text above the size limit before parsing', () => {
    const res = validateBackup(' '.repeat(MAX_BACKUP_SIZE + 1));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/quá lớn/);
  });
});

describe('device-local keys (timer, checkup draft, device id)', () => {
  const local = (s: MemoryStorage) => {
    s.map.set(P + 'listening-timer', JSON.stringify({ startedAt: 1, runningSince: 1, accumulatedMs: 0 }));
    s.map.set(P + 'checkup-draft', JSON.stringify({ form: 'A' }));
    s.map.set(P + 'device-id', '"d-abc"');
    s.map.set(P + 'listening-log', JSON.stringify({ version: 1, entries: [] }));
    return s;
  };

  it('are never exported', () => {
    const s = local(new MemoryStorage());
    const keys = Object.keys(exportBackup(s, NOW).data);
    expect(keys).toEqual([P + 'listening-log']);
  });

  it('survive a replacing import and are never written by one', () => {
    const target = local(new MemoryStorage());
    const forged: Backup = {
      app: 'nghe-noi-am',
      version: 1,
      exportedAt: '',
      data: { [P + 'stats']: '{}', [P + 'listening-timer']: '{"startedAt":999}', [P + 'device-id']: '"other"' },
    };
    const res = validateBackup(forged);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(Object.keys(res.backup.data)).toEqual([P + 'stats']);
    importBackup(target, forged, { replace: true }); // even unvalidated data cannot set them
    expect(target.getItem(P + 'listening-timer')).toContain('"runningSince":1');
    expect(target.getItem(P + 'device-id')).toBe('"d-abc"');
    expect(target.getItem(P + 'listening-log')).toBeNull(); // synced keys are replaced
    expect(target.getItem(P + 'stats')).toBe('{}');
  });

  it('are kept when an import fails and is rolled back', () => {
    const target = local(new MemoryStorage());
    let calls = 0;
    const flaky: StorageLike = {
      get length() {
        return target.length;
      },
      key: (i) => target.key(i),
      getItem: (k) => target.getItem(k),
      removeItem: (k) => target.removeItem(k),
      setItem: (k, v) => {
        if (++calls === 2) throw new Error('quota');
        target.map.set(k, v);
      },
    };
    expect(() => importBackup(flaky, exportBackup(seeded(), NOW))).toThrow('quota');
    expect(target.getItem(P + 'listening-timer')).not.toBeNull();
    expect(target.getItem(P + 'listening-log')).not.toBeNull();
  });

  it('clearAll removes them ("Xóa dữ liệu") unless asked to keep them', () => {
    const a = local(new MemoryStorage());
    expect(clearAll(a, { keepDeviceLocal: true })).toBe(1);
    expect(a.getItem(P + 'device-id')).toBe('"d-abc"');
    expect(clearAll(a)).toBe(3);
    expect(a.length).toBe(0);
  });

  it('a backup with only device-local keys is empty', () => {
    const res = validateBackup({ app: 'nghe-noi-am', version: 1, exportedAt: '', data: { [P + 'checkup-draft']: '{}' } });
    expect(res.ok).toBe(false);
  });
});

describe('voiceEngine in settings', () => {
  it('keeps clips/browser/ai and drops anything else', () => {
    expect(JSON.parse(sanitizeSettingsJSON(JSON.stringify({ voiceEngine: 'ai' })) ?? '{}')).toEqual({ voiceEngine: 'ai' });
    expect(JSON.parse(sanitizeSettingsJSON(JSON.stringify({ voiceEngine: 'clips' })) ?? '{}')).toEqual({ voiceEngine: 'clips' });
    expect(JSON.parse(sanitizeSettingsJSON(JSON.stringify({ voiceEngine: 'browser' })) ?? '{}')).toEqual({ voiceEngine: 'browser' });
    for (const bad of ['gemini', 1, null, true, { x: 1 }]) {
      expect(JSON.parse(sanitizeSettingsJSON(JSON.stringify({ voiceEngine: bad })) ?? '{}')).toEqual({});
    }
  });
});

describe('listenGoal in settings', () => {
  it('keeps only one of the offered values', () => {
    expect(JSON.parse(sanitizeSettingsJSON(JSON.stringify({ listenGoal: 0 })) ?? '{}')).toEqual({ listenGoal: 0 });
    expect(JSON.parse(sanitizeSettingsJSON(JSON.stringify({ listenGoal: 90 })) ?? '{}')).toEqual({ listenGoal: 90 });
    expect(JSON.parse(sanitizeSettingsJSON(JSON.stringify({ listenGoal: 20 })) ?? '{}')).toEqual({});
    expect(JSON.parse(sanitizeSettingsJSON(JSON.stringify({ listenGoal: '30' })) ?? '{}')).toEqual({});
  });
});
