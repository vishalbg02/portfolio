import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Grid-square loading placeholder. It reserves the height of what will replace it, so nothing jumps,
 * and tells assistive tech what is loading. Optional children are real, server-rendered content shown
 * while it loads (so the facts are in the HTML even before the island arrives). Flat colours only (styles/fx.css).
 */
export function Skeleton({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div role="status" aria-label={label} className={cn("skel rounded-card border border-border", className)}>
      <span className="sr-only">{label}</span>
      {children ? (
        <p className="relative z-10 m-3 inline-block bg-surface px-2 py-1 font-mono text-xs text-muted">
          {children}
        </p>
      ) : null}
    </div>
  );
}
