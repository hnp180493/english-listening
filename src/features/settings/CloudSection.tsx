import { useId, useState } from 'react';
import { Check, CircleHelp, Copy, Info, LogIn, LogOut, RefreshCw, TriangleAlert } from 'lucide-react';
import { Icon } from '../../components/Icon';
import {
  cancelPortableSignIn,
  clearCloudNotice,
  clearPortableCode,
  cloudSyncNow,
  isPortableFile,
  signInWithGoogle,
  signOutCloud,
  submitPortableCode,
  useCloudSync,
  type CloudStatus,
} from '../../core/cloud/cloudController';
import SectionHead from './SectionHead';
import { formatDateTimeVi } from './settingsModel';

const STATUS_LABEL: Partial<Record<CloudStatus, string>> = {
  'signing-in': 'Đang đăng nhập…',
  checking: 'Đang kiểm tra…',
  synced: 'Đã đồng bộ',
  pending: 'Có thay đổi, sắp ghi…',
  syncing: 'Đang đồng bộ…',
  'remote-newer': 'Có dữ liệu mới',
  offline: 'Đang ngoại tuyến',
  expired: 'Cần đăng nhập lại',
  error: 'Lỗi',
};

/** Badge tone: neutral when all is well, warn only when the learner has to act. */
const STATUS_TONE: Partial<Record<CloudStatus, string>> = {
  error: 'badge-warn',
  expired: 'badge-warn',
  'remote-newer': 'badge-accent',
  pending: 'badge-accent',
  syncing: 'badge-accent',
};

type Msg = { kind: 'ok' | 'error'; text: string } | null;

/**
 * "Tài khoản": Google sign-in and sync through the Supabase project shared with Daily English
 * (docs/supabase-sync.md). Hidden when this build has no project configured.
 */
export default function CloudSection() {
  const uid = useId();
  const cloud = useCloudSync();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const [code, setCode] = useState('');
  const [confirmOut, setConfirmOut] = useState(false);
  const [copied, setCopied] = useState(false);

  if (cloud.status === 'off') return null;

  const portable = isPortableFile();
  const signedIn = cloud.user !== null && cloud.status !== 'signed-out' && cloud.status !== 'expired';
  const notice = cloud.notice ?? msg;

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

  const onSignIn = () =>
    run(async () => {
      clearCloudNotice();
      setMsg(null);
      const r = await signInWithGoogle();
      if (r.message) setMsg({ kind: r.ok ? 'ok' : 'error', text: r.message });
    });

  const onSubmitCode = () =>
    run(async () => {
      clearCloudNotice();
      setMsg(null);
      const r = await submitPortableCode(code);
      if (!r.ok && r.message) setMsg({ kind: 'error', text: r.message });
      if (r.ok) setCode('');
    });

  const onSignOut = () =>
    run(async () => {
      setConfirmOut(false);
      await signOutCloud();
      setMsg({ kind: 'ok', text: 'Đã đăng xuất. Dữ liệu vẫn còn trên máy này và trong tài khoản.' });
    });

  const onCopy = async () => {
    if (!cloud.portableCode) return;
    try {
      await navigator.clipboard.writeText(cloud.portableCode);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="card set-section" aria-labelledby={`${uid}-h`}>
      <SectionHead id={`${uid}-h`} title="Tài khoản" sub="Đăng nhập Google để giữ tiến độ trên mọi máy." />

      {cloud.portableCode && (
        <div className="set-confirm" role="status" aria-labelledby={`${uid}-code-h`}>
          <div id={`${uid}-code-h`} className="set-confirm-title">
            Mã đăng nhập cho bản mở từ ổ đĩa
          </div>
          <p className="set-hint">Chép mã này rồi dán vào ô “Mã đăng nhập” trong bản Nghe Nối Âm đang mở từ ổ đĩa. Mã chỉ dùng được một lần, trong vài phút.</p>
          <div className="set-cloud-code">
            <input className="input set-cloud-code-input" readOnly value={cloud.portableCode} aria-label="Mã đăng nhập" onFocus={(e) => e.currentTarget.select()} />
            <button type="button" className="btn btn-soft" onClick={() => void onCopy()}>
              <Icon icon={copied ? Check : Copy} size={16} />
              {copied ? 'Đã chép' : 'Chép mã'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={clearPortableCode}>
              Xong
            </button>
          </div>
        </div>
      )}

      {!signedIn ? (
        <>
          {cloud.status === 'expired' && (
            <div className="callout callout-warn" role="status">
              <Icon icon={TriangleAlert} size={16} />
              <div>{cloud.error ?? 'Phiên đăng nhập đã hết hạn.'} Dữ liệu trên máy này vẫn được giữ nguyên.</div>
            </div>
          )}
          <div className="set-connect">
            <button type="button" className="btn btn-soft" onClick={() => void onSignIn()} disabled={busy || cloud.status === 'signing-in'}>
              <Icon icon={LogIn} size={16} />
              {cloud.status === 'signing-in' ? 'Đang đăng nhập…' : busy ? 'Đang mở…' : 'Đăng nhập bằng Google'}
            </button>
            <p className="set-hint">Dùng chung tài khoản với Daily English. Không có mạng, ứng dụng vẫn chạy như bình thường.</p>
          </div>

          {portable && cloud.awaitingCode && (
            <div className="set-confirm" aria-labelledby={`${uid}-paste-h`}>
              <div id={`${uid}-paste-h`} className="set-confirm-title">
                Dán mã đăng nhập
              </div>
              <p className="set-hint">
                Bản mở từ ổ đĩa không nhận được đăng nhập trực tiếp. Đăng nhập Google trong tab vừa mở, chép mã hiện ra ở đó rồi dán vào
                đây.
              </p>
              <form
                className="set-cloud-code"
                onSubmit={(e) => {
                  e.preventDefault();
                  void onSubmitCode();
                }}
              >
                <label className="sr-only" htmlFor={`${uid}-code`}>
                  Mã đăng nhập
                </label>
                <input
                  id={`${uid}-code`}
                  className="input set-cloud-code-input"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Dán mã vào đây"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button type="submit" className="btn btn-primary" disabled={busy || code.trim() === ''}>
                  {busy ? 'Đang kiểm tra…' : 'Xác nhận'}
                </button>
                <button type="button" className="btn btn-ghost" onClick={cancelPortableSignIn} disabled={busy}>
                  Hủy
                </button>
              </form>
            </div>
          )}

          <details className="set-privacy set-how">
            <summary>
              <Icon icon={CircleHelp} size={18} />
              Đồng bộ qua tài khoản
            </summary>
            <ol className="set-steps">
              <li>
                Bấm “Đăng nhập bằng Google”, chọn đúng tài khoản bạn dùng cho <strong>Daily English</strong>.
              </li>
              <li>Lần đầu, tiến độ trên máy này được gộp với tiến độ trong tài khoản: không mất bên nào.</li>
              <li>Sau đó mọi thay đổi tự gửi lên sau vài giây; máy khác nhận khi mở ứng dụng hoặc quay lại trang.</li>
              {portable && <li>Bản mở từ ổ đĩa cần dán mã một lần (Google không trả kết quả về tệp trên máy được).</li>}
            </ol>
          </details>
        </>
      ) : (
        <>
          <div className="set-sync-state">
            <p className="set-sync-line">
              Đã đăng nhập <strong className="set-file-name">{cloud.user?.email ?? cloud.user?.name ?? 'tài khoản Google'}</strong>
              <span className="meta">
                {' · '}
                {cloud.lastSyncAt ? `đồng bộ lần cuối ${formatDateTimeVi(cloud.lastSyncAt)}` : 'chưa đồng bộ lần nào'}
              </span>
            </p>
            {STATUS_LABEL[cloud.status] && (
              <span className={'badge set-sync-status ' + (STATUS_TONE[cloud.status] ?? '')}>
                {cloud.status === 'synced' && <Icon icon={Check} size={14} strokeWidth={2.5} />}
                {STATUS_LABEL[cloud.status]}
              </span>
            )}
          </div>

          {cloud.status === 'error' && cloud.error && (
            <div className="callout callout-warn" role="alert">
              <Icon icon={TriangleAlert} size={16} />
              <div>{cloud.error} Dữ liệu trên máy này vẫn được giữ nguyên.</div>
            </div>
          )}
          {cloud.status === 'offline' && (
            <div className="callout" role="status">
              <Icon icon={Info} size={16} />
              <div>Chưa kết nối được máy chủ. Thay đổi được giữ trên máy này và tự gửi đi khi có mạng.</div>
            </div>
          )}
          {cloud.status === 'remote-newer' && (
            <div className="callout" role="status">
              <Icon icon={Info} size={16} />
              <div>Tài khoản có dữ liệu mới từ máy khác. Bấm “Đồng bộ ngay” để gộp và tải lại trang.</div>
            </div>
          )}

          <div className="row set-sync-buttons">
            <button
              type="button"
              className={'btn ' + (cloud.status === 'remote-newer' ? 'btn-primary' : 'btn-soft')}
              onClick={() => void run(cloudSyncNow)}
              disabled={busy || cloud.status === 'syncing' || cloud.status === 'checking'}
            >
              <Icon icon={RefreshCw} size={16} />
              {busy || cloud.status === 'syncing' ? 'Đang đồng bộ…' : 'Đồng bộ ngay'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmOut(true)} disabled={busy}>
              <Icon icon={LogOut} size={16} />
              Đăng xuất
            </button>
          </div>
        </>
      )}

      {confirmOut && (
        <div className="set-confirm" role="alertdialog" aria-labelledby={`${uid}-out-h`} aria-describedby={`${uid}-out-d`}>
          <div id={`${uid}-out-h`} className="set-confirm-title">
            Đăng xuất khỏi tài khoản?
          </div>
          <p id={`${uid}-out-d`} className="set-hint">
            Máy này thôi đồng bộ với tài khoản. Dữ liệu trên máy này và trong tài khoản đều được giữ nguyên.
          </p>
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={() => void onSignOut()} disabled={busy} autoFocus>
              Đăng xuất
            </button>
            <button type="button" className="btn" onClick={() => setConfirmOut(false)} disabled={busy}>
              Hủy
            </button>
          </div>
        </div>
      )}

      {notice && (
        <div className={'callout ' + (notice.kind === 'ok' ? 'callout-ok' : 'callout-bad')} role={notice.kind === 'error' ? 'alert' : 'status'}>
          <Icon icon={notice.kind === 'ok' ? Check : TriangleAlert} size={16} />
          <div>{notice.text}</div>
        </div>
      )}
    </section>
  );
}
