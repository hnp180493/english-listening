// Everything in the town that is not a house or a person: trees, the fountain, lamps, benches, flower beds, the
// stall, balloons, flags, string lights, lilies, the bus, the café's parasol and the cat. World pixels; colours
// are game art (palette.ts).

import type { Pt } from '../iso';
import { alpha, ART } from '../palette';
import type { Cat } from '../sim';
import { glow, hash, isoBox, line, oval, P, poly, roundRect, sway, type G } from './util';

// ───────────────────────── trees ─────────────────────────

export type TreeLook = 'round' | 'pine' | 'blossom';

export function drawTree(g: G, x: number, y: number, look: TreeLook): void {
  const { ctx, pal } = g;
  const c = P(x + 0.5, y + 0.5);
  const size = 0.92 + hash(x, y, 3) * 0.26;
  const lean = sway(g, 1.1 + hash(x, y) * 0.5, x * 1.7 + y, 1.6);
  if (look === 'pine') {
    line(ctx, [{ x: c.x, y: c.y + 1 }, { x: c.x, y: c.y - 12 }], pal.ink(ART.trunk), 4.4);
    const tiers = [
      { w: 15, y0: -8, y1: -30 },
      { w: 12.5, y0: -22, y1: -44 },
      { w: 9.5, y0: -36, y1: -58 },
    ];
    tiers.forEach((t, i) => {
      const k = (i + 1) / 3;
      const dx = lean * k;
      const w = t.w * size;
      const y0 = c.y + t.y0 * size;
      const y1 = c.y + t.y1 * size;
      const tri = (shade: number, half: boolean) => {
        ctx.beginPath();
        ctx.moveTo(c.x + dx, y1);
        ctx.quadraticCurveTo(c.x + w * 0.5 + dx, (y0 + y1) / 2, c.x + w + dx * 0.6, y0);
        ctx.quadraticCurveTo(c.x + w * 0.4, y0 + 4, c.x + dx * 0.4, y0 + 3);
        if (!half) {
          ctx.quadraticCurveTo(c.x - w * 0.4, y0 + 4, c.x - w + dx * 0.6, y0);
          ctx.quadraticCurveTo(c.x - w * 0.5 + dx, (y0 + y1) / 2, c.x + dx, y1);
        }
        ctx.closePath();
        ctx.fillStyle = pal.ink(ART.pine, shade);
        ctx.fill();
      };
      tri(0.06, false);
      tri(-0.2, true);
    });
    return;
  }
  const blossom = look === 'blossom';
  const base = blossom ? ART.blossom : hash(x, y, 9) > 0.5 ? ART.leaf : '#7cc96a';
  const dark = blossom ? '#e98bb0' : ART.leafDark;
  // trunk, with two little branches
  line(ctx, [{ x: c.x, y: c.y + 1 }, { x: c.x + lean * 0.3, y: c.y - 20 * size }], pal.ink(blossom ? '#7a5544' : ART.trunk), 5);
  line(ctx, [{ x: c.x, y: c.y - 12 * size }, { x: c.x - 7 + lean * 0.5, y: c.y - 22 * size }], pal.ink(blossom ? '#7a5544' : ART.trunk), 2.6);
  const blobs: [number, number, number][] = [
    [0, -36, 17],
    [-12, -28, 12],
    [12, -29, 12.5],
    [-5, -45, 11],
    [8, -43, 10],
  ];
  // shaded underside first, then the lit leaves a little up and to the left
  for (const [bx, by, r] of blobs) oval(ctx, c.x + bx * size + lean, c.y + by * size + 2.5, r * size, r * size * 0.94, pal.ink(dark));
  for (const [bx, by, r] of blobs) oval(ctx, c.x + bx * size + lean - 1.5, c.y + by * size - 1, r * size * 0.92, r * size * 0.86, pal.ink(base));
  oval(ctx, c.x - 6 * size + lean, c.y - 42 * size, 8 * size, 6.5 * size, pal.ink(base, 0.22));
  if (blossom) {
    for (let i = 0; i < 9; i++) {
      const a = hash(x + i, y, 21) * Math.PI * 2;
      const d = hash(x, y + i, 22) * 15 * size;
      oval(ctx, c.x + Math.cos(a) * d + lean, c.y - 36 * size + Math.sin(a) * d * 0.8, 2, 1.8, pal.ink(ART.blossomLight));
    }
  } else if (hash(x, y, 31) > 0.7) {
    // some trees carry fruit
    for (let i = 0; i < 4; i++) {
      const a = hash(x + i, y, 41) * Math.PI * 2;
      const d = 5 + hash(x, y + i, 42) * 9 * size;
      oval(ctx, c.x + Math.cos(a) * d + lean, c.y - 34 * size + Math.sin(a) * d * 0.7, 1.9, 1.9, pal.ink('#ff8f6b'));
    }
  }
}

// ───────────────────────── the fountain ─────────────────────────

export function drawFountain(g: G, x: number, y: number, big: boolean): void {
  const { ctx, pal } = g;
  const c = P(x + 0.5, y + 0.5);
  const r = big ? 0.78 : 0.62;
  const rx = r * 45.25;
  const ry = r * 22.63;
  const wall = 9;
  oval(ctx, c.x + 5, c.y + 2, rx + 3, ry + 1.5, pal.shadow);
  // basin: side, rim, water
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, rx, ry, 0, 0, Math.PI);
  ctx.lineTo(c.x - rx, c.y - wall);
  ctx.ellipse(c.x, c.y - wall, rx, ry, 0, Math.PI, 0, true);
  ctx.closePath();
  const side = ctx.createLinearGradient(c.x - rx, 0, c.x + rx, 0);
  side.addColorStop(0, pal.ink(ART.stone, 0.1));
  side.addColorStop(1, pal.ink(ART.stoneDark, -0.1));
  ctx.fillStyle = side;
  ctx.fill();
  oval(ctx, c.x, c.y - wall, rx, ry, pal.ink(ART.stone, 0.3));
  oval(ctx, c.x, c.y - wall + 1, rx - 4.5, ry - 2.3, pal.ink(ART.water));
  oval(ctx, c.x + 2, c.y - wall + 2, rx - 10, ry - 5, pal.ink(ART.waterDeep));
  // rings spreading on the water
  for (let i = 0; i < 2; i++) {
    const k = g.still ? 0.5 + i * 0.3 : (g.t * 0.5 + i / 2) % 1;
    ctx.globalAlpha = (1 - k) * 0.7;
    oval(ctx, c.x, c.y - wall + 1, (rx - 6) * (0.3 + 0.7 * k), (ry - 3) * (0.3 + 0.7 * k), undefined, pal.ink(ART.waterShine), 1.2);
  }
  ctx.globalAlpha = 1;
  // the pillar and its bowl(s)
  const bowlZ = wall + (big ? 20 : 15);
  const column = (z0: number, z1: number, w: number) => {
    ctx.fillStyle = pal.ink(ART.stone);
    ctx.fillRect(c.x - w, c.y - z1, w * 2, z1 - z0);
    ctx.fillStyle = pal.ink(ART.stoneDark, -0.05);
    ctx.fillRect(c.x + w * 0.2, c.y - z1, w * 0.8, z1 - z0);
  };
  const bowl = (z: number, w: number) => {
    ctx.beginPath();
    ctx.ellipse(c.x, c.y - z, w, w * 0.5, 0, 0, Math.PI);
    ctx.quadraticCurveTo(c.x, c.y - z + w * 1.1, c.x + w, c.y - z);
    ctx.fillStyle = pal.ink(ART.stoneDark);
    ctx.fill();
    oval(ctx, c.x, c.y - z, w, w * 0.5, pal.ink(ART.stone, 0.3));
    oval(ctx, c.x, c.y - z + 0.5, w - 2.5, w * 0.5 - 1.3, pal.ink(ART.water));
  };
  column(wall - 2, bowlZ, 3.4);
  bowl(bowlZ, big ? 15 : 12);
  let topZ = bowlZ;
  if (big) {
    column(bowlZ, bowlZ + 15, 2.4);
    bowl(bowlZ + 15, 8.5);
    topZ = bowlZ + 15;
  }
  // water: drops falling in arcs from the top bowl into the basin, and a jet on top
  const drop = pal.ink(ART.waterShine, pal.night ? 0.1 : 0);
  const arcs = big ? 8 : 6;
  for (let a = 0; a < arcs; a++) {
    const ang = (a / arcs) * Math.PI * 2 + 0.3;
    for (let j = 0; j < 5; j++) {
      const k = g.still ? (j + 0.5) / 5 : (g.t * 0.9 + j / 5 + a * 0.13) % 1;
      const reach = (big ? 0.72 : 0.66) * k;
      const z = topZ * (1 - k) + (wall - 2) * k + 14 * 4 * k * (1 - k) * 0.5;
      const px = c.x + Math.cos(ang) * rx * reach;
      const py = c.y + Math.sin(ang) * ry * reach - z;
      ctx.globalAlpha = 0.35 + 0.5 * (1 - k);
      oval(ctx, px, py, 1.5, 1.9, drop);
    }
  }
  const jet = big ? 16 : 9;
  for (let j = 0; j < 5; j++) {
    const k = g.still ? (j + 0.5) / 5 : (g.t * 1.3 + j / 5) % 1;
    ctx.globalAlpha = 0.9 - k * 0.6;
    oval(ctx, c.x + Math.sin(k * 9 + j) * 1.2, c.y - topZ - jet * Math.sin(k * Math.PI), 1.7, 2.2, drop);
  }
  ctx.globalAlpha = 1;
  if (pal.night) glow(g, c.x, c.y - wall - 6, rx * 1.2, ry * 1.8, big ? 0.34 : 0.2, 'rgba(140,220,255,1)');
}

// ───────────────────────── street furniture ─────────────────────────

export function drawLamp(g: G, x: number, y: number): void {
  const { ctx, pal } = g;
  const c = P(x + 0.5, y + 0.5);
  // the pool of light on the ground comes first: the post stands in it
  if (pal.night) glow(g, c.x, c.y, 78, 39, 0.5);
  oval(ctx, c.x + 4, c.y + 1, 7, 3, pal.shadow);
  oval(ctx, c.x, c.y, 4.2, 2.2, pal.ink(ART.iron));
  line(ctx, [c, { x: c.x, y: c.y - 44 }], pal.ink(ART.iron), 2.6);
  line(ctx, [{ x: c.x - 4, y: c.y - 44 }, { x: c.x + 4, y: c.y - 44 }], pal.ink(ART.iron), 2.2);
  // the lantern
  ctx.beginPath();
  ctx.moveTo(c.x - 4.4, c.y - 45);
  ctx.lineTo(c.x + 4.4, c.y - 45);
  ctx.lineTo(c.x + 5.6, c.y - 55);
  ctx.lineTo(c.x - 5.6, c.y - 55);
  ctx.closePath();
  ctx.fillStyle = pal.night ? pal.lampOn : pal.ink('#fff6d6');
  ctx.fill();
  ctx.strokeStyle = pal.ink(ART.iron);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  poly(ctx, [{ x: c.x - 7, y: c.y - 55 }, { x: c.x + 7, y: c.y - 55 }, { x: c.x, y: c.y - 61 }], pal.ink(ART.iron));
  if (pal.night) glow(g, c.x, c.y - 50, 46, 46, 0.8);
}

export function drawBench(g: G, x: number, y: number, dir: 'e' | 's' | 'w'): void {
  const { ctx, pal } = g;
  const c = P(x + 0.5, y + 0.5);
  oval(ctx, c.x + 4, c.y + 2, 20, 9, pal.shadow);
  const wood = '#c98f5e';
  if (dir === 's') {
    isoBox(g, x + 0.14, y + 0.33, x + 0.86, y + 0.4, 0, 16, wood);
    isoBox(g, x + 0.14, y + 0.4, x + 0.86, y + 0.66, 6, 9, wood);
    isoBox(g, x + 0.16, y + 0.6, x + 0.22, y + 0.66, 0, 6, ART.iron);
    isoBox(g, x + 0.78, y + 0.6, x + 0.84, y + 0.66, 0, 6, ART.iron);
  } else if (dir === 'e') {
    isoBox(g, x + 0.33, y + 0.14, x + 0.4, y + 0.86, 0, 16, wood);
    isoBox(g, x + 0.4, y + 0.14, x + 0.66, y + 0.86, 6, 9, wood);
    isoBox(g, x + 0.6, y + 0.16, x + 0.66, y + 0.22, 0, 6, ART.iron);
    isoBox(g, x + 0.6, y + 0.78, x + 0.66, y + 0.84, 0, 6, ART.iron);
  } else {
    isoBox(g, x + 0.34, y + 0.14, x + 0.6, y + 0.86, 6, 9, wood);
    isoBox(g, x + 0.34, y + 0.78, x + 0.4, y + 0.84, 0, 6, ART.iron);
    isoBox(g, x + 0.6, y + 0.14, x + 0.67, y + 0.86, 0, 16, wood);
  }
}

export function drawFlowerBed(g: G, x: number, y: number): void {
  const { ctx, pal } = g;
  const c = P(x + 0.5, y + 0.5);
  oval(ctx, c.x + 3, c.y + 2, 19, 9.5, pal.shadow);
  // a low stone ring, earth, flowers
  ctx.fillStyle = pal.ink(ART.stoneDark);
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, 17, 8.5, 0, 0, Math.PI);
  ctx.lineTo(c.x - 17, c.y - 5);
  ctx.ellipse(c.x, c.y - 5, 17, 8.5, 0, Math.PI, 0, true);
  ctx.closePath();
  ctx.fill();
  oval(ctx, c.x, c.y - 5, 17, 8.5, pal.ink(ART.stone, 0.2));
  oval(ctx, c.x, c.y - 5, 13.5, 6.6, pal.ink('#8a6a4c'));
  const inks = ['#ff8fab', '#ffd76b', '#ffffff', '#c9b1ff', '#ff9f6b'];
  const flowers: { px: number; py: number; col: string; h: number }[] = [];
  for (let i = 0; i < 11; i++) {
    const a = hash(x, y, 80 + i) * Math.PI * 2;
    const d = Math.sqrt(hash(y, x, 90 + i));
    flowers.push({ px: c.x + Math.cos(a) * d * 11, py: c.y - 5 + Math.sin(a) * d * 5, col: inks[Math.floor(hash(x + i, y, 99) * inks.length)], h: 5 + hash(x, y + i, 100) * 5 });
  }
  flowers.sort((a, b) => a.py - b.py);
  for (const f of flowers) {
    const s = sway(g, 1.6, f.px, 0.7);
    line(ctx, [{ x: f.px, y: f.py }, { x: f.px + s, y: f.py - f.h }], pal.ink(ART.leafDark), 1.3);
    oval(ctx, f.px - 2, f.py - f.h * 0.45, 2, 1.2, pal.ink(ART.leaf));
    oval(ctx, f.px + s, f.py - f.h, 2.8, 2.6, pal.ink(f.col));
    oval(ctx, f.px + s, f.py - f.h, 1, 1, pal.ink('#f2a541'));
  }
}

export function drawStall(g: G, x: number, y: number): void {
  const { ctx, pal } = g;
  const c = P(x + 0.5, y + 0.5);
  oval(ctx, c.x + 6, c.y + 3, 28, 13, pal.shadow);
  const x0 = x + 0.14;
  const x1 = x + 0.86;
  const y0 = y + 0.26;
  const y1 = y + 0.74;
  // back posts
  line(ctx, [P(x0, y0, 0), P(x0, y0, 40)], pal.ink(ART.woodDark), 2);
  line(ctx, [P(x1, y0, 0), P(x1, y0, 40)], pal.ink(ART.woodDark), 2);
  // the counter, with a cloth front
  isoBox(g, x0, y0 + 0.08, x1, y1, 0, 13, '#c98f5e', '#e8c79a');
  poly(ctx, [P(x0, y1, 2), P(x1, y1, 2), P(x1, y1, 11), P(x0, y1, 11)], pal.ink('#fffaf0'));
  for (let i = 0; i < 4; i++) {
    const u0 = x0 + ((x1 - x0) * (i * 2 + 0.5)) / 8;
    const u1 = x0 + ((x1 - x0) * (i * 2 + 1.5)) / 8;
    poly(ctx, [P(u0, y1, 2), P(u1, y1, 2), P(u1, y1, 11), P(u0, y1, 11)], pal.ink('#7ad1c2'));
  }
  // goods
  const goods = ['#ff9f43', '#ef6b5b', '#8fd16a', '#ffd76b', '#ff9f43', '#c9b1ff'];
  goods.forEach((col, i) => {
    const q = P(x0 + 0.1 + (i % 3) * 0.22, y0 + 0.24 + Math.floor(i / 3) * 0.2, 14);
    oval(ctx, q.x, q.y, 3.2, 2.8, pal.ink(col));
    oval(ctx, q.x - 1, q.y - 1, 1, 0.8, pal.ink('#ffffff'));
  });
  // front posts
  line(ctx, [P(x0, y1, 0), P(x0, y1, 33)], pal.ink(ART.woodDark), 2);
  line(ctx, [P(x1, y1, 0), P(x1, y1, 33)], pal.ink(ART.woodDark), 2);
  // the striped canopy, sloping towards the customer
  const o = 0.1;
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = x0 - o + ((x1 - x0 + o * 2) * i) / n;
    const b = x0 - o + ((x1 - x0 + o * 2) * (i + 1)) / n;
    const col = pal.ink(i % 2 === 0 ? '#f58fb0' : '#fffaf0');
    poly(ctx, [P(a, y0 - o, 42), P(b, y0 - o, 42), P(b, y1 + o, 33), P(a, y1 + o, 33)], col);
    const e0 = P(a, y1 + o, 33);
    const e1 = P(b, y1 + o, 33);
    oval(ctx, (e0.x + e1.x) / 2, (e0.y + e1.y) / 2 + 1.5, (e1.x - e0.x) / 2, 3, col);
  }
  poly(ctx, [P(x1 + o, y1 + o, 33), P(x1 + o, y0 - o, 42), P(x1 + o, y0 - o, 38), P(x1 + o, y1 + o, 29)], pal.ink('#f58fb0', -0.25));
  // a lantern under the canopy
  const l = P((x0 + x1) / 2, y1, 27);
  oval(ctx, l.x, l.y, 3, 3.4, pal.night ? pal.lampOn : pal.ink('#ffd76b'));
  if (pal.night) glow(g, l.x, l.y, 30, 28, 0.7);
}

/** The café's table under a parasol. */
export function drawTerrace(g: G, x: number, y: number): void {
  const { ctx, pal } = g;
  const c = P(x + 0.5, y + 0.55);
  oval(ctx, c.x + 5, c.y + 2, 22, 10, pal.shadow);
  // two stools and the table
  for (const dx of [-13, 13]) {
    line(ctx, [{ x: c.x + dx, y: c.y + 2 }, { x: c.x + dx, y: c.y - 4 }], pal.ink(ART.iron), 1.6);
    oval(ctx, c.x + dx, c.y - 5, 4.6, 2.4, pal.ink('#f58fb0'));
  }
  line(ctx, [c, { x: c.x, y: c.y - 10 }], pal.ink(ART.iron), 2);
  oval(ctx, c.x, c.y - 10, 9.5, 4.8, pal.ink('#fffaf0'));
  oval(ctx, c.x - 3, c.y - 11.5, 2, 1.5, pal.ink('#b0714a'));
  oval(ctx, c.x + 3.4, c.y - 10.4, 1.8, 1.3, pal.ink('#3fb7a6'));
  // the parasol: wedges from the tip to a round rim, far ones first
  line(ctx, [{ x: c.x, y: c.y - 10 }, { x: c.x, y: c.y - 42 }], pal.ink(ART.woodDark), 1.8);
  const tip = { x: c.x, y: c.y - 44 };
  const rimY = c.y - 31;
  const n = 8;
  const rim = (i: number): Pt => {
    const a = (i / n) * Math.PI * 2 + 0.2;
    return { x: c.x + Math.cos(a) * 23, y: rimY + Math.sin(a) * 9.5 };
  };
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => rim(a).y + rim(a + 1).y - (rim(b).y + rim(b + 1).y));
  for (const i of order) {
    const mid = (rim(i).x + rim(i + 1).x) / 2 - c.x;
    poly(ctx, [tip, rim(i), rim(i + 1)], pal.ink(i % 2 === 0 ? '#f58fb0' : '#fffaf0', mid > 4 ? -0.14 : mid < -4 ? 0.06 : 0));
  }
}

/** The bus at the end of the south road, nose towards the viewer. Covers tiles (x, y) and (x, y+1). */
export function drawBus(g: G, x: number, y: number): void {
  const { ctx, pal } = g;
  const b = { x0: x + 0.2, y0: y + 0.14, x1: x + 0.8, y1: y + 1.72 };
  poly(ctx, [P(b.x0 + 0.2, b.y0), P(b.x1 + 0.4, b.y0), P(b.x1 + 0.4, b.y1 + 0.05), P(b.x0, b.y1 + 0.05)], pal.shadow);
  const onX = (u: number, z: number) => P(b.x1, b.y1 - u * (b.y1 - b.y0), z);
  const onY = (u: number, z: number) => P(b.x0 + u * (b.x1 - b.x0), b.y1, z);
  // wheels
  for (const u of [0.2, 0.78]) {
    const w = onX(u, 4);
    oval(ctx, w.x + 1, w.y, 4.6, 5.2, pal.ink('#2b2f45'));
    oval(ctx, w.x + 1, w.y, 1.9, 2.2, pal.ink(ART.stone));
  }
  isoBox(g, b.x0, b.y0, b.x1, b.y1, 4, 16, '#f2b24c');
  isoBox(g, b.x0, b.y0, b.x1, b.y1, 16, 28, '#fff6e0', '#f7cf7e');
  // side windows and the door
  for (let i = 0; i < 4; i++) {
    const u0 = 0.2 + i * 0.2;
    poly(ctx, [onX(u0, 17.5), onX(u0 + 0.15, 17.5), onX(u0 + 0.15, 25), onX(u0, 25)], pal.night ? pal.windowLit : pal.ink('#9cc4ea', -0.1));
  }
  poly(ctx, [onX(0.04, 5), onX(0.15, 5), onX(0.15, 25), onX(0.04, 25)], pal.ink('#d98f2b'));
  // windscreen, lights, a smile of a bumper
  poly(ctx, [onY(0.1, 16.5), onY(0.9, 16.5), onY(0.9, 25.5), onY(0.1, 25.5)], pal.night ? pal.windowLit : pal.ink('#9cc4ea'));
  poly(ctx, [onY(0.06, 4), onY(0.94, 4), onY(0.94, 6.5), onY(0.06, 6.5)], pal.ink(ART.stone));
  for (const u of [0.2, 0.8]) {
    const h = onY(u, 10.5);
    oval(ctx, h.x, h.y, 2.3, 2.3, pal.night ? pal.lampOn : pal.ink('#fffaf0'));
    if (pal.night) glow(g, h.x - 6, h.y + 6, 22, 16, 0.45);
  }
}

export function drawLightPole(g: G, x: number, y: number): Pt {
  const { ctx, pal } = g;
  const c = P(x + 0.5, y + 0.5);
  oval(ctx, c.x + 3, c.y + 1, 6, 2.6, pal.shadow);
  line(ctx, [c, { x: c.x, y: c.y - 66 }], pal.ink(ART.wood), 3);
  oval(ctx, c.x, c.y - 67, 2.6, 2.6, pal.ink(ART.woodDark));
  return { x: c.x, y: c.y - 66 };
}

/** A string of coloured bulbs hanging between two points (world pixels). Drawn over the scene: it hangs high. */
export function drawStringLights(g: G, a: Pt, b: Pt, seed: number): void {
  const { ctx, pal } = g;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const sag = Math.min(22, len * 0.09);
  const at = (t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t + Math.sin(t * Math.PI) * sag });
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 + sag * 2, b.x, b.y);
  ctx.strokeStyle = pal.ink('#3a3550');
  ctx.lineWidth = 1;
  ctx.stroke();
  const inks = ['#ffd76b', '#ff8fab', '#8fd1ff', '#b8f08a'];
  const glows = ['rgba(255,215,107,1)', 'rgba(255,143,171,1)', 'rgba(143,209,255,1)', 'rgba(184,240,138,1)'];
  const n = Math.max(4, Math.round(len / 15));
  for (let i = 1; i < n; i++) {
    const q = at(i / n);
    const k = (i + seed) % inks.length;
    const tw = g.still ? 1 : 0.72 + 0.28 * Math.sin(g.t * 2 + i * 1.7 + seed);
    if (pal.night) glow(g, q.x, q.y + 2.5, 11, 11, 0.6 * tw, glows[k]);
    line(ctx, [q, { x: q.x, y: q.y + 1.5 }], pal.ink('#3a3550'), 1);
    oval(ctx, q.x, q.y + 3.4, 2.5, 3, pal.night ? alpha(inks[k], 0.75 + 0.25 * tw) : pal.ink(inks[k]));
  }
}

export function drawBalloons(g: G, x: number, y: number): void {
  const { ctx, pal } = g;
  const a = P(x, y);
  oval(ctx, a.x, a.y, 2.6, 1.4, pal.ink(ART.stoneDark));
  const set: [number, number, string][] = [
    [-8, -44, '#ff8fab'],
    [4, -54, '#ffd76b'],
    [13, -42, '#8fd1ff'],
  ];
  set.forEach(([dx, dy, col], i) => {
    const s = sway(g, 1.3, x * 3 + i * 1.9, 2.4);
    const c = { x: a.x + dx + s, y: a.y + dy + sway(g, 0.9, i * 2.3, 1.2) };
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(a.x + dx * 0.2, a.y + dy * 0.6, c.x, c.y + 9);
    ctx.strokeStyle = pal.ink('#8a8fa8');
    ctx.lineWidth = 0.8;
    ctx.stroke();
    oval(ctx, c.x, c.y, 7, 8.6, pal.ink(col));
    oval(ctx, c.x + 1.6, c.y + 1.8, 5, 6, pal.ink(col, -0.12));
    oval(ctx, c.x - 0.6, c.y - 0.8, 5.4, 6.8, pal.ink(col));
    oval(ctx, c.x - 2.4, c.y - 3.4, 1.7, 2.4, pal.ink('#ffffff'));
    poly(ctx, [{ x: c.x - 1.6, y: c.y + 9.8 }, { x: c.x + 1.6, y: c.y + 9.8 }, { x: c.x, y: c.y + 7.8 }], pal.ink(col, -0.2));
  });
}

/** A festival pole: a pennant on top and a string of little flags down to a peg. */
export function drawFlagPole(g: G, x: number, y: number, n: number): void {
  const { ctx, pal } = g;
  const c = P(x + 0.5, y + 0.5);
  const inks = ['#ef6b5b', '#3fb7a6', '#8f73d6', '#ffc93c', '#f58fb0'];
  oval(ctx, c.x + 3, c.y + 1, 6, 2.6, pal.shadow);
  line(ctx, [c, { x: c.x, y: c.y - 58 }], pal.ink('#fffaf0', -0.1), 2.4);
  oval(ctx, c.x, c.y - 60, 2.6, 2.6, pal.ink('#ffc93c'));
  const w1 = sway(g, 3.2, n * 2.1, 2);
  const w2 = sway(g, 3.2, n * 2.1 + 1.2, 2.4);
  ctx.beginPath();
  ctx.moveTo(c.x + 1, c.y - 57);
  ctx.quadraticCurveTo(c.x + 9, c.y - 58 + w1, c.x + 19, c.y - 51 + w2);
  ctx.quadraticCurveTo(c.x + 9, c.y - 49 + w1, c.x + 1, c.y - 45);
  ctx.closePath();
  ctx.fillStyle = pal.ink(inks[n % inks.length]);
  ctx.fill();
  // bunting down to the ground on both sides
  for (const dir of [-1, 1]) {
    const top = { x: c.x, y: c.y - 44 };
    const peg = { x: c.x + dir * 26, y: c.y + 4 * dir + 2 };
    const at = (t: number): Pt => ({ x: top.x + (peg.x - top.x) * t, y: top.y + (peg.y - top.y) * t + Math.sin(t * Math.PI) * 5 });
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    for (let i = 1; i <= 8; i++) {
      const q = at(i / 8);
      ctx.lineTo(q.x, q.y);
    }
    ctx.strokeStyle = pal.ink('#8a8fa8');
    ctx.lineWidth = 0.9;
    ctx.stroke();
    for (let i = 0; i < 5; i++) {
      const q0 = at((i + 0.6) / 6);
      const q1 = at((i + 1.2) / 6);
      const flap = sway(g, 4, i + n, 0.9);
      poly(ctx, [q0, q1, { x: (q0.x + q1.x) / 2 + flap, y: (q0.y + q1.y) / 2 + 7 }], pal.ink(inks[(i + n + (dir > 0 ? 2 : 0)) % inks.length]));
    }
  }
}

export function drawLily(g: G, x: number, y: number, n: number): void {
  const { ctx, pal } = g;
  const c = P(x, y);
  const bob = sway(g, 1.1, n * 2.4, 0.7);
  const cy = c.y + bob;
  ctx.beginPath();
  ctx.ellipse(c.x, cy, 8, 4.2, 0, 0.5, Math.PI * 2 - 0.2);
  ctx.lineTo(c.x, cy);
  ctx.closePath();
  ctx.fillStyle = pal.ink(ART.leaf, 0.05);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(c.x - 0.8, cy - 0.6, 5.6, 2.8, 0, 0.6, Math.PI * 2 - 0.3);
  ctx.lineTo(c.x, cy);
  ctx.closePath();
  ctx.fillStyle = pal.ink('#8fd16a');
  ctx.fill();
  if (n % 2 === 0) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      oval(ctx, c.x - 2 + Math.cos(a) * 2.6, cy - 2.4 + Math.sin(a) * 1.5, 2.1, 1.6, pal.ink(i % 2 === 0 ? '#ffd3e2' : '#ffffff'));
    }
    oval(ctx, c.x - 2, cy - 2.6, 1.2, 1, pal.ink('#ffd76b'));
  }
}

// ───────────────────────── the cat ─────────────────────────

export function drawCat(g: G, cat: Cat): void {
  const { ctx, pal } = g;
  const c = P(cat.x, cat.y);
  const f = cat.facing;
  const fur = pal.ink('#f2a65a');
  const furDark = pal.ink('#d9853a');
  const white = pal.ink('#fff6ea');
  oval(ctx, c.x, c.y + 0.5, 8.5, 3.4, pal.shadow);
  const tail = sway(g, cat.moving ? 6 : 1.6, 1, 2.6);
  if (cat.moving) {
    const step = Math.sin(cat.phase * 2);
    for (const [dx, k] of [[-4.5, 1], [-2, -1], [3, -1], [5.5, 1]] as const) {
      line(ctx, [{ x: c.x + dx * f, y: c.y - 4 }, { x: c.x + (dx + step * k * 1.6) * f, y: c.y }], white, 2);
    }
    // tail up
    ctx.beginPath();
    ctx.moveTo(c.x - 7 * f, c.y - 7);
    ctx.quadraticCurveTo(c.x - 12 * f, c.y - 10, c.x - (11 + tail) * f, c.y - 17);
    ctx.strokeStyle = furDark;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.stroke();
    oval(ctx, c.x, c.y - 6.5, 8, 4.6, fur);
    oval(ctx, c.x + 1.5 * f, c.y - 5, 4.5, 2.4, white);
  } else {
    // sitting: tail curled round, body upright
    ctx.beginPath();
    ctx.moveTo(c.x - 4 * f, c.y - 2);
    ctx.quadraticCurveTo(c.x - 11 * f, c.y - 1 + tail * 0.3, c.x - 8 * f, c.y - 7 - tail * 0.5);
    ctx.strokeStyle = furDark;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.stroke();
    oval(ctx, c.x, c.y - 6, 5.6, 6.4, fur);
    oval(ctx, c.x + 1.6 * f, c.y - 4.6, 3, 4, white);
  }
  const hx = c.x + (cat.moving ? 7.5 : 2.4) * f;
  const hy = c.y - (cat.moving ? 10 : 14.5);
  for (const e of [-1, 1]) poly(ctx, [{ x: hx + e * 1.2, y: hy - 3 }, { x: hx + e * 4.8, y: hy - 3.4 }, { x: hx + e * 3.8, y: hy - 8.2 }], e === -f ? furDark : fur);
  oval(ctx, hx, hy, 5.2, 4.6, fur);
  oval(ctx, hx + 1.2 * f, hy + 1.4, 2.6, 2, white);
  const blink = !g.still && g.t % 4.3 < 0.14;
  for (const e of [-1, 1]) oval(ctx, hx + 1 * f + e * 2, hy - 0.4, 0.9, blink ? 0.25 : 1.1, pal.ink('#2b2f45'));
  oval(ctx, hx + 1.2 * f, hy + 1.2, 0.7, 0.5, pal.ink('#f58fb0'));
}

/** A drifting spark of a firefly at a tile-grid point: night only, called from the overlay pass. */
export function drawFirefly(g: G, tx: number, ty: number, n: number): void {
  const c = P(tx, ty, 14);
  const t = g.still ? n : g.t;
  const x = c.x + Math.sin(t * 0.5 + n * 1.9) * 16 + Math.sin(t * 0.21 + n) * 10;
  const y = c.y + Math.cos(t * 0.43 + n * 2.7) * 9 - 6;
  const blink = g.still ? 0.7 : Math.max(0, Math.sin(t * 1.4 + n * 2.1));
  if (blink <= 0.02) return;
  glow(g, x, y, 9, 9, 0.85 * blink, g.pal.firefly);
  g.ctx.globalAlpha = blink;
  oval(g.ctx, x, y, 1.1, 1.1, '#f4ffd0');
  g.ctx.globalAlpha = 1;
}

/** A butterfly looping over the grass near a tile-grid point: daytime only. */
export function drawButterfly(g: G, tx: number, ty: number, n: number): void {
  const { ctx, pal } = g;
  const c = P(tx, ty, 12);
  const t = g.still ? n * 1.7 : g.t;
  const x = c.x + Math.sin(t * 0.7 + n * 1.9) * 22 + Math.sin(t * 0.31 + n) * 12;
  const y = c.y + Math.cos(t * 0.9 + n * 2.7) * 8 + Math.sin(t * 2.3 + n) * 2;
  const flap = g.still ? 0.8 : 0.25 + 0.75 * Math.abs(Math.sin(t * 9 + n));
  const col = pal.ink(['#ffd76b', '#ffffff', '#f7a8c6', '#c9b1ff'][n % 4]);
  oval(ctx, x + 1.5, y + 13, 2.4, 1, pal.shadow);
  for (const e of [-1, 1]) {
    oval(ctx, x + e * 2.4 * flap, y - 0.8, 2.6 * flap, 2.4, col);
    oval(ctx, x + e * 1.8 * flap, y + 1.6, 1.8 * flap, 1.6, col);
  }
  line(ctx, [{ x, y: y - 2 }, { x, y: y + 2.4 }], pal.ink('#3a3350'), 1);
}

/** A duck paddling round the pond. (cx, cy): the middle of its round, on the tile grid. */
export function drawDuck(g: G, cx: number, cy: number, n: number): void {
  const { ctx, pal } = g;
  const speed = 0.16 + n * 0.03;
  const a = (g.still ? 0 : g.t * speed) + n * 2.6;
  const tx = cx + Math.cos(a) * (0.5 + n * 0.12);
  const ty = cy + Math.sin(a) * (0.42 + n * 0.1);
  // heading: along the round; on the screen x grows with (tile x - tile y)
  const f = -Math.sin(a) - Math.cos(a) >= 0 ? 1 : -1;
  const c = P(tx, ty);
  const bob = sway(g, 2.2, n * 3, 0.5);
  // the ripple it leaves
  ctx.globalAlpha = 0.5;
  oval(ctx, c.x - f * 3, c.y + 1.4, 9, 3.4, undefined, pal.ink(ART.waterShine), 1);
  ctx.globalAlpha = 1;
  const white = pal.ink(n % 2 === 0 ? '#ffffff' : '#fff3c4');
  oval(ctx, c.x, c.y - 2 + bob, 5.6, 3.6, white);
  poly(ctx, [{ x: c.x - f * 4.4, y: c.y - 3 + bob }, { x: c.x - f * 8, y: c.y - 5.4 + bob }, { x: c.x - f * 4.6, y: c.y - 0.6 + bob }], white);
  oval(ctx, c.x - f * 0.6, c.y - 1.6 + bob, 3, 1.8, pal.ink('#e8e2d2'));
  oval(ctx, c.x + f * 4.2, c.y - 6 + bob, 2.8, 2.7, white);
  poly(ctx, [{ x: c.x + f * 6.4, y: c.y - 6.6 + bob }, { x: c.x + f * 9.6, y: c.y - 5.4 + bob }, { x: c.x + f * 6.4, y: c.y - 4.4 + bob }], pal.ink('#ff9f43'));
  oval(ctx, c.x + f * 4.8, c.y - 6.6 + bob, 0.7, 0.7, pal.ink('#2b2a3a'));
}

/** The marker under the place the player is walking to: a ring that breathes. */
export function drawGoal(g: G, tx: number, ty: number): void {
  const { ctx, pal } = g;
  const c = P(tx + 0.5, ty + 0.5);
  const k = g.still ? 0.5 : (g.t * 1.2) % 1;
  ctx.globalAlpha = 0.9 - k * 0.6;
  oval(ctx, c.x, c.y, 10 + k * 9, 5 + k * 4.5, undefined, pal.night ? pal.lampOn : '#ffffff', 2);
  ctx.globalAlpha = 0.5;
  oval(ctx, c.x, c.y, 5, 2.5, pal.night ? pal.lampOn : '#ffffff');
  ctx.globalAlpha = 1;
}

/** A soft patch under the pointer: this tile can be walked to. */
export function drawHoverTile(g: G, tx: number, ty: number): void {
  const c = P(tx + 0.5, ty + 0.5);
  oval(g.ctx, c.x, c.y, 24, 12, g.pal.hover);
}

/** Round rect helper re-exported for the overlay (name tags). */
export { roundRect };
