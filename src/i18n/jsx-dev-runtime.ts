// Development twin of jsx-runtime.ts (the dev server compiles JSX to jsxDEV).
import { Fragment, jsxDEV as reactJsxDEV } from 'react/jsx-dev-runtime';
import type { ElementType, Key, ReactElement } from 'react';
import { translateProps } from './translateProps';

export { Fragment };

export function jsxDEV(type: ElementType, props: unknown, key: Key | undefined, isStatic: boolean, source?: unknown, self?: unknown): ReactElement {
  const shown = typeof type === 'string' || type === Fragment;
  return (reactJsxDEV as (...args: unknown[]) => ReactElement)(type, shown ? translateProps(props) : props, key, isStatic, source, self);
}
