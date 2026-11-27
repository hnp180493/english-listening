// The pirate station, 91.5 (docs/gta-story-3.md §7 item 6, docs/town.md §25): when the channel is on, which segment it
// plays, and the rules a forgery breaks. Pure.
//
// The channel is on while Act III is: from "Tin nhắn không phải của Rico" (`job-forged`) done until "Phát sóng trực
// tiếp" (`job-live`) done; after it the channel is silent and says why by the ending the live broadcast left
// (`job-live:end-best` / `end-middle` / `end-worst`). The admin sandbox has it on. Nothing is stored: it reads the
// synced `town-jobs`, and a segment heard is a radio scene of the day (`fm-pirate-<n>` in the day's `heard`, paid in the
// radio's own daily allowance: core/town/world.ts scenePay, so no new source of xu).
//
// FINGERPRINT is the bible's table §2 as checks over the words: each rule finds what that person never says (or a fact
// that has gone old). core/town/pirate.test.ts proves every forged segment breaks exactly one rule, its own tell, and
// every real one breaks none.

import type { PirateSegment } from '../../data/scenes/pirate';
import { jobDone, pastFlag, type TownJobs } from './jobProgress';

export type PirateState = 'off' | 'on' | 'ended';
export type PirateEnding = 'best' | 'middle' | 'worst' | 'none';

/** Whether the channel plays (admin: always on). */
export function pirateState(jobs: TownJobs, admin = false): PirateState {
  if (admin) return 'on';
  if (jobDone(jobs, 'job-live')) return 'ended';
  return jobDone(jobs, 'job-forged') ? 'on' : 'off';
}

/** How the live broadcast ended (its flag), for the silent channel's line. */
export function pirateEnding(jobs: TownJobs): PirateEnding {
  for (const e of ['best', 'middle', 'worst'] as const) if (pastFlag(jobs, `job-live:end-${e}`)) return e;
  return 'none';
}

/** The segments that may play now: those whose fact has already gone old (`needs` done; all in the sandbox). */
export function pirateSegments(all: readonly PirateSegment[], jobs: TownJobs, admin = false): PirateSegment[] {
  return all.filter((s) => admin || !s.needs || jobDone(jobs, s.needs));
}

/**
 * The segment the channel plays now: one not heard lately (`recent`: scene ids heard on the last days) if any, else any;
 * among them by the hour of the game, so the same edition plays for a while and the next one differs. Null with none.
 */
export function pirateNow(segments: readonly PirateSegment[], recent: ReadonlySet<string>, now: number): PirateSegment | null {
  if (segments.length === 0) return null;
  const fresh = segments.filter((s) => !recent.has(s.id));
  const pool = fresh.length > 0 ? fresh : segments;
  const hour = Math.floor(now / 120_000);
  return pool[((hour % pool.length) + pool.length) % pool.length];
}

/** One rule of the fingerprint table (gta-story-3 §2): `re` finds the words that break it. */
export interface FingerRule {
  id: string;
  /** Whose rule (a row of the table). */
  as: string;
  re: RegExp;
  /** A fact that has gone old (a cut tape's tell), not a habit. */
  old?: true;
}

export const FINGERPRINT: readonly FingerRule[] = [
  // Rico (§2.1): the half hour is "half nine", never "nine thirty"; never "dear", never "Goodnight"
  { id: 'rico-thirty', as: 'rico', re: /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve) thirty\b/i },
  { id: 'rico-dear', as: 'rico', re: /\bdear\b/i },
  { id: 'rico-goodnight', as: 'rico', re: /\bgoodnight\b/i },
  // the firm's code since "Sam không gọi điện": channel fourteen, the station is "Biscuit" (docs/city.md §21)
  { id: 'rico-chip', as: 'rico', re: /\bChip\b/, old: true },
  { id: 'rico-thirteen', as: 'rico', re: /\bon thirteen\b/i, old: true },
  // Marcus (§2.2): never "mate" or "partner"; "dear" only to open a letter
  { id: 'marcus-mate', as: 'marcus', re: /\bmate\b/i },
  { id: 'marcus-partner', as: 'marcus', re: /\bpartner\b/i },
  { id: 'marcus-dear', as: 'marcus', re: /(?<!^)\bdear\b/i },
  // facts gone old (§2.3): the last no. 9 leaves at ten fifteen now; Bay FM is the listeners', no longer Coastline's
  { id: 'marcus-ten', as: 'marcus', re: /\bat ten\b(?! fifteen)/i, old: true },
  { id: 'marcus-coastline', as: 'marcus', re: /\bCoastline Radio\b/, old: true },
  // Sam (§2.4): hates the phone
  { id: 'sam-phone', as: 'sam', re: /\blove\b.*\bphone\b/i },
  // Tom (§2.5): hates speaking in public, no good on air
  { id: 'tom-air', as: 'tom', re: /\b(talk|talking) on air\b|\blove (talking|being) on the radio\b/i },
  // the others (§2.6)
  { id: 'tess-darling', as: 'tess', re: /\bdarling\b/i },
  { id: 'gus-ten-to', as: 'gus', re: /\bten to two\b/i },
  { id: 'mei-urgent', as: 'mei', re: /(?<!if )\bit'?s urgent\b(?!, it'?s lying)/i },
  { id: 'delaney-no-notes', as: 'delaney', re: /\bno need to write\b/i },
  { id: 'kemp-exclaim', as: 'kemp', re: /!/ },
];

/** The rules a segment's words break (its own person's rows), each with the words found. */
export function rulesBroken(seg: Pick<PirateSegment, 'as' | 'lines'>): { rule: FingerRule; found: string }[] {
  const out: { rule: FingerRule; found: string }[] = [];
  for (const rule of FINGERPRINT.filter((r) => r.as === seg.as))
    for (const l of seg.lines) {
      const m = l.text.match(rule.re);
      if (m) {
        out.push({ rule, found: m[0] });
        break;
      }
    }
  return out;
}
