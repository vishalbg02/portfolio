/**
 * pnpm snapshot:github
 * Refreshes generated/github-snapshot.json (the fallback shown when GITHUB_TOKEN isn't set).
 * Needs a token for the GraphQL contribution calendar:  GITHUB_TOKEN=ghp_… pnpm snapshot:github
 * (a token with NO scopes is enough — it only reads public data). Commit the result.
 */
import { writeFileSync } from "node:fs";
import { fetchActivity, fetchContributionCalendar } from "@/lib/github/api";
import { profile } from "@/content/profile";

const token = process.env.GITHUB_TOKEN;
if (!token) {
  console.error(
    "Set GITHUB_TOKEN to refresh the snapshot, e.g.  GITHUB_TOKEN=$(gh auth token) pnpm snapshot:github",
  );
  process.exit(1);
}
const login = new URL(profile.contact.github).pathname.replace(/\//g, "");
const [calendar, activity] = await Promise.all([
  fetchContributionCalendar(login, token),
  fetchActivity(login, token),
]);
const data = { login, source: "snapshot", generatedAt: new Date().toISOString(), calendar, activity };
writeFileSync("generated/github-snapshot.json", JSON.stringify(data, null, 2) + "\n");
console.log(
  `✓ generated/github-snapshot.json — ${calendar.total} contributions, ${activity.length} recent items`,
);
