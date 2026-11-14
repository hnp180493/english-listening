// The little people of the town: a round head, hair or a hat, a coloured body, tiny legs and a shadow, with a walk
// cycle (bob + leg swing) and a face that looks left or right. World pixels; colours are game art (palette.ts).

import type { PlaceId } from '../../../../data/townWorld';
import type { Actor } from '../sim';
import { hash, line, oval, P, poly, roundRect, type G } from './util';

export type HairStyle = 'short' | 'bob' | 'long' | 'bun' | 'pony' | 'curly' | 'cap' | 'beanie' | 'flat';
export type Extra = 'apron' | 'glasses' | 'scarf' | 'coat' | 'flower' | 'headphones' | 'backpack' | 'moustache' | 'tie';

export interface CharacterLook {
  skin: string;
  hair: string;
  style: HairStyle;
  top: string;
  bottom: string;
  /** Hat colour for the hat styles; accent of the extra otherwise. */
  accent?: string;
  extras?: readonly Extra[];
}

/** How much bigger than the base drawing (about 33 px tall) a person is. */
export const CHARACTER_SCALE = 1.22;
/** Top of the head above the feet, in world pixels (name tags sit above this). */
export const CHARACTER_HEIGHT = 36 * CHARACTER_SCALE;

export const PLAYER_LOOK: CharacterLook = {
  skin: '#f6cfa8',
  hair: '#3a3350',
  style: 'short',
  top: '#6d6af0',
  bottom: '#3d4270',
  accent: '#ffc93c',
  extras: ['backpack', 'scarf'],
};

export const RESIDENT_LOOK: Readonly<Record<PlaceId, CharacterLook>> = {
  square: { skin: '#f3c9a0', hair: '#7a4a2b', style: 'short', top: '#f2a541', bottom: '#5a6a8c', accent: '#ef6b5b', extras: ['scarf'] },
  cafe: { skin: '#f8d6b8', hair: '#b5532f', style: 'bun', top: '#3fb7a6', bottom: '#6b5a4a', extras: ['apron'] },
  friend: { skin: '#f6cfa8', hair: '#f08fb4', style: 'pony', top: '#ff9fbd', bottom: '#8a6fd0' },
  home: { skin: '#f1c7a2', hair: '#d8d8e4', style: 'bun', top: '#8f73d6', bottom: '#5b5470', extras: ['glasses'] },
  shop: { skin: '#e2ad82', hair: '#4a3628', style: 'cap', top: '#7cc96a', bottom: '#5a6a8c', accent: '#f2a541', extras: ['apron'] },
  office: { skin: '#f6cfa8', hair: '#2b2a3a', style: 'long', top: '#5b8fd9', bottom: '#34405f', extras: ['glasses', 'tie'] },
  school: { skin: '#d9a47a', hair: '#2b2a3a', style: 'short', top: '#e0685a', bottom: '#4b5573', extras: ['glasses'] },
  station: { skin: '#f3c9a0', hair: '#5a4632', style: 'cap', top: '#356a9c', bottom: '#2f3f5c', accent: '#2f5f8f', extras: ['tie'] },
  clinic: { skin: '#f8d6b8', hair: '#3a2f2a', style: 'bob', top: '#63c7b2', bottom: '#6b7a8c', extras: ['coat'] },
  cinema: { skin: '#c98f66', hair: '#8f5fd6', style: 'curly', top: '#ffd76b', bottom: '#5b3f8f' },
  phone: { skin: '#f6cfa8', hair: '#3a3350', style: 'beanie', top: '#3f7fe0', bottom: '#2f3f5c', accent: '#35c7b8', extras: ['headphones'] },
  park: { skin: '#f8d6b8', hair: '#f3d37a', style: 'long', top: '#8fd16a', bottom: '#5a8f5a', accent: '#f58fb0', extras: ['flower'] },
  board: { skin: '#e9b98e', hair: '#b9b9c6', style: 'flat', top: '#a9b86a', bottom: '#6b5a4a', accent: '#8a6a4c', extras: ['moustache'] },
};

/** Draw one person at an actor's place. `seed` makes idle breathing and blinking differ between people. */
export function drawCharacter(g: G, a: Actor, look: CharacterLook, seed: number, isPlayer = false): void {
  const { ctx, pal } = g;
  const feet = P(a.x, a.y);
  const f = a.facing;
  const has = (e: Extra) => look.extras?.includes(e) ?? false;
  const ink = pal.ink;

  ctx.save();
  ctx.translate(feet.x, feet.y);
  ctx.scale(CHARACTER_SCALE, CHARACTER_SCALE);

  // shadow, and the ring that says "this one is you"
  oval(ctx, 0, 0.6, 8.6, 3.5, pal.shadow);
  if (isPlayer) {
    const pulse = g.still ? 0 : Math.sin(g.t * 3) * 0.8;
    ctx.globalAlpha = 0.9;
    oval(ctx, 0, 0.6, 11 + pulse, 4.8 + pulse * 0.4, undefined, pal.night ? pal.lampOn : '#ffffff', 1.6);
    ctx.globalAlpha = 1;
  }

  const swing = a.moving ? Math.sin(a.phase) : 0;
  const bob = a.moving ? -Math.abs(Math.sin(a.phase)) * 1.5 : g.still ? 0 : -Math.sin(g.t * 2 + seed * 7) * 0.45 - 0.2;

  // legs
  const legs: [number, number][] = [
    [-2.7 + swing * 1.8 * f, swing > 0 ? -swing * 1.3 : 0],
    [2.7 - swing * 1.8 * f, swing < 0 ? swing * 1.3 : 0],
  ];
  for (const [lx, lift] of legs) {
    roundRect(ctx, lx - 1.9, -6.4 + lift, 3.8, 6.4, 1.6);
    ctx.fillStyle = ink(look.bottom);
    ctx.fill();
    oval(ctx, lx + 0.7 * f, -0.4 + lift, 2.5, 1.4, ink('#3a3350'));
  }

  const by = bob;
  const hy = -25.6 + by;
  const r = 8.9;
  const hair = ink(look.hair);
  const hairDark = ink(look.hair, -0.18);
  // hair that falls behind the head and the shoulders
  if (look.style === 'long') {
    roundRect(ctx, -9.8, hy - 5, 19.6, 18.5, 8);
    ctx.fillStyle = hairDark;
    ctx.fill();
  } else if (look.style === 'bob') {
    oval(ctx, 0, hy + 1.6, 10.2, 9.8, hairDark);
  } else if (look.style === 'pony') {
    ctx.save();
    ctx.translate(-f * 9.5, hy + 2);
    ctx.rotate(-f * 0.5);
    oval(ctx, 0, 3, 3.2, 7, hairDark);
    ctx.restore();
  } else if (look.style === 'curly') {
    for (let i = 0; i < 7; i++) {
      const ang = Math.PI + (i / 6) * Math.PI;
      oval(ctx, Math.cos(ang) * 8.8, hy + Math.sin(ang) * 7.6, 4.4, 4.4, hairDark);
    }
  }
  // backpack, behind the body
  if (has('backpack')) {
    roundRect(ctx, -f * 9.4 - 2.2, -17 + by, 4.4, 9.5, 2);
    ctx.fillStyle = ink(look.accent ?? '#ffc93c');
    ctx.fill();
  }
  // far arm
  oval(ctx, -f * 6.4, -11 + by - swing * 1.4, 2.3, 3.2, ink(look.top, -0.12));
  // body
  roundRect(ctx, -6.6, -18 + by, 13.2, 13, 5.2);
  ctx.fillStyle = ink(look.top);
  ctx.fill();
  if (has('coat')) {
    roundRect(ctx, -6.6, -18 + by, 13.2, 13, 5.2);
    ctx.fillStyle = ink('#ffffff');
    ctx.fill();
    ctx.fillStyle = ink(look.top);
    ctx.fillRect(-1.3 + f * 1, -17.5 + by, 2.6, 6);
    line(ctx, [{ x: f * 1, y: -12 + by }, { x: f * 1, y: -5.4 + by }], ink('#c9d3dc'), 0.9);
  }
  if (has('apron')) {
    roundRect(ctx, -4 + f * 1, -13.6 + by, 8, 8.4, 2);
    ctx.fillStyle = ink('#fffaf0');
    ctx.fill();
  }
  if (has('tie')) {
    poly(ctx, [{ x: f * 1.4 - 1.2, y: -17 + by }, { x: f * 1.4 + 1.2, y: -17 + by }, { x: f * 1.4, y: -10.5 + by }], ink('#ef6b5b'));
  }
  // near arm, with a hand
  oval(ctx, f * 6.2, -11 + by + swing * 1.4, 2.4, 3.3, ink(look.top, 0.08));
  oval(ctx, f * 6.4, -8 + by + swing * 1.6, 1.6, 1.6, ink(look.skin));
  if (has('scarf')) {
    roundRect(ctx, -5.6, -19 + by, 11.2, 3.6, 1.8);
    ctx.fillStyle = ink(look.accent ?? '#ef6b5b');
    ctx.fill();
    roundRect(ctx, -f * 4.6 - 1.5, -17 + by, 3, 6, 1.4);
    ctx.fill();
  }

  // head
  if (has('headphones')) {
    ctx.beginPath();
    ctx.arc(0, hy, r + 1.6, Math.PI * 1.08, Math.PI * 1.92);
    ctx.strokeStyle = ink(look.accent ?? '#35c7b8');
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  oval(ctx, 0, hy, r, r * 0.96, ink(look.skin));
  // ear on the far side
  oval(ctx, -f * 8.2, hy + 1, 1.6, 2.1, ink(look.skin, -0.08));

  // face
  const fx = f * 1.9;
  const blink = !g.still && (g.t + hash(seed, 2) * 5) % (3.4 + hash(seed, 3) * 2) < 0.13;
  for (const e of [-1, 1]) {
    oval(ctx, fx + e * 3.2, hy + 0.9, 1.25, blink ? 0.3 : 1.55, ink('#2b2a3a'));
    if (!blink) oval(ctx, fx + e * 3.2 + 0.4, hy + 0.4, 0.45, 0.45, '#ffffff');
  }
  ctx.globalAlpha = 0.55;
  for (const e of [-1, 1]) oval(ctx, fx + e * 5.6, hy + 3.4, 1.9, 1.2, ink('#ff9fae'));
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(fx, hy + 3.2, 1.7, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.strokeStyle = ink('#9c5a4a');
  ctx.lineWidth = 0.9;
  ctx.lineCap = 'round';
  ctx.stroke();
  if (has('moustache')) {
    oval(ctx, fx - 1.7, hy + 3.2, 2.1, 1, hair);
    oval(ctx, fx + 1.7, hy + 3.2, 2.1, 1, hair);
  }
  if (has('glasses')) {
    for (const e of [-1, 1]) oval(ctx, fx + e * 3.2, hy + 0.9, 2.5, 2.4, undefined, ink('#3a3350'), 0.8);
    line(ctx, [{ x: fx - 0.8, y: hy + 0.9 }, { x: fx + 0.8, y: hy + 0.9 }], ink('#3a3350'), 0.8);
  }

  // hair on top / hats
  const cap = (top: number, fringe: number, fill: string) => {
    ctx.beginPath();
    ctx.arc(0, hy, r + 0.6, Math.PI + top, -top);
    ctx.quadraticCurveTo(fx * 1.6, hy - fringe, -(r + 0.6) * Math.cos(top), hy - (r + 0.6) * Math.sin(top));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };
  switch (look.style) {
    case 'short':
      cap(0.1, 7.5, hair);
      break;
    case 'bob':
    case 'long':
      cap(-0.08, 6, hair);
      break;
    case 'pony':
      cap(0.05, 6.5, hair);
      break;
    case 'bun':
      oval(ctx, 0, hy - r - 1.2, 3.8, 3.5, hairDark);
      cap(0.08, 7, hair);
      break;
    case 'curly':
      for (let i = 0; i < 6; i++) {
        const ang = Math.PI * 1.08 + (i / 5) * Math.PI * 0.84;
        oval(ctx, Math.cos(ang) * 7.4, hy + Math.sin(ang) * 7, 4.1, 4, hair);
      }
      break;
    case 'cap': {
      cap(0.2, 7.5, ink(look.accent ?? '#f2a541'));
      roundRect(ctx, f > 0 ? 1 : -11.5, hy - 5.6, 10.5, 2.8, 1.4);
      ctx.fillStyle = ink(look.accent ?? '#f2a541', -0.18);
      ctx.fill();
      break;
    }
    case 'beanie': {
      cap(0.16, 8.4, ink(look.accent ?? '#35c7b8'));
      roundRect(ctx, -9.4, hy - 5.8, 18.8, 3.6, 1.8);
      ctx.fillStyle = ink(look.accent ?? '#35c7b8', 0.25);
      ctx.fill();
      oval(ctx, 0, hy - r - 1.6, 2.6, 2.6, ink('#ffffff'));
      break;
    }
    case 'flat': {
      // a flat cap, grey hair under it
      oval(ctx, -f * 6.8, hy - 0.4, 2.4, 3.6, hair);
      ctx.beginPath();
      ctx.ellipse(0, hy - 5.2, r + 1.2, 4.6, 0, Math.PI, 0);
      ctx.closePath();
      ctx.fillStyle = ink(look.accent ?? '#8a6a4c');
      ctx.fill();
      roundRect(ctx, f > 0 ? 2 : -12, hy - 6, 10, 2.4, 1.2);
      ctx.fillStyle = ink(look.accent ?? '#8a6a4c', -0.2);
      ctx.fill();
      break;
    }
  }
  if (has('headphones')) oval(ctx, f * 8.6 * -1, hy + 1, 2.4, 3.2, ink(look.accent ?? '#35c7b8'));
  if (has('flower')) {
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2;
      oval(ctx, -f * 5.5 + Math.cos(ang) * 2, hy - 6.5 + Math.sin(ang) * 2, 1.5, 1.5, ink(look.accent ?? '#f58fb0'));
    }
    oval(ctx, -f * 5.5, hy - 6.5, 1.1, 1.1, ink('#ffd76b'));
  }
  ctx.restore();
}
