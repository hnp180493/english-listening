// What Emma says when she hands over an order (docs/town.md §18): the one place the panel, the chip over the stage
// and the clip inventory's `addDeliveries` agree on.

import type { DeliveryOrder } from '../../../core/town/deliveryTypes';
import { CAST_VOICES } from '../../../core/town/voices';
import { speak } from '../../../core/tts';
import { dictationAudio } from '../../dictation/decodeCache';

/** Emma says who the order is for: her shipped clip, else the browser voice (never a paid request). */
export function sayDelivery(order: DeliveryOrder): Promise<void> {
  return speak(dictationAudio({ text: order.text, level: order.level }).connected, { mode: 'connected', voice: CAST_VOICES.cafe ?? null, browserOnly: true });
}
