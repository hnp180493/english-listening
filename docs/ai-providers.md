# Nhà cung cấp AI (Gemini, OpenAI, Claude, OpenRouter, máy chủ tương thích OpenAI)

Lớp AI nằm trong `src/core/ai/`. Tính năng (feature) chỉ gọi API chung trong `src/core/ai/index.ts`,
không bao giờ gọi trực tiếp một nhà cung cấp. Gemini là nhà cung cấp chính; các nhà cung cấp khác
dùng chung một giao diện, nên sau này đổi/thêm nhà cung cấp không phải sửa tính năng.

## 1. Lấy API key Gemini (miễn phí)

1. Mở **Google AI Studio**: <https://aistudio.google.com/apikey> và đăng nhập tài khoản Google.
2. Bấm **Create API key** (tạo trong một Google Cloud project mới hoặc có sẵn).
3. Sao chép key (bắt đầu bằng `AIza…`, 39 ký tự), dán vào **Cài đặt → AI** trong ứng dụng, bấm
   **Kiểm tra kết nối**.
4. Gói miễn phí có giới hạn số yêu cầu mỗi phút/mỗi ngày. Khi vượt, ứng dụng báo
   "giới hạn tốc độ" (đợi vài giây, tự thử lại) hoặc "hết hạn mức" (thử lại ngày mai / bật billing).
   Hai trường hợp được phân biệt theo `quotaId` trong lỗi (`…PerMinute…` / `…PerDay…`), vì câu
   thông báo của Google giống hệt nhau cho cả hai.

Khuyến nghị an toàn cho key:

- Trong Google Cloud Console → *APIs & Services → Credentials*, **giới hạn key chỉ dùng
  "Generative Language API"**. Nếu chỉ dùng bản web, có thể giới hạn thêm theo *HTTP referrer*
  (ví dụ `http://localhost:5173/*`) — lưu ý bản portable (`file://`) không gửi referrer nên key bị
  giới hạn theo website sẽ **không** dùng được ở bản portable.
- Đặt **ngân sách/cảnh báo chi tiêu** (Billing → Budgets) nếu project có bật thanh toán.
- Nhà cung cấp khác: OpenAI (*Project → Limits*), Anthropic (*Spend limits*), OpenRouter (giới hạn
  credit cho từng key) đều cho đặt hạn mức chi tiêu — hãy đặt.

## 2. Key được lưu ở đâu — đánh đổi bảo mật

Ứng dụng **chạy hoàn toàn trong trình duyệt, không có máy chủ riêng**, nên key phải nằm trong
trình duyệt và trình duyệt gửi thẳng tới nhà cung cấp.

- Key chỉ lưu trong `localStorage` **của máy này**, dưới tiền tố riêng
  `nghe-noi-am-device:` (khóa `ai-config`; số liệu dùng ở `ai-usage`). Tiền tố này **khác**
  `nghe-noi-am:` mà sao lưu (backup) và đồng bộ thư mục (folder sync) duyệt, nên key **không bao
  giờ** bị xuất ra file sao lưu hay chép sang thư mục OneDrive dùng chung. Thêm vào đó
  `AI_DEVICE_LOCAL_KEYS = ['ai-config', 'ai-usage']` được export để cơ chế loại trừ của sync/backup
  đăng ký tường minh. Mỗi máy phải nhập key riêng.
- Key **không bao giờ** nằm trong URL (Gemini dùng header `x-goog-api-key`, không dùng `?key=`),
  không được ghi log, không có trong thông báo lỗi hay đối tượng lỗi. Hai lớp bảo vệ:
  (1) `http.ts` xóa **đúng giá trị key của chính yêu cầu đó** khỏi phần thân lỗi trước khi tạo
  thông báo — với mọi định dạng và độ dài ≥ 4 ký tự (key LM Studio/vLLM không có tiền tố vẫn bị che),
  kể cả lỗi OpenRouter trả kèm HTTP 200 và key chưa lưu trong form "Kiểm tra kết nối";
  (2) `redactSecrets()` che các mẫu key đã biết (`AIza…`, `sk-…`, `Bearer …`) và các key đã đăng ký.
  Có test kiểm tra. Giao diện chỉ hiện key dạng che: `AIza…k3Fq`.
- Khi lưu, key được bỏ khoảng trắng và ký tự vô hình (zero-width, BOM: `\p{Cf}`). Key còn ký tự
  ngoài ASCII (ví dụ dán lại key đã che có dấu `…`) bị `keyLooksWrong()` cảnh báo, và khi gọi API
  sẽ báo `bad-key` ("API key chứa ký tự không hợp lệ") thay vì lỗi mạng khó hiểu; không gửi yêu cầu.
- **Hạn chế không tránh được:** ai dùng được hồ sơ trình duyệt này (hoặc một tiện ích trình duyệt
  độc hại, hoặc mã độc chạy trong trang) đều có thể đọc key. Vì vậy: chỉ nhập key trên máy cá nhân,
  dùng key **riêng cho ứng dụng này**, **giới hạn quyền + đặt hạn mức chi tiêu**, và thu hồi key
  ngay nếu nghi bị lộ. Nút "xóa toàn bộ dữ liệu" nên gọi `clearAiDeviceData()`.

## 3. CORS (gọi trực tiếp từ trình duyệt)

Đã kiểm tra preflight `OPTIONS` thực tế ngày **2026-11-06** với `Origin: http://localhost:5173`
và `Origin: null` (bản portable mở bằng `file://`):

| Nhà cung cấp | localhost | file:// (portable) | Ghi chú |
|---|---|---|---|
| Gemini (`generativelanguage.googleapis.com`) | ✔ | ✔ | Chỉ cho phép header `content-type`, `x-goog-api-key`. Gửi thêm header khác ⇒ preflight 403, nên adapter không gửi gì thêm. |
| OpenAI (`api.openai.com`) | ✔ | ✔ | Cho phép mọi origin (kể cả `null`). Chỉ "expose" header `CF-Ray`. |
| Anthropic (`api.anthropic.com`) | ✔ | ✔ | Bắt buộc header `anthropic-dangerous-direct-browser-access: true`. Tổ chức bật ZDR/Compliance API bị chặn (401 "CORS requests are not allowed for this Organization") ⇒ mã lỗi `cors`. |
| OpenRouter (`openrouter.ai/api/v1`) | ✔ | ✔ | `Access-Control-Allow-Origin: *`. Bản portable không gửi `HTTP-Referer`. |
| Ollama (tương thích OpenAI) | ✔ nếu mở app ở `http://127.0.0.1:…`; origin khác (kể cả `http://localhost:…`) cần `OLLAMA_ORIGINS` | cần bật | Theo FAQ Ollama, mặc định Ollama chỉ cho phép origin `127.0.0.1` và `0.0.0.0`. Origin khác: đặt biến môi trường `OLLAMA_ORIGINS` (ví dụ `http://localhost:5173`, hoặc `*`; bản portable gửi `Origin: null` nên cần `*` hoặc `null`) rồi khởi động lại Ollama. |
| LM Studio (tương thích OpenAI) | cần bật | cần bật | *Developer → Server settings → Enable CORS*. |

Trình duyệt không cho JavaScript biết một yêu cầu thất bại vì CORS hay vì mạng; với các API đám
mây ở trên (đều cho phép CORS) lỗi `fetch` được báo là `network`, với máy chủ cục bộ là `cors`.

**Header trả về đọc được từ trình duyệt** (`Access-Control-Expose-Headers`, kiểm tra 2026-11-06):
OpenAI chỉ `CF-Ray`; OpenRouter chỉ `X-Generation-Id, x-openrouter-error-origin, x-openrouter-error-tool,
X-Provider-Name, request-id, cf-ray`; Anthropic `*`; Gemini `vary, content-encoding, date, server,
content-length`. Hệ quả: **`Retry-After` chỉ đọc được với Anthropic.** Gemini báo thời gian chờ
trong thân lỗi (`RetryInfo.retryDelay`); với OpenAI, thời gian chờ được lấy từ câu báo lỗi
("Please try again in 1.5s"); với OpenRouter không có thông tin nào đọc được nên dùng backoff
của client.

## 4. Kiến trúc

```
src/core/ai/
  types.ts            ProviderKind, ProviderConfig, AiConfig, TextRequest/Result, TtsRequest/Result, JsonSchema, AiAdapter, AiErrorCode
  defaults.ts         PROVIDER_DEFAULTS: base URL, model mặc định, giọng, gợi ý định dạng key, link lấy key
  config.ts           đọc/ghi AiConfig (device-local), sanitize, maskKey, subscribe
  deviceStorage.ts    localStorage với tiền tố riêng "nghe-noi-am-device:"
  errors.ts           AiError + thông báo tiếng Việt + redactSecrets
  http.ts             một lần gọi fetch → AiError; Retry-After; TIMEOUT_REASON
  schema.ts           validateJson, chuyển schema cho từng nhà cung cấp, parse JSON "lỏng"
  wav.ts              base64 → bytes, PCM → WAV
  ttsCache.ts         cache giọng đọc (IndexedDB, LRU 50 MB, fallback bộ nhớ)
  usage.ts            đếm yêu cầu/token/ký tự TTS theo ngày + giới hạn mềm
  providers/gemini.ts, providers/openaiCompatible.ts, providers/anthropic.ts
  registry.ts         kind → adapter
  client.ts           aiText, aiJson, aiSpeak, aiStatus, testProvider, listProviderModels, subscribeAi
  hooks.ts            useAiStatus, useAiConfig, useAiUsageToday
```

**Thêm một nhà cung cấp mới** (ví dụ Mistral): thêm kind vào `ProviderKind` (types.ts) và
`PROVIDER_KINDS` (config.ts), thêm mục trong `PROVIDER_DEFAULTS`, viết `providers/mistral.ts`
hiện thực `AiAdapter`, thêm một dòng vào `ADAPTERS` (registry.ts). Test "registry completeness"
sẽ báo nếu thiếu. Nhà cung cấp nói chuẩn OpenAI Chat Completions thì chỉ cần
`createOpenAiCompatibleAdapter(kind)`.

### Hành vi chung (client.ts)

- **Chọn nhà cung cấp:** `opts.provider` → `defaultTextProvider`/`defaultTtsProvider` → nhà cung
  cấp đầu tiên dùng được (đang bật, có key nếu cần, có model; TTS: adapter có `tts`).
- **Timeout:** 30 s cho văn bản, 60 s cho TTS, 15 s cho "Kiểm tra kết nối" (mỗi lần thử).
- **Thử lại:** tối đa 2 lần cho `rate-limit` (429), `server` (5xx/529/408), `network`; chờ theo
  thời gian máy chủ yêu cầu nếu đọc được (Anthropic `Retry-After`; Gemini `RetryInfo`; OpenAI câu
  "try again in …"; xem mục 3), không thì 0.8 s · 2ⁿ + jitter (≤ 8 s).
  Nếu máy chủ bảo đợi > 20 s thì báo ngay cho người dùng (kèm số giây).
- **Đoạn âm thanh hỏng:** clip rỗng (< 200 byte) hoặc WAV ngắn hơn max(0,2 s; 0,08 s × số từ) bị
  coi là `bad-response` và **không** được lưu cache (nếu lưu, mỗi lần bấm sau đều phát im lặng).
- **Giọng AI khi phát (src/core/tts.ts):** mỗi lần phát chờ clip tối đa 15 s *tổng cộng* (kể cả khi
  nhập chung một yêu cầu prefetch có timeout dài hơn), không thử lại; quá hạn hoặc lỗi thì đọc bằng
  giọng trình duyệt ngay trong lần bấm đó. Lỗi cần sửa cài đặt (key, quota nhà cung cấp, model…)
  tắt giọng AI tới khi cài đặt AI đổi; `network`/`timeout`/`server` tạm tắt 30 s; `rate-limit` tạm
  tắt theo thời gian máy chủ yêu cầu (5 s – 5 phút). Giới hạn yêu cầu/ngày do người học tự đặt
  **không** tắt giọng AI: câu đã có trong cache vẫn phát bằng giọng AI. Thông báo "Giọng AI lỗi…"
  hiện một lần cho mỗi loại lỗi (theo mã lỗi). Prefetch (tạo sẵn câu sắp nghe, timeout 30 s, tối đa
  2 yêu cầu cùng lúc) chỉ tạo câu hiện tại cho tới khi người học đã nghe một lần bằng giọng AI.
- **Suy nghĩ (reasoning):** model mặc định của cả ba nhà cung cấp đều "suy nghĩ" trước khi trả lời
  và **token suy nghĩ bị tính vào `maxTokens`**. Với câu trả lời ngắn / JSON có `maxTokens` nhỏ, đặt
  `reasoning: 'off'` (hoặc `'low'`). Ánh xạ: Gemini `generationConfig.thinkingConfig.thinkingLevel`
  (`MINIMAL`/`LOW`), OpenAI `reasoning_effort` (`none`/`low`), OpenRouter `reasoning.effort`
  (`none`/`low`), Claude `output_config.effort: 'low'` (+ `thinking: {type:'disabled'}` khi `'off'`).
  Model nào từ chối tham số này (400) thì adapter tự gửi lại không có nó. Không đặt = mặc định
  của nhà cung cấp. Máy chủ cục bộ không nhận tham số này.
- **Bị cắt vì hết token:** `TextResult.truncated = true` khi nhà cung cấp dừng vì giới hạn token
  (Gemini `MAX_TOKENS`, OpenAI `length`, Claude `max_tokens`) — `text` khi đó bị cụt. Ở chế độ JSON,
  adapter báo ngay `bad-response` kèm gợi ý tăng `maxTokens`/đặt `reasoning`, và `aiJson` **không**
  chạy vòng "sửa" (vòng sửa cũng sẽ bị cắt y như vậy, tốn tiền vô ích).
- **JSON:** `aiJson` gửi schema theo cách gốc của từng nhà cung cấp, rồi tự kiểm tra lại bằng
  `validateJson` (+ `validate` tùy chọn). Sai ⇒ **một** lần "sửa" tự động (gửi lại câu trả lời cũ
  và danh sách lỗi), vẫn sai ⇒ `bad-response`. **Gốc schema phải là object** với OpenAI và Claude,
  nên `TextRequest.json.schema` có kiểu `JsonObjectSchema`; `aiJson` nhận mọi kiểu gốc và tự bọc
  gốc không phải object thành `{value: …}` rồi gỡ ra (chấp nhận cả khi model trả thẳng giá trị).
- **TTS cache:** khóa = hash(kind + model + giọng + style + văn bản đã chuẩn hóa khoảng trắng);
  lưu cả khóa đầy đủ để loại trừ trùng hash. IndexedDB `nghe-noi-am-ai/tts`, LRU, tối đa 50 MB; nếu
  IndexedDB không dùng được (một số cấu hình `file://`, chế độ ẩn danh, trang sandbox mà chính việc
  đọc `indexedDB` đã ném `SecurityError`) thì dùng bộ nhớ (8 MB, mất khi tải lại trang). Mỗi lần
  đọc/ghi cache có hạn 2 s và tôn trọng `signal`: IndexedDB bị treo (lỗi WebKit, tab khác chặn nâng
  cấp) được coi là "không có trong cache" và phiên đó chuyển sang cache bộ nhớ.
- **Gộp yêu cầu TTS trùng:** nhiều lời gọi `aiSpeak` cùng nội dung chạy đồng thời (bấm hai lần,
  React StrictMode) dùng chung **một** yêu cầu trả phí; một người gọi hủy không làm hủy yêu cầu của
  người khác (chỉ hủy khi tất cả đã hủy).
- **Số liệu:** mỗi ngày, mỗi nhà cung cấp: requests, errors, inputTokens, outputTokens, ttsChars,
  cacheHits (giữ 30 ngày). `dailyRequestCap` (tùy chọn) chặn mềm khi đạt số yêu cầu/ngày. Thay đổi
  từ tab khác cũng báo cho `subscribeAi`/`useAiUsageToday`. Khi mở nhiều tab cùng lúc, bộ đếm có thể
  hụt vài lần (đọc-sửa-ghi trên localStorage), nên giới hạn mềm chỉ là gần đúng.
- **Id nhà cung cấp:** `[A-Za-z0-9_-]{1,64}`, không được là `__proto__`/`constructor`/`prototype`.
  Id sai/trùng được thay bằng id xác định (`p-<kind>-<n>`) và lưu lại ngay, nên id không đổi sau
  mỗi lần tải lại.

### Mã lỗi (`AiError.code`)

| code | Khi nào | Thử lại tự động |
|---|---|---|
| `no-provider` | chưa cấu hình / nhà cung cấp tắt / thiếu key / không hỗ trợ TTS | không |
| `bad-key` | 401, 403 (trừ 403 của OpenRouter), Gemini `API_KEY_INVALID`, key chứa ký tự không gửi được trong header | không |
| `quota` | hết credit/hạn mức (OpenAI `insufficient_quota`, OpenRouter 402, Anthropic billing/spend limit, Gemini quota có `quotaId` theo ngày) hoặc đạt giới hạn mềm | không |
| `rate-limit` | 429 tạm thời | có |
| `network` | không có mạng / fetch thất bại (API đám mây) | có |
| `cors` | máy chủ cục bộ chưa bật CORS hoặc chưa chạy; tổ chức Anthropic chặn trình duyệt | không |
| `model` | 404, model không tồn tại/không được phép, model không hỗ trợ audio, model TTS OpenAI đã ngừng | không |
| `safety` | bị bộ lọc an toàn chặn (Gemini blockReason/finishReason, OpenAI refusal/content_filter, Claude `refusal`, OpenRouter lỗi có `metadata.reasons`/`flagged_input`) | không |
| `bad-response` | trả về rỗng/sai định dạng, hết token trước khi trả lời (hoặc JSON bị cắt), JSON sai sau khi sửa | không |
| `bad-request` | 400 khác (kèm chi tiết đã che key), khu vực không được hỗ trợ, OpenRouter 403 (guardrail / key không có quyền với model), key Claude không gắn workspace | không |
| `server` | 5xx, 529 quá tải | có |
| `timeout` | quá thời gian chờ | không |
| `aborted` | người dùng hủy (`AbortSignal`) | không |

*Thay đổi so với thiết kế ban đầu:* thêm `bad-request` và `server` (lỗi 400 thường và 5xx cần
thông báo khác với các mã có sẵn); key lưu dưới tiền tố riêng thay vì `nghe-noi-am:` (an toàn theo
cấu trúc, xem mục 2); JSON của Claude dùng `output_config.format` làm cách chính, công cụ ép buộc
(forced tool) rồi lời nhắc chỉ là phương án dự phòng (xem dưới); `aiJson` trả thẳng `T`.
Sau vòng rà soát 2026-11-06: thêm `TextRequest.reasoning`, `TextResult.truncated`, kiểu
`JsonObjectSchema` (gốc schema gửi cho nhà cung cấp luôn là object; `aiJson` nhận `AiJsonRequest`
với mọi kiểu gốc).

## 5. Chi tiết từng nhà cung cấp (đã đối chiếu tài liệu chính thức ngày 2026-11-06)

### Gemini — mặc định

- Tài liệu (từ 2026 các trang `ai.google.dev/...` chuyển hướng 301 sang `aistudio.google.com`):
  <https://aistudio.google.com/api-reference/generate-content>,
  <https://aistudio.google.com/docs/speech-generation>, danh sách model <https://aistudio.google.com/docs/models>.
- Văn bản: `POST {base}/models/{model}:generateContent`, `base = https://generativelanguage.googleapis.com/v1beta`.
  Body: `contents[{role:'user'|'model', parts:[{text}]}]`, `systemInstruction{parts}`,
  `generationConfig{temperature, maxOutputTokens, thinkingConfig}`. Đọc `candidates[0].content.parts[].text`
  (bỏ phần `thought: true`), `usageMetadata.promptTokenCount / candidatesTokenCount (+ thoughtsTokenCount)`.
  **`temperature` (và topP/topK) bị bỏ qua âm thầm trên Gemini 3.6 Flash trở lên** (theo trang
  API reference) — vẫn gửi cho model cũ hơn. `reasoning: 'off'|'low'` ⇒
  `thinkingConfig.thinkingLevel = 'MINIMAL'|'LOW'` (dành cho Gemini 3+; model báo lỗi ⇒ gửi lại không có).
  `generateContent` vẫn được hỗ trợ đầy đủ; Google giới thiệu Interactions API là mặc định cho dự
  án mới — nếu cần chuyển, chỉ sửa `providers/gemini.ts`.
- 429 / `RESOURCE_EXHAUSTED`: `quotaId` chứa `PerDay` ⇒ `quota` (không thử lại); có `quotaId` khác
  (ví dụ `PerMinute`) ⇒ `rate-limit`, chờ theo `RetryInfo.retryDelay`. Chỉ khi không có `quotaId`
  mới xét câu chữ ("per day", "daily", hết credit trả trước).
- JSON: `generationConfig.responseMimeType = "application/json"` + `responseJsonSchema` (JSON Schema
  chuẩn; tài liệu khuyên dùng thay cho `responseSchema` cũ).
- An toàn: `promptFeedback.blockReason` hoặc `finishReason ∈ {SAFETY, PROHIBITED_CONTENT, BLOCKLIST, SPII, RECITATION, …}` ⇒ `safety`.
- TTS: cùng endpoint với model TTS, `generationConfig.responseModalities = ["AUDIO"]`,
  `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName`. Model 3.8+ nhận phong cách đọc ở
  `parts[].speechMetadata.style` và đọc nguyên văn `text` (theo hướng dẫn chuyển đổi Gemini 3.8
  TTS); model cũ (2.5 / 3.1 preview) nhận phong cách trong lời nhắc ("Say the following in …: …").
  Nếu model báo không biết `speechMetadata`, adapter tự gửi lại kiểu cũ. Âm thanh ở
  `candidates[0].content.parts[].inlineData{mimeType,data}` (base64): WAV thì dùng luôn, PCM
  `audio/L16;rate=24000` (24 kHz, mono, 16-bit LE) thì bọc thành WAV.
  Lưu ý: tài liệu mới của Google trình bày TTS qua *Interactions API* (`/v1beta/interactions`), còn
  `generateContent` vẫn được hỗ trợ (tài liệu Vertex/Gemini Enterprise ghi rõ model 3.8 TTS phục vụ
  qua `generateContent`). Nếu sau này cần, có thể viết lại `tts()` theo Interactions API mà không
  đổi gì ở client.
- Danh sách model: `GET {base}/models?pageSize=1000` (lọc `supportedGenerationMethods` có `generateContent`).
- Kiểm tra kết nối: `GET {base}/models/{model}` (không tốn token).
- Model mặc định: văn bản **`gemini-3.6-flash`** (Google gọi là "thế hệ trước" nhưng vẫn dành cho
  production; nhanh, rẻ; gợi ý thêm `gemini-3.5-flash-lite`
  rẻ hơn, `gemini-3.8-flash` mới nhất). TTS **`gemini-3.8-flash-tts`** (gợi ý `gemini-3.8-flash-lite-tts`
  rẻ hơn), giọng mặc định `Kore` (30 giọng dựng sẵn, xem `GEMINI_VOICES`).
  Lưu ý: `gemini-2.5-flash` đã deprecated, tự chuyển hướng từ 2026-12-01.

### OpenAI

- Tài liệu: <https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create>,
  <https://developers.openai.com/api/reference/resources/audio/subresources/speech/methods/create>,
  <https://developers.openai.com/api/docs/models>.
- `POST https://api.openai.com/v1/chat/completions`, `Authorization: Bearer <key>`;
  `messages` (role `system` vẫn được chấp nhận), `max_completion_tokens` (thay `max_tokens` đã
  deprecated), `response_format: {type:'json_schema', json_schema:{name, schema, strict}}`
  (`strict: true` chỉ khi mọi thuộc tính đều `required`; mọi object có `additionalProperties:false`;
  gốc schema phải là object). Nếu máy chủ từ chối `response_format` ⇒ thử `json_object` ⇒ chỉ dùng
  lời nhắc. Nếu model từ chối `temperature` hoặc `reasoning_effort` ⇒ gửi lại không có tham số đó.
- `gpt-6-luna` là model suy luận (mặc định `reasoning.effort = medium`); `reasoning: 'off'` ⇒
  `reasoning_effort: 'none'`.
- 429: `Retry-After` không đọc được từ trình duyệt (mục 3) nên thời gian chờ lấy từ câu báo lỗi
  ("Please try again in 20s" / "in 1.2s" / "in 120ms").
  OpenAI khuyên dự án mới dùng Responses API; ở đây dùng Chat Completions vì OpenRouter, Ollama,
  LM Studio cùng hỗ trợ — một adapter cho cả nhóm.
- TTS: `POST /v1/audio/speech` `{model, input (≤ 4096 ký tự), voice, instructions, response_format:'mp3'}`.
  Model mặc định `gpt-4o-mini-tts`, giọng `marin`. **Mọi model của `/v1/audio/speech` (`tts-1`,
  `tts-1-hd`, `gpt-4o-mini-tts` và các bản snapshot) ngừng hoạt động ngày 2027-01-06**
  (<https://developers.openai.com/api/docs/deprecations>). Model thay thế OpenAI nêu tên,
  `gpt-realtime-2.1-mini`, **không** dùng được với `/v1/audio/speech` (trang text-to-speech ghi rõ)
  — nó chỉ chạy qua Realtime API (WebSocket/WebRTC), tức là cần một adapter khác hẳn, không phải
  đổi tên model. Vì vậy từ 2027-01-06 adapter OpenAI tự báo `capabilities.tts = false` và từ chối
  trước khi gửi (mã `model`, thông báo tiếng Việt giải thích); một lỗi 404 cho các model này cũng
  được giải thích như vậy. Gemini là nhà cung cấp TTS chính nên mặc định không bị ảnh hưởng. Nếu
  sau này muốn TTS của OpenAI: viết adapter Realtime API riêng, hoặc bỏ.
- Model văn bản mặc định: **`gpt-6-luna`** (trang models gợi ý cho khối lượng lớn, giá thấp).
- Kiểm tra kết nối: `GET /v1/models/{model}`.

### Anthropic Claude

- Tài liệu: <https://platform.claude.com/docs/en/api/messages>, <https://platform.claude.com/docs/en/api/errors>,
  <https://platform.claude.com/docs/en/api/versioning>, <https://platform.claude.com/docs/en/build-with-claude/structured-outputs>,
  <https://platform.claude.com/docs/en/manage-claude/authentication#browser-based-applications>,
  <https://platform.claude.com/docs/en/about-claude/models/overview>.
- `POST https://api.anthropic.com/v1/messages`, header `x-api-key`, `anthropic-version: 2026-10-21`,
  `anthropic-dangerous-direct-browser-access: true`, `content-type`. Body `{model, max_tokens, system, messages}`.
  Tài liệu xác thực hiện trình bày `Authorization: Bearer <key>` là cách chính và gọi `x-api-key`
  là cách cũ (vẫn được hỗ trợ; cả hai đều qua CORS). Adapter giữ `x-api-key`.
  Key **không gắn với một workspace** bắt buộc header `anthropic-workspace-id`; lỗi 400 đó được báo
  bằng tiếng Việt: tạo key mới chọn một workspace cụ thể (adapter không có trường workspace id).
  Phiên bản `2026-10-21` **đã bỏ** `temperature/top_p/top_k` (gửi là lỗi 400) nên không gửi.
- Suy nghĩ: Claude Haiku 5.5 mặc định *adaptive thinking* (effort mặc định `medium`), token suy nghĩ
  tính vào `max_tokens`. `reasoning: 'low'` ⇒ `output_config.effort: 'low'`; `'off'` ⇒ thêm
  `thinking: {type:'disabled'}` (Haiku 5.5 nhận ở effort ≤ high; Sonnet/Opus 5.5 trả 400 ⇒ adapter
  gửi lại chỉ với effort thấp).
- JSON: `output_config.format = {type:'json_schema', schema}` (GA, mọi object phải có
  `additionalProperties:false`; không hỗ trợ `minItems/maxItems` > 1 nên bị lược, kiểm tra cục bộ).
  Dự phòng khi API từ chối `output_config`: một công cụ duy nhất + `tool_choice:{type:'tool'}` (đọc
  `content[].tool_use.input`) — chỉ hữu ích với model cũ; nếu cả `tool_choice` ép buộc cũng bị từ
  chối (Opus/Sonnet 5.5 từ chối `tool`/`any` ở mọi yêu cầu) thì dùng lời nhắc + kiểm tra cục bộ.
- `stop_reason: 'refusal'` ⇒ `safety`; `'max_tokens'` ⇒ `truncated` (không có chữ, hoặc JSON ⇒
  `bad-response`). 529 ⇒ `server`. `Retry-After` đọc được (Anthropic expose mọi header).
- Không có TTS. Model mặc định **`claude-haiku-5-5`** (nhanh nhất, rẻ nhất).
- Kiểm tra kết nối: `GET /v1/models/{model}`.

### OpenRouter

- Tài liệu: <https://openrouter.ai/docs/api/reference/overview>.
- Giống OpenAI tại `https://openrouter.ai/api/v1`; dùng `max_tokens`; header ghi nguồn tùy chọn
  `X-OpenRouter-Title: Nghe Noi Am` (giá trị header phải là ASCII) và `HTTP-Referer` (chỉ khi
  chạy trên http/https). Lỗi có thể đến kèm HTTP 200 trong `error` hoặc `choices[0].error` — đã xử lý.
  402 ⇒ `quota`; lỗi kiểm duyệt (`error.metadata.reasons` / `flagged_input`) ⇒ `safety`; 403 khác
  (guardrail, key không có quyền với model/nhà cung cấp) ⇒ `bad-request` kèm giải thích — **không**
  báo "sai key" (sai key là 401). `reasoning: 'off'|'low'` ⇒ `reasoning: {effort: 'none'|'low'}`.
  OpenRouter chỉ gửi `Retry-After` dưới dạng header mà trình duyệt không đọc được, nên khi bị 429
  client dùng backoff của mình.
- Model mặc định **`google/gemini-3.6-flash`** (đã thấy trong `GET /api/v1/models` ngày 2026-11-06).
- Kiểm tra kết nối: `GET /api/v1/key` (danh sách model là công khai nên không kiểm tra được key).

### Máy chủ tương thích OpenAI (Ollama, LM Studio, vLLM…)

- Base URL mặc định `http://localhost:11434/v1` (Ollama); LM Studio thường là `http://localhost:1234/v1`.
- Key không bắt buộc (không gửi `Authorization` nếu để trống). Phải chọn model (ví dụ `qwen3`).
- Kiểm tra kết nối: `GET /models` và báo nếu model đã chọn không có trên máy chủ.
- Nhớ bật CORS (mục 3).

## 6. Dùng trong tính năng

```ts
import { aiJson, aiSpeak, aiStatus, isAiError } from '../../core/ai';

if (!aiStatus().configured) { /* hiện nút "Cài đặt AI" */ }

const result = await aiJson<{ sentences: string[] }>({
  system: 'You write short natural American English sentences for listening practice.',
  messages: [{ role: 'user', content: 'Give 5 sentences with "gonna".' }],
  maxTokens: 800,
  reasoning: 'off', // câu trả lời ngắn: đừng tiêu token vào "suy nghĩ"
  json: { name: 'sentences', schema: { type: 'object', properties: { sentences: { type: 'array', items: { type: 'string' }, minItems: 5, maxItems: 5 } }, required: ['sentences'] } },
  signal,
});

const { audio } = await aiSpeak('Whatcha gonna do?', { signal }); // Blob WAV/MP3, có cache
const url = URL.createObjectURL(audio);

try { /* ... */ } catch (e) { if (isAiError(e)) showToast(e.message); } // message đã là tiếng Việt, không chứa key
```
