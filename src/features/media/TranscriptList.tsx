// Scrollable list of all practice units; the current one is highlighted and kept in view.

import { memo, useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { Icon } from '../../components/Icon';
import { formatClock } from '../../core/media/transcript';
import { scrollBehavior } from '../../core/motion';
import { wordCount, type MediaUnit } from './library';

interface Props {
  units: MediaUnit[];
  current: number;
  done: readonly number[];
  scores: Record<number, number>;
  /** Hide the text of sentences not yet done (dictation mode / subtitles off). */
  mask: boolean;
  /** A masked sentence whose answer is already on screen (just checked); -1 for none. */
  revealed?: number;
  onJump: (index: number) => void;
}

function TranscriptList({ units, current, done, scores, mask, revealed = -1, onJump }: Props) {
  const listRef = useRef<HTMLOListElement>(null);
  const doneSet = new Set(done);

  useEffect(() => {
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>(`[data-idx="${current}"]`);
    if (!list || !el) return;
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    if (top < list.scrollTop || bottom > list.scrollTop + list.clientHeight) {
      list.scrollTo({ top: Math.max(0, top - list.clientHeight / 3), behavior: scrollBehavior() });
    }
  }, [current]);

  return (
    <ol ref={listRef} className="media-list" aria-label="Danh sách câu">
      {units.map((u, i) => {
        const isDone = doneSet.has(i);
        const hidden = mask && !isDone && i !== revealed;
        const score = scores[i];
        return (
          <li key={i} data-idx={i}>
            <button
              type="button"
              className={'media-list-item' + (i === current ? ' is-current' : '') + (isDone ? ' is-done' : '')}
              aria-current={i === current ? 'true' : undefined}
              aria-label={hidden ? `Câu ${i + 1}, ${formatClock(u.start)} (đang ẩn)` : undefined}
              onClick={() => onJump(i)}
            >
              <span className="media-list-time">{formatClock(u.start)}</span>
              <span className="media-list-text" lang="en">
                {hidden ? (
                  <span className="media-list-mask">
                    {'•••'} <span className="muted">({wordCount(u.text)} từ)</span>
                  </span>
                ) : (
                  u.text
                )}
              </span>
              <span className="media-list-mark" aria-label={isDone ? 'đã xong' : undefined}>
                {isDone ? (
                  <Icon icon={Check} size={14} strokeWidth={2.6} />
                ) : score !== undefined ? (
                  `${Math.round(score * 100)}%`
                ) : (
                  ''
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export default memo(TranscriptList);
