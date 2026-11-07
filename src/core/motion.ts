// Shared motion preference. Use for scrollIntoView / scrollTo so learners who asked the OS
// for reduced motion do not get smooth scrolling.

/** True when the user prefers reduced motion. Safe where matchMedia is missing (tests, old browsers). */
export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** 'auto' under reduced motion, otherwise 'smooth'. */
export function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? 'auto' : 'smooth';
}
