// "Độ khó là lời nói" (docs/gta-plan.md §4.9, §11.3, §19): five levels of how a Westbay job and Rico's dispatch office
// SPEAK, made only of what the voices we have can really do: the speed (a factor on the learner's own Tốc độ đọc,
// never a speed of its own), how many repeats are free before they cost, how long the people wait, how many look-alikes
// a notebook offers (3 → 4), from how far a talk can be overheard, how broken a line over a bad radio is, and at the top
// two talks going on at once. NEVER noise mixed over the words (decided in §11.5). An accent is who speaks, not a
// setting.
//
// The level follows the learner (per learner, not per browser: kept in town-jobs, core/town/jobProgress.ts `speech`),
// as Emma's counter does (core/town/cafe.ts: learning is fastest near 85% right): a slow average of what was heard right
// the first time, a level up when it stays well above 85%, down when it falls well below, never two levels at once,
// never more than one change a run, and only after enough lines since the last change. The learner may pin a level
// instead ("Tự động" is the default). The level is a game's setting, never a measure of the learner's English.
//
// Pure: the store is ./jobsStore.ts (speechLevelNow, recordSpeechRun, pinSpeechLevel).

export type SpeechLevel = 1 | 2 | 3 | 4 | 5;
export const SPEECH_LEVELS: readonly SpeechLevel[] = [1, 2, 3, 4, 5];
/** Where a learner starts: the jobs as they were written. */
export const SPEECH_START: SpeechLevel = 3;

export interface SpeechRules {
  /** A factor on the learner's own speed (Settings.rate). */
  rate: number;
  /** "Xin nhắc lại" free before the speaker's patience line (added to what the job allows, minus one). */
  freeRepeats: number;
  /** A factor on how long people wait: a deadline to get somewhere, a caller ringing, a passenger. */
  patience: number;
  /** Look-alikes of a time in the notebook. */
  lookAlikes: 3 | 4;
  /** A factor on the distances of overhearing (far = heard from further, and noticed only nearer). */
  hearFar: number;
  /** A line over a bad radio: whole, every other break, as written, or a break at every comma too. */
  breaks: 'none' | 'fewer' | 'written' | 'more';
  /** Several talks at once heard together (switching), or one after another. */
  together: boolean;
  /** Before talks at once start, a moment to choose (ms). */
  leadMs: number;
  /** A factor on a job's or a shift's pay (a harder level pays more). */
  pay: number;
}

/** The ladder (every number a guess until somebody plays it: docs/gta-plan.md §19). */
export const SPEECH_RULES: Readonly<Record<SpeechLevel, SpeechRules>> = {
  1: { rate: 0.85, freeRepeats: 3, patience: 1.5, lookAlikes: 3, hearFar: 1.3, breaks: 'none', together: false, leadMs: 3000, pay: 0.85 },
  2: { rate: 0.92, freeRepeats: 2, patience: 1.25, lookAlikes: 3, hearFar: 1.15, breaks: 'fewer', together: false, leadMs: 3000, pay: 0.92 },
  3: { rate: 1, freeRepeats: 1, patience: 1, lookAlikes: 3, hearFar: 1, breaks: 'written', together: true, leadMs: 3000, pay: 1 },
  4: { rate: 1.06, freeRepeats: 0, patience: 0.85, lookAlikes: 4, hearFar: 0.9, breaks: 'written', together: true, leadMs: 1500, pay: 1.1 },
  5: { rate: 1.12, freeRepeats: 0, patience: 0.7, lookAlikes: 4, hearFar: 0.8, breaks: 'more', together: true, leadMs: 0, pay: 1.2 },
};

export const isSpeechLevel = (v: unknown): v is SpeechLevel => v === 1 || v === 2 || v === 3 || v === 4 || v === 5;

/** A broken-up line's pieces at a level (pieces are said with a silence between). */
export function brokenPieces(text: string, breaks: SpeechRules['breaks']): string[] {
  const written = text.split(/\s*\.\.\.\s*/).filter((x) => /[a-z0-9]/i.test(x));
  if (breaks === 'none') return [written.join(' ')];
  if (breaks === 'fewer') {
    const out: string[] = [];
    for (let i = 0; i < written.length; i += 2) out.push(written.slice(i, i + 2).join(' '));
    return out;
  }
  if (breaks === 'written') return written;
  return written.flatMap((p) => p.split(/,\s*/).filter((x) => /[a-z0-9]/i.test(x)));
}

// ───────────────────────── following the learner ─────────────────────────

/** The aim: about 85% heard right the first time. */
export const SPEECH_AIM = 0.85;
/** How much one line moves the average (a slow average: about the last twenty lines). */
export const SPEECH_ALPHA = 0.05;
/** A level up only above this, down only below this (wide around the aim, so a learner at 85% stays put). */
export const SPEECH_UP_AT = 0.95;
export const SPEECH_DOWN_AT = 0.72;
/** Lines heard since the last change before another change. */
export const SPEECH_SETTLE = 12;

export interface SpeechAuto {
  level: SpeechLevel;
  /** The slow average of right-first-time. */
  acc: number;
  /** Lines since the level last changed. */
  since: number;
  /** When this was last written (ms): two copies merge by it. */
  at: number;
}

export interface SpeechState {
  auto: SpeechAuto;
  /** A level the learner pinned (null: automatic), and when they chose (ms). */
  pin: { level: SpeechLevel | null; changedAt: number };
}

export const emptySpeech = (): SpeechState => ({ auto: { level: SPEECH_START, acc: SPEECH_AIM, since: 0, at: 0 }, pin: { level: null, changedAt: 0 } });

/** The level played now: the pinned one, else the automatic one. */
export const speechLevelOf = (s: SpeechState): SpeechLevel => s.pin.level ?? s.auto.level;

/**
 * A run is over (a job, a dispatch shift): its lines, each heard right the first time or not, move the average; then
 * the level moves one step at most, and only once the run's lines are counted (never two levels, never during a run).
 * (The store does not record a run played at a pinned level: what was heard at a level the learner chose says nothing
 * about the automatic one.)
 */
export function speechAfter(s: SpeechState, results: readonly boolean[], now: number): SpeechState {
  if (results.length === 0) return s;
  let acc = Number.isFinite(s.auto.acc) ? s.auto.acc : SPEECH_AIM;
  for (const r of results) acc += SPEECH_ALPHA * ((r ? 1 : 0) - acc);
  let { level } = s.auto;
  let since = s.auto.since + results.length;
  if (since >= SPEECH_SETTLE) {
    if (acc > SPEECH_UP_AT && level < 5) {
      level = (level + 1) as SpeechLevel;
      since = 0;
      acc = SPEECH_AIM;
    } else if (acc < SPEECH_DOWN_AT && level > 1) {
      level = (level - 1) as SpeechLevel;
      since = 0;
      acc = SPEECH_AIM;
    }
  }
  return { ...s, auto: { level, acc: Math.round(acc * 1000) / 1000, since: Math.min(since, 999), at: Math.round(now) } };
}

/** The learner pins a level (or lifts the pin with null). */
export const pinSpeech = (s: SpeechState, level: SpeechLevel | null, now: number): SpeechState => ({ ...s, pin: { level, changedAt: Math.round(now) } });

/** Anything stored into a clean state (junk: the start). */
export function parseSpeech(raw: unknown): SpeechState {
  const out = emptySpeech();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const r = raw as Record<string, unknown>;
  const a = r.auto as Record<string, unknown> | undefined;
  if (a && typeof a === 'object' && isSpeechLevel(a.level)) {
    const acc = typeof a.acc === 'number' && a.acc >= 0 && a.acc <= 1 ? a.acc : SPEECH_AIM;
    const since = typeof a.since === 'number' && a.since >= 0 ? Math.min(999, Math.floor(a.since)) : 0;
    const at = typeof a.at === 'number' && a.at > 0 ? Math.round(a.at) : 0;
    out.auto = { level: a.level, acc, since, at };
  }
  const p = r.pin as Record<string, unknown> | undefined;
  if (p && typeof p === 'object') {
    const changedAt = typeof p.changedAt === 'number' && p.changedAt > 0 ? Math.round(p.changedAt) : 0;
    out.pin = { level: isSpeechLevel(p.level) ? p.level : null, changedAt };
  }
  return out;
}

/** Two copies into one: each part by its own time (the automatic one by when it was written, the pin by when it was chosen). */
export function mergeSpeech(a: SpeechState, b: SpeechState): SpeechState {
  const later = <T extends object>(x: T, y: T, tx: number, ty: number): T => (tx > ty ? x : ty > tx ? y : JSON.stringify(x) >= JSON.stringify(y) ? x : y);
  return { auto: later(a.auto, b.auto, a.auto.at, b.auto.at), pin: later(a.pin, b.pin, a.pin.changedAt, b.pin.changedAt) };
}
