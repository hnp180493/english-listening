// Rain over the town (core/town/sky.ts decides how much): a few thousand short streaks in a box that follows what
// the camera looks at. They fall in the vertex shader from a time uniform, wrapped round the box, so a shower costs
// no work a frame and one draw call; how many show goes with the rain's strength, and the wind slants them.

import { AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, LineSegments, ShaderMaterial, Sphere, Vector3 } from 'three';

const COUNT = 2600;

const VERT = /* glsl */ `
uniform float uTime;
uniform vec3 uCenter;
uniform float uAmount;
uniform vec2 uWind;
attribute vec3 aSeed;
attribute float aEnd;
varying float vFade;
const vec3 BOX = vec3(30.0, 13.0, 30.0);
void main() {
  // fewer streaks in a light rain
  float on = step(fract(aSeed.x * 7.31 + aSeed.z * 3.17), uAmount);
  float speed = 13.0 + aSeed.y * 6.0;
  float y = mod(aSeed.y * BOX.y - uTime * speed, BOX.y);
  // wrapped round the middle of the view: the box follows the camera without a streak ever jumping
  vec2 xz = mod(vec2(aSeed.x, aSeed.z) * BOX.xz - uCenter.xz, BOX.xz) - BOX.xz * 0.5 + uCenter.xz;
  vec3 p = vec3(xz.x, y + aEnd * (0.45 + aSeed.x * 0.3), xz.y);
  // the wind slants a streak and pushes the higher drops along
  p.xz += uWind * (p.y * 0.11);
  vFade = on * (1.0 - smoothstep(BOX.y * 0.75, BOX.y, y));
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
varying float vFade;
void main() {
  if (vFade < 0.01) discard;
  gl_FragColor = vec4(uColor, uAlpha * vFade);
}`;

export class Rain {
  readonly mesh: LineSegments;
  private readonly mat: ShaderMaterial;

  constructor() {
    const seed = new Float32Array(COUNT * 2 * 3);
    const end = new Float32Array(COUNT * 2);
    // (a fixed sequence: the same shower on every machine, and no Math.random in a build)
    let s = 12345;
    const rnd = (): number => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
    for (let i = 0; i < COUNT; i++) {
      const x = rnd();
      const y = rnd();
      const z = rnd();
      for (let k = 0; k < 2; k++) {
        seed.set([x, y, z], (i * 2 + k) * 3);
        end[i * 2 + k] = k;
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(new Float32Array(COUNT * 2 * 3), 3));
    geo.setAttribute('aSeed', new Float32BufferAttribute(seed, 3));
    geo.setAttribute('aEnd', new Float32BufferAttribute(end, 1));
    // (the shader places every streak: never culled by the empty positions)
    geo.boundingSphere = new Sphere(new Vector3(), Infinity);
    this.mat = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uCenter: { value: new Vector3() },
        uAmount: { value: 0 },
        uWind: { value: new Vector3() },
        uColor: { value: new Color('#cfe2f5') },
        uAlpha: { value: 0.3 },
      },
    });
    this.mesh = new LineSegments(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 20;
    this.mesh.visible = false;
  }

  /** Each frame: the time, the middle of the view, how hard it rains (0 … 1), the wind (0 … 1) and the night. */
  update(t: number, at: { x: number; z: number }, amount: number, wind: number, night: number): void {
    const on = amount > 0.02;
    if (this.mesh.visible !== on) this.mesh.visible = on;
    if (!on) return;
    const u = this.mat.uniforms;
    u.uTime.value = t;
    (u.uCenter.value as Vector3).set(at.x, 0, at.z);
    u.uAmount.value = Math.min(1, amount);
    (u.uWind.value as Vector3).set(0.55 * wind + 0.12, -0.3 * wind, 0);
    // dimmer at night (streaks are added on top of the picture)
    u.uAlpha.value = 0.34 - 0.16 * night;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
