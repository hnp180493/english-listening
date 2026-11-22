import { useState } from 'react';
import { cloudSyncNow, dismissCloudBanner, useCloudSync } from '../core/cloud/cloudController';
import { hrefFor } from '../core/nav';
import { Cloud, X } from 'lucide-react';
import { Icon } from './Icon';
import './SyncBanner.css';

/**
 * Small, non-blocking notice at the top of every page for account sync (Google sign-in): newer data in the account
 * (reload), the session ended, or, once, that the folder sync this browser used is gone and syncing now goes through
 * the account. Network trouble stays quiet (the status line in Cài đặt shows it).
 */
export default function SyncBanner() {
  const cloud = useCloudSync();
  const [busy, setBusy] = useState(false);

  const kind =
    cloud.status === 'remote-newer' || cloud.status === 'expired'
      ? cloud.bannerDismissed
        ? null
        : cloud.status
      : cloud.folderRetired && cloud.status === 'signed-out'
        ? 'folder-retired'
        : null;
  if (!kind) return null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="syncb" role="status" aria-live="polite">
      <span className="syncb-icon" aria-hidden="true">
        <Icon icon={Cloud} size={18} />
      </span>
      <div className="syncb-text">
        {kind === 'remote-newer' && (
          <>
            <strong>Có dữ liệu mới trong tài khoản.</strong>{' '}
            <span className="syncb-sub">Tải lại để cập nhật. Những gì bạn vừa luyện trên máy này được gộp vào, không bị mất.</span>
          </>
        )}
        {kind === 'expired' && (
          <>
            <strong>Phiên đăng nhập đã hết hạn.</strong>{' '}
            <span className="syncb-sub">Đăng nhập lại để tiếp tục đồng bộ. Dữ liệu trên máy này vẫn được giữ.</span>
          </>
        )}
        {kind === 'folder-retired' && (
          <>
            <strong>Đồng bộ qua thư mục đã thôi dùng.</strong>{' '}
            <span className="syncb-sub">Dữ liệu trên máy này vẫn còn nguyên. Đăng nhập Google để đồng bộ giữa các máy.</span>
          </>
        )}
      </div>
      <div className="syncb-actions">
        {kind === 'remote-newer' ? (
          <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => void run(cloudSyncNow)}>
            {busy ? 'Đang tải…' : 'Tải lại'}
          </button>
        ) : (
          <a
            className="btn btn-sm btn-primary"
            href={hrefFor('settings')}
            onClick={kind === 'folder-retired' ? dismissCloudBanner : undefined}
          >
            {kind === 'folder-retired' ? 'Đăng nhập' : 'Cài đặt'}
          </a>
        )}
        <button type="button" className="btn btn-sm btn-ghost btn-icon syncb-close" onClick={dismissCloudBanner} aria-label="Ẩn thông báo đồng bộ">
          <Icon icon={X} size={16} />
        </button>
      </div>
    </div>
  );
}
