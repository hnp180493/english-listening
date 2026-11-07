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
