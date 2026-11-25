// The things of the scenery that can be used (data/townWorld WORLD_THINGS, docs/town.md §19): what each is called
// over its head in the world, what the one button offers beside it, and what its panel is headed.
import { thingKind } from '../../../data/townWorld';
import { TOWN_EVENTS } from '../../../core/town/world';

/** Vietnamese; the callers put them through the interface language (tr). */
const NAMES = { bench: 'Ghế: ngồi nghe', radio: 'Radio Bay FM' } as const;
const PROMPTS = { bench: 'Ngồi xuống nghe', radio: 'Nghe radio' } as const;
const TITLES = { bench: 'Ngồi nghe', radio: 'Radio Bay FM' } as const;

/** The name over a thing in the world, or null when `id` is no thing. */
export function thingName(id: string): string | null {
  const k = thingKind(id);
  return k ? NAMES[k] : null;
}

/** What the button at the foot of the stage offers beside a thing. */
export function thingPrompt(id: string): string | null {
  const k = thingKind(id);
  return k ? PROMPTS[k] : null;
}

/** What the "listen" panel is about: a thing's id ('thing:bench-3', 'thing:radio') or a get-together ('event:games'). */
export function listenTitle(at: string | null | undefined): string {
  if (!at) return 'Nghe';
  if (at.startsWith('event:')) return TOWN_EVENTS.find((e) => e.id === at.slice(6))?.name ?? 'Buổi gặp mặt';
  const k = thingKind(at);
  return k ? TITLES[k] : 'Nghe';
}
