"use client";

import { useSyncExternalStore } from "react";
import { ACHIEVEMENTS, parse, snapshot, subscribe, type AchievementId } from "./achievements";

/** Which achievements this browser has found. Server and first client render agree (none), then it fills in. */
export function useAchievements(): { found: AchievementId[]; count: number; total: number } {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "");
  const found = parse(raw);
  return { found, count: found.length, total: ACHIEVEMENTS.length };
}
