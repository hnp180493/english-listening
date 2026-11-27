// Packs the people's motion clips the town ships (public/anim/people.glb) from a Quaternius "Universal Animation
// Library" file (CC0; the copy the owner's own game Giang Hồ ships, kept outside git in .assets-try/quaternius-gh).
// Reads the glTF binary as data (no code from it runs): keeps only the clips the town uses, only the rotations of the
// bones a VRM humanoid has (no fingers, no scale) and the pelvis' translation, the skeleton's rest pose as it is (the
// retarget needs it: features/town/three/chars/vrmClips.ts), and writes a smaller glTF binary.
//
//   node scripts/anim-pack.mjs [<in.glb>] [<out.glb>]

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const IN = process.argv[2] ?? '.assets-try/quaternius-gh/anims.glb';
const OUT = process.argv[3] ?? 'public/anim/people.glb';

/** The clips kept, as the town names them. */
const CLIPS = {
  Idle_Loop: 'idle',
  Walk_Loop: 'walk',
  Jog_Fwd_Loop: 'jog',
  Sprint_Loop: 'sprint',
  Sitting_Idle_Loop: 'sit',
  Idle_FoldArms_Loop: 'fold',
  Crouch_Idle_Loop: 'crouch',
  Consume: 'consume',
};
/** The bones a VRM humanoid has a match for. */
const BONES = new Set(['pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'Head', 'clavicle_l', 'clavicle_r', 'upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r', 'hand_l', 'hand_r', 'thigh_l', 'thigh_r', 'calf_l', 'calf_r', 'foot_l', 'foot_r', 'ball_l', 'ball_r']);

const buf = readFileSync(IN);
if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a glTF binary');
let off = 12;
let json = null;
let bin = null;
while (off < buf.length) {
  const len = buf.readUInt32LE(off);
  const type = buf.readUInt32LE(off + 4);
  const chunk = buf.subarray(off + 8, off + 8 + len);
  if (type === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8'));
  else if (type === 0x004e4942) bin = chunk;
  off += 8 + len;
}
const g = json;
const COUNT = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

/** An accessor's floats. */
function floats(i) {
  const a = g.accessors[i];
  if (a.componentType !== 5126) throw new Error('expected floats');
  const v = g.bufferViews[a.bufferView];
  const n = COUNT[a.type];
  const stride = v.byteStride ?? n * 4;
  const start = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const out = new Float32Array(a.count * n);
  for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) out[k * n + c] = bin.readFloatLE(start + k * stride + c * 4);
  return { values: out, type: a.type, count: a.count, min: a.min, max: a.max };
}

const chunks = [];
let size = 0;
const views = [];
const accessors = [];
/** A new accessor over its own buffer view. */
function add(data) {
  const bytes = Buffer.from(data.values.buffer, data.values.byteOffset, data.values.byteLength);
  const pad = (4 - (size % 4)) % 4;
  if (pad) {
    chunks.push(Buffer.alloc(pad));
    size += pad;
  }
  views.push({ buffer: 0, byteOffset: size, byteLength: bytes.length });
  chunks.push(bytes);
  size += bytes.length;
  const acc = { bufferView: views.length - 1, componentType: 5126, count: data.count, type: data.type };
  if (data.min) acc.min = data.min;
  if (data.max) acc.max = data.max;
  accessors.push(acc);
  return accessors.length - 1;
}

const inputs = new Map();
const animations = [];
for (const anim of g.animations) {
  const name = CLIPS[anim.name];
  if (!name) continue;
  const samplers = [];
  const channels = [];
  for (const ch of anim.channels) {
    const bone = g.nodes[ch.target.node]?.name;
    if (!BONES.has(bone)) continue;
    const path = ch.target.path;
    if (path !== 'rotation' && !(path === 'translation' && bone === 'pelvis')) continue;
    const s = anim.samplers[ch.sampler];
    let input = inputs.get(s.input);
    if (input === undefined) {
      input = add(floats(s.input));
      inputs.set(s.input, input);
    }
    samplers.push({ input, output: add(floats(s.output)), interpolation: s.interpolation ?? 'LINEAR' });
    channels.push({ sampler: samplers.length - 1, target: { node: ch.target.node, path } });
  }
  animations.push({ name, samplers, channels });
}

const out = {
  asset: { version: '2.0', generator: 'nghe-noi-am anim-pack', copyright: 'Quaternius Universal Animation Library, CC0' },
  scene: 0,
  scenes: g.scenes,
  nodes: g.nodes.map((n) => {
    const m = { ...n };
    delete m.mesh;
    delete m.skin;
    return m;
  }),
  animations,
  accessors,
  bufferViews: views,
  buffers: [{ byteLength: size }],
};
let js = Buffer.from(JSON.stringify(out), 'utf8');
js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
let body = Buffer.concat(chunks);
body = Buffer.concat([body, Buffer.alloc((4 - (body.length % 4)) % 4)]);
const head = Buffer.alloc(12);
head.writeUInt32LE(0x46546c67, 0);
head.writeUInt32LE(2, 4);
head.writeUInt32LE(12 + 8 + js.length + 8 + body.length, 8);
const jh = Buffer.alloc(8);
jh.writeUInt32LE(js.length, 0);
jh.writeUInt32LE(0x4e4f534a, 4);
const bh = Buffer.alloc(8);
bh.writeUInt32LE(body.length, 0);
bh.writeUInt32LE(0x004e4942, 4);
mkdirSync(dirname(OUT), { recursive: true });
const file = Buffer.concat([head, jh, js, bh, body]);
writeFileSync(OUT, file);
console.log(`${OUT}: ${animations.length} clips (${animations.map((a) => a.name).join(', ')}), ${(file.length / 1024).toFixed(0)} kB`);
