"use client";

import { cn } from "@/lib/utils/cn";
import { useStatuses } from "@/lib/status/store";
import type { StatusState } from "@/lib/status/types";

const pill =
  "inline-flex h-6 items-center gap-1.5 rounded-pill border border-border px-2.5 font-mono text-xs";

function Dot({ state }: { state: StatusState | "none" }) {
  if (state === "offline") {
    return (
      <span aria-hidden="true" className="inline-block size-2 shrink-0 rounded-pill border border-muted" />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-2 shrink-0 rounded-pill",
        state === "degraded" ? "bg-warning" : "bg-accent",
      )}
    />
  );
}

/** Static chip for projects with nothing to probe (e.g. Play Store, hackathon result). */
export function StaticBadge({ label, className }: { label: string; className?: string }) {
  return <span className={cn(pill, "text-muted", className)}>{label}</span>;
}

/**
 * Live status from /api/status (client fetch, shared store, never blocks render).
 * Skeleton while loading; Live · 142 ms / Degraded / Offline once known.
 */
export function StatusBadge({
  slug,
  bare = false,
  className,
}: {
  slug: string;
  bare?: boolean;
  className?: string;
}) {
  const { phase, statuses } = useStatuses();
  const status = statuses[slug];
  const base = cn(bare ? "inline-flex items-center gap-1.5 font-mono text-xs" : pill, className);

  if (phase === "error") return <span className={cn(base, "text-muted")}>Status unavailable</span>;
  if (!status || !status.state) {
    return (
      // No invisible text: it fails contrast checks. The label is for screen readers only.
      <span
        role="status"
        className={cn(base, "animate-pulse", bare ? "w-20 rounded-sm bg-surface-2" : "w-24 bg-surface-2")}
      >
        <span className="sr-only">Checking status</span>
      </span>
    );
  }

  const text =
    status.state === "live"
      ? `Live${status.latencyMs !== null ? ` · ${status.latencyMs} ms` : ""}`
      : status.state === "degraded"
        ? "Degraded"
        : "Offline";

  return (
    <span
      className={cn(
        base,
        status.state === "live" ? "text-text" : status.state === "degraded" ? "text-warning" : "text-muted",
      )}
    >
      <Dot state={status.state} />
      {text}
    </span>
  );
}
