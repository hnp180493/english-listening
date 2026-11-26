// The weather on the town's shared materials (docs/town.md §24): wet ground, cloud shadows and mist, all in the
// shaders the town already draws with (no extra pass, no extra draw call; a few uniforms set when the sky changes and
// two set each frame). Added to the materials by materials.ts:
// - WET: faces looking up (the ground, steps, flat roofs) darken and turn glossy with `wet` (core/town/sunPath.ts
//   wetAt), and on low flat ground puddles open where a fixed noise is high: darker still, almost a mirror (the lamps'
//   lights show in them at night, the sky's colour by day). Westbay's asphalt under its street lamps is the picture.
// - CLOUD SHADOWS: on a broken-cloud day soft patches of shade slide over everything with the wind (the sun's and the
//   lamps' direct light dimmed; the light from all round stays).
// - MIST: things fade into the colour of the horizon with their distance beyond what the camera looks at, more near
//   the ground than up high, so the player and what is round them are never in it.

import { Color, Vector2, Vector3, Vector4, type IUniform, type WebGLProgramParametersWithUniforms } from 'three';

export interface WeatherUniforms {
  /** How wet the ground is, 0 … 1. */
  wet: IUniform<number>;
  /** The sky's colour that puddles and wet ground reflect (linear, added to the light). */
  skyRefl: IUniform<Color>;
  /** How misty, 0 … 0.9 at the far end. */
  haze: IUniform<number>;
  /** The mist's colour, sRGB 0 … 1 (mixed in after the colour-space conversion, as three's fog is). */
  fogColour: IUniform<Vector3>;
  /** x = how far beyond the camera's target the mist starts, y = where it is full (world units). */
  fogRange: IUniform<Vector2>;
  /** What the camera looks at (world): the mist is measured from it. */
  focus: IUniform<Vector3>;
  /** Cloud shadows: x, y = how far the clouds have drifted (world x, z), z = how dark (0 = none), w = their scale. */
  cloud: IUniform<Vector4>;
}

export function makeWeatherUniforms(): WeatherUniforms {
  return {
    wet: { value: 0 },
    skyRefl: { value: new Color(0, 0, 0) },
    haze: { value: 0 },
    fogColour: { value: new Vector3(1, 1, 1) },
    fogRange: { value: new Vector2(3, 40) },
    focus: { value: new Vector3() },
    cloud: { value: new Vector4(0, 0, 0, 0.045) },
  };
}

export interface WeatherParts {
  /** Wet ground and puddles (the vertex-coloured standard material: the ground, buildings, props). */
  wet?: boolean;
  /** Cloud shadows. */
  shade?: boolean;
  /** Mist. */
  mist?: boolean;
}

const COMMON = /* glsl */ `
uniform float uWet;
uniform vec3 uSkyRefl;
uniform float uHaze;
uniform vec3 uFogColour;
uniform vec2 uFogRange;
uniform vec3 uFocus;
uniform vec4 uCloud;
varying vec3 vWxW;
float wxHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float wxNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(wxHash(i), wxHash(i + vec2(1.0, 0.0)), u.x), mix(wxHash(i + vec2(0.0, 1.0)), wxHash(i + vec2(1.0, 1.0)), u.x), u.y);
}`;

const WET = /* glsl */ `
{
  // faces looking up only: the ground, steps, flat roofs (normal is in view space here)
  float wxUp = smoothstep(0.55, 0.92, dot(normal, normalize(viewMatrix[1].xyz)));
  float wxK = uWet * wxUp;
  if (wxK > 0.001) {
    // puddles: on low flat ground, where a fixed noise is high, once the ground is well wet
    float wxN = wxNoise(vWxW.xz * 0.45) * 0.65 + wxNoise(vWxW.xz * 1.35 + 7.1) * 0.35;
    // (seldom on grass: water soaks in there; told by the vertex colour, green over red and blue)
    float wxGrass = smoothstep(0.02, 0.1, diffuseColor.g - max(diffuseColor.r, diffuseColor.b));
    float wxPud = smoothstep(0.6, 0.68, wxN) * smoothstep(0.45, 0.9, uWet) * smoothstep(0.85, 0.98, wxUp) * (1.0 - smoothstep(0.25, 0.45, vWxW.y)) * (1.0 - 0.8 * wxGrass);
    // (a dark surface, asphalt, darkens less: it would go black; its shine is what shows it wet)
    float wxLum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    float wxDark = mix(0.45, 1.0, smoothstep(0.04, 0.25, wxLum));
    diffuseColor.rgb *= 1.0 - (0.34 * wxK + 0.28 * wxPud) * wxDark;
    roughnessFactor = mix(roughnessFactor, 0.3, wxK);
    roughnessFactor = mix(roughnessFactor, 0.12, wxPud);
    // the sky's colour in the wet: strongest at a grazing look, as on a road ahead
    float wxNv = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
    float wxFr = 0.2 + 0.8 * pow(1.0 - wxNv, 2.0);
    totalEmissiveRadiance += uSkyRefl * wxFr * (0.3 * wxK + 1.3 * wxPud);
  }
}`;

const SHADE = /* glsl */ `
if (uCloud.z > 0.001) {
  vec2 wxQ = (vWxW.xz + uCloud.xy) * uCloud.w;
  float wxC = wxNoise(wxQ) * 0.62 + wxNoise(wxQ * 2.3 + 3.7) * 0.38;
  float wxS = 1.0 - uCloud.z * smoothstep(0.42, 0.6, wxC);
  reflectedLight.directDiffuse *= wxS;
  reflectedLight.directSpecular *= wxS;
}`;

const MIST = /* glsl */ `
if (uHaze > 0.001) {
  // the distance beyond what the camera looks at: the player and what is round them are never in it
  float wxD = distance(vWxW, cameraPosition) - distance(uFocus, cameraPosition);
  float wxF = smoothstep(uFogRange.x, uFogRange.y, wxD);
  // thicker near the ground: roofs and treetops stand out of a dawn mist
  float wxH = 1.0 - 0.5 * smoothstep(0.5, 6.0, vWxW.y - uFocus.y);
  gl_FragColor.rgb = mix(gl_FragColor.rgb, uFogColour, clamp(uHaze * wxF * wxH, 0.0, 0.9));
}`;

/** Put the weather into a material's shaders (in its onBeforeCompile, after its own changes). */
export function addWeather(shader: WebGLProgramParametersWithUniforms, w: WeatherUniforms, parts: WeatherParts): void {
  shader.uniforms.uWet = w.wet;
  shader.uniforms.uSkyRefl = w.skyRefl;
  shader.uniforms.uHaze = w.haze;
  shader.uniforms.uFogColour = w.fogColour;
  shader.uniforms.uFogRange = w.fogRange;
  shader.uniforms.uFocus = w.focus;
  shader.uniforms.uCloud = w.cloud;
  shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWxW;').replace(
    '#include <fog_vertex>',
    `#include <fog_vertex>
    {
      vec4 wxP = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        wxP = instanceMatrix * wxP;
      #endif
      vWxW = (modelMatrix * wxP).xyz;
    }`,
  );
  let f = shader.fragmentShader.replace('#include <common>', '#include <common>\n' + COMMON);
  if (parts.wet) f = f.replace('#include <lights_physical_fragment>', WET + '\n#include <lights_physical_fragment>');
  if (parts.shade) f = f.replace('#include <aomap_fragment>', SHADE + '\n#include <aomap_fragment>');
  if (parts.mist) f = f.replace('#include <fog_fragment>', '#include <fog_fragment>\n' + MIST);
  shader.fragmentShader = f;
}
