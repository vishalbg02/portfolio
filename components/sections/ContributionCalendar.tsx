"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { describeDay, monthLabels } from "@/lib/github/calendar";
import type { ContributionDay, ContributionLevel } from "@/lib/github/types";

export const CELL = 11;
export const GAP = 3;
export const PITCH = CELL + GAP;
export const LEFT = 30;
export const TOP = 18;
const FILL = ["fill-grid-0", "fill-grid-1", "fill-grid-2", "fill-grid-3", "fill-grid-4"] as const;
const R = 2;

/** One rounded square as a path segment (so a whole intensity level is a single DOM element). */
const cell = (x: number, y: number) =>
  `M${x + R} ${y}h${CELL - 2 * R}a${R} ${R} 0 0 1 ${R} ${R}v${CELL - 2 * R}a${R} ${R} 0 0 1 -${R} ${R}h-${CELL - 2 * R}a${R} ${R} 0 0 1 -${R} -${R}v-${CELL - 2 * R}a${R} ${R} 0 0 1 ${R} -${R}z`;

/**
 * Native 53×7 contribution calendar (SVG, not an image). Drawn as five <path>s — one per level —
 * instead of 371 <rect>s, which keeps the DOM small. Tooltip per day on hover or tap, found by
 * pointer coordinates. Fills the card on wide screens; scrolls (from the latest week) on narrow ones.
 */
export function ContributionCalendar({ weeks, label }: { weeks: ContributionDay[][]; label: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  const width = LEFT + weeks.length * PITCH;
  const height = TOP + 7 * PITCH;
  const months = monthLabels(weeks);

  const paths = useMemo(() => {
    const byLevel: string[][] = [[], [], [], [], []];
    weeks.forEach((week, wi) =>
      week.forEach((d, di) =>
        byLevel[d.level as ContributionLevel]!.push(cell(LEFT + wi * PITCH, TOP + di * PITCH)),
      ),
    );
    return byLevel.map((p) => p.join(""));
  }, [weeks]);

  const show = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    const box = scroller.current?.getBoundingClientRect();
    if (!svg || !box) return;
    const r = svg.getBoundingClientRect();
    const scale = r.width / width;
    const px = (e.clientX - r.left) / scale;
    const py = (e.clientY - r.top) / scale;
    const wi = Math.floor((px - LEFT) / PITCH);
    const di = Math.floor((py - TOP) / PITCH);
    const day = px >= LEFT && py >= TOP ? weeks[wi]?.[di] : undefined;
    const inGap = (px - LEFT) % PITCH > CELL || (py - TOP) % PITCH > CELL;
    if (!day || inGap) return setTip(null);
    setTip({
      text: describeDay(day),
      x: e.clientX - box.left + (scroller.current?.scrollLeft ?? 0),
      y: e.clientY - box.top,
    });
  };

  return (
    <div className="relative">
      <div ref={scroller} className="overflow-x-auto pb-2">
        <svg
          ref={svgRef}
          role="img"
          aria-label={label}
          data-testid="contribution-calendar"
          data-weeks={weeks.length}
          viewBox={`0 0 ${width} ${height}`}
          style={{ minWidth: width }}
          className="block h-auto w-full"
          onPointerMove={show}
          onPointerDown={show}
          onPointerLeave={() => setTip(null)}
        >
          {months.map((m) => (
            <text
              key={m.week}
              x={LEFT + m.week * PITCH}
              y={11}
              fontSize="10"
              fill="var(--muted)"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              {m.label}
            </text>
          ))}
          {[1, 3, 5].map((row) => (
            <text
              key={row}
              x={0}
              y={TOP + row * PITCH + 9}
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
        </svg>
      </div>
      {tip ? (
        <div
          role="status"
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-sm border border-border-2 bg-bg px-2.5 py-1.5 font-mono text-xs whitespace-nowrap text-text"
          style={{ left: tip.x, top: tip.y }}
        >
          {tip.text}
        </div>
      ) : null}
    </div>
  );
}
