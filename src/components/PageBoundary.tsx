import { Component, type ErrorInfo, type ReactNode } from 'react';
import { hrefFor } from '../core/nav';
import { isChunkLoadError } from './chunkError';
import { TriangleAlert } from 'lucide-react';
import { IconTile } from './Icon';

export interface PageBoundaryProps {
  children: ReactNode;
  /**
   * Changes whenever the full route (id + params) changes. While the error card is shown, a new
   * value clears the error so e.g. #/lessons?id=X → #/lessons renders again. A healthy page is
   * never remounted by this (the boundary itself stays keyed by route id in App).
   */
  resetKey?: string;
  /**
   * Called after the error card has been committed (componentDidCatch). App uses it to renew a page
   * whose chunk failed to load, so the next render downloads it again (see components/lazyPage.ts).
   */
  onError?: (error: Error) => void;
}
interface PageBoundaryState {
  error: Error | null;
  resetKey?: string; // the resetKey the current state belongs to
}

/** Keeps the shell alive if one page throws; offers a way out instead of a blank screen. */
export default class PageBoundary extends Component<PageBoundaryProps, PageBoundaryState> {
  state: PageBoundaryState = { error: null, resetKey: this.props.resetKey };

  /** A new route clears a shown error (and is a no-op for a healthy page). */
  static getDerivedStateFromProps(props: PageBoundaryProps, state: PageBoundaryState): Partial<PageBoundaryState> | null {
    if (props.resetKey === state.resetKey) return null;
    return { error: null, resetKey: props.resetKey };
  }

  static getDerivedStateFromError(error: Error): Partial<PageBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface in devtools for debugging; the UI shows a friendly message.
    console.warn('Trang gặp lỗi:', error, info.componentStack);
    this.props.onError?.(error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const chunk = isChunkLoadError(this.state.error);
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    return (
      <div className="card shell-error" role="alert">
        <IconTile icon={TriangleAlert} tint="var(--warn)" size="lg" />
        <h1 className="shell-error-title">{chunk ? 'Chưa tải được trang này' : 'Trang này đang gặp sự cố'}</h1>
        <p className="muted">
          {chunk
            ? offline
              ? 'Bạn đang ngoại tuyến và trang này chưa được lưu sẵn trên máy. Hãy kết nối mạng rồi tải lại trang. Dữ liệu học của bạn vẫn an toàn.'
              : 'Không tải được phần mã của trang (mạng chập chờn, hoặc ứng dụng vừa được cập nhật). Hãy tải lại trang. Dữ liệu học của bạn vẫn an toàn.'
            : 'Đã có lỗi khi hiển thị trang. Dữ liệu học của bạn vẫn an toàn. Hãy thử tải lại trang, hoặc quay về trang Hôm nay.'}
        </p>
        <div className="row">
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Tải lại trang
          </button>
          {/* '#/' and '#/home' give the same route, so a click here may fire no hashchange: reset directly. */}
          <a className="btn" href={hrefFor('home')} onClick={() => this.setState({ error: null })}>
            Về trang Hôm nay
          </a>
        </div>
      </div>
    );
  }
}
