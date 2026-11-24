// The shared practice keys on a dictation exercise ("Cả câu", "Điền từ", Ôn tập's dictation cards): they work while
// the cursor is in the answer box (core/shortcuts.ts). "Rõ từng từ" only after the check (before, it would give the
// sentence away); "Bỏ qua" before the check, "câu tiếp" after it (with the same guard as Enter).

import type { RefObject } from 'react';
import { useShortcuts } from '../../components/useShortcuts';
import { NEXT_GUARD_MS } from './constants';
import type { Player } from './usePlayer';

export function useDictationKeys(o: {
  player: Player;
  rootRef: RefObject<HTMLElement | null>;
  /** The answer has been checked (time of the check in `checkedAtRef`). */
  checked: boolean;
  checkedAtRef: RefObject<number>;
  /** Show the hint; undefined when it is already shown (the key then does nothing). */
  hint?: () => void;
  onSkip: () => void;
  onNext: () => void;
}): void {
  const { player, checked } = o;
  useShortcuts(
    {
      replay: () => void player.play('normal', false),
      slow: () => void player.play('slow', false),
      chunks: () => void player.play('chunks', false),
      careful: () => (checked ? void player.play('careful', false) : false),
      hint: () => (!checked && o.hint ? o.hint() : false),
      skip: () => {
        if (!checked) return o.onSkip();
        if (Date.now() - (o.checkedAtRef.current ?? 0) < NEXT_GUARD_MS) return;
        o.onNext();
      },
    },
    { root: o.rootRef },
  );
}
