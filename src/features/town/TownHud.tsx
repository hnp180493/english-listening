import { useEffect, useRef, useState, type Ref } from 'react';
import { BookOpen, Coffee, Ear, Search, Package, Check, Heart, UserRound, Egg, Fish, Gift, Flame, Hammer, ListChecks, Map as MapIcon, Maximize2, Minimize2, Shirt, Sprout, Sparkles, Trophy, Volume2, VolumeX } from 'lucide-react';
import { Icon } from '../../components/Icon';
import Popover from '../../components/Popover';
import { prefersReducedMotion } from '../../core/motion';
import type { TownOverview } from '../../core/town/overview';
import { ACTIVITIES, type ActivityId } from './activities/types';
import './scenes/today.css';
import { Coin } from './art';

/** The icon of each activity in the "Chơi" menu. */
const ACTIVITY_ICONS: Readonly<Record<ActivityId, typeof Fish>> = { fish: Fish, farm: Sprout, eggs: Egg, wardrobe: Shirt, album: Trophy, gifts: Gift, journal: BookOpen, love: Heart, character: UserRound, cafe: Coffee, case: Search, delivery: Package, listen: Ear };
/** The two groups of the "Chơi" menu, in order. */
const PLAY_GROUPS = [{ id: 'game' }, { id: 'life' }] as const;
import { levelLabel, taskCount, xu } from './shellModel';
import { getLang, tl } from '../../i18n';

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
  /** "Chơi": walk to an activity's spot and open it. */
  onPlay: (id: ActivityId) => void;
  /** The activity whose panel is open (null = none). */
  playOpen: ActivityId | null;
  /** The stage fills the whole screen. */
  full: boolean;
  onFull: () => void;
  /** "Bản đồ": the whole town (features/town/map); left out where there is no world to map (flat). */
  onMap?: () => void;
  mapOpen?: boolean;
  mapRef?: Ref<HTMLButtonElement>;
  /** The xu counter (coins fly to it). */
  xuRef?: Ref<HTMLSpanElement>;
  buildRef?: Ref<HTMLButtonElement>;
  /** The town today (docs/town.md §19): its weather and the get-together that is on, at the head of the day's list. */
  today?: TownDay;
  /** "Tới dự": go to today's get-together. */
  onEvent?: (eventId: string) => void;
  /** "Ra bến xe": walk to bus no. 9 (docs/town.md §20). Left out until the bus station is built. */
  onBus?: () => void;
}

/** What the day's list says of today besides the tasks. */
export interface TownDay {
  /** Vietnamese: "Trời nắng". */
  weather: string;
  event: { id: string; name: string; blurb: string } | null;
  /** The host's place is not built yet: its Vietnamese name (the get-together waits for it); null when it is. */
  needs: string | null;
  /** Heard already today. */
  done: boolean;
}

/** What floats over the town: the title with its bar on the left; xu, streak, tasks, build and sound on the right. */
export default function TownHud({ overview, sound, onSound, onBuild, buildOpen, onPlay, playOpen, full, onFull, onMap, mapOpen = false, mapRef, xuRef, buildRef, today, onEvent, onBus }: TownHudProps) {
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
          <span ref={xuRef} className={'town-pill town-xu' + (moving ? ' is-moving' : '')} role="img" aria-label={tl`Bạn có ${xu(balance)}`}>
            <Coin size={18} />
            <span className="tabular" aria-hidden="true">
              {shown}
            </span>
          </span>
        </div>
        <div className="town-hud-btns">
          <Popover
            className="town-play"
            triggerClassName={'town-pill town-hud-btn' + (playOpen ? ' is-on' : '')}
            trigger={
              <>
                <Icon icon={Sparkles} size={17} />
                <span className="town-hud-label">Chơi</span>
              </>
            }
            triggerLabel="Chơi: trò chơi nghe, đồ đạc và người quen"
            title="Chơi gì bây giờ?"
          >
            {(close) =>
              // a grid of tiles in two groups, not twelve rows with a blurb each (owner, 2026-11-25: the list ran off the
              // stage); the blurb stays as the tile's tooltip and its accessible description
              PLAY_GROUPS.map((g) => (
                <section key={g.id} className="town-play-group" aria-labelledby={`town-play-${g.id}`}>
                  <h3 id={`town-play-${g.id}`} className="town-play-head">
                    {g.id === 'game' ? 'Trò chơi nghe' : 'Đồ đạc & người quen'}
                  </h3>
                  <ul className="town-play-list">
                    {ACTIVITIES.filter((a) => a.group === g.id).map((a) => (
                      <li key={a.id}>
                        <button
                          type="button"
                          className={'town-play-item' + (playOpen === a.id ? ' is-on' : '')}
                          title={a.blurb}
                          aria-describedby={`town-play-d-${a.id}`}
                          onClick={() => {
                            close();
                            onPlay(a.id);
                          }}
                        >
                          <span className="town-play-icon" aria-hidden="true">
                            <Icon icon={ACTIVITY_ICONS[a.id]} size={18} />
                          </span>
                          <span className="town-play-name">{a.name}</span>
                          <span id={`town-play-d-${a.id}`} className="sr-only">
                            {a.blurb}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            }
          </Popover>
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
            triggerLabel={tl`Việc hôm nay${tasksDone > 0 ? tl`, xong ${tasksDone} trên ${tasks.length}` : ''}`}
            title="Việc hôm nay"
          >
            {today && (
              <div className="town-day">
                <p className="town-day-weather">{today.weather}</p>
                {today.event ? (
                  <div className="town-day-event">
                    <p className="town-day-name">
                      {today.event.name}
                      {today.done && <span className="town-day-done"> · đã dự</span>}
                    </p>
                    <p className="town-day-blurb">{today.needs ? tl`Buổi này chờ ${today.needs} được xây xong.` : today.event.blurb}</p>
                    {!today.needs && onEvent && (
                      <button type="button" className="btn btn-soft btn-sm" onClick={() => onEvent(today.event!.id)}>
                        {today.done ? 'Nghe lại' : 'Tới dự'}
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="town-day-blurb">Hôm nay không có buổi gặp mặt nào. Ghế và radio thì ngày nào cũng có chuyện để nghe.</p>
                )}
              </div>
            )}
            {onBus && (
              <div className="town-day town-day-bus">
                <p className="town-day-blurb">Xe số 9 đi Westbay đang chờ ở bến xe.</p>
                <button type="button" className="btn btn-soft btn-sm" onClick={onBus}>
                  Ra bến xe
                </button>
              </div>
            )}
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
          <button ref={buildRef} type="button" className="town-pill town-hud-btn town-hud-build" onClick={onBuild} aria-expanded={buildOpen} aria-label={overview.canBuySomething ? 'Xây: đang đủ xu để xây thêm' : 'Xây'}>
            <Icon icon={Hammer} size={17} />
            <span className="town-hud-label">Xây</span>
            {overview.canBuySomething && !buildOpen && <span className="town-hud-dot" aria-hidden="true" />}
          </button>
          {onMap && (
            <button ref={mapRef} type="button" className="town-pill town-hud-btn town-hud-map" onClick={onMap} aria-expanded={mapOpen} aria-keyshortcuts="M" title="Bản đồ (M)">
              <Icon icon={MapIcon} size={17} />
              <span className="town-hud-label">Bản đồ</span>
            </button>
          )}
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
            // 'Thu nhỏ' is "Zoom out" on the map: here it leaves full screen
            aria-label={full ? (getLang() === 'en' ? 'Exit full screen' : 'Thu nhỏ') : 'Toàn màn hình'}
            title={full ? 'Thu nhỏ (Esc)' : 'Toàn màn hình'}
          >
            <Icon icon={full ? Minimize2 : Maximize2} size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
