import { useEffect, useId, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import {
  Check,
  Download,
  Lightbulb,
  Monitor,
  Moon,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Trash2,
  TriangleAlert,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import { Icon } from '../../components/Icon';
import PageHeader from '../../components/PageHeader';
import Segmented from '../../components/Segmented';
import PlayButton from '../../components/PlayButton';
import {
  backupFileName,
  clearAll,
  exportBackup,
  importBackup,
  MAX_BACKUP_SIZE,
  serializeBackup,
  summarizeBackup,
  validateBackup,
  type Backup,
  type StorageLike,
} from '../../core/backup';
import { clampGoal, GOAL_MAX, GOAL_MIN, GOAL_STEP } from '../../core/goals';
import { clearAiDeviceData, clearTtsCache, useAiStatus } from '../../core/ai';
import { clearAiTaskCache } from '../../core/aiTasks';
import { flushFolderSync, useFolderSync } from '../../core/folderSyncController';
import { navigate, useRoute } from '../../core/nav';
import { REVIEW_MINUTES_OPTIONS } from '../../core/review/constants';
import { LISTEN_GOAL_OPTIONS, sanitizeListenGoal, sanitizeReviewMinutes, updateSettings, useSettings, type Settings } from '../../core/settings';
import { resetStats } from '../../core/stats';
import { KEYS, notifyWrite, removeKey } from '../../core/storage';
import { pickVoice, ttsSupported, useEnglishVoices } from '../../core/tts';
import { sanitizeTheme } from '../../core/theme';
import { useLiveStats } from '../home/hooks';
import {
  accentLabel,
  clampRate,
  formatDateTimeVi,
  formatRate,
  goalHint,
  goalMinutes,
  goalOptions,
  isRecommendedVoice,
  listenGoalLabel,
  RATE_MAX,
  RATE_MIN,
  RATE_STEP,
  rateHint,
  sortVoices,
  voiceDisplayName,
} from './settingsModel';
import AiSection, { AI_SECTION_ID, VoiceEngineRow } from './AiSection';
import SectionHead from './SectionHead';
import SyncSection from './SyncSection';
import './settings.css';

const APP_VERSION = '1.0';
const SAMPLE = "What do you want to do tonight? I'm going to check it out.";
const GOAL_PRESETS = [15, 30, 50, 80];

function appStorage(): StorageLike | null {
  try {
    const s = window.localStorage;
    void s.length;
    return s;
  } catch {
    return null;
  }
}

// ───────────────────────── Shared bits ─────────────────────────

/** Inline style for .set-range: how much of the track is filled. */
function rangeFill(value: number, min: number, max: number): CSSProperties {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return { '--set-pct': `${Math.min(100, Math.max(0, pct))}%` } as CSSProperties;
}

// ───────────────────────── Voice ─────────────────────────

function VoiceSection() {
  const settings = useSettings();
  const voices = useEnglishVoices();
  const uid = useId();
  const supported = ttsSupported();
  const aiTts = useAiStatus().tts;
  const aiOn = settings.voiceEngine === 'ai' && aiTts != null;
  // Voice lists often arrive a moment after load (voiceschanged); wait before saying "none".
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setWaited(true), 2000);
    return () => window.clearTimeout(id);
  }, []);

  const sorted = sortVoices(voices);
  const selectedExists = settings.voiceURI != null && voices.some((v) => v.voiceURI === settings.voiceURI);
  const autoVoice = voices.length > 0 ? pickVoice(null) : null;
  const rate = clampRate(settings.rate);
  const hasRecommended = voices.some((v) => isRecommendedVoice(v.name));
  const current = selectedExists ? voices.find((v) => v.voiceURI === settings.voiceURI) : autoVoice;
  // The tip only matters while the voice in use is not a natural-sounding one.
  const showTip = !aiOn && current != null && !/natural/i.test(current.name);

  return (
    <section className="card set-section" aria-labelledby={`${uid}-h`}>
      <SectionHead id={`${uid}-h`} title="Giọng đọc" sub="Giọng tiếng Anh đọc mọi câu." />

      <VoiceEngineRow>
        {!supported ? (
          <div className="callout callout-warn" role="status">
            <Icon icon={TriangleAlert} size={16} />
            <div>Trình duyệt này không hỗ trợ đọc giọng nói (Web Speech). Hãy dùng Microsoft Edge hoặc Google Chrome bản mới nhất.</div>
          </div>
        ) : (
          <div className="set-field">
            <label htmlFor={`${uid}-voice`} className="field-label set-label">
              Giọng tiếng Anh
            </label>
            <select
              id={`${uid}-voice`}
              className="select"
              value={selectedExists ? (settings.voiceURI as string) : ''}
              onChange={(e) => updateSettings({ voiceURI: e.target.value === '' ? null : e.target.value })}
              disabled={voices.length === 0}
              aria-describedby={`${uid}-voice-help`}
            >
              <option value="">Tự động: chọn giọng tự nhiên nhất</option>
              {sorted.map((v, i) => (
                <option key={`${v.voiceURI}|${i}`} value={v.voiceURI}>
                  {voiceDisplayName(v.name)} · {accentLabel(v.lang)}
                  {isRecommendedVoice(v.name) ? ' (khuyên dùng)' : ''}
                </option>
              ))}
            </select>
            <p id={`${uid}-voice-help`} className="field-hint set-field-hint">
              {voices.length === 0 && !waited
                ? 'Đang tải danh sách giọng đọc…'
                : current
                  ? `Đang dùng: ${voiceDisplayName(current.name)} (${accentLabel(current.lang)})`
                  : null}
            </p>
            {settings.voiceURI != null && !selectedExists && voices.length > 0 && (
              <div className="callout callout-warn" role="status">
                <Icon icon={TriangleAlert} size={16} />
                <div className="set-callout-body">
                  Giọng đã chọn trước đây không còn trên trình duyệt này, ứng dụng đang tự chọn giọng khác.
                  <div>
                    <button type="button" className="btn btn-sm" onClick={() => updateSettings({ voiceURI: null })}>
                      Dùng giọng tự động
                    </button>
                  </div>
                </div>
              </div>
            )}
            {voices.length === 0 && waited && (
              <div className="callout callout-warn" role="status">
                <Icon icon={TriangleAlert} size={16} />
                <div>
                  Chưa thấy giọng tiếng Anh nào. Hãy đợi vài giây hoặc tải lại trang. Nếu vẫn trống, hãy cài thêm giọng tiếng Anh cho hệ
                  điều hành (Windows: Cài đặt → Thời gian và ngôn ngữ → Giọng nói).
                </div>
              </div>
            )}
          </div>
        )}
      </VoiceEngineRow>

      {(supported || aiOn) && (
        <>
          <div className="set-field">
            <div className="set-label-row">
              <label htmlFor={`${uid}-rate`} className="field-label set-label">
                Tốc độ đọc
              </label>
              <output htmlFor={`${uid}-rate`} className="set-value">
                <span className="set-value-hint">{rateHint(rate)}</span>
                <span className="badge badge-accent set-value-badge">{formatRate(rate)}</span>
              </output>
            </div>
            <input
              id={`${uid}-rate`}
              className="set-range"
              type="range"
              min={RATE_MIN}
              max={RATE_MAX}
              step={RATE_STEP}
              value={rate}
              style={rangeFill(rate, RATE_MIN, RATE_MAX)}
              aria-valuetext={`${formatRate(rate).replace('×', '')} lần, ${rateHint(rate)}`}
              onChange={(e) => updateSettings({ rate: clampRate(Number(e.target.value)) })}
            />
            <div className="set-scale" aria-hidden="true">
              <span>0,5× chậm</span>
              <span>1× thường</span>
              <span>1,5× nhanh</span>
            </div>
            {/* With the AI voice, "Nghe thử" next to the voice list is the preview (at this rate). */}
            {!aiOn && (
              <div className="set-try">
                <PlayButton text={SAMPLE} rate={rate} label="Thử giọng" size="sm" variant="soft" />
                <span className="set-sample" lang="en">
                  “{SAMPLE}”
                </span>
              </div>
            )}
          </div>

          {showTip && (
            <div className="callout">
              <Icon icon={Lightbulb} size={16} />
              <div>
                Giọng <strong>“Natural”</strong> của Microsoft Edge nghe giống người bản xứ nhất. Trên Chrome, chọn “Google US English”.
                {!hasRecommended && <> Thiết bị này chưa có giọng như vậy, hãy thử mở ứng dụng bằng Edge.</>}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ───────────────────────── Display ─────────────────────────

const THEMES: { id: Settings['theme']; label: string; icon: LucideIcon }[] = [
  { id: 'system', label: 'Theo hệ thống', icon: Monitor },
  { id: 'light', label: 'Sáng', icon: Sun },
  { id: 'dark', label: 'Tối', icon: Moon },
];

function DisplaySection() {
  const settings = useSettings();
  const uid = useId();
  const theme = sanitizeTheme(settings.theme);
  return (
    <section className="card set-section" aria-labelledby={`${uid}-h`}>
      <SectionHead id={`${uid}-h`} title="Hiển thị" sub="Giao diện sáng/tối và phiên âm." />

      <div className="set-row">
        <span className="set-label">Giao diện</span>
        <Segmented
          ariaLabel="Giao diện"
          className="set-theme"
          value={theme}
          onChange={(t) => updateSettings({ theme: t })}
          options={THEMES.map((t) => ({
            value: t.id,
            label: (
              <>
                <Icon icon={t.icon} size={15} />
                {t.label}
              </>
            ),
          }))}
        />
      </div>

      <label className="set-row set-switch-row" htmlFor={`${uid}-ipa`}>
        <span className="set-row-text">
          <span className="set-label">Hiện phiên âm IPA</span>
          <span className="set-hint">
            Ví dụ{' '}
            <span lang="en">
              want to
              <span className="respell-sep" aria-hidden="true">
                →
              </span>
              <span className="respell">wanna</span>
            </span>{' '}
            <span className="ipa">/ˈwɑːnə/</span>
          </span>
        </span>
        <input
          id={`${uid}-ipa`}
          className="set-switch-input"
          type="checkbox"
          role="switch"
          checked={settings.showIpa === true}
          onChange={(e) => updateSettings({ showIpa: e.target.checked })}
        />
        <span className="set-switch" aria-hidden="true" />
      </label>
    </section>
  );
}

// ───────────────────────── Goal ─────────────────────────

function GoalSection() {
  const settings = useSettings();
  const uid = useId();
  const goal = clampGoal(settings.dailyGoal);
  const reviewMinutes = sanitizeReviewMinutes(settings.reviewMinutes);
  const listenGoal = sanitizeListenGoal(settings.listenGoal);
  // A goal outside the presets was set with the slider: keep the slider open for it.
  const [custom, setCustom] = useState(() => !GOAL_PRESETS.includes(goal));
  return (
    <section className="card set-section" aria-labelledby={`${uid}-h`}>
      <SectionHead id={`${uid}-h`} title="Mục tiêu mỗi ngày" sub="Số lượt luyện, thời gian ôn tập và giờ nghe thật." />
      <div className="set-field">
        <div className="set-label-row">
          <span id={`${uid}-goal-l`} className="set-label">
            Số lượt mỗi ngày
          </span>
          <span className="set-value-hint">
            ~{goalMinutes(goal)} phút · {goalHint(goal)}
          </span>
        </div>
        <div className="set-goal-row">
          <Segmented
            ariaLabel="Số lượt mỗi ngày"
            className="set-presets"
            value={goal}
            onChange={(g) => updateSettings({ dailyGoal: clampGoal(g) })}
            options={goalOptions(GOAL_PRESETS, goal).map((g) => ({ value: g, label: `${g} lượt` }))}
          />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-expanded={custom}
            aria-controls={`${uid}-custom`}
            onClick={() => setCustom((v) => !v)}
          >
            <Icon icon={SlidersHorizontal} size={15} />
            Tùy chỉnh…
          </button>
        </div>
        {custom && (
          <div id={`${uid}-custom`} className="set-custom">
            <input
              id={`${uid}-goal`}
              className="set-range"
              type="range"
              min={GOAL_MIN}
              max={GOAL_MAX}
              step={GOAL_STEP}
              value={goal}
              style={rangeFill(goal, GOAL_MIN, GOAL_MAX)}
              aria-labelledby={`${uid}-goal-l`}
              aria-valuetext={`${goal} lượt mỗi ngày, khoảng ${goalMinutes(goal)} phút`}
              onChange={(e) => updateSettings({ dailyGoal: clampGoal(Number(e.target.value)) })}
            />
            <div className="set-scale" aria-hidden="true">
              <span>{GOAL_MIN}</span>
              <span>{(GOAL_MIN + GOAL_MAX) / 2}</span>
              <span>{GOAL_MAX}</span>
            </div>
          </div>
        )}
      </div>
      <div className="set-row">
        <span className="set-row-text">
          <span className="set-label">Thời lượng ôn mỗi ngày</span>
          <span className="set-hint">Ôn tập lấy vừa đủ mục cho chừng này phút, phần dư chia sang các ngày sau.</span>
        </span>
        <Segmented
          ariaLabel="Thời lượng ôn mỗi ngày"
          value={reviewMinutes}
          onChange={(m) => updateSettings({ reviewMinutes: m })}
          options={REVIEW_MINUTES_OPTIONS.map((m) => ({ value: m, label: `${m} phút` }))}
        />
      </div>
      <div className="set-row">
        <span className="set-row-text">
          <label className="set-label" htmlFor={`${uid}-listen`}>
            Nghe tiếng Anh thật mỗi ngày
          </label>
          <span className="set-hint" id={`${uid}-listen-hint`}>
            Phim, YouTube, podcast… ngoài bài luyện. Ghi lại trong Nhật ký nghe.
          </span>
        </span>
        <select
          id={`${uid}-listen`}
          className="select set-listen-goal"
          aria-describedby={`${uid}-listen-hint`}
          value={listenGoal}
          onChange={(e) => updateSettings({ listenGoal: sanitizeListenGoal(Number(e.target.value)) })}
        >
          {LISTEN_GOAL_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {listenGoalLabel(m)}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}

// ───────────────────────── Data ─────────────────────────

type Pending = { backup: Backup; fileName: string } | null;
type Status = { kind: 'ok' | 'error'; text: string } | null;

/**
 * Data tools shown at the end of the "Dữ liệu & đồng bộ" card. Manual export/import only where folder
 * sync is unsupported (Firefox/Safari): elsewhere the synced folder file already is the backup.
 */
function DataTools() {
  const uid = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmHistory, setConfirmHistory] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const stats = useLiveStats();
  const hasHistory = Array.isArray(stats.attempts) && stats.attempts.length > 0;
  const [busy, setBusy] = useState(false);
  const sync = useFolderSync();
  const manual = sync.status === 'unsupported';
  const syncOn = sync.status !== 'off' && !manual;
  const storage = appStorage();

  const onExport = () => {
    if (!storage) {
      setStatus({ kind: 'error', text: 'Trình duyệt đang chặn bộ nhớ của trang, không thể xuất dữ liệu.' });
      return;
    }
    try {
      const backup = exportBackup(storage);
      const blob = new Blob([serializeBackup(backup)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backupFileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus({ kind: 'ok', text: `Đã tạo tệp ${a.download}. Hãy cất tệp này ở nơi an toàn.` });
    } catch {
      setStatus({ kind: 'error', text: 'Không tạo được tệp sao lưu. Hãy thử lại.' });
    }
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow choosing the same file again
    setConfirmClear(false);
    if (!file) return;
    if (file.size > MAX_BACKUP_SIZE) {
      setPending(null);
      setStatus({ kind: 'error', text: 'Tệp quá lớn, đây không phải bản sao lưu của Nghe Nối Âm.' });
      return;
    }
    try {
      const result = validateBackup(await file.text());
      if (!result.ok) {
        setPending(null);
        setStatus({ kind: 'error', text: result.error });
        return;
      }
      setStatus(null);
      setPending({ backup: result.backup, fileName: file.name });
    } catch {
      setPending(null);
      setStatus({ kind: 'error', text: 'Không đọc được tệp. Hãy chọn lại.' });
    }
  };

  /** Bulk change outside saveJSON: let folder sync write it to the folder before the reload. */
  const syncThenReload = async (delay: number) => {
    notifyWrite('*');
    await Promise.all([flushFolderSync(2000), new Promise((r) => window.setTimeout(r, delay))]);
    window.location.reload();
  };

  const onRestore = () => {
    if (!pending || !storage) return;
    setBusy(true);
    try {
      const n = importBackup(storage, pending.backup, { replace: true });
      setStatus({ kind: 'ok', text: `Đã khôi phục ${n} mục dữ liệu. Đang tải lại…` });
      setPending(null);
      void syncThenReload(700);
    } catch {
      setBusy(false);
      setStatus({ kind: 'error', text: 'Không ghi được dữ liệu (bộ nhớ trình duyệt có thể đã đầy). Dữ liệu cũ vẫn được giữ nguyên.' });
    }
  };

  /** Attempts, streak and weak spots only (lessons, review schedule and settings stay). */
  const onResetHistory = () => {
    setConfirmHistory(false);
    try {
      resetStats();
      setStatus({ kind: 'ok', text: 'Đã xóa lịch sử luyện tập.' });
    } catch {
      setStatus({ kind: 'error', text: 'Không xóa được lịch sử luyện tập. Hãy thử lại.' });
    }
  };

  const onClear = () => {
    if (!storage) return;
    setBusy(true);
    try {
      clearAll(storage);
      // AI key/usage (separate device prefix), the cached AI answers (sessionStorage: explanations quote what
      // the learner typed) and the cached AI voice clips (IndexedDB) go too.
      clearAiDeviceData();
      clearAiTaskCache();
      const ttsCleared = Promise.race([clearTtsCache().catch(() => undefined), new Promise((r) => window.setTimeout(r, 2000))]);
      setStatus({ kind: 'ok', text: 'Đã xóa toàn bộ dữ liệu. Đang tải lại…' });
      void ttsCleared.then(() => syncThenReload(500));
    } catch {
      setBusy(false);
      setStatus({ kind: 'error', text: 'Không xóa được dữ liệu. Hãy thử lại.' });
    }
  };

  const summary = pending ? summarizeBackup(pending.backup) : null;

  return (
    <>
      {!storage && (
        <div className="callout callout-warn" role="status">
          <Icon icon={TriangleAlert} size={16} />
          <div>Trình duyệt đang chặn bộ nhớ của trang (chế độ riêng tư hoặc đã chặn dữ liệu trang web). Tiến độ sẽ không được lưu lại.</div>
        </div>
      )}

      <div className="set-actions">
        {manual && (
          <>
            <div className="set-action">
              <div>
                <div className="set-label">Xuất bản sao lưu</div>
                <p className="set-hint">Tệp .json chứa toàn bộ tiến độ, thẻ ôn và cài đặt.</p>
              </div>
              <button type="button" className="btn" onClick={onExport} disabled={!storage}>
                <Icon icon={Download} size={16} />
                Xuất tệp
              </button>
            </div>

            <div className="set-action">
              <div>
                <div className="set-label">Nhập bản sao lưu</div>
                <p className="set-hint">Khôi phục từ tệp đã xuất; dữ liệu hiện tại sẽ bị thay thế.</p>
              </div>
              <input
                ref={fileRef}
                id={`${uid}-file`}
                className="set-file"
                type="file"
                accept=".json,application/json"
                onChange={onFile}
                tabIndex={-1}
                aria-hidden="true"
              />
              <button type="button" className="btn" onClick={() => fileRef.current?.click()} disabled={!storage || busy}>
                <Icon icon={Upload} size={16} />
                Chọn tệp…
              </button>
            </div>

            {pending && summary && (
              <div className="set-confirm" role="alertdialog" aria-labelledby={`${uid}-imp-h`} aria-describedby={`${uid}-imp-d`}>
                <div id={`${uid}-imp-h`} className="set-confirm-title">
                  Khôi phục từ “{pending.fileName}”?
                </div>
                <p id={`${uid}-imp-d`} className="set-hint">
                  {summary.exportedAt ? `Sao lưu ngày ${formatDateTimeVi(summary.exportedAt)}` : 'Không rõ ngày sao lưu'} · {summary.attempts}{' '}
                  lượt luyện · {summary.activeDays} ngày học · {summary.keys} mục dữ liệu. Toàn bộ dữ liệu hiện tại trên trình duyệt này sẽ
                  bị thay thế{syncOn ? ', và tệp trong thư mục đồng bộ cũng được ghi lại theo bản này' : ''}.
                </p>
                <div className="row">
                  <button type="button" className="btn btn-primary" onClick={onRestore} disabled={busy} autoFocus>
                    Khôi phục
                  </button>
                  <button type="button" className="btn" onClick={() => setPending(null)} disabled={busy}>
                    Hủy
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        <div className="set-action">
          <div>
            <div className="set-label">Xóa lịch sử luyện tập</div>
            <p className="set-hint">Chuỗi ngày, độ chính xác và điểm yếu. Bài học, lịch ôn và cài đặt được giữ.</p>
          </div>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setPending(null);
              setConfirmClear(false);
              setConfirmHistory(true);
            }}
            disabled={!storage || busy || !hasHistory}
          >
            <Icon icon={RotateCcw} size={16} />
            Xóa lịch sử…
          </button>
        </div>

        {confirmHistory && (
          <div className="set-confirm" role="alertdialog" aria-labelledby={`${uid}-his-h`} aria-describedby={`${uid}-his-d`}>
            <div id={`${uid}-his-h`} className="set-confirm-title">
              Xóa lịch sử luyện tập?
            </div>
            <p id={`${uid}-his-d`} className="set-hint">
              Chuỗi ngày, độ chính xác và điểm yếu sẽ bắt đầu lại từ đầu. Tiến độ bài học và lịch ôn vẫn được giữ. Thao tác này
              không thể hoàn tác.
            </p>
            <div className="row">
              <button type="button" className="btn btn-danger" onClick={onResetHistory}>
                Xóa lịch sử
              </button>
              <button type="button" className="btn" onClick={() => setConfirmHistory(false)} autoFocus>
                Hủy
              </button>
            </div>
          </div>
        )}

        <div className="set-action set-action--danger">
          <div>
            <div className="set-label">Xóa toàn bộ dữ liệu</div>
            <p className="set-hint">Tiến độ, thẻ ôn, bài đã học, thư viện video, cài đặt và key AI trên trình duyệt này.</p>
          </div>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              setPending(null);
              setConfirmHistory(false);
              setConfirmClear(true);
            }}
            disabled={!storage || busy}
          >
            <Icon icon={Trash2} size={16} />
            Xóa dữ liệu…
          </button>
        </div>

        {confirmClear && (
          <div
            className="set-confirm set-confirm--danger"
            role="alertdialog"
            aria-labelledby={`${uid}-clr-h`}
            aria-describedby={`${uid}-clr-d`}
          >
            <div id={`${uid}-clr-h`} className="set-confirm-title">
              Xóa vĩnh viễn toàn bộ dữ liệu?
            </div>
            <p id={`${uid}-clr-d`} className="set-hint">
              Thao tác này không thể hoàn tác.
              {manual && ' Nếu muốn giữ lại tiến độ, hãy “Xuất tệp” trước.'}
              {syncOn && ' Thư mục đồng bộ đang bật: tệp trong thư mục cũng sẽ bị xóa trắng, các máy khác sẽ nhận dữ liệu trống khi mở lại.'}
            </p>
            <div className="row">
              <button type="button" className="btn set-btn-danger-solid" onClick={onClear} disabled={busy}>
                <Icon icon={Trash2} size={16} />
                Xóa vĩnh viễn
              </button>
              <button type="button" className="btn" onClick={() => setConfirmClear(false)} disabled={busy} autoFocus>
                Hủy
              </button>
            </div>
          </div>
        )}
      </div>

      {status && (
        <div className={'callout ' + (status.kind === 'ok' ? 'callout-ok' : 'callout-bad')} role={status.kind === 'error' ? 'alert' : 'status'}>
          <Icon icon={status.kind === 'ok' ? Check : TriangleAlert} size={16} />
          <div>{status.text}</div>
        </div>
      )}
    </>
  );
}

// ───────────────────────── About ─────────────────────────

function AboutSection() {
  const uid = useId();
  return (
    <section className="card set-section" aria-labelledby={`${uid}-h`}>
      <SectionHead id={`${uid}-h`} title="Giới thiệu" sub={`Nghe Nối Âm · phiên bản ${APP_VERSION}`} />
      <p className="set-about-text">
        Người bản xứ không nói từng từ tách rời: <em>“turn it off”</em> thành <strong>tur-ni-doff</strong>, <em>“want to”</em> thành{' '}
        <strong>wanna</strong>. Nghe Nối Âm giúp người Việt nhận ra 8 hiện tượng nối âm của giọng Mỹ.
      </p>
      <details className="set-privacy">
        <summary>
          <Icon icon={ShieldCheck} size={18} />
          Quyền riêng tư
        </summary>
        <ul>
          <li>Không cần tài khoản, không quảng cáo, không theo dõi.</li>
          <li>
            Tiến độ và cài đặt chỉ lưu trong trình duyệt này (localStorage). Nếu bật <strong>đồng bộ thư mục</strong>, một bản được ghi
            thêm vào thư mục bạn chọn.
          </li>
          <li>
            <strong>Nói nhại</strong> dùng nhận dạng giọng nói của trình duyệt: trên Chrome và Edge, âm thanh được gửi tới dịch vụ đám
            mây của Google/Microsoft.
          </li>
          <li>Các giọng “Online (Natural)” của Edge được tạo trên máy chủ của Microsoft.</li>
        </ul>
      </details>
      <div className="row">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            removeKey(KEYS.onboarding);
            navigate('home');
          }}
        >
          <Icon icon={RotateCcw} size={14} />
          Xem lại phần giới thiệu
        </button>
      </div>
    </section>
  );
}

export default function SettingsPage() {
  const section = useRoute().params.section;
  // #/settings?section=ai: bring the "Trợ lý AI" card into view (links from AI features).
  useEffect(() => {
    if (section !== 'ai') return;
    const id = window.requestAnimationFrame(() => document.getElementById(AI_SECTION_ID)?.scrollIntoView({ block: 'start' }));
    return () => window.cancelAnimationFrame(id);
  }, [section]);
  return (
    <div className="stack-lg page-focus set-page">
      <PageHeader title="Cài đặt" />
      <VoiceSection />
      <DisplaySection />
      <GoalSection />
      <AiSection />
      <SyncSection>
        <DataTools />
      </SyncSection>
      <AboutSection />
    </div>
  );
}
