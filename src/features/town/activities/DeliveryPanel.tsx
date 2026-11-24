// "Giao hàng cho Emma" (docs/town.md §18): Emma hands over an order from the café and SAYS who it is for. This panel is
// only the counter's side: hear her, take the order. The carrying happens in the town (../DeliveryChip.tsx): the panel
// closes and the learner walks up to whoever they think she meant.

import { useCallback, useEffect, useState } from 'react';
import { Coffee, Package, RotateCcw, Volume2 } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import { DELIVERY_PER_SHIFT } from '../../../core/town/delivery';
import { deliveriesLeftNow, noteDeliveryPlay, takeDelivery, useCarrying } from '../../../core/town/deliveryStore';
import type { DeliveryOrder } from '../../../core/town/deliveryTypes';
import { useTownCafe } from '../../../core/town/cafeStore';
import { useTownProgress } from '../../../core/town/store';
import { stopSpeaking } from '../../../core/tts';
import { sayDelivery } from './deliveryAudio';
import { Portrait } from '../art';
import type { ActivityPanelProps } from './types';
import './delivery.css';

export default function DeliveryPanel({ onClose, onOpen }: ActivityPanelProps) {
  // re-read what is left when a shift or a delivery is written
  useTownCafe();
  useTownProgress();
  const carrying = useCarrying();
  const [left] = useState(() => deliveriesLeftNow());
  useEffect(() => () => stopSpeaking(), []);

  const hear = useCallback((order: DeliveryOrder) => {
    noteDeliveryPlay();
    void sayDelivery(order);
  }, []);
  const take = useCallback(() => {
    const order = takeDelivery();
    if (order) hear(order);
  }, [hear]);

  // an order in hand: hear Emma again, then go
  if (carrying?.state === 'carrying') {
    return (
      <div className="town-dl">
        <div className="town-dl-emma">
          <Portrait placeId="cafe" size={56} />
          <div>
            <p className="town-dl-name">Emma</p>
            <p className="town-dl-sub">đưa bạn một món và dặn giao cho ai</p>
          </div>
          <button type="button" className="btn btn-sm btn-soft" onClick={() => hear(carrying.order)}>
            <Icon icon={carrying.plays > 0 ? RotateCcw : Volume2} size={15} />
            {carrying.plays > 0 ? 'Nghe lại' : 'Nghe'}
          </button>
        </div>
        <p className="town-build-hint">Nghe xem món này của ai rồi tìm đúng người đó trong thị trấn. Bấm vào họ (hoặc nhà họ) để giao. Đưa nhầm hai người là món nguội mất.</p>
        <div className="town-talk-foot">
          <button type="button" className="btn btn-primary" onClick={onClose} autoFocus>
            <Icon icon={Package} size={16} />
            Đi giao
          </button>
        </div>
      </div>
    );
  }

  if (left <= 0) {
    return (
      <div className="town-dl">
        <p className="town-build-hint">Emma chưa có đơn nào cần giao. Mỗi ca phụ quầy xong, Emma nhờ bạn giao {DELIVERY_PER_SHIFT} đơn cho người trong thị trấn.</p>
        <div className="town-talk-foot">
          <button type="button" className="btn btn-primary" onClick={() => onOpen?.('cafe')}>
            <Icon icon={Coffee} size={16} />
            Phụ quầy cà phê
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="town-dl">
      <div className="town-dl-emma">
        <Portrait placeId="cafe" size={56} />
        <div>
          <p className="town-dl-name">Emma</p>
          <p className="town-dl-sub">còn {left} đơn cần giao hôm nay</p>
        </div>
      </div>
      <p className="town-build-hint">Emma sẽ nói món này của ai. Người bạn càng thân, Emma càng nói tắt: người lạ thì gọi tên, người quen thì tả việc họ làm, bạn thân thì nhắc chuyện riêng của họ.</p>
      <div className="town-talk-foot">
        <button type="button" className="btn btn-primary" onClick={take} autoFocus>
          <Icon icon={Package} size={16} />
          Nhận đơn
        </button>
      </div>
    </div>
  );
}
