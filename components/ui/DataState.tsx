import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type DataStateKind = "empty" | "error" | "offline" | "loading";

/** Each state's square glyph (3 × 3): what is lit says which state it is, without colour alone. */
const GLYPH: Record<DataStateKind, number[]> = {
  empty: [],
  error: [0, 4, 8, 2, 6],
  offline: [0, 1, 2],
  loading: [3, 4],
};
const LIT: Record<DataStateKind, string> = {
  empty: "var(--grid-1)",
  error: "var(--danger)",
  offline: "var(--muted)",
  loading: "var(--accent)",
};

/**
 * The designed non-happy states of a data block (docs/DESIGN-V4.md §10): empty, error, offline and loading, so no
 * block is ever a blank box. A 3 × 3 square glyph, a short line and an optional action. `inline` is the one-line form
 * for a status row; the block form fills its container like the data would. Server-safe, no JS of its own.
 */
export function DataState({
  kind,
  title,
  children,
  action,
  inline = false,
  className,
}: {
  kind: DataStateKind;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  inline?: boolean;
  className?: string;
}) {
  const glyph = (
    <svg
      viewBox="0 0 14 14"
      width={inline ? 10 : 14}
      height={inline ? 10 : 14}
      aria-hidden="true"
      className="shrink-0"
    >
      {Array.from({ length: 9 }, (_, i) => (
        <rect
          key={i}
          x={(i % 3) * 5}
          y={Math.floor(i / 3) * 5}
          width="4"
          height="4"
          rx="1"
          fill={GLYPH[kind].includes(i) ? LIT[kind] : "var(--grid-0)"}
        />
      ))}
    </svg>
  );
  if (inline)
    return (
      <span data-state-kind={kind} className={cn("inline-flex items-center gap-2", className)}>
        {glyph}
        {title}
        {action}
      </span>
    );
  return (
    <div
      data-state-kind={kind}
      className={cn(
        "flex flex-col items-start gap-2 rounded-card border border-dashed border-border-2 bg-surface p-4 sm:p-5",
        className,
      )}
    >
      <p className="flex items-center gap-2.5 font-mono text-xs tracking-[0.08em] text-text uppercase">
        {glyph}
        {title}
      </p>
      {children ? <div className="text-sm text-muted">{children}</div> : null}
      {action}
    </div>
  );
}
