// Pure helpers for the Settings page.

import type { VoiceEngine } from '../../core/settings';
import { baseUrlAllowed } from '../../core/ai/defaults';
import { NORMAL_RATE_MIN } from '../../core/dictation/listens';
import type { ProviderKind } from '../../core/ai/types';

export const RATE_MIN = 0.5;
export const RATE_MAX = 1.5;
export const RATE_STEP = 0.05;

/** Voice names that usually sound most natural (neural / cloud voices). */
export function isRecommendedVoice(name: string): boolean {
  return /natural|neural|online|google/i.test(name);
}

export interface VoiceLike {
  name: string;
  lang: string;
  voiceURI: string;
}

/** Recommended first, then en-US, then other English, then by name. */
export function sortVoices<T extends VoiceLike>(voices: readonly T[]): T[] {
  const langRank = (l: string) => (l === 'en-US' ? 0 : l === 'en-GB' ? 1 : 2);
  return [...voices].sort((a, b) => {
    const ra = isRecommendedVoice(a.name) ? 0 : 1;
    const rb = isRecommendedVoice(b.name) ? 0 : 1;
    if (ra !== rb) return ra - rb;
    const la = langRank(a.lang);
    const lb = langRank(b.lang);
    if (la !== lb) return la - lb;
    return a.name.localeCompare(b.name);
  });
}

/** "Microsoft Aria Online (Natural) - English (United States)" → shorter display name. */
export function voiceDisplayName(name: string): string {
  return name.replace(/\s+-\s+English.*$/i, '').trim() || name;
}

const LANG_LABEL: Record<string, string> = {
  'en-US': 'Mỹ',
  'en-GB': 'Anh',
  'en-AU': 'Úc',
  'en-CA': 'Canada',
  'en-IN': 'Ấn Độ',
  'en-IE': 'Ireland',
  'en-NZ': 'New Zealand',
  'en-ZA': 'Nam Phi',
};

export function accentLabel(lang: string): string {
  const norm = lang.replace('_', '-');
  return LANG_LABEL[norm] ?? norm;
}

/** Clamp a stored rate to the slider range and snap it to the 0.05 grid. */
export function clampRate(r: unknown): number {
  if (typeof r !== 'number' || !Number.isFinite(r)) return 1;
  const snapped = Math.round(r / RATE_STEP) * RATE_STEP;
  return Math.min(RATE_MAX, Math.max(RATE_MIN, Number(snapped.toFixed(2))));
}

/** Vietnamese number style: comma as decimal separator, e.g. 0,75× / 1× / 1,1×. */
export function formatRate(r: number): string {
  return `${String(Number(r.toFixed(2))).replace('.', ',')}×`;
}

/** "tốc độ thường" starts at NORMAL_RATE_MIN: below it dictation counts "Nghe" as a slowed play (core/dictation/listens). */
export function rateHint(r: number): string {
  if (r < 0.8) return 'chậm, dễ nghe';
  if (r < NORMAL_RATE_MIN) return 'hơi chậm';
  if (r <= 1.05) return 'tốc độ thường';
  if (r <= 1.25) return 'nhanh hơn bình thường';
  return 'rất nhanh, để luyện tai';
}

/** Rough minutes per day for a goal: one attempt ≈ 20–30 seconds. */
export function goalMinutes(goal: number): number {
  return Math.max(5, Math.round((goal * 25) / 60 / 5) * 5);
}

export function goalHint(goal: number): string {
  if (goal <= 20) return 'Nhẹ nhàng';
  if (goal <= 45) return 'Đều đặn';
  if (goal <= 70) return 'Chăm chỉ';
  return 'Tăng tốc';
}

/** "6/11/2026 lúc 09:05" */
export function formatDateTimeVi(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} lúc ${hh}:${mm}`;
}


/** Goal presets for the Segmented control; a custom goal (set with the slider) is shown as its own segment. */
export function goalOptions(presets: readonly number[], goal: number): number[] {
  const list = presets.filter((g) => Number.isFinite(g));
  if (!Number.isFinite(goal) || list.includes(goal)) return list;
  return [...list, goal].sort((a, b) => a - b);
}

/** Option text of the daily real-listening goal: "Tắt" for 0, "30 phút", "1 giờ 30 phút". */
export function listenGoalLabel(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return 'Tắt';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m} phút`;
  return m === 0 ? `${h} giờ` : `${h} giờ ${m} phút`;
}

// ───────────────────────── AI section ─────────────────────────

/** 1234567 → "1.234.567" (Vietnamese thousands separator). */
export function formatCountVi(n: number): string {
  const v = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/**
 * Today's AI usage in one line: "Hôm nay: 12 yêu cầu · 1.234 ký tự giọng đọc · 5 lần nghe lại miễn phí".
 * Zero parts are left out; nothing used yet → "Hôm nay chưa dùng.". With a cap: "12/200 yêu cầu".
 */
export function aiUsageLine(total: { requests: number; ttsChars: number; cacheHits: number }, cap?: number): string {
  const parts: string[] = [];
  const req = Math.max(0, Math.floor(total.requests || 0));
  if (req > 0 || cap) parts.push(cap ? `${formatCountVi(req)}/${formatCountVi(cap)} yêu cầu` : `${formatCountVi(req)} yêu cầu`);
  if (total.cacheHits > 0) parts.push(`${formatCountVi(total.cacheHits)} lần nghe lại miễn phí`);
  return parts.length ? `Hôm nay: ${parts.join(' · ')}` : 'Hôm nay chưa dùng.';
}

/**
 * The daily-cap field: '' or 0 → undefined (no cap); a positive number → whole number capped at 100000;
 * anything else → null (invalid, keep the stored value).
 */
export function parseDailyCap(input: string): number | undefined | null {
  const s = input.trim();
  if (s === '') return undefined;
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  if (n === 0) return undefined;
  return Math.min(100000, n);
}

/** Model picker options: the current model, the kind's suggestions, then the listed TEXT models; unique, order kept. */
export function modelChoices(current: string, suggested: readonly string[], listed: readonly { id: string; kind: 'text' | 'tts' }[]): string[] {
  const out: string[] = [];
  const add = (m: string) => {
    const id = m.trim();
    if (id && !out.includes(id)) out.push(id);
  };
  add(current);
  suggested.forEach(add);
  listed.filter((m) => m.kind === 'text').forEach((m) => add(m.id));
  return out;
}

/** True when the AI config would accept this base URL for this provider kind (see core/ai baseUrlAllowed). */
export function isValidBaseUrl(s: string, kind: ProviderKind): boolean {
  return baseUrlAllowed(kind, s);
}

/** Gemini prebuilt voices: Google's one-word character of each voice, in Vietnamese (for the voice picker). */
const GEMINI_VOICE_STYLE: Record<string, string> = {
  Zephyr: 'tươi sáng',
  Puck: 'vui tươi',
  Charon: 'rõ ràng, kiểu thuyết minh',
  Kore: 'chắc giọng',
  Fenrir: 'hào hứng',
  Leda: 'trẻ trung',
  Orus: 'chắc giọng',
  Aoede: 'nhẹ nhàng',
  Callirrhoe: 'thoải mái',
  Autonoe: 'tươi sáng',
  Enceladus: 'nhiều hơi',
  Iapetus: 'trong, rõ',
  Umbriel: 'thoải mái',
  Algieba: 'mượt',
  Despina: 'mượt',
  Erinome: 'trong, rõ',
  Algenib: 'hơi khàn',
  Rasalgethi: 'rõ ràng, kiểu thuyết minh',
  Laomedeia: 'vui tươi',
  Achernar: 'mềm',
  Alnilam: 'chắc giọng',
  Schedar: 'đều đều',
  Gacrux: 'trầm, chín chắn',
  Pulcherrima: 'dứt khoát',
  Achird: 'thân thiện',
  Zubenelgenubi: 'tự nhiên, thân mật',
  Vindemiatrix: 'dịu dàng',
  Sadachbia: 'sôi nổi',
  Sadaltager: 'điềm đạm, hiểu biết',
  Sulafat: 'ấm',
};

/** Vietnamese character of a Gemini voice ('' when unknown). */
export function geminiVoiceStyle(voice: string): string {
  return Object.prototype.hasOwnProperty.call(GEMINI_VOICE_STYLE, voice) ? GEMINI_VOICE_STYLE[voice] : '';
}

/** Labels of the voice choice (Cài đặt → Giọng đọc), by Settings.voiceEngine. */
export const VOICE_CHOICE_LABEL: Readonly<Record<VoiceEngine, string>> = {
  clips: 'Giọng Gemini có sẵn (mặc định)',
  ai: 'Giọng Gemini có sẵn + Gemini qua key (tốn phí)',
  browser: 'Giọng trình duyệt',
};

/** Hint under the voice choice: what reads the built-in sentences, and what reads the others (and whether it costs). */
export function voiceChoiceHint(engine: VoiceEngine, aiCanSpeak: boolean): string {
  if (engine === 'browser') return 'Mọi câu đọc bằng giọng có sẵn của trình duyệt.';
  const builtIn = 'Câu có sẵn trong app đã có giọng Gemini, không cần key, không tốn phí.';
  if (engine === 'clips') return `${builtIn} Câu khác (bạn tự gõ, AI tạo) đọc bằng giọng trình duyệt bên dưới.`;
  return aiCanSpeak
    ? `${builtIn} Câu khác (bạn tự gõ, AI tạo) đọc bằng Gemini qua key của bạn: mỗi câu mới tốn một yêu cầu.`
    : `${builtIn} Chưa có key Gemini đọc được, nên câu khác đọc bằng giọng trình duyệt bên dưới.`;
}
