// Written by scripts/portraits.mjs (npm run portraits): the residents' drawn portraits in public/portraits
// (docs/portrait-prompts.md), by place id, each with a hash of its file (a new picture is fetched again).
// Not edited by hand.

export const PORTRAIT_FILES: Readonly<Record<string, { neutral?: string; happy?: string; sad?: string }>> = {};
