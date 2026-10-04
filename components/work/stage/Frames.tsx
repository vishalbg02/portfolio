import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Flat, code-drawn frames around the real captures (never baked into the images): browser chrome for
 * web products, a phone bezel for the app, a plain panel for the diagram. Each reserves the aspect ratio
 * of its content, so nothing shifts while images load.
 */
export function BrowserFrame({
  label,
  children,
  className,
  action,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  /** A control for the window bar (the full-screen button); real, focusable, not part of the decoration. */
  action?: ReactNode;
}) {
  return (
    <div
      data-frame="browser"
      className={cn("overflow-hidden rounded-card border border-border-2 bg-bg", className)}
    >
      <div className="flex items-center gap-3 border-b border-border px-3 py-1.5">
        <span aria-hidden="true" className="flex gap-1.5">
          <i className="size-2.5 rounded-pill border border-border-2" />
          <i className="size-2.5 rounded-pill border border-border-2" />
          <i className="size-2.5 rounded-pill border border-border-2" />
        </span>
        <span
          aria-hidden="true"
          className="min-w-0 flex-1 truncate rounded-pill border border-border bg-surface px-3 py-0.5 text-center font-mono text-[11px] text-muted"
        >
          {label}
        </span>
        {action}
      </div>
      <div className="relative aspect-[8/5] w-full bg-surface">{children}</div>
    </div>
  );
}

/** Aspect of the Talnio screens: 262 × 569. */
export function PhoneFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      data-frame="phone"
      className={cn(
        "mx-auto w-full max-w-[300px] rounded-[34px] border-2 border-border-2 bg-bg p-2.5",
        className,
      )}
    >
      <div className="relative aspect-[262/569] w-full overflow-hidden rounded-[24px] bg-surface">
        {children}
      </div>
    </div>
  );
}

export function DiagramFrame({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-frame="diagram"
      className={cn("overflow-hidden rounded-card border border-border-2 bg-bg", className)}
    >
      <div className="relative aspect-[8/5] w-full bg-surface">{children}</div>
      <p className="border-t border-border px-3 py-2 text-center font-mono text-[11px] text-muted">{label}</p>
    </div>
  );
}
