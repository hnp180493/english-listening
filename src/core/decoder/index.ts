import type { DecodeResult } from '../types';

/**
 * Analyse a written English sentence and describe how it is pronounced in
 * natural, fast (General American) speech. Pure function, synchronous, no I/O.
 * Must never throw: empty/garbage input → result with empty tokens.
 */
export function decode(input: string): DecodeResult {
  return { input, tokens: [], annotations: [], segments: [], spokenText: '' };
}
