import { Component, type ErrorInfo, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { backupFileName, clearAll, exportBackup, serializeBackup } from '../core/backup';
import { IconTile } from './Icon';

/**
 * Last line of defence around the whole app (the shell included; pages have their own PageBoundary). If even the
 * shell cannot render — e.g. stored data the readers do not survive — the learner gets a way out instead of a blank
 * screen: save a copy of the data, then clear it and start again. Without this, only devtools could recover.
 */
export default class RootBoundary extends Component<{ children: ReactNode }, { error: Error | null; saved: boolean }> {
  state = { error: null as Error | null, saved: false };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn('Ứng dụng gặp lỗi:', error, info.componentStack);
  }

  private save = () => {
    try {
      const blob = new Blob([serializeBackup(exportBackup(window.localStorage))], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backupFileName();
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      this.setState({ saved: true });
    } catch {
      // storage unreadable: nothing to save
    }
  };

  private reset = () => {
    const ok = window.confirm(
      this.state.saved
        ? 'Xóa dữ liệu học trên trình duyệt này rồi mở lại ứng dụng?'
        : 'Bạn chưa lưu bản sao. Vẫn xóa dữ liệu học trên trình duyệt này rồi mở lại ứng dụng?',
    );
    if (!ok) return;
    try {
      clearAll(window.localStorage, { keepDeviceLocal: true });
    } catch {
      // nothing more we can do
    }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="shell-rescue">
        <div className="card shell-error" role="alert">
          <IconTile icon={TriangleAlert} tint="var(--warn)" size="lg" />
          <h1 className="shell-error-title">Ứng dụng không mở được</h1>
          <p className="muted">
            Có thể dữ liệu học trên trình duyệt này bị hỏng (ví dụ do một tệp sao lưu hoặc tệp đồng bộ lỗi). Hãy thử tải lại
            trang. Nếu vẫn lỗi, lưu một bản sao dữ liệu rồi xóa để mở lại.
          </p>
          <div className="row">
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              Tải lại trang
            </button>
            <button type="button" className="btn" onClick={this.save}>
              {this.state.saved ? 'Đã lưu bản sao' : 'Lưu bản sao dữ liệu'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={this.reset}>
              Xóa dữ liệu và mở lại
            </button>
          </div>
        </div>
      </div>
    );
  }
}
