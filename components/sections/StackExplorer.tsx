"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { identityBg } from "@/components/work/identity";
import { track } from "@/lib/analytics";
import type { ProjectSlug } from "@/lib/content/profile-schema";
import { connections } from "@/lib/stack/map";
import type { StackGroup } from "@/lib/stack/usage";
import { cn } from "@/lib/utils/cn";

type ProjectRef = { slug: ProjectSlug; name: string };
type Pt = { x: number; y: number };

/**
 * The stack as a connection map. Grouped cards of mono skill chips, and a row of project markers
 * beneath them. Hover, focus or tap a skill: flat 1 px lines run from that chip to the projects that
 * used it (and their cards elsewhere on the page light up). Pick a project marker: every skill it used
 * lights up. Where the grid is a single column the lines are dropped and it is plain highlighting.
 * Skills no project used stay plain text, so nothing is linked that the case studies don't back up.
 */
export function StackExplorer({ groups, projects }: { groups: StackGroup[]; projects: ProjectRef[] }) {
  const liveId = useId();
  const [hovered, setHovered] = useState<{ skill: string | null; project: ProjectSlug | null }>({
    skill: null,
    project: null,
  });
  const [pinned, setPinned] = useState<{ skill: string | null; project: ProjectSlug | null }>({
    skill: null,
    project: null,
  });
  const active = {
    skill: hovered.skill ?? (hovered.project ? null : pinned.skill),
    project: hovered.project ?? (hovered.skill ? null : pinned.project),
  };
  const lit = connections(groups, active);

  const wrap = useRef<HTMLDivElement>(null);
  const chipEls = useRef(new Map<string, HTMLElement>());
  const markerEls = useRef(new Map<string, HTMLElement>());
  const [pts, setPts] = useState<{
    chips: Record<string, Pt>;
    markers: Record<string, Pt>;
    w: number;
    h: number;
  }>({ chips: {}, markers: {}, w: 0, h: 0 });

  // Measure where everything is (on mount and whenever the layout changes), relative to the wrapper.
  const measure = useCallback(() => {
    const box = wrap.current?.getBoundingClientRect();
    if (!box) return;
    const at = (el: HTMLElement, edge: "top" | "bottom"): Pt => {
      const r = el.getBoundingClientRect();
      return { x: r.left - box.left + r.width / 2, y: (edge === "top" ? r.top : r.bottom) - box.top };
    };
    setPts({
      chips: Object.fromEntries([...chipEls.current].map(([k, el]) => [k, at(el, "bottom")])),
      markers: Object.fromEntries([...markerEls.current].map(([k, el]) => [k, at(el, "top")])),
      w: box.width,
      h: box.height,
    });
  }, []);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  // Light up matching project cards elsewhere on the page.
  useEffect(() => {
    const cards = document.querySelectorAll<HTMLElement>("[data-project]");
    cards.forEach((c) => {
      if (lit.projects.includes(c.dataset.project as ProjectSlug)) c.setAttribute("data-stack-hit", "true");
      else c.removeAttribute("data-stack-hit");
    });
    return () => cards.forEach((c) => c.removeAttribute("data-stack-hit"));
  }, [lit.projects]);

  const activeItem = groups.flatMap((g) => g.items).find((i) => i.name === active.skill);
  const activeProject = projects.find((p) => p.slug === active.project);
  const litProjects = projects.filter((p) => lit.projects.includes(p.slug));
  const pinSkill = (name: string) => {
    const next = pinned.skill === name ? null : name;
    if (next) track("stack_skill_select", { kind: "skill", skill: name });
    setPinned({ skill: next, project: null });
  };
  const pinProject = (slug: ProjectSlug) => {
    const next = pinned.project === slug ? null : slug;
    if (next) track("stack_skill_select", { kind: "project", project: slug });
    setPinned({ skill: null, project: next });
  };

  return (
    <div ref={wrap} className="relative">
      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => (
          <li key={g.id} className="rounded-card border border-border bg-surface p-5">
            <h3 className="mb-3 font-mono text-xs tracking-[0.12em] text-muted uppercase">{g.label}</h3>
            <ul className="flex flex-wrap gap-1.5">
              {g.items.map((item) => {
                const used = item.projects.length > 0;
                const on = lit.skills.includes(item.name);
                const base =
                  "inline-flex min-h-7 items-center rounded-sm border px-2.5 font-mono text-xs transition-colors pointer-coarse:min-h-11";
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
                      ref={(el) => {
                        if (el) chipEls.current.set(item.name, el);
                        else chipEls.current.delete(item.name);
                      }}
                      type="button"
                      aria-pressed={pinned.skill === item.name}
                      aria-describedby={on ? liveId : undefined}
                      onMouseEnter={() => setHovered({ skill: item.name, project: null })}
                      onMouseLeave={() => setHovered({ skill: null, project: null })}
                      onFocus={() => setHovered({ skill: item.name, project: null })}
                      onBlur={() => setHovered({ skill: null, project: null })}
                      onClick={() => pinSkill(item.name)}
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

      {/* The project markers the lines run to. */}
      <div className="mt-10 border-t border-border pt-5">
        <p className="mb-3 font-mono text-[11px] tracking-[0.12em] text-muted uppercase">Used in</p>
        <ul className="flex flex-wrap gap-2">
          {projects.map((p) => {
            const on = lit.projects.includes(p.slug);
            return (
              <li key={p.slug}>
                <button
                  ref={(el) => {
                    if (el) markerEls.current.set(p.slug, el);
                    else markerEls.current.delete(p.slug);
                  }}
                  type="button"
                  data-marker={p.slug}
                  aria-pressed={pinned.project === p.slug}
                  aria-describedby={active.project === p.slug ? liveId : undefined}
                  onMouseEnter={() => setHovered({ skill: null, project: p.slug })}
                  onMouseLeave={() => setHovered({ skill: null, project: null })}
                  onFocus={() => setHovered({ skill: null, project: p.slug })}
                  onBlur={() => setHovered({ skill: null, project: null })}
                  onClick={() => pinProject(p.slug)}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-2 rounded-sm border px-3 font-mono text-xs transition-colors md:min-h-9",
                    on
                      ? "border-accent bg-grid-1/40 text-text"
                      : "border-border-2 text-text hover:border-accent",
                  )}
                >
                  <span aria-hidden="true" className={cn("size-2.5 rounded-[2px]", identityBg[p.slug])} />
                  {p.name}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Flat 1 px connection lines (two or three columns only; a single column just highlights). */}
      <svg
        aria-hidden="true"
        data-testid="stack-lines"
        width={pts.w}
        height={pts.h}
        viewBox={`0 0 ${Math.max(1, pts.w)} ${Math.max(1, pts.h)}`}
        className="pointer-events-none absolute inset-0 z-10 hidden overflow-visible md:block"
      >
        {lit.pairs.map(([skill, slug]) => {
          const a = pts.chips[skill];
          const b = pts.markers[slug];
          if (!a || !b) return null;
          return (
            <g key={`${skill}>${slug}`} className="stack-line">
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--accent)" strokeWidth={1} />
              <circle cx={a.x} cy={a.y} r={2.5} fill="var(--accent)" />
              <circle cx={b.x} cy={b.y} r={2.5} fill="var(--accent)" />
            </g>
          );
        })}
      </svg>

      <div id={liveId} aria-live="polite" className="mt-5 min-h-9 font-mono text-xs text-muted">
        {activeItem ? (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span>
              <span className="text-text">{activeItem.name}</span> used in
            </span>
            {litProjects.map((p) => (
              <Link
                key={p.slug}
                href={`/work/${p.slug}`}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-pill border border-border px-2.5 py-1 text-text transition-colors hover:border-border-2"
              >
                <span aria-hidden="true" className={cn("size-2 rounded-pill", identityBg[p.slug])} />
                {p.name}
              </Link>
            ))}
          </p>
        ) : activeProject ? (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span>
              <span className="text-text">{activeProject.name}</span> used {lit.skills.length} of these skills
            </span>
            <Link
              href={`/work/${activeProject.slug}`}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-pill border border-border px-2.5 py-1 text-text transition-colors hover:border-border-2"
            >
              Case study →
            </Link>
          </p>
        ) : (
          <p>
            <span
              className="mr-1.5 inline-block size-1.5 rounded-pill bg-accent align-middle"
              aria-hidden="true"
            />
            Hover, focus or tap a skill to see which projects used it, or pick a project to see its skills.
          </p>
        )}
      </div>
    </div>
  );
}
