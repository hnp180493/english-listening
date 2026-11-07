import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Icon } from '../../components/Icon';
import type { Lesson } from '../../data/lessons';

/**
 * Lesson number in a NEUTRAL row tile (.list-row-lead): muted by default, accent for the recommended next lesson,
 * a muted check once the lesson is done. No phenomenon colour (docs/design-system.md, list row anatomy).
 */
export function LessonNum({ lesson, done, next = false }: { lesson: Lesson; done: boolean; next?: boolean }) {
  const cls = 'list-row-lead lessons-num' + (next && !done ? ' is-next' : '') + (done ? ' is-done' : '');
  return (
    <span className={cls} aria-hidden="true">
      {done ? <Icon icon={Check} size={18} strokeWidth={2.5} /> : lesson.order}
    </span>
  );
}

/** A hyphenated respelling inside a title ("every → EV-ri", "ballet → ba-LEI"). */
const RESPELL_TOKEN = /[A-Za-zəɜ]+(?:-[A-Za-zəɜ]+)+/g;

/**
 * Title text with every hyphenated respelling kept on one line, so a narrow screen never breaks "EV-ri" into
 * "EV-" / "ri" (a hard hyphen is a line-break opportunity). Plain text otherwise.
 */
export function NoBreakRespell({ text }: { text: string }): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(RESPELL_TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    out.push(
      <span key={at} className="lessons-nobr">
        {m[0]}
      </span>,
    );
    last = at + m[0].length;
  }
  if (out.length === 0) return text;
  if (last < text.length) out.push(text.slice(last));
  return out;
}
