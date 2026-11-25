// Whoever speaks in a "cảnh nghe" or a scene of the city: a town resident (by place id), somebody of Westbay, or a
// voice that is only heard (the radio's presenter, a loudspeaker, a passenger).
import { cityPerson } from '../../../core/town/cityPeople';
import { SCENE_VOICES } from '../../../core/town/sceneTypes';
import { townPlace } from '../../../data/town';

export const speakerName = (who: string): string => townPlace(who)?.resident ?? cityPerson(who)?.name ?? SCENE_VOICES[who]?.name ?? '';

/** Somebody with a face (a portrait): a town resident or a person of the city. A voice only heard has none. */
export const speakerHasFace = (who: string): boolean => !!townPlace(who) || !!cityPerson(who);
