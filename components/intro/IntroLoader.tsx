"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";

const IntroEnhancer = dynamic(() => import("./IntroEnhancer"), { ssr: false });

/**
 * Tiny: when the opening sequence played on this load (html[data-intro] is not "skip"), fetch the part of it that
 * needs JavaScript: GRID's greeting, its analytics and its chime. The sequence itself never waits for this.
 */
const noop = () => () => {};
const playedNow = () => {
  const state = document.documentElement.dataset.intro;
  return Boolean(state && state !== "skip");
};

export function IntroLoader() {
  // read once in the browser (the server cannot know); false during hydration, so nothing mismatches
  const played = useSyncExternalStore(noop, playedNow, () => false);
  return played ? <IntroEnhancer /> : null;
}
