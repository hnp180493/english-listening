import type { Phenomenon } from './types';

export interface PhenomenonInfo {
  label: string; // Vietnamese short label
  en: string; // English term
  color: string; // CSS variable name holding the color, e.g. "var(--ph-linking)"
  summary: string; // one-line Vietnamese explanation
  example: { written: string; spoken: string };
}

export const PHENOMENON_INFO: Record<Phenomenon, PhenomenonInfo> = {
  linking: {
    label: 'Nối âm',
    en: 'Linking',
    color: 'var(--ph-linking)',
    summary: 'Phụ âm cuối của từ trước dính sang nguyên âm đầu của từ sau, nghe như một từ.',
    example: { written: 'come on', spoken: 'cu-mon' },
  },
  elision: {
    label: 'Nuốt âm',
    en: 'Elision',
    color: 'var(--ph-elision)',
    summary: 'Âm (thường là /t/, /d/) bị bỏ hẳn khi kẹp giữa hai phụ âm.',
    example: { written: 'next day', spoken: 'nex day' },
  },
  assimilation: {
    label: 'Đồng hóa âm',
    en: 'Assimilation',
    color: 'var(--ph-assimilation)',
    summary: 'Hai âm cạnh nhau biến thành âm khác, ví dụ /t/ + /j/ thành /tʃ/.',
    example: { written: 'meet you', spoken: 'mee-chu' },
  },
  'weak-form': {
    label: 'Âm yếu',
    en: 'Weak form',
    color: 'var(--ph-weak)',
    summary: 'Từ chức năng không nhấn (to, and, of, can…) bị đọc lướt thành /ə/.',
    example: { written: 'cup of tea', spoken: 'cup-ə tea' },
  },
  'flap-t': {
    label: 'T bật (giọng Mỹ)',
    en: 'Flap T',
    color: 'var(--ph-flap)',
    summary: '/t/ hoặc /d/ giữa hai nguyên âm đọc nhanh thành âm gần giống /d/ nhẹ.',
    example: { written: 'get it', spoken: 'ge-dit' },
  },
  reduction: {
    label: 'Rút gọn',
    en: 'Reduction',
    color: 'var(--ph-reduction)',
    summary: 'Cả cụm từ quen thuộc bị nén lại thành dạng ngắn.',
    example: { written: 'going to', spoken: 'gonna' },
  },
  'h-dropping': {
    label: 'Mất âm H',
    en: 'H-dropping',
    color: 'var(--ph-h)',
    summary: 'Âm /h/ trong he, him, her, his, have không nhấn bị bỏ và nối với từ trước.',
    example: { written: 'tell him', spoken: 'tel-lim' },
  },
  contraction: {
    label: 'Viết tắt',
    en: 'Contraction',
    color: 'var(--ph-contraction)',
    summary: 'Hai từ gộp lại thành một (I am → I’m), dễ nghe nhầm hoặc bỏ sót.',
    example: { written: 'I would', spoken: 'I’d' },
  },
};
