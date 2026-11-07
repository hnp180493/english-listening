// Typed errors of the AI layer. Every message is Vietnamese, actionable and free of secrets:
// provider text is passed through redactSecrets() before it may appear in `detail`.

import type { AiErrorCode, ProviderKind } from './types';

export interface AiErrorInit {
  status?: number;
  provider?: ProviderKind;
  /** Short provider-side explanation (already redacted), appended to some messages. */
  detail?: string;
  /** Server-requested wait before retrying (Retry-After / RetryInfo), in ms. */
  retryAfterMs?: number;
  retryable?: boolean;
}

/** Detail used by every adapter when the output-token limit cut the answer off. */
export const TRUNCATED_DETAIL =
  "hết giới hạn token trước khi trả lời xong (tăng maxTokens, hoặc đặt reasoning: 'off'/'low' vì token suy nghĩ cũng bị tính vào maxTokens)";

const RETRYABLE: ReadonlySet<AiErrorCode> = new Set(['rate-limit', 'server', 'network']);

export class AiError extends Error {
  readonly code: AiErrorCode;
  readonly status?: number;
  readonly provider?: ProviderKind;
  readonly detail?: string;
  readonly retryAfterMs?: number;
  /** True for transient failures the client retries with backoff (429 rate limit, 5xx, network). */
  readonly retryable: boolean;

  constructor(code: AiErrorCode, message: string, init: AiErrorInit = {}) {
    super(redactSecrets(message));
    this.name = 'AiError';
    this.code = code;
    this.status = init.status;
    this.provider = init.provider;
    this.detail = init.detail ? redactSecrets(init.detail).slice(0, 300) : undefined;
    this.retryAfterMs = init.retryAfterMs;
    this.retryable = init.retryable ?? RETRYABLE.has(code);
  }
}

export function isAiError(e: unknown): e is AiError {
  return e instanceof AiError;
}

const KNOWN_SECRETS = new Set<string>();

/** Registers a key so redactSecrets() hides it even when it matches no known pattern (called by config.ts on load/save). */
export function registerSecret(secret: string | undefined): void {
  if (secret && secret.length >= 8) KNOWN_SECRETS.add(secret);
}

const SECRET_PATTERNS: RegExp[] = [
  /AIza[0-9A-Za-z_-]{16,}/g, // Google API keys
  /\bAQ\.[0-9A-Za-z_-]{16,}/g, // newer Google AI Studio keys "AQ.…"
  /sk-[A-Za-z0-9_*.-]{6,}/g, // OpenAI sk-…, sk-proj-…, Anthropic sk-ant-…, OpenRouter sk-or-v1-… (OpenAI echoes masked keys "sk-ab***yz")
  /\bBearer\s+[^\s"',]+/gi,
  /([?&](?:key|api[_-]?key)=)[^&\s"']+/gi,
  /("?(?:x-goog-api-key|x-api-key|authorization)"?\s*[:=]\s*"?)[^\s"',}]+/gi,
];

/** Hides API keys and auth headers in any text. Use on everything that may reach the UI, logs or thrown objects. */
export function redactSecrets(text: string): string {
  let out = String(text);
  for (const s of KNOWN_SECRETS) {
    if (out.includes(s)) out = out.split(s).join('[đã ẩn]');
  }
  for (const re of SECRET_PATTERNS) {
    out = out.replace(re, (m, prefix?: unknown) => (typeof prefix === 'string' && m.startsWith(prefix) ? prefix + '[đã ẩn]' : '[đã ẩn]'));
  }
  return out;
}

export interface MessageContext {
  label: string;
  model?: string;
  status?: number;
  retryAfterMs?: number;
  timeoutMs?: number;
  detail?: string;
}

/**
 * A provider label inside a sentence: the generic "Máy chủ tương thích OpenAI" loses its capital
 * ("Không kết nối được tới máy chủ tương thích OpenAI"); brand names keep theirs.
 */
export function labelInSentence(label: string): string {
  return label.startsWith('Máy chủ ') ? 'm' + label.slice(1) : label;
}

const VIETNAMESE = /[À-ỹ]/;

/** Vietnamese user-facing message for each code. */
export function messageFor(code: AiErrorCode, ctx: MessageContext): string {
  const label = labelInSentence(ctx.label);
  const Label = ctx.label; // at the start of a sentence
  const detail = ctx.detail ? ` Chi tiết: ${ctx.detail}` : '';
  // the provider's own (English) explanation adds nothing to a complete Vietnamese message
  const viDetail = ctx.detail && VIETNAMESE.test(ctx.detail) ? detail : '';
  switch (code) {
    case 'no-provider':
      return 'Chưa cấu hình nhà cung cấp AI. Vào Cài đặt → AI, thêm nhà cung cấp (ví dụ Gemini) và nhập API key.';
    case 'bad-key':
      return ctx.status === 403
        ? `${Label} từ chối API key (403). Key có thể bị giới hạn (theo website/API) hoặc chưa bật quyền dùng API này — kiểm tra lại trong trang quản lý key.${detail}`
        : `API key của ${label} không hợp lệ, đã hết hạn hoặc bị thu hồi.`;
    case 'quota':
      return `Đã hết hạn mức (quota) hoặc tín dụng của ${label}. Kiểm tra gói cước/billing, hoặc thử lại vào ngày mai.${viDetail}`;
    case 'rate-limit': {
      const s = ctx.retryAfterMs ? Math.max(1, Math.ceil(ctx.retryAfterMs / 1000)) : 0;
      return s
        ? `${Label} đang giới hạn tốc độ (gửi quá nhiều yêu cầu). Đợi khoảng ${s} giây rồi thử lại.`
        : `${Label} đang giới hạn tốc độ (gửi quá nhiều yêu cầu). Đợi một lát rồi thử lại.`;
    }
    case 'network':
      return `Không kết nối được tới ${label}. Kiểm tra kết nối Internet rồi thử lại.`;
    case 'cors':
      return `Trình duyệt không gửi được yêu cầu tới ${label}: máy chủ chưa chạy hoặc chưa cho phép truy cập từ trình duyệt (CORS). Với máy chủ cục bộ (Ollama/LM Studio) hãy bật CORS; xem docs/ai-providers.md.${detail}`;
    case 'model':
      return `Không dùng được model "${ctx.model ?? '?'}" của ${label} (không tồn tại, đã ngừng hoặc key không có quyền). Chọn model khác trong Cài đặt → AI.${detail}`;
    case 'safety':
      return `${Label} từ chối trả lời vì bộ lọc an toàn. Thử diễn đạt lại nội dung.${detail}`;
    case 'bad-response':
      return `${Label} trả về dữ liệu không đúng định dạng mong đợi. Thử lại.${detail}`;
    case 'bad-request':
      return `${Label} không chấp nhận yêu cầu${ctx.status ? ` (${ctx.status})` : ''}.${detail}`;
    case 'server':
      return `${label === Label ? `Máy chủ ${label}` : Label} đang gặp sự cố hoặc quá tải${ctx.status ? ` (${ctx.status})` : ''}. Thử lại sau ít phút.`;
    case 'timeout':
      return `${Label} phản hồi quá lâu${ctx.timeoutMs ? ` (hơn ${Math.round(ctx.timeoutMs / 1000)} giây)` : ''}. Thử lại sau.`;
    case 'aborted':
      return 'Đã hủy yêu cầu AI.';
  }
}

export function makeError(code: AiErrorCode, ctx: MessageContext & { provider?: ProviderKind }, init: AiErrorInit = {}): AiError {
  return new AiError(code, messageFor(code, ctx), {
    status: ctx.status,
    provider: ctx.provider,
    detail: ctx.detail,
    retryAfterMs: ctx.retryAfterMs,
    ...init,
  });
}
