// Transcript parsing: YouTube "Show transcript" copy, SRT and WebVTT → clean cues.
// Pure: no DOM. Every function tolerates garbage input and returns [] rather than throwing.

export interface Cue {
  start: number; // seconds
  end: number; // seconds, > start
  text: string; // clean caption text (tags, sound effects, speaker marks removed)
}

export type TranscriptFormat = 'youtube' | 'srt' | 'vtt' | 'unknown';

export interface ParsedTranscript {
  format: TranscriptFormat;
  cues: Cue[];
}

/** Default length of the last cue of a YouTube copy (no end time is given). */
export const LAST_CUE_SECONDS = 5;
/** Longest a YouTube-copy cue may last when the next time stamp is far away. */
export const MAX_CUE_SECONDS = 30;

/** Generous upper estimate of how long it takes to say `text` (≈ 1.8 words/s plus a margin). */
export function estimateSpeechSeconds(text: string): number {
  const words = (text ?? '').split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  return words * 0.55 + 1.5;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

// ------------------------------------------------------------------ time stamps

/**
 * Parse a clock string into seconds: "0:05", "12:34", "1:02:03", "00:00:01,000", "00:01.500".
 * Returns null when it is not a clock.
 */
export function parseClock(s: string): number | null {
  const m = /^\s*(?:(\d{1,3}):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?\s*$/.exec(s ?? '');
  if (!m) return null;
  const h = m[1] ? Number(m[1]) : 0;
  const min = Number(m[2]);
  const sec = Number(m[3]);
  if (sec >= 60 || (m[1] !== undefined && min >= 60)) return null;
  const frac = m[4] ? Number(m[4].padEnd(3, '0')) / 1000 : 0;
  return round3(h * 3600 + min * 60 + sec + frac);
}

/** 65 → "1:05", 3723 → "1:02:03". Negative / NaN → "0:00". */
export function formatClock(seconds: number): string {
  const t = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = String(t % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

// ------------------------------------------------------------------ text cleaning

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  hellip: '…',
  mdash: '—',
  ndash: '–',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return whole;
      try {
        return String.fromCodePoint(code);
      } catch {
        return whole;
      }
    }
    const v = NAMED_ENTITIES[body.toLowerCase()];
    return v ?? whole;
  });
}

function cleanLine(line: string): string {
  let s = line;
  s = s.replace(/^\s*(?:>>+|[-–—]+)\s*/, ''); // speaker change marks: ">> ", "- "
  s = s.replace(/^\s*[A-Z][A-Z0-9 .'-]{0,30}:\s+/, ''); // "JOHN: hello", "SPEAKER 1: hi"
  return s;
}

/**
 * Clean one caption's text: strip HTML/VTT tags, decode entities, drop sound
 * descriptions ([Music], (laughs), ♪ lyrics ♪), speaker dashes/labels, collapse whitespace.
 */
export function cleanCueText(text: string): string {
  if (!text) return '';
  let s = String(text).replace(/\r/g, '');
  s = s.replace(/<[^>]*>/g, ''); // <c>, <i>, <v Bob>, <00:00:01.000>, </c>
  s = decodeEntities(s);
  s = s.replace(/<[^>]*>/g, ''); // tags that were written as entities (&lt;i&gt;)
  s = s.replace(/♪[^♪\n]*♪/g, ' '); // sung lyrics are not speech practice
  s = s.replace(/[♪♫♬]/g, ' ');
  s = s.replace(/\[[^\]\n]*\]/g, ' '); // [Music] [Applause] [inaudible]
  s = s.replace(/\([^)\n]*\)/g, ' '); // (laughs) (LAUGHTER)
  s = s.replace(/\{\\[^}]*\}/g, ''); // SSA override tags sometimes left in SRT: {\an8}
  s = s
    .split('\n')
    .map(cleanLine)
    .join(' ');
  s = s.replace(/[​‎‏﻿]/g, '');
  s = s.replace(/\s+/g, ' ').trim();
  // a stray speaker dash left after removing a sound cue: "- - hi" → "hi"
  s = s.replace(/^(?:[-–—]\s*)+/, '').trim();
  // leftover punctuation-only text ("- ." after removing "[Music]")
  if (!/[\p{L}\p{N}]/u.test(s)) return '';
  return s;
}

// ------------------------------------------------------------------ helpers

function normalizeNewlines(text: string): string {
  return (text ?? '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
}

function finalize(cues: Cue[]): Cue[] {
  const out = cues
    .filter((c) => Number.isFinite(c.start) && Number.isFinite(c.end) && c.text)
    .map((c) => ({ start: round3(Math.max(0, c.start)), end: round3(Math.max(c.end, c.start + 0.1)), text: c.text }));
  // stable sort by start time (some SRT files are out of order)
  return out.map((c, i) => ({ c, i })).sort((a, b) => a.c.start - b.c.start || a.i - b.i).map((x) => x.c);
}

// ------------------------------------------------------------------ SRT / WebVTT

const ARROW_RE =
  /^\s*((?:\d{1,3}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?)\s*-->\s*((?:\d{1,3}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?)(?:\s+.*)?$/;

const ROLLING_GAP = 0.5;

/** Parse SRT or WebVTT text (both use "start --> end" cue timing lines). */
export function parseCueFile(text: string): Cue[] {
  const lines = normalizeNewlines(text).split('\n');
  const raw: { start: number; end: number; lines: string[] }[] = [];
  type RawCue = { start: number; end: number; lines: string[] };
  let cur: RawCue | null = null;
  let skipBlock = false; // inside NOTE / STYLE / REGION / header block

  const isArrow = (l: string | undefined) => l !== undefined && ARROW_RE.test(l);
  /** A new cue for a timing line (pushed to raw), or null when its clocks are invalid. */
  const newCue = (m: RegExpExecArray | null): RawCue | null => {
    if (!m) return null;
    const start = parseClock(m[1]);
    const end = parseClock(m[2]);
    if (start == null || end == null) return null;
    const c: RawCue = { start, end, lines: [] };
    raw.push(c);
    return c;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '') {
      // YouTube auto VTT puts a whitespace-only line right after the timing line: not a cue end
      if (cur && cur.lines.length === 0 && line !== '') continue;
      cur = null;
      skipBlock = false;
      continue;
    }
    const m = ARROW_RE.exec(line);
    if (skipBlock) {
      // a header written without the blank line before the first cue ("WEBVTT⏎00:00.000 --> …")
      const c = newCue(m);
      if (c) {
        cur = c;
        skipBlock = false;
      }
      continue;
    }
    if (!cur) {
      if (/^(?:WEBVTT|NOTE|STYLE|REGION)(?:\s|$)/.test(line.trim())) {
        skipBlock = true;
        continue;
      }
      if (m) {
        cur = newCue(m);
        if (!cur) skipBlock = true;
      }
      // otherwise: cue index / identifier line, ignore
      continue;
    }
    // A timing line without a blank line before it starts a new cue (sloppy files).
    const c = newCue(m);
    if (c) {
      cur = c;
      continue;
    }
    // …and the cue number / identifier right before such a timing line is not caption text.
    if (isArrow(lines[i + 1]) && (/^\s*\d+\s*$/.test(line) || !cur.lines.length)) continue;
    cur.lines.push(line);
  }

  // Drop rolling-caption repeats (YouTube auto-generated VTT repeats the previous line on top).
  const cues: Cue[] = [];
  let prevLines: string[] = [];
  let prevEnd = -Infinity;
  for (const r of raw) {
    // only cues that touch / overlap the previous one can be rolling repeats;
    // the same words said again later ("No." … "No.") are real speech
    if (r.start > prevEnd + ROLLING_GAP) prevLines = [];
    prevEnd = r.end;
    const cleaned = r.lines.map((l) => cleanCueText(l)).filter(Boolean);
    const fresh = cleaned.filter((l) => !prevLines.includes(l));
    if (cleaned.length) prevLines = cleaned;
    if (fresh.length === 0) {
      // a pure repeat: extend the previous cue instead of creating a duplicate
      const last = cues[cues.length - 1];
      if (last && cleaned.length && r.end > last.end && r.start - last.end < 0.5) last.end = r.end;
      continue;
    }
    // whole-cue cleaning (handles tags split across lines); fall back to the fresh lines
    const text = fresh.length === cleaned.length ? cleanCueText(r.lines.join('\n')) || fresh.join(' ') : fresh.join(' ');
    cues.push({ start: r.start, end: r.end, text }); // zero-length cues get a minimum duration in finalize()
  }
  return finalize(cues);
}

// ------------------------------------------------------------------ YouTube transcript copy

const YT_STAMP_RE = /^\s*(\d{1,3}(?::\d{2}){1,2})(?:\s+(.*))?\s*$/;
// Screen-reader duration lines YouTube sometimes includes in copied text.
const DURATION_LINE_RE =
  /^\s*(?:\d+\s*(?:hours?|minutes?|seconds?|giờ|phút|giây)\s*,?\s*(?:and\s*)?)+$/i;

function looksLikeChapterTitle(line: string): boolean {
  const t = line.trim();
  if (!t || /[.?!,;:…]["'”’)]?$/.test(t)) return false;
  const words = t.split(/\s+/);
  if (words.length > 8) return false;
  return /^[\p{Lu}\d]/u.test(t);
}

/** Parse text copied from YouTube's "Show transcript" panel. */
export function parseYouTubeCopy(text: string): Cue[] {
  const lines = normalizeNewlines(text).split('\n');
  const entries: { start: number; lines: string[] }[] = [];
  let cur: { start: number; lines: string[] } | null = null;
  for (const line of lines) {
    if (!line.trim()) continue;
    const m = YT_STAMP_RE.exec(line);
    const t = m ? parseClock(m[1]) : null;
    if (m && t != null) {
      cur = { start: t, lines: [] };
      entries.push(cur);
      if (m[2] && m[2].trim()) cur.lines.push(m[2]);
      continue;
    }
    if (!cur) continue; // title / chapter before the first time stamp
    if (DURATION_LINE_RE.test(line)) continue;
    cur.lines.push(line);
  }
  // YouTube puts each segment's text on ONE line; extra trailing lines in a block are
  // chapter headings that belong before the next time stamp.
  for (const e of entries) {
    while (e.lines.length > 1 && looksLikeChapterTitle(e.lines[e.lines.length - 1])) e.lines.pop();
  }
  const cues: Cue[] = [];
  entries.sort((a, b) => a.start - b.start);
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const textOut = cleanCueText(e.lines.join('\n'));
    if (!textOut) continue;
    let next: number | null = null;
    for (let k = i + 1; k < entries.length; k++) {
      if (entries[k].start > e.start) {
        next = entries[k].start;
        break;
      }
    }
    // YouTube gives no end time: use the next start, but never run far past what the words
    // need (a long untranscribed intro / music break would otherwise be played as "speech").
    const needed = Math.min(MAX_CUE_SECONDS, Math.max(LAST_CUE_SECONDS, estimateSpeechSeconds(textOut)));
    const end = next == null ? e.start + needed : Math.min(next, e.start + needed);
    cues.push({ start: e.start, end, text: textOut });
  }
  return finalize(cues);
}

// ------------------------------------------------------------------ auto-detect

export function detectFormat(text: string): TranscriptFormat {
  const t = normalizeNewlines(text);
  if (/^\s*WEBVTT/.test(t)) return 'vtt';
  const lines = t.split('\n');
  if (lines.some((l) => ARROW_RE.test(l))) {
    // SRT uses commas; a VTT without its header uses dots
    return lines.some((l) => /\d,\d{1,3}\s*-->/.test(l)) ? 'srt' : 'vtt';
  }
  if (lines.some((l) => YT_STAMP_RE.test(l) && parseClock(YT_STAMP_RE.exec(l)?.[1] ?? '') != null)) return 'youtube';
  return 'unknown';
}

/** Auto-detect the format and parse. Never throws. */
export function parseTranscriptDetailed(text: string): ParsedTranscript {
  try {
    const format = detectFormat(text ?? '');
    if (format === 'srt' || format === 'vtt') return { format, cues: parseCueFile(text) };
    if (format === 'youtube') return { format, cues: parseYouTubeCopy(text) };
  } catch {
    // fall through
  }
  return { format: 'unknown', cues: [] };
}

/** Auto-detect (YouTube copy / SRT / WebVTT) and return clean cues. */
export function parseTranscript(text: string): Cue[] {
  return parseTranscriptDetailed(text).cues;
}
