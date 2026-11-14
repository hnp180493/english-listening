// Full screen as an overlay (an iPhone, or a browser that refused the Fullscreen API): the page under the stage is
// still there. Making it inert keeps the keyboard and the screen reader inside the town until full screen ends.

/** What inertOutside needs of an element (a real Element has all of it). */
export interface InertNode {
  readonly parentElement: InertNode | null;
  readonly children: ArrayLike<InertNode>;
  hasAttribute(name: string): boolean;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

/**
 * Make every element on the page outside `el` inert: its siblings, and the siblings of each ancestor up to (and
 * among the children of) `root`. Elements that were inert already are left alone. Returns the undo, which takes
 * the attribute off only what this call put it on.
 */
export function inertOutside(el: InertNode, root: InertNode): () => void {
  const changed: InertNode[] = [];
  let node: InertNode = el;
  while (node !== root && node.parentElement) {
    const parent: InertNode = node.parentElement;
    for (const sib of Array.from(parent.children)) {
      if (sib === node || sib.hasAttribute('inert')) continue;
      sib.setAttribute('inert', '');
      changed.push(sib);
    }
    node = parent;
  }
  return () => {
    for (const e of changed) e.removeAttribute('inert');
  };
}
