import type { ReactNode } from "react";

export function Decisions({ children }: { children: ReactNode }) {
  return <div className="not-prose my-6 grid gap-4 md:grid-cols-3">{children}</div>;
}

/** One key decision: what was chosen, why it fits, and what it costs. */
export function Decision({ title, why, tradeoff }: { title: string; why: string; tradeoff: string }) {
  return (
    <article className="flex flex-col rounded-card border border-border bg-surface p-5">
      <h3 className="text-base font-semibold text-text">{title}</h3>
      <dl className="mt-4 space-y-4 text-sm">
        <div>
          <dt className="font-mono text-[11px] tracking-[0.12em] text-accent uppercase">Why</dt>
          <dd className="mt-1 text-muted">{why}</dd>
        </div>
        <div>
          <dt className="font-mono text-[11px] tracking-[0.12em] text-muted uppercase">Trade-off</dt>
          <dd className="mt-1 text-muted">{tradeoff}</dd>
        </div>
      </dl>
    </article>
  );
}
