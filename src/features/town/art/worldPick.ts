// Which picture stands where, decided the same way by the art renderer (scripts/town-art, which bakes the fixed
// trees' shadows into the ground) and by the game (world.ts, which draws the trees): pure, no imports, so Node can
// load it as it is.

/** Sprite variants per tree kind of the layout ('T' round, 't' pine in townWorld.ts). */
export const TREE_VARIANTS = { round: 3, pine: 2 } as const;

export type TreeKindArt = keyof typeof TREE_VARIANTS;

/** A small stable hash of a tile, 0 ≤ h < 1. */
export function tileHash(x: number, y: number, salt = 0): number {
  let h = Math.imul(x * 73856093 + 19349663, 0x9e3779b1) ^ Math.imul(y * 83492791 + salt * 2654435761, 0x85ebca6b);
  h ^= h >>> 15;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/** The variant (0…n-1) of the tree standing on tile (x, y). */
export function treeVariant(kind: TreeKindArt, x: number, y: number): number {
  return Math.floor(tileHash(x, y, kind === 'round' ? 1 : 2) * TREE_VARIANTS[kind]);
}

/** Its sprite key in the world manifest. */
export function treeSpriteKey(kind: TreeKindArt, x: number, y: number): string {
  return `tree/${kind}/${treeVariant(kind, x, y)}`;
}
