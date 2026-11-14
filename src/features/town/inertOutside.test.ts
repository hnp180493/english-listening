import { describe, expect, it } from 'vitest';
import { inertOutside, type InertNode } from './inertOutside';

class Node implements InertNode {
  parentElement: Node | null = null;
  children: Node[] = [];
  attrs = new Set<string>();
  readonly name: string;
  constructor(name: string, kids: Node[] = []) {
    this.name = name;
    for (const k of kids) {
      k.parentElement = this;
      this.children.push(k);
    }
  }
  hasAttribute(n: string) {
    return this.attrs.has(n);
  }
  setAttribute(n: string, _value: string) {
    this.attrs.add(n);
  }
  removeAttribute(n: string) {
    this.attrs.delete(n);
  }
}

function page() {
  const canvas = new Node('canvas');
  const hud = new Node('hud');
  const stage = new Node('stage', [canvas, hud]);
  const header = new Node('header');
  const how = new Node('how');
  const town = new Node('town-page', [header, stage, how]);
  const main = new Node('main', [town]);
  const skip = new Node('skip');
  const nav = new Node('nav');
  const popover = new Node('popover');
  popover.setAttribute('inert', '');
  const body = new Node('body', [skip, nav, main, popover]);
  const html = new Node('html', [new Node('head'), body]);
  return { html, body, stage, canvas, hud, header, how, town, main, skip, nav, popover };
}

describe('inertOutside', () => {
  it('everything around the stage goes inert; the stage, what is in it and its ancestors stay usable', () => {
    const p = page();
    inertOutside(p.stage, p.body);
    for (const n of [p.header, p.how, p.skip, p.nav]) expect(n.hasAttribute('inert'), n.name).toBe(true);
    for (const n of [p.stage, p.canvas, p.hud, p.town, p.main, p.body]) expect(n.hasAttribute('inert'), n.name).toBe(false);
    // nothing above the root (the head) is touched
    expect(p.html.children[0].hasAttribute('inert')).toBe(false);
  });

  it('the undo takes it off again, but only where this call put it', () => {
    const p = page();
    const undo = inertOutside(p.stage, p.body);
    undo();
    for (const n of [p.header, p.how, p.skip, p.nav]) expect(n.hasAttribute('inert'), n.name).toBe(false);
    expect(p.popover.hasAttribute('inert')).toBe(true);
  });
});
