import "server-only";
import snapshot from "@/generated/github-snapshot.json";
import { profile } from "@/content/profile";
import { env } from "@/lib/env";
import { fetchActivity, fetchContributionCalendar } from "./api";
import type { GithubData } from "./types";

const REVALIDATE = 3600; // ISR: at most once an hour

export const githubLogin = new URL(profile.contact.github).pathname.replace(/\//g, "");

/**
 * Live data when GITHUB_TOKEN is set (refreshed hourly via ISR). Without a token — or if GitHub is
 * unreachable — the committed snapshot (scripts/snapshot-github.mts) is used, so the section never breaks.
 */
export async function getGithubData(): Promise<GithubData> {
  const fallback = { ...(snapshot as GithubData), source: "snapshot" as const };
  const token = env.GITHUB_TOKEN;
  if (!token) return fallback;
  try {
    const init = { next: { revalidate: REVALIDATE } };
    const [calendar, activity] = await Promise.all([
      fetchContributionCalendar(githubLogin, token, init),
      fetchActivity(githubLogin, token, init),
    ]);
    return { login: githubLogin, source: "live", generatedAt: new Date().toISOString(), calendar, activity };
  } catch (err) {
    console.error("[github] falling back to snapshot:", (err as Error).message);
    return fallback;
  }
}
