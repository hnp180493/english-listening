// The table `nna_sync` over Supabase's REST API (PostgREST): list the rows' revisions, fetch values, and write a batch
// through the compare-and-swap function `nna_sync_write` (migration 18 in daily-english/supabase-migrations).
// `CloudStore` is the seam the sync cycle uses; tests give it an in-memory fake.

import type { FetchFn } from './auth';
import type { CloudConfig } from './config';
import { tl } from '../../i18n';

export interface RowHead {
  key: string;
  rev: number;
  /** epoch ms, server clock */
  updatedAt: number;
}

export interface Row extends RowHead {
  value: string;
}

export interface Change {
  key: string;
  /** null: delete the row */
  value: string | null;
  /** the rev the change was built on; null: no row expected */
  base: number | null;
}

export type WriteResult = { ok: true; revs: Record<string, number> } | { ok: false; error: 'conflict' | 'quota'; key?: string };

export interface CloudStore {
  list(): Promise<RowHead[]>;
  fetch(keys: string[]): Promise<Row[]>;
  write(changes: Change[], device: string): Promise<WriteResult>;
}

/** A request failed: `kind` tells the controller whether to retry later quietly or to ask for a new sign-in. */
export class CloudError extends Error {
  readonly kind: 'network' | 'auth' | 'missing-table' | 'server';
  constructor(kind: CloudError['kind'], message: string) {
    super(message);
    this.name = 'CloudError';
    this.kind = kind;
  }
}

/** Short storage keys that may travel (the table's CHECK constraint, same pattern). */
export const ROW_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function head(raw: unknown): RowHead | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const rev = typeof r.rev === 'string' ? Number(r.rev) : r.rev;
  if (typeof r.key !== 'string' || !ROW_KEY_PATTERN.test(r.key) || !finite(rev)) return null;
  const t = typeof r.updated_at === 'string' ? Date.parse(r.updated_at) : NaN;
  return { key: r.key, rev, updatedAt: Number.isNaN(t) ? 0 : t };
}

export function restStore(cfg: CloudConfig, accessToken: () => Promise<string>, fetchFn: FetchFn): CloudStore {
  const call = async (path: string, init: RequestInit = {}): Promise<unknown> => {
    const token = await accessToken();
    let res: Response;
    try {
      res = await fetchFn(`${cfg.url}/rest/v1/${path}`, {
        ...init,
        headers: {
          apikey: cfg.key,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(init.headers as Record<string, string> | undefined),
        },
      });
    } catch {
      throw new CloudError('network', 'Không kết nối được máy chủ (đang ngoại tuyến?).');
    }
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    if (res.ok) return json;
    const code = json && typeof json === 'object' ? String((json as Record<string, unknown>).code ?? '') : '';
    if (res.status === 401 || code === 'PGRST301' || code === 'PGRST303') {
      throw new CloudError('auth', 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.');
    }
    // 42P01 / 42883 / PGRST202 / PGRST205: the table or the function does not exist yet (migration not run)
    if (res.status === 404 || code === '42P01' || code === '42883' || code === 'PGRST202' || code === 'PGRST205') {
      throw new CloudError('missing-table', 'Kho dữ liệu trên máy chủ chưa được tạo (chưa chạy migration của Nghe Nối Âm).');
    }
    throw new CloudError('server', tl`Máy chủ báo lỗi (${res.status}). Sẽ thử lại sau.`);
  };

  return {
    async list() {
      const json = await call('nna_sync?select=key,rev,updated_at&order=key');
      return Array.isArray(json) ? json.map(head).filter((r): r is RowHead => r !== null) : [];
    },
    async fetch(keys) {
      const ok = keys.filter((k) => ROW_KEY_PATTERN.test(k));
      if (!ok.length) return [];
      const json = await call(`nna_sync?select=key,rev,updated_at,value&key=in.(${ok.map((k) => `"${k}"`).join(',')})`);
      if (!Array.isArray(json)) return [];
      const out: Row[] = [];
      for (const raw of json) {
        const h = head(raw);
        const value = (raw as Record<string, unknown>).value;
        if (h && typeof value === 'string') out.push({ ...h, value });
      }
      return out;
    },
    async write(changes, device) {
      const json = await call('rpc/nna_sync_write', { method: 'POST', body: JSON.stringify({ changes, device: device.slice(0, 80) }) });
      const r = json && typeof json === 'object' ? (json as Record<string, unknown>) : {};
      if (r.ok === true && r.revs && typeof r.revs === 'object') {
        const revs: Record<string, number> = {};
        for (const [k, v] of Object.entries(r.revs as Record<string, unknown>)) {
          const n = typeof v === 'string' ? Number(v) : v;
          if (finite(n)) revs[k] = n;
        }
        return { ok: true, revs };
      }
      if (r.error === 'quota') return { ok: false, error: 'quota' };
      if (r.error === 'conflict') return { ok: false, error: 'conflict', key: typeof r.key === 'string' ? r.key : undefined };
      throw new CloudError('server', 'Máy chủ trả về kết quả lạ khi ghi dữ liệu.');
    },
  };
}
