// The words the job's panels share (Vietnamese; the elements translate them through the dictionary, docs/i18n.md).

import type { JobGrade, JobProblem } from '../../../core/town/job';

/** The grades (a game score, never a level). */
export const GRADE_NAME: Readonly<Record<JobGrade, string>> = { clean: 'Sạch', messy: 'Lộn xộn', broken: 'Hỏng' };

/** One line on what a grade means. */
export const GRADE_NOTE: Readonly<Record<JobGrade, string>> = {
  clean: 'Mọi việc trơn tru, không ai hay biết.',
  messy: 'Xong việc, nhưng có vài chỗ trục trặc.',
  broken: 'Nhiều chỗ hỏng. Truyện vẫn đi tiếp, chỉ là theo hướng khác.',
};

/** What went wrong, as the debrief says it. */
export const PROBLEM_NAME: Readonly<Record<JobProblem, string>> = {
  wrongPlace: 'Ghi nhầm chỗ đón: không ai đợi ở đó, Rico phải gọi chỉ lại',
  late: 'Ghi nhầm giờ (hoặc tới muộn): ông khách phải đứng chờ',
  spotted: 'Ghi nhầm đường cần tránh: xe Bayline bám theo',
  wrongPerson: 'Hỏi nhầm người',
  lost: 'Chọn sai đường ở ngã rẽ',
  nagged: 'Bắt ông khách nhắc lại nhiều quá, ông ấy bực',
  noticed: 'Gus và Odile thấy bạn nghe lén',
  password: 'Không nói được mật khẩu, Gus giữ lại cuộn băng',
};
