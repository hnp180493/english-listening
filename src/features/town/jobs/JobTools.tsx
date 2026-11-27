// Three listening tools of Act II's jobs (core/town/jobDoc.ts header §6–8), drawn over the stage as strips like the
// job's others: several threads of talk at once (one heard, a switch for each), short clips with no text to pick the
// right one from by sound alone, and the "Đó!" button pressed when a line is said. The engine (./useCityJob.tsx) plays
// the sound and judges; these only show and take the learner's presses.

import { Hand, Headphones, Play, Radio } from 'lucide-react';
import { Icon } from '../../../components/Icon';
import type { Track } from '../../../core/town/jobDoc';
import { tl } from '../../../i18n';
import { SoundBars } from '../art';

export function JobThreads({ tracks, current, speaking, onSwitch }: { tracks: readonly Track[]; current: string; speaking: boolean; onSwitch: (id: string) => void }) {
  return (
    <div className="town-welcome job-strip job-junction" role="group" aria-label="Nghe chuyện nào">
      <p className="town-welcome-text">
        <span className="town-welcome-name">
          <Icon icon={Headphones} size={16} /> {tl`Đang nghe: ${tracks.find((t) => t.id === current)?.label ?? ''}`}
        </span>
        <span className="job-strip-hear">
          <SoundBars on={speaking} />
          Các chuyện kia vẫn đang diễn ra, bạn không nghe thấy. Chuyển khi cần.
        </span>
      </p>
      <div className="job-turns">
        {tracks.map((t) => (
          <button key={t.id} type="button" className="town-reply job-turn" aria-pressed={t.id === current} onClick={() => onSwitch(t.id)}>
            <span className="town-reply-text">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function JobPick({ count, onPlay, onPick }: { count: number; onPlay: (i: number) => void; onPick: (i: number) => void }) {
  return (
    <div className="town-welcome job-strip job-junction" role="group" aria-label="Chọn đúng đoạn">
      <p className="town-welcome-text">
        <span className="town-welcome-name">Đoạn nào đúng?</span>
        Không có nhãn, không có chữ: nghe từng đoạn bao nhiêu lần cũng được, rồi chọn.
      </p>
      <ul className="job-pick-list">
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="job-pick-row">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onPlay(i)} aria-label={tl`Nghe đoạn ${i + 1}`}>
              <Icon icon={Play} size={15} />
              {tl`Đoạn ${i + 1}`}
            </button>
            <button type="button" className="town-reply job-pick-choose" onClick={() => onPick(i)}>
              <span className="town-reply-text">{tl`Chọn đoạn ${i + 1}`}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function JobSpot({ speaking, pressed, onPress }: { speaking: boolean; pressed: string | null; onPress: () => void }) {
  return (
    <div className="town-welcome job-strip job-junction" role="group" aria-label="Bấm Đó khi nghe thấy">
      <p className="town-welcome-text">
        <span className="town-welcome-name">
          <Icon icon={Radio} size={16} /> Nghe cho kỹ
        </span>
        <span className="job-strip-hear">
          <SoundBars on={speaking} />
          {pressed ? 'Đã bấm. Nghe nốt.' : 'Bấm "Đó!" ngay lúc câu ấy được nói. Sớm quá hay muộn quá đều tính.'}
        </span>
      </p>
      <button type="button" className="town-reply job-spot" disabled={!!pressed} onClick={onPress} aria-keyshortcuts="Space">
        <Icon icon={Hand} size={18} />
        <span className="town-reply-text">Đó!</span>
      </button>
    </div>
  );
}
