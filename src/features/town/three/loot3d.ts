// What eggs hatch and what the wardrobe dresses, in 3D (the same people and pets as the town, chars/**), drawn with
// the shared offscreen renderer onto the panel's own 2D canvas (offscreen.ts): a pet standing, a hat on the player's
// head, the player in an outfit's colour, and the wardrobe's live preview (the player dressed, the pet beside him).
// A `LootView` keeps its models while a panel shows it and draws a frame on demand: idle life (breathing, blinking,
// the pet looking about) when the caller animates, one still frame under reduced motion.

import { Quaternion, Vector3, type Object3D } from 'three';
import { lootItem } from '../../../data/townGame';
import { createPerson, TILE_SCALE, type Character3DPlus } from './chars/person';
import { createPet } from './chars/pets';
import type { Pet3D } from './contracts';
import { charStudio, frame, paint } from './offscreen';

export type LootSpec =
  /** One pet, 3/4 front. */
  | { kind: 'pet'; pet: string }
  /** The player's head and shoulders wearing a hat (and an outfit). */
  | { kind: 'bust'; hat?: string | null; outfit?: string | null }
  /** The player whole, dressed, and the pet beside him. */
  | { kind: 'figure'; hat?: string | null; outfit?: string | null; pet?: string | null };

/** An outfit's colour: a loot id (data/townGame LOOT) or a hex colour as it is. */
export function outfitColor(outfit: string | null | undefined): string | null {
  if (!outfit) return null;
  return outfit.startsWith('#') ? outfit : (lootItem(outfit)?.color ?? null);
}

interface Pose {
  pos: Vector3;
  quat: Quaternion;
  fov: number;
  near: number;
  far: number;
}

export class LootView {
  private readonly person: Character3DPlus | null = null;
  private readonly pet: Pet3D | null = null;
  private readonly parts: Object3D[] = [];
  private pose: Pose | null = null;
  private aspect = 0;
  private readonly spec: LootSpec;

  constructor(spec: LootSpec) {
    this.spec = spec;
    if (spec.kind !== 'pet') {
      const p = createPerson('player', undefined, { mood: 'happy', detail: 1 });
      if (spec.hat) p.setHat(spec.hat);
      const color = outfitColor(spec.outfit);
      if (color) p.setOutfit(color);
      // 3/4 front, turned a little towards the pet on his right (the viewer's left)
      p.setHeading(Math.PI / 2 + (spec.kind === 'bust' ? 0.3 : 0.38), true);
      p.update(0.016, 0);
      if (spec.kind === 'figure' && spec.pet) p.root.position.x = 0.16;
      this.person = p;
      this.parts.push(p.root);
    }
    const petId = spec.kind === 'pet' ? spec.pet : spec.kind === 'figure' ? spec.pet : null;
    if (petId) {
      const pet = createPet(petId);
      pet.setHeading(Math.PI / 2 - (spec.kind === 'pet' ? 0.62 : 0.3), true);
      pet.update(0.016, 0);
      if (spec.kind === 'figure') pet.root.position.set(-0.3, 0, 0.18);
      this.pet = pet;
      this.parts.push(pet.root);
    }
  }

  /** Where the camera stands for a canvas of this shape (worked out once, on the rest pose). */
  private aim(aspect: number): void {
    const st = charStudio();
    const cam = st.camera;
    if (this.spec.kind === 'bust' && this.person) {
      const scale = (this.person.look.scale ?? 1) * TILE_SCALE;
      const hat = this.spec.hat ? 0.12 : 0;
      cam.aspect = aspect;
      cam.fov = 25 + hat * 32;
      cam.near = 0.05;
      cam.far = 20;
      cam.position.set(0.04 * scale, (0.78 + hat * 0.4) * scale, 1.9 * scale);
      cam.lookAt(0, (0.7 + hat * 0.5) * scale, 0);
      cam.updateProjectionMatrix();
    } else {
      cam.fov = 24;
      frame(st, this.parts, { aspect, yaw: Math.PI / 2, pitch: this.spec.kind === 'pet' ? 0.42 : 0.2, fill: this.spec.kind === 'pet' ? 0.84 : 0.9 });
    }
    this.pose = { pos: cam.position.clone(), quat: cam.quaternion.clone(), fov: cam.fov, near: cam.near, far: cam.far };
    this.aspect = aspect;
  }

  /** Draw a frame into `target` (its own pixel size), `dt` seconds after the last one (0 = as it stands). */
  draw(target: HTMLCanvasElement, dt = 0): boolean {
    const st = charStudio();
    const aspect = target.width / Math.max(1, target.height);
    if (!this.pose || Math.abs(aspect - this.aspect) > 1e-3) this.aim(aspect);
    const pose = this.pose!;
    if (dt > 0) {
      this.person?.update(dt, 0);
      this.pet?.update(dt, 0);
    }
    const cam = st.camera;
    cam.position.copy(pose.pos);
    cam.quaternion.copy(pose.quat);
    cam.fov = pose.fov;
    cam.near = pose.near;
    cam.far = pose.far;
    cam.aspect = aspect;
    cam.updateProjectionMatrix();
    for (const o of this.parts) st.scene.add(o);
    const ok = paint(st, target);
    for (const o of this.parts) st.scene.remove(o);
    return ok;
  }

  dispose(): void {
    this.person?.dispose();
    this.pet?.dispose();
  }
}

