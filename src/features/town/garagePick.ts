// Which of the learner's own vehicles (data/townGarage.ts) the "Gọi …" button brings: the one picked in the garage
// (KEYS.townUi `ride`, this browser), else the dearest one owned. Pure: the page passes what it read.

import { GARAGE, type GarageVehicle } from '../../data/townGarage';

export function ownedVehicles(bought: readonly string[]): GarageVehicle[] {
  const have = new Set(bought);
  return GARAGE.filter((g) => have.has(g.id));
}

export function pickedVehicle(bought: readonly string[], picked: string): GarageVehicle | null {
  const owned = ownedVehicles(bought);
  return owned.find((g) => g.id === picked) ?? owned.reduce<GarageVehicle | null>((best, g) => (!best || g.cost > best.cost ? g : best), null);
}
