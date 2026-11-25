// Westbay's work shifts ("Ca làm việc", core/town/shiftTypes.ts): one engine, one panel, a shift is data.

import type { ShiftDef } from '../../../core/town/shiftTypes';
import { DESK_SHIFT } from './desk';
import { FLOWERS_SHIFT } from './flowers';
import { KITCHEN_SHIFT } from './kitchen';
import { PHARMACY_SHIFT } from './pharmacy';
import { TAXI_SHIFT } from './taxi';

export const CITY_SHIFTS: readonly ShiftDef[] = [TAXI_SHIFT, FLOWERS_SHIFT, DESK_SHIFT, KITCHEN_SHIFT, PHARMACY_SHIFT];

export function cityShift(id: string): ShiftDef | undefined {
  return CITY_SHIFTS.find((s) => s.id === id);
}
