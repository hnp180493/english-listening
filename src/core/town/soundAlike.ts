// "Thị trấn": what a careless ear could take a line for (docs/town.md §13). A wrong meaning offered next to the
// line's own is best when it is the meaning of something that SOUNDS nearly the same: then only real listening tells
// them apart, not reading. Two sources:
//
// - authored (data/townSoundAlikes): checked by hand, for the swaps no rule can write in Vietnamese (can ↔ can't,
//   want to ↔ won't, a dropped -ed, a light 'd …);
// - derived by rule, only where the Vietnamese swap is mechanical and safe:
//     him ↔ them (an h dropped: "tell him" ≈ "tell 'em"): the line's one "anh ấy" (ông ấy, cậu ấy …) ↔ its one "họ";
//     -teen ↔ -ty ("fifteen" ≈ "fifty"): the line's one "mười lăm" ↔ "năm mươi" (13…19 ↔ 30…90).
//
// Pure. Nothing here is shown in English or spoken: the learner only ever hears the line itself (no new audio), and
// a sound-alike is offered as its Vietnamese meaning. Which of them are offered, and how, is ./visit choicesFor.

import { NO_DERIVED, TOWN_SOUND_ALIKES } from '../../data/townSoundAlikes';
import type { SoundAlikeKind, TownLine } from './types';

export interface SoundAlike {
  kind: SoundAlikeKind;
  /** The English a careless ear hears instead: for checks and docs only, never shown or spoken. */
  heard: string;
  /** Its Vietnamese meaning (the wrong option). */
  vi: string;
  /** Derived by rule (true) or authored (false). */
  derived: boolean;
}

/**
 * How the difference sounds, in Vietnamese, for the note after a wrong pick ("Chỗ khác: …"). It names the sound, never
 * an English sentence that was not said.
 */
export const SOUND_ALIKE_LABEL: Readonly<Record<SoundAlikeKind, string>> = {
  can: 'có “không” hay không (can’t được nhấn và kéo dài hơn)',
  want: 'muốn hay sẽ không (won’t tròn môi, dài hơn)',
  ed: 'đuôi -ed rất nhẹ (chuyện đã xảy ra hay chưa)',
  d: 'âm ’d rất nhẹ',
  ll: 'âm ’ll rất nhẹ',
  pronoun: 'âm h bị nuốt (đang nói về ai)',
  number: 'số -teen hay -ty (-teen được nhấn, kéo dài)',
  nt: 'âm n’t rất nhẹ (có phủ định hay không)',
  have: 'âm have rất nhẹ (“lẽ ra đã”)',
  link: 'chỗ hai từ nối vào nhau',
};

/** The English of each kind, for the checks: the line or what is heard must show it. */
export const SOUND_ALIKE_SIGN: Readonly<Record<SoundAlikeKind, RegExp>> = {
  can: /\bcan(?:'t|not)?\b/i,
  want: /\bwant(?:s|ed)?\b|\bwon't\b/i,
  ed: /\b[a-z]{2,}ed\b/i,
  d: /\b[a-z]+'d\b/i,
  ll: /\b[a-z]+'ll\b/i,
  pronoun: /\b(?:him|her|his|them)\b/i,
  number: /\b(?:thir|four|fif|six|seven|eigh|nine)(?:teen|ty)\b/i,
  nt: /n't\b/i,
  have: /\b(?:should|could|would|must) have\b|\b[a-z]+'ve\b/i,
  link: /\b[a-z]+ (?:it|yet|a|an|up|out|on|in|of)\b/i,
};

// ───────────────────────── words ─────────────────────────

const words = (s: string): string[] =>
  s
    .normalize('NFC')
    .toLowerCase()
    .replace(/[‘’ʼ`]/g, "'")
    .split(/[^\p{L}\p{N}'-]+/u)
    .map((w) => w.replace(/^['-]+|['-]+$/g, ''))
    .filter(Boolean);

/** Word-level edit distance (insert, delete, replace). */
function wordDistance(a: readonly string[], b: readonly string[]): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = up;
    }
  }
  return prev[b.length];
}

/** At most this many words differ between a line and what a careless ear hears instead. */
export const MAX_HEARD_CHANGE = 3;

/**
 * `heard` is a near copy of `text`: 1 to MAX_HEARD_CHANGE words differ (case and punctuation aside). An authored entry
 * whose line was rewritten fails this and is no longer offered.
 */
export function closeVariant(text: string, heard: string): boolean {
  const d = wordDistance(words(text), words(heard));
  return d >= 1 && d <= MAX_HEARD_CHANGE;
}

// ───────────────────────── derived: him ↔ them ─────────────────────────

/** Vietnamese for "him" in the town's lines. */
const HIM_VI = ['anh ấy', 'ông ấy', 'cậu ấy', 'chú ấy', 'bác ấy', 'thằng bé'];
const THEM_VI = 'họ';
const OTHER_HE = new Set(['he', "he's", "he'll", "he'd", 'his', 'himself']);
const OTHER_THEY = new Set(['they', "they're", "they've", "they'll", "they'd", 'their', 'theirs', 'themselves']);

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** A phrase standing as whole words (Vietnamese letters included), case-insensitive. */
const phraseRe = (p: string): RegExp => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(p)}(?![\\p{L}\\p{N}])`, 'giu');
const countOf = (text: string, p: string): number => (text.normalize('NFC').match(phraseRe(p)) ?? []).length;

/** `text` with its one `from` replaced by `to`, keeping a capital first letter. */
function swapOnce(text: string, from: string, to: string): string {
  return text.normalize('NFC').replace(phraseRe(from), (m) => (m[0] !== m[0].toLowerCase() ? to[0].toUpperCase() + to.slice(1) : to));
}

function pronounSwap(line: Pick<TownLine, 'text' | 'vi'>): SoundAlike | null {
  const en = words(line.text);
  const him = en.filter((w) => w === 'him').length;
  const them = en.filter((w) => w === 'them').length;
  const he = en.some((w) => OTHER_HE.has(w));
  const they = en.some((w) => OTHER_THEY.has(w));
  const heVi = HIM_VI.map((p) => [p, countOf(line.vi, p)] as const).filter(([, n]) => n > 0);
  const heCount = heVi.reduce((s, [, n]) => s + n, 0);
  const themCount = countOf(line.vi, THEM_VI);
  if (him === 1 && them === 0 && !he && !they && heCount === 1 && themCount === 0) {
    return { kind: 'pronoun', heard: swapOnce(line.text, 'him', 'them'), vi: swapOnce(line.vi, heVi[0][0], THEM_VI), derived: true };
  }
  if (them === 1 && him === 0 && !he && !they && themCount === 1 && heCount === 0) {
    return { kind: 'pronoun', heard: swapOnce(line.text, 'them', 'him'), vi: swapOnce(line.vi, THEM_VI, 'anh ấy'), derived: true };
  }
  return null;
}

// ───────────────────────── derived: -teen ↔ -ty ─────────────────────────

/** [teen, ty, Vietnamese teen, Vietnamese ty]. */
const TEEN_TY: readonly (readonly [string, string, string, string])[] = [
  ['thirteen', 'thirty', 'mười ba', 'ba mươi'],
  ['fourteen', 'forty', 'mười bốn', 'bốn mươi'],
  ['fifteen', 'fifty', 'mười lăm', 'năm mươi'],
  ['sixteen', 'sixty', 'mười sáu', 'sáu mươi'],
  ['seventeen', 'seventy', 'mười bảy', 'bảy mươi'],
  ['eighteen', 'eighty', 'mười tám', 'tám mươi'],
  ['nineteen', 'ninety', 'mười chín', 'chín mươi'],
];

const DIGIT_WORDS = new Set(['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']);

function numberSwaps(line: Pick<TownLine, 'text' | 'vi'>): SoundAlike[] {
  const en = words(line.text);
  const out: SoundAlike[] = [];
  TEEN_TY.forEach(([teen, ty, teenVi, tyVi], i) => {
    const teenDigits = String(13 + i);
    const tyDigits = String((3 + i) * 10);
    for (const [from, to, fromVi, toVi, fromDigits, toDigits] of [
      [teen, ty, teenVi, tyVi, teenDigits, tyDigits],
      [ty, teen, tyVi, teenVi, tyDigits, teenDigits],
    ] as const) {
      // the English says it once, as a number of its own ("sixty-eight" or "fifty five" is not "fifty")
      const at = en.indexOf(from);
      if (at < 0 || en.lastIndexOf(from) !== at || DIGIT_WORDS.has(en[at + 1] ?? '')) continue;
      // and the Vietnamese once, in words or in digits
      const asWords = countOf(line.vi, fromVi);
      const asDigits = countOf(line.vi, fromDigits);
      if (asWords + asDigits !== 1) continue;
      const vi = asWords === 1 ? swapOnce(line.vi, fromVi, toVi) : swapOnce(line.vi, fromDigits, toDigits);
      out.push({ kind: 'number', heard: swapOnce(line.text, from, to), vi, derived: true });
    }
  });
  return out;
}

// ───────────────────────── a line's sound-alikes ─────────────────────────

const cache = new Map<string, readonly SoundAlike[]>();
const MAX_CACHE = 4000;

/**
 * The sound-alikes of a line: its authored ones that still apply (their `heard` is a near copy of the line), then
 * the derived ones (unless the line is in NO_DERIVED), without two of the same meaning or one that reads as the
 * line's own. Cached by (id, text, vi). Whether a meaning is fair next to the right one is ./visit's call (nearSame).
 */
export function soundAlikesOf(line: Pick<TownLine, 'id' | 'text' | 'vi'>): readonly SoundAlike[] {
  const key = `${line.id}\u0000${line.text}\u0000${line.vi}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const out: SoundAlike[] = [];
  const seen = new Set<string>([line.vi.trim().toLowerCase()]);
  const add = (s: SoundAlike): void => {
    const k = s.vi.trim().toLowerCase();
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(s);
  };
  const authored = Object.prototype.hasOwnProperty.call(TOWN_SOUND_ALIKES, line.id) ? TOWN_SOUND_ALIKES[line.id] : [];
  for (const s of authored) if (closeVariant(line.text, s.heard)) add({ ...s, derived: false });
  if (!NO_DERIVED.has(line.id)) {
    const p = pronounSwap(line);
    if (p && closeVariant(line.text, p.heard)) add(p);
    for (const n of numberSwaps(line)) if (closeVariant(line.text, n.heard)) add(n);
  }
  if (cache.size >= MAX_CACHE) cache.clear();
  cache.set(key, out);
  return out;
}
