// The words the job's panels share (Vietnamese; the elements translate them through the dictionary, docs/i18n.md).

import type { JobGrade } from '../../../core/town/job';

/** The grades (a game score, never a level). */
export const GRADE_NAME: Readonly<Record<JobGrade, string>> = { clean: 'Sạch', messy: 'Lộn xộn', broken: 'Hỏng' };

/** One line on what a grade means. */
export const GRADE_NOTE: Readonly<Record<JobGrade, string>> = {
  clean: 'Mọi việc trơn tru, không ai hay biết.',
  messy: 'Xong việc, nhưng có vài chỗ trục trặc.',
  broken: 'Nhiều chỗ hỏng. Truyện vẫn đi tiếp, chỉ là theo hướng khác.',
};
