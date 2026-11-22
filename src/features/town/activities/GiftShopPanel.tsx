// "Tiệm quà" (docs/town.md §12 "Thân thiết"): gifts bought with xu, given to residents one a day each. What someone
// loves is said in their own talks, so picking the right gift is a listening test, not a guess: the shop never says
// who likes what (the Sổ tay keeps what the learner heard).
//
// Why a panel of its own and not a tab of the build sheet: building is about the town, gifts are about people, and the
// other shops (Tiệm trứng) are activity panels too. It has no spot in the world: it opens from the HUD's "Chơi".

import { useState } from 'react';
import { Gift } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import { giftInHand } from '../../../core/town/friendship';
import { buyTownGift, useTownOverview, useTownProgress } from '../../../core/town/store';
import { TOWN_GIFTS, type TownGift } from '../../../data/townGifts';
import { useTownLife } from '../../../core/town/lifeStore';
import { Coin } from '../art';
import { playSfx } from '../sfx';
import { xu } from '../shellModel';
import { GIFT_RULES } from '../friends/friendModel';
import type { ActivityPanelProps } from './types';
import '../friends/friends.css';

export default function GiftShopPanel({ sound, onReward }: ActivityPanelProps) {
  const progress = useTownProgress();
  const { balance } = useTownOverview();
  const [note, setNote] = useState<string | null>(null);
  // the bouquet and the ring only once the learner has made their character (docs/town.md §15)
  const courting = !!useTownLife().profile;
  const buy = (id: string, name: string, romance = false) => {
    const r = buyTownGift(id);
    if (!r.ok) {
      setNote(r.reason === 'poor' ? `Còn thiếu ${xu(r.missing)}.` : 'Chưa mua được, thử lại nhé.');
      return;
    }
    playSfx('pop', sound);
    setNote(romance ? `Đã mua ${name}. Đứng cạnh người ấy rồi bấm “Hẹn hò”.` : `Đã mua ${name}. Đứng cạnh ai đó rồi bấm “Tặng quà”.`);
    onReward({ label: `Đã mua ${name}` });
  };
  return (
    <div className="town-shop">
      <p className="town-build-hint">{GIFT_RULES}</p>
      <p className="town-shop-balance">
        Bạn có <Coin size={16} />
        <span className="tabular">{balance}</span>
        <span className="sr-only"> xu</span>
      </p>
      <ul className="town-shop-list" aria-label="Các món quà">
        {TOWN_GIFTS.filter((g) => !g.romance).map(row)}
      </ul>
      {courting && (
        <>
          <h3 className="town-shop-head">Hẹn hò</h3>
          <ul className="town-shop-list" aria-label="Hoa và nhẫn">
            {TOWN_GIFTS.filter((g) => g.romance).map(row)}
          </ul>
        </>
      )}
      <p className="town-build-hint" role="status">
        {note ?? ''}
      </p>
    </div>
  );

  function row(g: TownGift) {
    const held = giftInHand(progress, g.id);
    const poor = g.cost > balance;
    return (
      <li key={g.id} className="town-shop-row">
        <span className="town-gift-icon" aria-hidden="true">
          <Icon icon={Gift} size={18} />
        </span>
        <span className="town-shop-name">
          <span>{g.name}</span>
          <span className="town-shop-en" lang="en">
            {g.en}
          </span>
        </span>
        {held > 0 && <span className="town-gift-n tabular">Có {held}</span>}
        <button type="button" className="btn btn-sm" onClick={() => buy(g.id, g.name, !!g.romance)} disabled={poor} aria-label={`Mua ${g.name}, ${xu(g.cost)}`}>
          <Coin size={15} />
          <span className="tabular">{g.cost}</span>
        </button>
      </li>
    );
  }
}
