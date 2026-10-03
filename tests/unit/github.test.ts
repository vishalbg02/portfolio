import { describe, expect, it } from "vitest";
import snapshot from "@/generated/github-snapshot.json";
import { buildActivity } from "@/lib/github/api";
import { describeDay, monthLabels, monthTotals } from "@/lib/github/calendar";
import { computeStreaks } from "@/lib/github/streaks";
import type { ContributionDay, GithubData } from "@/lib/github/types";
import { relativeTime } from "@/lib/utils/relative-time";

const day = (date: string, count: number): ContributionDay => ({
  date,
  count,
  level: count === 0 ? 0 : count > 5 ? 4 : 2,
});
const run = (start: string, counts: number[]) =>
  counts.map((c, i) =>
    day(new Date(Date.parse(`${start}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10), c),
  );

describe("computeStreaks", () => {
  it("counts the current streak ending today", () => {
    const days = run("2026-09-20", [1, 2, 0, 3, 1, 1, 4]); // 20..26
    expect(computeStreaks(days, "2026-09-26")).toEqual({ current: 4, longest: 4 });
  });

  it("does not break the current streak when today is still zero", () => {
    const days = run("2026-09-20", [1, 1, 1, 1, 0]); // today (24th) has no commits yet
    expect(computeStreaks(days, "2026-09-24").current).toBe(4);
  });

  it("breaks the current streak after a full missed day", () => {
    const days = run("2026-09-20", [1, 1, 1, 0, 0]);
    expect(computeStreaks(days, "2026-09-24").current).toBe(0);
    expect(computeStreaks(days, "2026-09-24").longest).toBe(3);
  });

  it("finds the longest streak anywhere in the year", () => {
    const days = run("2026-01-01", [1, 1, 1, 1, 1, 0, 1, 1, 0, 1]);
    expect(computeStreaks(days).longest).toBe(5);
  });

  it("handles empty and all-zero input", () => {
    expect(computeStreaks([])).toEqual({ current: 0, longest: 0 });
    expect(computeStreaks(run("2026-01-01", [0, 0, 0]))).toEqual({ current: 0, longest: 0 });
  });

  it("handles month and year boundaries", () => {
    const days = run("2025-12-30", [1, 1, 1, 1]); // 30, 31, 1, 2
    expect(computeStreaks(days, "2026-01-02")).toEqual({ current: 4, longest: 4 });
  });

  it("works on the committed snapshot", () => {
    const data = snapshot as unknown as GithubData;
    const s = computeStreaks(data.calendar.weeks.flat(), data.generatedAt.slice(0, 10));
    expect(s.longest).toBeGreaterThanOrEqual(s.current);
    expect(s.longest).toBeGreaterThan(0);
  });
});

describe("snapshot", () => {
  const data = snapshot as unknown as GithubData;
  it("has a full year of weeks with 7-day columns and a matching total", () => {
    expect(data.calendar.weeks.length).toBeGreaterThanOrEqual(52);
    expect(data.calendar.weeks.slice(0, -1).every((w) => w.length === 7)).toBe(true);
    expect(data.calendar.weeks.flat().reduce((n, d) => n + d.count, 0)).toBe(data.calendar.total);
  });
  it("only contains public, link-able activity", () => {
    expect(data.activity.length).toBeGreaterThan(0);
    for (const a of data.activity) expect(a.url).toMatch(/^https:\/\/github\.com\/vishalbg02\//);
  });
});

describe("calendar helpers", () => {
  it("describes days with pluralisation", () => {
    expect(describeDay(day("2026-09-28", 0))).toBe("No contributions on Mon, 28 Sep 2026");
    expect(describeDay(day("2026-09-28", 1))).toBe("1 contribution on Mon, 28 Sep 2026");
    expect(describeDay(day("2026-09-28", 3))).toBe("3 contributions on Mon, 28 Sep 2026");
  });
  it("never drops a month because a short partial month precedes it", () => {
    // 53 weeks starting Sun 28 Sep 2025: Sep is a 1-week stub, so Oct must still be labelled.
    const weeks = Array.from({ length: 53 }, (_, i) =>
      run(
        new Date(Date.UTC(2025, 8, 28) + i * 7 * 86_400_000).toISOString().slice(0, 10),
        [1, 1, 1, 1, 1, 1, 1],
      ),
    );
    const labels = monthLabels(weeks).map((m) => m.label);
    expect(labels[0]).toBe("Oct");
    expect(labels).toContain("Nov");
    expect(new Set(labels).size).toBe(labels.length - (labels.at(-1) === labels[0] ? 1 : 0));
    expect(labels.length).toBeGreaterThanOrEqual(12);
  });
  it("labels each month once and totals by month", () => {
    const weeks = [
      run("2026-08-30", [1, 1, 1, 1, 1, 1, 1]),
      run("2026-09-06", [2, 2, 2, 2, 2, 2, 2]),
      run("2026-09-13", [0, 0, 0, 0, 0, 0, 0]),
    ];
    expect(monthLabels(weeks).map((m) => m.label)).toEqual(["Sep"]); // partial Aug week is replaced by Sep
    const totals = monthTotals(weeks);
    expect(totals.find((t) => t.key === "2026-09")!.total).toBe(2 * 7 + 1 * 5);
  });
});

describe("buildActivity", () => {
  const repos = [
    {
      name: "portfolio",
      full_name: "u/portfolio",
      html_url: "https://github.com/u/portfolio",
      description: "My site",
      pushed_at: "2026-10-02T10:00:00Z",
      fork: false,
    },
    {
      name: "old",
      full_name: "u/old",
      html_url: "https://github.com/u/old",
      description: null,
      pushed_at: "2026-01-01T00:00:00Z",
      fork: false,
    },
  ];
  it("prefers the commit message, falls back to the description, dedupes repos and sorts newest first", () => {
    const events = [
      {
        type: "PushEvent",
        repo: { name: "u/portfolio" },
        created_at: "2026-10-03T08:00:00Z",
        payload: { commits: [{ message: "feat: add thing\n\nbody" }] },
      },
      { type: "WatchEvent", repo: { name: "x/y" }, created_at: "2026-10-03T07:00:00Z" },
      {
        type: "PushEvent",
        repo: { name: "u/portfolio" },
        created_at: "2026-10-01T08:00:00Z",
        payload: { commits: [{ message: "older" }] },
      },
    ];
    const out = buildActivity(events, repos);
    expect(out[0]).toMatchObject({ repo: "portfolio", text: "feat: add thing" });
    expect(out.filter((a) => a.repo === "portfolio")).toHaveLength(1);
    expect(out.map((a) => a.at)).toEqual([...out.map((a) => a.at)].sort().reverse());
  });
  it("uses the repo description when a push has no commit payload", () => {
    const out = buildActivity(
      [{ type: "PushEvent", repo: { name: "u/portfolio" }, created_at: "2026-10-03T08:00:00Z" }],
      repos,
    );
    expect(out[0]!.text).toBe("My site");
  });
});

describe("relativeTime", () => {
  const now = Date.parse("2026-10-03T12:00:00Z");
  it.each([
    ["2026-10-03T11:59:40Z", "just now"],
    ["2026-10-03T11:30:00Z", "30 minutes ago"],
    ["2026-10-03T09:00:00Z", "3 hours ago"],
    ["2026-10-02T12:00:00Z", "yesterday"],
    ["2026-09-26T12:00:00Z", "last week"],
    ["2026-07-03T12:00:00Z", "3 months ago"],
  ])("%s → %s", (iso, expected) => {
    expect(relativeTime(iso, now)).toBe(expected);
  });
  it("returns an empty string for invalid dates", () => {
    expect(relativeTime("nope", now)).toBe("");
  });
});
