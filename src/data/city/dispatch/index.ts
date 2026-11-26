// Rico's dispatch office (core/town/dispatch.ts; docs/town.md §27): the calls, the places, the radio lines, and the
// calls by review ref (a call whose places were heard wrong becomes a review card `talk:disp-<call id>`:
// features/review/resolve.ts). Kept light (Ôn tập's catalog imports it): the map's Vietnamese names are ./names.ts.

import { dispatchRef, type DispatchCall } from '../../../core/town/dispatch';
import type { SpeakVoice } from '../../../core/tts';
import { DISPATCH_CALLS } from './calls';

export { DISPATCH_CALLS } from './calls';
export { DISPATCH_PLACES, DISPATCH_ALIKES, OFFICE_AT, alikesOf, dispatchPlace, type DispatchPlace } from './places';
export * from './lines';

/** The title Ôn tập shows a dispatch call under, and who is speaking. */
export const DISPATCH_TITLE = 'Văn phòng điều xe';
export const DISPATCH_CALLER = 'Khách gọi máy số hai';

const BY_ID = new Map(DISPATCH_CALLS.map((c) => [c.id, c]));
export const dispatchCall = (id: string): DispatchCall | undefined => BY_ID.get(id);

/**
 * The caller's browser voice: a name of the call's own (`scene-call-<id>`: no Gemini voice's name, so no clip is ever
 * looked up or made under it) and their sex, so one caller keeps one voice, in the office and in Ôn tập alike.
 */
export const dispatchVoice = (call: Pick<DispatchCall, 'id' | 'gender'>): SpeakVoice => ({ voice: `scene-call-${call.id}`, gender: call.gender });

/** A call by review ref (`disp-dc-12`). */
export function dispatchCallByRef(ref: string): DispatchCall | undefined {
  return ref.startsWith('disp-') ? BY_ID.get(ref.slice(5)) : undefined;
}

/** Every review ref a call can have (the review layer keeps a card only while its ref is known). */
export function allDispatchRefs(): string[] {
  return DISPATCH_CALLS.map((c) => dispatchRef(c.id));
}
