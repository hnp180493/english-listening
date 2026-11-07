// The courses of "Bài học", in display order. Lessons say which course they belong to (Lesson.course); the
// lesson catalogue of all courses is LESSONS in src/data/lessons.ts. Authoring guide: docs/courses.md.
import { isCourseId, type CourseId, type CourseMeta, type LessonMeta } from '../../core/lessons';

export type { CourseId, CourseMeta };

/** Same order as COURSE_IDS in core/lessons.ts (checked by src/features/lessons/courses.test.ts). */
export const COURSES: readonly CourseMeta[] = [
  {
    id: 'connected',
    order: 1,
    title: 'Nghe nối âm',
    summary: 'Vì sao câu nói nhanh nghe khác hẳn chữ viết: 8 hiện tượng.',
  },
  {
    id: 'spelling',
    order: 2,
    title: 'Chữ viết → âm đọc',
    summary: 'Các mẫu chữ hay gặp và cách đọc: gh, sh, ch, th, -tion.',
  },
  {
    id: 'irregular',
    order: 3,
    title: 'Từ bất quy tắc',
    summary: 'Nhìn vậy mà không đọc vậy, và câu chuyện vì sao.',
  },
  {
    id: 'loanwords',
    order: 4,
    title: 'Từ mượn, tên riêng, Anh – Mỹ',
    summary: 'Từ gốc Pháp, Hy Lạp, tên riêng và chỗ Anh – Mỹ đọc khác nhau.',
  },
];

/** Course by id; undefined for unknown ids. */
export function getCourse(id: string | undefined | null): CourseMeta | undefined {
  return isCourseId(id) ? COURSES.find((c) => c.id === id) : undefined;
}

/** "Nghe nối âm" etc.; the id itself for unknown ids. */
export function courseTitle(id: string): string {
  return getCourse(id)?.title ?? id;
}

/** "Bài 3: Nối âm"; outside course "connected" the course comes first: "Từ bất quy tắc · Bài 2: …". */
export function lessonLabel(l: Pick<LessonMeta, 'course' | 'order' | 'title'>): string {
  const base = `Bài ${l.order}: ${l.title}`;
  return l.course && l.course !== 'connected' ? `${courseTitle(l.course)} · ${base}` : base;
}
