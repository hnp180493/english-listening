// Data shared with daily-english on the same account (docs/supabase-sync.md §6, migration 19):
// `shared_learning_days` returns the days the learner studied in either app. Pure helpers here; the request is made by
// cloudController.ts (it holds the session).

import type { FetchFn } from './auth';
import type { CloudConfig } from './config';
import { CloudError } from './remote';

export interface SharedDay {
  /** local 'YYYY-MM-DD' */
  day: string;
  /** studied in Nghe Nối Âm (its synced stats.activeDays) */
  nna: boolean;
  /** studied in daily-english */
  de: boolean;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseSharedDays(json: unknown): SharedDay[] {
  if (!Array.isArray(json)) return [];
  const out: SharedDay[] = [];
  for (const r of json) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const day = typeof o.day === 'string' ? o.day.slice(0, 10) : '';
    if (!DAY_RE.test(day)) continue;
    out.push({ day, nna: o.nna === true, de: o.de === true });
  }
  return out;
}

/** This browser's active days plus the daily-english days (the union, sorted, unique). */
export function unionDays(own: readonly string[], shared: readonly SharedDay[]): string[] {
  const set = new Set(own.filter((d) => typeof d === 'string' && DAY_RE.test(d)));
  for (const s of shared) if (s.de) set.add(s.day);
  return [...set].sort();
}

export async function fetchSharedDays(cfg: CloudConfig, token: string, tz: string, fetchFn: FetchFn): Promise<SharedDay[]> {
  let res: Response;
  try {
    res = await fetchFn(`${cfg.url}/rest/v1/rpc/shared_learning_days`, {
      method: 'POST',
      headers: { apikey: cfg.key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ p_tz: tz }),
    });
  } catch {
    throw new CloudError('network', 'Không kết nối được máy chủ (đang ngoại tuyến?).');
  }
  if (res.status === 401) throw new CloudError('auth', 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.');
  if (!res.ok) throw new CloudError(res.status === 404 ? 'missing-table' : 'server', `Máy chủ báo lỗi (${res.status}).`);
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return parseSharedDays(json);
}
