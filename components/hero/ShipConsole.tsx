import Link from "next/link";
import { profile } from "@/content/profile";
import { shipped } from "@/lib/site";
import { identityBg } from "@/components/work/identity";
import { StaticBadge, StatusBadge } from "@/components/work/StatusBadge";

/**
 * Hero visual: a terminal-style "ship console" listing the four products with live status.
 * Server-rendered rows (readable without JS); only the status badges are client islands.
 * It answers the recruiter's question — "are his products actually live?" — above the fold.
 */
export function ShipConsole() {
  return (
    <div className="w-full max-w-[520px] rounded-card border border-border bg-bg font-mono text-sm lg:ml-auto">
      <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <span aria-hidden="true" className="flex gap-1.5">
          <span className="size-2.5 rounded-pill border border-border-2" />
          <span className="size-2.5 rounded-pill border border-border-2" />
          <span className="size-2.5 rounded-pill border border-border-2" />
        </span>
        <span className="text-xs text-muted">~/vishalbg — ship</span>
      </div>

      <div className="px-4 py-4">
        <p className="text-text">
          <span className="text-accent">$</span> ship --all
        </p>

        <ul className="mt-3 divide-y divide-border">
          {profile.projects.map((p, i) => {
            const body = (
              <>
                <span aria-hidden="true" className="mt-0.5 text-accent">
                  ✓
                </span>
                {/* Narrow: status sits under the name. Wider: side by side (stacks again in the tighter lg column). */}
                <span className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3 lg:flex-col xl:flex-row">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-text">
                      <span
                        aria-hidden="true"
                        className={`size-2 shrink-0 rounded-pill ${identityBg[p.slug]}`}
                      />
                      <span className="truncate">{p.name}</span>
                    </span>
                    <span className="mt-0.5 block truncate pl-4 text-xs text-muted">{p.tagline}</span>
                  </span>
                  <span className="shrink-0 pl-4 sm:pt-px sm:pl-0 lg:pl-4 xl:pl-0">
                    {p.live ? (
                      <StatusBadge slug={p.slug} bare />
                    ) : p.badge ? (
                      <StaticBadge label={p.badge} className="border-0 px-0" />
                    ) : null}
                  </span>
                </span>
              </>
            );
            return (
              <li key={p.slug} className="animate-fade-in" style={{ animationDelay: `${150 + i * 140}ms` }}>
                {shipped.caseStudies ? (
                  <Link
                    href={`/work/${p.slug}`}
                    className="-mx-2 flex items-start gap-3 rounded-sm px-2 py-2.5 transition-colors hover:bg-surface"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="flex items-start gap-3 py-2.5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>

        <p className="mt-3 text-text">
          <span className="text-accent">$</span>{" "}
          <span aria-hidden="true" className="inline-block h-4 w-2 translate-y-0.5 animate-blink bg-accent" />
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-2.5 text-xs text-muted">
        <span className="truncate">{profile.motto}</span>
        <span aria-hidden="true" className="hidden shrink-0 items-center gap-1 sm:flex">
          <span className="mr-1">less</span>
          {["bg-grid-0", "bg-grid-1", "bg-grid-2", "bg-grid-3", "bg-grid-4"].map((c) => (
            <span
              key={c}
              className={`size-2.5 rounded-[2px] ${c} ${c === "bg-grid-0" ? "border border-border" : ""}`}
            />
          ))}
          <span className="ml-1">more</span>
        </span>
      </div>
    </div>
  );
}
