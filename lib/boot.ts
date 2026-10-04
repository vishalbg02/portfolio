const KEY = "boot-seen";

/**
 * The nav's one-off "booting vishalbg… ok" line shows on the first visit of a session only, never under
 * reduced motion. Reading and writing sessionStorage can throw (private windows, blocked storage); then
 * it just doesn't show. Marks the session as seen as a side effect, so it can only ever fire once.
 */
export function shouldBoot(
  storage: Pick<Storage, "getItem" | "setItem"> | null,
  reducedMotion: boolean,
): boolean {
  if (reducedMotion || !storage) return false;
  try {
    if (storage.getItem(KEY)) return false;
    storage.setItem(KEY, "1");
    return true;
  } catch {
    return false;
  }
}
export const BOOT_MS = 500;
