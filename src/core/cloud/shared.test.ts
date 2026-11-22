import { describe, expect, it } from 'vitest';
import { mergeListeningLog } from '../syncMerge';
import { parseListeningLog } from '../listening';
import { currentStreak } from '../stats';
import type { FetchFn } from './auth';
import { CloudError } from './remote';
import { fetchSharedDays, parseSharedDays, unionDays } from './shared';

const cfg = { url: 'https://proj.supabase.co', key: 'sb_publishable_test', webAppUrl: 'https://x.io/' };

describe('days shared with daily-english', () => {
  it('parses rows defensively', () => {
    expect(parseSharedDays([{ day: '2026-11-21', nna: true, de: false }, { day: '2026-11-22T00:00:00', de: true }, { day: 'x' }, null, 3])).toEqual([
      { day: '2026-11-21', nna: true, de: false },
      { day: '2026-11-22', nna: false, de: true },
    ]);
    expect(parseSharedDays({})).toEqual([]);
  });

  it('the combined streak bridges a gap filled by daily-english', () => {
    const now = new Date(2026, 10, 22, 10).getTime();
    const own = ['2026-11-19', '2026-11-22'];
    const shared = [
      { day: '2026-11-20', nna: false, de: true },
      { day: '2026-11-21', nna: false, de: true },
      { day: '2026-11-22', nna: true, de: false },
    ];
    expect(currentStreak(own, now)).toBe(1);
    expect(currentStreak(unionDays(own, shared), now)).toBe(4);
  });

  it('requests the function with the session and the time zone; maps failures', async () => {
    let seen: { url: string; init?: RequestInit } | null = null;
    const ok: FetchFn = async (url, init) => {
      seen = { url, init };
      return new Response(JSON.stringify([{ day: '2026-11-22', nna: true, de: true }]), { status: 200 });
    };
    expect(await fetchSharedDays(cfg, 'TOKEN', 'Asia/Ho_Chi_Minh', ok)).toEqual([{ day: '2026-11-22', nna: true, de: true }]);
    expect(seen!.url).toBe('https://proj.supabase.co/rest/v1/rpc/shared_learning_days');
    expect(JSON.parse(String(seen!.init!.body))).toEqual({ p_tz: 'Asia/Ho_Chi_Minh' });
    const fail = (status: number) => fetchSharedDays(cfg, 'T', 'UTC', async () => new Response('{}', { status }));
    await expect(fail(401)).rejects.toMatchObject({ kind: 'auth' });
    await expect(fail(404)).rejects.toMatchObject({ kind: 'missing-table' });
    await expect(
      fetchSharedDays(cfg, 'T', 'UTC', async () => {
        throw new TypeError('offline');
      }),
    ).rejects.toBeInstanceOf(CloudError);
  });

  it('an entry written by daily-english (nna_add_listening) is accepted by the log and survives the merge', () => {
    // exactly what the SQL function writes (jsonb text: its own key order and spacing)
    const fromServer = {
      version: 1,
      entries: [
        { id: 'de-news-01-20261122', day: '2026-11-22', title: 'Daily English: Morning news', source: 'khac', minutes: 3, seconds: 195, startedAt: 1795300000000, updatedAt: 1795300195000 },
      ],
    };
    const local = { version: 1, entries: [{ id: 'own-1', startedAt: 1, day: '2026-11-22', minutes: 20, source: 'podcast', updatedAt: 5 }] };
    const merged = mergeListeningLog(fromServer, local);
    const live = parseListeningLog(merged);
    expect(live.map((e) => e.id).sort()).toEqual(['de-news-01-20261122', 'own-1']);
    const de = live.find((e) => e.id === 'de-news-01-20261122')!;
    expect(de).toMatchObject({ minutes: 3, source: 'khac', title: 'Daily English: Morning news', day: '2026-11-22' });
    // a later session the same day (server adds seconds, newer updatedAt) replaces it; a delete here wins over an older one
    const later = { version: 1, entries: [{ ...fromServer.entries[0], minutes: 5, seconds: 300, updatedAt: 1795300400000 }] };
    expect(parseListeningLog(mergeListeningLog(later, merged)).find((e) => e.id === de.id)).toMatchObject({ minutes: 5 });
    const deleted = { version: 1, entries: [{ id: de.id, updatedAt: 1795300500000, deleted: true }] };
    expect(parseListeningLog(mergeListeningLog(later, deleted)).find((e) => e.id === de.id)).toMatchObject({ deleted: true });
  });
});
