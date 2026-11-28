// The town's old people and children in Quaternius bodies (docs/town.md §35; who: data/townQuat.ts). The owner's own
// game, Giang Hồ, builds its people from Quaternius' CC0 base characters, one outfit and loose hair, tinted, moved by
// the Universal Animation Library's clips; the VRoid samples (./vrmBody.ts) have only young bodies and young faces.
// This is the same surface ./vrmBody.ts `wearVrm` gives a character (update, headTop, setNight, setOutfit, setHat,
// castLine, umbrella, dispose, and `undress` to go back), so ./vrmPeople.ts hands somebody either.
//
// The body is one of two kits, public/models/people-quat-m.glb / -f.glb (scripts/quat-pack.mjs): a man's or a woman's skeleton
// with the outfit's pieces, the base character's head (and a woman's hands), eyes, brows and loose hair. A clone keeps
// what the person wears; cloth and hair are greyed once (their pictures are brown and dark) and tinted per person from
// their look; skin is tinted toward the look's. Glasses, a bun and a cap are built in code on the head bone.
//
// Motion is the clips' own (public/anim/people.glb, on these very bones: no retargeting): standing idle, a walk below
// JOG_FROM tiles a second, a jog, a sprint from SPRINT_FROM, seated on the seat; faded over CLIP_FADE; each clip sped to
// the ground speed within CLIP_RATE. On top: an old body's stoop and slower step, the code pose's arm while it waves,
// talks or holds something (Animator.armsBusy), the head's turn toward whoever speaks, the umbrella and what is held in
// the right hand.

import { AnimationMixer, CanvasTexture, Color, CylinderGeometry, Euler, Float32BufferAttribute, type BufferGeometry, Group, MathUtils, Mesh, MeshToonMaterial, Quaternion, SphereGeometry, SRGBColorSpace, TorusGeometry, Vector3, type AnimationAction, type AnimationClip, type Material, type Object3D, type SkinnedMesh, type Texture } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { QuatRecipe } from '../../../../data/townQuat';
import { BODY, C, J } from './anim';
import { materials, nightTint, toonRamp } from './materials';
import { PROP_PLACES, TILE_SCALE, type Character3DPlus } from './person';
import { makeProp, type PropId, type PropRig } from './props';
import type { Worn } from './vrmBody';

/** Against the code-built body, as the avatars (./vrmBody.ts TALLER): just under a door. */
const TALLER = 0.8;
/** Tiles a second from which a grown-up jogs, and sprints; an old body walks up to OLD_JOG_FROM and never sprints. */
const JOG_FROM = 1.1;
const SPRINT_FROM = 2.4;
const OLD_JOG_FROM = 1.7;
/** How far a clip is sped up or slowed to the ground speed. */
const CLIP_RATE: readonly [number, number] = [0.8, 1.5];
/** Seconds a change of clip takes. */
const CLIP_FADE = 0.2;
/** The clips' own pace (metres a second for a body 1.8 m tall: Quaternius' walk, jog and sprint). */
const NATIVE = { walk: 1.35, jog: 3.1, sprint: 5.4 } as const;
/**
 * An old body: a small stoop (radians over the back and the neck) and how much slower its step is. Kept small: the
 * clips' own stand is already rounded, and a larger stoop on top of it read as a hunch.
 */
const STOOP = { old: 0.06, older: 0.03 } as const;
/**
 * How far a run may tip the pelvis past the idle stand (radians). The jog and the sprint fold it much further, and
 * with the chest's own bend that read as a hunch on every body.
 */
const PELVIS_LEAN = 0.12;
const OLD_RATE = { old: 0.82, older: 0.92 } as const;
/** Things held, as large as a person's (./vrmBody.ts HELD_SIZE). */
const HELD_SIZE = { cup: 0.35, book: 0.45, rod: 0.55, can: 0.75 } as const;
const PROPS: readonly PropId[] = ['cup', 'can', 'rod', 'book'];
/** Night: the colours darkened toward a cool grey (as the avatars). */
const NIGHT = new Color('#bcc2e4');
/** How much of the cloth picture's light and dark is kept (./grey). */
const CLOTH_KEEP = 0.35;
const TOP_KEEP = 0.18;
/** Where a boot's foot ends and its shaft begins (metres up from the sole, at rest). */
const SHOE_TOP = 0.13;
/** Standing, the legs brought together (the clips' mannequin stands wide), radians each thigh. */
const STAND_CLOSE = 0.07;
/** An old body's shoulders brought in (the shoulder joint along the collarbone). */
const SHOULDERS = { old: 0.84, older: 0.9 } as const;
/** The base character's own skin, which the look's skin is reckoned against. */
const SKIN_REF = new Color('#e3ae8f');

const LOCO = ['idle', 'walk', 'jog', 'sprint', 'sit'] as const;
type Loco = (typeof LOCO)[number];

interface Kit {
  body: Object3D;
  clips: Map<string, AnimationClip>;
}
const kits = new Map<'m' | 'f', Promise<Kit>>();
let clipsAt: Promise<Map<string, AnimationClip>> | null = null;

/** A kit (a file of its own each: their bones have the same names) and the clips, each read once. */
function loadKit(sex: 'm' | 'f'): Promise<Kit> {
  const had = kits.get(sex);
  if (had) return had;
  const base = import.meta.env.BASE_URL;
  const loader = new GLTFLoader();
  if (!clipsAt) {
    clipsAt = loader.loadAsync(base + 'anim/people.glb').then((a) => new Map(a.animations.map((c) => [c.name, c])));
    clipsAt.catch(() => (clipsAt = null));
  }
  const at = Promise.all([loader.loadAsync(base + `models/people-quat-${sex}.glb`), clipsAt]).then(([g, clips]) => {
    const body = g.scene.getObjectByName('quat-' + sex);
    if (!body) throw new Error(`people-quat-${sex}.glb: no kit`);
    return { body, clips };
  });
  at.catch(() => kits.delete(sex));
  kits.set(sex, at);
  return at;
}

/**
 * Cloth and hair pictures greyed and brightened once (they are browns and near-blacks): the tint then reads true.
 * `keep`: how much of the picture's own light and dark is kept (cloth little: the Peasant top's dark laced band, a
 * corset from the usual camera, nearly goes, the folds stay).
 */
const greyed = new Map<string, Texture>();
function grey(tex: Texture, level: number, keep = 1): Texture {
  const done = greyed.get(tex.uuid + ':' + keep);
  if (done) return done;
  const img = tex.image as CanvasImageSource & { width: number; height: number };
  const w = Math.min(512, img.width);
  const h = Math.min(512, img.height);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  if (!g) return tex;
  g.drawImage(img, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h);
  let sum = 0;
  for (let i = 0; i < d.data.length; i += 4) sum += 0.3 * d.data[i] + 0.59 * d.data[i + 1] + 0.11 * d.data[i + 2];
  const mean = sum / (d.data.length / 4) || 1;
  const k = (level * 255) / mean;
  for (let i = 0; i < d.data.length; i += 4) {
    const y = Math.min(255, level * 255 + ((0.3 * d.data[i] + 0.59 * d.data[i + 1] + 0.11 * d.data[i + 2]) * k - level * 255) * keep);
    d.data[i] = d.data[i + 1] = d.data[i + 2] = y;
  }
  g.putImageData(d, 0, 0);
  const out = new CanvasTexture(c);
  out.colorSpace = SRGBColorSpace;
  out.flipY = tex.flipY;
  out.wrapS = tex.wrapS;
  out.wrapT = tex.wrapT;
  greyed.set(tex.uuid + ':' + keep, out);
  return out;
}

const _v = new Vector3();
const _v2 = new Vector3();
const _q = new Quaternion();
const _q2 = new Quaternion();
const _dq = new Quaternion();
const _ax = new Vector3();
const _eu = new Euler();
const _eu2 = new Euler();
const X = new Vector3(1, 0, 0);
const Y = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);

/** The pieces of a kit somebody wears. */
function piecesFor(r: QuatRecipe): Set<string> {
  const keep = new Set(['top', 'arms', 'legs', 'feet', 'head', 'hands', 'eyes', 'brows']);
  if (r.hair !== 'none') keep.add('hair-' + r.hair);
  if (r.beard && r.sex === 'm') keep.add('beard');
  return keep;
}

/**
 * Show `ch` in a Quaternius body from now on. Resolves once it stands there (null when the person left meanwhile);
 * rejects when the files cannot be read (the code-built body stays). `grow`: taller than out in the world (a room).
 */
export async function wearQuat(ch: Character3DPlus, recipe: QuatRecipe, grow = 1, gone: () => boolean = () => false): Promise<Worn | null> {
  const kit = await loadKit(recipe.sex);
  if (gone()) return null;
  const body = cloneSkinned(kit.body);
  const keep = piecesFor(recipe);
  const drop: Object3D[] = [];
  body.traverse((o) => {
    if ((o as SkinnedMesh).isSkinnedMesh && !keep.has(o.name)) drop.push(o);
  });
  for (const o of drop) o.removeFromParent();

  // materials: one set per person (toon, as the town's code-built people), the base colours kept for the night
  const ramp = toonRamp();
  const tinted: { m: MeshToonMaterial; color: Color }[] = [];
  const top = new Color(recipe.top);
  const skin = new Color(recipe.skin);
  const skinTint = new Color(Math.min(1.6, skin.r / SKIN_REF.r), Math.min(1.6, skin.g / SKIN_REF.g), Math.min(1.6, skin.b / SKIN_REF.b));
  const tops: MeshToonMaterial[] = [];
  /** Geometries made for this person alone (freed with them). */
  const owned: BufferGeometry[] = [];
  let headMesh: SkinnedMesh | null = null;
  body.traverse((o) => {
    const mesh = o as SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    if (mesh.name === 'head') headMesh = mesh;
    const src = mesh.material as Material & { name: string; map?: Texture | null };
    const kind = src.name;
    let map = src.map ?? null;
    let color = new Color('#ffffff');
    if (kind === 'cloth') {
      // (the top flatter still: its laced band)
      map = map ? grey(map, 0.86, mesh.name === 'top' || mesh.name === 'arms' ? TOP_KEEP : CLOTH_KEEP) : null;
      // the trousers in the look's colour; the outfit's tall boots: their shafts in the trousers' colour, the foot in
      // the shoes' (per vertex, on a copy of the geometry: it is shared by every clone), so they read as trousers and
      // shoes
      if (mesh.name === 'feet') {
        const g = mesh.geometry.clone();
        const pos = g.getAttribute('position');
        const cols = new Float32Array(pos.count * 3);
        const lower = new Color(recipe.shoes);
        const upper = new Color(recipe.bottom);
        for (let i = 0; i < pos.count; i++) {
          const c = pos.getY(i) > SHOE_TOP ? upper : lower;
          cols[i * 3] = c.r;
          cols[i * 3 + 1] = c.g;
          cols[i * 3 + 2] = c.b;
        }
        g.setAttribute('color', new Float32BufferAttribute(cols, 3));
        mesh.geometry = g;
        owned.push(g);
      }
      color = mesh.name === 'legs' ? new Color(recipe.bottom) : mesh.name === 'feet' ? new Color('#ffffff') : top.clone();
    } else if (kind === 'skin' || kind === 'skin-hands') color = skinTint.clone();
    else if (kind === 'hair1' || kind === 'hair2') {
      map = map ? grey(map, 0.85) : null;
      color = new Color(mesh.name === 'beard' ? (recipe.beard ?? recipe.hairColor) : recipe.hairColor);
    }
    const m = new MeshToonMaterial({ map, color, gradientMap: ramp, vertexColors: mesh.name === 'feet' && kind === 'cloth' });
    if (kind === 'cloth' && (mesh.name === 'top' || mesh.name === 'arms')) tops.push(m);
    tinted.push({ m, color: color.clone() });
    mesh.material = m;
  });

  // sizes, in the kit's units (metres) at rest
  body.updateMatrixWorld(true);
  const headGeo = (headMesh as SkinnedMesh | null)?.geometry;
  headGeo?.computeBoundingBox();
  const tallM = headGeo?.boundingBox ? headGeo.boundingBox.max.y : 1.78;
  const bone = (name: string): Object3D | null => body.getObjectByName(name) ?? null;
  const pelvis = bone('pelvis');
  const head = bone('Head');
  const spine = [bone('spine_01'), bone('spine_02'), bone('spine_03')];
  const neck = bone('neck_01');
  const handR = bone('hand_r');
  const fingerR = bone('middle_01_r');
  const chestBone = bone('spine_03');
  const arms = { shL: bone('upperarm_l'), elL: bone('lowerarm_l'), shR: bone('upperarm_r'), elR: bone('lowerarm_r') };
  const pelvisRest = pelvis ? pelvis.position.clone() : new Vector3();
  const thighs = [bone('thigh_l'), bone('thigh_r')] as const;
  // an old body: narrower shoulders (the clips turn bones, they never move them, so this stays)
  if (recipe.kind === 'old' || recipe.kind === 'older') for (const b of [arms.shL, arms.shR]) b?.position.multiplyScalar(SHOULDERS[recipe.kind]);

  // as tall as the avatar it stands in for (./vrmBody.ts: a child by its own tall, a grown-up by the body's tiles)
  const anim = ch.animator;
  const kid = recipe.kind === 'child' || recipe.kind === 'toddler';
  const world = BODY.headTop * (kid ? TILE_SCALE : anim.tiles) * TALLER * recipe.tall * grow;
  const s = world / tallM;
  const holder = new Group();
  holder.name = 'quat';
  holder.scale.setScalar(s);
  holder.add(body);
  if (head && recipe.head !== 1) head.scale.setScalar(recipe.head);

  // the clips, on these bones
  const mixer = new AnimationMixer(body);
  const actions = {} as Record<Loco, AnimationAction | null>;
  for (const n of LOCO) {
    const clip = kit.clips.get(n);
    actions[n] = clip ? mixer.clipAction(clip) : null;
  }
  // where the clips put the pelvis (their mannequin's) against this skeleton's: added back every frame.
  // This skeleton's rest already rounds the chest (about 25° over the three spine bones) and tips the head down
  // (about 24°). Worn as the stand, with the clips' jog on top, everybody looked hunched. The pelvis rest is how the
  // body stands; a clip may lean it only a little past that.
  const pelvisFix = new Vector3();
  const pelvisStand = new Quaternion();
  if (pelvis) pelvisStand.copy(pelvis.quaternion);
  let sitPelvis = tallM * 0.5;
  if (pelvis && actions.idle) {
    actions.idle.play().setEffectiveWeight(1);
    mixer.update(0);
    pelvisFix.copy(pelvisRest).sub(pelvis.position);
    actions.idle.stop();
    if (actions.sit) {
      actions.sit.play().setEffectiveWeight(1);
      mixer.update(0);
      pelvis.position.add(pelvisFix);
      body.updateMatrixWorld(true);
      sitPelvis = body.worldToLocal(pelvis.getWorldPosition(_v)).y / 1;
      actions.sit.stop();
    }
  }
  const w: Record<Loco, number> = { idle: 1, walk: 0, jog: 0, sprint: 0, sit: 0 };
  for (const n of LOCO) actions[n]?.play().setEffectiveWeight(w[n]);

  // what is built on the head: glasses, a bun, a cap (in the kit's units, at rest, then hung on the head bone)
  const built: Mesh[] = [];
  const hang = (mesh: Mesh, at: Vector3): void => {
    if (!head) return;
    body.updateMatrixWorld(true);
    const wp = body.localToWorld(at.clone());
    head.add(mesh);
    mesh.position.copy(head.worldToLocal(wp));
    head.getWorldQuaternion(_q);
    body.getWorldQuaternion(_q2);
    mesh.quaternion.copy(_q.invert().multiply(_q2));
    // (the head bone's own scale: a child's larger head carries larger glasses)
    mesh.scale.setScalar(1 / Math.max(0.001, head.scale.x)).multiplyScalar(recipe.head);
    mesh.castShadow = true;
    built.push(mesh);
  };
  const eyes = body.getObjectByName('eyes') as SkinnedMesh | undefined;
  eyes?.geometry.computeBoundingBox();
  const eyeBox = eyes?.geometry.boundingBox;
  const eyeY = eyeBox ? (eyeBox.min.y + eyeBox.max.y) / 2 : tallM * 0.93;
  const eyeZ = eyeBox ? eyeBox.max.z : 0.1;
  const eyeX = eyeBox ? (eyeBox.max.x - eyeBox.min.x) / 4 : 0.032;
  const skull = head ? body.worldToLocal(head.getWorldPosition(_v)).clone() : new Vector3(0, tallM * 0.9, 0);
  if (recipe.glasses) {
    const frame = new MeshToonMaterial({ color: '#2b2b30', gradientMap: ramp });
    tinted.push({ m: frame, color: frame.color.clone() });
    const lens = new TorusGeometry(0.019, 0.0035, 6, 18);
    for (const side of [-1, 1]) hang(new Mesh(lens, frame), new Vector3(side * eyeX, eyeY, eyeZ + 0.012));
    hang(new Mesh(new CylinderGeometry(0.0025, 0.0025, eyeX * 2 - 0.036, 5).rotateZ(Math.PI / 2), frame), new Vector3(0, eyeY + 0.004, eyeZ + 0.014));
  }
  if (recipe.bun) {
    const m = new MeshToonMaterial({ map: null, color: recipe.bun, gradientMap: ramp });
    tinted.push({ m, color: m.color.clone() });
    hang(new Mesh(new SphereGeometry(0.052, 12, 10), m), new Vector3(0, eyeY + 0.07, skull.z - 0.085));
  }
  if (recipe.cap) {
    const m = new MeshToonMaterial({ color: recipe.cap, gradientMap: ramp });
    tinted.push({ m, color: m.color.clone() });
    hang(new Mesh(new SphereGeometry(0.105, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.75, 1.08), m), new Vector3(0, eyeY + 0.055, skull.z + 0.01));
    hang(new Mesh(new CylinderGeometry(0.075, 0.075, 0.008, 14, 1, false, -Math.PI / 2, Math.PI).scale(1, 1, 0.9), m), new Vector3(0, eyeY + 0.06, eyeZ + 0.02));
  }

  const pivot = ch.root.getObjectByName('pivot');
  if (pivot) pivot.visible = false;
  ch.root.add(holder);

  // What is added on top of the clips is taken off again before the next mix: three's mixer writes a bone only when
  // its mixed value changed (a frame with dt 0, a still clip), and what was added would pile up frame on frame (a
  // body drifting off its place, a back bending double).
  const clipQ = new Map<Object3D, Quaternion>();
  const savedNow = new Set<Object3D>();
  const pelvisAdded = new Vector3();
  const undoAdded = (): void => {
    for (const n of savedNow) n.quaternion.copy(clipQ.get(n)!);
    savedNow.clear();
    if (pelvis) pelvis.position.sub(pelvisAdded);
    pelvisAdded.set(0, 0, 0);
  };
  /**
   * Remember the clip's own turn, so the next frame can take this addition off before the mixer writes again
   * (see undoAdded). Then `pose` replaces it.
   */
  const overClip = (node: Object3D, pose: () => void): void => {
    if (!savedNow.has(node)) {
      let q = clipQ.get(node);
      if (!q) clipQ.set(node, (q = new Quaternion()));
      q.copy(node.quaternion);
      savedNow.add(node);
    }
    pose();
    node.updateMatrix();
  };
  /**
   * Take the forward bend off a spine, neck or head bone (their rest is that bend) and keep only a little twist.
   * The legs keep the clip.
   */
  const holdBack = (node: Object3D | null): void => {
    if (!node) return;
    overClip(node, () => {
      _eu.setFromQuaternion(node.quaternion, 'XYZ');
      _eu.x = 0;
      _eu.y = MathUtils.clamp(_eu.y, -0.12, 0.12);
      _eu.z = MathUtils.clamp(_eu.z, -0.08, 0.08);
      node.quaternion.setFromEuler(_eu);
    });
  };
  /** A run may tip the pelvis a little past the idle stand, not fold the whole body forward. */
  const holdPelvis = (): void => {
    if (!pelvis) return;
    overClip(pelvis, () => {
      _eu.setFromQuaternion(pelvis.quaternion, 'XYZ');
      const ix = _eu2.setFromQuaternion(pelvisStand, 'XYZ').x;
      _eu.x = MathUtils.clamp(_eu.x, ix - PELVIS_LEAN, ix + PELVIS_LEAN);
      pelvis.quaternion.setFromEuler(_eu);
    });
  };
  /** Turn a bone by `angle` round an axis given in the holder's frame (the body's own: x right, y up, z ahead). */
  const turn = (node: Object3D | null, axis: Vector3, angle: number): void => {
    if (!node?.parent || Math.abs(angle) < 1e-5) return;
    if (!savedNow.has(node)) {
      let q = clipQ.get(node);
      if (!q) clipQ.set(node, (q = new Quaternion()));
      q.copy(node.quaternion);
      savedNow.add(node);
    }
    holder.getWorldQuaternion(_q);
    node.parent.getWorldQuaternion(_q2);
    _ax.copy(axis).applyQuaternion(_q).applyQuaternion(_q2.invert());
    node.quaternion.premultiply(_dq.setFromAxisAngle(_ax, angle));
    node.updateMatrix();
  };

  const old = recipe.kind === 'old' || recipe.kind === 'older' ? recipe.kind : null;
  const held = new Map<PropId, PropRig>();
  const umbrellaAt = new Group();
  umbrellaAt.name = 'umbrella';
  holder.add(umbrellaAt);
  let umbrellaOn = false;
  let castPoint: Vector3 | null = null;
  /** The clip's ground speed in tiles a second, at this body's size. */
  const tilesPerM = world / tallM;

  const before = { update: ch.update, headTop: ch.headTop, setNight: ch.setNight, setOutfit: ch.setOutfit, dispose: ch.dispose, setHat: ch.setHat, castLine: ch.castLine, umbrella: ch.umbrella };
  const update = ch.update.bind(ch);
  ch.update = (dt: number, speed: number) => {
    update(dt, speed);
    if (pivot) holder.rotation.y = pivot.rotation.y;
    const p = anim.pose;
    const seat = anim.seatBlend;

    // which clip: by the ground speed (an old body walks longer, never sprints)
    const moving = anim.move * (1 - seat);
    const jogFrom = old ? OLD_JOG_FROM : JOG_FROM;
    const gait: Loco = speed >= SPRINT_FROM && !old ? 'sprint' : speed >= jogFrom ? 'jog' : 'walk';
    const want: Record<Loco, number> = { idle: (1 - moving) * (1 - seat), walk: 0, jog: 0, sprint: 0, sit: seat };
    want[gait] = moving;
    const k = dt > 0 ? 1 - Math.exp((-3 * dt) / CLIP_FADE) : 1;
    for (const n of LOCO) {
      w[n] += (want[n] - w[n]) * k;
      const a = actions[n];
      if (!a) continue;
      a.setEffectiveWeight(w[n]);
      if (n === 'walk' || n === 'jog' || n === 'sprint') {
        const native = NATIVE[n] * tilesPerM;
        a.setEffectiveTimeScale(MathUtils.clamp(speed / native, CLIP_RATE[0], CLIP_RATE[1]) * (old ? OLD_RATE[old] : 1));
      }
    }
    undoAdded();
    mixer.update(dt);
    if (pelvis) {
      pelvis.position.add(pelvisFix);
      pelvisAdded.copy(pelvisFix);
    }
    // standing and walking, the chest and the head lose the rest pose's forward bend (a seat keeps the sit clip).
    // The pelvis may lean a little, not fold.
    if (seat < 0.5) {
      for (const b of spine) holdBack(b);
      holdBack(neck);
      holdBack(head);
      holdPelvis();
    }
    // seated: the hips on the seat (the clip sits on a chair of its own height)
    const seatTop = (anim.seat * anim.tiles) / s;
    holder.position.y = seat * ((seatTop + tallM * 0.055 - sitPelvis) * s);

    // an old body's stoop and a head a little down with it
    if (old) {
      const st = STOOP[old] * (1 - seat * 0.6);
      for (const b of spine) turn(b, X, st / 3);
      turn(neck, X, -st * 0.25);
    }
    // standing, the feet nearer together (the left thigh is on +x: turned toward -x round z, the right the other way)
    const close = STAND_CLOSE * (w.idle + 0.4 * (w.walk + w.jog));
    turn(thighs[0], Z, -close);
    turn(thighs[1], Z, close);
    // a run: the clip flails out; drop it and put the code's compact pump. A walk keeps the clip's arms.
    const busyL = anim.armsBusy[0];
    const busyR = anim.armsBusy[1];
    const runArm = (w.jog + w.sprint) * (1 - seat);
    if (runArm > 0.05) {
      for (const b of [arms.shL, arms.elL, arms.shR, arms.elR]) {
        if (!b) continue;
        overClip(b, () => {
          b.quaternion.identity();
        });
      }
      turn(arms.shL, X, -p[J.shL * 3] * runArm);
      turn(arms.shL, Z, p[J.shL * 3 + 2] * runArm);
      turn(arms.elL, X, -p[J.elL * 3] * runArm);
      turn(arms.shR, X, -p[J.shR * 3] * runArm);
      turn(arms.shR, Z, -p[J.shR * 3 + 2] * runArm);
      turn(arms.elR, X, -p[J.elR * 3] * runArm);
    }
    const arm = (node: Object3D | null, j: number, busy: number, side: number): void => {
      if (busy < 0.01) return;
      turn(node, X, -p[j * 3] * busy);
      turn(node, Z, side * p[j * 3 + 2] * busy);
    };
    arm(arms.shL, J.shL, busyL, 1);
    arm(arms.elL, J.elL, busyL, 1);
    arm(arms.shR, J.shR, busyR, 1);
    arm(arms.elR, J.elR, busyR, 1);
    turn(head, Y, p[J.head * 3 + 1]);
    turn(head, X, -p[J.head * 3] * 0.6);

    // the umbrella: the right arm up in front, the grip in the palm, the canopy over the head
    const uw = p[C.umbrella];
    umbrellaOn = uw > 0.02 && !!handR;
    if (umbrellaOn && handR) {
      turn(arms.shR, X, -0.9 * uw);
      turn(arms.shR, Z, 0.25 * uw);
      turn(arms.elR, X, -1.3 * uw);
      holder.updateMatrixWorld(true);
      const palm = handR.getWorldPosition(_v);
      if (fingerR) palm.lerp(fingerR.getWorldPosition(_v2), 0.5);
      holder.worldToLocal(palm);
      umbrellaAt.position.copy(palm);
      const topY = holder.worldToLocal(ch.headTop(_v2)).y;
      const size = MathUtils.clamp((topY + tallM * 0.07 - palm.y) / 0.505, tallM * 0.6, tallM * 1.6);
      const hc = head ? holder.worldToLocal(head.getWorldPosition(_v2)) : palm.clone();
      umbrellaAt.quaternion.setFromUnitVectors(Y, _v2.set((hc.x - palm.x) * 0.7, 0.6 * size, (hc.z - palm.z) * 0.7).normalize());
      const pop = MathUtils.clamp(uw, 0, 1);
      umbrellaAt.scale.setScalar(size * Math.max(0.001, 1 + 2.2 * Math.pow(pop - 1, 3) + 1.2 * Math.pow(pop - 1, 2)));
    }

    // what is held: in the right hand (the book before the chest), upright in the body's frame
    for (const pid of PROPS) {
      const place = PROP_PLACES[pid];
      const pw = p[place.channel];
      let r = held.get(pid);
      if (pw < 0.02) {
        if (r) r.root.visible = false;
        continue;
      }
      const parent = pid === 'book' ? chestBone : handR;
      if (!parent) continue;
      if (!r) {
        r = makeProp(pid, materials().body);
        parent.add(r.root);
        held.set(pid, r);
      }
      r.root.visible = true;
      const kk = MathUtils.clamp(pw, 0, 1);
      parent.getWorldScale(_v2);
      const size = ((anim.tiles * 1.5) / s / Math.max(0.001, _v2.x / s)) * HELD_SIZE[pid] * Math.max(0.001, 1 + 2.2 * Math.pow(kk - 1, 3) + 1.2 * Math.pow(kk - 1, 2));
      r.root.scale.setScalar(size);
      parent.getWorldQuaternion(_q);
      holder.getWorldQuaternion(_q2);
      const tilt = pid === 'cup' ? -1.0 * p[C.sip] : pid === 'can' ? p[C.canTilt] : -0.35 * p[C.tug];
      _dq.setFromAxisAngle(X, place.rot[0] + (pid === 'book' ? 0.35 : 0) + tilt);
      r.root.quaternion.copy(_q.invert()).multiply(_q2).multiply(_dq);
      if (pid === 'book') parent.worldToLocal(holder.localToWorld(_v.set(0, tallM * 0.74, tallM * 0.16)));
      else _v.set(0, 0, 0).lerp(fingerR ? fingerR.position : _v2.set(0, 0.06, 0), 0.6);
      r.root.position.copy(_v);
      if (pid === 'can') r.tick(dt, p[C.canTilt] * kk);
      else if (pid === 'rod') {
        r.aim?.(castPoint);
        r.tick(dt, p[C.tug]);
      }
    }
  };
  ch.umbrella = () => (umbrellaOn ? umbrellaAt : null);

  ch.headTop = (target: Vector3) => {
    if (!head) return before.headTop.call(ch, target);
    head.getWorldPosition(target);
    target.y += (tallM - skull.y + 0.015) * s * recipe.head;
    return target;
  };

  let night = 0;
  const setNight = ch.setNight.bind(ch);
  ch.setNight = (amount: number) => {
    setNight(amount);
    night = MathUtils.clamp(amount, 0, 1);
    for (const t of tinted) t.m.color.copy(t.color).lerp(_c.copy(t.color).multiply(NIGHT), night);
  };
  const _c = new Color();
  // an outfit colour of the wardrobe: the top and sleeves take it
  const setOutfit = ch.setOutfit.bind(ch);
  ch.setOutfit = (color: string | null) => {
    setOutfit(color);
    _c.set(color ?? recipe.top);
    for (const m of tops) {
      const t = tinted.find((x) => x.m === m);
      if (t) t.color.copy(_c);
    }
    ch.setNight(night);
  };
  const setHat = ch.setHat.bind(ch);
  ch.setHat = (id: string | null) => setHat(id);
  const castLine = ch.castLine.bind(ch);
  ch.castLine = (point: Vector3 | null) => {
    castLine(point);
    castPoint = point;
  };

  let off = false;
  const strip = (): void => {
    if (off) return;
    off = true;
    ch.root.remove(holder);
    for (const r of held.values()) r.root.removeFromParent();
    umbrellaAt.removeFromParent();
    umbrellaOn = false;
    mixer.stopAllAction();
    mixer.uncacheRoot(body);
    for (const m of built) m.geometry.dispose();
    for (const g of owned) g.dispose();
    for (const t of tinted) t.m.dispose();
  };
  const dispose = ch.dispose.bind(ch);
  ch.dispose = () => {
    strip();
    dispose();
  };
  ch.setNight(nightTint());
  return {
    undress() {
      if (off) return;
      strip();
      Object.assign(ch, before);
      if (pivot) pivot.visible = true;
    },
  };
}

/** For the admin sheet: the kit loaded (to draw the people without the stage). */
export const quatKitReady = (): Promise<unknown> => Promise.all([loadKit('m'), loadKit('f')]);
