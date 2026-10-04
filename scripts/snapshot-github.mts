/**
 * pnpm snapshot:github
 * Refreshes generated/github-snapshot.json (the last-year view) and generated/github-years.json
 * (one calendar per year, for the year switcher). Both are the fallback shown when GITHUB_TOKEN isn't set.
 * Needs a token for the GraphQL contribution calendar:  GITHUB_TOKEN=ghp_… pnpm snapshot:github
 * (a token with NO scopes is enough — it only reads public data). Commit the result.
 */
import { writeFileSync } from "node:fs";
import { fetchActivity, fetchContributionCalendar } from "@/lib/github/api";
import { activityYears, yearRange } from "@/lib/github/years";
import { milestones } from "@/lib/content/milestones";
import { profile } from "@/content/profile";

const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error(
    "Set GITHUB_TOKEN to refresh the snapshot, e.g.  GITHUB_TOKEN=$(gh auth token) pnpm snapshot:github",
  );
  process.exit(1);
}
const login = new URL(profile.contact.github).pathname.replace(/\//g, "");
const now = Date.now();
const earliest = Math.min(...milestones().map((m) => Number(m.date.slice(0, 4))));
const years = activityYears(now, earliest);

const [calendar, activity, ...yearCals] = await Promise.all([
  fetchContributionCalendar(login, token),
  fetchActivity(login, token),
  ...years.map((y) => fetchContributionCalendar(login, token, {}, yearRange(y, now))),
]);
const generatedAt = new Date(now).toISOString();
writeFileSync(
  "generated/github-snapshot.json",
  JSON.stringify({ login, source: "snapshot", generatedAt, calendar, activity }, null, 2) + "\n",
);
writeFileSync(
  "generated/github-years.json",
  JSON.stringify(
    { generatedAt, years: Object.fromEntries(years.map((y, i) => [String(y), yearCals[i]])) },
    null,
    2,
  ) + "\n",
);
console.log(
  `✓ github-snapshot.json — ${calendar.total} contributions, ${activity.length} recent items · github-years.json — ` +
    years.map((y, i) => `${y}: ${yearCals[i]!.total}`).join(", "),
);
