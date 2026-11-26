// The quest being followed (owner, 2026-11-26: "hướng dẫn làm nhiệm vụ như GTA"): its way is drawn on the minimap and
// the full map only (the gold dots and arrows over the town itself were taken off the same day: "bỏ cái hướng dẫn
// đường đi này ở map chính đi, chỉ hiển thị ở minimap"). What is left here: how far it is, for the quest card.

/** "35 m" for a distance in tiles (a tile is about two metres: a grown-up is a little under one tile high). */
export function metres(tiles: number): string {
  const m = tiles * 2;
  return m < 10 ? `${Math.max(1, Math.round(m))} m` : `${Math.round(m / 5) * 5} m`;
}
