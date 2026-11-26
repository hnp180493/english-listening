// A dispatch place's names (./places.ts): how it is said in English, and its Vietnamese name on Westbay's map.
import { cityPlace } from '../../cityWorld';
import { dispatchPlace } from './places';

export const placeEn = (id: string): string => dispatchPlace(id)?.en ?? id;
export const placeVi = (id: string): string => cityPlace(id)?.name ?? id;
