import type { CSSProperties } from 'react';
import { CircleHelp, Volume2 } from 'lucide-react';
import { Icon } from '../../components/Icon';
import { PHENOMENA } from '../../core/types';
import { PHENOMENON_INFO } from '../../core/phenomena';
import SpeakIconButton from '../lessons/SpeakIconButton';

type ColorStyle = CSSProperties & { '--dec-color'?: string };

/** Opt-in cheat-sheet of the 8 phenomena: a closed details.how, always last on the page. */
export default function PhenomenaGuide() {
  return (
    <details className="how dec-guide">
      <summary>
        <Icon icon={CircleHelp} size={18} />
        Học nhanh {PHENOMENA.length} hiện tượng
      </summary>
      <ul className="dec-guide-list">
        {PHENOMENA.map((p) => {
          const info = PHENOMENON_INFO[p];
          if (!info) return null;
          const style: ColorStyle = { '--dec-color': info.color };
          return (
            <li key={p} className="dec-guide-item" style={style}>
              <strong className="dec-guide-name" title={info.en}>
                {info.label}
              </strong>
              <p className="dec-guide-text">{info.summary}</p>
              <div className="dec-guide-ex">
                <span lang="en">{info.example.written}</span>
                <span className="respell-sep" aria-hidden="true">
                  →
                </span>
                <span className="dec-sr">đọc là</span>
                <span className="respell dec-guide-spoken" lang="en">
                  {info.example.spoken}
                </span>
                <span className="dec-guide-play">
                  <SpeakIconButton
                    text={info.example.say}
                    rate={1}
                    mode="connected"
                    icon={Volume2}
                    label={`Nghe "${info.example.written}"`}
                  />
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
