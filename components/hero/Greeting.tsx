"use client";

import { useSyncExternalStore } from "react";
import { greetingFor } from "@/lib/hero/greeting";

const subscribe = (cb: () => void) => {
  const id = window.setInterval(cb, 60_000);
  return () => window.clearInterval(id);
};
const getHour = () => new Date().getHours();
const getServerHour = () => null;

/**
 * "Namaskara 👋 Good evening" — greeting follows the visitor's local time.
 * The server renders only the fixed part; the time-based part appears after mount
 * (fixed-height chip, nothing to its right → no layout shift, no hydration mismatch).
 */
export function Greeting() {
  const hour = useSyncExternalStore(subscribe, getHour, getServerHour);
  return (
    <p
      data-visual-mask
      className="inline-flex h-7 items-center gap-1.5 rounded-pill border border-border bg-surface px-3 font-mono text-xs text-muted"
    >
      <span>Namaskara</span>
      <span aria-hidden="true">👋</span>
      {hour === null ? null : <span className="animate-fade-in text-text">{greetingFor(hour)}</span>}
    </p>
  );
}
