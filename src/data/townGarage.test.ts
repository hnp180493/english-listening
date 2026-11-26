import { describe, expect, it } from 'vitest';
import { buy, canBuy, owns, townItem } from '../core/town/economy';
import { emptyTownProgress, parseTownProgress } from '../core/town/progress';
import { TOWN_DECORATIONS, TOWN_PLACES } from './town';
import { GARAGE, garageVehicle } from './townGarage';
import { ownedVehicles, pickedVehicle } from '../features/town/garagePick';
import { RIDES } from '../features/town/three/scene/vehicles3d';

const rich = (xu: number, bought: string[] = []) => ({ ...emptyTownProgress(), earned: { 'd-aaaa0001': xu }, bought });

describe('the garage', () => {
  it('ids are item ids, never shared with a place or a decoration', () => {
    const others = new Set([...TOWN_PLACES.map((p) => p.id), ...TOWN_DECORATIONS.map((d) => d.id)]);
    expect(new Set(GARAGE.map((g) => g.id)).size).toBe(GARAGE.length);
    for (const g of GARAGE) {
      expect(g.id).toMatch(/^garage-[a-z0-9-]{1,32}$/);
      expect(others.has(g.id)).toBe(false);
    }
  });

  it('the dearer, the faster; even the cheapest beats the borrowed ones of its kind', () => {
    for (let i = 1; i < GARAGE.length; i++) {
      expect(GARAGE[i].cost).toBeGreaterThan(GARAGE[i - 1].cost);
      expect(GARAGE[i].speed).toBeGreaterThan(GARAGE[i - 1].speed);
    }
    for (const g of GARAGE) expect(g.speed).toBeGreaterThanOrEqual(RIDES[g.kind].speed);
  });

  it('bought with xu like a decoration, kept through a reload, once', () => {
    expect(townItem('garage-vespa')).toEqual({ id: 'garage-vespa', kind: 'vehicle', name: 'Vespa cổ', cost: 150 });
    expect(canBuy(rich(149), 'garage-vespa')).toMatchObject({ ok: false, reason: 'poor', missing: 1 });
    const r = buy(rich(200), 'garage-vespa');
    expect(r).toMatchObject({ ok: true, balance: 50 });
    expect(owns(r.progress, 'garage-vespa')).toBe(true);
    expect(canBuy(r.progress, 'garage-vespa')).toMatchObject({ ok: false, reason: 'owned' });
    const again = parseTownProgress(JSON.parse(JSON.stringify(r.progress)));
    expect(owns(again, 'garage-vespa')).toBe(true);
  });

  it('the one called: the pick if owned, else the dearest owned, else none', () => {
    expect(pickedVehicle([], '')).toBeNull();
    expect(pickedVehicle(['garage-roadbike', 'garage-motorbike', 'park'], '')?.id).toBe('garage-motorbike');
    expect(pickedVehicle(['garage-roadbike', 'garage-motorbike'], 'garage-roadbike')?.id).toBe('garage-roadbike');
    expect(pickedVehicle(['garage-roadbike'], 'garage-supercar')?.id).toBe('garage-roadbike');
    expect(ownedVehicles(['park', 'garage-vespa']).map((g) => g.id)).toEqual(['garage-vespa']);
    expect(garageVehicle('park')).toBeUndefined();
  });
});
