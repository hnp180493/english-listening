// "Gần đây": the last 30 days of the log, with edit and delete (+ "Hoàn tác").

import { Fragment, useEffect, useState, type FormEvent } from 'react';
import { AudioLines, Clapperboard, Film, MonitorPlay, Pencil, Podcast, Trash2, type LucideIcon } from 'lucide-react';
import { Icon } from '../../components/Icon';
import {
  deleteListeningEntry,
  restoreListeningEntry,
  updateListeningEntry,
  type ListeningEntry,
  type ListeningSource,
} from '../../core/listening';
import EntryFields from './EntryFields';
import { entryMeta, entryMetaParts, entryTitle, formFromEntry, readForm, RECENT_PAGE, type EntryForm, type FormErrors } from './listeningModel';

const SOURCE_ICON: Record<ListeningSource, LucideIcon> = {
  phim: Film,
  youtube: MonitorPlay,
  podcast: Podcast,
  app: Clapperboard,
  khac: AudioLines,
};

/** How long the "Hoàn tác" bar stays after a delete. */
const UNDO_MS = 10_000;

interface Props {
  entries: readonly ListeningEntry[];
  today: string;
}

export default function EntryList({ entries, today }: Props) {
  const [shown, setShown] = useState(RECENT_PAGE);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<ListeningEntry | null>(null);

  useEffect(() => {
    if (!deleted) return;
    const id = window.setTimeout(() => setDeleted(null), UNDO_MS);
    return () => window.clearTimeout(id);
  }, [deleted]);

  const visible = entries.slice(0, shown);
  const more = entries.length - visible.length;

  return (
    <div className="stack-sm">
      {deleted && (
        <div className="lis-undo" role="status">
          <span className="lis-undo-text">Đã xóa {entryTitle(deleted)}.</span>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              restoreListeningEntry(deleted);
              setDeleted(null);
            }}
          >
            Hoàn tác
          </button>
        </div>
      )}
      {entries.length > 0 && (
        <ul className="list-rows lis-rows">
          {visible.map((e) =>
            editing === e.id ? (
              <li key={e.id}>
                <EditRow
                  entry={e}
                  today={today}
                  onDone={() => setEditing(null)}
                  onDelete={() => {
                    const gone = deleteListeningEntry(e.id);
                    setEditing(null);
                    if (gone) setDeleted(gone);
                  }}
                />
              </li>
            ) : (
              <li key={e.id}>
                <div className="list-row lis-row">
                  <span className="list-row-lead" aria-hidden="true">
                    <Icon icon={SOURCE_ICON[e.source]} size={18} />
                  </span>
                  <span className="list-row-body">
                    <span className="list-row-title">
                      <span className="list-row-text">{entryTitle(e)}</span>
                    </span>
                    <span className="list-row-meta">
                      {entryMetaParts(e, today).map((part, k) => (
                        <Fragment key={k}>
                          {k > 0 && ' '}
                          <span className="nowrap-seg">{k > 0 ? `· ${part}` : part}</span>
                        </Fragment>
                      ))}
                    </span>
                  </span>
                  <span className="list-row-end">
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon btn-sm"
                      aria-label={`Sửa: ${entryTitle(e)}, ${entryMeta(e, today)}`}
                      title="Sửa"
                      onClick={() => setEditing(e.id)}
                    >
                      <Icon icon={Pencil} size={16} />
                    </button>
                  </span>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
      {more > 0 && (
        <button type="button" className="btn btn-ghost list-more" onClick={() => setShown((n) => n + RECENT_PAGE)}>
          Xem thêm
        </button>
      )}
    </div>
  );
}

function EditRow({ entry, today, onDone, onDelete }: { entry: ListeningEntry; today: string; onDone: () => void; onDelete: () => void }) {
  const [form, setForm] = useState<EntryForm>(() => formFromEntry(entry));
  const [errors, setErrors] = useState<FormErrors>({});

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    const { input, errors: errs } = readForm(form);
    setErrors(errs);
    if (!input) return;
    const minutesChanged = input.minutes !== entry.minutes;
    const next = updateListeningEntry(entry.id, {
      // Unchanged minutes of an auto-logged video keep their exact seconds.
      ...(minutesChanged ? { minutes: input.minutes } : {}),
      source: input.source,
      title: input.title ?? '',
      understood: input.understood ?? null,
      subtitles: input.subtitles ?? null,
      ...(input.day ? { day: input.day } : {}),
    });
    if (next) onDone();
    else setErrors({ minutes: 'Chưa lưu được. Mục này có thể vừa bị xóa ở máy khác.' });
  };

  return (
    <form
      className="lis-edit stack"
      onSubmit={submit}
      noValidate
      aria-label={`Sửa lần nghe: ${entryTitle(entry)}`}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onDone();
        }
      }}
    >
      <EntryFields
        form={form}
        onChange={(p) => setForm((f) => ({ ...f, ...p }))}
        errors={errors}
        dayPicker={{ today, keep: entry.day }}
        autoFocusMinutes
      />
      <div className="lis-actions">
        <button type="submit" className="btn btn-soft btn-sm">
          Lưu
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDone}>
          Hủy
        </button>
        <button type="button" className="btn btn-danger btn-sm lis-delete" onClick={onDelete}>
          <Icon icon={Trash2} size={15} />
          Xóa
        </button>
      </div>
    </form>
  );
}
