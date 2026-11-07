// "Ghi nhanh": log minutes after the fact (today or yesterday).

import { useState, type FormEvent } from 'react';
import { Check } from 'lucide-react';
import { Icon } from '../../components/Icon';
import { addListeningEntry, type ListeningEntry, type ListeningSource } from '../../core/listening';
import { localDay } from '../../core/stats';
import EntryFields from './EntryFields';
import { entryTitle, readForm, type EntryForm, type FormErrors } from './listeningModel';

interface Props {
  defaultSource: ListeningSource;
  now: number;
  onSaved: (e: ListeningEntry) => void;
}

function blank(source: ListeningSource, now: number): EntryForm {
  return { minutes: '', source, title: '', understood: null, subtitles: null, day: localDay(now) };
}

export default function QuickAdd({ defaultSource, now, onSaved }: Props) {
  const today = localDay(now);
  const [form, setForm] = useState<EntryForm>(() => blank(defaultSource, now));
  const [errors, setErrors] = useState<FormErrors>({});
  const [saved, setSaved] = useState<string | null>(null);

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    const { input, errors: errs } = readForm(form);
    setErrors(errs);
    if (!input) return;
    const e = addListeningEntry(input);
    if (!e) {
      setErrors({ minutes: 'Chưa lưu được. Kiểm tra lại số phút.' });
      return;
    }
    setSaved(`Đã ghi ${entryTitle(e)}.`);
    setForm(blank(form.source, Date.now()));
    onSaved(e);
  };

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <EntryFields
        form={form}
        onChange={(p) => {
          setSaved(null);
          setForm((f) => ({ ...f, ...p }));
        }}
        errors={errors}
        chips
        dayPicker={{ today }}
        collapseDetails
      />
      <div className="lis-actions">
        <button type="submit" className="btn btn-primary">
          Lưu
        </button>
        {saved && (
          <span className="meta lis-saved" role="status">
            <Icon icon={Check} size={16} />
            {saved}
          </span>
        )}
      </div>
    </form>
  );
}
