// The fields shared by "Ghi nhanh", the stopwatch's save form and the edit form of a logged entry.

import { useId } from 'react';
import {
  QUICK_MINUTES,
  SOURCE_LABEL,
  SUBTITLE_LABEL,
  SUBTITLE_MODES,
  TITLE_MAX,
  UNDERSTOOD_LABEL,
  UNDERSTOOD_LEVELS,
  addDays,
  type ListeningSource,
} from '../../core/listening';
import { chipSelected, dayLabel, PICKABLE_SOURCES, type EntryForm, type FormErrors } from './listeningModel';

export interface EntryFieldsProps {
  form: EntryForm;
  onChange: (patch: Partial<EntryForm>) => void;
  errors?: FormErrors;
  /** Quick minute chips (15/30/45/60) next to the minutes input. */
  chips?: boolean;
  /** "Ngày" select (today / yesterday, plus `keep`: the entry's own day when it is older); `today` is the local day. */
  dayPicker?: { today: string; keep?: string } | null;
  /** Optional fields (title, understood, subtitles) behind a closed "Thêm chi tiết". */
  collapseDetails?: boolean;
  /** Focus the minutes input on mount (edit / save forms). */
  autoFocusMinutes?: boolean;
}

/** Today, yesterday and (when older) the day the entry already has, newest first. */
function dayOptions(p: { today: string; keep?: string }): string[] {
  const days = [p.today, addDays(p.today, -1)];
  if (p.keep && !days.includes(p.keep)) days.push(p.keep);
  return days.sort().reverse();
}

export default function EntryFields({ form, onChange, errors, chips = false, dayPicker = null, collapseDetails = false, autoFocusMinutes = false }: EntryFieldsProps) {
  const uid = useId();
  const minErr = errors?.minutes;

  const details = (
    <div className="lis-fields">
      <div>
        <label className="field-label" htmlFor={`${uid}-title`}>
          Tên nội dung <span className="lis-optional">(không bắt buộc)</span>
        </label>
        <input
          id={`${uid}-title`}
          className="input"
          maxLength={TITLE_MAX}
          placeholder="Ví dụ: Friends tập 3, TED Talk…"
          value={form.title}
          onChange={(e) => onChange({ title: e.target.value })}
        />
      </div>
      <div role="group" aria-labelledby={`${uid}-und`}>
        <div className="field-label" id={`${uid}-und`}>
          Bạn hiểu khoảng bao nhiêu? <span className="lis-optional">(tự đánh giá)</span>
        </div>
        <div className="lis-chips">
          {UNDERSTOOD_LEVELS.map((u) => (
            <button
              key={u}
              type="button"
              className="chip lis-chip"
              aria-pressed={form.understood === u}
              onClick={() => onChange({ understood: form.understood === u ? null : u })}
            >
              {UNDERSTOOD_LABEL[u]}
            </button>
          ))}
        </div>
      </div>
      <div role="group" aria-labelledby={`${uid}-sub`}>
        <div className="field-label" id={`${uid}-sub`}>
          Phụ đề
        </div>
        <div className="lis-chips">
          {SUBTITLE_MODES.map((s) => (
            <button
              key={s}
              type="button"
              className="chip lis-chip"
              aria-pressed={form.subtitles === s}
              onClick={() => onChange({ subtitles: form.subtitles === s ? null : s })}
            >
              {SUBTITLE_LABEL[s]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const filled = form.title.trim() !== '' || form.understood !== null || form.subtitles !== null;

  return (
    <div className="lis-fields">
      <div>
        <label className="field-label" htmlFor={`${uid}-min`}>
          Số phút đã nghe
        </label>
        <div className="lis-min-row">
          {chips &&
            QUICK_MINUTES.map((m) => (
              <button
                key={m}
                type="button"
                className="chip lis-chip lis-min-chip"
                aria-pressed={chipSelected(form.minutes, m)}
                aria-label={`${m} phút`}
                onClick={() => onChange({ minutes: String(m) })}
              >
                {m}
              </button>
            ))}
          <input
            id={`${uid}-min`}
            className="input lis-min-input tabular"
            type="number"
            inputMode="numeric"
            min={1}
            max={600}
            step={1}
            placeholder={chips ? 'Khác' : 'Phút'}
            value={form.minutes}
            autoFocus={autoFocusMinutes}
            aria-invalid={minErr ? true : undefined}
            aria-describedby={minErr ? `${uid}-min-err` : undefined}
            onChange={(e) => onChange({ minutes: e.target.value })}
          />
        </div>
        {minErr && (
          <p id={`${uid}-min-err`} className="field-hint lis-error" role="alert">
            {minErr}
          </p>
        )}
      </div>

      <div className={'lis-pair' + (dayPicker ? '' : ' is-single')}>
        <div>
          <label className="field-label" htmlFor={`${uid}-src`}>
            Nguồn
          </label>
          <select
            id={`${uid}-src`}
            className="select"
            value={form.source}
            onChange={(e) => onChange({ source: e.target.value as ListeningSource })}
          >
            {PICKABLE_SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        {dayPicker && (
          <div>
            <label className="field-label" htmlFor={`${uid}-day`}>
              Ngày
            </label>
            <select id={`${uid}-day`} className="select" value={form.day} onChange={(e) => onChange({ day: e.target.value })}>
              {dayOptions(dayPicker).map((d) => (
                <option key={d} value={d}>
                  {dayLabel(d, dayPicker.today)}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {collapseDetails ? (
        <details className="lis-more" open={filled || undefined}>
          <summary>Thêm chi tiết: tên, mức hiểu, phụ đề</summary>
          {details}
        </details>
      ) : (
        details
      )}
    </div>
  );
}
