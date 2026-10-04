import { SectionHeader } from "@/components/ui/SectionHeader";
import { profile } from "@/content/profile";
import { getGithubData } from "@/lib/github/data";
import { activityYears } from "@/lib/github/years";
import { milestones } from "@/lib/content/milestones";
import { roleSpans } from "@/lib/content/roles";
import { features } from "@/lib/env";
import { computeStreaks } from "@/lib/github/streaks";
import { nowMs } from "@/lib/utils/now";
import { relativeTime } from "@/lib/utils/relative-time";
import { ActivityLoader } from "./ActivityLoader";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** Live GitHub: native contribution calendar, streaks, latest activity. ISR hourly; snapshot fallback. */
export async function LiveGitHub() {
  const data = await getGithubData();
  const now = nowMs();
  const asOf =
    data.source === "live" ? new Date(now).toISOString().slice(0, 10) : data.generatedAt.slice(0, 10);
  // Award pins can be switched off with SHOW_RECOGNITION=false; role bands and peak days stay.
  const pins = milestones().filter((m) => features.recognition || m.kind !== "award");
  const spans = roleSpans();
  const years = activityYears(
    now,
    Math.min(
      ...pins.map((m) => Number(m.date.slice(0, 4))),
      ...spans.map((s) => Number(s.start.slice(0, 4))),
    ),
  );

  // The numbers also go in the HTML as the placeholder text while the calendar island loads.
  const days = data.calendar.weeks.flat();
  const longest = computeStreaks(days, asOf).longest;
  const summary = `${data.calendar.total.toLocaleString("en-US")} contributions in the last year · ${
    days.filter((d) => d.count > 0).length
  } active days · longest streak ${longest} ${longest === 1 ? "day" : "days"}`;

  return (
    <section id="github" aria-labelledby="github-label" className="container-page section-y">
      <SectionHeader prefix=">_" label="Activity" id="github-label" title="Live from GitHub" />

      <ActivityLoader
        summary={summary}
        initial={{
          calendar: data.calendar,
          asOf,
          scrollTo: "end",
          updated:
            data.source === "live"
              ? "Live · refreshed hourly"
              : `Updated ${relativeTime(data.generatedAt, now)}`,
        }}
        years={years}
        milestones={pins}
        spans={spans}
      />

      {profile.leadership.map((l) => (
        <p key={l} className="mt-4 max-w-3xl text-sm text-muted">
          {l}
        </p>
      ))}

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
