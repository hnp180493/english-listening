// What a caller says on the learner's phone (core/town/phone.ts, features/town/phone): the voice message a missed job
// call leaves ("call me back before six", the game's clock), what the caller says when rung back in time, and when rung
// too late. Said by the job's caller in their own voice (the browser's for Westbay people). `{time}` is the deadline.
export const PHONE_LINES = {
  ringBack: { text: "Missed you. Call me back before {time}, yeah? After that, it's gone.", vi: 'Gọi mà không được. Gọi lại cho tôi trước {time} nhé? Quá giờ là thôi.' },
  there: { text: 'There you are. Right, listen to this.', vi: 'Đây rồi. Rồi, nghe này.' },
  tooLate: { text: "Too late now, that one's gone. Ring me again tomorrow.", vi: 'Muộn rồi, việc đó đi mất rồi. Mai gọi lại nhé.' },
} as const;
