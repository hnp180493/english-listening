import { useCallback, useMemo, useState } from 'react';
import { ArrowRight, ChevronUp, CircleHelp, List, TriangleAlert } from 'lucide-react';
import { Icon } from '../../components/Icon';
import PageHeader from '../../components/PageHeader';
import ShortcutsHelp from '../../components/ShortcutsHelp';
import { navigate, useRoute } from '../../core/nav';
import { enrolSeen, makeCardId } from '../../core/review';
import { microphoneSupported, secureContextOk, speechRecognitionSupported } from '../../core/speech';
import { ttsSupported } from '../../core/tts';
import { CHUNKS } from '../../data/chunks';
import { SENTENCES } from '../../data/sentences';
import PracticePanel from './PracticePanel';
import { newestAttempt, shouldEnrolTake } from './reviewHook';
import { SHADOW_SHORTCUTS } from './shortcuts';
import SourcePicker from './SourcePicker';
import { nextItemId, resolveSource, suggestSentence } from './sources';
import { loadShadowing, type ShadowState } from './store';
import './shadowing.css';

const HOWTO: { title: string; text: string }[] = [
  { title: 'Nghe mẫu', text: 'Xem chỗ các từ dính vào nhau.' },
  { title: 'Nói từng cụm', text: 'Máy đọc cụm ngắn, bạn nhắc lại.' },
  { title: 'Thu âm cả câu', text: 'Máy chấm từng từ và chỉ chỗ vấp.' },
];

/** The next sentence to practise: one card, one action. */
function Suggestion({ history }: { history: ShadowState }) {
  const suggestion = useMemo(() => suggestSentence(SENTENCES, history), [history]);
  if (!suggestion) return null;
  return (
    <section className="card shadow-suggest" aria-labelledby="shadow-suggest-title">
      <h2 id="shadow-suggest-title" className="shadow-h2">
        Câu nên luyện tiếp
      </h2>
      <p className="shadow-suggest-text" lang="en">
        {suggestion.text}
      </p>
      <p className="muted shadow-suggest-vi">{suggestion.vi}</p>
      <div className="row shadow-suggest-actions">
        <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate('shadowing', { id: suggestion.id })}>
          Bắt đầu luyện câu này
          <Icon icon={ArrowRight} size={17} />
        </button>
      </div>
    </section>
  );
}

/** Rendered only when something is missing: everything supported means nothing to say. */
function SupportWarning() {
  const [support] = useState(() => ({
    tts: ttsSupported(),
    sr: speechRecognitionSupported(),
    mic: microphoneSupported(),
    secure: secureContextOk(),
  }));
  const notes: string[] = [];
  if (!support.tts) notes.push('Trình duyệt này không có giọng đọc mẫu.');
  if (!support.secure) notes.push('Trang không chạy qua HTTPS nên trình duyệt chặn micro. Hãy mở bằng https:// hoặc localhost.');
  else if (!support.mic) notes.push('Trình duyệt này không cho ghi âm.');
  if (!support.sr) {
    notes.push('Không có nhận dạng giọng nói (thường gặp trên Firefox): bạn vẫn ghi âm và tự chấm. Dùng Chrome hoặc Edge để được chấm tự động.');
  }
  if (notes.length === 0) return null;
  return (
    <div className="callout callout-warn" role="status">
      <Icon icon={TriangleAlert} size={16} />
      <div className="stack-sm">
        {notes.map((n) => (
          <p key={n}>{n}</p>
        ))}
      </div>
    </div>
  );
}

export default function ShadowingPage() {
  const route = useRoute();
  const source = useMemo(() => resolveSource(route.params, SENTENCES, CHUNKS), [route.params]);
  const [history, setHistory] = useState<ShadowState>(loadShadowing);
  const onSaved = useCallback(
    (s: ShadowState) => {
      setHistory(s);
      // A weak take of a built-in sentence enrols its dictation card (never graded; a no-op when it exists).
      try {
        if (source && shouldEnrolTake(source, newestAttempt(s, source.itemId))) {
          enrolSeen(makeCardId('dict', source.itemId));
        }
      } catch {
        // review scheduling is best effort
      }
    },
    [source],
  );
  const nextId = source ? nextItemId(source.itemId, SENTENCES, CHUNKS) : null;
  const wanted = !!(route.params.id || route.params.text);
  const [pickerOpen, setPickerOpen] = useState(false);
  const fresh = Object.keys(history).length === 0;

  // A new item was chosen: fold the list away so the practice panel is in view.
  const sourceKey = source ? `${source.itemId}|${source.text}` : '';
  const [lastKey, setLastKey] = useState(sourceKey);
  if (lastKey !== sourceKey) {
    setLastKey(sourceKey);
    setPickerOpen(false);
  }

  const showPicker = !source || pickerOpen;
  const picker = (
    <div id="shadow-picker" hidden={!showPicker}>
      <SourcePicker source={source} history={history} open={showPicker} onPick={() => setPickerOpen(false)} />
    </div>
  );

  return (
    <div className="shadow page-focus">
      <PageHeader
        title="Nói nhại"
        subtitle="Nghe, nói theo, so sánh. Nói được chỗ nối âm là nghe ra chúng."
        className="shadow-head"
        actions={
          source && (
            <button
              type="button"
              className={'btn shadow-toggle' + (pickerOpen ? ' btn-soft' : '')}
              aria-expanded={pickerOpen}
              aria-controls="shadow-picker"
              onClick={() => setPickerOpen((o) => !o)}
            >
              <Icon icon={pickerOpen ? ChevronUp : List} size={16} />
              {pickerOpen ? 'Ẩn danh sách' : 'Đổi câu'}
            </button>
          )
        }
        help={source ? <ShortcutsHelp items={SHADOW_SHORTCUTS} /> : undefined}
      />

      {wanted && !source && (
        <p className="callout callout-warn" role="status">
          <Icon icon={TriangleAlert} size={16} />
          <span>Không tìm thấy câu được yêu cầu. Hãy chọn một câu khác trong danh sách bên dưới.</span>
        </p>
      )}

      {source ? (
        <>
          {picker}
          <PracticePanel key={sourceKey} source={source} item={history[source.itemId]} nextId={nextId} onSaved={onSaved} />
        </>
      ) : (
        <>
          <Suggestion history={history} />
          <SupportWarning />
          {picker}
        </>
      )}

      <details className="how shadow-how" open={fresh}>
        <summary>
          <Icon icon={CircleHelp} size={18} />
          Nói nhại là gì?
        </summary>
        <div className="stack-sm">
          <p className="muted">
            Nghe người bản xứ rồi <b>nói theo y hệt</b>: cùng nhịp, cùng chỗ nối âm. Miệng nói được thì tai sẽ nghe ra.
          </p>
          <ol className="shadow-howto">
            {HOWTO.map((h) => (
              <li key={h.title}>
                <b>{h.title}.</b> <span className="muted">{h.text}</span>
              </li>
            ))}
          </ol>
        </div>
      </details>
    </div>
  );
}
