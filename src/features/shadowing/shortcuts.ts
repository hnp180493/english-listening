// Keyboard shortcuts of the practice panel, listed only in the header's ShortcutsHelp (kept out of .tsx files).

import type { Shortcut } from '../../components/ShortcutsHelp';

export const SHADOW_SHORTCUTS: readonly Shortcut[] = [
  { keys: ['M'], text: 'Ghi âm / dừng' },
  { keys: ['R'], text: 'Nghe mẫu (L cũng được)' },
  { keys: ['S'], text: 'Nghe chậm 0.8×' },
  { keys: ['N'], text: 'Câu tiếp' },
  { keys: ['Esc'], text: 'Dừng mọi âm thanh' },
];
