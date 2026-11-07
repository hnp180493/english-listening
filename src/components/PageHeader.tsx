import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { RouteId } from '../core/nav';
import { Icon } from './Icon';

export interface PageHeaderProps {
  /** Page title (rendered as the page's only <h1>; the shell focuses it on navigation). */
  title: ReactNode;
  /** One line under the title: ≤ 70 characters, fixed copy (never live stats). Hidden on phones in .page-focus. */
  subtitle?: ReactNode;
  /** @deprecated No-op: headers no longer show a route tile (the sidebar's active item already does). */
  route?: RouteId;
  /** Back link above the title (Lesson view, Media player). */
  back?: { href: string; label: string };
  /** Right-aligned actions: at most one .btn-primary plus one soft button, or one badge. */
  actions?: ReactNode;
  /** Rendered last in the actions, normally <ShortcutsHelp items={…} />. */
  help?: ReactNode;
  className?: string;
  /** id for the <h1> (aria-labelledby targets). */
  titleId?: string;
}

/** Standard page header: [back] title + subtitle [actions][help]. Styles: .page-head in src/index.css. */
export default function PageHeader({ title, subtitle, back, actions, help, className, titleId }: PageHeaderProps) {
  return (
    <header className={'page-head' + (className ? ' ' + className : '')}>
      <div className="page-head-text">
        {back && (
          <a className="btn btn-ghost btn-sm page-head-back" href={back.href}>
            <Icon icon={ChevronLeft} size={16} />
            {back.label}
          </a>
        )}
        <h1 id={titleId}>{title}</h1>
        {subtitle && <p className="page-head-sub">{subtitle}</p>}
      </div>
      {(actions || help) && (
        <div className="page-head-actions">
          {actions}
          {help}
        </div>
      )}
    </header>
  );
}
