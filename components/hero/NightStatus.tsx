"use client";

import { useMinute } from "@/lib/hooks/use-minute";
import { NIGHT_STATUS, isNight } from "@/lib/night";

/** The hero's availability line. Between midnight and 7 in the morning in Bengaluru it says GRID is on duty instead. */
export function NightStatus({ day }: { day: string }) {
  const now = useMinute();
  const night = now !== null && isNight(now);
  return (
    <span data-testid="status-line" data-night={night ? "true" : undefined} className="text-text">
      {night ? NIGHT_STATUS : day}
    </span>
  );
}
