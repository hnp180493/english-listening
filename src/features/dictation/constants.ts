// Small shared constants for the dictation UI.

/** After checking, ignore Enter for a moment so a double-tap / held Enter does not skip the result. */
export const NEXT_GUARD_MS = 450;

export const LEVEL_LABEL: Record<number, string> = { 1: 'Dễ', 2: 'Vừa', 3: 'Khó' };

/** Topic filter value meaning "my own sentences". */
export const MINE_TOPIC = '__mine__';
