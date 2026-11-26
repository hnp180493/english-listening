// The garage (owner, 2026-11-26: "phải có mua đứt luôn chứ, tiền càng nhiều thì đồ càng xịn"): vehicles to buy with
// xu and keep, each faster than the last and dearer. Bought ids go into the town's `bought` list like a decoration
// (core/town/progress: synced, never un-bought; core/town/economy: their cost is spent). One is the learner's pick: the
// "Gọi …" button brings it to them, in the town or in Westbay (features/town/garagePick.ts, RideButton).

import type { VehicleKind } from './townWorld';

export interface GarageVehicle {
  /** `garage-<name>`: an item id (lower case, digits, hyphens). Never change it. */
  id: string;
  kind: VehicleKind;
  /** Which of the kind's colours (three/scene/vehicles3d.ts; 3 = the garage's own finish). */
  v: number;
  /** Vietnamese. */
  name: string;
  /** One Vietnamese line. */
  blurb: string;
  cost: number;
  /** Tiles a second (the borrowed ones: bike 3.6 … car 5.6; walking 1.6). */
  speed: number;
}

export const GARAGE: readonly GarageVehicle[] = [
  { id: 'garage-roadbike', kind: 'bike', v: 3, name: 'Xe đạp đua', blurb: 'Khung đen nhẹ tênh, đạp là lướt.', cost: 60, speed: 4.4 },
  { id: 'garage-vespa', kind: 'scooter', v: 3, name: 'Vespa cổ', blurb: 'Màu kem, tiếng máy êm, đỗ đâu cũng đẹp.', cost: 150, speed: 5.2 },
  { id: 'garage-whitehorse', kind: 'horse', v: 3, name: 'Ngựa trắng', blurb: 'Chạy nước kiệu qua đồng, qua cả phố.', cost: 250, speed: 5.6 },
  { id: 'garage-motorbike', kind: 'motorbike', v: 0, name: 'Mô tô phân khối lớn', blurb: 'Bình xăng đỏ, ống pô sáng loáng.', cost: 400, speed: 6.6 },
  { id: 'garage-convertible', kind: 'car', v: 3, name: 'Mui trần đỏ', blurb: 'Xe mui trần của riêng bạn, không cần mượn ai.', cost: 600, speed: 6.8 },
  { id: 'garage-supercar', kind: 'sportscar', v: 0, name: 'Siêu xe', blurb: 'Thấp, rộng, nhanh nhất cả vùng.', cost: 1000, speed: 8.2 },
];

export function garageVehicle(id: string): GarageVehicle | undefined {
  return GARAGE.find((g) => g.id === id);
}
