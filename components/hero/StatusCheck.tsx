"use client";

import { cn } from "@/lib/utils/cn";
import { useStatuses } from "@/lib/status/store";

/**
 * The ✓ at the start of a terminal row: it appears when that product's real status ping resolves
 * (… while checking, ! if degraded, ✗ if offline). Rows without a live URL have nothing to ping.
 */
export function StatusCheck({ slug, pinged }: { slug: string; pinged: boolean }) {
  const { phase, statuses } = useStatuses();
  const state = pinged ? statuses[slug]?.state : "live";
  const done = !pinged || Boolean(state) || phase === "error";
  const glyph = !done ? "…" : state === "degraded" ? "!" : state === "offline" ? "✗" : "✓";
  const tone = !done
    ? "text-muted"
    : state === "degraded"
      ? "text-warning"
      : state === "offline"
        ? "text-danger"
        : "text-accent";
  return (
    <span
      aria-hidden="true"
      className={cn("mt-0.5 w-3 shrink-0 text-center transition-colors", tone, !done && "animate-pulse")}
    >
      {glyph}
    </span>
  );
}
