"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import type { Milestone } from "@/lib/content/milestones";
import { describeDay, monthLabels } from "@/lib/github/calendar";
import { assignTiers, dayRow, pinsFor } from "@/lib/github/pins";
import type { ContributionDay, ContributionLevel } from "@/lib/github/types";

export const CELL = 11;
export const GAP = 3;
export const PITCH = CELL + GAP;
export const LEFT = 30;
const MONTH_ROW = 18;
const TIER = 24; // pin buttons are 24px targets, so tiers are 24px apart
const FILL = ["fill-grid-0", "fill-grid-1", "fill-grid-2", "fill-grid-3", "fill-grid-4"] as const;
const R = 2;
const POPOVER_W = 272;

/** One rounded square as a path segment (so a whole intensity level is a single DOM element). */
const cell = (x: number, y: number) =>
  `M${x + R} ${y}h${CELL - 2 * R}a${R} ${R} 0 0 1 ${R} ${R}v${CELL - 2 * R}a${R} ${R} 0 0 1 -${R} ${R}h-${CELL - 2 * R}a${R} ${R} 0 0 1 -${R} -${R}v-${CELL - 2 * R}a${R} ${R} 0 0 1 ${R} -${R}z`;

const labelWidth = (m: Milestone) => 28 + Math.min(m.short.length * 6.7, 190);

/**
 * Native 53×7 contribution calendar (SVG, not an image). Drawn as five <path>s — one per level —
 * instead of 371 <rect>s, which keeps the DOM small. Tooltip per day on hover or tap, found by
 * pointer coordinates. Milestones are pinned on their month: an outlined cell, a leader line and a
 * marker in a label row above (hover, focus or tap for the story). Fills the card on wide screens;
 * scrolls (with month snap) on narrow ones.
 */
export function ContributionCalendar({
  weeks,
  label,
  milestones = [],
  scrollTo = "end",
  selectedId = null,
}: {
  weeks: ContributionDay[][];
  label: string;
  milestones?: Milestone[];
  scrollTo?: "start" | "end";
  selectedId?: string | null;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pop, setPop] = useState<{ left: number; top: number } | null>(null);
  const sticky = useRef(false);

  const width = LEFT + weeks.length * PITCH;
  const months = monthLabels(weeks);

  const pins = useMemo(() => {
    const base = pinsFor(weeks, milestones);
    return assignTiers(
      base,
      (p) => LEFT + p.week * PITCH + CELL / 2 - 12,
      (p) => labelWidth(p.milestone),
    );
  }, [weeks, milestones]);

  const tiers = pins.reduce((n, p) => Math.max(n, p.tier + 1), 0);
  const pinH = tiers ? tiers * TIER + 8 : 0;
  const top = pinH + MONTH_ROW;
  const height = top + 7 * PITCH;
  const px = (p: (typeof pins)[number]) => LEFT + p.week * PITCH + CELL / 2;
  const markerY = (p: (typeof pins)[number]) => pinH - 4 - TIER / 2 - p.tier * TIER;

  const paths = useMemo(() => {
    const byLevel: string[][] = [[], [], [], [], []];
    weeks.forEach((week, wi) =>
      week.forEach((d) =>
        byLevel[d.level as ContributionLevel]!.push(cell(LEFT + wi * PITCH, top + dayRow(d) * PITCH)),
      ),
    );
    return byLevel.map((p) => p.join(""));
  }, [weeks, top]);

  const scrollToX = (x: number, smooth: boolean) => {
    const el = scroller.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scale = el.scrollWidth / width;
    el.scrollTo({
      left: Math.max(0, x * scale - el.clientWidth / 2),
      behavior: smooth && !reduced ? "smooth" : "auto",
    });
  };

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = scrollTo === "end" ? el.scrollWidth : 0;
  }, [scrollTo, weeks]);

  // A milestone picked from the list below scrolls the calendar to its pin.
  useEffect(() => {
    const pin = pins.find((p) => p.milestone.id === selectedId);
    if (pin) scrollToX(px(pin), true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const show = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    const box = outer.current?.getBoundingClientRect();
    if (!svg || !box) return;
    const r = svg.getBoundingClientRect();
    const scale = r.width / width;
    const x = (e.clientX - r.left) / scale;
    const y = (e.clientY - r.top) / scale;
    const wi = Math.floor((x - LEFT) / PITCH);
    const di = Math.floor((y - top) / PITCH);
    const inGap = (x - LEFT) % PITCH > CELL || (y - top) % PITCH > CELL;
    const day = x >= LEFT && y >= top && !inGap ? weeks[wi]?.find((d) => dayRow(d) === di) : undefined;
    if (!day) return setTip(null);
    setTip({ text: describeDay(day), x: e.clientX - box.left, y: e.clientY - box.top });
  };

  const open = (id: string, button: HTMLElement, stick: boolean) => {
    const box = outer.current?.getBoundingClientRect();
    if (!box) return;
    const r = button.getBoundingClientRect();
    sticky.current = stick;
    if (stick) track("milestone_open", { kind: milestoneKind(id) });
    setTip(null);
    setPop({
      left: Math.min(Math.max(r.left - box.left + r.width / 2 - 24, 0), Math.max(0, box.width - POPOVER_W)),
      top: r.bottom - box.top + 6,
    });
    setOpenId(id);
  };
  const close = () => {
    cancelClose();
    sticky.current = false;
    setOpenId(null);
  };
  // Hover close is delayed so the pointer can travel from the pin to its card.
  const closeTimer = useRef<number | null>(null);
  function cancelClose() {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }
  function scheduleClose() {
    cancelClose();
    closeTimer.current = window.setTimeout(() => {
      if (!sticky.current) setOpenId(null);
    }, 160);
  }
  const milestoneKind = (id: string) => pins.find((p) => p.milestone.id === id)?.milestone.kind ?? "unknown";
  const openMilestone = pins.find((p) => p.milestone.id === openId)?.milestone;

  // Click outside closes a pinned popover.
  useEffect(() => {
    if (!openId) return;
    const away = (e: PointerEvent) => {
      if (outer.current?.contains(e.target as Node)) return;
      sticky.current = false;
      setOpenId(null);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [openId]);

  return (
    <div
      ref={outer}
      className="relative"
      onKeyDown={(e) => e.key === "Escape" && openId && close()}
      onBlur={(e) => {
        if (openId && !outer.current?.contains(e.relatedTarget as Node | null)) close();
      }}
    >
      <div ref={scroller} onScroll={close} className="overflow-x-auto pb-2">
        <div className="relative" style={{ minWidth: width }}>
          <svg
            ref={svgRef}
            role="img"
            aria-label={label}
            data-testid="contribution-calendar"
            data-weeks={weeks.length}
            viewBox={`0 0 ${width} ${height}`}
            className="block h-auto w-full"
            onPointerMove={show}
            onPointerDown={show}
            onPointerLeave={() => setTip(null)}
          >
            {pins.map((p) => (
              <line
                key={`l-${p.milestone.id}`}
                x1={px(p)}
                x2={px(p)}
                y1={markerY(p)}
                y2={top + p.day * PITCH}
                stroke="var(--border-2)"
                strokeWidth={1}
              />
            ))}
            {months.map((m) => (
              <text
                key={m.week}
                x={LEFT + m.week * PITCH}
                y={pinH + 11}
                fontSize="10"
                fill="var(--muted)"
                stroke="var(--surface)"
                strokeWidth={3}
                paintOrder="stroke"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {m.label}
              </text>
            ))}
            {[1, 3, 5].map((row) => (
              <text
                key={row}
                x={0}
                y={top + row * PITCH + 9}
                fontSize="10"
                fill="var(--muted)"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][row]}
              </text>
            ))}
            {paths.map((d, level) => (
              <path
                key={level}
                d={d}
                data-level={level}
                className={FILL[level]}
                stroke={level === 0 ? "var(--border)" : "none"}
                strokeWidth={level === 0 ? 0.5 : 0}
              />
            ))}
            {pins.map((p) => (
              <rect
                key={`c-${p.milestone.id}`}
                data-pin-cell={p.milestone.id}
                x={LEFT + p.week * PITCH - 1}
                y={top + p.day * PITCH - 1}
                width={CELL + 2}
                height={CELL + 2}
                rx={3}
                fill="none"
                stroke="var(--text)"
                strokeWidth={2}
              />
            ))}
          </svg>

          {/* Month snap points for touch scrolling. */}
          {months.map((m) => (
            <span
              key={`s-${m.week}`}
              aria-hidden="true"
              className="pointer-events-none absolute top-0 h-px w-px snap-start"
              style={{ left: `${((LEFT + m.week * PITCH) / width) * 100}%` }}
            />
          ))}

          {pins.map((p) => {
            const m = p.milestone;
            const selected = selectedId === m.id || openId === m.id;
            return (
              <div
                key={m.id}
                className="absolute flex items-center"
                style={{
                  left: `${((px(p) - 12) / width) * 100}%`,
                  top: `${((markerY(p) - TIER / 2) / height) * 100}%`,
                  height: TIER,
                }}
              >
                <button
                  type="button"
                  data-milestone={m.id}
                  aria-expanded={openId === m.id}
                  aria-label={`${m.title}, ${m.when}`}
                  onPointerEnter={(e) => {
                    if (e.pointerType !== "mouse" || sticky.current) return;
                    cancelClose();
                    open(m.id, e.currentTarget, false);
                  }}
                  onPointerLeave={(e) => e.pointerType === "mouse" && !sticky.current && scheduleClose()}
                  onFocus={(e) => open(m.id, e.currentTarget, false)}
                  onClick={(e) =>
                    openId === m.id && sticky.current ? close() : open(m.id, e.currentTarget, true)
                  }
                  className="grid size-6 shrink-0 place-items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-link"
                >
                  <span
                    aria-hidden="true"
                    className={`size-2.5 rotate-45 ${m.kind === "award" ? "bg-text" : "bg-accent"} ${selected ? "ring-2 ring-link ring-offset-2 ring-offset-surface" : ""}`}
                  />
                </button>
                <span
                  aria-hidden="true"
                  className="ml-0.5 hidden max-w-[190px] truncate bg-surface px-1 font-mono text-[11px] text-muted md:block"
                >
                  {m.short}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {openMilestone && pop ? (
        <div
          role="group"
          aria-label={openMilestone.title}
          data-testid="milestone-popover"
          onPointerEnter={cancelClose}
          className="absolute z-20 rounded-card border border-border-2 bg-bg p-3.5 shadow-none"
          style={{ left: pop.left, top: pop.top, width: POPOVER_W }}
          onPointerLeave={(e) => e.pointerType === "mouse" && !sticky.current && scheduleClose()}
        >
          <p className="font-mono text-[11px] tracking-[0.12em] text-muted uppercase">
            {openMilestone.kind === "award" ? "Award" : openMilestone.kind === "launch" ? "Launch" : "Role"} ·{" "}
            {openMilestone.when}
          </p>
          <p className="mt-1 text-sm font-medium text-text">{openMilestone.title}</p>
          <p className="mt-1.5 text-sm text-muted">{openMilestone.story}</p>
          {openMilestone.href ? (
            <Link
              href={openMilestone.href}
              className="mt-2.5 inline-block font-mono text-xs text-link underline-offset-4 hover:underline"
            >
              See the proof →
            </Link>
          ) : null}
        </div>
      ) : null}

      {tip ? (
        <div
          role="status"
          data-testid="day-tooltip"
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-sm border border-border-2 bg-bg px-2.5 py-1.5 font-mono text-xs whitespace-nowrap text-text"
          style={{ left: tip.x, top: tip.y }}
        >
          {tip.text}
        </div>
      ) : null}
    </div>
  );
}
