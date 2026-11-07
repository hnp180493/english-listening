import { useRoute } from '../../core/nav';
import { getCourse } from '../../data/courses';
import { getLesson, lessonsOf } from '../../data/lessons';
import CourseList, { type Missing } from './CourseList';
import CourseOverview from './CourseOverview';
import LessonView from './LessonView';
import './lessons.css';

/**
 * "Bài học": ?id=<lessonId> → one lesson (old links keep working: ids never change); ?course=<courseId> → that
 * course's lesson list; otherwise the course list. Unknown ids fall back one level with a short notice.
 */
export default function LessonsPage() {
  const { params } = useRoute();
  const id = (params.id ?? '').trim();
  const courseId = (params.course ?? '').trim();
  const lesson = id ? getLesson(id) : undefined;

  // key: switching lessons (e.g. "Bài tiếp theo") remounts the view, so step/quiz state starts fresh.
  if (lesson) return <LessonView key={lesson.id} lesson={lesson} />;

  const course = getCourse(courseId);
  const hasLessons = !!course && lessonsOf(course.id).length > 0;
  const missing: Missing | undefined = id
    ? { kind: 'lesson', id }
    : courseId && !hasLessons
      ? { kind: 'course', id: courseId }
      : undefined;
  if (course && hasLessons) return <CourseOverview key={course.id} course={course} missing={missing} />;
  return <CourseList missing={missing} />;
}
