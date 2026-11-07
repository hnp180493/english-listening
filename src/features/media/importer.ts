// Turn pasted / uploaded transcript text into a preview of practice units.

import { parseTranscriptDetailed, type TranscriptFormat } from '../../core/media/transcript';
import { toSentences, unitsDuration, type PracticeUnit } from '../../core/media/sentences';
import { MAX_TRANSCRIPT_BYTES, byteLength } from './library';

export const FORMAT_LABEL: Record<TranscriptFormat, string> = {
  youtube: 'Bản chép lời YouTube',
  srt: 'Phụ đề SRT',
  vtt: 'Phụ đề WebVTT',
  unknown: 'Không rõ định dạng',
};

export interface ImportPreview {
  ok: boolean;
  format: TranscriptFormat;
  cueCount: number;
  units: PracticeUnit[];
  duration: number; // seconds of speech covered
  error?: string;
  warning?: string;
}

const EMPTY: ImportPreview = { ok: false, format: 'unknown', cueCount: 0, units: [], duration: 0 };

export function formatKB(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function previewTranscript(text: string): ImportPreview {
  if (!text || !text.trim()) return EMPTY;
  const size = byteLength(text);
  if (size > MAX_TRANSCRIPT_BYTES) {
    return {
      ...EMPTY,
      error: `Bản chép lời quá lớn (${formatKB(size)}). Giới hạn là ${formatKB(MAX_TRANSCRIPT_BYTES)} — hãy chia video dài thành nhiều phần.`,
    };
  }
  const { format, cues } = parseTranscriptDetailed(text);
  if (format === 'unknown') {
    return {
      ...EMPTY,
      error:
        'Không tìm thấy mốc thời gian. Hãy dán nguyên văn bản chép lời có các dòng giờ như “0:05”, hoặc dùng tệp phụ đề .srt / .vtt.',
    };
  }
  const units = toSentences(cues);
  if (units.length === 0) {
    return {
      ...EMPTY,
      format,
      cueCount: cues.length,
      error: 'Đọc được mốc thời gian nhưng không có lời nói nào (có thể toàn [Music] hoặc lời bài hát).',
    };
  }
  const withPunct = units.filter((u) => /[.?!]["'”’)]?$/.test(u.text)).length;
  const warning =
    units.length >= 4 && withPunct / units.length < 0.3
      ? 'Phụ đề này gần như không có dấu câu (thường là phụ đề tự động). Câu sẽ được chia theo khoảng ngừng nên có thể chưa tròn ý, và chữ có thể sai.'
      : undefined;
  return { ok: true, format, cueCount: cues.length, units, duration: unitsDuration(units), ...(warning ? { warning } : {}) };
}

/**
 * Decode a subtitle file's bytes: UTF-8 (with or without BOM), UTF-16 LE/BE with BOM, and
 * old Windows-1252 SRT files (accented names like "café" would otherwise turn into "caf�").
 */
export function decodeTextBytes(bytes: Uint8Array): string {
  const tryDecode = (label: string, fatal: boolean): string | null => {
    try {
      return new TextDecoder(label, { fatal }).decode(bytes);
    } catch {
      return null;
    }
  };
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return tryDecode('utf-16le', false) ?? '';
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) return tryDecode('utf-16be', false) ?? '';
  return tryDecode('utf-8', true) ?? tryDecode('windows-1252', false) ?? tryDecode('utf-8', false) ?? '';
}
