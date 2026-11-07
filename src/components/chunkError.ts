/**
 * True for a failed dynamic import of a page chunk (offline before the page was ever cached, or an
 * old tab asking for a file a newer deploy removed). Browsers word it differently; Vite's preload
 * helper throws "Unable to preload CSS for …" when a page's stylesheet fails.
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'ChunkLoadError') return true;
  return /dynamically imported module|importing a module script failed|error loading dynamically imported|failed to load module script|loading (css )?chunk|unable to preload css/i.test(
    error.message,
  );
}
