import { describe, expect, it } from 'vitest';
import { AUDIO_STYLE_VERSION, AUDIO_VOICE, audioKey, fnv1a64, type AudioClipMode } from './audioKey';
import { buildAudioInventory, defaultInventoryContent, inventoryCounts, styleForMode, type InventoryContent } from './audioInventory';
import { decode } from './decoder';
import { annotationSpeech, CAREFUL_STYLE, carefulPlan, compareCarefulPlan, CONNECTED_STYLE, connectedPlan, connectedText, sayOf } from './playback';
import { BENCHMARK_FORMS } from '../data/benchmark';
import { CHUNKS } from '../data/chunks';
import { LESSONS } from '../data/lessons';
import { SENTENCES } from '../data/sentences';
import { connectedLines } from '../features/checkup/useCheckupAudio';
import { DEFAULT_TEXT, EXAMPLE_SAY, EXAMPLES, EXAMPLES_SHOWN } from '../features/decoder/examples';
import { dictationAudio, safeDecode } from '../features/dictation/decodeCache';
import { playbackFor } from '../features/dictation/usePlayer';
import { citationText } from '../features/drill/match';
import { quizPlayback } from '../features/lessons/quizPlayback';
import { CUSTOM_EXAMPLES, resolveSource, sentenceSource } from '../features/shadowing/sources';
import { buildSteps } from '../features/shadowing/steps';
import { PAIR_SETS } from '../data/pairs';
import type { Sentence } from './types';

const inv = buildAudioInventory();
const keys = new Set(inv.clips.map((c) => c.key));
/** The clip the router would look up for this playback is in the inventory. */
const has = (mode: AudioClipMode, text: string) => keys.has(audioKey(mode, text));

describe('audio inventory: shape', () => {
  it('every clip is keyed exactly like the playback router keys it, once', () => {
    expect(inv.voice).toBe(AUDIO_VOICE);
    expect(inv.styleVersion).toBe(AUDIO_STYLE_VERSION);
    expect(keys.size).toBe(inv.clips.length);
    for (const c of inv.clips) {
      expect(c.key).toBe(audioKey(c.mode, c.text));
      expect(c.text).toBe(c.text.trim());
      expect(c.text).toMatch(/[\p{L}\p{N}]/u);
      expect(c.style).toBe(styleForMode(c.mode));
      expect(c.refs[0]).toBe(`${c.source}:${c.ref}`);
      expect(c.sources[0]).toBe(c.source);
    }
  });

  it('a clip is made per mode: connected → CONNECTED_STYLE, careful → CAREFUL_STYLE, plain → default (tts.ts styleFor)', () => {
    expect(styleForMode('connected')).toBe(CONNECTED_STYLE);
    expect(styleForMode('careful')).toBe(CAREFUL_STYLE);
    expect(styleForMode('plain')).toBeUndefined();
  });

  it('style text change ⇒ bump AUDIO_STYLE_VERSION (src/core/audioKey.ts) and this pin, or shipped clips keep the old style', () => {
    // The key carries AUDIO_STYLE_VERSION, not the style text. Editing CONNECTED_STYLE / CAREFUL_STYLE without a
    // bump would leave every shipped clip spoken in the old style under the same keys.
    expect({ version: AUDIO_STYLE_VERSION, styles: fnv1a64(CONNECTED_STYLE + '\n' + CAREFUL_STYLE) }).toEqual({ version: 3, styles: '12ybelmdpg2rs' });
  });

  it('counts add up', () => {
    const n = inventoryCounts(inv);
    expect(n.clips).toBe(inv.clips.length);
    expect(n.byMode.connected.clips + n.byMode.careful.clips + n.byMode.plain.clips).toBe(n.clips);
    expect(n.byMode.plain.clips).toBeGreaterThan(500);
    expect(Object.values(n.bySource).reduce((s, v) => s + (v?.clips ?? 0), 0)).toBe(n.clips);
    expect(Object.values(n.byPart).reduce((s, v) => s + (v?.chars ?? 0), 0)).toBe(n.chars);
  });
});

describe('audio inventory: every play button of the built-in content is covered (same helpers as the buttons)', () => {
  it('dictation: "Nghe" / "Chậm" (connected) and "Rõ từng từ" (careful) of every sentence, and every annotation ▶', () => {
    for (const s of SENTENCES) {
      const audio = dictationAudio(s);
      const normal = playbackFor('normal', audio, 1);
      const slow = playbackFor('slow', audio, 1);
      const careful = playbackFor('careful', audio, 1);
      expect(has(normal.mode, normal.text), s.id).toBe(true);
      expect(has(slow.mode, slow.text), s.id).toBe(true);
      expect(has(careful.mode, careful.text), s.id).toBe(true);
      const d = safeDecode(s.text);
      for (const a of d.annotations) expect(has('connected', annotationSpeech(a, d.segments)), `${s.id} ${a.original}`).toBe(true);
    }
  });

  it('checkup: every sentence and passage line, connected', () => {
    for (const f of BENCHMARK_FORMS) {
      for (const s of f.sentences) for (const t of connectedLines([s.text], sayOf(s))) expect(has('connected', t), s.id).toBe(true);
      for (const q of f.questions) for (const t of connectedLines(q.lines, q.say)) expect(has('connected', t), q.id).toBe(true);
    }
  });

  it('chunks: ttsText and the example sentence (connected), the citation form (careful)', () => {
    for (const c of CHUNKS) {
      expect(has('connected', c.ttsText.trim() || c.spoken), c.id).toBe(true);
      expect(has('careful', citationText(c.written)), c.id).toBe(true);
    }
  });

  it('lessons: connected examples, compare cards and every quiz item with a mode', () => {
    let quizClips = 0;
    for (const l of LESSONS) {
      for (const sec of l.sections) {
        for (const b of sec.blocks) {
          if (b.type === 'examples') {
            for (const ex of b.items) {
              if (l.course === 'connected') expect(has('connected', connectedPlan(ex.text, decode(ex.text), ex.say).text), ex.text).toBe(true);
              expect(has('careful', carefulPlan(ex.text).text), ex.text).toBe(true);
            }
          }
          if (b.type === 'compare') {
            expect(has('careful', compareCarefulPlan(b.clear).text)).toBe(true);
            if (l.course === 'connected') expect(has('connected', connectedPlan(b.natural, decode(b.natural), b.ttsText ?? b.say).text)).toBe(true);
          }
        }
      }
      for (const item of l.quiz) {
        const play = quizPlayback(item, l.course);
        if (play?.mode) {
          quizClips++;
          expect(has(play.mode, play.text), `${l.id} ${play.text}`).toBe(true);
        }
      }
    }
    expect(quizClips).toBeGreaterThan(20);
  });

  it('home, shadowing and decoder examples', () => {
    for (const s of SENTENCES) {
      expect(has('connected', connectedText(s.text, null, s.say)), s.id).toBe(true);
      const src = sentenceSource(s);
      expect(has('connected', connectedText(src.text, decode(src.text), sayOf(src))), s.id).toBe(true);
    }
    for (const ex of EXAMPLES.slice(0, EXAMPLES_SHOWN)) expect(has('connected', connectedText(ex, safeDecode(ex), EXAMPLE_SAY[ex])), ex).toBe(true);
  });

  it('mode-less playbacks (minimal pairs, word rows / cards, story words, as-written courses) are plain clips', () => {
    for (const set of PAIR_SETS) for (const item of set.items) for (const o of item.options) expect(has('plain', o.trim()), o).toBe(true);
    const plainSources = new Set(inv.clips.filter((c) => c.mode === 'plain').map((c) => c.source));
    expect([...plainSources].sort()).toEqual(['lesson', 'pairs', 'words']);
    for (const c of inv.clips) if (c.mode === 'plain') expect(c.part).toBe('plain');
  });

  it('"Thử giọng" (Cài đặt) with the Gemini clips plays the connected sample: the same clip as decoder example 0', () => {
    expect(defaultInventoryContent().settingsSample).toBe(DEFAULT_TEXT);
    const sample = connectedText(DEFAULT_TEXT, null, EXAMPLE_SAY[DEFAULT_TEXT]);
    const clip = inv.clips.find((c) => c.key === audioKey('connected', sample));
    expect(clip?.sources).toEqual(expect.arrayContaining(['decoder', 'settings']));
  });

  it('decoder: only the sample chips the page shows; the hidden examples (reachable only by typing) get no clip of their own', () => {
    expect(defaultInventoryContent().decoderExamples).toEqual(EXAMPLES.slice(0, EXAMPLES_SHOWN));
    for (const ex of EXAMPLES.slice(EXAMPLES_SHOWN)) {
      const main = inv.clips.find((c) => c.key === audioKey('connected', connectedText(ex, safeDecode(ex), EXAMPLE_SAY[ex])));
      expect(main?.refs.some((r) => r.startsWith('decoder:example')) ?? false, ex).toBe(false);
    }
  });

  it('shadowing suggestion chips (custom tab): model, careful, steps and the decoder link', () => {
    expect(CUSTOM_EXAMPLES.length).toBeGreaterThan(0);
    for (const t of CUSTOM_EXAMPLES) {
      const src = resolveSource({ text: t }, SENTENCES, CHUNKS)!;
      const result = decode(src.text);
      expect(has('connected', connectedText(src.text, result, sayOf(src))), t).toBe(true);
      expect(has('careful', src.text), t).toBe(true);
      for (const st of buildSteps(result)) if (/[\p{L}\p{N}]/u.test(st.speak)) expect(has('connected', st.speak.trim()), st.speak).toBe(true);
      expect(has('connected', connectedText(result.input, result)), t).toBe(true);
    }
  });

  it("a sentence's authored say is used by Shadowing and by a decoder link too (no second, unrespelled clip)", () => {
    const withSay = SENTENCES.filter((s) => s.say?.trim());
    expect(withSay.length).toBeGreaterThan(0);
    for (const s of withSay) {
      const spoken = connectedText(s.text, null, s.say);
      expect(sentenceSource(s).say).toBe(s.say);
      const link = inv.clips.find((c) => c.refs.includes(`decoder:${s.id}#link`) && c.part === 'main');
      expect(link?.text, s.id).toBe(spoken);
      const shadow = inv.clips.find((c) => c.refs.includes(`shadowing:${s.id}`) && c.part === 'main');
      expect(shadow?.text, s.id).toBe(spoken);
    }
  });
});

describe('audio inventory: fixture', () => {
  const s1: Sentence = { id: 'x1', text: 'Tell him I will call him back.', vi: '', level: 1, topic: '', focus: [] };
  const content: InventoryContent = {
    sentences: [s1],
    chunks: [],
    lessons: [],
    forms: [],
    pairs: [{ id: 'p', title: '', description: '', phenomenon: 'weak-form', contrast: [], items: [{ id: 'p-1', options: ['I can go.', "I can't go."], cue: '' }] }],
    decoderExamples: [],
    exampleSay: {},
    guideSays: ['...', 'gonna'],
    settingsSample: 'Hello.',
    shadowSuggestions: ['Let me get back to you on that.'],
  };
  const small = buildAudioInventory(content);

  it('dedupes one clip used in many places, keeping every ref', () => {
    const main = small.clips.find((c) => c.key === audioKey('connected', dictationAudio(s1).connected));
    expect(main).toBeDefined();
    expect(main!.source).toBe('dictation');
    expect(main!.sources).toEqual(expect.arrayContaining(['dictation', 'home', 'shadowing', 'decoder']));
    expect(main!.refs.length).toBeGreaterThanOrEqual(4);
    const careful = small.clips.filter((c) => c.mode === 'careful' && c.text === s1.text);
    expect(careful).toHaveLength(1);
  });

  it('skips punctuation-only texts; pair options are plain clips; the settings sample is connected', () => {
    expect(small.clips.some((c) => c.text === '...')).toBe(false);
    expect(small.clips.some((c) => c.text === 'gonna' && c.source === 'guide')).toBe(true);
    expect(small.clips.filter((c) => c.mode === 'plain').map((c) => c.text).sort()).toEqual(['I can go.', "I can't go."].sort());
    expect(small.clips.find((c) => c.source === 'settings')).toMatchObject({ mode: 'connected', text: connectedText('Hello.') });
    expect(small.clips.some((c) => c.source === 'shadowing' && c.mode === 'careful' && c.text === 'Let me get back to you on that.')).toBe(true);
  });

  it('a chunk clip used only by "Từng cụm" is browserOnly; shared with another button it is not', () => {
    for (const c of small.clips) {
      if (c.browserOnly) expect(c.sources).toEqual(['dictation']);
      if (c.part !== 'chunk') expect(c.browserOnly).toBe(false);
    }
  });
});
