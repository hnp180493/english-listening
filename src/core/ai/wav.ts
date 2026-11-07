// Audio helpers for TTS responses: base64 decoding, raw PCM (audio/L16) → WAV, WAV sniffing.

export interface PcmFormat {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
}

/** Gemini TTS: 24 kHz, mono, 16-bit signed little-endian. */
export const GEMINI_PCM: PcmFormat = { sampleRate: 24000, channels: 1, bitsPerSample: 16 };

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/[\r\n\s]/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** True when bytes start with a RIFF/WAVE header. */
export function isWav(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // RIFF
    bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45 // WAVE
  );
}

/**
 * Reads the PCM format from a mime type like "audio/L16;codec=pcm;rate=24000" (or "audio/pcm;
 * rate=16000; channels=2"), falling back to `fallback` for missing parameters.
 */
export function parsePcmMime(mime: string | undefined, fallback: PcmFormat = GEMINI_PCM): PcmFormat {
  const fmt = { ...fallback };
  if (!mime) return fmt;
  const m = mime.toLowerCase();
  const rate = /(?:^|;)\s*rate\s*=\s*(\d+)/.exec(m);
  if (rate) fmt.sampleRate = Number(rate[1]);
  const ch = /(?:^|;)\s*channels\s*=\s*(\d+)/.exec(m);
  if (ch) fmt.channels = Number(ch[1]);
  const bits = /audio\/l(8|16|24|32)\b/.exec(m);
  if (bits) fmt.bitsPerSample = Number(bits[1]);
  return fmt;
}

/** Wraps little-endian PCM samples in a 44-byte canonical WAV header. */
export function pcmToWav(pcm: Uint8Array, fmt: PcmFormat = GEMINI_PCM): Uint8Array {
  const { sampleRate, channels, bitsPerSample } = fmt;
  const blockAlign = channels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  // A trailing partial sample frame would make the data chunk invalid; drop it.
  const dataLen = pcm.length - (pcm.length % blockAlign);
  const out = new Uint8Array(44 + dataLen);
  const v = new DataView(out.buffer);
  const ascii = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) out[off + i] = s.charCodeAt(i);
  };
  ascii(0, 'RIFF');
  v.setUint32(4, 36 + dataLen, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  v.setUint32(16, 16, true); // fmt chunk size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, channels, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, byteRate, true);
  v.setUint16(32, blockAlign, true);
  v.setUint16(34, bitsPerSample, true);
  ascii(36, 'data');
  v.setUint32(40, dataLen, true);
  out.set(pcm.subarray(0, dataLen), 44);
  return out;
}

/** Decodes base64 audio from a provider into a playable Blob (passes WAV through, wraps raw PCM). */
export function audioBlobFromBase64(b64: string, mime: string | undefined): { audio: Blob; mime: string } {
  const bytes = base64ToBytes(b64);
  const m = (mime ?? '').toLowerCase();
  if (isWav(bytes)) return { audio: new Blob([bytes as BlobPart], { type: 'audio/wav' }), mime: 'audio/wav' };
  if (!m || m.includes('l16') || m.includes('pcm') || m.includes('raw')) {
    const wav = pcmToWav(bytes, parsePcmMime(mime));
    return { audio: new Blob([wav as BlobPart], { type: 'audio/wav' }), mime: 'audio/wav' };
  }
  const type = m.split(';')[0].trim();
  return { audio: new Blob([bytes as BlobPart], { type }), mime: type };
}

/** Duration in seconds of a PCM WAV (reads the fmt byte rate and the data chunk size), or null when unknown. */
export function wavDurationSec(bytes: Uint8Array): number | null {
  if (!isWav(bytes)) return null;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let byteRate = 0;
  let off = 12;
  while (off + 8 <= bytes.length) {
    const id = String.fromCharCode(bytes[off], bytes[off + 1], bytes[off + 2], bytes[off + 3]);
    const size = v.getUint32(off + 4, true);
    const body = off + 8;
    if (id === 'fmt ' && body + 12 <= bytes.length) byteRate = v.getUint32(body + 8, true);
    if (id === 'data') {
      if (!byteRate) return null;
      // streamed WAVs may carry 0 / 0xFFFFFFFF as the size: use what is actually there
      const len = size === 0 || size === 0xffffffff || body + size > bytes.length ? bytes.length - body : size;
      return Math.max(0, len) / byteRate;
    }
    off = body + size + (size % 2);
  }
  return null;
}
