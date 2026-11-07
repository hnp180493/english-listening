// "Nghe người thật nói": a few seconds of real speech per clip. Nothing loads until the learner asks: the YouTube
// player (youtube-nocookie, a plain iframe: no YouTube script runs in the app's own page) is created on click and
// plays start → end only. Opened from disk (file://, the portable build) YouTube refuses embedded playback, so
// only the "Mở trên YouTube" link is shown there.
import { useState } from 'react';
import { ExternalLink, Play, RotateCcw } from 'lucide-react';
import { Icon } from '../../components/Icon';
import { RealVoiceLink } from '../../components/ListenPair';
import type { RealClip } from '../../data/lessonTypes';
import { embedUrl, splitFocus, watchUrl } from './realClipUrls';

const canEmbed = () => typeof location === 'undefined' || location.protocol !== 'file:';

function ClipCard({ clip }: { clip: RealClip }) {
  const [plays, setPlays] = useState(0); // 0 = not loaded; each "Xem lại" remounts the player at start
  const parts = splitFocus(clip.text, clip.focus);
  const seconds = clip.end - clip.start;
  const embed = canEmbed();
  return (
    <li className="panel lessons-real">
      <p className="lessons-real-text" lang="en">
        “{parts.before}
        {parts.match && <mark className="lessons-real-focus">{parts.match}</mark>}
        {parts.after}”
      </p>
      <p className="lessons-real-note">
        <span lang="en">{clip.focus}</span>: {clip.note}
      </p>
      {embed && plays > 0 && (
        <div className="lessons-real-player">
          <iframe
            key={plays}
            src={embedUrl(clip)}
            title={`Video: ${clip.text}`}
            allow="autoplay; encrypted-media; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            loading="lazy"
          />
        </div>
      )}
      <div className="lessons-real-actions">
        {embed &&
          (plays === 0 ? (
            <button type="button" className="btn btn-soft btn-sm" onClick={() => setPlays(1)}>
              <Icon icon={Play} size={15} />
              Xem đoạn này · {seconds} giây
            </button>
          ) : (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPlays((n) => n + 1)}>
              <Icon icon={RotateCcw} size={15} />
              Xem lại
            </button>
          ))}
        <a className="lessons-real-link" href={watchUrl(clip)} target="_blank" rel="noopener noreferrer">
          <Icon icon={ExternalLink} size={14} />
          Mở trên YouTube
          <span className="sr-only"> (mở tab mới)</span>
        </a>
        <span className="lessons-real-source">{clip.source}</span>
      </div>
    </li>
  );
}

export default function RealClipsBlock({ clips }: { clips: readonly RealClip[] }) {
  return (
    <section className="lessons-reals" aria-label="Nghe người thật nói">
      <p className="lessons-real-intro">Nghe phần tô đậm trong lời nói thật, rồi xem lại vài lần cho quen tai.</p>
      <ul className="lessons-real-list">
        {clips.map((c) => (
          <ClipCard key={`${c.videoId}-${c.start}`} clip={c} />
        ))}
      </ul>
      {clips[0] && <RealVoiceLink phrase={clips[0].focus} className="lessons-real-more" />}
      <details className="how">
        <summary>Về các đoạn này</summary>
        <p>
          Mỗi đoạn được chọn vì phụ đề có đúng cụm cần nghe. Người nói thật mỗi người một kiểu: có người nói rõ hơn, có người
          nuốt âm nhiều hơn. Video là của kênh gốc trên YouTube; nếu một video bị gỡ, đoạn đó sẽ không phát được.
        </p>
      </details>
    </section>
  );
}
