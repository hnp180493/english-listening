import { useState } from 'react';
import { dismissSyncBanner, grantAndSync, syncNow, useFolderSync } from '../core/folderSyncController';
import { hrefFor } from '../core/nav';
import { Cloud, TriangleAlert, X } from 'lucide-react';
import { Icon } from './Icon';
import './SyncBanner.css';

/**
 * Small, non-blocking notice at the top of every page for folder sync (OneDrive): access must be
 * allowed again, another machine saved newer data, or the folder file could not be read/written.
 */
export default function SyncBanner() {
  const sync = useFolderSync();
  const [busy, setBusy] = useState(false);

  const show =
    !sync.bannerDismissed && (sync.status === 'needs-permission' || sync.status === 'remote-newer' || sync.status === 'error');
  if (!show) return null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  const folder = sync.folderName ? ` “${sync.folderName}”` : '';

  return (
    <div className={'syncb' + (sync.status === 'error' ? ' syncb--error' : '')} role="status" aria-live="polite">
      <span className="syncb-icon" aria-hidden="true">
        <Icon icon={sync.status === 'error' ? TriangleAlert : Cloud} size={18} />
      </span>
      <div className="syncb-text">
        {sync.status === 'needs-permission' && (
          <>
            <strong>Bấm để kết nối thư mục dữ liệu{folder}.</strong>{' '}
            <span className="syncb-sub">
              Trình duyệt cần bạn cho phép lại. Chọn “Cho phép mỗi lần truy cập” để lần sau không phải bấm nữa.
            </span>
          </>
        )}
        {sync.status === 'remote-newer' && (
          <>
            <strong>Có dữ liệu mới từ máy khác.</strong>{' '}
            <span className="syncb-sub">Tải lại để cập nhật. Những gì bạn vừa luyện trên máy này được gộp vào, không bị mất.</span>
          </>
        )}
        {sync.status === 'error' && (
          <>
            <strong>Đồng bộ thư mục gặp lỗi.</strong> <span className="syncb-sub">{sync.error} Dữ liệu trên máy này vẫn được giữ nguyên.</span>
          </>
        )}
      </div>
      <div className="syncb-actions">
        {sync.status === 'needs-permission' && (
          <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => void run(grantAndSync)}>
            {busy ? 'Đang kết nối…' : 'Kết nối'}
          </button>
        )}
        {sync.status === 'remote-newer' && (
          // Applies the folder data (merging local changes) and reloads; does not depend on the
          // startup time budget, which a slow OneDrive download could exceed again.
          <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => void run(syncNow)}>
            {busy ? 'Đang tải…' : 'Tải lại'}
          </button>
        )}
        {sync.status === 'error' && (
          <>
            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void run(syncNow)}>
              {busy ? 'Đang thử…' : 'Thử lại'}
            </button>
            <a className="btn btn-sm btn-ghost" href={hrefFor('settings')}>
              Cài đặt
            </a>
          </>
        )}
        <button type="button" className="btn btn-sm btn-ghost btn-icon syncb-close" onClick={dismissSyncBanner} aria-label="Ẩn thông báo đồng bộ">
          <Icon icon={X} size={16} />
        </button>
      </div>
    </div>
  );
}
