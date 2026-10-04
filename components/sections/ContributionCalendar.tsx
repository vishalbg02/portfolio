"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import { describeDay, monthLabels } from "@/lib/github/calendar";
import type { Mark } from "@/lib/github/marks";
import { assignTiers, dayRow } from "@/lib/github/pins";
import type { ContributionDay, ContributionLevel } from "@/lib/github/types";
import { cn } from "@/lib/utils/cn";

export const CELL = 11;
export const GAP = 3;
export const PITCH = CELL + GAP;
export const LEFT = 30;
const MONTH_ROW = 18;
const TIER = 24; // pin buttons are 24px targets, so tiers are 24px apart
const BAND_H = 20;
const BAND_GAP = 4;
const FILL = ["fill-grid-0", "fill-grid-1", "fill-grid-2", "fill-grid-3", "fill-grid-4"] as const;
const R = 2;
const POPOVER_W = 280;

/** One rounded square as a path segment (so a whole intensity level is a single DOM element). */
const cell = (x: number, y: number) =>
  `M${x + R} ${y}h${CELL - 2 * R}a${R} ${R} 0 0 1 ${R} ${R}v${CELL - 2 * R}a${R} ${R} 0 0 1 -${R} ${R}h-${CELL - 2 * R}a${R} ${R} 0 0 1 -${R} -${R}v-${CELL - 2 * R}a${R} ${R} 0 0 1 ${R} -${R}z`;

const labelWidth = (m: Mark) => 28 + Math.min(m.short.length * 6.7, 230);

/**
 * Native 53×7 contribution calendar (SVG, not an image), annotated with three kinds of marks:
 *  - roles as bands above the months (where he worked, overlapping roles stacked),
 *  - awards as white diamonds pinned on their month,
 *  - peak days as green markers on the exact busiest cells (the day that had the most contributions).
 * Hover, focus or tap a mark for its story. Drawn as five <path>s (one per level) instead of 371 <rect>s.
 * Fills the card on wide screens; scrolls (with month snap) on narrow ones.
 */
export function ContributionCalendar({
  weeks,
  label,
  pins = [],
  bands = [],
  scrollTo = "end",
  selectedId = null,
}: {
  weeks: ContributionDay[][];
  label: string;
  pins?: Mark[];
  bands?: Mark[];
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

  const months = monthLabels(weeks);

  const tiered = useMemo(
    () =>
      assignTiers(
        pins.map((p) => ({ ...p, week: p.week! })),
        (p) => LEFT + p.week * PITCH + CELL / 2 - 12,
        (p) => labelWidth(p),
      ),
    [pins],
  );
  // A label near the last week hangs past the grid. Reserve that overhang in the viewBox, otherwise the
  // scroller is a few px wider than its box and "scroll to the end" shifts the weekday labels out of view.
  const grid = LEFT + weeks.length * PITCH;
  const overhang = tiered.reduce(
    (max, p) => Math.max(max, LEFT + p.week * PITCH + CELL / 2 - 12 + labelWidth(p) - grid),
    0,
  );
  const width = grid + (overhang > 0 ? Math.ceil(overhang) + 8 : 0);
  const tiers = tiered.reduce((n, p) => Math.max(n, p.tier + 1), 0);
  const pinH = tiers ? tiers * TIER + 8 : 0;
  const lanes = bands.reduce((n, b) => Math.max(n, (b.lane ?? 0) + 1), 0);
  const bandsH = lanes ? lanes * (BAND_H + BAND_GAP) + 4 : 0;
  const top = pinH + bandsH + MONTH_ROW;
  const height = top + 7 * PITCH;
  const px = (p: (typeof tiered)[number]) => LEFT + p.week * PITCH + CELL / 2;
  const markerY = (p: (typeof tiered)[number]) => pinH - 4 - TIER / 2 - p.tier * TIER;
  const all = useMemo(() => [...pins, ...bands], [pins, bands]);

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

  const open = (id: string, button: HTMLElement, stick: boolean, count = true) => {
    const box = outer.current?.getBoundingClientRect();
    if (!box) return;
    const r = button.getBoundingClientRect();
    sticky.current = stick;
    if (stick && count) track("milestone_open", { kind: all.find((m) => m.id === id)?.kind ?? "unknown" });
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
  // Hover close is delayed so the pointer can travel from the mark to its card.
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
  const openMark = all.find((m) => m.id === openId);

  // A mark picked from the list or the highlights scrolls the calendar to it (and, on wide screens, opens its card).
  useEffect(() => {
    if (!selectedId) return;
    const pin = tiered.find((p) => p.id === selectedId);
    const band = bands.find((b) => b.id === selectedId);
    if (pin) scrollToX(px(pin), true);
    else if (band) scrollToX(LEFT + ((band.from ?? 0) + (band.to ?? 0) / 1) * (PITCH / 2), true);
    const t = window.setTimeout(() => {
      const btn = outer.current?.querySelector<HTMLElement>(`[data-mark="${selectedId}"]`);
      if (btn && window.matchMedia("(min-width: 768px)").matches) open(selectedId, btn, true, false);
    }, 450);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // Click outside closes a pinned card.
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

  const hoverProps = (m: Mark) => ({
    onPointerEnter: (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType !== "mouse" || sticky.current) return;
      cancelClose();
      open(m.id, e.currentTarget, false);
    },
    onPointerLeave: (e: React.PointerEvent<HTMLElement>) =>
      e.pointerType === "mouse" && !sticky.current && scheduleClose(),
    onFocus: (e: React.FocusEvent<HTMLElement>) => open(m.id, e.currentTarget, false),
    onClick: (e: React.MouseEvent<HTMLElement>) =>
      openId === m.id && sticky.current ? close() : open(m.id, e.currentTarget, true),
  });

  const kindLabel = (k: Mark["kind"]) => (k === "award" ? "Award" : k === "peak" ? "Peak day" : "Role");

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
            {tiered.map((p) => (
              <line
                key={`l-${p.id}`}
                x1={px(p)}
                x2={px(p)}
                y1={markerY(p)}
                y2={top + p.day! * PITCH}
                stroke={p.kind === "peak" ? "var(--accent)" : "var(--border-2)"}
                strokeWidth={1}
              />
            ))}
            {months.map((m) => (
              <text
                key={m.week}
                x={LEFT + m.week * PITCH}
                y={pinH + bandsH + 11}
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
            {tiered.map((p) => (
              <rect
                key={`c-${p.id}`}
                data-pin-cell={p.id}
                x={LEFT + p.week * PITCH - 1}
                y={top + p.day! * PITCH - 1}
                width={CELL + 2}
                height={CELL + 2}
                rx={3}
                fill="none"
                stroke={p.kind === "peak" ? "var(--accent)" : "var(--text)"}
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

          {/* Roles: bands above the months, spanning the weeks he worked there. */}
          {bands.map((b) => {
            const left = LEFT + b.from! * PITCH;
            const w = (b.to! - b.from! + 1) * PITCH - GAP;
            const selected = selectedId === b.id || openId === b.id;
            return (
              <button
                key={b.id}
                type="button"
                data-mark={b.id}
                data-band={b.id}
                aria-expanded={openId === b.id}
                aria-label={`${b.title}, ${b.when}`}
                {...hoverProps(b)}
                className={cn(
                  "absolute flex items-center overflow-hidden border bg-grid-1/70 px-2 text-left font-mono text-[10px] text-text transition-colors hover:bg-grid-1 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-link",
                  b.cutLeft ? "rounded-l-none border-l-0" : "rounded-l-sm",
                  b.cutRight ? "rounded-r-none border-r-0" : "rounded-r-sm",
                  selected ? "border-text" : "border-grid-2",
                )}
                style={{
                  left: `${(left / width) * 100}%`,
                  width: `${(w / width) * 100}%`,
                  top: `${((pinH + 4 + (b.lane ?? 0) * (BAND_H + BAND_GAP)) / height) * 100}%`,
                  height: `${(BAND_H / height) * 100}%`,
                  minHeight: 0,
                }}
              >
                <span aria-hidden="true" className="truncate">
                  {b.cutLeft ? "‹ " : ""}
                  {b.short}
                  {b.cutRight ? " ›" : ""}
                </span>
              </button>
            );
          })}

          {/* Awards (diamonds) and peak days (green triangles): a 24 px target and a label in the row above. */}
          {tiered.map((p) => {
            const selected = selectedId === p.id || openId === p.id;
            return (
              <div
                key={p.id}
                className="absolute flex items-center"
                style={{
                  left: `${((px(p) - 12) / width) * 100}%`,
                  top: `${((markerY(p) - TIER / 2) / height) * 100}%`,
                  height: TIER,
                }}
              >
                <button
                  type="button"
                  data-mark={p.id}
                  data-milestone={p.id}
                  data-kind={p.kind}
                  aria-expanded={openId === p.id}
                  aria-label={`${p.title}, ${p.when}`}
                  {...hoverProps(p)}
                  className="grid size-6 shrink-0 place-items-center rounded-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-link"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      p.kind === "peak"
                        ? "h-2.5 w-3 bg-accent [clip-path:polygon(50%_0,100%_100%,0_100%)]"
                        : "size-2.5 rotate-45 bg-text",
                      selected && "ring-2 ring-link ring-offset-2 ring-offset-surface",
                    )}
                  />
                </button>
                <span
                  aria-hidden="true"
                  className={cn(
                    "ml-0.5 hidden max-w-[230px] truncate bg-surface px-1 font-mono text-[11px] md:block",
                    p.kind === "peak" ? "text-accent" : "text-muted",
                  )}
                >
                  {p.short}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {openMark && pop ? (
        <div
          role="group"
          aria-label={openMark.title}
          data-testid="milestone-popover"
          onPointerEnter={cancelClose}
          className="absolute z-20 rounded-card border border-border-2 bg-bg p-3.5 shadow-none"
          style={{ left: pop.left, top: pop.top, width: POPOVER_W }}
          onPointerLeave={(e) => e.pointerType === "mouse" && !sticky.current && scheduleClose()}
        >
          <p
            className={cn(
              "font-mono text-[11px] tracking-[0.12em] uppercase",
              openMark.kind === "peak" ? "text-accent" : "text-muted",
            )}
          >
            {kindLabel(openMark.kind)} · {openMark.when}
          </p>
          <p className="mt-1 text-sm font-medium text-text">{openMark.title}</p>
          <p className="mt-1.5 text-sm text-muted">{openMark.story}</p>
          {openMark.href ? (
            <Link
              href={openMark.href}
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
