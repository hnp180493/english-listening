// Pair set id → item ids, a light copy of src/data/pairs.ts (PAIR_SETS) for code that must not pull the
// 34 kB pairs data into the main bundle (review reconcile + catalog). pairIndex.test.ts asserts it
// matches PAIR_SETS exactly: update both together.

export const PAIR_SET_ITEMS: Readonly<Record<string, readonly string[]>> = {
  'can-cant': ['can-1', 'can-2', 'can-3', 'can-4', 'can-5', 'can-6', 'can-7', 'can-8'],
  'like-would-like': ['like-1', 'like-2', 'like-3', 'like-4', 'like-5', 'like-6', 'like-7'],
  'walk-walked': ['walk-1', 'walk-2', 'walk-3', 'walk-4', 'walk-5', 'walk-6', 'walk-7', 'walk-8'],
  'want-wanted': ['want-1', 'want-2', 'want-3', 'want-4', 'want-5', 'want-6', 'want-7', 'want-8'],
  'were-we-were': ['were-1', 'were-2', 'were-3', 'were-4', 'were-5', 'were-6', 'were-7'],
  'its-it-was': ['its-1', 'its-2', 'its-3', 'its-4', 'its-5', 'its-6', 'its-7', 'its-8'],
  'ill-i': ['ill-1', 'ill-2', 'ill-3', 'ill-4', 'ill-5', 'ill-6', 'ill-7', 'ill-8'],
  'hes-he-was': ['hes-1', 'hes-2', 'hes-3', 'hes-4', 'hes-5', 'hes-6', 'hes-7'],
  'him-them': ['him-1', 'him-2', 'him-3', 'him-4', 'him-5', 'him-6', 'him-7', 'him-8'],
  'should-shouldve': ['should-1', 'should-2', 'should-3', 'should-4', 'should-5', 'should-6', 'should-7', 'should-8'],
  'ive-i': ['ive-1', 'ive-2', 'ive-3', 'ive-4', 'ive-5', 'ive-6', 'ive-7'],
  'teen-ty': ['teen-1', 'teen-2', 'teen-3', 'teen-4', 'teen-5', 'teen-6', 'teen-7', 'teen-8'],
  'theres-there-was': ['theres-1', 'theres-2', 'theres-3', 'theres-4', 'theres-5', 'theres-6', 'theres-7'],
  'he-it': ['heit-1', 'heit-2', 'heit-3', 'heit-4', 'heit-5', 'heit-6', 'heit-7', 'heit-8'],
  'do-did-you': ['dyou-1', 'dyou-2', 'dyou-3', 'dyou-4', 'dyou-5', 'dyou-6', 'dyou-7'],
  'an-the': ['anthe-1', 'anthe-2', 'anthe-3', 'anthe-4', 'anthe-5', 'anthe-6', 'anthe-7'],
};
