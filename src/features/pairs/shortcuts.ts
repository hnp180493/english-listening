// Keyboard shortcuts of a pairs round, listed only in the header's ShortcutsHelp (kept out of .tsx for fast refresh).

import type { Shortcut } from '../../components/ShortcutsHelp';
import type { ShortcutAction } from '../../core/shortcuts';

/** The shared practice keys a pairs round answers (core/shortcuts.ts). */
export const PAIRS_SHARED: readonly ShortcutAction[] = ['replay', 'slow', 'skip'];

export const PAIRS_SHORTCUTS: readonly Shortcut[] = [
  { keys: ['1–3'], text: 'Chọn đáp án; sau khi trả lời: nghe từng câu' },
  { keys: ['R'], text: 'Nghe lại câu' },
  { keys: ['S'], text: 'Nghe chậm' },
  { keys: ['Enter'], text: 'Câu tiếp (hoặc Space)' },
];
