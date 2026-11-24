// The cases of "Vụ án ở thị trấn" (docs/town.md §17), in the order they are told. Contract: core/town/caseTypes.ts.

import type { TownCase } from '../../core/town/caseTypes';
import { CASE as case1 } from './case1';
import { CASE as case2 } from './case2';
import { CASE as case3 } from './case3';

export const TOWN_CASES: readonly TownCase[] = [case1, case2, case3];
