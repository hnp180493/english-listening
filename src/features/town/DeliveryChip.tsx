// An order for Emma being carried through the town (docs/town.md §18): a small chip over the stage while it is on its
// way ("Nghe lại" says Emma's words again, a wrong person leaves a note), then a card for how it ended: the one it was
// for thanks the learner in their own voice (their shipped gift reaction), or it went cold. From there the day goes on:
// another order, or the chapter of the mystery that is open today.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Package, RotateCcw, Search, X } from 'lucide-react';
import { Icon } from '../../components/Icon';
import SpokenSentence from '../../components/SpokenSentence';
import { caseNow } from '../../core/town/cases';
import { useTownCases } from '../../core/town/casesStore';
import { deliveriesLeftNow, dropDelivery, noteDeliveryPlay, useCarrying } from '../../core/town/deliveryStore';
import { storyLinePlayback } from '../../core/town/storyAudio';
import { speak } from '../../core/tts';
import { TOWN_CASES } from '../../data/cases';
import { townPlace } from '../../data/town';
import type { PlaceId } from '../../data/townWorld';
import { safeDecode } from '../dictation/decodeCache';
import { sayDelivery } from './activities/deliveryAudio';
import type { ActivityId } from './activities/types';
import { Coin, Portrait } from './art';
import './activities/delivery.css';

const nameOf = (id: string | null | undefined): string => (id ? (townPlace(id)?.resident ?? '') : '');

export default function DeliveryChip({ onOpen }: { onOpen: (id: ActivityId) => void }) {
  const c = useCarrying();
  const cases = useTownCases();
  const [now] = useState(() => Date.now());
  // the one it was for thanks the learner once, as the card comes up
  const thanked = useRef<string | null>(null);
  const thanks = c?.state === 'done' ? (c.result?.thanks ?? null) : null;
  const to = c?.order.to ?? '';
  useEffect(() => {
    if (!thanks || thanked.current === c?.order.id) return;
    thanked.current = c?.order.id ?? null;
    const p = storyLinePlayback(thanks, { placeId: to }, 'connected');
    void speak(p.text, { mode: p.mode, voice: p.voice, browserOnly: true });
  }, [thanks, to, c?.order.id]);
  const decoded = useMemo(() => (c ? safeDecode(c.order.text) : null), [c]);
  if (!c) return null;

  if (c.state === 'carrying') {
    return (
      <div className="town-dl-chip" role="status">
        <Icon icon={Package} size={16} />
        <span className="town-dl-chip-text">{c.wrong ? `${nameOf(c.wrong)} bảo không phải của mình. Còn 1 lần thử.` : 'Đang giao một món cho Emma'}</span>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            noteDeliveryPlay();
            void sayDelivery(c.order);
          }}
        >
          <Icon icon={RotateCcw} size={15} />
          Nghe lại
        </button>
        <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={dropDelivery} aria-label="Bỏ đơn này" title="Bỏ đơn này">
          <Icon icon={X} size={16} />
        </button>
      </div>
    );
  }

  const done = c.state === 'done';
  const left = deliveriesLeftNow();
  const open = caseNow(TOWN_CASES, cases, now);
  return (
    <div className="town-dl-card" role="dialog" aria-label={done ? 'Đã giao xong' : 'Món đã nguội'}>
      <div className="town-dl-emma">
        <Portrait placeId={c.order.to as PlaceId} size={56} mood={done ? 'happy' : 'neutral'} />
        <div>
          <p className="town-dl-name">{done ? `Đã giao cho ${nameOf(c.order.to)}` : `Món này là của ${nameOf(c.order.to)}`}</p>
          <p className="town-dl-sub">
            {done ? (
              <>
                {c.result && c.result.xu > 0 && (
                  <>
                    <Coin size={14} /> +{c.result.xu} xu
                  </>
                )}
                {c.result && c.result.bond > 0 ? ` · thân thiết +${c.result.bond}` : ''}
              </>
            ) : (
              'Đưa nhầm hai người nên món nguội mất rồi.'
            )}
          </p>
        </div>
      </div>
      {done && thanks && (
        <div className="town-dl-said">
          <p className="town-dl-en" lang="en">
            {thanks.text}
          </p>
          <p className="town-dl-vi">{thanks.vi}</p>
        </div>
      )}
      <div className="town-dl-said">
        <p className="town-dl-sub">Emma đã nói</p>
        {decoded && decoded.tokens.length > 0 ? (
          <SpokenSentence result={decoded} compact />
        ) : (
          <p className="town-dl-en" lang="en">
            {c.order.text}
          </p>
        )}
        <p className="town-dl-vi">{c.order.vi}</p>
      </div>
      <div className="town-talk-foot">
        {open.kind === 'open' && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              dropDelivery();
              onOpen('case');
            }}
          >
            <Icon icon={Search} size={16} />
            Vụ án: kỳ {open.chapter + 1} đang mở
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary"
          autoFocus
          onClick={() => {
            dropDelivery();
            if (left > 0) onOpen('delivery');
          }}
        >
          {left > 0 ? `Đơn tiếp theo (còn ${left})` : 'Xong'}
        </button>
      </div>
    </div>
  );
}
