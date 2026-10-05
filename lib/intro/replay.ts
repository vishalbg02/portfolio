import { REPLAY_KEY } from "./script";

/**
 * "Replay intro" (palette, terminal `intro`): the opening sequence is decided before the first paint, so it replays
 * on a fresh load of the home page, marked as a replay (it never counts as a first play in analytics). Under reduced
 * motion it does not play at all; returns false so the caller can say so.
 */
export function replayIntro(): boolean {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  try {
    sessionStorage.setItem(REPLAY_KEY, "1");
  } catch {
    return false; // without storage the next load cannot know it was asked for
  }
  window.location.assign("/");
  return true;
}
