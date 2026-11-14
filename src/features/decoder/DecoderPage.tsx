import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { CircleCheck, Link, Mic, PencilLine, ScanText, Shuffle, TriangleAlert, X } from 'lucide-react';
import type { DecodeResult, Sentence } from '../../core/types';
import { decode } from '../../core/decoder';
import { useSettings } from '../../core/settings';
import { hrefFor, navigate, useRoute } from '../../core/nav';
import { scrollBehavior } from '../../core/motion';
import { KEYS, loadJSON, saveJSON } from '../../core/storage';
import { SENTENCES } from '../../data/sentences';
import { Icon } from '../../components/Icon';
import PageHeader from '../../components/PageHeader';
import ListenPair, { RealVoiceLink } from '../../components/ListenPair';
import { annotationPlayback, youglishPhrase } from '../../core/playback';
import ShortcutsHelp from '../../components/ShortcutsHelp';
import SpokenSentence from '../../components/SpokenSentence';
import AnnotationList, { AnnotationCard } from './AnnotationList';
import PhenomenaGuide from './PhenomenaGuide';
import { MAX_CUSTOM_LENGTH as SHADOW_TEXT_MAX } from '../shadowing/sources';
import { session } from '../dictation/session';
import { noteShown } from '../../core/dictation/listens';
import { EXAMPLE_SAY, EXAMPLES, EXAMPLES_SHOWN } from './examples';
import {
  addSentenceForDictation,
  addToHistory,
  authoredSay,
  chipLabel,
  cleanInput,
  findBuiltin,
  HISTORY_KEY,
  removeFromHistory,
  sanitizeHistory,
  shareUrl,
  TEXT_MAX,
} from './pageModel';
import './decoder.css';

const DEBOUNCE_MS = 250;
const NOTICE_MS = 4500;
/** "Gần đây" appears only once there is a real history (2+ entries) and the input is empty. */
const HISTORY_MIN = 2;
const SHORTCUTS = [
  { keys: ['Enter'], text: 'Giải mã' },
  { keys: ['Shift', 'Enter'], text: 'Xuống dòng' },
];

interface Notice {
  kind: 'ok' | 'error';
  text: string;
  url?: string; // shown in a read-only field when copying failed
}

function safeDecode(input: string): DecodeResult {
  try {
    return decode(input);
  } catch {
    return { input, tokens: [], annotations: [], segments: [], spokenText: '' };
  }
}

function loadHistory(): string[] {
  return sanitizeHistory(loadJSON<unknown>(HISTORY_KEY, []));
}

/** Keep the URL (#/decoder?text=…) in step with what is on screen, without a history entry. */
function syncUrl(text: string) {
  try {
    const t = cleanInput(text);
    const next = hrefFor('decoder', t ? { text: t } : undefined);
    if (window.location.hash !== next) window.history.replaceState(window.history.state, '', next);
  } catch {
    // history API unavailable: only the URL is stale
  }
}

async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Selection is tied to the decoded text: annotation ids ("a0", "a1"…) are reused by every new result. */
interface Selection {
  query: string;
  id: string;
  source: 'sentence' | 'list';
}

export default function DecoderPage() {
  const { showIpa } = useSettings();
  const route = useRoute();
  // #/decoder?text=… preloads a sentence (links from lessons, dictation, shared links)
  const routeText = route.id === 'decoder' ? cleanInput(route.params.text ?? '') : '';
  // First load starts empty (the input is the one focus) unless a link preloads a sentence.
  const [text, setText] = useState(() => routeText);
  const [query, setQuery] = useState(() => routeText);
  const [seenRouteText, setSeenRouteText] = useState(routeText);
  const [sel, setSel] = useState<Selection | null>(null);
  const [picked, setPicked] = useState<Sentence | null>(null);
  const [history, setHistory] = useState<string[]>(() => {
    const h = loadHistory();
    return routeText ? addToHistory(h, routeText) : h;
  });
  const [notice, setNotice] = useState<Notice | null>(null);
  // Screen-reader summary is only announced after an explicit action (not on every typing pause).
  const [announceFor, setAnnounceFor] = useState<string | null>(() => routeText || null);
  const resultRef = useRef<HTMLElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // A link from another page (#/decoder?text=…) while this page is open: follow it.
  if (routeText !== seenRouteText) {
    setSeenRouteText(routeText);
    if (routeText && routeText !== cleanInput(query)) {
      setText(routeText);
      setQuery(routeText);
      setSel(null);
      setPicked(null);
      setNotice(null);
      setAnnounceFor(routeText);
      setHistory((h) => addToHistory(h, routeText));
    }
  }

  // Live decode while typing (debounced).
  useEffect(() => {
    if (text === query) return;
    const t = window.setTimeout(() => setQuery(text), DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [text, query]);

  // History is saved through storage.ts whenever it changes.
  useEffect(() => {
    saveJSON(HISTORY_KEY, history);
  }, [history]);

  // Notices fade out on their own (a failed copy stays longer so the link can be copied by hand).
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), notice.url ? NOTICE_MS * 4 : NOTICE_MS);
    return () => window.clearTimeout(t);
  }, [notice]);

  const remember = useCallback((value: string) => setHistory((h) => addToHistory(h, value)), []);

  const result = useMemo(() => safeDecode(query), [query]);
  // Detail list in reading order, whatever order the decoder produced.
  const annotations = useMemo(() => [...result.annotations].sort((a, b) => a.from - b.from || a.to - b.to), [result]);
  const activeId = sel && sel.query === query && annotations.some((a) => a.id === sel.id) ? sel.id : null;

  /** Show `value` right away (example, random sentence, history chip) and remember it. */
  const loadText = (value: string, sentence: Sentence | null = null) => {
    setText(value);
    setQuery(value);
    setSel(null);
    setPicked(sentence);
    setAnnounceFor(value);
    setNotice(null);
    if (value.trim()) remember(value);
    syncUrl(value);
    setSeenRouteText(cleanInput(value));
  };

  const clearText = () => {
    loadText('');
    textareaRef.current?.focus(); // the "Xóa" button disappears; keep focus somewhere useful
  };

  const decodeNow = () => {
    setQuery(text);
    setAnnounceFor(text);
    if (text.trim()) remember(text);
    syncUrl(text);
    setSeenRouteText(cleanInput(text));
    // Wait for the result card to render (it may not exist yet when coming from the empty state).
    window.requestAnimationFrame(() =>
      resultRef.current?.scrollIntoView({
        behavior: scrollBehavior(),
        block: 'nearest',
      }),
    );
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Ignore the Enter that confirms an IME composition (Vietnamese/CJK input methods).
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
      e.preventDefault();
      decodeNow();
    }
  };

  const pickRandom = () => {
    if (SENTENCES.length === 0) return;
    let s = SENTENCES[Math.floor(Math.random() * SENTENCES.length)];
    if (SENTENCES.length > 1 && s.text === text) {
      s = SENTENCES[(SENTENCES.indexOf(s) + 1) % SENTENCES.length];
    }
    loadText(s.text, s);
  };

  // Clicking a block (or a list item) selects its annotation; clicking it again deselects.
  // A block click opens the detail right under the sentence. A list click only highlights:
  // inserting the card above the list would push down the row the learner just tapped.
  const selectFrom = (source: Selection['source']) => (id: string) =>
    setSel(id === activeId ? null : { query, id, source });
  const selectFromSentence = selectFrom('sentence');
  const selectFromList = selectFrom('list');
  const activeAnn = activeId ? annotations.find((a) => a.id === activeId) : undefined;
  const focusAnn = activeAnn && sel?.source === 'sentence' ? activeAnn : undefined;

  // ---- practise this sentence elsewhere / share it
  // the sentence the result card shows (the textarea may hold a newer draft for a moment)
  const current = cleanInput(query) || cleanInput(text);

  const practiseDictation = () => {
    if (!current) return;
    // A sentence the app already ships (sentence of the day, random pick…) opens as itself:
    // saving a copy into "Câu của tôi" would lose its translation and split its progress.
    const builtinId = findBuiltin(current, SENTENCES);
    if (builtinId) {
      remember(current);
      // its words are on screen here: in Chép chính tả it is not a first listen (core/dictation/listens)
      noteShown(session.listenMemory, builtinId);
      navigate('dictation', { mode: 'normal', id: builtinId });
      return;
    }
    const res = addSentenceForDictation(
      loadJSON<unknown>(KEYS.customSentences, []),
      current,
      Date.now(),
      (t) => safeDecode(t).annotations.length,
    );
    if (res.status === 'error') {
      setNotice({ kind: 'error', text: res.message });
      return;
    }
    if (res.status === 'added' && !saveJSON(KEYS.customSentences, res.list)) {
      setNotice({
        kind: 'error',
        text: 'Không lưu được câu vào “Câu của tôi” (bộ nhớ trình duyệt đầy hoặc bị chặn). Hãy xóa bớt dữ liệu rồi thử lại.',
      });
      return;
    }
    remember(current);
    navigate('dictation', { mode: 'custom', id: res.id });
  };

  const practiseShadowing = () => {
    if (!current) return;
    // Shadowing keeps at most SHADOW_TEXT_MAX characters and would silently drop the rest.
    if (current.length > SHADOW_TEXT_MAX) {
      setNotice({
        kind: 'error',
        text: `Câu quá dài để nói nhại (tối đa ${SHADOW_TEXT_MAX} ký tự). Hãy tách thành câu ngắn hơn.`,
      });
      return;
    }
    remember(current);
    navigate('shadowing', { text: current });
  };

  const share = async () => {
    if (!current) return;
    const url = shareUrl(window.location, current);
    const ok = await copyText(url);
    setNotice(
      ok
        ? {
            kind: 'ok',
            text: 'Đã sao chép liên kết. Dán vào tin nhắn để gửi cho bạn bè.',
          }
        : {
            kind: 'error',
            text: 'Không sao chép tự động được. Hãy sao chép liên kết dưới đây:',
            url,
          },
    );
  };

  const forget = (item: string) => setHistory((h) => removeFromHistory(h, item));
  const clearHistory = () => {
    setHistory([]);
    textareaRef.current?.focus(); // the history block disappears with its buttons
  };

  const trimmed = query.trim();
  const hasInput = text.trim().length > 0;
  const hasTokens = result.tokens.length > 0;
  const stale = text !== query;
  const spokenLine =
    result.spokenText.trim() ||
    result.segments
      .map((s) => s.spoken)
      .join(' ')
      .trim() ||
    trimmed;
  const vi = picked && picked.text === query ? picked.vi : null;
  // "Nghe" speaks the connected version: an authored `say` (built-in sentence / example), else the decoder's speakText
  const say = authoredSay(query, EXAMPLE_SAY, picked && picked.text === query ? picked : null, SENTENCES);
  const speechFor = (a: { from: number; to: number; original: string; spoken: string }) => annotationPlayback(a, result.segments);
  const announcement =
    announceFor !== null && announceFor === query && !stale && trimmed
      ? hasTokens
        ? `Nghe như: ${spokenLine}. ${annotations.length} biến âm.`
        : 'Không tìm thấy từ tiếng Anh nào để phân tích.'
      : '';

  const showHistory = !hasInput && history.length >= HISTORY_MIN;

  return (
    <div className="stack-lg page-focus dec">
      <p className="dec-sr" role="status" aria-live="polite">
        {announcement}
      </p>

      <PageHeader
        title="Giải mã câu"
        subtitle="Dán một câu tiếng Anh, xem người bản xứ thực sự nói thế nào."
        help={<ShortcutsHelp items={SHORTCUTS} />}
      />

      <section className="card dec-input" aria-label="Nhập câu">
        <label htmlFor="dec-text" className="dec-sr">
          Câu tiếng Anh
        </label>
        <div className="dec-field">
          <textarea
            id="dec-text"
            ref={textareaRef}
            className="textarea dec-textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => {
              if (text.trim() && text === query) remember(text);
            }}
            placeholder="Nhập câu tiếng Anh…"
            rows={2}
            maxLength={TEXT_MAX}
            lang="en"
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            aria-keyshortcuts="Enter"
          />
          {hasInput && (
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-icon dec-clear"
              onClick={clearText}
              aria-label="Xóa"
              title="Xóa câu"
            >
              <Icon icon={X} size={16} />
            </button>
          )}
        </div>

        <div className="dec-actions">
          <button type="button" className="btn btn-primary" onClick={decodeNow} disabled={!hasInput}>
            <Icon icon={ScanText} size={16} />
            Giải mã
          </button>
          {SENTENCES.length > 0 && (
            <button type="button" className="btn btn-ghost" onClick={pickRandom}>
              <Icon icon={Shuffle} size={16} />
              Câu ngẫu nhiên
            </button>
          )}
        </div>

        {!hasInput && (
          <div className="dec-examples">
            <h3 className="dec-examples-title" id="dec-examples-label">
              Thử câu mẫu
            </h3>
            <div className="dec-examples-list" role="group" aria-labelledby="dec-examples-label">
              {/* EXAMPLES_SHOWN chips (2 on phones, via CSS) */}
              {EXAMPLES.slice(0, EXAMPLES_SHOWN).map((ex) => (
                <button
                  key={ex}
                  type="button"
                  className="chip dec-example"
                  lang="en"
                  onClick={() => loadText(ex)}
                  title={ex}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {showHistory && (
          <div className="dec-examples dec-history">
            <div className="dec-history-head">
              <h3 className="dec-examples-title" id="dec-history-label">
                Gần đây
              </h3>
              <button type="button" className="btn btn-ghost btn-sm dec-history-clear" onClick={clearHistory}>
                Xóa lịch sử
              </button>
            </div>
            <ul className="dec-history-list" aria-labelledby="dec-history-label">
              {history.map((h) => (
                <li key={h} className="dec-hchip">
                  <button type="button" className="dec-hchip-main" lang="en" onClick={() => loadText(h)} title={h}>
                    {chipLabel(h)}
                  </button>
                  <button
                    type="button"
                    className="dec-hchip-x"
                    onClick={() => forget(h)}
                    aria-label={`Xóa khỏi lịch sử: ${h}`}
                    title="Xóa khỏi lịch sử"
                  >
                    <Icon icon={X} size={14} strokeWidth={2.5} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {trimmed && (
        <section
          ref={resultRef}
          className={'card dec-result' + (stale ? ' is-stale' : '')}
          aria-busy={stale}
          aria-labelledby="dec-result-h"
        >
          <h2 id="dec-result-h" className="dec-sr">
            Người bản xứ nói
          </h2>
          {hasTokens ? (
            <>
              <div className="dec-result-head">
                <div className="dec-sentence">
                  <SpokenSentence
                    result={result}
                    activeAnnotationId={activeId}
                    onAnnotationClick={selectFromSentence}
                    playable
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-icon dec-share"
                  onClick={() => void share()}
                  aria-label="Chia sẻ liên kết"
                  title="Sao chép liên kết mở đúng câu này"
                >
                  <Icon icon={Link} size={18} />
                </button>
              </div>

              {vi && <p className="dec-vi">{vi}</p>}

              <div className="dec-play">
                <ListenPair text={query} decoded={result} say={say} size="md" />
                <RealVoiceLink phrase={youglishPhrase(query, result)} />
              </div>

              {focusAnn && (
                <div className="dec-focus">
                  <AnnotationCard
                    annotation={focusAnn}
                    selected
                    showIpa={showIpa}
                    onSelect={selectFromSentence}
                    as="div"
                    speech={speechFor(focusAnn)}
                  />
                </div>
              )}

              {annotations.length === 0 ? (
                <p className="dec-clean">Câu này khá rõ, không có biến âm đáng chú ý.</p>
              ) : (
                <details className="dec-details">
                  <summary>Chi tiết · {annotations.length} biến âm</summary>
                  <AnnotationList
                    annotations={annotations}
                    selectedId={activeId}
                    showIpa={showIpa}
                    onSelect={selectFromList}
                    speechFor={speechFor}
                  />
                </details>
              )}

              <div className="dec-next" role="group" aria-label="Luyện tiếp với câu này">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={practiseDictation}
                  title="Thêm vào “Câu của tôi” rồi mở phần Chép chính tả"
                >
                  <Icon icon={PencilLine} size={15} />
                  Chép chính tả câu này
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={practiseShadowing}
                  title="Nghe rồi nói theo, ghi âm để so sánh"
                >
                  <Icon icon={Mic} size={15} />
                  Nói nhại câu này
                </button>
              </div>
              <div className="dec-notice-slot" role="status" aria-live="polite">
                {notice && (
                  <div className={'callout dec-notice' + (notice.kind === 'ok' ? '' : ' callout-warn')}>
                    <Icon icon={notice.kind === 'ok' ? CircleCheck : TriangleAlert} size={16} />
                    <div className="dec-notice-body">
                      <span>{notice.text}</span>
                      {notice.url && (
                        <input
                          className="input dec-notice-url"
                          readOnly
                          value={notice.url}
                          aria-label="Liên kết chia sẻ"
                          onFocus={(e) => e.currentTarget.select()}
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="dec-noresult">Không tìm thấy từ tiếng Anh nào để phân tích. Hãy thử một câu khác.</p>
          )}
        </section>
      )}

      <PhenomenaGuide />
    </div>
  );
}
