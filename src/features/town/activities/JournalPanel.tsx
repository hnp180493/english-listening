// "Sổ tay" (docs/town.md §12 "Thân thiết"): every resident with the friendship score, and one page per resident:
// what the learner knows about them, what they remember about the learner, the gifts they said they like (only once
// heard), the next episode and what it waits for, the choices made. Also the one setting of the greetings. Opened from
// the HUD's "Chơi", and at a resident from their hearts (a conversation's header, the map card).

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Footprints } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import { useTownOverview, useTownProgress } from '../../../core/town/store';
import { TOWN_PLACES } from '../../../data/town';
import type { PlaceId } from '../../../data/townWorld';
import { Hearts, HeartIcon, Portrait } from '../art';
import { heartsText, residentJournal, toNextText } from '../friends/friendModel';
import { setTownUi, useTownUi } from '../townUi';
import type { ActivityPanelProps } from './types';
import '../friends/friends.css';

const TASTE_LABEL = { loves: 'Rất thích', likes: 'Thích', dislikes: 'Không thích' } as const;

export default function JournalPanel({ focus, onTalk }: ActivityPanelProps) {
  const [open, setOpen] = useState<string | null>(() => (focus && TOWN_PLACES.some((p) => p.id === focus) ? focus : null));
  return open ? <ResidentPage placeId={open} onBack={() => setOpen(null)} onTalk={onTalk} /> : <ResidentList onOpen={setOpen} />;
}

function ResidentList({ onOpen }: { onOpen: (id: string) => void }) {
  const overview = useTownOverview();
  const ui = useTownUi();
  // the closest friends first, then the town's order
  const rows = [...overview.places].sort((a, b) => b.friend.points - a.friend.points);
  return (
    <div className="town-journal">
      <ul className="town-journal-list" aria-label="Người dân">
        {rows.map((p) => (
          <li key={p.place.id}>
            <button type="button" className="town-journal-row" onClick={() => onOpen(p.place.id)}>
              <Portrait placeId={p.place.id as PlaceId} size={40} />
              <span className="town-journal-who">
                <span className="town-journal-name">{p.place.resident}</span>
                <span className="town-journal-sub">
                  {p.friend.points > 0 ? `${heartsText(p.friend.hearts)} · ${p.friend.title}` : 'Chưa quen'}
                  {p.friendEpisode ? ` · Tập ${p.friendEpisode.order} cần ${p.friendEpisode.hearts ?? p.friend.hearts} tim` : ''}
                </span>
              </span>
              {p.friend.hearts > 0 && (
                <span className="town-journal-hearts" aria-hidden="true">
                  <HeartIcon on size={14} />
                  <span className="tabular">{p.friend.hearts}</span>
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      <label className="town-journal-setting">
        <input type="checkbox" checked={ui.greet} onChange={(e) => setTownUi({ greet: e.target.checked })} />
        <span>
          Lời chào của cư dân
          <span className="town-journal-sub">Lại gần ai đó, họ chào bạn một câu (cần bật âm thanh trò chơi).</span>
        </span>
      </label>
      <p className="town-friend-note">Thân thiết là điểm trò chơi: nghe ai nhiều thì thân với người đó. Không phải thước đo khả năng nghe.</p>
    </div>
  );
}

function ResidentPage({ placeId, onBack, onTalk }: { placeId: string; onBack: () => void; onTalk?: (placeId: string) => void }) {
  const progress = useTownProgress();
  const [now] = useState(() => Date.now());
  const j = residentJournal(progress, placeId, now);
  const backRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    backRef.current?.focus({ preventScroll: true });
  }, [placeId]);
  const nothing = j.about.length === 0 && j.remembers.length === 0 && j.gifts.length === 0 && j.choices.length === 0;
  const canGo = j.next.status === 'ready' || j.next.status === 'relisten';
  return (
    <div className="town-journal">
      <button ref={backRef} type="button" className="btn btn-ghost btn-sm town-journal-back" onClick={onBack}>
        <Icon icon={ArrowLeft} size={15} />
        Tất cả mọi người
      </button>
      <header className="town-journal-head">
        <Portrait placeId={placeId as PlaceId} size={64} />
        <div className="town-journal-who">
          <h3 className="town-journal-title">{j.resident}</h3>
          <Hearts value={j.friend.hearts} name={j.resident} size={14} />
          <span className="town-journal-sub">
            {j.friend.points > 0 ? `${j.resident} coi bạn là ${j.friend.title}. ${toNextText(j.friend)}` : `Chưa quen. Nghe ${j.resident} kể chuyện để thân hơn.`}
          </span>
        </div>
      </header>

      <section className="town-journal-sec" aria-label="Tập tiếp theo">
        <h4 className="town-build-h">Tập tiếp theo</h4>
        <p className="town-journal-text">{j.next.text}</p>
        {canGo && onTalk && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onTalk(placeId)}>
            <Icon icon={Footprints} size={15} />
            Tới gặp {j.resident}
          </button>
        )}
      </section>

      {j.about.length > 0 && (
        <section className="town-journal-sec">
          <h4 className="town-build-h">Bạn biết về {j.resident}</h4>
          <ul className="town-journal-facts">
            {j.about.map((f) => (
              <li key={f.id}>{f.vi}</li>
            ))}
          </ul>
        </section>
      )}
      {j.gifts.length > 0 && (
        <section className="town-journal-sec">
          <h4 className="town-build-h">Quà</h4>
          <ul className="town-journal-facts">
            {j.gifts.map((g) => (
              <li key={g.gift.id}>
                <span>
                  <span className={'town-journal-taste is-' + g.taste}>{TASTE_LABEL[g.taste]}:</span> {g.gift.name}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {j.remembers.length > 0 && (
        <section className="town-journal-sec">
          <h4 className="town-build-h">{j.resident} nhớ về bạn</h4>
          <ul className="town-journal-facts">
            {j.remembers.map((f) => (
              <li key={f.id}>{f.vi}</li>
            ))}
          </ul>
        </section>
      )}
      {j.choices.length > 0 && (
        <section className="town-journal-sec">
          <h4 className="town-build-h">Bạn đã chọn</h4>
          <ul className="town-journal-facts">
            {j.choices.map((c) => (
              <li key={c.episode + c.intent}>
                <span className="town-journal-sub">{c.episode}</span>
                <span>
                  {c.intent}: “{c.vi}”
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {nothing && <p className="town-build-hint">Sổ tay còn trống. Điều {j.resident} kể, món {j.resident} thích và lựa chọn của bạn sẽ được ghi ở đây.</p>}
    </div>
  );
}
