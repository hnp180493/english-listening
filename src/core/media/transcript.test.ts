import { describe, expect, it } from 'vitest';
import {
  cleanCueText,
  decodeEntities,
  detectFormat,
  formatClock,
  parseClock,
  parseTranscript,
  parseTranscriptDetailed,
} from './transcript';

describe('parseClock / formatClock', () => {
  it('parses clock strings', () => {
    expect(parseClock('0:05')).toBe(5);
    expect(parseClock('12:34')).toBe(754);
    expect(parseClock('1:02:03')).toBe(3723);
    expect(parseClock('00:00:01,000')).toBe(1);
    expect(parseClock('00:00:03,500')).toBe(3.5);
    expect(parseClock('01:02.25')).toBe(62.25);
  });
  it('rejects non-clocks', () => {
    expect(parseClock('hello')).toBeNull();
    expect(parseClock('1:75')).toBeNull();
    expect(parseClock('')).toBeNull();
  });
  it('formats seconds', () => {
    expect(formatClock(5)).toBe('0:05');
    expect(formatClock(65.9)).toBe('1:05');
    expect(formatClock(3723)).toBe('1:02:03');
    expect(formatClock(-3)).toBe('0:00');
    expect(formatClock(Number.NaN)).toBe('0:00');
  });
});

describe('cleanCueText', () => {
  it('strips tags and decodes entities', () => {
    expect(cleanCueText('<i>Hello</i> &amp; <b>welcome</b>')).toBe('Hello & welcome');
    expect(decodeEntities('it&#39;s &quot;fine&quot; &#x2019;')).toBe('it\'s "fine" ’');
  });
  it('removes sound descriptions and music', () => {
    expect(cleanCueText('[Music]')).toBe('');
    expect(cleanCueText('(laughs) That was great.')).toBe('That was great.');
    expect(cleanCueText('♪ never gonna give you up ♪')).toBe('');
    expect(cleanCueText('[Applause] Thank you.')).toBe('Thank you.');
  });
  it('removes speaker dashes, >> marks and labels', () => {
    expect(cleanCueText('- Where are you going?\n- Home.')).toBe('Where are you going? Home.');
    expect(cleanCueText('>> So what do you think?')).toBe('So what do you think?');
    expect(cleanCueText('JOHN: I gotta go.')).toBe('I gotta go.');
  });
  it('collapses whitespace', () => {
    expect(cleanCueText('  so   I\n was\tlike  ')).toBe('so I was like');
  });
});

describe('YouTube transcript copy', () => {
  it('parses time-then-text lines; end = next start; last = start + 5', () => {
    const text = '0:00\nhey guys welcome back\n0:03\ntoday we are gonna talk about\n0:06\ncoffee';
    const r = parseTranscriptDetailed(text);
    expect(r.format).toBe('youtube');
    expect(r.cues).toEqual([
      { start: 0, end: 3, text: 'hey guys welcome back' },
      { start: 3, end: 6, text: 'today we are gonna talk about' },
      { start: 6, end: 11, text: 'coffee' },
    ]);
  });
  it('parses "0:05 text" on one line', () => {
    const cues = parseTranscript("0:05 I want to go\n0:08 but I can't");
    expect(cues).toHaveLength(2);
    expect(cues[0]).toEqual({ start: 5, end: 8, text: 'I want to go' });
    expect(cues[1].text).toBe("but I can't");
  });
  it('handles hours and drops [Music] entries', () => {
    const cues = parseTranscript('59:58\n[Music]\n1:00:01\nand that is it\n1:02:03\nbye');
    expect(cues.map((c) => c.start)).toEqual([3601, 3723]);
    expect(cues[0].text).toBe('and that is it');
  });
  it('ignores chapter titles and screen-reader duration lines', () => {
    const text = [
      'Intro',
      '0:00',
      '2 seconds',
      'so let me tell you a story.',
      'The Story Begins',
      '0:04',
      '4 seconds',
      'it was a cold night.',
    ].join('\n');
    const cues = parseTranscript(text);
    expect(cues.map((c) => c.text)).toEqual(['so let me tell you a story.', 'it was a cold night.']);
  });
});

describe('SRT', () => {
  const srt = `1
00:00:01,000 --> 00:00:03,500
Hello there.

2
00:00:04,000 --> 00:00:06,000
<i>How are you</i>
doing today?

3
00:00:07,000 --> 00:00:08,000
[MUSIC]
`;
  it('detects and parses', () => {
    expect(detectFormat(srt)).toBe('srt');
    expect(parseTranscript(srt)).toEqual([
      { start: 1, end: 3.5, text: 'Hello there.' },
      { start: 4, end: 6, text: 'How are you doing today?' },
    ]);
  });
  it('handles CRLF, BOM and out-of-order cues', () => {
    const t = '﻿2\r\n00:00:05,000 --> 00:00:06,000\r\nsecond\r\n\r\n1\r\n00:00:01,000 --> 00:00:02,000\r\nfirst\r\n';
    expect(parseTranscript(t).map((c) => c.text)).toEqual(['first', 'second']);
  });
});

describe('WebVTT', () => {
  it('parses header, cue settings, NOTE blocks and inline tags', () => {
    const vtt = `WEBVTT
Kind: captions
Language: en

NOTE this is a comment
spanning two lines

intro
00:01.000 --> 00:03.000 align:start position:0%
<v Roger>Turn it off,</v> please.

00:00:04.000 --> 00:00:05.500
I<00:00:04.300><c> wanna</c><00:00:04.700><c> go</c>
`;
    const r = parseTranscriptDetailed(vtt);
    expect(r.format).toBe('vtt');
    expect(r.cues).toEqual([
      { start: 1, end: 3, text: 'Turn it off, please.' },
      { start: 4, end: 5.5, text: 'I wanna go' },
    ]);
  });
  it('removes rolling-caption repeats from auto-generated YouTube VTT', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:00.000 --> 00:00:02.350 align:start position:0%',
      ' ',
      'in<00:00:00.539><c> this</c><00:00:00.989><c> video</c>',
      '',
      '00:00:02.350 --> 00:00:02.360 align:start position:0%',
      'in this video',
      ' ',
      '',
      '00:00:02.360 --> 00:00:05.000 align:start position:0%',
      'in this video',
      'we<00:00:02.800><c> look</c><00:00:03.100><c> at</c><00:00:03.300><c> linking</c>',
      '',
    ].join('\n');
    const cues = parseTranscript(vtt);
    expect(cues.map((c) => c.text)).toEqual(['in this video', 'we look at linking']);
    expect(cues[0].end).toBe(2.36);
  });
});

describe('unknown input', () => {
  it('returns no cues for plain text or garbage', () => {
    expect(parseTranscriptDetailed('Just some words without times.').format).toBe('unknown');
    expect(parseTranscript('')).toEqual([]);
    expect(parseTranscript('-->')).toEqual([]);
  });
});

describe('messy real-world pastes', () => {
  it('SRT with missing blank lines does not glue the next cue number to the text', () => {
    const t = '1\n00:00:01,000 --> 00:00:02,000\nHello there\n2\n00:00:02,500 --> 00:00:03,000\nGeneral Kenobi\n';
    expect(parseTranscript(t)).toEqual([
      { start: 1, end: 2, text: 'Hello there' },
      { start: 2.5, end: 3, text: 'General Kenobi' },
    ]);
  });
  it('SRT with extra blank lines, stray numbering and dotted milliseconds', () => {
    const t = '1\n\n00:00:01.000 --> 00:00:02.000\nHello\n\n\n\n2\n00:00:03,000 --> 00:00:04,000\nBye\n\n3\n';
    expect(parseTranscript(t).map((c) => c.text)).toEqual(['Hello', 'Bye']);
  });
  it('keeps a sentence a speaker really repeats later (not a rolling caption)', () => {
    const t = '1\n00:00:01,000 --> 00:00:02,000\nNo.\n\n2\n00:00:05,000 --> 00:00:06,000\nNo.\n';
    expect(parseTranscript(t)).toHaveLength(2);
  });
  it('WebVTT header followed directly by a cue (no blank line)', () => {
    const t = 'WEBVTT\n00:00.000 --> 00:02.000\nhello world\n\n00:02.000 --> 00:04.000\nbye now\n';
    expect(parseTranscript(t).map((c) => c.text)).toEqual(['hello world', 'bye now']);
  });
  it('WebVTT STYLE and REGION blocks are skipped', () => {
    const t = 'WEBVTT\n\nSTYLE\n::cue { color: yellow }\n\nREGION\nid:fred width:40%\n\n00:00.000 --> 00:02.000 region:fred\nhi there\n';
    expect(parseTranscript(t)).toEqual([{ start: 0, end: 2, text: 'hi there' }]);
  });
  it('overlapping cues stay sorted by start', () => {
    const t = '1\n00:00:01,000 --> 00:00:04,000\nHello there.\n\n2\n00:00:02,000 --> 00:00:03,000\nHi!\n';
    expect(parseTranscript(t).map((c) => c.start)).toEqual([1, 2]);
  });
  it('YouTube copy with CRLF, BOM, chapter heading, 12:05 and 1:02:03 stamps', () => {
    const t = '﻿Intro\r\n0:00\r\nhello there\r\n12:05\r\nlater on\r\n1:02:03\r\nthe end\r\n';
    const cues = parseTranscript(t);
    expect(cues.map((c) => [c.start, c.text])).toEqual([
      [0, 'hello there'],
      [725, 'later on'],
      [3723, 'the end'],
    ]);
    // a cue followed by a long gap does not run on for minutes
    expect(cues[0].end).toBeLessThanOrEqual(5);
  });
  it('YouTube copy keeps text lines that start with numbers', () => {
    const cues = parseTranscript('0:00\nhello\n0:02\n10 people came\n0:04\nbye');
    expect(cues.map((c) => c.text)).toEqual(['hello', '10 people came', 'bye']);
  });
  it('YouTube copy with "1 minute, 5 seconds" accessibility lines', () => {
    const cues = parseTranscript('0:00\n0 seconds\nhello there\n1:05\n1 minute, 5 seconds\nokay');
    expect(cues.map((c) => c.text)).toEqual(['hello there', 'okay']);
  });
});
