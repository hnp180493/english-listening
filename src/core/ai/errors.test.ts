import { describe, expect, it } from 'vitest';
import { ANTHROPIC_KEY, GEMINI_KEY, OPENAI_KEY, OPENROUTER_KEY } from './aiTestUtils';
import { AiError, makeError, messageFor, redactSecrets, registerSecret } from './errors';
import type { AiErrorCode } from './types';

describe('redactSecrets', () => {
  it('hides every known key format and auth header', () => {
    const text = `a ${GEMINI_KEY} b ${OPENAI_KEY} c ${ANTHROPIC_KEY} d ${OPENROUTER_KEY} Bearer abc.def ?key=XYZ123&x=1 "x-goog-api-key": "zzz"`;
    const out = redactSecrets(text);
    for (const k of [GEMINI_KEY, OPENAI_KEY, ANTHROPIC_KEY, OPENROUTER_KEY, 'abc.def', 'XYZ123', 'zzz']) expect(out).not.toContain(k);
    expect(out).toContain('?key=[đã ẩn]');
  });
  it('hides OpenAI-style masked echoes and registered custom secrets', () => {
    expect(redactSecrets('Incorrect API key provided: sk-proj-***********lmnop.')).not.toContain('lmnop');
    registerSecret('my-local-server-token-123');
    expect(redactSecrets('token my-local-server-token-123 rejected')).toBe('token [đã ẩn] rejected');
  });
});

describe('AiError', () => {
  it('redacts message and detail and sets retryable by code', () => {
    const e = new AiError('bad-request', `bad ${GEMINI_KEY}`, { detail: `detail ${OPENAI_KEY}` });
    expect(e.message).not.toContain(GEMINI_KEY);
    expect(e.detail).not.toContain(OPENAI_KEY);
    expect(e.retryable).toBe(false);
    expect(new AiError('rate-limit', 'x').retryable).toBe(true);
    expect(new AiError('server', 'x').retryable).toBe(true);
    expect(new AiError('network', 'x').retryable).toBe(true);
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('AiError');
  });

  it('has a Vietnamese message for every code', () => {
    const codes: AiErrorCode[] = ['no-provider', 'bad-key', 'quota', 'rate-limit', 'network', 'cors', 'model', 'safety', 'bad-response', 'bad-request', 'server', 'timeout', 'aborted'];
    for (const c of codes) {
      const m = messageFor(c, { label: 'Gemini', model: 'm', status: 500, retryAfterMs: 3000, timeoutMs: 30000 });
      expect(m.length).toBeGreaterThan(10);
    }
    expect(messageFor('rate-limit', { label: 'G', retryAfterMs: 2500 })).toContain('3 giây');
    expect(makeError('timeout', { label: 'G', timeoutMs: 30000 }).message).toContain('30 giây');
  });
});
