// Defensive normalisation of the CHUNKS data before the drill uses it.
// The data file is edited by hand, so the UI must survive missing fields,
// duplicate ids and unknown phenomenon names (unknown names would crash recordAttempt).

import { PHENOMENA, type Chunk, type Phenomenon } from '../../core/types';

const VALID = new Set<string>(PHENOMENA);

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

export function sanitizeChunks(list: readonly unknown[] | undefined | null): Chunk[] {
  if (!Array.isArray(list)) return [];
  const out: Chunk[] = [];
  const seen = new Set<string>();
  list.forEach((item, i) => {
    if (!item || typeof item !== 'object') return;
    const c = item as Partial<Record<keyof Chunk, unknown>>;
    const id = str(c.id).trim();
    const written = str(c.written).trim();
    if (!id || !written || seen.has(id)) return;
    seen.add(id);
    const spoken = str(c.spoken).trim() || written;
    const phenomena = Array.isArray(c.phenomena)
      ? [...new Set(c.phenomena.filter((p): p is Phenomenon => typeof p === 'string' && VALID.has(p)))]
      : [];
    const rank = typeof c.rank === 'number' && Number.isFinite(c.rank) ? c.rank : 100_000 + i;
    const ipa = str(c.ipa).trim();
    out.push({
      id,
      written,
      spoken,
      ttsText: str(c.ttsText).trim() || spoken,
      ...(ipa ? { ipa } : {}),
      phenomena,
      meaning: str(c.meaning),
      example: str(c.example),
      exampleVi: str(c.exampleVi),
      rank,
    });
  });
  return out;
}
