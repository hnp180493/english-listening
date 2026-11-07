import { describe, expect, it } from 'vitest';
import { decode } from '../../core/decoder';
import { CONNECTED_SLOW_RATE } from '../../core/playback';
import type { QuizItem } from '../../data/lessonTypes';
import { quizPlayback, WORD_SLOW_RATE } from './quizPlayback';

const gen = (t: string) => (decode(t) as { speakText?: string }).speakText?.trim() || t;

describe('quizPlayback', () => {
  it('connected-course listening items speak the connected version; the turtle stays connected (no answer giveaway)', () => {
    const item: QuizItem = { type: 'listen-type', text: "I'm [going to] call you.", explain: 'x' };
    const p = quizPlayback(item, 'connected')!;
    expect(p.mode).toBe('connected');
    expect(p.text).toBe(gen("I'm going to call you."));
    expect(p.slowRate).toBe(CONNECTED_SLOW_RATE);
  });

  it("a listen-choose item's say is its authored speakable text", () => {
    const item: QuizItem = { type: 'listen-choose', options: ['I want to go.', 'I wanted to go.'], answer: 0, say: 'I wanna go.', explain: 'x' };
    expect(quizPlayback(item, 'connected')).toEqual({ text: 'I wanna go.', mode: 'connected', slowRate: CONNECTED_SLOW_RATE });
  });

  it('word / spelling items play their text as before (default style, slow word rate)', () => {
    const item: QuizItem = { type: 'silent-letter', word: 'knight', silent: [0, 3, 4], explain: 'x' };
    expect(quizPlayback(item, 'spelling')).toEqual({ text: 'knight', slowRate: WORD_SLOW_RATE });
    const read: QuizItem = { type: 'which-rule', written: 'a', spoken: 'b', options: ['linking'], answer: 'linking', explain: 'x' };
    expect(quizPlayback(read, 'connected')).toBeNull();
  });
});
