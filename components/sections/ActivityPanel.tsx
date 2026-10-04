"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import type { Milestone } from "@/lib/content/milestones";
import { monthTotals } from "@/lib/github/calendar";
import { pinsFor } from "@/lib/github/pins";
import { computeStreaks } from "@/lib/github/streaks";
import type { ContributionCalendar as Calendar } from "@/lib/github/types";
import { cn } from "@/lib/utils/cn";
import { relativeTime } from "@/lib/utils/relative-time";
import { CountUp } from "@/components/ui/CountUp";
import { ContributionCalendar } from "./ContributionCalendar";

type View = { calendar: Calendar; asOf: string; updated: string; scrollTo: "start" | "end" };
type Loaded = Record<string, View | "loading" | "error">;

const unit = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

const Stat = ({ value, label }: { value: React.ReactNode; label: string }) => (
  <div className="min-w-0 p-4 sm:p-5">
    <dt className="font-mono text-[11px] tracking-[0.12em] text-muted uppercase">{label}</dt>
    <dd className="mt-1.5 text-2xl font-semibold text-text tabular-nums">{value}</dd>
  </div>
);

/**
 * The activity block: stats, the calendar with its milestone pins, and the year switcher. The
 * last-year view is server-rendered (props); other years load from /api/github/calendar on demand
 * and are kept for the session. Only the stats and the calendar change; the leadership line and
 * latest activity stay put.
 */
export function ActivityPanel({
  initial,
  years,
  milestones,
}: {
  initial: View;
  years: number[];
  milestones: Milestone[];
}) {
  const [key, setKey] = useState("last");
  const [loaded, setLoaded] = useState<Loaded>({ last: initial });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const inflight = useRef(new Set<string>());

  const select = useCallback(
    async (next: string) => {
      setKey(next);
      setSelectedId(null);
      if (loaded[next] && loaded[next] !== "error") return;
      if (inflight.current.has(next)) return;
      inflight.current.add(next);
      setLoaded((l) => ({ ...l, [next]: "loading" }));
      try {
        const res = await fetch(`/api/github/calendar?year=${next}`);
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as {
          source: "live" | "snapshot";
          generatedAt: string;
          calendar: Calendar;
        };
        const thisYear = String(new Date().getUTCFullYear()) === next;
        const days = data.calendar.weeks.flat();
        setLoaded((l) => ({
          ...l,
          [next]: {
            calendar: data.calendar,
            asOf: days.at(-1)?.date ?? `${next}-12-31`,
            updated:
              data.source === "live"
                ? "Live · refreshed hourly"
                : `Updated ${relativeTime(data.generatedAt, Date.now())}`,
            scrollTo: thisYear ? "end" : "start",
          },
        }));
      } catch {
        setLoaded((l) => ({ ...l, [next]: "error" }));
      } finally {
        inflight.current.delete(next);
      }
    },
    [loaded],
  );

  const entry = loaded[key];
  // While another year loads (or fails) keep showing the last good view, dimmed.
  const view: View = typeof entry === "object" ? entry : initial;
  const status = typeof entry === "string" ? entry : null;
  const shownKey = typeof entry === "object" ? key : "last";

  const weeks = view.calendar.weeks;
  const days = useMemo(() => weeks.flat(), [weeks]);
  const longest = useMemo(() => computeStreaks(days, view.asOf).longest, [days, view.asOf]);
  const activeDays = days.filter((d) => d.count > 0).length;
  const period = shownKey === "last" ? "last year" : shownKey;
  const inView = useMemo(() => pinsFor(weeks, milestones).map((p) => p.milestone), [weeks, milestones]);

  const tabs = [
    { key: "last", label: "Last 12 months" },
    ...years.map((y) => ({ key: String(y), label: String(y) })),
  ];

  return (
    <>
      <div role="group" aria-label="Contribution period" className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={key === t.key}
            onClick={() => select(t.key)}
            className={cn(
              "min-h-8 rounded-pill border px-3 font-mono text-xs transition-colors pointer-coarse:min-h-11",
              key === t.key
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-muted hover:border-border-2 hover:text-text",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <dl className="grid overflow-hidden rounded-card border border-border bg-surface sm:grid-cols-3 [&>div:not(:first-child)]:border-t [&>div:not(:first-child)]:border-border sm:[&>div:not(:first-child)]:border-t-0 sm:[&>div:not(:first-child)]:border-l">
        <Stat value={<CountUp value={view.calendar.total} />} label={`Contributions, ${period}`} />
        <Stat value={<CountUp value={activeDays} />} label={`Active days, ${period}`} />
        <Stat
          value={
            <>
              <CountUp value={longest} /> {longest === 1 ? "day" : "days"}
            </>
          }
          label="Longest streak"
        />
      </dl>

      <div
        className="mt-4 rounded-card border border-border bg-surface p-4 sm:p-5"
        aria-busy={status === "loading"}
      >
        <div className={cn("transition-opacity", status ? "opacity-50" : "")}>
          <ContributionCalendar
            key={shownKey}
            weeks={weeks}
            milestones={milestones}
            scrollTo={view.scrollTo}
            selectedId={selectedId}
            label={`${view.calendar.total} contributions, ${period}. ${activeDays} active days, longest streak ${unit(longest)}.${inView.length ? ` ${inView.length} milestones pinned.` : ""}`}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 font-mono text-xs text-muted">
          <span role="status">
            {status === "loading"
              ? `Loading ${key}…`
              : status === "error"
                ? `Couldn't load ${key}. Showing the last year instead.`
                : view.updated}
          </span>
          <span aria-hidden="true" className="flex items-center gap-1">
            less
            {["bg-grid-0", "bg-grid-1", "bg-grid-2", "bg-grid-3", "bg-grid-4"].map((c) => (
              <span
                key={c}
                className={`size-2.5 rounded-[2px] ${c} ${c === "bg-grid-0" ? "border border-border" : ""}`}
              />
            ))}
            more
          </span>
        </div>

        {inView.length ? (
          <div className="mt-4 border-t border-border pt-4 md:hidden">
            <h3 className="mb-2 font-mono text-[11px] tracking-[0.12em] text-muted uppercase">Milestones</h3>
            <ul className="space-y-1.5">
              {inView.map((m) => {
                const open = selectedId === m.id;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => {
                        if (!open) track("milestone_open", { kind: m.kind });
                        setSelectedId(open ? null : m.id);
                      }}
                      className="flex min-h-11 w-full items-center gap-3 rounded-sm text-left text-sm text-text"
                    >
                      <span
                        aria-hidden="true"
                        className={`size-2.5 shrink-0 rotate-45 ${m.kind === "award" ? "bg-text" : "bg-accent"}`}
                      />
                      <span className="min-w-0 flex-1">{m.title}</span>
                      <span className="shrink-0 font-mono text-xs text-muted">{m.when}</span>
                    </button>
                    {open ? (
                      <div className="mt-1 mb-2 ml-[22px] text-sm text-muted">
                        <p>{m.story}</p>
                        {m.href ? (
                          <Link
                            href={m.href}
                            className="mt-1.5 inline-block font-mono text-xs text-link underline-offset-4 hover:underline"
                          >
                            See the proof →
                          </Link>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <ul className="sr-only">
          {monthTotals(weeks).map((m) => (
            <li key={m.key}>
              {m.label}: {m.total} contributions
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
