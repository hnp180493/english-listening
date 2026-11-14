import { useEffect, useRef, useState, type Ref } from 'react';
import { Check, Flame, Hammer, ListChecks, Maximize2, Minimize2, Volume2, VolumeX } from 'lucide-react';
import { Icon } from '../../components/Icon';
import Popover from '../../components/Popover';
import { prefersReducedMotion } from '../../core/motion';
import type { TownOverview } from '../../core/town/overview';
import { Coin } from './art';
import { levelLabel, taskCount, xu } from './shellModel';

/** A number that counts towards its new value instead of jumping (instant under reduced motion). */
function useCountTo(value: number, delayMs = 420, durationMs = 700): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const raf = useRef(0);
  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    const still = prefersReducedMotion();
    // coins take a moment to fly over: start counting when the first one lands
    const t0 = performance.now() + (value > start && !still ? delayMs : 0);
    const tick = (now: number) => {
      const k = still ? 1 : Math.max(0, Math.min(1, (now - t0) / durationMs));
      const v = Math.round(start + (value - start) * (1 - (1 - k) * (1 - k)));
      from.current = v;
      setShown(v);
      if (k < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, delayMs, durationMs]);
  return shown;
}

export interface TownHudProps {
  overview: TownOverview;
  sound: boolean;
  onSound: (on: boolean) => void;
  onBuild: () => void;
  buildOpen: boolean;
  /** The stage fills the whole screen. */
  full: boolean;
  onFull: () => void;
  /** The xu counter (coins fly to it). */
  xuRef?: Ref<HTMLSpanElement>;
  buildRef?: Ref<HTMLButtonElement>;
}

/** What floats over the town: the title with its bar on the left; xu, streak, tasks, build and sound on the right. */
export default function TownHud({ overview, sound, onSound, onBuild, buildOpen, full, onFull, xuRef, buildRef }: TownHudProps) {
  const { level, balance, streak, tasks } = overview;
  const shown = useCountTo(balance);
  const moving = shown !== balance;
  const tasksDone = tasks.filter((t) => t.reached).length;
  return (
    <div className="town-hud">
      {/* a new learner sees the title alone: no empty bar before the first point */}
      <div className={'town-level' + (level.xp > 0 ? '' : ' is-new')} role="img" aria-label={levelLabel(level)}>
        <span className="town-level-title">{level.title}</span>
        {level.xp > 0 && (
          <span className="town-level-bar" aria-hidden="true">
            <i style={{ width: `${Math.round(Math.max(0, Math.min(1, level.progress)) * 100)}%` }} />
          </span>
        )}
      </div>

      <div className="town-hud-end">
        <div className="town-hud-counts">
          {streak >= 2 && (
            <span className="town-pill" title="Số ngày liên tiếp bạn ghé thị trấn">
              <Icon icon={Flame} size={16} />
              {streak}
              <span className="sr-only"> ngày liên tiếp</span>
            </span>
          )}
          <span ref={xuRef} className={'town-pill town-xu' + (moving ? ' is-moving' : '')} role="img" aria-label={`Bạn có ${xu(balance)}`}>
            <Coin size={18} />
            <span className="tabular" aria-hidden="true">
              {shown}
            </span>
          </span>
        </div>
        <div className="town-hud-btns">
          <Popover
            className="town-tasks"
            triggerClassName="town-pill town-hud-btn"
            trigger={
              <>
                <Icon icon={ListChecks} size={17} />
                <span className="town-hud-label">Việc hôm nay</span>
                {tasksDone > 0 && (
                  <span className="town-hud-count tabular">
                    {tasksDone}/{tasks.length}
                  </span>
                )}
              </>
            }
            triggerLabel={`Việc hôm nay${tasksDone > 0 ? `, xong ${tasksDone} trên ${tasks.length}` : ''}`}
            title="Việc hôm nay"
          >
            <ul className="town-task-list">
              {tasks.map((t) => (
                <li key={t.id} className={'town-task' + (t.reached ? ' is-done' : '')}>
                  <span className="town-task-mark" aria-hidden="true">
                    {t.reached && <Icon icon={Check} size={13} strokeWidth={3} />}
                  </span>
                  <span className="town-task-body">
                    <span className="town-task-label">
                      {t.label}
                      {t.reached && <span className="sr-only"> (xong)</span>}
                    </span>
                    {!t.reached && t.done > 0 && (
                      <span className="town-task-bar" aria-hidden="true">
                        <i style={{ width: `${Math.round((t.done / t.goal) * 100)}%` }} />
                      </span>
                    )}
                  </span>
                  <span className="town-task-end tabular">
                    {t.done > 0 && !t.reached && <span className="town-task-count">{taskCount(t)}</span>}
                    <span className="town-task-xu">
                      <Coin size={15} />+{t.reward}
                      <span className="sr-only"> xu</span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="town-task-note">Xong việc nào, xu tự cộng việc đó. Mai lại có việc mới.</p>
          </Popover>
          <button ref={buildRef} type="button" className="town-pill town-hud-btn" onClick={onBuild} aria-expanded={buildOpen} aria-label={overview.canBuySomething ? 'Xây: đang đủ xu để xây thêm' : 'Xây'}>
            <Icon icon={Hammer} size={17} />
            <span className="town-hud-label">Xây</span>
            {overview.canBuySomething && !buildOpen && <span className="town-hud-dot" aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="town-pill town-hud-btn town-hud-icon"
            onClick={() => onSound(!sound)}
            aria-pressed={sound}
            aria-label="Âm thanh trò chơi"
            title={sound ? 'Âm thanh trò chơi: đang bật' : 'Âm thanh trò chơi: đang tắt'}
          >
            <Icon icon={sound ? Volume2 : VolumeX} size={17} />
          </button>
          <button
            type="button"
            className="town-pill town-hud-btn town-hud-icon"
            onClick={onFull}
            aria-label={full ? 'Thu nhỏ' : 'Toàn màn hình'}
            title={full ? 'Thu nhỏ (Esc)' : 'Toàn màn hình'}
          >
            <Icon icon={full ? Minimize2 : Maximize2} size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
