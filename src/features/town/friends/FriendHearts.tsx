// The friendship score beside a resident's name (a conversation's header, the map card): one heart, "3/10" and a thin
// bar to the next heart. A tap opens what it means and "Mở Sổ tay". Nothing before the first point is won.

import { BookOpen } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import Popover from '../../../components/Popover';
import type { FriendView } from '../../../core/town/friendship';
import { HeartIcon, Hearts } from '../art';
import { heartsText, toNextText } from './friendModel';
import './friends.css';
import { tl } from '../../../i18n';

export interface FriendHeartsProps {
  friend: FriendView;
  name: string;
  /** "Mở Sổ tay" at this resident (omitted: no button). */
  onJournal?: () => void;
  /** The score just grew (the pill pops once). */
  fresh?: boolean;
}

export default function FriendHearts({ friend, name, onJournal, fresh = false }: FriendHeartsProps) {
  if (friend.points <= 0) return null;
  return (
    <Popover
      className="town-friend"
      triggerClassName={'town-friend-pill' + (fresh ? ' is-new' : '')}
      triggerLabel={tl`Thân với ${name}: ${heartsText(friend.hearts)}. Xem thêm`}
      trigger={
        <>
          <HeartIcon on={friend.hearts > 0} size={15} />
          <span className="tabular">{friend.hearts}</span>
          <span className="town-friend-bar" aria-hidden="true">
            <i style={{ width: `${Math.round(friend.part * 100)}%` }} />
          </span>
        </>
      }
      title={tl`Thân với ${name}`}
    >
      {(close) => (
        <div className="town-friend-pop">
          <Hearts value={friend.hearts} name={name} size={15} />
          <p className="town-friend-line">
            {heartsText(friend.hearts)} · {tl`${name} coi bạn là ${friend.title}.`} {toNextText(friend)}
          </p>
          <p className="town-friend-note">{tl`Điểm đến từ việc nghe ${name} nói: nghe xong một tập chuyện, trò chuyện hiểu được, tặng món họ từng nói là thích. Đây là điểm trò chơi, không đo khả năng nghe.`}</p>
          {onJournal && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                close();
                onJournal();
              }}
            >
              <Icon icon={BookOpen} size={15} />
              Mở Sổ tay
            </button>
          )}
        </div>
      )}
    </Popover>
  );
}
