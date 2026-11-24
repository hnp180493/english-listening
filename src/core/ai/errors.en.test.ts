// AiError messages in English mode (docs/i18n.md): built with tl when the error is made, so they read English;
// the Vietnamese messages are covered by errors.test.ts (Vietnamese mode).

import { afterEach, describe, expect, it } from 'vitest';
import { addDictionary, resetDictionary, setActiveLang } from '../../i18n/lang';
import ai from '../../i18n/en/ui/ai';
import common from '../../i18n/en/ui/common';
import { GEMINI_KEY } from './aiTestUtils';
import { AiError, messageFor, redactSecrets, TRUNCATED_DETAIL } from './errors';
import type { AiErrorCode } from './types';

afterEach(() => {
  setActiveLang('vi');
  resetDictionary();
});

const english = () => {
  addDictionary(common);
  addDictionary(ai);
  setActiveLang('en');
};

const VI = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;

describe('AiError messages in English', () => {
  it('has an English message for every code, with no Vietnamese left', () => {
    english();
    const codes: AiErrorCode[] = ['no-provider', 'bad-key', 'quota', 'rate-limit', 'network', 'cors', 'model', 'safety', 'bad-response', 'bad-request', 'server', 'timeout', 'aborted'];
    for (const code of codes) {
      for (const label of ['Gemini', 'Máy chủ tương thích OpenAI']) {
        const m = messageFor(code, { label, model: 'm1', status: 503, retryAfterMs: 4000, timeoutMs: 30000, detail: TRUNCATED_DETAIL });
        expect(m, `${code} / ${label}`).not.toMatch(VI);
      }
    }
  });

  it('puts the generic server label in the sentence the English way', () => {
    english();
    const label = 'Máy chủ tương thích OpenAI';
    expect(messageFor('network', { label })).toBe('Could not connect to the OpenAI-compatible server. Check your internet connection and try again.');
    expect(messageFor('rate-limit', { label, retryAfterMs: 1000 })).toBe('The OpenAI-compatible server is limiting requests (too many sent). Wait about 1 second and try again.');
    expect(messageFor('server', { label, status: 503 })).toBe('The OpenAI-compatible server is having problems or is overloaded (503). Try again in a few minutes.');
    expect(messageFor('server', { label: 'Gemini' })).toBe('The Gemini server is having problems or is overloaded. Try again in a few minutes.');
    expect(messageFor('timeout', { label: 'Gemini', timeoutMs: 30000 })).toBe('Gemini took too long to answer (over 30 seconds). Try again later.');
  });

  it('translates a detail of the app’s own', () => {
    english();
    expect(messageFor('bad-response', { label: 'Gemini', detail: TRUNCATED_DETAIL })).toBe(
      `Gemini returned data in an unexpected format. Try again. Details: ${ai[TRUNCATED_DETAIL]}`,
    );
  });

  it('hides keys with an English mark', () => {
    english();
    expect(redactSecrets(`key ${GEMINI_KEY}`)).toBe('key [hidden]');
    expect(new AiError('bad-key', `bad ${GEMINI_KEY}`).message).toBe('bad [hidden]');
    setActiveLang('vi');
    expect(redactSecrets(`key ${GEMINI_KEY}`)).toBe('key [đã ẩn]');
  });
});
