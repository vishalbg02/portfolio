"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import { track } from "@/lib/analytics";
import type { Milestone } from "@/lib/content/milestones";
import type { RoleSpan } from "@/lib/content/roles";
import { monthTotals } from "@/lib/github/calendar";
import { buildMarks, longDate, shortDate, type Mark } from "@/lib/github/marks";
import { busiest, peakDays } from "@/lib/github/peaks";
import { computeStreaks } from "@/lib/github/streaks";
import type { ContributionCalendar as Calendar } from "@/lib/github/types";
import { cn } from "@/lib/utils/cn";
import { relativeTime } from "@/lib/utils/relative-time";
import { CountUp } from "@/components/ui/CountUp";
import { ContributionCalendar } from "./ContributionCalendar";

type View = { calendar: Calendar; asOf: string; updated: string; scrollTo: "start" | "end" };
type Loaded = Record<string, View | "loading" | "error">;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthName = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
const addDays = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

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
  spans,
}: {
  initial: View;
  years: number[];
  milestones: Milestone[];
  spans: RoleSpan[];
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
  const peaks = useMemo(() => peakDays(days, 3), [days]);
  const { pins, bands } = useMemo(
    () => buildMarks({ weeks, milestones, spans, peaks }),
    [weeks, milestones, spans, peaks],
  );
  const high = useMemo(() => busiest(days), [days]);
  // Everything marked on this calendar, oldest first: the phone's tappable list.
  const inView = useMemo(
    () => [...bands, ...pins].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
    [bands, pins],
  );

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

      {peaks[0] || high.week || high.month ? (
        <dl
          aria-label="Highlights"
          className="mt-3 grid overflow-hidden rounded-card border border-border bg-surface sm:grid-cols-3 [&>div:not(:first-child)]:border-t [&>div:not(:first-child)]:border-border sm:[&>div:not(:first-child)]:border-t-0 sm:[&>div:not(:first-child)]:border-l"
        >
          {peaks[0] ? (
            <div className="min-w-0 p-4 sm:p-5">
              <dt className="font-mono text-[11px] tracking-[0.12em] text-accent uppercase">▲ Busiest day</dt>
              <dd className="mt-1.5">
                <button
                  type="button"
                  data-testid="busiest-day"
                  onClick={() => {
                    track("milestone_open", { kind: "peak" });
                    setSelectedId(`peak-${peaks[0]!.date}`);
                  }}
                  className="-m-1 min-h-11 rounded-sm p-1 text-left transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-link"
                >
                  <span className="text-lg font-semibold text-text tabular-nums">
                    {peaks[0].count} contributions
                  </span>
                  <span className="mt-0.5 block font-mono text-xs text-muted">
                    {longDate(peaks[0].date)} · show on the calendar
                  </span>
                </button>
              </dd>
            </div>
          ) : null}
          {high.week ? (
            <div className="min-w-0 p-4 sm:p-5">
              <dt className="font-mono text-[11px] tracking-[0.12em] text-muted uppercase">Best week</dt>
              <dd className="mt-1.5">
                <span className="text-lg font-semibold text-text tabular-nums">
                  {high.week.total} contributions
                </span>
                <span className="mt-0.5 block font-mono text-xs text-muted">
                  {shortDate(high.week.start)} – {shortDate(addDays(high.week.start, 6))}
                </span>
              </dd>
            </div>
          ) : null}
          {high.month ? (
            <div className="min-w-0 p-4 sm:p-5">
              <dt className="font-mono text-[11px] tracking-[0.12em] text-muted uppercase">
                Most active month
              </dt>
              <dd className="mt-1.5">
                <span className="text-lg font-semibold text-text tabular-nums">
                  {high.month.total} contributions
                </span>
                <span className="mt-0.5 block font-mono text-xs text-muted">{monthName(high.month.key)}</span>
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <div
        className="mt-4 rounded-card border border-border bg-surface p-4 sm:p-5"
        aria-busy={status === "loading"}
      >
        <div className={cn("transition-opacity", status ? "opacity-50" : "")}>
          <ContributionCalendar
            key={shownKey}
            weeks={weeks}
            pins={pins}
            bands={bands}
            scrollTo={view.scrollTo}
            selectedId={selectedId}
            label={`${view.calendar.total} contributions, ${period}. ${activeDays} active days, longest streak ${unit(longest)}.${peaks[0] ? ` Busiest day ${longDate(peaks[0].date)} with ${peaks[0].count} contributions.` : ""}${inView.length ? ` ${inView.length} marks: roles, awards and peak days.` : ""}`}
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
            <h3 className="mb-2 font-mono text-[11px] tracking-[0.12em] text-muted uppercase">
              On this calendar
            </h3>
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
                      <MarkGlyph kind={m.kind} />
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

function MarkGlyph({ kind }: { kind: Mark["kind"] }) {
  if (kind === "peak")
    return (
      <span
        aria-hidden="true"
        className="h-2.5 w-3 shrink-0 bg-accent [clip-path:polygon(50%_0,100%_100%,0_100%)]"
      />
    );
  if (kind === "role") return <span aria-hidden="true" className="h-1.5 w-3 shrink-0 rounded-sm bg-grid-2" />;
  return <span aria-hidden="true" className="size-2.5 shrink-0 rotate-45 bg-text" />;
}
