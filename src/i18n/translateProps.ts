import { getLang, tr } from './lang';

/** Host-element props that hold text a person reads or hears (never `value`: that is the learner's own input). */
const TEXT_PROPS = ['title', 'aria-label', 'placeholder', 'alt', 'aria-description', 'aria-valuetext', 'aria-roledescription', 'label'] as const;

type Props = Record<string, unknown>;

/** `before` = the sibling just in front: a number there is the count the text agrees with (`{n} câu`). */
function child(c: unknown, before?: unknown): unknown {
  if (typeof c === 'string') return tr(c, typeof before === 'number' ? before : undefined);
  if (Array.isArray(c)) {
    let out: unknown[] | null = null;
    for (let i = 0; i < c.length; i++) {
      const next = child(c[i], i > 0 ? c[i - 1] : undefined);
      if (next !== c[i]) {
        out ??= c.slice();
        out[i] = next;
      }
    }
    return out ?? c;
  }
  return c;
}

/**
 * English mode: the text of a host element (its string children and its text attributes) goes through the
 * dictionary on its way to React, so a Vietnamese label written anywhere above it (JSX, a table of labels, a
 * `vi` field of the content) is shown in English without a call at each site. `data-vi` on the element keeps it
 * as written (the learner's own text, a Vietnamese example).
 */
export function translateProps(props: unknown): unknown {
  if (getLang() === 'vi' || !props || typeof props !== 'object') return props;
  const p = props as Props;
  if (p['data-vi'] !== undefined) return props;
  let out: Props | null = null;
  if ('children' in p) {
    const next = child(p.children);
    if (next !== p.children) {
      out = { ...p };
      out.children = next;
    }
  }
  for (const name of TEXT_PROPS) {
    const v = p[name];
    if (typeof v !== 'string') continue;
    const next = tr(v);
    if (next !== v) {
      out ??= { ...p };
      out[name] = next;
    }
  }
  return out ?? props;
}
