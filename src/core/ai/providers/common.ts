// Small helpers shared by adapters.

import { isAiError, redactSecrets } from '../errors';
import type { CallContext } from '../http';
import type { TestResult } from '../types';

/** Turns any error from a connection test into { ok: false } with a safe Vietnamese message. */
export function testFailure(e: unknown, ctx: CallContext): TestResult {
  if (isAiError(e)) return { ok: false, code: e.code, message: e.message };
  return { ok: false, code: 'network', message: redactSecrets(`Không kiểm tra được kết nối tới ${ctx.label}.`) };
}

/** Header values must be ISO-8859-1 (fetch throws otherwise): strip diacritics and anything non-ASCII. */
export function asciiHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^\x20-\x7e]/g, '')
    .trim();
}
