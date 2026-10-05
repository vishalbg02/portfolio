"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const IntroEnhancer = dynamic(() => import("./IntroEnhancer"), { ssr: false });

/**
 * Tiny: when the opening sequence played on this load (html[data-intro] is not "skip"), fetch the part of it that
 * needs JavaScript: GRID's greeting, its analytics and its chime. The sequence itself never waits for this.
 */
export function IntroLoader() {
  const [played, setPlayed] = useState(false);
  useEffect(() => {
    const state = document.documentElement.dataset.intro;
    if (state && state !== "skip") setPlayed(true);
  }, []);
  return played ? <IntroEnhancer /> : null;
}
