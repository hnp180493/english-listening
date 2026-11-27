// Packs the bodies the town's old people and children wear (public/models/people-quat-m.glb, -f.glb) from Quaternius' CC0
// "Universal Base Characters" and "Modular Character Outfits" (the copies the owner's own game Giang Hồ ships, kept
// outside git in .assets-try/quaternius-gh/chars; docs/town.md §35). Reads the glTF files as data (no code from them
// runs) and writes two glTF binaries, a man's kit and a woman's, each on its own skeleton (the Peasant
// outfit's: the clothes are what is seen):
//   - the outfit's four pieces: `top` (the body), `arms` (sleeves and hands), `legs`, `feet`;
//   - the head of the base character (`head`: only the triangles carried by the head and the neck: the rest of the
//     base body is under the clothes), its `eyes` and `brows`;
//   - loose hair: the woman's kit `hair-buns`, `hair-long`, `hair-parted` (the man's parted hair moved to her head),
//     the man's `hair-parted`, `beard`.
// Every piece is skinned to its kit's one skeleton (joints matched by name). Materials only name their picture: the
// town makes its own (features/town/three/chars/quatBody.ts: cloth and hair greyed and tinted per person). The
// pictures go in as they are (JPEG, about 50–120 kB each). The Ranger outfit is left out (nobody wears it).
//
//   node scripts/quat-pack.mjs [<chars dir>] [<out.glb>]

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const DIR = process.argv[2] ?? '.assets-try/quaternius-gh/chars';
const OUT = process.argv[3] ?? 'public/models/people-quat.glb';
/** One file a kit (`-m`, `-f`): the two skeletons share their bones' names, which one file would rename. */
const outFor = (kitName) => OUT.replace(/\.glb$/, kitName.replace('quat', '') + '.glb');

/** The bones of the hands (the wrist and every finger). */
const HAND_BONES = ['l', 'r'].flatMap((side) => ['hand_' + side, ...['index', 'middle', 'pinky', 'ring', 'thumb'].flatMap((f) => [1, 2, 3].map((k) => `${f}_0${k}_${side}`))]);

const load = (name) => {
  const gltf = JSON.parse(readFileSync(join(DIR, name + '.gltf'), 'utf8'));
  const bin = readFileSync(join(DIR, gltf.buffers[0].uri));
  return { gltf, bin };
};

const SIZE = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const COMPS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const ARRAY = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };

/** An accessor's elements as a tight typed array (strides undone). */
function read(src, i) {
  const a = src.gltf.accessors[i];
  const view = src.gltf.bufferViews[a.bufferView];
  const n = COMPS[a.type];
  const size = SIZE[a.componentType];
  const stride = view.byteStride ?? n * size;
  const start = (view.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const out = new ARRAY[a.componentType](a.count * n);
  const dv = new DataView(src.bin.buffer, src.bin.byteOffset);
  for (let e = 0; e < a.count; e++)
    for (let c = 0; c < n; c++) {
      const at = start + e * stride + c * size;
      const t = a.componentType;
      out[e * n + c] = t === 5126 ? dv.getFloat32(at, true) : t === 5125 ? dv.getUint32(at, true) : t === 5123 ? dv.getUint16(at, true) : t === 5122 ? dv.getInt16(at, true) : t === 5121 ? dv.getUint8(at) : dv.getInt8(at);
    }
  return { array: out, type: a.type, componentType: a.componentType, normalized: !!a.normalized, count: a.count };
}

// ── the output (one per kit: reset by `begin`) ──
let out;
let chunks;
let length;
let pictures;
function begin() {
  out = { asset: { version: '2.0', generator: 'scripts/quat-pack.mjs' }, scene: 0, scenes: [{ nodes: [] }], nodes: [], meshes: [], skins: [], accessors: [], bufferViews: [], materials: [], textures: [], images: [], samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }], buffers: [{ byteLength: 0 }] };
  chunks = [];
  length = 0;
  pictures = new Map();
}
function view(bytes, target) {
  const pad = (4 - (length % 4)) % 4;
  if (pad) {
    chunks.push(Buffer.alloc(pad));
    length += pad;
  }
  const v = { buffer: 0, byteOffset: length, byteLength: bytes.byteLength };
  if (target) v.target = target;
  out.bufferViews.push(v);
  chunks.push(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
  length += bytes.byteLength;
  return out.bufferViews.length - 1;
}
function accessor(acc, target) {
  const n = COMPS[acc.type];
  const a = { bufferView: view(acc.array, target), componentType: acc.componentType, count: acc.array.length / n, type: acc.type };
  if (acc.normalized) a.normalized = true;
  if (acc.type === 'VEC3' && acc.componentType === 5126) {
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < acc.array.length; i += 3)
      for (let c = 0; c < 3; c++) {
        min[c] = Math.min(min[c], acc.array[i + c]);
        max[c] = Math.max(max[c], acc.array[i + c]);
      }
    a.min = min;
    a.max = max;
  }
  out.accessors.push(a);
  return out.accessors.length - 1;
}

function material(name, picture) {
  if (!pictures.has(picture)) {
    const bytes = readFileSync(join(DIR, picture));
    out.images.push({ name: picture.replace(/\.jpg$/, ''), mimeType: 'image/jpeg', bufferView: view(new Uint8Array(bytes)) });
    out.textures.push({ sampler: 0, source: out.images.length - 1 });
    pictures.set(picture, out.textures.length - 1);
  }
  const found = out.materials.findIndex((m) => m.name === name && m.pbrMetallicRoughness.baseColorTexture.index === pictures.get(picture));
  if (found >= 0) return found;
  out.materials.push({ name, pbrMetallicRoughness: { baseColorTexture: { index: pictures.get(picture) }, metallicFactor: 0, roughnessFactor: 1 } });
  return out.materials.length - 1;
}

/** The picture a source material uses. */
function pictureOf(src, m) {
  const tex = src.gltf.materials[m].pbrMetallicRoughness.baseColorTexture.index;
  return src.gltf.images[src.gltf.textures[tex].source].uri;
}

/** The name a piece's material gets in the town (it decides how it is tinted). */
function kindOf(picture) {
  if (/^body_/.test(picture)) return 'skin';
  if (/^skin_/.test(picture)) return 'skin-hands';
  if (picture === 'eye.jpg') return 'eye';
  if (picture === 'peasant.jpg') return 'cloth';
  return picture.replace(/\.jpg$/, '');
}

/**
 * One piece: the primitives of a source mesh, their joints renumbered to the kit's skeleton, optionally only the
 * triangles whose three corners hang mostly on `keepBones`, optionally moved by `shift`.
 */
function piece(src, meshIndex, skinIndex, kitJoints, { keepBones = null, dropBones = null, shift = null } = {}) {
  const srcJoints = src.gltf.skins[skinIndex].joints.map((j) => src.gltf.nodes[j].name);
  const map = srcJoints.map((name) => {
    const k = kitJoints.indexOf(name);
    if (k < 0) throw new Error('no joint ' + name + ' in the kit');
    return k;
  });
  const prims = [];
  for (const p of src.gltf.meshes[meshIndex].primitives) {
    const pos = read(src, p.attributes.POSITION);
    const nor = read(src, p.attributes.NORMAL);
    const uv = read(src, p.attributes.TEXCOORD_0);
    const jnt = read(src, p.attributes.JOINTS_0);
    const wgt = read(src, p.attributes.WEIGHTS_0);
    const idx = read(src, p.indices);
    // which vertices are kept
    let tris = idx.array;
    if (keepBones || dropBones) {
      const listed = new Set((keepBones ?? dropBones).map((b) => srcJoints.indexOf(b)));
      const keep = { has: (j) => (keepBones ? listed.has(j) : !listed.has(j)) };
      const top = (v) => {
        let best = 0;
        for (let c = 1; c < 4; c++) if (wgt.array[v * 4 + c] > wgt.array[v * 4 + best]) best = c;
        return jnt.array[v * 4 + best];
      };
      const kept = [];
      for (let t = 0; t < idx.array.length; t += 3) if (keep.has(top(idx.array[t])) && keep.has(top(idx.array[t + 1])) && keep.has(top(idx.array[t + 2]))) kept.push(idx.array[t], idx.array[t + 1], idx.array[t + 2]);
      tris = kept;
    }
    // the vertices used, in a tight new order
    const remap = new Map();
    const order = [];
    for (const v of tris) if (!remap.has(v)) {
      remap.set(v, order.length);
      order.push(v);
    }
    const take = (acc, n, Type = acc.array.constructor) => {
      const a = new Type(order.length * n);
      order.forEach((v, i) => {
        for (let c = 0; c < n; c++) a[i * n + c] = acc.array[v * n + c];
      });
      return a;
    };
    const P = take(pos, 3);
    if (shift) for (let i = 0; i < P.length; i += 3) for (let c = 0; c < 3; c++) P[i + c] += shift[c];
    const J = take(jnt, 4, Uint8Array);
    for (let i = 0; i < J.length; i++) J[i] = map[J[i]];
    const indices = order.length < 65536 ? Uint16Array.from(tris, (v) => remap.get(v)) : Uint32Array.from(tris, (v) => remap.get(v));
    const picture = pictureOf(src, p.material);
    prims.push({
      attributes: {
        POSITION: accessor({ array: P, type: 'VEC3', componentType: 5126 }, 34962),
        NORMAL: accessor({ array: take(nor, 3), type: 'VEC3', componentType: 5126 }, 34962),
        TEXCOORD_0: accessor({ array: take(uv, 2), type: 'VEC2', componentType: 5126 }, 34962),
        JOINTS_0: accessor({ array: J, type: 'VEC4', componentType: 5121 }, 34962),
        WEIGHTS_0: accessor({ array: take(wgt, 4, Float32Array), type: 'VEC4', componentType: 5126 }, 34962),
      },
      indices: accessor({ array: indices, type: 'SCALAR', componentType: indices instanceof Uint16Array ? 5123 : 5125 }, 34963),
      material: material(kindOf(picture), picture),
    });
  }
  return prims;
}

/** The world position of a node (translations and rotations only: these files have no scaled bones that matter). */
function worldOf(src, name) {
  const g = src.gltf;
  const parent = {};
  g.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => (parent[c] = i)));
  const qmul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
  const qrot = (q, v) => {
    const r = qmul(qmul(q, [v[0], v[1], v[2], 0]), [-q[0], -q[1], -q[2], q[3]]);
    return [r[0], r[1], r[2]];
  };
  const at = (i) => {
    const n = g.nodes[i];
    const t = n.translation ?? [0, 0, 0];
    const r = n.rotation ?? [0, 0, 0, 1];
    if (parent[i] === undefined) return { t, r };
    const P = at(parent[i]);
    const rt = qrot(P.r, t);
    return { t: [P.t[0] + rt[0], P.t[1] + rt[1], P.t[2] + rt[2]], r: qmul(P.r, r) };
  };
  return at(g.nodes.findIndex((n) => n.name === name)).t;
}

/** The mesh node of a source file whose mesh name matches. */
function meshNode(src, re) {
  const i = src.gltf.nodes.findIndex((n) => n.mesh !== undefined && re.test(src.gltf.meshes[n.mesh].name));
  if (i < 0) throw new Error('no mesh ' + re);
  return src.gltf.nodes[i];
}

/** A kit: the outfit's skeleton and its pieces. */
function kit(name, outfitFile, baseFile, hairs) {
  const outfit = load(outfitFile);
  const g = outfit.gltf;
  // the skeleton: every node that is not a mesh, from the outfit's file, under one new root
  const keep = g.nodes.map((n) => n.mesh === undefined);
  const index = new Map();
  g.nodes.forEach((n, i) => {
    if (!keep[i]) return;
    const copy = { name: n.name };
    for (const k of ['translation', 'rotation', 'scale']) if (n[k]) copy[k] = n[k];
    out.nodes.push(copy);
    index.set(i, out.nodes.length - 1);
  });
  g.nodes.forEach((n, i) => {
    if (!keep[i]) return;
    const kids = (n.children ?? []).filter((c) => keep[c]).map((c) => index.get(c));
    if (kids.length) out.nodes[index.get(i)].children = kids;
  });
  const parentOf = {};
  g.nodes.forEach((n, i) => (n.children ?? []).forEach((c) => (parentOf[c] = i)));
  const armature = g.nodes.findIndex((n, i) => keep[i] && parentOf[i] === undefined && (n.children ?? []).length > 0);
  const kitJoints = g.skins[0].joints.map((j) => g.nodes[j].name);
  out.skins.push({ name, joints: g.skins[0].joints.map((j) => index.get(j)), inverseBindMatrices: accessor(read(outfit, g.skins[0].inverseBindMatrices)) });
  const skin = out.skins.length - 1;
  const add = (part, prims) => {
    out.meshes.push({ name: part, primitives: prims });
    out.nodes.push({ name: part, mesh: out.meshes.length - 1, skin });
    const node = out.nodes[index.get(armature)];
    (node.children ??= []).push(out.nodes.length - 1);
  };
  // the outfit (a woman's sleeves come with hands painted in the cloth's picture: they are cut off at the wrist, and
  // the base character's own hands put on instead, so they are not tinted the colour of the shirt)
  const handsOwn = outfit.gltf.meshes[meshNode(outfit, /_Arms$/).mesh].primitives.length === 1;
  for (const [part, re] of [['top', /_Body$/], ['arms', /_Arms$/], ['legs', /_Legs$/], ['feet', /_Feet$/]]) {
    const n = meshNode(outfit, re);
    add(part, piece(outfit, n.mesh, n.skin, kitJoints, part === 'arms' && handsOwn ? { dropBones: HAND_BONES } : {}));
  }
  // the base character's head, eyes and brows
  const base = load(baseFile);
  const bodyNode = base.gltf.nodes.find((n) => n.mesh !== undefined && base.gltf.meshes[n.mesh].primitives.some((p) => /^body_/.test(pictureOf(base, p.material))));
  add('head', piece(base, bodyNode.mesh, bodyNode.skin, kitJoints, { keepBones: ['Head', 'neck_01'] }));
  if (handsOwn) add('hands', piece(base, bodyNode.mesh, bodyNode.skin, kitJoints, { keepBones: HAND_BONES }));
  for (const n of base.gltf.nodes) {
    if (n.mesh === undefined || n === bodyNode) continue;
    const pic = pictureOf(base, base.gltf.meshes[n.mesh].primitives[0].material);
    add(pic === 'eye.jpg' ? 'eyes' : 'brows', piece(base, n.mesh, n.skin, kitJoints));
  }
  // loose hair: from its own file, moved by how far its head stands from this kit's
  const head = worldOf(outfit, 'Head');
  for (const [part, file] of hairs) {
    const h = load(file);
    const hh = worldOf(h, 'Head');
    const shift = [head[0] - hh[0], head[1] - hh[1], head[2] - hh[2]];
    const n = h.gltf.nodes.find((x) => x.mesh !== undefined);
    add(part, piece(h, n.mesh, n.skin, kitJoints, { shift: Math.hypot(...shift) > 1e-4 ? shift : null }));
  }
  const root = { name, children: [index.get(armature)] };
  out.nodes.push(root);
  out.scenes[0].nodes.push(out.nodes.length - 1);
}

function write(file) {
  const pad = (4 - (length % 4)) % 4;
  if (pad) {
    chunks.push(Buffer.alloc(pad));
    length += pad;
  }
  out.buffers[0].byteLength = length;
  const json = Buffer.from(JSON.stringify(out), 'utf8');
  const jsonPad = Buffer.alloc((4 - (json.length % 4)) % 4, 0x20);
  const bin = Buffer.concat(chunks);
  const total = 12 + 8 + json.length + jsonPad.length + 8 + bin.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(total, 8);
  const jh = Buffer.alloc(8);
  jh.writeUInt32LE(json.length + jsonPad.length, 0);
  jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8);
  bh.writeUInt32LE(bin.length, 0);
  bh.writeUInt32LE(0x004e4942, 4);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, Buffer.concat([header, jh, json, jsonPad, bh, bin]));
  console.log(`${file}: ${(total / 1024).toFixed(0)} kB, ${out.meshes.length} pieces, ${out.images.length} pictures`);
}

begin();
kit('quat-m', 'Male_Peasant', 'Superhero_Male_FullBody', [
  ['hair-parted', 'Hair_SimpleParted'],
  ['beard', 'Hair_Beard'],
]);
write(outFor('quat-m'));
begin();
kit('quat-f', 'Female_Peasant', 'Superhero_Female_FullBody', [
  ['hair-buns', 'Hair_Buns'],
  ['hair-long', 'Hair_Long'],
  ['hair-parted', 'Hair_SimpleParted'],
]);
write(outFor('quat-f'));
