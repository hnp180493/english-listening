import { AudioLines, LoaderCircle, Play, Square, Turtle, VolumeX } from 'lucide-react';
import { Icon } from '../../components/Icon';
import { PENDING_ARIA, PENDING_LABEL } from '../../components/pendingLabel';
import { CAREFUL_ARIA, CAREFUL_LABEL, CAREFUL_TITLE, CONNECTED_SLOW_TITLE, CONNECTED_TITLE } from '../../core/playback';
import type { Player } from './usePlayer';

/**
 * The three listen buttons (normal / slow / chunks) + the chunk progress dots, in an inset panel.
 * `emphasis`: the "Nghe" button is the view's primary action (nothing heard or typed yet); otherwise it is a soft button.
 */
export default function ListenControls({ player, emphasis = false }: { player: Player; emphasis?: boolean }) {
  const { canSpeak, playing, pending, plays, chunkPos, chunkCount, play } = player;
  // AI voice: a spinner while the clip is generated (a click still stops).
  const stopIcon = pending ? (
    <Icon icon={LoaderCircle} size={14} className="icon-spin" />
  ) : (
    <Icon icon={Square} size={14} fill="currentColor" strokeWidth={1.5} />
  );
  return (
    <div className="panel dict-listen-panel">
      <div className="dict-listen" role="group" aria-label="Nghe câu">
        <button
          type="button"
          className={'btn btn-lg dict-play ' + (emphasis ? 'btn-primary' : 'btn-soft')}
          onClick={() => void play('normal')}
          disabled={!canSpeak}
          aria-pressed={playing === 'normal'}
          aria-busy={(pending && playing === 'normal') || undefined}
          aria-label={pending && playing === 'normal' ? PENDING_ARIA : undefined}
          aria-keyshortcuts="Escape"
          title={CONNECTED_TITLE}
        >
          {playing === 'normal' ? stopIcon : <Icon icon={Play} size={17} fill="currentColor" strokeWidth={1.5} />}
          {playing === 'normal' ? (pending ? PENDING_LABEL : 'Dừng') : plays > 0 ? 'Nghe lại' : 'Nghe'}
        </button>
        <button
          type="button"
          className="btn btn-lg dict-play-alt"
          onClick={() => void play('slow')}
          disabled={!canSpeak}
          aria-pressed={playing === 'slow'}
          aria-busy={(pending && playing === 'slow') || undefined}
          aria-label={pending && playing === 'slow' ? PENDING_ARIA : undefined}
          title={CONNECTED_SLOW_TITLE}
        >
          {playing === 'slow' ? stopIcon : <Icon icon={Turtle} size={17} />}
          <span className="dict-play-label">{playing === 'slow' ? (pending ? PENDING_LABEL : 'Dừng') : 'Chậm'}</span>
        </button>
        <button
          type="button"
          className="btn btn-lg dict-play-alt"
          onClick={() => void play('chunks')}
          disabled={!canSpeak}
          aria-pressed={playing === 'chunks'}
          aria-busy={(pending && playing === 'chunks') || undefined}
          aria-label={pending && playing === 'chunks' ? PENDING_ARIA : undefined}
          title="Đọc từng cụm âm, có ngắt nghỉ (giọng trình duyệt)"
        >
          {playing === 'chunks' ? stopIcon : <Icon icon={AudioLines} size={17} />}
          <span className="dict-play-label">{playing === 'chunks' ? (pending ? PENDING_LABEL : 'Dừng') : 'Từng cụm'}</span>
        </button>
      </div>
      {playing === 'chunks' && chunkCount > 0 && (
        <div className="dict-chunks" aria-live="polite">
          <span className="dict-chunks-k">
            Cụm {Math.max(1, chunkPos + 1)}/{chunkCount}
          </span>
          <span className="dict-dots" aria-hidden="true">
            {Array.from({ length: chunkCount }, (_, k) => (
              <i key={k} className={k === chunkPos ? 'is-on' : k < chunkPos ? 'is-done' : ''} />
            ))}
          </span>
        </div>
      )}
      {!canSpeak && (
        <div className="callout callout-warn dict-banner" role="alert">
          <Icon icon={VolumeX} size={16} />
          <div>Trình duyệt này không có giọng đọc tiếng Anh. Hãy dùng Chrome, Edge hoặc Safari bản mới.</div>
        </div>
      )}
    </div>
  );
}

/**
 * "Nghe rõ từng từ": the standard written text, slower: the contrast to the connected audio. Shown only after the
 * answer is checked (before, it would give the sentence away). A quiet ghost button under "how it is said".
 */
export function CarefulListen({ player }: { player: Player }) {
  const { canSpeak, playing, pending, play } = player;
  if (!canSpeak) return null;
  const on = playing === 'careful';
  return (
    <div className="dict-careful">
      <button
        type="button"
        className={'btn btn-ghost btn-sm' + (on ? ' is-playing' : '')}
        onClick={() => void play('careful')}
        aria-pressed={on}
        aria-busy={(pending && on) || undefined}
        aria-label={on ? undefined : CAREFUL_ARIA}
        title={`${CAREFUL_TITLE}, chậm: so với cách nói nhanh ở trên`}
      >
        {on ? (
          pending ? (
            <Icon icon={LoaderCircle} size={14} className="icon-spin" />
          ) : (
            <Icon icon={Square} size={14} fill="currentColor" strokeWidth={1.5} />
          )
        ) : (
          <Icon icon={Turtle} size={15} />
        )}
        {on ? (pending ? PENDING_LABEL : 'Dừng') : CAREFUL_LABEL}
      </button>
      <span className="dict-small">để so với cách nói nhanh</span>
    </div>
  );
}
