// "Tủ đồ" (docs/town.md §10): the player dressed live (the preview moves: he breathes, the pet looks round), four
// tabs (Mũ / Áo / Thú cưng / Danh hiệu). What is owned can be worn at a click (core/town/gameStore equipTownItem,
// the town shows it at once); what is not owned yet shows as a silhouette with how to get it. Nothing is sold here.

import { useState } from 'react';
import { Award, Check, Sparkles } from 'lucide-react';
import Segmented from '../../../components/Segmented';
import { Icon } from '../../../components/Icon';
import { equipTownItem, useTownGame } from '../../../core/town/gameStore';
import type { LookSlot } from '../../../core/town/progress';
import { LOOT, RARITY, type LootItem } from '../../../data/townGame';
import { playSfx } from '../sfx';
import type { ActivityPanelProps } from './types';
import { LootPicture, PlayerPreview } from './eggs/LootPicture';
import { TierGem } from './eggs/TierGem';
import { lockedTitleCount, NONE_LABEL, TITLE_FROM, WARDROBE_TABS, type WardrobeTab } from './wardrobe/wardrobeModel';
import './eggs/eggs.css';
import './wardrobe/wardrobe.css';
import { tl, tr } from '../../../i18n';

export default function WardrobePanel({ sound }: ActivityPanelProps) {
  const game = useTownGame();
  const [tab, setTab] = useState<WardrobeTab>('hat');
  const [failed, setFailed] = useState(false);
  const look = { hat: game.look.hat?.id ?? null, outfit: game.look.outfit?.id ?? null, pet: game.look.pet?.id ?? null };
  const worn: Record<LookSlot, string | null> = { ...look, title: game.look.title?.id ?? null };
  const owned = new Set(game.owned.map((i) => i.id));

  const wear = (slot: LookSlot, id: string | null) => {
    if (worn[slot] === id) return;
    const r = equipTownItem(slot, id);
    setFailed(!r.ok);
    if (r.ok) playSfx('pop', sound);
  };

  const counts = Object.fromEntries(WARDROBE_TABS.map((t) => [t.id, t.id === 'title' ? game.titles.length : game.owned.filter((i) => i.kind === t.id).length])) as Record<WardrobeTab, number>;
  const items = tab === 'title' ? [] : LOOT.filter((i) => i.kind === tab);

  const tile = (item: LootItem) => {
    const has = owned.has(item.id);
    const on = worn[tab] === item.id;
    const body = (
      <>
        <LootPicture item={item} size={64} silhouette={!has} />
        <span className="town-wd-name">{has ? item.name : 'Chưa có'}</span>
        <span className="town-wd-tier">
          <TierGem tier={item.tier} size={10} />
          {RARITY[item.tier].name}
        </span>
        {on && (
          <span className="town-wd-on">
            <Icon icon={Check} size={14} />
            Đang dùng
          </span>
        )}
      </>
    );
    return (
      <li key={item.id}>
        {has ? (
          <button type="button" className={`town-wd-tile${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => wear(tab, item.id)}>
            {body}
          </button>
        ) : (
          <div className="town-wd-tile is-locked" aria-label={tl`Chưa có: một món ${tr(RARITY[item.tier].name).toLowerCase()}, ra từ trứng`}>
            {body}
          </div>
        )}
      </li>
    );
  };

  const lockedEggTitles = LOOT.filter((i) => i.kind === 'title' && !owned.has(i.id));
  const moreTitles = lockedTitleCount(game.titles);

  return (
    <div className="town-wd">
      <div className="town-wd-preview">
        <PlayerPreview look={look} width={200} height={128} />
        <p className="town-wd-title-worn">
          <Icon icon={Award} size={16} />
          {game.look.title ? game.look.title.name : 'Chưa đeo danh hiệu'}
        </p>
      </div>

      <Segmented
        ariaLabel="Loại đồ"
        block
        value={tab}
        onChange={setTab}
        options={WARDROBE_TABS.map((t) => ({ value: t.id, label: t.label, title: tl`${t.label}: có ${counts[t.id]}` }))}
      />

      {failed && <p className="town-wd-hint">Món này chưa có trên máy này (có thể chưa đồng bộ xong).</p>}

      {tab !== 'title' && items.some((i) => !owned.has(i.id)) && <p className="town-wd-hint">Ô mờ là món chưa có. Mọi món đều ra từ trứng ở Tiệm trứng.</p>}

      {tab !== 'title' ? (
        <ul className="town-wd-grid" aria-label={WARDROBE_TABS.find((t) => t.id === tab)?.label}>
          <li>
            <button type="button" className={`town-wd-tile is-none${worn[tab] === null ? ' is-on' : ''}`} aria-pressed={worn[tab] === null} onClick={() => wear(tab, null)}>
              <span className="town-wd-none-pic" aria-hidden="true" />
              <span className="town-wd-name">{NONE_LABEL[tab]}</span>
              {worn[tab] === null && (
                <span className="town-wd-on">
                  <Icon icon={Check} size={14} />
                  Đang dùng
                </span>
              )}
            </button>
          </li>
          {items.map(tile)}
        </ul>
      ) : (
        <div className="stack-sm">
          <ul className="town-wd-titles" aria-label="Danh hiệu">
            <li>
              <button type="button" className={`town-wd-row${worn.title === null ? ' is-on' : ''}`} aria-pressed={worn.title === null} onClick={() => wear('title', null)}>
                <span className="town-wd-row-name">{NONE_LABEL.title}</span>
                {worn.title === null && <Icon icon={Check} size={16} />}
              </button>
            </li>
            {game.titles.map((t) => (
              <li key={t.id}>
                <button type="button" className={`town-wd-row${worn.title === t.id ? ' is-on' : ''}`} aria-pressed={worn.title === t.id} onClick={() => wear('title', t.id)}>
                  <span className="town-wd-row-name">{t.name}</span>
                  <span className="town-wd-row-from">{TITLE_FROM[t.from]}</span>
                  {worn.title === t.id && <Icon icon={Check} size={16} />}
                </button>
              </li>
            ))}
            {lockedEggTitles.map((i) => (
              <li key={i.id} className="town-wd-row is-locked">
                <span className="town-wd-row-name">Chưa có</span>
                <span className="town-wd-row-from">
                  <TierGem tier={i.tier} size={10} />
                  Ấp trứng · {RARITY[i.tier].name}
                </span>
              </li>
            ))}
          </ul>
          {moreTitles > 0 && (
            <p className="town-wd-hint">
              <Icon icon={Sparkles} size={16} />
              Còn {moreTitles} danh hiệu từ thành tích, dự án và cấp thị trấn. Xem cách có ở Sưu tầm.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
