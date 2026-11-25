// Written by scripts/portraits.mjs (npm run portraits): each resident's drawn portraits, one 3 × 3 grid of faces in
// public/portraits/<placeId>.webp (docs/portrait-prompts.md), with a hash of the file (a new picture is fetched again)
// and the moods drawn in it (portraitSheet.ts SHEET_LAYOUT gives each one's cell), with each face's background colour
// and how far a round frame moves the picture down so the whole head is inside the circle (a part of the frame; the
// gap above is filled with that colour). Not edited by hand.

import type { SheetEntry } from './portraitSheet';

export const PORTRAIT_SHEETS: Readonly<Record<string, SheetEntry>> = {
  "board": {"v": "cfd7e0ad44", "has": ["neutral", "happy", "sad", "love", "surprised", "moved", "pout", "thinking", "worried"], "bg": ["#f77064", "#f77065", "#f77165", "#f57064", "#f67065", "#f57164", "#f46f63", "#f56f63", "#f77062"], "lift": 0.029},
  "cafe": {"v": "f8555fc5b5", "has": ["neutral", "happy", "sad", "love", "surprised", "moved", "pout", "thinking", "worried"], "bg": ["#c6e5d4", "#c6e7d5", "#c6e7d4", "#c6e5d4", "#c6e7d5", "#c6e7d5", "#c4e4d2", "#c4e4d3", "#c5e6d4"], "lift": 0.047},
  "cinema": {"v": "904e5a05cc", "has": ["neutral", "happy", "sad", "love", "surprised", "moved", "pout", "thinking", "worried"], "bg": ["#fad1d1", "#fad2d2", "#f8d2d2", "#f8d2d2", "#f8d1d2", "#f7d0d2", "#f8d2d1", "#f8d2d2", "#f7d2d1"], "lift": 0},
  "clinic": {"v": "038250a279", "has": ["neutral", "happy", "sad", "love", "surprised", "moved", "pout", "thinking", "worried"], "bg": ["#a5b1df", "#a4b1de", "#a4b1e0", "#a3b0de", "#a2afde", "#a4b1de", "#a1aedc", "#a1aede", "#a2afde"], "lift": 0.04},
  "friend": {"v": "e9b7763705", "has": ["neutral", "happy", "sad", "love", "surprised", "moved", "pout", "thinking", "worried"], "bg": ["#d7c3e7", "#d7c3e7", "#d6c3e7", "#d5c2e6", "#d7c3e7", "#d7c3e7", "#d6c2e7", "#d7c3e7", "#d6c3e7"], "lift": 0.027},
  "home": {"v": "0fc5eda9c4", "has": ["neutral", "happy", "sad", "love", "surprised", "moved", "pout", "thinking", "worried"], "bg": ["#f2d6d1", "#f2d5d1", "#f2d6d2", "#f2d6d2", "#f2d5d1", "#f3d6d2", "#f2d5d1", "#f2d5d1", "#f2d5d1"], "lift": 0.02},
  "office": {"v": "299ff3f94e", "has": ["neutral", "happy", "sad", "love", "surprised", "moved", "pout", "thinking", "worried"], "bg": ["#96c7c2", "#96c5be", "#96c5bf", "#95c7c1", "#95c6c0", "#96c6c0", "#96c6bf", "#94c6bf", "#95c6bf"], "lift": 0},
  "park": {"v": "ed8d0a1c13", "has": ["neutral", "happy", "sad", "love", "surprised", "moved", "pout", "thinking", "worried"], "bg": ["#b7d9f0", "#b8d9f0", "#b8daf0", "#b9d9f1", "#b9d9f0", "#b9d9f0", "#bad8ef", "#bbd9ef", "#b9d8ef"], "lift": 0},
  "phone": {"v": "abc5631310", "has": ["neutral", "happy", "sad", "love", "surprised", "moved", "pout", "thinking", "worried"], "bg": ["#c3dba8", "#c3dba8", "#c3daa7", "#c5daa8", "#c4daa8", "#c3d9a8", "#c2d8a6", "#c3d8a7", "#c3daa7"], "lift": 0.017},
  "school": {"v": "1e705b29d6", "has": ["neutral", "happy", "sad", "love", "surprised", "moved", "pout", "thinking", "worried"], "bg": ["#fbe8a5", "#fce9a5", "#fce8a5", "#fde8a6", "#fde8a5", "#fde8a6", "#fce8a3", "#fde8a3", "#fbe9a3"], "lift": 0},
  "shop": {"v": "46cacc5fcf", "has": ["neutral", "happy", "sad", "love", "surprised", "moved", "pout", "thinking", "worried"], "bg": ["#b1c7aa", "#b0c7aa", "#b1c6aa", "#b0c7aa", "#afc6a9", "#b0c7aa", "#afc5a9", "#afc5a9", "#b0c7aa"], "lift": 0.013},
  "square": {"v": "5ca9b073a6", "has": ["neutral", "happy", "sad", "love", "surprised", "moved", "pout", "thinking", "worried"], "bg": ["#ffd2b1", "#ffd2b1", "#fed3b0", "#fed2b1", "#fdd2b0", "#fed3b0", "#ffd2b1", "#ffd3af", "#fed3b0"], "lift": 0.008},
  "station": {"v": "b188941426", "has": ["neutral", "happy", "sad", "love", "surprised", "moved", "pout", "thinking", "worried"], "bg": ["#83a7e5", "#83a6e6", "#83a6e6", "#83a6e4", "#83a7e5", "#83a6e7", "#83a6e5", "#83a6e6", "#83a7e5"], "lift": 0.011}
};
