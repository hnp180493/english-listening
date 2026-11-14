// The ground of "Thị trấn" as ONE picture: a little island (a rounded slab with a grassy lip and earth sides),
// its top painted in tile space (grass with soft patches, sandy paths with round ends, the cobbled round plaza,
// the pond with its bank, doorsteps), a few 3D details (a plaza curb, rocks by the pond, grass tufts) and the
// shadows of the fixed trees. The trees, places and props are sprites drawn over it.
//
// Why one picture and not tiles: the paths, plaza and pond are round shapes that cross tile edges, which tiles
// would need many edge pieces for; one picture has no seams, costs the game one drawImage per frame, and the
// layout (townWorld.ts) changes rarely: re-render with `npm run art:town`.

import { setGroundBuilder, buildRecipe } from './recipes.js';
import { C, THREE, group, mat, ball } from './parts.js';

const G = {
  grass: '#9ad27a',
  grassLight: '#b4e08c',
  grassDark: '#86c46e',
  grassEdge: '#74b566',
  tuft: '#6aae5e',
  path: '#efdcb2',
  pathEdge: '#d6bf8c',
  pathLight: '#f8ebcb',
  pebble: '#cbb37f',
  plaza: '#e8dece',
  plazaEdge: '#c9bca6',
  cobbleA: '#d7cbb6',
  cobbleB: '#f3ebdc',
  water: '#7fcfe6',
  waterDeep: '#5fb6d9',
  bank: '#d2c08f',
  earth: '#b98a5e',
  earthDark: '#8f6646',
  earthDeep: '#6f4e3a',
};

function hash(a, b = 0, c = 0) {
  const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return s - Math.floor(s);
}

/** Rounded rectangle path (tile units). */
function roundRect(ctx, a, b, r) {
  ctx.beginPath();
  ctx.moveTo(a + r, a);
  ctx.arcTo(b, a, b, b, r);
  ctx.arcTo(b, b, a, b, r);
  ctx.arcTo(a, b, a, a, r);
  ctx.arcTo(a, a, b, a, r);
  ctx.closePath();
}

const isPathLike = (ch) => ch === '=' || ch === 'o' || ch === 'F';

/** Paint the island's top in tile space: returns the canvas and the tile box it covers. */
function paintTop(L, PX) {
  const { size, rows, margin, radius, plaza } = L;
  const x0 = -margin - 0.3;
  const span = size + 2 * margin + 0.6;
  const cvs = document.createElement('canvas');
  cvs.width = cvs.height = Math.round(span * PX);
  const ctx = cvs.getContext('2d');
  ctx.setTransform(PX, 0, 0, PX, -x0 * PX, -x0 * PX);

  // grass with big soft patches: no tile edges anywhere
  ctx.fillStyle = G.grass;
  ctx.fillRect(x0, x0, span, span);
  for (let i = 0; i < 160; i++) {
    const x = hash(i, 1.3) * (size + 2) - 1;
    const y = hash(i, 7.7) * (size + 2) - 1;
    const r = 0.6 + hash(i, 4.1) * 2.0;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const col = i % 2 === 0 ? G.grassLight : G.grassDark;
    g.addColorStop(0, col);
    g.addColorStop(1, col + '00');
    ctx.globalAlpha = 0.35 + hash(i, 9.9) * 0.3;
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
  // tiny strokes of grass texture
  for (let i = 0; i < 9000; i++) {
    const x = hash(i, 3.1) * (size + 2 * margin) - margin;
    const y = hash(i, 5.3) * (size + 2 * margin) - margin;
    ctx.fillStyle = hash(i, 8.8) > 0.5 ? G.grassLight : G.tuft;
    ctx.globalAlpha = 0.25 + hash(i, 2.2) * 0.25;
    ctx.fillRect(x, y, 0.04, 0.04);
  }
  ctx.globalAlpha = 1;
  // a darker rim where the island ends
  roundRect(ctx, -margin, size + margin, radius);
  ctx.lineWidth = 0.35;
  ctx.strokeStyle = G.grassEdge;
  ctx.globalAlpha = 0.6;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // paths: round strokes through the tile centres, a darker edge under a lighter middle
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const trace = () => {
    ctx.beginPath();
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (rows[y][x] !== '=') continue;
        const cx = x + 0.5;
        const cy = y + 0.5;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, cy);
        for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
          if (!isPathLike(rows[y + dy]?.[x + dx])) continue;
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + dx, cy + dy);
        }
      }
    }
    for (const p of L.places) {
      const cx = p.door.x + 0.5;
      const cy = p.door.y + 0.5;
      ctx.moveTo(cx, cy);
      if (p.face === 'x') ctx.lineTo(cx - 0.7, cy);
      else ctx.lineTo(cx, cy - 0.7);
    }
  };
  trace();
  ctx.lineWidth = 1.0;
  ctx.strokeStyle = G.pathEdge;
  ctx.stroke();
  trace();
  ctx.lineWidth = 0.84;
  ctx.strokeStyle = G.path;
  ctx.stroke();
  trace();
  ctx.lineWidth = 0.4;
  ctx.globalAlpha = 0.45;
  ctx.strokeStyle = G.pathLight;
  ctx.stroke();
  ctx.globalAlpha = 1;
  // pebbles on the paths
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (rows[y][x] !== '=') continue;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.ellipse(x + 0.2 + hash(x, y, i) * 0.6, y + 0.2 + hash(y, x, i + 5) * 0.6, 0.035, 0.03, 0, 0, Math.PI * 2);
        ctx.fillStyle = G.pebble;
        ctx.globalAlpha = 0.7;
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;

  // the plaza: a round cobbled square, rings of stones
  ctx.beginPath();
  ctx.arc(plaza.x, plaza.y, plaza.r + 0.18, 0, Math.PI * 2);
  ctx.fillStyle = G.plazaEdge;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(plaza.x, plaza.y, plaza.r, 0, Math.PI * 2);
  ctx.fillStyle = G.plaza;
  ctx.fill();
  let ring = 0;
  for (let r = 0.86; r < plaza.r - 0.1; r += 0.3) {
    const stones = Math.max(8, Math.round((2 * Math.PI * r) / 0.36));
    for (let i = 0; i < stones; i++) {
      const a0 = ((i + hash(ring, 3) ) / stones) * Math.PI * 2;
      const a1 = a0 + ((Math.PI * 2) / stones) * 0.86;
      ctx.beginPath();
      ctx.arc(plaza.x, plaza.y, r + 0.11, a0, a1);
      ctx.arc(plaza.x, plaza.y, r - 0.11, a1, a0, true);
      ctx.closePath();
      ctx.fillStyle = (i + ring) % 3 === 0 ? G.cobbleB : G.cobbleA;
      ctx.globalAlpha = 0.75 + hash(i, ring) * 0.25;
      ctx.fill();
    }
    ring++;
  }
  ctx.globalAlpha = 1;
  // the round step the fountain stands on
  ctx.beginPath();
  ctx.arc(plaza.x, plaza.y, 0.8, 0, Math.PI * 2);
  ctx.fillStyle = G.plazaEdge;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(plaza.x, plaza.y, 0.7, 0, Math.PI * 2);
  ctx.fillStyle = G.cobbleB;
  ctx.fill();

  // the pond: one smooth shape, a sandy bank, then water darker in the middle
  const pond = (width, style) => {
    ctx.beginPath();
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (rows[y][x] !== '~') continue;
        ctx.moveTo(x + 0.5, y + 0.5);
        ctx.lineTo(x + 0.5, y + 0.5);
        for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
          if (rows[y + dy]?.[x + dx] !== '~') continue;
          ctx.moveTo(x + 0.5, y + 0.5);
          ctx.lineTo(x + 0.5 + dx, y + 0.5 + dy);
        }
      }
    }
    ctx.lineWidth = width;
    ctx.strokeStyle = style;
    ctx.stroke();
  };
  pond(1.74, G.grassEdge);
  pond(1.6, G.bank);
  pond(1.4, '#5aa7c4');
  pond(1.32, G.water);
  ctx.globalAlpha = 0.55;
  pond(0.75, G.waterDeep);
  ctx.globalAlpha = 1;

  // flowers dotted on the grass (not under places)
  const covered = new Set();
  for (const p of L.places) for (let y = p.y; y < p.y + p.d; y++) for (let x = p.x; x < p.x + p.w; x++) covered.add(`${x},${y}`);
  const inks = ['#ffffff', '#ffd76b', '#f7a8c6', '#c9b1ff'];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const ch = rows[y][x];
      if (!(ch === '.' || ch === 'T' || ch === 't') || covered.has(`${x},${y}`)) continue;
      if (hash(x, y, 50) > 0.28) continue;
      const cx = x + 0.2 + hash(x, y, 51) * 0.6;
      const cy = y + 0.2 + hash(y, x, 52) * 0.6;
      const col = inks[Math.floor(hash(x, y, 53) * inks.length)];
      for (let i = 0; i < 4; i++) {
        const ox = (hash(x, y, 60 + i) - 0.5) * 0.3;
        const oy = (hash(y, x, 70 + i) - 0.5) * 0.3;
        ctx.beginPath();
        ctx.arc(cx + ox, cy + oy, 0.045, 0, Math.PI * 2);
        ctx.fillStyle = col;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(cx + ox, cy + oy, 0.016, 0, Math.PI * 2);
        ctx.fillStyle = '#f2a541';
        ctx.fill();
      }
    }
  }
  return { cvs, x0, span };
}

/** The island's slab: top painted, sides banded earth with a grassy rounded lip. */
function island(L, top) {
  const { size, margin, radius, cliff } = L;
  const a = -margin;
  const b = size + margin;
  const s = new THREE.Shape();
  s.moveTo(a + radius, a);
  s.lineTo(b - radius, a);
  s.quadraticCurveTo(b, a, b, a + radius);
  s.lineTo(b, b - radius);
  s.quadraticCurveTo(b, b, b - radius, b);
  s.lineTo(a + radius, b);
  s.quadraticCurveTo(a, b, a, b - radius);
  s.lineTo(a, a + radius);
  s.quadraticCurveTo(a, a, a + radius, a);
  const bevel = 0.14;
  const geo = new THREE.ExtrudeGeometry(s, { depth: cliff, steps: 10, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 28 });
  // shape (x, y) → ground (x, z = y); the extrusion goes down
  geo.rotateX(Math.PI / 2);
  geo.translate(0, -bevel, 0);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const bands = [
    [0.0, G.grass],
    [-0.1, G.grassEdge],
    [-0.2, G.earth],
    [-0.55, '#a87b52'],
    [-0.85, G.earthDark],
    [-1.3, G.earthDeep],
  ];
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    uv.setXY(i, (pos.getX(i) - top.x0) / top.span, 1 - (pos.getZ(i) - top.x0) / top.span);
    let col = bands[bands.length - 1][1];
    for (let k = 0; k < bands.length - 1; k++) {
      if (y <= bands[k][0] && y > bands[k + 1][0]) {
        const t = (bands[k][0] - y) / (bands[k][0] - bands[k + 1][0]);
        col = new THREE.Color(bands[k][1]).lerp(new THREE.Color(bands[k + 1][1]), t).getHexString();
        col = '#' + col;
        break;
      }
    }
    if (y > 0) col = G.grass;
    // a little noise so the cliff is not a plain gradient
    c.set(col).convertSRGBToLinear();
    const n = 0.94 + hash(Math.round(pos.getX(i) * 3), Math.round(pos.getZ(i) * 3), Math.round(y * 6)) * 0.1;
    colors.set([c.r * n, c.g * n, c.b * n], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const tex = new THREE.CanvasTexture(top.cvs);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  const topMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 });
  const sideMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: false });
  const mesh = new THREE.Mesh(geo, [topMat, sideMat]);
  mesh.receiveShadow = true;
  return { mesh, dispose: () => tex.dispose() };
}

setGroundBuilder(async (L) => {
  const top = paintTop(L, L.texPx ?? 96);
  const isl = island(L, top);
  const root = group(isl.mesh);
  // a low curb round the plaza
  const curb = new THREE.Mesh(new THREE.TorusGeometry(L.plaza.r + 0.12, 0.05, 6, 80), mat(G.plazaEdge));
  curb.rotation.x = Math.PI / 2;
  curb.scale.set(1, 1, 0.5);
  curb.position.set(L.plaza.x, 0.0, L.plaza.y);
  curb.receiveShadow = true;
  root.add(curb);
  // rocks round the pond
  const { rows, size } = L;
  let k = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (rows[y][x] !== '~') continue;
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        if (rows[y + dy]?.[x + dx] === '~' || hash(x, y, dx * 3 + dy) > 0.45) continue;
        const r = 0.06 + hash(x, y, k) * 0.06;
        const rock = ball(r, k % 3 ? C.stone : C.stoneDark, { x: x + 0.5 + dx * 0.62 + (hash(k, 1) - 0.5) * 0.4, y: r * 0.3, z: y + 0.5 + dy * 0.62 + (hash(k, 2) - 0.5) * 0.4, detail: 0, s: [1.2, 0.7, 1] });
        rock.receiveShadow = true;
        root.add(rock);
        k++;
      }
    }
  }
  // grass tufts: small dark-green blades, instanced
  const blade = new THREE.ConeGeometry(0.018, 0.09, 3);
  blade.translate(0, 0.045, 0);
  const spots = [];
  const covered = new Set();
  for (const p of L.places) for (let y = p.y; y < p.y + p.d; y++) for (let x = p.x; x < p.x + p.w; x++) covered.add(`${x},${y}`);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (rows[y][x] !== '.' || covered.has(`${x},${y}`)) continue;
      const n = Math.floor(hash(x, y, 11) * 3);
      for (let i = 0; i < n; i++) {
        const cx = x + 0.12 + hash(x, y, 20 + i) * 0.76;
        const cz = y + 0.12 + hash(y, x, 30 + i) * 0.76;
        for (let j = 0; j < 3; j++) spots.push([cx + (j - 1) * 0.025, cz + (j % 2) * 0.01, (j - 1) * 0.35]);
      }
    }
  }
  const tufts = new THREE.InstancedMesh(blade, mat(G.tuft, { flat: true }), spots.length);
  const m4 = new THREE.Matrix4();
  spots.forEach(([x, z, lean], i) => {
    m4.makeRotationFromEuler(new THREE.Euler(0, 0, lean));
    m4.setPosition(x, 0, z);
    tufts.setMatrixAt(i, m4);
  });
  tufts.receiveShadow = true;
  root.add(tufts);
  // the fixed trees, only for their shadows
  for (const t of L.trees) {
    const built = await buildRecipe(t.kind === 'round' ? 'treeRound' : 'treePine', { v: t.v });
    const o = built.object;
    o.position.set(t.x + 0.5, 0, t.y + 0.5);
    o.traverse((n) => {
      if (!n.isMesh) return;
      n.castShadow = true;
      n.material = n.material.clone();
      n.material.colorWrite = false;
      n.material.depthWrite = false;
    });
    root.add(o);
  }
  return { object: root, dispose: isl.dispose, info: {} };
});
