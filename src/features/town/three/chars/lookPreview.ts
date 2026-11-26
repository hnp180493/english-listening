// A picture of somebody in a look that is not (yet) theirs: the admin's preview of new faces (features/admin/
// LookPreview.tsx, owner 2026-11-26: "thấy mặt nhân vật nào nhân vật nấy y chang nhau"). Head and shoulders, or the
// whole body, drawn with the shared offscreen renderer as the portraits are (./portrait.ts). Not cached.

import type { CharacterLook } from '../contracts';
import { canvasOf, charStudio, paint } from '../offscreen';
import { LEG_GROW } from './anim';
import { createPerson, TILE_SCALE } from './person';

let n = 0;

/** `whole`: the whole body (for the head's shape and the height); else head and shoulders. Null without WebGL. */
export function renderLook(look: CharacterLook, w: number, h: number, whole = false, mood: 'neutral' | 'happy' = 'neutral'): HTMLCanvasElement | null {
  const out = canvasOf(w, h);
  const st = charStudio();
  // (an id of its own: nothing cached under a cast member's id)
  const person = createPerson(`preview-${n++}`, look, { mood, detail: 1 });
  person.setHeading(Math.PI / 2 + 0.3, true);
  person.update(0.016, 0);
  st.scene.add(person.root);
  const scale = (look.scale ?? 1) * TILE_SCALE;
  const cam = st.camera;
  cam.aspect = w / h;
  if (whole) {
    cam.position.set(0.05 * scale, (0.55 + LEG_GROW / 2) * scale, 3.6 * scale);
    cam.lookAt(0, (0.45 + LEG_GROW / 2) * scale, 0);
    cam.fov = 26;
  } else {
    // the face close: the head fills the picture
    cam.position.set(0.04 * scale, (0.8 + LEG_GROW) * scale, 1.9 * scale);
    cam.lookAt(0, (0.76 + LEG_GROW) * scale, 0);
    cam.fov = 15;
  }
  cam.near = 0.05;
  cam.far = 20;
  cam.updateProjectionMatrix();
  const drawn = paint(st, out);
  cam.fov = 24;
  st.scene.remove(person.root);
  person.dispose();
  return drawn ? out : null;
}
