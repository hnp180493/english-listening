// "Bấm giờ": the stopwatch (device-local, survives reloads) and its save form after "Dừng".

import { useId, useState, type FormEvent } from 'react';
import { Pause, Play, Square, TriangleAlert } from 'lucide-react';
import { Icon } from '../../components/Icon';
import {
  discardTimer,
  formatClock,
  pauseTimer,
  resumeTimer,
  saveTimer,
  setTimerInfo,
  SOURCE_LABEL,
  startTimer,
  stopTimer,
  TITLE_MAX,
  timerElapsedMs,
  timerStatus,
  timerSummary,
  type ListeningEntry,
  type ListeningSource,
  type ListeningTimer,
} from '../../core/listening';
import { localDay } from '../../core/stats';
import EntryFields from './EntryFields';
import { PICKABLE_SOURCES, readForm, timerStatusLabel, type EntryForm, type FormErrors } from './listeningModel';
import { useClock } from './useClock';

interface Props {
  timer: ListeningTimer | null;
  defaultSource: ListeningSource;
  onSaved: (e: ListeningEntry) => void;
}

export default function TimerPanel({ timer, defaultSource, onSaved }: Props) {
  if (!timer) return <TimerIdle defaultSource={defaultSource} />;
  if (timerStatus(timer) === 'stopped') return <TimerSave timer={timer} defaultSource={defaultSource} onSaved={onSaved} />;
  return <TimerRunning timer={timer} defaultSource={defaultSource} />;
}

function TimerIdle({ defaultSource }: { defaultSource: ListeningSource }) {
  const uid = useId();
  const [source, setSource] = useState<ListeningSource>(defaultSource);
  const [title, setTitle] = useState('');
  return (
    <div className="lis-timer stack">
      <p className="lis-clock is-idle tabular" aria-hidden="true">
        0:00
      </p>
      <div className="lis-pair">
        <div>
          <label className="field-label" htmlFor={`${uid}-src`}>
            Nguồn
          </label>
          <select id={`${uid}-src`} className="select" value={source} onChange={(e) => setSource(e.target.value as ListeningSource)}>
            {PICKABLE_SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor={`${uid}-title`}>
            Tên nội dung <span className="lis-optional">(không bắt buộc)</span>
          </label>
          <input
            id={`${uid}-title`}
            className="input"
            maxLength={TITLE_MAX}
            placeholder="Ví dụ: Friends tập 3"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
      </div>
      <div className="lis-actions">
        <button type="button" className="btn btn-primary" onClick={() => startTimer({ source, title })}>
          <Icon icon={Play} size={16} />
          Bắt đầu nghe
        </button>
      </div>
      <p className="meta lis-note">Đồng hồ vẫn chạy khi bạn chuyển trang hay đóng tab. Video thật trong app được ghi tự động, không cần bấm giờ.</p>
    </div>
  );
}

function TimerRunning({ timer, defaultSource }: { timer: ListeningTimer; defaultSource: ListeningSource }) {
  const uid = useId();
  const status = timerStatus(timer);
  const running = status === 'running';
  const now = useClock(running);
  const elapsed = timerElapsedMs(timer, now);
  // Title edits stay local until blur (one write instead of one per key).
  const [title, setTitle] = useState(timer.title ?? '');
  return (
    <div className="lis-timer stack">
      <div className="lis-clock-wrap">
        <span className={'lis-status' + (running ? ' is-running' : '')}>
          <span className="lis-status-dot" aria-hidden="true" />
          {timerStatusLabel(status)}
        </span>
        <p className="lis-clock tabular" role="timer" aria-label={`${timerStatusLabel(status)} ${formatClock(elapsed)}`}>
          {formatClock(elapsed)}
        </p>
      </div>
      <div className="lis-pair">
        <div>
          <label className="field-label" htmlFor={`${uid}-src`}>
            Nguồn
          </label>
          <select
            id={`${uid}-src`}
            className="select"
            value={timer.source ?? defaultSource}
            onChange={(e) => setTimerInfo({ source: e.target.value as ListeningSource })}
          >
            {PICKABLE_SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor={`${uid}-title`}>
            Tên nội dung <span className="lis-optional">(không bắt buộc)</span>
          </label>
          <input
            id={`${uid}-title`}
            className="input"
            maxLength={TITLE_MAX}
            placeholder="Ví dụ: Friends tập 3"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title !== (timer.title ?? '')) setTimerInfo({ title });
            }}
          />
        </div>
      </div>
      <div className="lis-actions">
        {running ? (
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (title !== (timer.title ?? '')) setTimerInfo({ title });
                stopTimer();
              }}
            >
              <Icon icon={Square} size={15} />
              Dừng và lưu
            </button>
            <button type="button" className="btn" onClick={() => pauseTimer()}>
              <Icon icon={Pause} size={16} />
              Tạm dừng
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-primary" onClick={() => resumeTimer()}>
              <Icon icon={Play} size={16} />
              Nghe tiếp
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (title !== (timer.title ?? '')) setTimerInfo({ title });
                stopTimer();
              }}
            >
              <Icon icon={Square} size={15} />
              Dừng và lưu
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function TimerSave({ timer, defaultSource, onSaved }: { timer: ListeningTimer; defaultSource: ListeningSource; onSaved: (e: ListeningEntry) => void }) {
  const sum = timerSummary(timer);
  const [form, setForm] = useState<EntryForm>(() => ({
    minutes: String(sum.minutes),
    source: sum.source ?? defaultSource,
    title: sum.title ?? '',
    understood: null,
    subtitles: null,
    day: sum.day,
  }));
  const [errors, setErrors] = useState<FormErrors>({});
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [today] = useState(() => localDay(Date.now()));

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    const { input, errors: errs } = readForm(form);
    setErrors(errs);
    if (!input) return;
    const e = saveTimer(input);
    if (e) onSaved(e);
    else setErrors({ minutes: 'Chưa lưu được. Kiểm tra lại số phút.' });
  };

  return (
    <form className="lis-timer stack" onSubmit={submit} noValidate>
      <div className="lis-clock-wrap">
        <span className="lis-status">
          <span className="lis-status-dot" aria-hidden="true" />
          {timerStatusLabel('stopped')}
        </span>
        <p className="lis-clock tabular">{formatClock(sum.elapsedMs)}</p>
      </div>
      {sum.tooLong && (
        <div className="callout callout-warn" role="status">
          <Icon icon={TriangleAlert} size={16} />
          <div>Đồng hồ đã chạy hơn 4 giờ. Có thể bạn quên tắt: hãy sửa lại số phút cho đúng trước khi lưu.</div>
        </div>
      )}
      {sum.tooShort && <p className="meta">Chưa tới 1 phút: lần nghe này sẽ được lưu là 1 phút.</p>}
      <EntryFields
        form={form}
        onChange={(p) => setForm((f) => ({ ...f, ...p }))}
        errors={errors}
        dayPicker={{ today, keep: sum.day }}
      />
      {confirmDiscard ? (
        <div className="lis-confirm" role="alertdialog" aria-label="Bỏ lần nghe này?">
          <span>Bỏ lần nghe này, không ghi vào nhật ký?</span>
          <div className="lis-actions">
            <button type="button" className="btn btn-danger btn-sm" onClick={() => discardTimer()}>
              Bỏ
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDiscard(false)}>
              Giữ lại
            </button>
          </div>
        </div>
      ) : (
        <div className="lis-actions">
          <button type="submit" className="btn btn-primary">
            Lưu vào nhật ký
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setConfirmDiscard(true)}>
            Bỏ
          </button>
        </div>
      )}
    </form>
  );
}
