// Can this browser draw the 3D town? WebGL 2 on a real graphics card. Checked once per session; without it the town
// page shows its residents and activities without the world (TownStage3D `flat`).

let known: boolean | null = null;

export function webglAvailable(): boolean {
  if (known !== null) return known;
  try {
    const c = document.createElement('canvas');
    // a software renderer (SwiftShader, llvmpipe) draws the town at a frame or two a second: no world is better there
    const gl = c.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    const name = gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    known = !!gl && !/swiftshader|llvmpipe|software|microsoft basic render/i.test(name);
    (gl?.getExtension('WEBGL_lose_context') as { loseContext?: () => void } | null)?.loseContext?.();
  } catch {
    known = false;
  }
  return known;
}

/** Dev builds: `#/town?r=flat` shows the page as a browser without 3D sees it. */
export function wantsFlat(hash: string = typeof window !== 'undefined' ? window.location.hash : ''): boolean {
  if (!import.meta.env.DEV) return false;
  const q = hash.indexOf('?');
  return q >= 0 && new URLSearchParams(hash.slice(q + 1)).get('r') === 'flat';
}
