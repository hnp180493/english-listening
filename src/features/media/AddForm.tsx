// "Thêm video/audio": YouTube link + transcript, or a local media file + subtitles.

import { forwardRef, useDeferredValue, useEffect, useId, useMemo, useState } from 'react';
import {
  CircleAlert,
  CircleCheck,
  CircleHelp,
  FileText,
  FolderOpen,
  MonitorPlay,
  TriangleAlert,
  Upload,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Icon } from '../../components/Icon';
import { formatClock } from '../../core/media/transcript';
import { parseYouTubeId, youTubeThumb } from '../../core/media/youtube';
import { hrefFor, navigate } from '../../core/nav';
import { FORMAT_LABEL, decodeTextBytes, formatKB, previewTranscript } from './importer';
import {
  MAX_TRANSCRIPT_BYTES,
  byteLength,
  createItem,
  findYouTubeDuplicate,
  guessFileType,
  isMediaFile,
  stripExtension,
  type MediaKind,
} from './library';
import { addItem, rememberFile, useMediaLibrary } from './store';

const PLACEHOLDER = `0:00 hey everyone, welcome back to the channel.
0:03 today I'm gonna show you how to…`;

/** "Cách lấy bản chép lời": closed by default, last on the page; opened for the learner when a paste has no times. */
export const YouTubeHowTo = forwardRef<HTMLDetailsElement, { open: boolean; onOpenChange: (open: boolean) => void }>(
  function YouTubeHowTo({ open, onOpenChange }, ref) {
    return (
      <details ref={ref} className="how media-how" open={open} onToggle={(e) => onOpenChange(e.currentTarget.open)}>
        <summary>
          <Icon icon={CircleHelp} size={18} />
          Cách lấy bản chép lời từ YouTube
        </summary>
        <ol className="media-how-steps">
          <li>
            Trên máy tính, mở video YouTube, bấm <strong>“…thêm”</strong> dưới video rồi{' '}
            <strong>“Hiện bản chép lời”</strong>.
          </li>
          <li>Chọn phụ đề tiếng Anh do người làm video tạo. Bản “tự động” hay sai chữ và thiếu dấu câu.</li>
          <li>
            Bôi đen từ dòng đầu đến dòng cuối, nhấn Ctrl + C (⌘ + C trên Mac) rồi dán vào ô “Bản chép lời”. Giữ nguyên các dòng giờ
            như 0:05.
          </li>
        </ol>
      </details>
    );
  },
);

export default function AddForm({
  onCancel,
  onNeedHelp,
}: {
  onCancel?: () => void;
  /** The pasted YouTube transcript has no times: open the help (`show` = also scroll to it). Must be stable. */
  onNeedHelp?: (show: boolean) => void;
}) {
  const uid = useId();
  const [tab, setTab] = useState<MediaKind>('youtube');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [subName, setSubName] = useState<string | null>(null);
  const [media, setMedia] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<{ msg: string; id?: string } | null>(null);
  const [touched, setTouched] = useState(false);

  const youtubeId = useMemo(() => parseYouTubeId(url), [url]);
  const library = useMediaLibrary();
  const duplicate = tab === 'youtube' ? findYouTubeDuplicate(library.items, youtubeId) : null;
  const deferredText = useDeferredValue(text);
  const preview = useMemo(() => previewTranscript(deferredText), [deferredText]);
  // a YouTube paste without any "0:05" lines: the learner most likely copied the text only
  const noTimes =
    tab === 'youtube' &&
    !!deferredText.trim() &&
    preview.format === 'unknown' &&
    byteLength(deferredText) <= MAX_TRANSCRIPT_BYTES;
  useEffect(() => {
    if (noTimes) onNeedHelp?.(false);
  }, [noTimes, onNeedHelp]);

  const loadSubtitle = async (f: File | undefined) => {
    setFileError(null);
    if (!f) return;
    if (f.size > MAX_TRANSCRIPT_BYTES) {
      setFileError(`Tệp phụ đề quá lớn (${formatKB(f.size)}). Giới hạn ${formatKB(MAX_TRANSCRIPT_BYTES)}.`);
      return;
    }
    try {
      const content = decodeTextBytes(new Uint8Array(await f.arrayBuffer()));
      setText(content);
      setSubName(f.name);
    } catch {
      setFileError('Không đọc được tệp phụ đề này.');
    }
  };

  const pickMedia = (f: File | undefined) => {
    setFileError(null);
    if (!f) return;
    if (!isMediaFile(f.name, f.type)) {
      setFileError('Hãy chọn tệp âm thanh hoặc video (MP3, M4A, WAV, MP4, WebM…).');
      return;
    }
    setMedia(f);
    if (!title.trim()) setTitle(stripExtension(f.name));
  };

  const canSave = preview.ok && (tab === 'youtube' ? !!youtubeId : !!media);

  const save = () => {
    setTouched(true);
    setSaveError(null);
    if (!canSave) return;
    const parsed = deferredText === text ? preview : previewTranscript(text);
    if (!parsed.ok) return;
    const item = createItem({
      kind: tab,
      title,
      ...(tab === 'youtube'
        ? { youtubeId: youtubeId ?? undefined }
        : { fileName: media?.name, fileType: media ? guessFileType(media.name, media.type) : 'video' }),
      units: parsed.units,
    });
    if (tab === 'file' && media) rememberFile(item.id, media);
    const res = addItem(item);
    if (res.ok) navigate('media', { id: item.id });
    else setSaveError({ msg: res.error, id: res.error.includes('phiên này') ? item.id : undefined });
  };

  const tabBtn = (k: MediaKind, label: string, icon: LucideIcon) => (
    <button
      type="button"
      role="tab"
      id={`${uid}-tab-${k}`}
      aria-selected={tab === k}
      aria-controls={`${uid}-panel`}
      className="seg-btn media-tab"
      onClick={() => {
        setTab(k);
        setTouched(false);
        setFileError(null);
      }}
    >
      <Icon icon={icon} size={16} />
      {label}
    </button>
  );

  return (
    <section className="card media-add" aria-labelledby={`${uid}-h`}>
      <div className="media-add-head">
        <h2 id={`${uid}-h`}>Thêm video / audio</h2>
        {onCancel && (
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onCancel} aria-label="Đóng">
            <Icon icon={X} size={18} />
          </button>
        )}
      </div>
      <div className="seg media-tabs" role="tablist" aria-label="Nguồn">
        {tabBtn('youtube', 'YouTube', MonitorPlay)}
        {tabBtn('file', 'Tệp trên máy', FolderOpen)}
      </div>

      <div id={`${uid}-panel`} role="tabpanel" aria-labelledby={`${uid}-tab-${tab}`} className="stack media-add-body">
        {tab === 'youtube' ? (
          <div className="media-field">
            <label className="field-label" htmlFor={`${uid}-url`}>
              Link video YouTube
            </label>
            <input
              id={`${uid}-url`}
              className="input"
              type="url"
              inputMode="url"
              placeholder="https://www.youtube.com/watch?v=…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              aria-invalid={url.trim() !== '' && !youtubeId}
              aria-describedby={`${uid}-url-status`}
            />
            <div id={`${uid}-url-status`} className="media-url-status" aria-live="polite">
              {url.trim() === '' ? null : youtubeId ? (
                <span className="media-ok-text">
                  <img className="media-url-thumb" src={youTubeThumb(youtubeId)} alt="" width={64} height={36} loading="lazy" />
                  <Icon icon={CircleCheck} size={16} className="media-ok-icon" />
                  Đã nhận ra video
                </span>
              ) : (
                <span className="media-bad-text">
                  <Icon icon={CircleAlert} size={15} />
                  Chưa nhận ra link YouTube. Hãy dán link dạng youtube.com/watch?v=… hoặc youtu.be/…
                </span>
              )}
            </div>
            {duplicate && (
              <p className="callout callout-warn" role="status">
                <Icon icon={TriangleAlert} size={16} />
                <span>
                  Video này đã có trong thư viện: <strong>{duplicate.title}</strong>.{' '}
                  <a href={hrefFor('media', { id: duplicate.id })}>Mở để luyện tiếp</a>, hoặc lưu thêm một bản mới.
                </span>
              </p>
            )}
          </div>
        ) : (
          <div className="media-field">
            <span className="field-label" id={`${uid}-media-l`}>
              Tệp âm thanh / video trên máy
            </span>
            <div className="row media-file-row">
              <label className="btn btn-soft media-file-btn">
                <Icon icon={Upload} size={16} />
                {media ? 'Đổi tệp…' : 'Chọn tệp…'}
                <input
                  type="file"
                  accept="audio/*,video/*"
                  className="media-file-input"
                  aria-labelledby={`${uid}-media-l`}
                  onChange={(e) => pickMedia(e.target.files?.[0])}
                />
              </label>
              {media ? (
                <span className="media-filename" title={media.name}>
                  {media.name} <span className="muted">({formatKB(media.size)})</span>
                </span>
              ) : (
                <span className="meta">MP3, M4A, WAV, MP4, WebM…</span>
              )}
            </div>
            <p className="field-hint">Tệp chỉ mở trên máy bạn, không tải lên. Lần sau bạn chọn lại tệp này.</p>
          </div>
        )}

        <div className="media-field">
          <div className="media-field-row">
            <label className="field-label" htmlFor={`${uid}-text`}>
              {tab === 'youtube' ? 'Bản chép lời' : 'Phụ đề (.srt / .vtt)'}
            </label>
            <label className="btn btn-sm btn-ghost media-file-btn">
              <Icon icon={FileText} size={14} />
              Chọn tệp…
              <input
                type="file"
                accept=".srt,.vtt,.txt,text/vtt,application/x-subrip,text/plain"
                className="media-file-input"
                onChange={(e) => {
                  void loadSubtitle(e.target.files?.[0]);
                  e.target.value = ''; // picking the same file again must reload it
                }}
              />
            </label>
          </div>
          {subName && (
            <p className="field-hint">
              Đã nạp <strong>{subName}</strong>
            </p>
          )}
          <textarea
            id={`${uid}-text`}
            className="textarea media-paste"
            rows={4}
            spellCheck={false}
            placeholder={PLACEHOLDER}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSubName(null);
            }}
            aria-describedby={`${uid}-preview`}
          />
        </div>

        {fileError && (
          <p className="callout callout-bad" role="alert">
            <Icon icon={CircleAlert} size={16} />
            <span>{fileError}</span>
          </p>
        )}

        <div id={`${uid}-preview`} className="media-preview-slot" aria-live="polite">
          {preview.error && (
            <div className="callout callout-bad">
              <Icon icon={CircleAlert} size={16} />
              <div>
                {preview.error}
                {noTimes && onNeedHelp && (
                  <>
                    {' '}
                    <button type="button" className="media-link" onClick={() => onNeedHelp(true)}>
                      Xem cách lấy bản chép lời
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
          {preview.ok && (
            <div className="panel media-preview">
              <p className="media-preview-sum">
                <Icon icon={CircleCheck} size={16} className="media-ok-icon" />
                <span>
                  {FORMAT_LABEL[preview.format]}: <strong>{preview.units.length}</strong> câu luyện tập · khoảng{' '}
                  {formatClock(preview.duration)}
                </span>
              </p>
              {preview.warning && (
                <p className="callout callout-warn">
                  <Icon icon={TriangleAlert} size={16} />
                  <span>{preview.warning}</span>
                </p>
              )}
              <ol className="media-preview-list">
                {preview.units.slice(0, 3).map((u, i) => (
                  <li key={i}>
                    <span className="media-list-time">{formatClock(u.start)}</span> <span lang="en">{u.text}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        <details className="media-opt">
          <summary>Tùy chọn</summary>
          <div className="media-field">
            <label className="field-label" htmlFor={`${uid}-title`}>
              Tên gợi nhớ
            </label>
            <input
              id={`${uid}-title`}
              className="input"
              maxLength={120}
              placeholder={tab === 'youtube' ? 'Ví dụ: Phỏng vấn xin việc – phần 1' : 'Ví dụ: Podcast tập 12'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
        </details>

        {touched && !canSave && (
          <p className="callout callout-bad" role="alert">
            <Icon icon={CircleAlert} size={16} />
            <span>
              {tab === 'youtube' && !youtubeId
                ? 'Cần một link YouTube hợp lệ.'
                : tab === 'file' && !media
                  ? 'Hãy chọn tệp âm thanh/video.'
                  : 'Cần bản chép lời có mốc thời gian.'}
            </span>
          </p>
        )}
        {saveError && (
          <div className="callout callout-bad" role="alert">
            <Icon icon={CircleAlert} size={16} />
            <div>
              {saveError.msg}
              {saveError.id && (
                <div className="media-error-actions">
                  <button type="button" className="btn btn-sm" onClick={() => navigate('media', { id: saveError.id })}>
                    Vẫn mở để luyện
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="row media-add-actions">
          <button type="button" className="btn btn-primary" onClick={save} aria-disabled={!canSave}>
            Lưu và bắt đầu luyện
          </button>
          {onCancel && (
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              Huỷ
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
