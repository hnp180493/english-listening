// "Gara" (owner, 2026-11-26: "phải có mua đứt luôn chứ, tiền càng nhiều thì đồ càng xịn"): vehicles bought outright
// with xu (data/townGarage.ts), each dearer one faster. Bought ones stay the learner's (the town's `bought` list); one
// is picked (this browser, townUi `ride`) and the "Gọi …" button at the stage's corner brings it, in the town or in
// Westbay (RideButton). No spot in the world: it opens from the HUD's "Chơi".

import { useState } from 'react';
import { Check, CircleHelp } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import { buyTownItem, useTownOverview, useTownProgress } from '../../../core/town/store';
import { GARAGE, type GarageVehicle } from '../../../data/townGarage';
import { Coin } from '../art';
import { pickedVehicle } from '../garagePick';
import { playSfx } from '../sfx';
import { xu } from '../shellModel';
import { setTownUi, useTownUi } from '../townUi';
import type { ActivityPanelProps } from './types';
import '../friends/friends.css';
import { tl, tr } from '../../../i18n';

/** On foot (sim.ts PLAYER_SPEED, tiles/s): "nhanh gấp … lần đi bộ". */
const WALK = 1.6;

export default function GaragePanel({ sound, onReward }: ActivityPanelProps) {
  const progress = useTownProgress();
  const { balance } = useTownOverview();
  const ui = useTownUi();
  const [note, setNote] = useState<string | null>(null);
  const owned = new Set(progress.bought);
  const picked = pickedVehicle(progress.bought, ui.ride);

  const buy = (g: GarageVehicle) => {
    const r = buyTownItem(g.id);
    if (!r.ok) {
      setNote(r.reason === 'poor' ? tl`Còn thiếu ${xu(r.missing)}.` : 'Chưa mua được, thử lại nhé.');
      return;
    }
    playSfx('pop', sound);
    // the one just bought is the one called (it is the best, or the learner wanted it now)
    setTownUi({ ride: g.id });
    setNote(tl`${tr(g.name)} là của bạn. Đóng bảng này rồi bấm “${tr(g.kind === 'horse' ? 'Gọi ngựa' : 'Gọi xe')}” ở góc dưới.`);
    onReward({ label: tl`Đã mua ${tr(g.name)}` });
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
      <ul className="town-shop-list town-garage-list" aria-label="Xe trong gara">
        {GARAGE.map((g) => {
          const mine = owned.has(g.id);
          const using = picked?.id === g.id;
          const times = (g.speed / WALK).toFixed(1);
          return (
            <li key={g.id} className={'town-garage-row' + (using ? ' is-on' : '')}>
              <span className="town-garage-text">
                <span className="town-garage-name">{g.name}</span>
                <span className="town-garage-blurb">{g.blurb}</span>
                <span className="town-garage-speed">{tl`Nhanh gấp ${times} lần đi bộ`}</span>
              </span>
              {!mine ? (
                <button type="button" className="btn btn-soft btn-sm town-garage-btn" onClick={() => buy(g)} disabled={g.cost > balance} aria-label={tl`Mua ${tr(g.name)}, ${xu(g.cost)}`}>
                  <Coin size={14} />
                  <span className="tabular">{g.cost}</span>
                </button>
              ) : using ? (
                <span className="town-garage-using">
                  <Icon icon={Check} size={16} />
                  Đang dùng
                </span>
              ) : (
                <button type="button" className="btn btn-ghost btn-sm town-garage-btn" onClick={() => setTownUi({ ride: g.id })}>
                  Dùng xe này
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <details className="how">
        <summary>
          <Icon icon={CircleHelp} size={18} />
          Xe của mình khác xe mượn thế nào?
        </summary>
        <p>
          Xe đạp công cộng, xe máy cho thuê, xe hãng taxi hay ngựa nông trại thì mượn rồi trả, đậu ở chỗ của nó. Xe mua ở gara là của bạn mãi: bấm “Gọi …” ở góc dưới là xe tới ngay chỗ bạn đứng, ở thị trấn hay ở Westbay. Xe càng đắt chạy càng nhanh. Mua
          bằng xu kiếm được từ việc nghe.
        </p>
      </details>
    </div>
  );
}
