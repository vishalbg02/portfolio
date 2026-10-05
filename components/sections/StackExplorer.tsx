"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { identityBg } from "@/components/work/identity";
import { track } from "@/lib/analytics";
import { openGrid } from "@/lib/grid/events";
import { connections, type Active } from "@/lib/stack/map";
import type { StackGroup, StackItem, UseNode } from "@/lib/stack/usage";
import { cn } from "@/lib/utils/cn";

type Pt = { x: number; y: number };

const NONE: Active = { skill: null, node: null };

/** A node's square: a project's colour, or an outlined square for a role (roles have no identity colour). */
function NodeMark({ node, size = "size-2" }: { node: UseNode; size?: string }) {
  return node.kind === "project" ? (
    <span
      aria-hidden="true"
      className={cn(size, "shrink-0 rounded-[2px]", identityBg[node.id as keyof typeof identityBg])}
    />
  ) : (
    <span aria-hidden="true" className={cn(size, "shrink-0 rounded-[2px] border border-text")} />
  );
}

/** A flat S-curve between two anchors (a straight run in the middle, so lines read as wiring, not as swirls). */
export const wire = (a: Pt, b: Pt) => {
  const dx = (b.x - a.x) * 0.5;
  return `M${a.x} ${a.y}C${a.x + dx} ${a.y} ${b.x - dx} ${b.y} ${b.x} ${b.y}`;
};

/**
 * The stack as a connection map. Wide screens: skills on the left, grouped by area, where they were used on the right
 * (the projects, and the internships that are not a project of their own), and flat 1 px lines between every skill and
 * the places that used it (faint until you point at one). Hover, focus or pick a skill and its lines light up and draw
 * in; pick a place and every skill it used lights up. Phones: an accordion by area, each skill showing a square per
 * place, with the same facts in a line under the one you tapped.
 * Every skill can ask GRID "where did he use it?". A skill nothing on the map used says where it comes from instead
 * (a leadership role, a certificate, this site, or coursework & practice), so nothing is linked that profile.ts does
 * not back up.
 */
export function StackExplorer({ groups, nodes }: { groups: StackGroup[]; nodes: UseNode[] }) {
  const liveId = useId();
  const [wide, setWide] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const on = () => setWide(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  const [hovered, setHovered] = useState<Active>(NONE);
  const [pinned, setPinned] = useState<Active>(NONE);
  const [open, setOpen] = useState<string | null>(groups[0]?.id ?? null);
  const active: Active = {
    skill: hovered.skill ?? (hovered.node ? null : pinned.skill),
    node: hovered.node ?? (hovered.skill ? null : pinned.node),
  };
  const lit = connections(groups, active);
  const items = groups.flatMap((g) => g.items);
  const activeItem = items.find((i) => i.name === active.skill) ?? null;
  const activeNode = nodes.find((n) => n.id === active.node) ?? null;
  const litNodes = nodes.filter((n) => lit.nodes.includes(n.id));
  const nodeName = (id: string) => nodes.find((n) => n.id === id)?.name ?? id;

  const wrap = useRef<HTMLDivElement>(null);
  const skillEls = useRef(new Map<string, HTMLElement>());
  const markerEls = useRef(new Map<string, HTMLElement>());
  const [pts, setPts] = useState<{
    skills: Record<string, Pt>;
    markers: Record<string, Pt>;
    w: number;
    h: number;
  }>({ skills: {}, markers: {}, w: 0, h: 0 });

  // Where everything is, relative to the wrapper: a skill's right edge and a project's left edge are the wire ends.
  const measure = useCallback(() => {
    const box = wrap.current?.getBoundingClientRect();
    if (!box) return;
    const at = (el: HTMLElement, side: "left" | "right"): Pt => {
      const r = el.getBoundingClientRect();
      return { x: (side === "left" ? r.left : r.right) - box.left, y: r.top - box.top + r.height / 2 };
    };
    setPts({
      skills: Object.fromEntries([...skillEls.current].map(([k, el]) => [k, at(el, "right")])),
      markers: Object.fromEntries([...markerEls.current].map(([k, el]) => [k, at(el, "left")])),
      w: box.width,
      h: box.height,
    });
  }, []);
  useEffect(() => {
    const el = wrap.current;
    if (!el || !wide) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure, wide, open]);

  // The matching project cards elsewhere on the page light up too.
  useEffect(() => {
    const cards = document.querySelectorAll<HTMLElement>("[data-project]");
    cards.forEach((c) => {
      if (lit.nodes.includes(c.dataset.project ?? "")) c.setAttribute("data-stack-hit", "true");
      else c.removeAttribute("data-stack-hit");
    });
    return () => cards.forEach((c) => c.removeAttribute("data-stack-hit"));
  }, [lit.nodes]);

  const pinSkill = (name: string) => {
    const next = pinned.skill === name ? null : name;
    if (next) track("stack_skill_select", { kind: "skill", skill: name });
    setPinned({ skill: next, node: null });
  };
  const pinNode = (id: string) => {
    const next = pinned.node === id ? null : id;
    if (next) track("stack_skill_select", { kind: "project", project: id });
    setPinned({ skill: null, node: next });
  };

  const hoverSkill = (name: string) => ({
    onMouseEnter: () => setHovered({ skill: name, node: null }),
    onMouseLeave: () => setHovered(NONE),
    onFocus: () => setHovered({ skill: name, node: null }),
    onBlur: () => setHovered(NONE),
  });
  const hoverNode = (id: string) => ({
    onMouseEnter: () => setHovered({ skill: null, node: id }),
    onMouseLeave: () => setHovered(NONE),
    onFocus: () => setHovered({ skill: null, node: id }),
    onBlur: () => setHovered(NONE),
  });

  const skillRow = (item: StackItem) => {
    const on = lit.skills.includes(item.name);
    const pressed = pinned.skill === item.name;
    return (
      <button
        ref={(el) => {
          if (el) skillEls.current.set(item.name, el);
          else skillEls.current.delete(item.name);
        }}
        type="button"
        aria-pressed={pressed}
        aria-describedby={active.skill === item.name ? liveId : undefined}
        {...hoverSkill(item.name)}
        onClick={() => pinSkill(item.name)}
        className={cn(
          "flex min-h-6 w-full items-center justify-between gap-3 rounded-sm border px-2.5 text-left font-mono text-[13px] transition-colors max-lg:min-h-11 pointer-coarse:min-h-11",
          on || pressed
            ? "border-accent bg-grid-1/40 text-text"
            : item.used.length
              ? "border-transparent text-text hover:border-border-2"
              : "border-transparent text-muted hover:border-border-2 hover:text-text",
        )}
      >
        <span>{item.name}</span>
        <span className="flex shrink-0 items-center gap-1">
          {item.used.map((id) => {
            const node = nodes.find((n) => n.id === id);
            return node ? <NodeMark key={id} node={node} /> : null;
          })}
          {item.used.length ? (
            <span className="sr-only">used in {item.used.map(nodeName).join(", ")}</span>
          ) : item.elsewhere ? (
            <span className="text-[10px] tracking-[0.08em] text-muted uppercase">{item.elsewhere.tag}</span>
          ) : null}
        </span>
      </button>
    );
  };

  const detail = (
    <div id={liveId} aria-live="polite" className="min-h-9 font-mono text-xs text-muted">
      {activeItem ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {activeItem.used.length ? (
            <>
              <span>
                <span className="text-text">{activeItem.name}</span> used in
              </span>
              {litNodes.map((n) => (
                <Link
                  key={n.id}
                  href={n.href}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-pill border border-border px-2.5 py-1 text-text transition-colors hover:border-border-2"
                >
                  <NodeMark node={n} />
                  {n.name}
                  {n.kind === "role" ? <span className="text-muted">· {n.sub.split(" · ")[0]}</span> : null}
                </Link>
              ))}
            </>
          ) : (
            <span className="max-w-[60ch] text-[13px] leading-snug">
              <span className="text-text">{activeItem.name}</span>: {activeItem.elsewhere?.text}
            </span>
          )}
          <button
            type="button"
            data-cursor="ask"
            onClick={() => openGrid({ question: `Where did he use ${activeItem.name}?` })}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-pill border border-border-2 px-2.5 py-1 text-text transition-colors hover:border-accent hover:text-accent pointer-coarse:min-h-11"
          >
            <span aria-hidden="true" className="text-accent">
              ?
            </span>
            Ask GRID where
          </button>
        </div>
      ) : activeNode ? (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span>
            <span className="text-text">{activeNode.name}</span>
            {activeNode.kind === "role" ? ` (${activeNode.sub})` : ""} used {lit.skills.length} of these
            skills
          </span>
          <Link
            href={activeNode.href}
            className="inline-flex min-h-8 items-center gap-1.5 rounded-pill border border-border px-2.5 py-1 text-text transition-colors hover:border-border-2"
          >
            {activeNode.kind === "project" ? "Case study →" : "Experience →"}
          </Link>
        </p>
      ) : (
        <p>
          <span
            className="mr-1.5 inline-block size-1.5 rounded-pill bg-accent align-middle"
            aria-hidden="true"
          />
          Point at a skill to see where it was used, or pick a project or internship to see its skills.
        </p>
      )}
    </div>
  );

  const marker = (n: UseNode, kind: "node" | "chip") => {
    const on = lit.nodes.includes(n.id);
    const count = items.filter((i) => i.used.includes(n.id)).length;
    return (
      <button
        ref={(el) => {
          if (el) markerEls.current.set(n.id, el);
          else markerEls.current.delete(n.id);
        }}
        type="button"
        data-marker={n.id}
        data-marker-kind={n.kind}
        aria-pressed={pinned.node === n.id}
        aria-describedby={active.node === n.id ? liveId : undefined}
        {...hoverNode(n.id)}
        onClick={() => pinNode(n.id)}
        className={cn(
          "inline-flex items-center gap-2 rounded-sm border text-left font-mono text-xs transition-colors",
          kind === "node" ? "min-h-14 w-full px-3.5" : "min-h-11 px-3 md:min-h-9",
          on ? "border-accent bg-grid-1/40 text-text" : "border-border-2 text-text hover:border-accent",
        )}
      >
        <NodeMark node={n} size="size-2.5" />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px]">{n.name}</span>
          {kind === "node" ? (
            <span className="block text-muted">
              {n.kind === "role" ? `${n.sub.split(" · ")[0]} · ` : ""}
              {count} skills
            </span>
          ) : null}
        </span>
      </button>
    );
  };

  const baseWires = items.flatMap((i) => i.used.map((id) => [i.name, id] as const));

  if (wide) {
    return (
      <div ref={wrap} className="relative">
        <div className="grid grid-cols-[minmax(0,5fr)_minmax(96px,3fr)_minmax(0,4fr)]">
          <ul className="space-y-3">
            {groups.map((g) => (
              <li key={g.id}>
                <h3 className="mb-1 font-mono text-xs tracking-[0.12em] text-muted uppercase">{g.label}</h3>
                <ul>
                  {g.items.map((item) => (
                    <li key={item.name}>{skillRow(item)}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
          <div aria-hidden="true" />
          <div className="flex flex-col justify-between gap-3 py-8">
            <p className="font-mono text-[11px] tracking-[0.12em] text-muted uppercase">Used in</p>
            <ul className="flex flex-1 flex-col justify-around gap-3">
              {nodes.map((n) => (
                <li key={n.id}>{marker(n, "node")}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Flat 1 px wires: every connection faint, and the lit ones in the accent colour, drawn in. */}
        <svg
          aria-hidden="true"
          data-testid="stack-lines"
          width={pts.w}
          height={pts.h}
          viewBox={`0 0 ${Math.max(1, pts.w)} ${Math.max(1, pts.h)}`}
          className="pointer-events-none absolute inset-0 z-10 overflow-visible"
        >
          <g data-layer="base" opacity={lit.pairs.length ? 0.35 : 0.9}>
            {baseWires.map(([skill, id]) => {
              const a = pts.skills[skill];
              const b = pts.markers[id];
              if (!a || !b) return null;
              return (
                <path
                  key={`${skill}>${id}`}
                  d={wire(a, b)}
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth={1}
                />
              );
            })}
          </g>
          {lit.pairs.map(([skill, id]) => {
            const a = pts.skills[skill];
            const b = pts.markers[id];
            if (!a || !b) return null;
            return (
              <g key={`${skill}>${id}`} className="stack-line">
                <path
                  d={wire(a, b)}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth={1}
                  pathLength={1}
                  className="stack-wire"
                />
                <rect x={a.x - 2.5} y={a.y - 2.5} width={5} height={5} fill="var(--accent)" />
                <rect x={b.x - 2.5} y={b.y - 2.5} width={5} height={5} fill="var(--accent)" />
              </g>
            );
          })}
        </svg>

        <div className="mt-6 border-t border-border pt-4">{detail}</div>
      </div>
    );
  }

  // Phones: an accordion by area. Everything stays reachable by touch, and the lines give way to dots.
  return (
    <div ref={wrap}>
      <ul className="space-y-2">
        {groups.map((g) => {
          const expanded = open === g.id;
          return (
            <li key={g.id} className="rounded-card border border-border bg-surface">
              <h3>
                <button
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={`${liveId}-${g.id}`}
                  onClick={() => setOpen(expanded ? null : g.id)}
                  className="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left font-mono text-xs tracking-[0.12em] text-muted uppercase"
                >
                  <span>{g.label}</span>
                  <span className="flex items-center gap-3">
                    <span className="tracking-normal normal-case">{g.items.length}</span>
                    <span aria-hidden="true" className={cn("transition-transform", expanded && "rotate-90")}>
                      ›
                    </span>
                  </span>
                </button>
              </h3>
              <div id={`${liveId}-${g.id}`} hidden={!expanded} className="px-2 pb-2">
                <ul>
                  {g.items.map((item) => (
                    <li key={item.name}>
                      {skillRow(item)}
                      {pinned.skill === item.name ? <div className="px-2.5 py-2">{detail}</div> : null}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 border-t border-border pt-4">
        <p className="mb-3 font-mono text-[11px] tracking-[0.12em] text-muted uppercase">Used in</p>
        <ul className="flex flex-wrap gap-2">
          {nodes.map((n) => (
            <li key={n.id}>{marker(n, "chip")}</li>
          ))}
        </ul>
        {pinned.node ? <div className="mt-4">{detail}</div> : null}
      </div>
    </div>
  );
}
