import type { PresenceView } from "@/lib/live/types";
import { cn } from "@/lib/utils/cn";

/**
 * "● Online — replies in minutes" / "◐ Away — GRID will take a message". The state is in the words, not only the dot.
 * Away also shows the time in Bengaluru, so a visitor knows why.
 */
export function PresenceChip({ presence, className }: { presence: PresenceView; className?: string }) {
  const online = presence.state === "online";
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-mono text-[11px] text-muted", className)}>
      <span
        aria-hidden="true"
        className={cn("size-2 shrink-0 rounded-pill", online ? "bg-accent" : "border border-muted")}
      />
      <span>
        {presence.label}
        {online ? null : <span className="text-muted"> · Bengaluru {presence.time}</span>}
      </span>
    </span>
  );
}
