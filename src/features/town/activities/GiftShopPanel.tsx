// "Tiệm quà" (docs/town.md §12 "Thân thiết"): gifts bought with xu, given to residents one a day each. What someone
// loves is said in their own talks, so picking the right gift is a listening test, not a guess: the shop never says
// who likes what (the Sổ tay keeps what the learner heard).
//
// Why a panel of its own and not a tab of the build sheet: building is about the town, gifts are about people, and the
// other shops (Tiệm trứng) are activity panels too. It has no spot in the world: it opens from the HUD's "Chơi".
// The gifts are small tiles two or more to a row (a tap buys one), so the shop fits without a long scroll.

import { useState } from 'react';
import { CircleHelp } from 'lucide-react';
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
      <p className="town-shop-balance">
        Bạn có <Coin size={16} />
        <span className="tabular">{balance}</span>
        <span className="sr-only"> xu</span>
      </p>
      <p className="town-build-hint town-shop-note" role="status">
        {note ?? ''}
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
      <details className="how">
        <summary>
          <Icon icon={CircleHelp} size={18} />
          Tặng quà thế nào?
        </summary>
        <p>{GIFT_RULES}</p>
      </details>
    </div>
  );

  function row(g: TownGift) {
    const held = giftInHand(progress, g.id);
    const poor = g.cost > balance;
    return (
      <li key={g.id}>
        <button type="button" className="town-shop-tile" onClick={() => buy(g.id, g.name, !!g.romance)} disabled={poor} aria-label={`Mua ${g.name}, ${xu(g.cost)}${held > 0 ? `, đang có ${held}` : ''}`}>
          <span className="town-shop-name">
            {g.name}
            {held > 0 && <span className="town-gift-n tabular"> · có {held}</span>}
          </span>
          <span className="town-shop-foot">
            <span className="town-shop-en" lang="en">
              {g.en}
            </span>
            <span className="town-shop-cost">
              <Coin size={14} />
              <span className="tabular">{g.cost}</span>
            </span>
          </span>
        </button>
      </li>
    );
  }
}
