// Which text / rate / AI style each listen button sends (src/core/playback.ts and the components built on it).

import { describe, expect, it } from 'vitest';
import type { ReactElement } from 'react';
import ListenPair, { RealVoiceLink } from '../components/ListenPair';
import { CONNECTED_SLOW_RATE as DICT_SLOW } from './playback';
import {
  AI_CAREFUL_RATE,
  annotationSpeech,
  CAREFUL_ARIA,
  CAREFUL_LABEL,
  CAREFUL_RATE,
  CAREFUL_TITLE,
  carefulPlan,
  compareCarefulPlan,
  CONNECTED_TITLE,
  connectedPlan,
  connectedText,
  dictationRate,
  sayOf,
  segmentSpeech,
  slowRate,
  writtenText,
  youglishPhrase,
  youglishUrl,
} from './playback';
import { decode, speakableFor } from './decoder';

describe('connectedText: say ?? speakText ?? text', () => {
  it('prefers the authored say, then the given speakable text, then the decoder (speakableFor)', () => {
    const t = "Tell him I'll call him back.";
    // an eye-dialect say goes through the decoder unchanged
    expect(connectedText(t, { speakText: 'something else' }, "Tellim I'll callim back.")).toBe(speakableFor(t, "Tellim I'll callim back."));
    expect(connectedText(t, { speakText: "Tellim I'll callim back." })).toBe("Tellim I'll callim back.");
    // no decode result given: decoded here
    expect(connectedText(t, {})).toBe(speakableFor(t));
    expect(connectedText(t)).toBe(speakableFor(t));
    // a plain sentence without phenomena stays itself
    expect(connectedText('Hello.', null)).toBe(speakableFor('Hello.'));
  });

  it('ignores blank overrides and blank generated text', () => {
    expect(connectedText('Put it on the table.', { speakText: '  ' }, '   ')).toBe(speakableFor('Put it on the table.'));
    expect(connectedText('Put it on the table.', { speakText: 42 }, null)).toBe(speakableFor('Put it on the table.'));
  });

  it('works on a real DecodeResult (speakText when the decoder provides it, else the text)', () => {
    const d = decode('What do you want to do?');
    const out = connectedText('What do you want to do?', d);
    const speak = (d as { speakText?: string }).speakText;
    expect(out).toBe(speak && speak.trim() ? speak.trim() : 'What do you want to do?');
    expect(out).not.toBe('What do you want to do?'); // the decoder spells the reductions
  });

  it('sayOf reads a non-blank say from any content object', () => {
    expect(sayOf({ text: 'x', say: 'Didja eat yet?' })).toBe('Didja eat yet?');
    expect(sayOf({ text: 'x', say: ' ' })).toBeUndefined();
    expect(sayOf({ text: 'x' })).toBeUndefined();
    expect(sayOf(null)).toBeUndefined();
  });

  it('segmentSpeech: the segment speak form, else its written words', () => {
    expect(segmentSpeech({ written: 'going to', speak: 'gonna' })).toBe('gonna');
    expect(segmentSpeech({ written: 'going to', speak: '' })).toBe('going to');
    expect(segmentSpeech({ written: 'going to' })).toBe('going to');
  });

  it('annotationSpeech: the connected form of the segments an annotation touches', () => {
    const segs = [
      { from: 0, to: 0, written: 'Tell', speak: 'Tell' },
      { from: 1, to: 2, written: "him I'll", speak: "im I'll" },
      { from: 3, to: 4, written: 'call him', speak: 'callim' },
    ];
    expect(annotationSpeech({ from: 3, to: 4, original: 'call him' }, segs)).toBe('callim');
    expect(annotationSpeech({ from: 0, to: 1, original: 'Tell him' }, segs)).toBe("Tell im I'll");
    // no speakable forms yet (older decoder): the annotation's written words, not the whole segment
    expect(annotationSpeech({ from: 3, to: 3, original: 'call' }, [{ from: 3, to: 4, written: 'call him' }])).toBe('call');
  });

  it("annotationSpeech plays only the annotation's own words when the decoder gives them (Annotation.speak)", () => {
    const r = decode("Tell him I'll call him back.");
    const say = (orig: string) => annotationSpeech(r.annotations.find((a) => a.original === orig)!, r.segments);
    expect(say("I'll")).toBe("I'll"); // not "Tellim I'll"
    expect(say('Tell him')).toBe('Tellim');
    expect(say('call him')).toBe('callim');
    // a stretch inside a joined chunk is widened just enough not to cut it
    expect(say("him I'll")).toBe("Tellim I'll");
    expect(annotationSpeech(decode("I'm going to call.").annotations.find((a) => a.original === 'going to')!, [])).toBe('gonna');
  });

  it('writtenText: other courses play say ?? text exactly as written', () => {
    expect(writtenText('I thought you bought it.')).toBe('I thought you bought it.');
    expect(writtenText('read', 'I read it yesterday.')).toBe('I read it yesterday.');
    expect(writtenText('read', '  ')).toBe('read');
  });
});

describe('plans: what the two buttons send', () => {
  it('main "Nghe" = connected text, learner rate (undefined), connected mode', () => {
    expect(connectedPlan('What do you want to do?', { speakText: 'Whaddaya wanna do?' })).toEqual({
      text: 'Whaddaya wanna do?',
      mode: 'connected',
      rate: undefined,
    });
    expect(connectedPlan('Hi.', null, 'Hey!', 1).rate).toBe(1);
  });

  it('turtle "Rõ từng từ" = the STANDARD written text, slower, careful mode', () => {
    expect(carefulPlan('What do you want to do?')).toEqual({ text: 'What do you want to do?', mode: 'careful', rate: CAREFUL_RATE });
    // a compare card's careful button sends the plain sentence too (no "Is, this, your, bag." citation form)
    expect(compareCarefulPlan(' Is this your bag? ')).toEqual({ text: 'Is this your bag?', mode: 'careful', rate: CAREFUL_RATE });
    expect(CAREFUL_RATE).toBeLessThan(1);
  });

  it('a slow playback is never faster than "Nghe" (relative to the learner rate)', () => {
    expect(slowRate(CAREFUL_RATE, 1, { mode: 'careful' })).toBe(0.75);
    expect(slowRate(CAREFUL_RATE, 0.6, { mode: 'careful' })).toBe(0.48); // learner at 0.6: careful 0.48, not 0.75
    expect(slowRate(0.75, 0.6, { mode: 'connected', slow: true })).toBe(0.48);
    expect(slowRate(0.75, 1.3, { mode: 'connected', slow: true })).toBe(0.75);
    // not slow: the requested rate as is (level 1, a fixed 1×), or the learner rate
    expect(slowRate(1, 0.6, { mode: 'connected' })).toBe(1);
    expect(slowRate(undefined, 0.6)).toBe(0.6);
    // AI voice: the careful clip is already slow (CAREFUL_STYLE), so it is not slowed to 0.75 on top
    expect(slowRate(CAREFUL_RATE, 1, { mode: 'careful', engine: 'ai' })).toBe(AI_CAREFUL_RATE);
    expect(slowRate(CAREFUL_RATE, 0.7, { mode: 'careful', engine: 'ai' })).toBe(0.63);
  });

  it('dictation level 1 is a little slower, other levels keep the learner rate', () => {
    expect(dictationRate(1, 1)).toBe(0.9);
    expect(dictationRate(1, 2)).toBe(1);
    expect(dictationRate(1.2, 3)).toBe(1.2);
    expect(dictationRate(1)).toBe(1);
    expect(DICT_SLOW).toBeLessThan(1);
  });
});

describe('<ListenPair>: the buttons it renders', () => {
  type Btn = ReactElement<{ text: string; rate?: number; mode?: string; label: string; title?: string; ariaLabel?: string }>;
  const buttons = (el: ReactElement) => (el.props as { children: Btn[] }).children;

  it('"Nghe" speaks say ?? speakText at the normal rate; "Rõ từng từ" the written text slowly', () => {
    const [fast, slow] = buttons(
      ListenPair({ text: "Tell him I'll call him back.", decoded: { speakText: "Tellim I'll callim back." } }) as ReactElement,
    );
    expect(fast.props).toMatchObject({ text: "Tellim I'll callim back.", mode: 'connected', label: 'Nghe', title: CONNECTED_TITLE });
    expect(fast.props.rate).toBeUndefined();
    expect(slow.props).toMatchObject({ text: "Tell him I'll call him back.", mode: 'careful', rate: CAREFUL_RATE, label: 'Rõ từng từ', title: CAREFUL_TITLE });
    expect(fast.props.ariaLabel).toMatch(/^Nghe/);
    expect(slow.props.ariaLabel).toBe(CAREFUL_ARIA);
    expect(CAREFUL_ARIA.startsWith(CAREFUL_LABEL)).toBe(true); // the accessible name contains the visible label
  });

  it('asWritten (other courses): "Nghe" speaks say ?? text unchanged, default AI style', () => {
    const [fast, slow] = buttons(ListenPair({ text: 'I thought you bought it.', asWritten: true }) as ReactElement);
    expect(fast.props.text).toBe('I thought you bought it.'); // not "I thoughtcha bought it."
    expect(fast.props.mode).toBeUndefined();
    expect(slow.props.text).toBe('I thought you bought it.');
    const [h] = buttons(ListenPair({ text: 'A tear ran down her face.', say: 'A tear ran down her face.', asWritten: true }) as ReactElement);
    expect(h.props.text).toBe('A tear ran down her face.');
  });

  it('an authored say wins over the generated text', () => {
    const [fast] = buttons(ListenPair({ text: 'Did you eat yet?', decoded: { speakText: 'Did ju eat yet?' }, say: 'Didja eat yet?' }) as ReactElement);
    expect(fast.props.text).toBe(speakableFor('Did you eat yet?', 'Didja eat yet?'));
    expect(fast.props.text).not.toBe('Did ju eat yet?');
  });
});

describe('YouGlish link', () => {
  it('opens the US pronunciation search for the phrase, url-encoded, in a new tab', () => {
    expect(youglishUrl('going to')).toBe('https://youglish.com/pronounce/going%20to/english/us');
    expect(youglishUrl("I don't know.")).toBe("https://youglish.com/pronounce/I%20don't%20know/english/us");
    const a = RealVoiceLink({ phrase: 'call him back' }) as ReactElement<{ href: string; target: string; rel: string; children: unknown[] }>;
    expect(a.props.href).toBe('https://youglish.com/pronounce/call%20him%20back/english/us');
    expect(a.props.target).toBe('_blank');
    expect(a.props.rel).toBe('noopener noreferrer');
    expect(a.props.children).toContain('Nghe người thật nói');
    expect(RealVoiceLink({ phrase: '  ' })).toBeNull();
  });

  it('short examples search the whole text; longer ones the 2-4 words of the first connected stretch', () => {
    expect(youglishPhrase('Pick it up.')).toBe('Pick it up.');
    const long = "I'm going to get a cup of coffee before the meeting starts.";
    const phrase = youglishPhrase(long, decode(long));
    expect(phrase.split(' ').length).toBeGreaterThanOrEqual(2);
    expect(phrase.split(' ').length).toBeLessThanOrEqual(4);
    expect(long).toContain(phrase);
    const tell = "Tell him I'll call him back.";
    expect(youglishPhrase(tell, decode(tell))).toBe('Tell him'); // not the whole 6-word sentence
  });
});
