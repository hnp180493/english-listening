// "Tặng quà": pick one of the gifts in hand for a resident (one a day each), then hear how they take it (their voiced
// reaction, in their voice) and see what it did to the friendship. The words of the reaction come after it is heard,
// on a tap ("Xem chữ"): listening first. Used in the gift sheet (standing next to someone) and in the result card of a
// conversation.

import { useEffect, useState } from 'react';
import { Eye, Gift, RotateCcw, ShoppingBag } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import { giftedToday, giftsInHand } from '../../../core/town/friendship';
import { giveTownGift, useTownProgress, type TownGiftGive } from '../../../core/town/store';
import { townPlace } from '../../../data/town';
import { SoundBars } from '../art';
import { giftReaction, pointsText, type GiftReactionView } from './friendModel';
import { useSaidLine } from './useSaidLine';
import './friends.css';
import { tl } from '../../../i18n';

export interface GiftGiveProps {
  placeId: string;
  /** A gift was given: the world reacts (an emote over their head, the points). */
  onGiven?: (r: Extract<TownGiftGive, { ok: true }>, view: GiftReactionView) => void;
  /** "Tới Tiệm quà" (no gift in hand). */
  onShop?: () => void;
}

export default function GiftGive({ placeId, onGiven, onShop }: GiftGiveProps) {
  const progress = useTownProgress();
  const resident = townPlace(placeId)?.resident ?? '';
  // the taste is never shown before the gift: it is what they said in their talks (the Sổ tay keeps it)
  const [given, setGiven] = useState<{ r: Extract<TownGiftGive, { ok: true }>; view: GiftReactionView } | null>(null);
  const [showText, setShowText] = useState(false);
  const voice = useSaidLine();
  const { play } = voice;
  const [now] = useState(() => Date.now());

  // the reaction plays as soon as the gift is given (a click: the clip may load)
  const reaction = given?.r.reaction ?? null;
  useEffect(() => {
    if (reaction) void play(reaction, placeId);
  }, [reaction, placeId, play]);

  if (given) {
    const { r, view } = given;
    return (
      <div className="town-gift-said" aria-live="polite">
        <p className={'town-gift-title is-' + r.taste}>{view.title}</p>
        {r.reaction && (
          <div className={'town-bubble' + (voice.sounding ? ' is-live' : '')}>
            <SoundBars on={voice.sounding} />
            <span className="town-bubble-text">{voice.playing ? tl`${resident} đang nói…` : tl`${resident} vừa nói.`}</span>
            <div className="town-bubble-actions">
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => void play(r.reaction!, placeId)} disabled={!voice.canSpeak}>
                <Icon icon={RotateCcw} size={15} />
                Nghe lại
              </button>
              {!showText && (
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setShowText(true)}>
                  <Icon icon={Eye} size={15} />
                  Xem chữ
                </button>
              )}
            </div>
          </div>
        )}
        {r.reaction && showText && (
          <div className="town-gift-text">
            <p className="town-said-plain" lang="en">
              {r.reaction.text}
            </p>
            <p className="town-ep-vi">{r.reaction.vi}</p>
          </div>
        )}
        <p className="town-gift-points">{r.points !== 0 ? pointsText(r.points) : 'Thân thiết đã đủ, không đổi.'}</p>
      </div>
    );
  }

  if (giftedToday(progress, placeId, now)) return <p className="town-build-hint">Hôm nay bạn đã tặng {resident} một món rồi. Mai tặng tiếp nhé.</p>;

  const held = giftsInHand(progress);
  if (held.length === 0) {
    return (
      <div className="town-gift-empty">
        <p className="town-build-hint">Bạn chưa có món quà nào. Quà mua bằng xu ở Tiệm quà; người dân từng nói họ thích gì, nghe kỹ là chọn đúng.</p>
        {onShop && (
          <button type="button" className="btn btn-sm" onClick={onShop}>
            <Icon icon={ShoppingBag} size={15} />
            Tới Tiệm quà
          </button>
        )}
      </div>
    );
  }

  const give = (giftId: string) => {
    const r = giveTownGift(placeId, giftId);
    if (!r.ok) return;
    const view = giftReaction(r.taste, resident);
    setGiven({ r, view });
    onGiven?.(r, view);
  };

  return (
    <div className="town-gift-pick">
      <p className="town-build-hint">Mỗi ngày tặng mỗi người một món. Chọn món {resident} từng nói là thích.</p>
      <ul className="town-gift-list" aria-label="Quà đang có">
        {held.map(({ gift, n }) => (
          <li key={gift.id}>
            <button type="button" className="town-gift-row" onClick={() => give(gift.id)}>
              <span className="town-gift-icon" aria-hidden="true">
                <Icon icon={Gift} size={18} />
              </span>
              <span className="town-gift-name">{gift.name}</span>
              {n > 1 && <span className="town-gift-n tabular">×{n}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
