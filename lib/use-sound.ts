"use client";

import { useEffect, useSyncExternalStore } from "react";
import { initSound, soundOn, subscribeSound } from "./sound";

/** Whether sound is on. The server and first client render say off; the saved choice is read after mount. */
export function useSoundOn(): boolean {
  useEffect(() => {
    initSound();
  }, []);
  return useSyncExternalStore(subscribeSound, soundOn, () => false);
}
