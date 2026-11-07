// "Gợi ý": reveal only the first letter of each word, e.g. "What do you want" → "W___ d_ y__ w___".

function maskWord(raw: string): string {
  let seenFirst = false;
  let out = '';
  for (const ch of raw) {
    if (/[\p{L}\p{N}]/u.test(ch)) {
      out += seenFirst ? '_' : ch;
      seenFirst = true;
    } else {
      out += ch; // keep apostrophes / punctuation so the shape is visible
    }
  }
  return out;
}

export function makeHint(tokens: readonly string[]): string {
  return tokens.map(maskWord).join(' ');
}
