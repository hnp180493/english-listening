// "Sưu tầm" (docs/town.md §10): the achievements (one row per chain: the next step and how far along it is, the
// reached ones folded under "Đã đạt"), the town projects (a bar each, and what they add to the town), and the fish album in short (the
// pond itself is "Câu cá"). Opening it records the goals that need Ôn tập facts (checkTownUnlocks).

import { useEffect, useState } from 'react';
import { Check, Fish, Landmark, Lock, Trophy } from 'lucide-react';
import Segmented from '../../../components/Segmented';
import { Icon } from '../../../components/Icon';
import { checkTownUnlocks, useTownGame } from '../../../core/town/gameStore';
import { RARITIES, RARITY } from '../../../data/townGame';
import type { ActivityPanelProps } from './types';
import { albumChains, albumOrder, DECORATION_NAME, DECORATION_WHERE, progressText, shortDate } from './album/albumModel';
import { TierGem } from './eggs/TierGem';
import './eggs/eggs.css';
import './album/album.css';
import { tl } from '../../../i18n';

type AlbumTab = 'achievements' | 'projects' | 'fish';

export default function AlbumPanel({ onClose }: ActivityPanelProps) {
  const game = useTownGame();
  const [tab, setTab] = useState<AlbumTab>('achievements');
  useEffect(() => {
    checkTownUnlocks();
  }, []);

  const unlocked = game.achievements.filter((a) => a.unlockedAt !== null).length;
  const doneProjects = game.projects.filter((p) => p.unlockedAt !== null).length;
  const chains = albumChains(game.achievements);
  const reached = albumOrder(game.achievements).filter((a) => a.unlockedAt !== null);
  const album = game.album;

  return (
    <div className="town-album">
      <Segmented
        ariaLabel="Mục sưu tầm"
        block
        value={tab}
        onChange={setTab}
        options={[
          { value: 'achievements', label: 'Thành tích' },
          { value: 'projects', label: 'Dự án' },
          { value: 'fish', label: 'Cá' },
        ]}
      />

      {tab === 'achievements' && <p className="town-album-lead">{tl`Đã đạt ${unlocked} / ${game.achievements.length} thành tích. Mỗi thành tích cho một danh hiệu để đeo.`}</p>}
      {tab === 'achievements' && (
        <ul className="town-album-list" aria-label="Thành tích">
          {chains.map((c) => {
            const shown = c.current ?? c.last;
            const done = c.current === null;
            return (
              <li key={c.key} className={`town-album-row is-chain${c.done > 0 ? ' is-done' : ''}`}>
                <span className="town-album-icon" aria-hidden="true">
                  <Icon icon={c.done > 0 ? Trophy : Lock} size={16} />
                </span>
                <div className="town-album-main">
                  <div className="town-album-head">
                    <p className="town-album-name">{shown.achievement.name}</p>
                    {c.steps.length > 1 && (
                      <span className="town-album-steps" role="img" aria-label={tl`Đã đạt ${c.done} / ${c.steps.length} bậc`}>
                        {c.steps.map((s) => (
                          <span key={s.achievement.id} className={s.unlockedAt !== null ? 'is-on' : undefined} />
                        ))}
                      </span>
                    )}
                  </div>
                  {done ? (
                    <p className="town-album-sub">Xong cả chuỗi · danh hiệu “{shown.achievement.title}”</p>
                  ) : (
                    <>
                      <p className="town-album-sub">{shown.achievement.blurb}</p>
                      <div className="town-album-meter">
                        <div className="town-album-bar" role="progressbar" aria-valuemin={0} aria-valuemax={shown.target} aria-valuenow={shown.value} aria-label={shown.achievement.name}>
                          <span style={{ width: `${Math.round(shown.progress * 100)}%` }} />
                        </div>
                        <span className="town-album-count">{progressText(shown, shown.achievement.metric)}</span>
                      </div>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {tab === 'achievements' && reached.length > 0 && (
        <details className="how town-album-reached">
          <summary>Đã đạt ({reached.length})</summary>
          <ul className="town-album-reached-list">
            {reached.map((a) => (
              <li key={a.achievement.id}>
                <span className="town-album-reached-name">{a.achievement.name}</span>
                <span className="town-album-count">
                  “{a.achievement.title}” · {shortDate(a.unlockedAt!)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {tab === 'projects' && (
        <div className="stack-sm">
          <p className="town-album-lead">{tl`Xong ${doneProjects} / ${game.projects.length} dự án. Đây là việc lớn của cả thị trấn, góp dần qua nhiều ngày nghe. Xong việc nào, thị trấn có thêm một thứ mới, giữ mãi.`}</p>
          <ul className="town-album-list" aria-label="Dự án thị trấn">
            {game.projects.map((p) => {
              const done = p.unlockedAt !== null;
              const deco = DECORATION_NAME[p.project.decoration];
              return (
                <li key={p.project.id} className={`town-album-row is-project${done ? ' is-done' : ''}`}>
                  <span className="town-album-icon" aria-hidden="true">
                    <Icon icon={done ? Check : Landmark} size={18} />
                  </span>
                  <div className="town-album-main">
                    <p className="town-album-name">{p.project.name}</p>
                    <p className="town-album-sub">{p.project.blurb}</p>
                    {!done && (
                      <>
                        <div className="town-album-bar" role="progressbar" aria-valuemin={0} aria-valuemax={p.target} aria-valuenow={p.value} aria-label={p.project.name}>
                          <span style={{ width: `${Math.round(p.progress * 100)}%` }} />
                        </div>
                        <p className="town-album-count">{progressText(p, p.project.metric)}</p>
                      </>
                    )}
                    <p className="town-album-adds">{done ? tl`Đã có ${deco}, ${DECORATION_WHERE[p.project.decoration]}.` : tl`Xong sẽ có ${deco}.`}</p>
                    <p className="town-album-count">
                      Danh hiệu “{p.project.title}”{done ? tl` · xong ngày ${shortDate(p.unlockedAt!)}` : ''}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {tab === 'fish' && (
        <div className="stack-sm">
          <div className="town-album-fish">
            <Icon icon={Fish} size={22} />
            <p>
              Đã câu được <strong>{album.caught}</strong> trong {album.total} loài cá
              {album.catches > 0 ? tl`, tổng cộng ${album.catches} con.` : '.'}
            </p>
          </div>
          <ul className="town-album-tiers" aria-label="Theo độ hiếm">
            {RARITIES.map((r) => (
              <li key={r}>
                <span className="town-album-tier">
                  <TierGem tier={r} />
                  {RARITY[r].name}
                </span>
                <span className="town-album-tier-n">
                  {album.byTier[r].caught} / {album.byTier[r].total}
                </span>
              </li>
            ))}
          </ul>
          <p className="town-album-lead">Mỗi loài cá “nói” một hiện tượng nối âm. Xem từng loài và câu thêm ở bến cá: Chơi → Câu cá.</p>
          <button type="button" className="btn btn-ghost btn-sm town-album-go" onClick={onClose}>
            Về thị trấn
          </button>
        </div>
      )}
    </div>
  );
}
