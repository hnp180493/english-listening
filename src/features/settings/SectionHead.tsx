import type { ReactNode } from 'react';

/** Settings card header: plain h2 + one short muted line (no icon tile). Styles: .set-section-head in settings.css. */
export default function SectionHead({ id, title, sub }: { id: string; title: string; sub?: ReactNode }) {
  return (
    <header className="set-section-head">
      <h2 id={id}>{title}</h2>
      {sub && <p>{sub}</p>}
    </header>
  );
}

/**
 * A settings card shown folded: its head is the button that opens it (owner, 2026-11-25: Phím tắt, Dữ liệu and
 * Giới thiệu "không quan trọng, collapse lại hết đi cho gọn"). `#/settings?section=<id>` opens it (SettingsPage).
 */
export function FoldSection({ id, headId, title, sub, className, children, ...rest }: { id?: string; headId: string; title: string; sub?: ReactNode; className?: string; children: ReactNode; 'data-no-shortcuts'?: string }) {
  return (
    <details className={'card set-section set-fold' + (className ? ' ' + className : '')} id={id} {...rest}>
      <summary className="set-fold-summary">
        <SectionHead id={headId} title={title} sub={sub} />
      </summary>
      <div className="set-fold-body">{children}</div>
    </details>
  );
}
