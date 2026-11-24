// "Sổ cá": the 24 species of the pond. Caught ones in colour with how many and the best time; one hooked but never
// landed shows its name as a grey shape; one never met is a silhouette with "?". A tap shows the species' card.

import { useState } from 'react';
import { RARITIES, RARITY } from '../../../../data/townGame';
import type { AlbumFish, FishAlbum } from '../../../../core/town/fishing';
import { secondsVi } from './castMachine';
import FishSprite from './FishSprite';
import { TierGem } from './TierGem';
import { getLang, tl, tr } from '../../../../i18n';

function dateVi(ts: number): string {
  try {
    if (getLang() === 'en') return new Date(ts).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    return new Date(ts).toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

function Detail({ f }: { f: AlbumFish }) {
  const { species, record } = f;
  const tier = RARITY[species.tier].name;
  if (!f.caught && !f.seen) {
    return (
      <div className="town-fish-detail" aria-live="polite">
        <p className="town-fish-detail-name">
          <TierGem tier={species.tier} />
          {tl`Chưa gặp · cá ${tr(tier).toLowerCase()}`}
        </p>
        <p className="town-fish-detail-fact">Cứ thả câu: loài này sẽ tới. Chuỗi câu được càng dài, cá hiếm càng hay cắn.</p>
      </div>
    );
  }
  return (
    <div className="town-fish-detail" aria-live="polite">
      <p className="town-fish-detail-name">
        <TierGem tier={species.tier} />
        {species.name} · {tier}
      </p>
      <p className="town-fish-detail-fact">{species.fact}</p>
      {f.caught && record ? (
        <p className="town-fish-detail-meta">
          Đã câu {record.caught} con
          {record.bestMs > 0 && <> · nhanh nhất {secondsVi(record.bestMs)}</>}
          {record.firstAt > 0 && <> · lần đầu {dateVi(record.firstAt)}</>}
        </p>
      ) : (
        <p className="town-fish-detail-meta">Đã cắn câu nhưng sổng mất. Lần sau nghe kỹ nhé.</p>
      )}
    </div>
  );
}

export default function FishAlbumView({ album }: { album: FishAlbum }) {
  const [picked, setPicked] = useState<string | null>(null);
  const sel = album.fish.find((f) => f.species.id === picked) ?? null;
  return (
    <div className="town-fish-album">
      <div className="town-fish-album-head">
        <p className="town-fish-album-count">
          <span className="tabular">
            {album.caught}/{album.total}
          </span>{' '}
          loài
          {album.catches > 0 && <span className="town-fish-album-sub"> · {album.catches} con đã câu</span>}
        </p>
        <div className="town-fish-album-bar" role="progressbar" aria-label="Loài đã câu" aria-valuemin={0} aria-valuemax={album.total} aria-valuenow={album.caught}>
          <span style={{ width: `${(album.caught / Math.max(1, album.total)) * 100}%` }} />
        </div>
        <ul className="town-fish-tiers" aria-label="Theo độ hiếm">
          {RARITIES.map((r) => (
            <li key={r}>
              <TierGem tier={r} />
              {RARITY[r].name}{' '}
              <span className="tabular">
                {album.byTier[r].caught}/{album.byTier[r].total}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {sel ? <Detail f={sel} /> : <p className="town-fish-album-hint">Chạm vào một con để xem thẻ của nó.</p>}

      <ul className="town-fish-grid">
        {album.fish.map((f) => {
          const known = f.caught || f.seen;
          const on = picked === f.species.id;
          const label = f.caught ? tl`${f.species.name}, đã câu ${f.record?.caught ?? 0} con` : f.seen ? tl`${f.species.name}, chưa câu được` : tl`Loài chưa gặp, cá ${tr(RARITY[f.species.tier].name).toLowerCase()}`;
          return (
            <li key={f.species.id}>
              <button
                type="button"
                className={'town-fish-card' + (f.caught ? ' is-caught' : known ? ' is-seen' : ' is-unknown') + (on ? ' is-on' : '')}
                aria-pressed={on}
                aria-label={label}
                onClick={() => setPicked(on ? null : f.species.id)}
              >
                <span className="town-fish-card-pic">
                  <FishSprite species={f.species} size={64} silhouette={!f.caught} />
                  {!known && (
                    <span className="town-fish-card-q" aria-hidden="true">
                      ?
                    </span>
                  )}
                </span>
                <span className="town-fish-card-name">{known ? f.species.name : '???'}</span>
                <span className="town-fish-card-meta">
                  <TierGem tier={f.species.tier} />
                  {f.caught && f.record ? (
                    <span className="tabular">
                      ×{f.record.caught}
                      {f.record.bestMs > 0 && ` · ${secondsVi(f.record.bestMs).replace(' giây', 's').replace(/ s$/, 's')}`}
                    </span>
                  ) : (
                    <span>{RARITY[f.species.tier].name}</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
