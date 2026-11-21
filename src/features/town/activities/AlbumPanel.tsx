// "Sưu tầm" (docs/town.md §10): the achievements (unlocked ones with their date and title, locked ones with how far
// along they are), the town projects (a bar each, and what they add to the town), and the fish album in short (the
// pond itself is "Câu cá"). Opening it records the goals that need Ôn tập facts (checkTownUnlocks).

import { useEffect, useState } from 'react';
import { Check, Fish, Landmark, Lock, Trophy } from 'lucide-react';
import Segmented from '../../../components/Segmented';
import { Icon } from '../../../components/Icon';
import { checkTownUnlocks, useTownGame } from '../../../core/town/gameStore';
import { RARITIES, RARITY } from '../../../data/townGame';
import type { ActivityPanelProps } from './types';
import { albumOrder, DECORATION_NAME, DECORATION_WHERE, progressText, shortDate } from './album/albumModel';
import { TierGem } from './eggs/TierGem';
import './eggs/eggs.css';
import './album/album.css';

type AlbumTab = 'achievements' | 'projects' | 'fish';

export default function AlbumPanel({ onClose }: ActivityPanelProps) {
  const game = useTownGame();
  const [tab, setTab] = useState<AlbumTab>('achievements');
  useEffect(() => {
    checkTownUnlocks();
  }, []);

  const unlocked = game.achievements.filter((a) => a.unlockedAt !== null).length;
  const doneProjects = game.projects.filter((p) => p.unlockedAt !== null).length;
  const achievements = albumOrder(game.achievements);
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

      {tab === 'achievements' && <p className="town-album-lead">Đã đạt {unlocked} / {game.achievements.length} thành tích. Mỗi thành tích cho một danh hiệu để đeo.</p>}
      {tab === 'achievements' && (
        <ul className="town-album-list" aria-label="Thành tích">
          {achievements.map((a) => {
            const done = a.unlockedAt !== null;
            return (
              <li key={a.achievement.id} className={`town-album-row${done ? ' is-done' : ''}`}>
                <span className="town-album-icon" aria-hidden="true">
                  <Icon icon={done ? Trophy : Lock} size={18} />
                </span>
                <div className="town-album-main">
                  <p className="town-album-name">{a.achievement.name}</p>
                  {done ? (
                    <>
                      <p className="town-album-sub">Danh hiệu “{a.achievement.title}”</p>
                      <p className="town-album-count">Đạt ngày {shortDate(a.unlockedAt!)}</p>
                    </>
                  ) : (
                    <>
                      <p className="town-album-sub">{a.achievement.blurb}</p>
                      <div className="town-album-bar" role="progressbar" aria-valuemin={0} aria-valuemax={a.target} aria-valuenow={a.value} aria-label={a.achievement.name}>
                        <span style={{ width: `${Math.round(a.progress * 100)}%` }} />
                      </div>
                      <p className="town-album-count">{progressText(a, a.achievement.metric)}</p>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {tab === 'projects' && (
        <div className="stack-sm">
          <p className="town-album-lead">Xong {doneProjects} / {game.projects.length} dự án. Đây là việc lớn của cả thị trấn, góp dần qua nhiều ngày nghe. Xong việc nào, thị trấn có thêm một thứ mới, giữ mãi.</p>
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
                    <p className="town-album-adds">{done ? `Đã có ${deco}, ${DECORATION_WHERE[p.project.decoration]}.` : `Xong sẽ có ${deco}.`}</p>
                    <p className="town-album-count">
                      Danh hiệu “{p.project.title}”{done ? ` · xong ngày ${shortDate(p.unlockedAt!)}` : ''}
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
              {album.catches > 0 ? `, tổng cộng ${album.catches} con.` : '.'}
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
