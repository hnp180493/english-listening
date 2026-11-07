// Vietnamese labels shared by the drill components (kept out of .tsx files for fast refresh).

import type { Shortcut } from '../../components/ShortcutsHelp';
import type { CardStatus, Grade } from '../../core/srs';

export const GRADE_LABEL: Record<Grade, string> = {
  again: 'Lại',
  hard: 'Khó',
  good: 'Được',
  easy: 'Dễ',
};

export const STATUS_LABEL: Record<CardStatus, string> = {
  new: 'Mới',
  learning: 'Đang học',
  mature: 'Thuộc',
};

/** The drill's keyboard shortcuts, listed only in the header's ShortcutsHelp. */
export const DRILL_SHORTCUTS: readonly Shortcut[] = [
  { keys: ['Enter'], text: 'Kiểm tra câu trả lời đã gõ' },
  { keys: ['Shift', 'Enter'], text: 'Không biết, xem đáp án' },
  { keys: ['Esc'], text: 'Nghe lại (cả khi đang gõ)' },
  { keys: ['R'], text: 'Nghe lại cụm / câu' },
  { keys: ['C'], text: 'Nghe câu ví dụ' },
  { keys: ['1–4'], text: 'Chọn đáp án, hoặc tự chấm: Lại · Khó · Được · Dễ' },
];
