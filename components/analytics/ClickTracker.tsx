"use client";

import { useEffect } from "react";
import { track, type AnalyticsEvent } from "@/lib/analytics";

/**
 * One delegated click listener for every `data-track="event_name"` element, so server components
 * can emit analytics events without becoming client components.
 * Extra props: `data-track-project="talnio"` → { project: "talnio" } (no PII, ever).
 */
export function ClickTracker() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>("[data-track]");
      if (!el?.dataset.track) return;
      const props: Record<string, string> = {};
      for (const [key, value] of Object.entries(el.dataset)) {
        if (key.startsWith("track") && key !== "track" && value) {
          props[key.charAt(5).toLowerCase() + key.slice(6)] = value;
        }
      }
      track(el.dataset.track as AnalyticsEvent, Object.keys(props).length ? props : undefined);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
