export type Dictionary = Readonly<Record<string, string>>;

/** One bundle from its area files. The same source in two areas must have the same English (coverage.test.ts). */
export function mergeDictionaries(areas: Readonly<Record<string, Dictionary>>): Dictionary {
  const out: Record<string, string> = {};
  for (const name in areas) Object.assign(out, areas[name]);
  return out;
}
