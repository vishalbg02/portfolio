"use client";

import { useSyncExternalStore } from "react";

/**
 * Current time rounded to the minute, or `null` during SSR and hydration.
 * Rendering `null` on the server avoids hydration mismatches for time-dependent UI.
 */
const MINUTE = 60_000;

function subscribe(onChange: () => void) {
  const id = window.setInterval(onChange, 5_000);
  return () => window.clearInterval(id);
}

const getSnapshot = () => Math.floor(Date.now() / MINUTE) * MINUTE;
const getServerSnapshot = () => null;

export function useMinute(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
