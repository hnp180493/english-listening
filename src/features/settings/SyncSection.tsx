import { useId, useState, type ReactNode } from 'react';
import { Check, CircleHelp, FolderOpen, Info, RefreshCw, TriangleAlert, Unplug } from 'lucide-react';
import { Icon } from '../../components/Icon';
import { SYNC_FILE_NAME } from '../../core/folderSync';
import {
  connectFolder,
  disconnectFolder,
  grantAndSync,
  resolveConnect,
  getFolderSyncState,
  syncNow,
  undoLastApply,
  useFolderSync,
  type ConnectOutcome,
  type SyncStatus,
} from '../../core/folderSyncController';
import SectionHead from './SectionHead';
import { formatDateTimeVi } from './settingsModel';

type Ask = Extract<ConnectOutcome, { kind: 'ask' }>;
type Msg = { kind: 'ok' | 'error'; text: string } | null;

/** Badge tone per status: neutral when all is well, warn only when the learner has to act. */
const STATUS_TONE: Partial<Record<SyncStatus, string>> = {
  error: 'badge-warn',
  'needs-permission': 'badge-warn',
  'remote-newer': 'badge-accent',
  pending: 'badge-accent',
  syncing: 'badge-accent',
};

const STATUS_LABEL: Record<SyncStatus, string> = {
  unsupported: 'Không hỗ trợ',
  off: 'Chưa kết nối',
  checking: 'Đang kiểm tra…',
  'needs-permission': 'Cần cấp quyền',
  synced: 'Đã đồng bộ',
  pending: 'Có thay đổi, sắp ghi…',
  syncing: 'Đang ghi…',
  'remote-newer': 'Có dữ liệu mới từ máy khác',
  error: 'Lỗi',
};

function reloadSoon(ms = 700) {
  window.setTimeout(() => window.location.reload(), ms);
}

/** `children`: the rest of the data tools (manual backup where sync is unsupported, delete all), shown at the end of the card. */
export default function SyncSection({ children }: { children?: ReactNode }) {
  const uid = useId();
  const sync = useFolderSync();
  const [ask, setAsk] = useState<Ask | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [confirmUndo, setConfirmUndo] = useState(false);

  const isOn = sync.status !== 'off' && sync.status !== 'unsupported';

  const handle = (r: ConnectOutcome, folderHint?: string) => {
    if (r.kind === 'cancelled') return;
    if (r.kind === 'error') {
      setMsg({ kind: 'error', text: r.message });
      return;
    }
    if (r.kind === 'ask') {
      setMsg(null);
      setAsk(r);
      return;
    }
    if (r.reload) {
      setMsg({ kind: 'ok', text: 'Đã lấy dữ liệu từ thư mục. Đang tải lại…' });
      reloadSoon();
      return;
    }
    // Read the store now: `sync` is from the render before connecting (folderName still null then).
    const folder = folderHint ?? getFolderSyncState().folderName;
    setMsg({
      kind: 'ok',
      text: folder
        ? `Đã kết nối. Dữ liệu của máy này đã được lưu vào thư mục “${folder}”.`
        : 'Đã kết nối. Dữ liệu của máy này đã được lưu vào thư mục.',
    });
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch {
      setMsg({ kind: 'error', text: 'Có lỗi không mong muốn. Hãy thử lại.' });
    } finally {
      setBusy(false);
    }
  };

  const onConnect = () =>
    run(async () => {
      setConfirmOff(false);
      setConfirmUndo(false);
      setAsk(null);
      const r = await connectFolder();
      handle(r, r.kind === 'ask' ? r.folderName : undefined);
    });

  const onResolve = (choice: 'pull' | 'merge' | 'cancel') =>
    run(async () => {
      const folder = ask?.folderName;
      setAsk(null);
      handle(await resolveConnect(choice), folder);
    });

  const onSyncNow = () =>
    run(async () => {
      setMsg(null);
      await (sync.status === 'needs-permission' ? grantAndSync() : syncNow());
    });

  const onDisconnect = () =>
    run(async () => {
      setConfirmOff(false);
      await disconnectFolder();
      setMsg({ kind: 'ok', text: 'Đã ngắt kết nối. Dữ liệu vẫn còn trên máy này và trong thư mục.' });
    });

  const onUndo = () =>
    run(async () => {
      setConfirmUndo(false);
      const ok = await undoLastApply();
      setMsg(
        ok
          ? { kind: 'ok', text: 'Đã hoàn tác và ngắt kết nối thư mục. Đang tải lại…' }
          : { kind: 'error', text: 'Không hoàn tác được nữa.' },
      );
    });

  return (
    <section className="card set-section" aria-labelledby={`${uid}-h`}>
      <SectionHead id={`${uid}-h`} title="Dữ liệu & đồng bộ" sub="Học trên nhiều máy qua một thư mục chung." />

      {sync.status === 'unsupported' ? (
        <div className="callout callout-warn" role="status">
          <Icon icon={TriangleAlert} size={16} />
          <div>
            Trình duyệt này không hỗ trợ đồng bộ thư mục. Hãy dùng <strong>Microsoft Edge</strong> hoặc <strong>Google Chrome</strong>{' '}
            trên máy tính, hoặc chuyển dữ liệu bằng “Xuất tệp” và “Nhập bản sao lưu” bên dưới.
          </div>
        </div>
      ) : !isOn ? (
        <>
          {/* Optional feature on a page with no single job: a soft action, the steps behind a closed disclosure. */}
          <div className="set-connect">
            <button type="button" className="btn btn-soft" onClick={() => void onConnect()} disabled={busy}>
              <Icon icon={FolderOpen} size={16} />
              {busy ? 'Đang mở…' : 'Chọn thư mục…'}
            </button>
            <p className="set-hint">
              Chỉ đọc và ghi tệp <strong className="set-file-name">{SYNC_FILE_NAME}</strong>; không gửi dữ liệu đi đâu cả.
            </p>
          </div>
          <details className="set-privacy set-how">
            <summary>
              <Icon icon={CircleHelp} size={18} />
              Cách đồng bộ
            </summary>
            <ol className="set-steps">
              <li>
                Tạo một thư mục trong <strong>OneDrive</strong>, <strong>Google Drive</strong>, <strong>Dropbox</strong>… (hoặc ổ USB),
                ví dụ <strong>NgheNoiAm</strong>.
              </li>
              <li>Bấm “Chọn thư mục…”, chọn thư mục đó và cho phép trình duyệt xem, lưu tệp.</li>
              <li>Trên máy khác, chọn đúng thư mục đó. Tiến độ được gộp, không mất gì.</li>
            </ol>
          </details>
        </>
      ) : (
        <>
          <div className="set-sync-state">
            <p className="set-sync-line">
              Thư mục <strong>{sync.folderName ?? '—'}</strong>
              <span className="meta">
                {' · '}
                {sync.lastSyncAt ? `đồng bộ lần cuối ${formatDateTimeVi(sync.lastSyncAt)}` : 'chưa đồng bộ lần nào'}
              </span>
            </p>
            <span className={'badge set-sync-status is-' + sync.status + ' ' + (STATUS_TONE[sync.status] ?? '')}>
              {sync.status === 'synced' && <Icon icon={Check} size={14} strokeWidth={2.5} />}
              {STATUS_LABEL[sync.status]}
            </span>
          </div>

          {sync.status === 'error' && sync.error && (
            <div className="callout callout-warn" role="alert">
              <Icon icon={TriangleAlert} size={16} />
              <div>{sync.error} Dữ liệu trên máy này vẫn được giữ nguyên, tệp trong thư mục không bị ghi đè.</div>
            </div>
          )}
          {sync.status === 'needs-permission' && (
            <div className="callout" role="status">
              <Icon icon={Info} size={16} />
              <div>
                Trình duyệt cần bạn cho phép lại quyền truy cập thư mục. Bấm “Kết nối lại” và chọn{' '}
                <strong>“Cho phép mỗi lần truy cập”</strong> để lần sau ứng dụng tự đọc thư mục khi mở.
              </div>
            </div>
          )}
          {sync.status === 'remote-newer' && (
            <div className="callout" role="status">
              <Icon icon={Info} size={16} />
              <div>Một máy khác vừa lưu dữ liệu mới vào thư mục. Bấm “Đồng bộ ngay” để gộp và tải lại trang.</div>
            </div>
          )}

          <div className="row set-sync-buttons">
            <button
              type="button"
              className={
                'btn ' + (sync.status === 'remote-newer' || sync.status === 'needs-permission' ? 'btn-primary' : 'btn-soft')
              }
              onClick={() => void onSyncNow()}
              disabled={busy || sync.status === 'checking'}
            >
              <Icon icon={RefreshCw} size={16} />
              {busy ? 'Đang đồng bộ…' : sync.status === 'needs-permission' ? 'Kết nối lại' : 'Đồng bộ ngay'}
            </button>
            <button type="button" className="btn" onClick={() => void onConnect()} disabled={busy}>
              <Icon icon={FolderOpen} size={16} />
              Đổi thư mục…
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setConfirmUndo(false);
                setConfirmOff(true);
              }}
              disabled={busy}
            >
              <Icon icon={Unplug} size={16} />
              Ngắt kết nối
            </button>
          </div>

          {sync.undoAt && (
            <p className="set-hint">
              Dữ liệu từ thư mục đã được áp dụng vào máy này ngày {formatDateTimeVi(sync.undoAt)}.{' '}
              <button
                type="button"
                className="set-linkbtn"
                onClick={() => {
                  setConfirmOff(false);
                  setConfirmUndo(true);
                }}
                disabled={busy}
              >
                Hoàn tác
              </button>
            </p>
          )}

          <p className="set-hint">
            Thay đổi tự ghi vào <strong className="set-file-name">{SYNC_FILE_NAME}</strong> sau vài giây; khi mở ứng dụng, bản mới
            nhất trong thư mục được đọc trước.
          </p>
        </>
      )}

      {confirmOff && (
        <div className="set-confirm" role="alertdialog" aria-labelledby={`${uid}-off-h`} aria-describedby={`${uid}-off-d`}>
          <div id={`${uid}-off-h`} className="set-confirm-title">
            Ngắt kết nối thư mục?
          </div>
          <p id={`${uid}-off-d`} className="set-hint">
            Máy này sẽ thôi đọc và ghi vào thư mục. Dữ liệu trên máy này và tệp trong thư mục đều được giữ nguyên.
          </p>
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={() => void onDisconnect()} disabled={busy} autoFocus>
              Ngắt kết nối
            </button>
            <button type="button" className="btn" onClick={() => setConfirmOff(false)} disabled={busy}>
              Hủy
            </button>
          </div>
        </div>
      )}

      {confirmUndo && sync.undoAt && (
        <div className="set-confirm" role="alertdialog" aria-labelledby={`${uid}-undo-h`} aria-describedby={`${uid}-undo-d`}>
          <div id={`${uid}-undo-h`} className="set-confirm-title">
            Hoàn tác về dữ liệu trước khi lấy từ thư mục (ngày {formatDateTimeVi(sync.undoAt)})?
          </div>
          <p id={`${uid}-undo-d`} className="set-hint">
            Máy này trở lại như trước khi lấy dữ liệu từ thư mục và <strong>ngắt kết nối</strong> với thư mục. Tệp trong thư mục được giữ
            nguyên, nên tiến độ của các máy khác không bị mất. Muốn đồng bộ lại thì chọn lại thư mục và bấm “Gộp”.
          </p>
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={() => void onUndo()} disabled={busy}>
              Hoàn tác
            </button>
            <button type="button" className="btn" onClick={() => setConfirmUndo(false)} disabled={busy} autoFocus>
              Hủy
            </button>
          </div>
        </div>
      )}

      {ask && (
        <div className="set-confirm" role="alertdialog" aria-labelledby={`${uid}-ask-h`} aria-describedby={`${uid}-ask-d`}>
          <div id={`${uid}-ask-h`} className="set-confirm-title">
            Thư mục “{ask.folderName}” đã có dữ liệu
          </div>
          <div className="set-sync-compare">
            <div>
              <div className="set-label">Trong thư mục</div>
              <p className="set-hint">
                {ask.remote.attempts.toLocaleString('vi-VN')} lượt luyện · {ask.remote.activeDays.toLocaleString('vi-VN')} ngày học
                <br />
                {ask.remote.exportedAt ? `Lưu ngày ${formatDateTimeVi(ask.remote.exportedAt)}` : 'Không rõ ngày lưu'}
                {ask.remoteDevice ? ` · ${ask.remoteDevice}` : ''}
              </p>
            </div>
            <div>
              <div className="set-label">Trên máy này</div>
              <p className="set-hint">
                {ask.local.attempts.toLocaleString('vi-VN')} lượt luyện · {ask.local.activeDays.toLocaleString('vi-VN')} ngày học
                <br />
                {ask.localChangedAt ? `Thay đổi ngày ${formatDateTimeVi(ask.localChangedAt)}` : 'Không rõ lần thay đổi cuối'}
              </p>
            </div>
          </div>
          <p id={`${uid}-ask-d`} className="set-hint">
            <strong>Gộp</strong> giữ tiến độ của cả hai bên (khuyên dùng). <strong>Dùng dữ liệu trong thư mục</strong> thay toàn bộ dữ
            liệu trên máy này bằng dữ liệu trong thư mục (có thể hoàn tác ngay sau đó).
          </p>
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={() => void onResolve('merge')} disabled={busy} autoFocus>
              Gộp với dữ liệu máy này
            </button>
            <button type="button" className="btn" onClick={() => void onResolve('pull')} disabled={busy}>
              Dùng dữ liệu trong thư mục
            </button>
            <button type="button" className="btn" onClick={() => void onResolve('cancel')} disabled={busy}>
              Hủy
            </button>
          </div>
        </div>
      )}

      {msg && (
        <div className={'callout ' + (msg.kind === 'ok' ? 'callout-ok' : 'callout-bad')} role={msg.kind === 'error' ? 'alert' : 'status'}>
          <Icon icon={msg.kind === 'ok' ? Check : TriangleAlert} size={16} />
          <div>{msg.text}</div>
        </div>
      )}

      {children}
    </section>
  );
}
