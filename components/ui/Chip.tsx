import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-pill border border-border px-2.5 font-mono text-xs text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Small pulsing status dot. The pulse is disabled under prefers-reduced-motion (globals.css). */
export function StatusDot({ pulse = true, className }: { pulse?: boolean; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-2 shrink-0 rounded-pill bg-accent",
        pulse && "animate-pulse-dot",
        className,
      )}
    />
  );
}
