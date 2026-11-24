// The JSX runtime the build uses (vite.config.ts: jsxImportSource): React's own, with one step in front for host
// elements and fragments in English mode (translateProps). Components are passed through untouched, so a string a
// component uses in its logic keeps its Vietnamese value until it reaches the element that shows it.
import { Fragment, jsx as reactJsx, jsxs as reactJsxs } from 'react/jsx-runtime';
import type { ElementType, Key, ReactElement } from 'react';
import { translateProps } from './translateProps';

const shown = (type: unknown): boolean => typeof type === 'string' || type === Fragment;

export { Fragment };

export function jsx(type: ElementType, props: unknown, key?: Key): ReactElement {
  return reactJsx(type, (shown(type) ? translateProps(props) : props) as object, key);
}

export function jsxs(type: ElementType, props: unknown, key?: Key): ReactElement {
  return reactJsxs(type, (shown(type) ? translateProps(props) : props) as object, key);
}
