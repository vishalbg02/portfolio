"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { identityBg } from "@/components/work/identity";
import type { ProjectSlug } from "@/lib/content/profile-schema";
import type { StackGroup } from "@/lib/stack/usage";
import { cn } from "@/lib/utils/cn";

type ProjectRef = { slug: ProjectSlug; name: string };

/**
 * Five grouped cards of mono labels. Hover, focus or tap a skill to see which projects used it;
 * the matching project cards on the page light up too. Skills no project used stay plain text,
 * so nothing is linked that the case studies don't back up.
 */
export function StackExplorer({ groups, projects }: { groups: StackGroup[]; projects: ProjectRef[] }) {
  const liveId = useId();
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const active = hovered ?? pinned;

  const activeItem = groups.flatMap((g) => g.items).find((i) => i.name === active);
  const activeProjects = activeItem ? projects.filter((p) => activeItem.projects.includes(p.slug)) : [];

  // Light up matching project cards elsewhere on the page.
  useEffect(() => {
    const cards = document.querySelectorAll<HTMLElement>("[data-project]");
    cards.forEach((c) => {
      if (activeItem?.projects.includes(c.dataset.project as ProjectSlug))
        c.setAttribute("data-stack-hit", "true");
      else c.removeAttribute("data-stack-hit");
    });
    return () => cards.forEach((c) => c.removeAttribute("data-stack-hit"));
  }, [activeItem]);

  return (
    <div>
      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <li key={g.id} className="rounded-card border border-border bg-surface p-5">
            <h3 className="mb-3 font-mono text-xs tracking-[0.12em] text-muted uppercase">{g.label}</h3>
            <ul className="flex flex-wrap gap-1.5">
              {g.items.map((item) => {
                const used = item.projects.length > 0;
                const on = active === item.name;
                const base =
                  "inline-flex h-7 items-center rounded-sm border px-2.5 font-mono text-xs transition-colors";
                if (!used) {
                  return (
                    <li key={item.name}>
                      <span className={cn(base, "border-border text-muted")}>{item.name}</span>
                    </li>
                  );
                }
                return (
                  <li key={item.name}>
                    <button
                      type="button"
                      aria-pressed={pinned === item.name}
                      aria-describedby={on ? liveId : undefined}
                      onMouseEnter={() => setHovered(item.name)}
                      onMouseLeave={() => setHovered(null)}
                      onFocus={() => setHovered(item.name)}
                      onBlur={() => setHovered(null)}
                      onClick={() => setPinned((p) => (p === item.name ? null : item.name))}
                      className={cn(
                        base,
                        "cursor-pointer",
                        on
                          ? "border-accent bg-grid-1/40 text-text"
                          : "border-border-2 text-text hover:border-accent",
                      )}
                    >
                      {item.name}
                      <span
                        aria-hidden="true"
                        className="ml-1.5 inline-block size-1.5 rounded-pill bg-accent"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>

      <div id={liveId} aria-live="polite" className="mt-5 min-h-9 font-mono text-xs text-muted">
        {activeItem ? (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span>
              <span className="text-text">{activeItem.name}</span> used in
            </span>
            {activeProjects.map((p) => (
              <Link
                key={p.slug}
                href={`/work/${p.slug}`}
                className="inline-flex items-center gap-1.5 rounded-pill border border-border px-2.5 py-1 text-text transition-colors hover:border-border-2"
              >
                <span aria-hidden="true" className={cn("size-2 rounded-pill", identityBg[p.slug])} />
                {p.name}
              </Link>
            ))}
          </p>
        ) : (
          <p>
            <span
              className="mr-1.5 inline-block size-1.5 rounded-pill bg-accent align-middle"
              aria-hidden="true"
            />
            Hover, focus or tap a skill to see which projects used it.
          </p>
        )}
      </div>
    </div>
  );
}
