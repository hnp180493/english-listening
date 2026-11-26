// What else is said in Rico's dispatch office (core/town/dispatch.ts; docs/town.md §27), besides the callers' calls
// (./calls.ts): the drivers on the radio, a caller ringing back, Bayline getting there first, Bay FM the next bulletin.
// `{place}` is where the car is (or the caller was), `{right}` the place that was meant, both filled with a place's
// spoken name (./places.ts `en`, never at the start of a sentence). The drivers are Westbay's (docs/city.md §14): Rico
// talks, Tess is dry, Theo hardly says a word. Everybody here speaks in the browser's voice: no clips.

import type { DriverId } from '../../../core/town/dispatch';

export interface DispatchLine {
  text: string;
  vi: string;
}

export type RadioKind = 'board' | 'nobody' | 'drop' | 'wrongDrop';

export const DRIVER_LINES: Readonly<Record<DriverId, Readonly<Record<RadioKind, readonly DispatchLine[]>>>> = {
  rico: {
    board: [
      { text: "Got them, partner. Lovely evening for it. We're on our way.", vi: 'Đón được khách rồi, cộng sự. Buổi tối đẹp ghê. Đang chạy đây.' },
      { text: 'Passenger in the back, seat belt on. Off we go.', vi: 'Khách ngồi sau rồi, cài dây an toàn rồi. Đi thôi.' },
    ],
    nobody: [
      { text: "I'm at {place}, partner. Nobody here. Not a soul.", vi: 'Tôi tới {place} rồi, cộng sự. Không có ai. Không một bóng người.' },
      { text: "Outside {place} now, and there's nobody waiting. You sure?", vi: 'Đang ở trước {place} đây, mà chẳng có ai đợi. Chắc không đó?' },
    ],
    drop: [
      { text: 'Dropped off at {place}. Happy customer, I think.', vi: 'Thả khách ở {place} rồi. Chắc là khách vui.' },
      { text: 'All done at {place}. They even laughed at my joke.', vi: 'Xong ở {place} rồi. Khách còn cười chuyện đùa của tôi nữa.' },
    ],
    wrongDrop: [{ text: "We're at {place}, but they wanted {right}. Taking them there now.", vi: 'Tới {place} rồi, mà khách muốn đi {right} cơ. Tôi chở qua đó luôn đây.' }],
  },
  tess: {
    board: [
      { text: 'Passenger on board.', vi: 'Khách lên xe rồi.' },
      { text: "Got them. Don't wait up.", vi: 'Đón rồi. Đừng đợi.' },
    ],
    nobody: [
      { text: 'At {place}. Nobody here. Try again.', vi: 'Ở {place} rồi. Không có ai. Thử lại đi.' },
      { text: "Nobody at {place}. I'll wait for the next one.", vi: 'Ở {place} không có ai. Tôi đợi cuốc sau.' },
    ],
    drop: [
      { text: 'Done. Dropped at {place}.', vi: 'Xong. Thả ở {place} rồi.' },
      { text: "That's {place} done. Next.", vi: 'Xong cuốc {place}. Cuốc tiếp.' },
    ],
    wrongDrop: [{ text: 'Wrong address. They wanted {right}. On my way.', vi: 'Sai địa chỉ. Khách muốn đi {right}. Tôi chạy qua đây.' }],
  },
  theo: {
    board: [
      { text: 'Got them.', vi: 'Đón rồi.' },
      { text: 'On board. Going.', vi: 'Lên xe rồi. Đi đây.' },
    ],
    nobody: [
      { text: 'Nobody at {place}.', vi: 'Ở {place} không có ai.' },
      { text: 'At {place}. Empty.', vi: 'Ở {place}. Không ai cả.' },
    ],
    drop: [
      { text: 'Dropped at {place}.', vi: 'Thả ở {place} rồi.' },
      { text: 'Done. Coming back.', vi: 'Xong. Quay về đây.' },
    ],
    wrongDrop: [{ text: 'They wanted {right}. Going there now.', vi: 'Khách muốn đi {right}. Đang qua đó.' }],
  },
  // Jas drives the fourth car once the office has bought it (core/town/office.ts; docs/city.md §15): new, keen, polite
  jas: {
    board: [
      { text: 'Hi, Jas here. Passenger on board, all good.', vi: 'Chào, Jas đây. Khách lên xe rồi, ổn cả.' },
      { text: "Picked up. They're lovely, by the way.", vi: 'Đón rồi. Khách dễ thương lắm nhé.' },
    ],
    nobody: [
      { text: "Sorry, I'm at {place} and there's nobody here.", vi: 'Xin lỗi, tôi đang ở {place} mà không có ai cả.' },
      { text: 'Nobody outside {place}. Did I get it wrong?', vi: 'Trước {place} không có ai. Tôi nhầm à?' },
    ],
    drop: [
      { text: 'Dropped them at {place}. Ready for the next one.', vi: 'Thả khách ở {place} rồi. Sẵn sàng cuốc tiếp.' },
      { text: 'All done at {place}. They gave me a tip.', vi: 'Xong ở {place} rồi. Khách còn cho tiền boa.' },
    ],
    wrongDrop: [{ text: "Oh, we're at {place}, but they wanted {right}. Going now.", vi: 'Ơ, tới {place} rồi, mà khách muốn đi {right}. Đi ngay đây.' }],
  },
};

/** The caller rings back after the driver found nobody: annoyed, and saying again the one thing that went wrong. */
export const CALLBACK_LINES: readonly DispatchLine[] = [
  { text: "Hello? It's me again. Your driver went to {place}. I'm at {right}.", vi: 'A lô? Lại là tôi đây. Tài xế của anh tới {place}. Tôi đang ở {right} cơ.' },
  { text: "Hi, me again. Nobody came. I said {right}, not {place}.", vi: 'Chào, lại là tôi. Chẳng ai tới. Tôi nói {right} mà, không phải {place}.' },
  { text: "I'm still waiting at {right}. Somebody went to {place} instead.", vi: 'Tôi vẫn đang đợi ở {right}. Có người lại tới {place}.' },
];

/** After the third "Xin nhắc lại": the caller says it again, but not happily. */
export const CROSS_LINES: readonly DispatchLine[] = [
  { text: "Look, I've said it three times now.", vi: 'Nghe này, tôi nói tới ba lần rồi đấy.' },
  { text: 'Are you writing this down?', vi: 'Anh có ghi lại không vậy?' },
];

/** Rico on the radio, when Bayline got to a caller first (`{place}`: where the caller was). */
export const STOLEN_LINES: readonly DispatchLine[] = [
  { text: 'Bayline just picked up our caller at {place}. They heard it first.', vi: 'Bayline vừa đón mất khách của mình ở {place}. Họ nghe thấy trước.' },
  { text: 'A Bayline car got to {place} before us. They listen to everything.', vi: 'Một xe Bayline tới {place} trước mình. Cái gì họ cũng nghe.' },
];

/** Rico, as the shift starts. */
export const OPEN_LINES: readonly DispatchLine[] = [
  { text: "Phone two's yours, partner. The cars are on the map. Off you go.", vi: 'Máy số hai là của bạn đấy, cộng sự. Xe ở trên bản đồ. Bắt đầu đi.' },
  { text: "Evening, partner. Tess and Theo are out. Phone two's all yours.", vi: 'Chào buổi tối, cộng sự. Tess với Theo đang chạy ngoài kia. Máy số hai là của bạn.' },
];

/** Marcus on Bay FM's next bulletin (core/town/radioNews.ts), after a shift that went well or badly. */
export const NEWS_LINES: Readonly<Record<'good' | 'bad', readonly DispatchLine[]>> = {
  good: [
    { text: "Word from the harbour: Rico's new office at the old gatehouse had a busy night.", vi: 'Tin từ bến cảng: văn phòng mới của Rico ở trạm gác cũ có một đêm bận rộn.' },
    { text: 'Not one fare went to the wrong door. Somebody on phone two is listening.', vi: 'Không cuốc nào tới nhầm cửa. Có người ở máy số hai biết lắng nghe đấy.' },
  ],
  bad: [
    { text: 'A rough night down at the harbour gate for Rico and his drivers.', vi: 'Một đêm vất vả ở cổng cảng cho Rico và các tài xế của anh.' },
    { text: 'And a Bayline car got there first again. Funny how that keeps happening.', vi: 'Và một xe Bayline lại tới trước. Lạ thật, chuyện đó cứ lặp lại mãi.' },
  ],
};

/** Fill a template's `{place}` / `{right}` (English and Vietnamese with their own names). */
export function fillDispatchLine(line: DispatchLine, en: { place?: string; right?: string }, vi: { place?: string; right?: string }): DispatchLine {
  const fill = (s: string, w: { place?: string; right?: string }) => s.replaceAll('{place}', w.place ?? '').replaceAll('{right}', w.right ?? '');
  return { text: fill(line.text, en), vi: fill(line.vi, vi) };
}
