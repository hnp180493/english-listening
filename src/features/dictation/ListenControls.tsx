import { AudioLines, LoaderCircle, Play, Square, Turtle, VolumeX } from 'lucide-react';
import { Icon } from '../../components/Icon';
import { PENDING_ARIA, PENDING_LABEL } from '../../components/pendingLabel';
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
          title="Đọc chậm (0.7×)"
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
          title="Đọc từng cụm âm, có ngắt nghỉ"
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
