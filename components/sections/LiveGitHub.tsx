import { SectionHeader } from "@/components/ui/SectionHeader";
import { profile } from "@/content/profile";
import { monthTotals } from "@/lib/github/calendar";
import { getGithubData } from "@/lib/github/data";
import { computeStreaks } from "@/lib/github/streaks";
import { nowMs } from "@/lib/utils/now";
import { relativeTime } from "@/lib/utils/relative-time";
import { ContributionCalendar } from "./ContributionCalendar";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const Stat = ({ value, label }: { value: string; label: string }) => (
  <div className="min-w-0 p-4 sm:p-5">
    <dt className="font-mono text-[11px] tracking-[0.12em] text-muted uppercase">{label}</dt>
    <dd className="mt-1.5 text-2xl font-semibold text-text tabular-nums">{value}</dd>
  </div>
);

/** Live GitHub: native contribution calendar, streaks, latest activity. ISR hourly; snapshot fallback. */
export async function LiveGitHub() {
  const data = await getGithubData();
  const now = nowMs();
  const days = data.calendar.weeks.flat();
  const asOf =
    data.source === "live" ? new Date(now).toISOString().slice(0, 10) : data.generatedAt.slice(0, 10);
  const { current, longest } = computeStreaks(days, asOf);
  const unit = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

  return (
    <section id="github" aria-labelledby="github-label" className="container-page py-16 md:py-24">
      <SectionHeader prefix=">_" label="Activity" id="github-label" title="Live from GitHub" />

      <dl className="grid overflow-hidden rounded-card border border-border bg-surface sm:grid-cols-3 [&>div:not(:first-child)]:border-t [&>div:not(:first-child)]:border-border sm:[&>div:not(:first-child)]:border-t-0 sm:[&>div:not(:first-child)]:border-l">
        <Stat value={data.calendar.total.toLocaleString("en-US")} label="Contributions, last year" />
        <Stat value={unit(current)} label="Current streak" />
        <Stat value={unit(longest)} label="Longest streak" />
      </dl>

      <div className="mt-4 rounded-card border border-border bg-surface p-4 sm:p-5">
        <ContributionCalendar
          weeks={data.calendar.weeks}
          label={`${data.calendar.total} contributions in the last year. Current streak ${unit(current)}, longest streak ${unit(longest)}.`}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 font-mono text-xs text-muted">
          <span>
            {data.source === "live"
              ? "Live · refreshed hourly"
              : `Snapshot · ${dateFmt.format(new Date(data.generatedAt))}`}
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
        <ul className="sr-only">
          {monthTotals(data.calendar.weeks).map((m) => (
            <li key={m.key}>
              {m.label}: {m.total} contributions
            </li>
          ))}
        </ul>
      </div>

      <h3 className="mt-10 mb-3 font-mono text-xs tracking-[0.12em] text-muted uppercase">Latest activity</h3>
      <ul className="divide-y divide-border rounded-card border border-border bg-surface">
        {data.activity.map((a) => (
          <li key={a.repo}>
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-surface-2 sm:flex-row sm:items-baseline sm:gap-4"
            >
              <span className="shrink-0 font-mono text-sm text-link sm:w-52 sm:truncate">{a.repo}</span>
              <span className="min-w-0 flex-1 text-sm text-muted sm:truncate">{a.text}</span>
              <time
                dateTime={a.at}
                title={dateFmt.format(new Date(a.at))}
                className="shrink-0 font-mono text-xs text-muted"
              >
                {relativeTime(a.at, now)}
              </time>
              <span className="sr-only"> (opens GitHub in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-4">
        <a
          href={profile.contact.github}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-sm text-link underline-offset-4 hover:underline"
        >
          github.com/{data.login} <span aria-hidden="true">↗</span>
        </a>
      </p>
    </section>
  );
}
