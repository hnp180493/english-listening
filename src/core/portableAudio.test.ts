import { afterEach, describe, expect, it } from 'vitest';
import { ART_LEDGER_FILE, AUDIO_LEDGER_FILE, AUDIO_MANIFEST_ELEMENT_ID, inlineAudioManifest, normalizeAudioManifest, syncArtFolder, syncAudioFolder } from '../../scripts/portableAudio.mjs';
import { AUDIO_MANIFEST_ELEMENT_ID as APP_ID, parseAudioManifest } from './audioManifest';

const HTML = '<!doctype html>\n<html>\n  <head>\n    <script type="module">app()</script>\n  </head>\n  <body></body>\n</html>';
const BLOCK = /<script type="application\/json" id="nna-audio-manifest">([\s\S]*?)<\/script>/;

describe('inlineAudioManifest (portable build)', () => {
  it('uses the id the app reads', () => {
    expect(AUDIO_MANIFEST_ELEMENT_ID).toBe(APP_ID);
  });

  it('puts the map into a JSON block inside <head>, readable by the app parser', () => {
    const out = inlineAudioManifest(HTML, { k1: 'k1.mp3', k2: 'k2.mp3' });
    const m = out.match(BLOCK);
    expect(m).not.toBeNull();
    expect(out.indexOf(m![0])).toBeLessThan(out.indexOf('</head>'));
    expect(parseAudioManifest(JSON.parse(m![1]))).toEqual(
      new Map([
        ['k1', 'k1.mp3'],
        ['k2', 'k2.mp3'],
      ]),
    );
    // no external reference added (build-portable fails on src/href leftovers)
    expect(out).not.toMatch(/\s(?:src|href)="/);
  });

  it('escapes "<" so nothing can end the element', () => {
    const out = inlineAudioManifest(HTML, { k: '</script><script>alert(1)</script>.mp3' });
    expect(out.match(/<\/script>/g)).toHaveLength(2); // the app's and ours
    expect(out).toContain('\\u003c/script>');
  });

  it('replaces a block already there; fails without exactly one </head>', () => {
    const once = inlineAudioManifest(HTML, { a: 'a.mp3' });
    const twice = inlineAudioManifest(once, { b: 'b.mp3' });
    expect(twice.match(/nna-audio-manifest/g)).toHaveLength(1);
    expect(twice).toContain('"b":"b.mp3"');
    expect(() => inlineAudioManifest('<html><body></body></html>', {})).toThrow();
  });

  it('normalize agrees with the app parser on every manifest shape', () => {
    const shapes: unknown[] = [
      { clips: { k1: 'k1.mp3', k2: { f: 'k2.mp3' } } },
      { clips: [{ key: 'k1', f: 'k1.mp3' }, { k: 'k2', file: 'audio/k2.mp3' }] },
      { k1: 'k1.mp3', bad: '../x.mp3', k2: { path: 'k2.mp3' } },
      null,
      [],
      { clips: 'x' },
    ];
    for (const s of shapes) expect(new Map(Object.entries(normalizeAudioManifest(s)))).toEqual(parseAudioManifest(s));
  });
});

// Node built-ins, loaded untyped: the app's tsconfig has no Node types (they would leak into browser code).
/* eslint-disable @typescript-eslint/no-explicit-any */
const nodeModule = (name: string): Promise<any> => import(/* @vite-ignore */ name);
const { mkdir, mkdtemp, readdir, rm, stat, utimes, writeFile } = await nodeModule('node:fs/promises');
const { tmpdir } = await nodeModule('node:os');
const { join } = await nodeModule('node:path');

describe('syncAudioFolder (portable build)', () => {
  let dir = '';
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
    dir = '';
  });

  it('copies new/changed clips, keeps unchanged ones, removes clips no longer listed, leaves other files', async () => {
    dir = await mkdtemp(join(tmpdir(), 'nna-audio-'));
    const src = join(dir, 'src');
    const out = join(dir, 'out', 'audio');
    await mkdir(src, { recursive: true });
    await writeFile(join(src, 'a.mp3'), 'AAAA');
    await writeFile(join(src, 'b.mp3'), 'BB');

    let r = await syncAudioFolder(src, out, ['a.mp3', 'b.mp3', 'gone.mp3']);
    expect(r).toMatchObject({ copied: 2, kept: 0, removed: 0, missing: ['gone.mp3'], files: 2, bytes: 6 });

    r = await syncAudioFolder(src, out, ['a.mp3', 'b.mp3']);
    expect(r).toMatchObject({ copied: 0, kept: 2, removed: 0 });

    await writeFile(join(src, 'b.mp3'), 'BBBBBB');
    const later = new Date(Date.now() + 60_000);
    await utimes(join(src, 'b.mp3'), later, later);
    await writeFile(join(out, 'notes.txt'), 'mine');
    r = await syncAudioFolder(src, out, ['b.mp3']);
    expect(r).toMatchObject({ copied: 1, kept: 0, removed: 1, files: 1, bytes: 6 });
    expect((await readdir(out)).sort()).toEqual([AUDIO_LEDGER_FILE, 'b.mp3', 'notes.txt']);
    expect((await stat(join(out, 'b.mp3'))).size).toBe(6);
  });

  it("never removes the learner's own files in an existing audio folder, only clips it copied itself", async () => {
    dir = await mkdtemp(join(tmpdir(), 'nna-audio-'));
    const src = join(dir, 'src');
    const out = join(dir, 'OneDrive', 'audio');
    await mkdir(src, { recursive: true });
    await mkdir(out, { recursive: true });
    await writeFile(join(src, 'k1.mp3'), 'K1');
    await writeFile(join(src, 'k2.mp3'), 'K2');
    // the learner's own recordings, named like clips
    for (const f of ['song.mp3', 'lecture-1.wav', 'voice_note.m4a']) await writeFile(join(out, f), 'mine');

    let r = await syncAudioFolder(src, out, ['k1.mp3', 'k2.mp3']);
    expect(r).toMatchObject({ copied: 2, removed: 0 });
    r = await syncAudioFolder(src, out, ['k2.mp3']);
    expect(r).toMatchObject({ kept: 1, removed: 1 });
    expect((await readdir(out)).sort()).toEqual([AUDIO_LEDGER_FILE, 'k2.mp3', 'lecture-1.wav', 'song.mp3', 'voice_note.m4a']);
    // a broken or missing ledger: nothing is removed
    await writeFile(join(out, AUDIO_LEDGER_FILE), 'not json');
    r = await syncAudioFolder(src, out, ['k1.mp3']);
    expect(r).toMatchObject({ copied: 1, removed: 0 });
    expect((await readdir(out)).sort()).toEqual([AUDIO_LEDGER_FILE, 'k1.mp3', 'k2.mp3', 'lecture-1.wav', 'song.mp3', 'voice_note.m4a']);
  });
});

describe('syncArtFolder (portable build: the town pictures)', () => {
  let dir = '';
  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
    dir = '';
  });

  it("copies this build's pictures, removes an earlier build's, and leaves anything else in the folder", async () => {
    dir = await mkdtemp(join(tmpdir(), 'nna-art-'));
    const src = join(dir, 'assets');
    const out = join(dir, 'out', 'art');
    await mkdir(src, { recursive: true });
    await mkdir(out, { recursive: true });
    await writeFile(join(src, 'places-AAAA.webp'), 'P1');
    await writeFile(join(src, 'cafe-BBBB.webp'), 'C1');
    await writeFile(join(out, 'my-drawing.webp'), 'mine');

    let r = await syncArtFolder(src, out, ['places-AAAA.webp', 'cafe-BBBB.webp']);
    expect(r).toMatchObject({ copied: 2, removed: 0, files: 2 });
    // the next build changed one picture: a new hashed name
    await writeFile(join(src, 'places-CCCC.webp'), 'P2');
    r = await syncArtFolder(src, out, ['places-CCCC.webp', 'cafe-BBBB.webp']);
    expect(r).toMatchObject({ copied: 1, kept: 1, removed: 1 });
    expect((await readdir(out)).sort()).toEqual([ART_LEDGER_FILE, 'cafe-BBBB.webp', 'my-drawing.webp', 'places-CCCC.webp']);
    // the clip ledger is a different file: the two folders never mix up their lists
    expect(ART_LEDGER_FILE).not.toBe(AUDIO_LEDGER_FILE);
  });
});
