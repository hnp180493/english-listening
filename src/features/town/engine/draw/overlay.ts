// What is drawn in SCREEN pixels, around and over the world: the sky behind the island, name tags and the marker
// over a resident's head, emotes, particles. Text here is never smaller than 13 CSS px, whatever the zoom.

import type { Pt } from '../iso';
import type { TownPalette } from '../palette';
import { particleAlpha, type Particle } from '../particles';
import type { Marker } from '../sim';
import { hash, heartPath, oval, roundRect, sparkPath } from './util';

export type EmoteKind = 'heart' | 'sparkle' | 'question' | 'coins';

/** How long an emote stays, in seconds. */
export const EMOTE_SECONDS = 1.5;

export function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number, pal: TownPalette, t: number, still: boolean): void {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, pal.skyTop);
  grad.addColorStop(1, pal.skyBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  if (pal.night) {
    for (let i = 0; i < 70; i++) {
      const x = hash(i, 1) * w;
      const y = hash(i, 2) * h;
      const tw = still ? 0.7 : 0.55 + 0.45 * Math.sin(t * (0.6 + hash(i, 3)) + i);
      ctx.globalAlpha = tw * (0.35 + hash(i, 4) * 0.5);
      oval(ctx, x, y, 0.7 + hash(i, 5) * 0.9, 0.7 + hash(i, 5) * 0.9, pal.star);
    }
    ctx.globalAlpha = 1;
  }
  // soft shapes drifting by: clouds by day, a faint haze at night
  for (let i = 0; i < 5; i++) {
    const speed = still ? 0 : 3 + hash(i, 6) * 4;
    const span = w + 320;
    const x = ((hash(i, 7) * span + t * speed) % span) - 160;
    const y = (0.08 + hash(i, 8) * 0.84) * h;
    const s = 0.7 + hash(i, 9) * 0.8;
    ctx.fillStyle = pal.cloud;
    for (const [dx, dy, rx, ry] of [[0, 0, 60, 16], [-34, 6, 36, 12], [38, 5, 42, 13], [6, -10, 34, 14]] as const) {
      ctx.beginPath();
      ctx.ellipse(x + dx * s, y + dy * s, rx * s, ry * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** Darker corners at night, so the lit middle of the town draws the eye. */
export function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number, pal: TownPalette): void {
  if (!pal.night) return;
  const r = Math.hypot(w, h) / 2;
  const grad = ctx.createRadialGradient(w / 2, h / 2, r * 0.55, w / 2, h / 2, r);
  grad.addColorStop(0, 'rgba(10,12,36,0)');
  grad.addColorStop(1, 'rgba(10,12,36,0.42)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

export interface TagOptions {
  /** What floats over the tag. */
  marker?: Marker;
  hover?: boolean;
  /** The player's own tag: quieter. */
  self?: boolean;
  t: number;
  still: boolean;
  font: string;
}

/**
 * A name tag centred on `x`, its bottom edge at `y` (screen pixels), with the marker above it: "!" = lines not yet
 * understood, "…" = only repeats left, a heart = all understood on the first listen.
 */
export function drawTag(ctx: CanvasRenderingContext2D, pal: TownPalette, x: number, y: number, text: string, o: TagOptions): void {
  ctx.font = `600 13px ${o.font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = Math.ceil(ctx.measureText(text).width) + 16;
  const h = 21;
  const left = Math.round(x - w / 2);
  const top = Math.round(y - h);
  ctx.shadowColor = 'rgba(0,0,0,0.22)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  roundRect(ctx, left, top, w, h, h / 2);
  ctx.fillStyle = o.hover ? (pal.night ? 'rgba(52,58,104,0.96)' : '#ffffff') : pal.tagBg;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  if (o.hover) {
    roundRect(ctx, left, top, w, h, h / 2);
    ctx.strokeStyle = pal.night ? '#ffe9a8' : '#6d6af0';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.fillStyle = o.self ? pal.tagMuted : pal.tagText;
  ctx.fillText(text, x, top + h / 2 + 0.5);
  if (!o.marker) return;
  const bob = o.still ? 0 : Math.sin(o.t * 3 + x * 0.05) * 2;
  const my = top - 15 + bob;
  if (o.marker === 'heart') {
    heartPath(ctx, x, my, 7);
    ctx.fillStyle = '#ff6f91';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    return;
  }
  // a speech bubble with "!" (new lines) or "…" (repeats only)
  const fresh = o.marker === 'new';
  ctx.beginPath();
  ctx.arc(x, my, 10, 0, Math.PI * 2);
  ctx.moveTo(x - 4, my + 8);
  ctx.lineTo(x, my + 14);
  ctx.lineTo(x + 4, my + 8);
  ctx.closePath();
  ctx.fillStyle = fresh ? '#ffb020' : pal.night ? '#4a5080' : '#ffffff';
  ctx.fill();
  if (!fresh) {
    ctx.strokeStyle = pal.night ? '#7a82b8' : '#c9cde0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, my, 10, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (fresh) {
    ctx.fillStyle = '#3a2500';
    roundRect(ctx, x - 1.6, my - 6, 3.2, 8, 1.4);
    ctx.fill();
    oval(ctx, x, my + 4.6, 1.8, 1.8, '#3a2500');
  } else {
    for (const dx of [-4.2, 0, 4.2]) oval(ctx, x + dx, my, 1.5, 1.5, pal.night ? '#d8dcf4' : '#7a8098');
  }
}

/** An emote rising over a head. `age` in seconds since it started, `at` = the top of the head on the screen. */
export function drawEmote(ctx: CanvasRenderingContext2D, kind: EmoteKind, at: Pt, age: number, still: boolean): void {
  const k = Math.min(1, age / EMOTE_SECONDS);
  // pop in, drift up, fade out
  const pop = still ? 1 : Math.min(1, age / 0.16);
  const scale = pop * (1 + (still ? 0 : 0.12 * Math.sin(age * 9) * (1 - k)));
  const rise = still ? 30 : 26 + k * 22;
  const fade = k < 0.7 ? 1 : Math.max(0, (1 - k) / 0.3);
  const x = at.x;
  const y = at.y - rise;
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (kind === 'heart') {
    heartPath(ctx, 0, 0, 10);
    ctx.fillStyle = '#ff6f91';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    oval(ctx, -4, -4, 2.2, 1.6, 'rgba(255,255,255,0.8)');
  } else if (kind === 'sparkle') {
    for (const [dx, dy, s] of [[0, 0, 10], [-13, 7, 5], [12, 9, 6]] as const) {
      sparkPath(ctx, dx, dy, s);
      ctx.fillStyle = '#ffe07a';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  } else if (kind === 'question') {
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#c9cde0';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -2.5, 4.2, Math.PI * 1.05, Math.PI * 0.42);
    ctx.lineTo(0.4, 3.2);
    ctx.strokeStyle = '#6d6af0';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    oval(ctx, 0.4, 7, 1.7, 1.7, '#6d6af0');
  } else {
    for (const [dx, dy] of [[-10, 4], [0, -4], [10, 4]] as const) drawCoin(ctx, dx, dy + (still ? 0 : Math.sin(age * 10 + dx) * 2), 6.5, 0);
  }
  ctx.restore();
}

function drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number): void {
  // a coin turning on its axis: its width breathes
  const w = Math.max(0.25, Math.abs(Math.cos(rot)));
  oval(ctx, x, y, r * w, r, '#e8a11a');
  oval(ctx, x, y - 0.6, r * w * 0.82, r * 0.82, '#ffd24a');
  oval(ctx, x - r * w * 0.25, y - r * 0.3, r * w * 0.22, r * 0.3, 'rgba(255,255,255,0.75)');
}

/** How long a floating text stays, in seconds. */
export const FLOAT_SECONDS = 1.3;

/** A short text ("+3") with a coin, rising over a head and fading. `at` = the top of the head on the screen. */
export function drawFloat(ctx: CanvasRenderingContext2D, text: string, at: Pt, age: number, still: boolean, font: string): void {
  const k = Math.min(1, age / FLOAT_SECONDS);
  const pop = still ? 1 : Math.min(1, age / 0.14);
  const fade = k < 0.65 ? 1 : Math.max(0, (1 - k) / 0.35);
  const y = at.y - 44 - (still ? 0 : k * 30);
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(at.x, y);
  ctx.scale(0.6 + 0.4 * pop, 0.6 + 0.4 * pop);
  ctx.font = `700 17px ${font}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width;
  const total = w + 20;
  const left = -total / 2;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(40,26,0,0.85)';
  ctx.strokeText(text, left, 0.5);
  ctx.fillStyle = '#ffd24a';
  ctx.fillText(text, left, 0.5);
  oval(ctx, left + w + 12, 0, 8, 8, 'rgba(40,26,0,0.85)');
  drawCoin(ctx, left + w + 12, 0, 6.5, 0);
  ctx.restore();
}

/**
 * The bubble over the head of whoever is speaking: no words (the learner has to HEAR them), only bars moving like
 * a voice. Centred on `x`, its tail ending at `y`.
 */
export function drawTalkBubble(ctx: CanvasRenderingContext2D, pal: TownPalette, x: number, y: number, t: number, still: boolean): void {
  const w = 46;
  const h = 30;
  const left = Math.round(x - w / 2);
  const top = Math.round(y - h - 7);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = pal.night ? '#f4f5ff' : '#ffffff';
  roundRect(ctx, left, top, w, h, 12);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.beginPath();
  ctx.moveTo(x - 6, top + h - 1);
  ctx.lineTo(x, top + h + 7);
  ctx.lineTo(x + 6, top + h - 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#6d6af0';
  const bars = 5;
  for (let i = 0; i < bars; i++) {
    const wave = still ? 0.55 + 0.25 * Math.sin(i * 1.9) : 0.5 + 0.5 * Math.sin(t * (7.5 + i * 1.3) + i * 1.7);
    const bh = 5 + wave * 13;
    roundRect(ctx, x - 14 + i * 6.2, top + h / 2 - bh / 2, 3.4, bh, 1.7);
    ctx.fill();
  }
  ctx.restore();
}

const DUST = ['rgba(236,226,204,1)', 'rgba(214,202,181,1)'];
const CONFETTI = ['#ff8fab', '#ffd76b', '#7ad1c2', '#8fb8ff', '#c9b1ff', '#ff9f6b'];
const SPARKS = ['#ffe07a', '#ffffff', '#ffc2d4'];
const PETALS = ['#ffd3e2', '#f7a8c6'];

export function drawParticles(ctx: CanvasRenderingContext2D, list: readonly Particle[]): void {
  for (const p of list) {
    const a = particleAlpha(p);
    if (a <= 0) continue;
    ctx.globalAlpha = a;
    if (p.kind === 'coin') {
      drawCoin(ctx, p.x, p.y, p.size, p.rot);
    } else if (p.kind === 'confetti') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.cos(p.rot * 1.7));
      ctx.fillStyle = CONFETTI[p.tint % CONFETTI.length];
      ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size / 1.5);
      ctx.restore();
    } else if (p.kind === 'dust') {
      oval(ctx, p.x, p.y, p.size, p.size * 0.8, DUST[p.tint % DUST.length]);
    } else if (p.kind === 'spark') {
      sparkPath(ctx, p.x, p.y, p.size);
      ctx.fillStyle = SPARKS[p.tint % SPARKS.length];
      ctx.fill();
    } else {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      oval(ctx, 0, 0, p.size, p.size * 0.55, PETALS[p.tint % PETALS.length]);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}
