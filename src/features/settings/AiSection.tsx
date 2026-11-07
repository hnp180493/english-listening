// Settings → "Trợ lý AI": add / test / edit / remove AI providers (keys stay on this device), the daily
// cap and usage line, plus the "Nguồn giọng" row used by the Giọng đọc card. AI is an add-on: with no
// provider configured the app works exactly as before. See docs/ai-providers.md.

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Check, ChevronDown, Eye, EyeOff, Plus, ShieldCheck, Sparkles, Trash2, TriangleAlert, Volume2 } from 'lucide-react';
import { Icon } from '../../components/Icon';
import Popover from '../../components/Popover';
import Segmented from '../../components/Segmented';
import {
  aiSpeak,
  createProviderConfig,
  defaultsFor,
  isAiError,
  keyLooksWrong,
  listProviderModels,
  maskKey,
  removeProvider,
  setDefaultProvider,
  testProvider,
  updateAiConfig,
  upsertProvider,
  useAiConfig,
  useAiStatus,
  useAiUsageToday,
  type ModelInfo,
  type ProviderConfig,
  type ProviderKind,
  type ProviderSummary,
  type TestResult,
} from '../../core/ai';
import { updateSettings, useSettings } from '../../core/settings';
import { aiVoicePausedReason, stopSpeaking, useVoiceEngine, useVoiceStatus } from '../../core/tts';
import { clearAiTaskCache } from '../../core/aiTasks';
import SectionHead from './SectionHead';
import './AiSection.css';
import { aiUsageLine, geminiVoiceStyle, isValidBaseUrl, modelChoices, parseDailyCap } from './settingsModel';

/** Element id of the AI card (#/settings?section=ai scrolls here). */
export const AI_SECTION_ID = 'set-ai';
const VOICE_SAMPLE = "Hey, what're you gonna do this weekend? I've gotta get some rest.";
const OTHER_MODEL = '__other__';

/** Short names for messages ("key Gemini", "key OpenAI"…). */
const SHORT: Record<ProviderKind, string> = {
  gemini: 'Gemini',
  openai: 'OpenAI',
  anthropic: 'Claude',
  openrouter: 'OpenRouter',
  'openai-compatible': 'máy chủ',
};

/** "Nhà cung cấp khác": label + one plain line on what it gives. */
const OTHER_KINDS: { kind: ProviderKind; label: string; note: string }[] = [
  { kind: 'openai', label: 'OpenAI', note: 'Văn bản và giọng đọc' },
  { kind: 'anthropic', label: 'Claude (Anthropic)', note: 'Chỉ văn bản, không có giọng đọc' },
  { kind: 'openrouter', label: 'OpenRouter', note: 'Nhiều model qua một key, chỉ văn bản' },
  { kind: 'openai-compatible', label: 'Tương thích OpenAI (base URL)', note: 'Ollama, LM Studio… trên máy bạn' },
];

/** A provider name inside a sentence: the generic "Máy chủ tương thích OpenAI" loses its capital. */
function inSentence(label: string): string {
  return label === defaultsFor('openai-compatible').label ? label.charAt(0).toLowerCase() + label.slice(1) : label;
}

function scrollToAi(focusSelector?: string): void {
  const el = document.getElementById(AI_SECTION_ID);
  if (!el) return;
  el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  if (focusSelector) el.querySelector<HTMLElement>(focusSelector)?.focus({ preventScroll: true });
}

// ───────────────────────── Voice engine (used by the Giọng đọc card) ─────────────────────────

/** Plays a short sample with the provider's voice. One clip at a time; stops browser speech first. */
function useVoiceSample() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null });

  const stop = () => {
    ctrlRef.current?.abort();
    const a = audioRef.current;
    if (a) {
      a.pause();
      URL.revokeObjectURL(a.src);
      audioRef.current = null;
    }
  };
  useEffect(() => stop, []);

  const play = async (providerId: string, voice: string | undefined, rate = 1) => {
    stop();
    stopSpeaking();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setState({ busy: true, error: null });
    try {
      const { audio } = await aiSpeak(VOICE_SAMPLE, { provider: providerId, voice, signal: ctrl.signal });
      if (ctrl.signal.aborted) return;
      const a = new Audio(URL.createObjectURL(audio));
      a.preservesPitch = true;
      a.playbackRate = Math.min(1.5, Math.max(0.5, rate));
      audioRef.current = a;
      a.onended = () => {
        URL.revokeObjectURL(a.src);
        if (audioRef.current === a) audioRef.current = null;
      };
      await a.play();
      setState({ busy: false, error: null });
    } catch (e) {
      if (ctrl.signal.aborted || (isAiError(e) && e.code === 'aborted')) return;
      setState({ busy: false, error: isAiError(e) ? e.message : 'Không phát được đoạn thử. Hãy thử lại.' });
    }
  };
  return { ...state, play };
}

/** Voice select (+ "Nghe thử") of one TTS provider; changing it saves at once. */
function AiVoicePicker({ provider, id }: { provider: ProviderSummary; id: string }) {
  const rate = useSettings().rate;
  const d = defaultsFor(provider.kind);
  const voices = d.voices ?? [];
  const voice = provider.ttsVoice || d.ttsVoice || '';
  const sample = useVoiceSample();
  const list = voices.includes(voice) || !voice ? voices : [voice, ...voices];
  const onChange = (v: string) =>
    updateAiConfig((c) => ({ ...c, providers: c.providers.map((p) => (p.id === provider.id ? { ...p, ttsVoice: v } : p)) }));

  return (
    <div className="set-field">
      <label htmlFor={id} className="field-label set-label">
        Giọng AI
      </label>
      <div className="set-ai-voice">
        <select id={id} className="select" value={voice} onChange={(e) => onChange(e.target.value)}>
          {list.map((v) => {
            const style = provider.kind === 'gemini' ? geminiVoiceStyle(v) : '';
            return (
              <option key={v} value={v}>
                {v}
                {style ? ` · ${style}` : ''}
                {v === d.ttsVoice ? ' (mặc định)' : ''}
              </option>
            );
          })}
        </select>
        <button type="button" className="btn btn-soft" onClick={() => void sample.play(provider.id, voice, typeof rate === 'number' ? rate : 1)} disabled={sample.busy}>
          <Icon icon={Volume2} size={16} />
          {sample.busy ? 'Đang tạo…' : 'Nghe thử'}
        </button>
      </div>
      {sample.error ? (
        <p className="set-ai-warn" role="alert">
          <Icon icon={TriangleAlert} size={15} />
          {sample.error}
        </p>
      ) : (
        <p className="set-hint">Câu đã nghe được lưu lại, nghe lại không tốn thêm yêu cầu. Câu sắp nghe được tạo sẵn để phát ngay.</p>
      )}
    </div>
  );
}

/**
 * "Nguồn giọng" row of the Giọng đọc card: Trình duyệt / Giọng AI. The AI option is disabled (with a
 * hint and a way to the AI card) until a provider that can speak is configured. With AI on, the AI
 * voice picker replaces the browser voice list (`children`, shown only for the browser engine).
 */
export function VoiceEngineRow({ children }: { children?: ReactNode }) {
  const uid = useId();
  const settings = useSettings();
  const status = useAiStatus();
  useVoiceStatus(); // re-render when the AI voice pauses or recovers
  const live = useVoiceEngine();
  const tts = status.tts;
  // No provider that can speak: no row at all (the Trợ lý AI card already offers a natural voice).
  if (!tts) return <>{children}</>;
  const engine = settings.voiceEngine === 'ai' ? 'ai' : 'browser';
  const paused = engine === 'ai' && live === 'browser' ? aiVoicePausedReason() : null;
  return (
    <>
      <div className="set-row">
        <span className="set-row-text">
          <span className="set-label" id={`${uid}-l`}>
            Nguồn giọng
          </span>
        </span>
        <Segmented
          ariaLabel="Nguồn giọng"
          value={engine}
          onChange={(v) => updateSettings({ voiceEngine: v })}
          options={[
            { value: 'browser', label: 'Trình duyệt' },
            {
              value: 'ai',
              label: (
                <>
                  <Icon icon={Sparkles} size={15} />
                  Giọng AI
                </>
              ),
            },
          ]}
        />
      </div>
      {paused && (
        <p className="set-ai-warn" role="status">
          <Icon icon={TriangleAlert} size={15} />
          <span>
            Giọng AI đang tạm tắt, app dùng giọng trình duyệt: {paused}{' '}
            <button type="button" className="set-linkbtn" onClick={() => scrollToAi()}>
              Kiểm tra kết nối
            </button>
          </span>
        </p>
      )}
      {engine === 'ai' ? <AiVoicePicker provider={tts} id={`${uid}-aivoice`} /> : children}
    </>
  );
}

// ───────────────────────── Provider form ─────────────────────────

type ModelsState = { status: 'idle' | 'loading' | 'ok' | 'error'; list: ModelInfo[]; error?: string };

interface FormProps {
  kind: ProviderKind;
  /** The saved provider being edited (undefined: adding a new one). */
  existing?: ProviderConfig;
  onDone: (saved: ProviderConfig, result: TestResult | null) => void;
  onCancel: () => void;
}

function ProviderForm({ kind, existing, onDone, onCancel }: FormProps) {
  const uid = useId();
  const d = defaultsFor(kind);
  const [key, setKey] = useState('');
  // "trông không giống key" is checked once the key is complete (blur or paste), not on every keystroke
  const [keyChecked, setKeyChecked] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl ?? (d.requiresBaseUrl ? d.baseUrl : ''));
  const [model, setModel] = useState(existing?.model || d.model);
  const [otherModel, setOtherModel] = useState(false);
  const [models, setModels] = useState<ModelsState>({ status: 'idle', list: [] });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);
  const keyRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => () => ctrlRef.current?.abort(), []);
  useEffect(() => {
    keyRef.current?.focus({ preventScroll: true });
    // "Sửa" opens the form in place of the row: bring its title into view (on phones it starts far down)
    formRef.current?.scrollIntoView({ block: 'nearest' });
    const top = formRef.current?.getBoundingClientRect().top ?? 0;
    if (top < 0 || top > window.innerHeight * 0.5) formRef.current?.scrollIntoView({ block: 'start' });
  }, []);

  const savedKey = existing?.apiKey ?? '';
  const effectiveKey = key.trim() || savedKey;
  const urlBad = baseUrl.trim() !== '' && !isValidBaseUrl(baseUrl);
  const urlMissing = d.requiresBaseUrl && baseUrl.trim() === '';
  const keyMissing = d.requiresKey && !effectiveKey;
  const canSubmit = !keyMissing && !urlBad && !urlMissing && model.trim() !== '' && !busy;
  const wrongKey = keyChecked && keyLooksWrong(kind, key);
  // Model and base URL have good defaults for the cloud providers: keep them behind "Nâng cao".
  const advancedOnly = !d.requiresBaseUrl && !!d.model;

  const draft = (): ProviderConfig =>
    createProviderConfig(kind, {
      id: existing?.id,
      label: existing?.label,
      apiKey: effectiveKey,
      model: model.trim(),
      baseUrl: baseUrl.trim() || undefined,
      ttsModel: existing?.ttsModel,
      ttsVoice: existing?.ttsVoice,
      enabled: true,
    });

  const loadModels = async () => {
    if (models.status === 'loading' || (d.requiresKey && !effectiveKey) || urlBad || urlMissing) return;
    setModels((m) => ({ ...m, status: 'loading' }));
    try {
      const list = await listProviderModels(draft());
      setModels({ status: 'ok', list });
    } catch (e) {
      setModels({ status: 'error', list: [], error: isAiError(e) ? e.message : 'Không tải được danh sách model.' });
    }
  };

  const choices = modelChoices(model, d.suggestedModels, models.list);
  const inList = !otherModel && choices.includes(model.trim());

  const save = (p: ProviderConfig, r: TestResult | null) => {
    upsertProvider(p);
    onDone(p, r);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    ctrlRef.current?.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setBusy(true);
    setResult(null);
    const p = draft();
    const r = await testProvider(p, ctrl.signal);
    if (ctrl.signal.aborted) return;
    setBusy(false);
    if (r.ok) save(p, r);
    else setResult(r);
  };

  const modelField = (
    <div className="set-field">
      <label htmlFor={`${uid}-model`} className="field-label set-label">
        Model
      </label>
      {choices.length > 0 && (
        <select
          id={`${uid}-model`}
          className="select"
          value={inList ? model.trim() : OTHER_MODEL}
          onChange={(e) => {
            if (e.target.value === OTHER_MODEL) setOtherModel(true);
            else {
              setOtherModel(false);
              setModel(e.target.value);
            }
          }}
        >
          {choices.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
          <option value={OTHER_MODEL}>Khác (tự nhập)…</option>
        </select>
      )}
      {(!inList || choices.length === 0) && (
        <input
          id={choices.length === 0 ? `${uid}-model` : undefined}
          aria-label={choices.length > 0 ? 'Tên model' : undefined}
          className="input"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          placeholder={kind === 'openai-compatible' ? 'Ví dụ: qwen3' : d.model}
          autoComplete="off"
          spellCheck={false}
        />
      )}
      <p className="set-hint" aria-live="polite">
        {models.status === 'loading' ? (
          'Đang tải danh sách model…'
        ) : models.status === 'error' ? (
          <>Không tải được danh sách model: {models.error}</>
        ) : models.status === 'ok' ? (
          `${models.list.filter((m) => m.kind === 'text').length} model từ ${d.label}.`
        ) : (
          <>
            {d.model ? `Mặc định ${d.model}: nhanh, rẻ, hợp với app này. ` : ''}
            <button type="button" className="set-linkbtn" onClick={() => void loadModels()} disabled={(d.requiresKey && !effectiveKey) || urlBad || urlMissing}>
              Tải danh sách model
            </button>
          </>
        )}
      </p>
    </div>
  );

  const urlField = (
    <div className="set-field">
      <label htmlFor={`${uid}-url`} className="field-label set-label">
        Địa chỉ máy chủ (base URL)
      </label>
      <input
        id={`${uid}-url`}
        className="input"
        type="url"
        inputMode="url"
        value={baseUrl}
        onChange={(e) => setBaseUrl(e.target.value)}
        placeholder={d.baseUrl}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={urlBad || undefined}
      />
      {urlBad ? (
        <p className="set-ai-warn" role="status">
          <Icon icon={TriangleAlert} size={15} />
          Địa chỉ phải bắt đầu bằng http:// hoặc https:// và không chứa “?” hay “#”.
        </p>
      ) : (
        <p className="set-hint">
          {d.requiresBaseUrl ? 'Ollama: http://localhost:11434/v1 · LM Studio: http://localhost:1234/v1. Nhớ bật CORS trên máy chủ.' : 'Để trống để dùng địa chỉ chính thức.'}
        </p>
      )}
    </div>
  );

  return (
    <form ref={formRef} className="set-ai-form" onSubmit={(e) => void onSubmit(e)} aria-labelledby={`${uid}-t`} noValidate>
      <div id={`${uid}-t`} className="set-ai-form-title">
        {existing ? `Sửa ${inSentence(existing.label)}` : `Thêm ${inSentence(d.label)}`}
      </div>

      <div className="set-field">
        <label htmlFor={`${uid}-key`} className="field-label set-label">
          API key{!d.requiresKey && <span className="set-ai-optional"> (không bắt buộc)</span>}
        </label>
        <div className="set-ai-key">
          <input
            ref={keyRef}
            id={`${uid}-key`}
            className="input"
            type={showKey ? 'text' : 'password'}
            value={key}
            onChange={(e) => {
              setKey(e.target.value);
              setResult(null);
              if (!e.target.value) setKeyChecked(false);
            }}
            onBlur={() => setKeyChecked(true)}
            onPaste={() => setKeyChecked(true)}
            placeholder={savedKey ? 'Giữ key đã lưu' : d.requiresKey ? 'Dán key vào đây' : 'Để trống nếu máy chủ không cần'}
            title={savedKey ? `Để trống để giữ key đã lưu (${maskKey(savedKey)})` : undefined}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
            data-1p-ignore="true"
            aria-describedby={`${uid}-key-h`}
            aria-invalid={wrongKey || undefined}
          />
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={() => setShowKey((v) => !v)}
            aria-label={showKey ? 'Ẩn key' : 'Hiện key'}
            aria-pressed={showKey}
            title={showKey ? 'Ẩn key' : 'Hiện key'}
          >
            <Icon icon={showKey ? EyeOff : Eye} size={17} />
          </button>
        </div>
        {wrongKey && (
          <p className="set-ai-warn" role="status">
            <Icon icon={TriangleAlert} size={15} />
            Key này trông không giống key {SHORT[kind]}. Hãy kiểm tra đã sao chép đủ và đúng key chưa.
          </p>
        )}
        <p id={`${uid}-key-h`} className="set-hint">
          {d.keyHint}
          {d.keyUrl && (
            <>
              {' '}
              <a className="set-ai-nowrap" href={d.keyUrl} target="_blank" rel="noopener noreferrer">
                Lấy key ở đâu?
              </a>
            </>
          )}
        </p>
      </div>

      {!advancedOnly && urlField}
      {!advancedOnly && modelField}
      {advancedOnly && (
        <details
          className="set-privacy set-ai-adv"
          open={existing ? existing.model !== d.model || !!existing.baseUrl : undefined}
          onToggle={(e) => {
            if ((e.currentTarget as HTMLDetailsElement).open && models.status === 'idle' && effectiveKey) void loadModels();
          }}
        >
          <summary>Nâng cao</summary>
          <div className="set-ai-adv-body">
            {modelField}
            {urlField}
          </div>
        </details>
      )}

      {result && !result.ok && (
        <div className="callout callout-warn" role="alert">
          <Icon icon={TriangleAlert} size={16} />
          <div className="set-callout-body">
            <span>{result.message}</span>
            {result.code !== 'bad-key' && result.code !== 'no-provider' && (
              <button type="button" className="set-linkbtn" onClick={() => save(draft(), result)}>
                Vẫn lưu, kiểm tra lại sau
              </button>
            )}
          </div>
        </div>
      )}

      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
          {busy ? 'Đang kiểm tra…' : 'Lưu và kiểm tra'}
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            ctrlRef.current?.abort();
            onCancel();
          }}
        >
          Hủy
        </button>
      </div>
    </form>
  );
}

// ───────────────────────── Saved provider ─────────────────────────

type TestState = TestResult | 'busy';

function ProviderRow({
  p,
  test,
  onTest,
  onEdit,
  offer,
}: {
  p: ProviderSummary;
  test: TestState | undefined;
  onTest: () => void;
  onEdit: () => void;
  /** Shown inside the success message (e.g. "Dùng giọng AI?" right after adding a provider that can speak). */
  offer?: ReactNode;
}) {
  const uid = useId();
  const [confirm, setConfirm] = useState(false);
  const d = defaultsFor(p.kind);
  const meta = [
    p.hasKey ? `Key ${p.keyMasked}` : d.requiresKey ? 'Chưa có key' : 'Không dùng key',
    p.model || 'chưa chọn model',
    p.capabilities.tts ? `giọng ${p.ttsVoice || d.ttsVoice}` : '',
  ].filter(Boolean);

  return (
    <div className="set-ai-provider">
      <div className="set-ai-provider-head">
        <div className="set-ai-provider-text">
          <div className="set-label">{p.label}</div>
          <p className="set-hint">{meta.join(' · ')}</p>
        </div>
      </div>

      <div className="row set-ai-actions">
        <button type="button" className="btn btn-sm" onClick={onTest} disabled={test === 'busy'}>
          {test === 'busy' ? 'Đang kiểm tra…' : 'Kiểm tra kết nối'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}>
          Sửa
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirm(true)} aria-expanded={confirm}>
          <Icon icon={Trash2} size={15} />
          Xóa…
        </button>
      </div>

      {test && test !== 'busy' && test.ok && (
        <p className="set-hint set-ai-ok" role="status">
          <Icon icon={Check} size={15} />
          {test.message}
        </p>
      )}
      {test && test !== 'busy' && test.ok && offer && <div className="set-ai-offer">{offer}</div>}
      {test && test !== 'busy' && !test.ok && (
        <div className="callout callout-warn" role="alert">
          <Icon icon={TriangleAlert} size={16} />
          <div className="set-callout-body">
            <span>{test.message}</span>
          </div>
        </div>
      )}

      {confirm && (
        <div className="set-confirm set-confirm--danger" role="alertdialog" aria-labelledby={`${uid}-h`} aria-describedby={`${uid}-d`}>
          <div id={`${uid}-h`} className="set-confirm-title">
            Xóa {inSentence(p.label)} khỏi máy này?
          </div>
          <p id={`${uid}-d`} className="set-hint">
            {p.hasKey && p.kind !== 'openai-compatible'
              ? `Key sẽ bị xóa khỏi trình duyệt này nhưng vẫn còn hiệu lực ở ${d.label}; nếu không dùng nữa, hãy thu hồi key ở đó.`
              : 'Cấu hình này sẽ bị xóa khỏi trình duyệt.'}
          </p>
          <div className="row">
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                removeProvider(p.id);
                clearAiTaskCache(); // answers made with it (they may quote what the learner typed)
              }}
            >
              Xóa
            </button>
            <button type="button" className="btn" onClick={() => setConfirm(false)} autoFocus>
              Hủy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Section ─────────────────────────

type Editing = { kind: ProviderKind; id?: string } | null;
/** Provider id whose success message offers "Dùng giọng AI". */
type Notice = { offerVoiceFor: string } | null;

function KindMenu({ onPick, trigger, triggerClassName }: { onPick: (k: ProviderKind) => void; trigger: ReactNode; triggerClassName: string }) {
  return (
    <Popover trigger={trigger} triggerClassName={triggerClassName} title="Nhà cung cấp khác" align="start" panelClassName="set-ai-kinds-panel">
      {(close) => (
        <div className="set-ai-kinds" role="list">
          {OTHER_KINDS.map((o) => (
            <button
              key={o.kind}
              type="button"
              role="listitem"
              className="set-ai-kind"
              onClick={() => {
                close();
                onPick(o.kind);
              }}
            >
              <span className="set-ai-kind-name">{o.label}</span>
              <span className="set-ai-kind-note">{o.note}</span>
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}

export default function AiSection() {
  const uid = useId();
  const config = useAiConfig();
  const status = useAiStatus();
  const usage = useAiUsageToday();
  const settings = useSettings();
  const [editing, setEditing] = useState<Editing>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [tests, setTests] = useState<Record<string, TestState>>({});
  const [capDraft, setCapDraft] = useState<string | null>(null);
  const testCtrl = useRef<AbortController | null>(null);
  useEffect(() => () => testCtrl.current?.abort(), []);

  const providers = status.providers;
  const has = providers.length > 0;
  const textChoices = providers.filter((p) => p.usable);
  const ttsChoices = providers.filter((p) => p.capabilities.tts && p.enabled);

  const start = (kind: ProviderKind, id?: string) => {
    setNotice(null);
    setEditing({ kind, id });
  };

  const onDone = (saved: ProviderConfig, r: TestResult | null) => {
    setEditing(null);
    if (r) setTests((t) => ({ ...t, [saved.id]: r }));
    const canSpeak = providers.find((p) => p.id === saved.id)?.capabilities.tts ?? !!defaultsFor(saved.kind).ttsModel;
    setNotice(r?.ok && canSpeak && settings.voiceEngine !== 'ai' ? { offerVoiceFor: saved.id } : null);
  };

  const onTest = async (id: string) => {
    testCtrl.current?.abort();
    const ctrl = new AbortController();
    testCtrl.current = ctrl;
    setTests((t) => ({ ...t, [id]: 'busy' }));
    const r = await testProvider(id, ctrl.signal);
    if (ctrl.signal.aborted) {
      setTests((t) => {
        const { [id]: _drop, ...rest } = t;
        void _drop;
        return rest;
      });
      return;
    }
    setTests((t) => ({ ...t, [id]: r }));
  };

  const capValue = capDraft ?? (config.dailyRequestCap ? String(config.dailyRequestCap) : '');
  const capParsed = parseDailyCap(capValue);
  const commitCap = () => {
    if (capDraft == null) return;
    const v = parseDailyCap(capDraft);
    if (v !== null) updateAiConfig((c) => ({ ...c, dailyRequestCap: v }));
    setCapDraft(null);
  };

  const editingProvider = editing?.id ? config.providers.find((p) => p.id === editing.id) : undefined;

  return (
    <section id={AI_SECTION_ID} className="card set-section set-ai" aria-labelledby={`${uid}-h`}>
      <SectionHead
        id={`${uid}-h`}
        title="Trợ lý AI"
        sub={
          has
            ? 'Giọng đọc tự nhiên, giải thích vì sao nghe sai, tạo câu luyện và nhận xét tiến bộ.'
            : 'Tùy chọn: giọng đọc tự nhiên, giải thích vì sao nghe sai, tạo câu luyện và nhận xét tiến bộ.'
        }
      />

      {!has && !editing && (
        <div className="set-connect">
          <button type="button" className="btn btn-soft" data-ai-add onClick={() => start('gemini')}>
            <Icon icon={Sparkles} size={16} />
            Thêm Gemini
          </button>
          <KindMenu
            onPick={(k) => start(k)}
            triggerClassName="btn btn-ghost btn-sm"
            trigger={
              <>
                Nhà cung cấp khác
                <Icon icon={ChevronDown} size={15} />
              </>
            }
          />
          <p className="set-hint">Gemini có gói miễn phí.</p>
        </div>
      )}

      {providers.map((p) =>
        editing?.id === p.id && editingProvider ? (
          <ProviderForm key={p.id} kind={p.kind} existing={editingProvider} onDone={onDone} onCancel={() => setEditing(null)} />
        ) : (
          <ProviderRow
            key={p.id}
            p={p}
            test={tests[p.id]}
            onTest={() => void onTest(p.id)}
            onEdit={() => start(p.kind, p.id)}
            offer={
              notice?.offerVoiceFor === p.id && settings.voiceEngine !== 'ai' ? (
                <>
                  <span>Dùng giọng AI tự nhiên này để đọc mọi câu trong app?</span>
                  <div className="row">
                    <button
                      type="button"
                      className="btn btn-sm btn-soft"
                      onClick={() => {
                        updateSettings({ voiceEngine: 'ai' });
                        setNotice(null);
                      }}
                    >
                      <Icon icon={Sparkles} size={15} />
                      Dùng giọng AI
                    </button>
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => setNotice(null)}>
                      Để sau
                    </button>
                  </div>
                </>
              ) : undefined
            }
          />
        ),
      )}

      {editing && !editing.id && <ProviderForm kind={editing.kind} onDone={onDone} onCancel={() => setEditing(null)} />}

      {has && (
        <div className="set-ai-more">
          {providers.length > 1 && (
            <>
              <div className="set-row">
                <label className="set-label set-row-text" htmlFor={`${uid}-dtext`}>
                  Dùng cho giải thích và tạo câu
                </label>
                <select
                  id={`${uid}-dtext`}
                  className="select set-ai-default"
                  value={status.text?.id ?? ''}
                  onChange={(e) => setDefaultProvider('text', e.target.value || undefined)}
                  disabled={textChoices.length === 0}
                >
                  {textChoices.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              {ttsChoices.length > 1 && (
                <div className="set-row">
                  <label className="set-label set-row-text" htmlFor={`${uid}-dtts`}>
                    Dùng cho giọng đọc
                  </label>
                  <select
                    id={`${uid}-dtts`}
                    className="select set-ai-default"
                    value={status.tts?.id ?? ''}
                    onChange={(e) => setDefaultProvider('tts', e.target.value || undefined)}
                  >
                    {ttsChoices.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </>
          )}

          <div className="set-row">
            <span className="set-row-text">
              <label className="set-label" htmlFor={`${uid}-cap`}>
                Giới hạn yêu cầu mỗi ngày
              </label>
              <span className="set-hint">{aiUsageLine(usage.total, config.dailyRequestCap)}</span>
            </span>
            <input
              id={`${uid}-cap`}
              className="input set-ai-cap"
              type="text"
              inputMode="numeric"
              value={capValue}
              placeholder="Không giới hạn"
              onChange={(e) => setCapDraft(e.target.value)}
              onBlur={commitCap}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitCap();
              }}
              aria-invalid={capParsed === null || undefined}
            />
          </div>
          {capParsed === null && (
            <p className="set-ai-warn" role="status">
              <Icon icon={TriangleAlert} size={15} />
              Nhập một số nguyên dương, hoặc để trống nếu không muốn giới hạn.
            </p>
          )}
          {status.overDailyCap && (
            <div className="callout callout-warn" role="status">
              <Icon icon={TriangleAlert} size={16} />
              <div>Đã đạt giới hạn hôm nay. AI tạm nghỉ đến ngày mai; app dùng giọng trình duyệt và giải thích có sẵn.</div>
            </div>
          )}

          {!editing && (
            <div className="set-ai-add">
              {!providers.some((p) => p.kind === 'gemini') && (
                <button type="button" className="btn btn-ghost btn-sm" data-ai-add onClick={() => start('gemini')}>
                  <Icon icon={Plus} size={15} />
                  Thêm Gemini
                </button>
              )}
              <KindMenu
                onPick={(k) => start(k)}
                triggerClassName="btn btn-ghost btn-sm"
                trigger={
                  <>
                    <Icon icon={Plus} size={15} />
                    Thêm nhà cung cấp khác
                  </>
                }
              />
            </div>
          )}
        </div>
      )}

      <details className="how set-ai-how">
        <summary>
          <Icon icon={ShieldCheck} size={18} />
          Key và dữ liệu gửi đi
        </summary>
        <ul>
          <li>
            Key chỉ lưu trong trình duyệt này, trên máy này: <strong>không</strong> đồng bộ sang thư mục chung, <strong>không</strong> có
            trong tệp sao lưu. Mỗi máy nhập key riêng. “Xóa toàn bộ dữ liệu” cũng xóa key.
          </li>
          <li>
            Gửi tới nhà cung cấp: câu tiếng Anh cần đọc hoặc giải thích, những gì bạn gõ, và số liệu tiến độ tổng hợp. Không gửi tên các
            mục trong Nhật ký nghe.
          </li>
          <li>
            Nên tạo key riêng cho app này, giới hạn key chỉ dùng cho AI (Gemini: “Generative Language API”) và đặt hạn mức chi tiêu ở
            nhà cung cấp. Nghi bị lộ thì thu hồi key ngay.
          </li>
          <li>Ai dùng chung trình duyệt này đều có thể đọc được key, nên chỉ nhập key trên máy cá nhân.</li>
        </ul>
        <p className="set-ai-how-links">
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">
            Quản lý key Gemini
          </a>
          {' · '}
          <a href="https://cloud.google.com/docs/authentication/api-keys#adding-api-restrictions" target="_blank" rel="noopener noreferrer">
            Cách giới hạn key
          </a>
        </p>
      </details>
    </section>
  );
}
