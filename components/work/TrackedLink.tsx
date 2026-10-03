"use client";

import type { ComponentProps } from "react";
import { track, type AnalyticsEvent } from "@/lib/analytics";

/** External link that fires a privacy-friendly analytics event on click (no PII). */
export function TrackedLink({
  event,
  props,
  ...rest
}: ComponentProps<"a"> & { event: AnalyticsEvent; props?: Record<string, string | number | boolean> }) {
  return <a {...rest} onClick={() => track(event, props)} />;
}
