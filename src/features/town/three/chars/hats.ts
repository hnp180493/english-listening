// The loot hats of data/townGame.ts, built in code. Hat space: origin at the head centre, +Y up, +Z the face,
// sized for the head (radius HEAD.R) with its hair; a hair style lifts / scales it (hair.ts HAT_FIT).
// Geometries are cached per hat (shared by everybody wearing it).

import { Color, type BufferGeometry, Vector3 } from 'three';
import { HEAD, addFlower } from './body';
import { bump, cylinder, FULL, GeoBuilder, lathe, mat, roundBox, shell, smoothProfile, sphere, torus } from './build';
import { smoothstep } from './anim';
import { HAT_IDS } from './looks';

const R = HEAD.R;
const cache = new Map<string, { geometry: BufferGeometry; height: number }>();

/** Every hat id the builder knows. */
export const HATS: readonly string[] = HAT_IDS;

/** A closed, thick disc (brim) from an outer radius profile: top and bottom faces both shaded. */
function brim(b: GeoBuilder, rIn: number, rOut: number, y: number, droop: number, thick: number, c: Color, seg = 40, under?: Color): void {
  const prof: Array<[number, number]> = [];
  const n = 8;
  // the top surface from inside to outside, droop toward the edge, a rounded lip, back along the bottom
  for (let i = 0; i <= n; i++) {
    const k = i / n;
    prof.push([rIn + (rOut - rIn) * k, y - droop * k * k]);
  }
  const lipY = y - droop;
  // lathe profiles go "up" for outward normals: build the top as descending outward, so reverse at the end
  const lip: Array<[number, number]> = [
    [rOut + thick * 0.4, lipY - thick * 0.5],
    [rOut, lipY - thick],
  ];
  const bottom: Array<[number, number]> = [];
  for (let i = n; i >= 0; i--) {
    const k = i / n;
    bottom.push([rIn + (rOut - rIn) * k, y - thick - droop * k * k]);
  }
  const all = [...prof, ...lip, ...bottom];
  // as listed the profile runs outward on top and back underneath: reversed it runs "up" for outward normals
  b.add(lathe(all.reverse(), seg), mat(), c);
  if (under) b.add(lathe(bottom.slice().reverse().map(([r, yy]) => [r, yy - 0.001] as [number, number]), seg), mat(), under);
}

function build(id: string): { geometry: BufferGeometry; height: number } {
  const b = new GeoBuilder();
  const d = FULL;
  let height = R * 1.2;
  switch (id) {
    case 'mu-len': {
      // knitted beanie: ribbed dome, a folded band and a fluffy pompom
      const c = new Color('#e8776c');
      const dome = shell({
        cols: 48,
        rows: 12,
        thetaMax: () => 1.22,
        radius: (theta, phi) => R * (1.2 + 0.02 * smoothstep(1.22, 0.2, theta)) * (1 + 0.012 * Math.max(0, Math.cos(phi * 18))),
      });
      b.add(dome, mat([0, 0.0, 0], [0, 0, 0], [1.04, 1.06, 1.0]), c);
      b.add(torus(R * 1.2 * Math.sin(1.22) * 1.04, 0.032, d), mat([0, R * 1.2 * Math.cos(1.22) - 0.005, 0], [Math.PI / 2, 0, 0], [1, 0.97, 1]), new Color('#f3a093'));
      const pom = shell({ cols: 24, rows: 12, thetaMax: () => Math.PI, radius: (theta, phi) => 0.055 * (1 + 0.12 * Math.abs(Math.sin(theta * 5) * Math.sin(phi * 5))) });
      b.add(pom, mat([0, R * 1.27 + 0.045, -0.01]), new Color('#fbf3e6'));
      height = R * 1.27 + 0.1;
      break;
    }
    case 'mu-rom': {
      // straw sun hat with a red ribbon
      const c = new Color('#ecc976');
      const crown = smoothProfile(
        [
          [0.2, 0.07],
          [0.205, 0.15],
          [0.19, 0.24],
          [0.12, 0.29],
          [0.0, 0.3],
        ],
        4,
      );
      b.add(lathe(crown, 36), mat(), c);
      brim(b, 0.18, 0.4, 0.085, 0.05, 0.014, c, 48, new Color('#d6b05e'));
      b.add(cylinder(0.207, 0.207, 0.035, d, true), mat([0, 0.1, 0]), new Color('#d9534f'));
      height = 0.31;
      break;
    }
    case 'non-la': {
      // Vietnamese conical hat with woven rings
      const c = new Color('#f0dba0');
      const ring = new Color('#d9be78');
      const prof: Array<[number, number]> = [];
      for (let i = 0; i <= 16; i++) {
        const k = i / 16;
        prof.push([0.44 * (1 - k), 0.07 + 0.32 * Math.pow(k, 0.92)]);
      }
      prof[prof.length - 1] = [0, 0.395];
      b.add(lathe(prof, 48), mat(), c, {
        paint: (p) => (Math.abs(Math.sin(Math.hypot(p.x, p.z) * 70)) > 0.93 ? ring : null),
      });
      // underside
      b.add(lathe(prof.map(([r, y]) => [r * 0.98, y - 0.012] as [number, number]).reverse(), 48), mat(), new Color('#c9ab68'));
      b.add(torus(0.44, 0.008, d), mat([0, 0.066, 0], [Math.PI / 2, 0, 0]), ring);
      height = 0.4;
      break;
    }
    case 'mu-luoi-trai': {
      // baseball cap
      const c = new Color('#5b8fdc');
      const dome = shell({ cols: 48, rows: 12, thetaMax: () => 1.2, radius: (theta) => R * (1.17 + 0.03 * smoothstep(1.2, 0.2, theta)) });
      b.add(dome, mat([0, 0.0, 0], [0, 0, 0], [1.04, 1.02, 1.0]), c);
      b.add(sphere(0.018, d, 8, 6), mat([0, R * 1.21, 0]), new Color('#f2f2f2'));
      b.add(roundBox(0.26, 0.018, 0.16, 0.3, d), mat([0, R * 1.17 * Math.cos(1.2) + 0.012, R * 1.1], [0.22, 0, 0]), new Color('#3f6fb8'));
      height = R * 1.22;
      break;
    }
    case 'vong-hoa': {
      // flower crown
      const vine = new Color('#6fae64');
      b.add(torus(0.215, 0.012, d), mat([0, 0.14, -0.01], [Math.PI / 2 + 0.12, 0, 0], [1.05, 1.02, 1]), vine);
      const petals = ['#f59ab4', '#ffd76a', '#ffffff', '#c7a6f0', '#f59ab4', '#ffd76a', '#ffffff'];
      for (let i = 0; i < petals.length; i++) {
        const a = -1.4 + (i / (petals.length - 1)) * 2.8;
        const p = new Vector3(Math.sin(a) * 0.226, 0.14 - Math.sin(0.12) * Math.cos(a) * 0.22, Math.cos(a) * 0.215 - 0.01);
        addFlower(b, [p.x, p.y + HEAD.center[1], p.z], new Color(petals[i]), new Color('#f7c84a'), 0, d, 0.026);
      }
      height = 0.2;
      // addFlower works in body space (head centre at HEAD.center): move those back to hat space
      const g = b.build(false);
      return { geometry: shiftFlowers(g), height };
    }
    case 'mu-dau-bep': {
      // chef's hat: a band and a puffy top
      const w = new Color('#f8f6f0');
      b.add(cylinder(0.215, 0.205, 0.11, d), mat([0, 0.15, 0]), w);
      const puff: Array<[number, number, number, number]> = [
        [0, 0.33, 0, 0.13],
        [0.1, 0.3, 0.06, 0.1],
        [-0.1, 0.3, 0.06, 0.1],
        [0.09, 0.3, -0.08, 0.1],
        [-0.09, 0.3, -0.08, 0.1],
        [0, 0.29, 0.11, 0.09],
      ];
      for (const [x, y, z, r] of puff) b.add(sphere(r, d, 18, 12), mat([x, y, z]), w);
      height = 0.47;
      break;
    }
    case 'mu-cao-boi': {
      // cowboy hat: crown with a dent, brim curled up at the sides
      const c = new Color('#b07a48');
      const crown = shell({
        cols: 40,
        rows: 10,
        thetaMax: () => Math.PI / 2 + 0.15,
        radius: (theta, phi) => 0.2 * (1 - 0.18 * bump(theta, 0.5) * (0.6 + 0.4 * Math.cos(phi * 2))),
      });
      b.add(crown, mat([0, 0.16, 0], [0, 0, 0], [1.02, 1.0, 1.08]), c);
      const bb = new GeoBuilder();
      brim(bb, 0.16, 0.4, 0.0, 0.0, 0.016, c, 48, new Color('#94643a'));
      const g = bb.build(false);
      const p = g.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const z = p.getZ(i);
        const r = Math.hypot(x, z);
        const curl = smoothstep(0.22, 0.4, r) * Math.pow(Math.abs(x) / Math.max(r, 1e-4), 2) * 0.12;
        p.setY(i, p.getY(i) + curl - smoothstep(0.25, 0.4, r) * Math.pow(Math.abs(z) / Math.max(r, 1e-4), 2) * 0.02);
      }
      g.computeVertexNormals();
      b.add(g, mat([0, 0.1, 0], [0, 0, 0], [1, 1, 1.08]), c);
      b.add(cylinder(0.205, 0.205, 0.028, d, true), mat([0, 0.13, 0], [0, 0, 0], [1.02, 1, 1.08]), new Color('#5a3a22'));
      height = 0.37;
      break;
    }
    case 'mu-phu-thuy': {
      // witch hat: wide brim, a tall cone that flops back at the tip, a gold band with a buckle
      const c = new Color('#6f52a8');
      brim(b, 0.15, 0.39, 0.1, 0.03, 0.014, c, 48, new Color('#5a428c'));
      const cone = new GeoBuilder();
      const prof: Array<[number, number]> = [];
      for (let i = 0; i <= 14; i++) {
        const k = i / 14;
        prof.push([0.205 * (1 - k) * (1 - 0.15 * Math.sin(k * Math.PI)), k * 0.5]);
      }
      cone.add(lathe(prof, 32), mat(), c);
      const g = cone.build(false);
      const p = g.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i);
        const k = y / 0.5;
        p.setZ(i, p.getZ(i) - 0.2 * k * k * k);
        p.setY(i, y - 0.06 * k * k * k);
      }
      g.computeVertexNormals();
      b.add(g, mat([0, 0.09, 0]), c);
      b.add(cylinder(0.198, 0.2, 0.05, d, true), mat([0, 0.125, 0]), new Color('#f2c94c'));
      b.add(roundBox(0.06, 0.045, 0.012, 0.3, d), mat([0, 0.125, 0.2]), new Color('#f7dc7a'));
      height = 0.55;
      break;
    }
    case 'vuong-mien': {
      // a small gold crown with gems
      const gold = new Color('#f2c14e');
      // a closed ring (outer wall, rim, inner wall) so its inside shows from above
      b.add(lathe([[0.11, 0.205], [0.124, 0.205], [0.132, 0.265], [0.12, 0.266], [0.11, 0.206]], 40), mat(), gold, { paint: (_p, n) => (n.x * _p.x + n.z * _p.z < 0 ? new Color('#d9a53a') : null) });
      b.add(torus(0.125, 0.012, d), mat([0, 0.207, 0], [Math.PI / 2, 0, 0]), gold);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const x = Math.sin(a) * 0.126;
        const z = Math.cos(a) * 0.126;
        b.add(lathe(smoothProfile([[0.03, 0], [0.018, 0.04], [0, 0.065]], 3), 10), mat([x, 0.26, z], [0, 0, 0], [1, 1, 0.6]).multiply(mat([0, 0, 0], [0, a, 0])), gold);
        b.add(sphere(0.014, d, 8, 6), mat([x * 1.0, 0.33, z * 1.0]), new Color('#fff1b8'));
        b.add(sphere(0.017, d, 8, 6), mat([x * 1.06, 0.236, z * 1.06], [0, 0, 0], [1, 1, 0.6]), new Color(i % 2 ? '#e0566b' : '#5aa6e6'));
      }
      height = 0.35;
      break;
    }
    default:
      return { geometry: b.build(false), height: 0 };
  }
  return { geometry: b.build(false), height };
}

/** addFlower placed the flowers in body space (y + head centre): bring them to hat space. */
function shiftFlowers(g: BufferGeometry): BufferGeometry {
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0.5) p.setY(i, p.getY(i) - HEAD.center[1]);
  g.computeBoundingSphere();
  return g;
}

/** The shared geometry of a hat (null for an unknown id), and how high it reaches above the head centre. */
export function hatGeometry(id: string): { geometry: BufferGeometry; height: number } | null {
  if (!(HATS as readonly string[]).includes(id)) return null;
  let h = cache.get(id);
  if (!h) {
    h = build(id);
    cache.set(id, h);
  }
  return h;
}

export function disposeHats(): void {
  for (const h of cache.values()) h.geometry.dispose();
  cache.clear();
}
