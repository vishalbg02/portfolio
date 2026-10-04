import "server-only";
import snapshot from "@/generated/github-snapshot.json";
import yearSnapshots from "@/generated/github-years.json";
import { profile } from "@/content/profile";
import { env } from "@/lib/env";
import { fetchActivity, fetchContributionCalendar } from "./api";
import { yearRange } from "./years";
import type { ContributionCalendar, GithubData } from "./types";

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

export type YearData = {
  year: number;
  source: "live" | "snapshot";
  generatedAt: string;
  calendar: ContributionCalendar;
};

/**
 * One calendar year (for the year switcher). Live when GITHUB_TOKEN is set (ISR, hourly), otherwise
 * the per-year snapshot committed by scripts/snapshot-github.mts; null when neither has that year.
 */
export async function getGithubYear(year: number, nowMs: number): Promise<YearData | null> {
  const snap = (yearSnapshots as { generatedAt: string; years: Record<string, ContributionCalendar> }).years[
    String(year)
  ];
  const fallback = snap
    ? { year, source: "snapshot" as const, generatedAt: yearSnapshots.generatedAt, calendar: snap }
    : null;
  const token = env.GITHUB_TOKEN;
  if (!token) return fallback;
  try {
    const calendar = await fetchContributionCalendar(
      githubLogin,
      token,
      { next: { revalidate: REVALIDATE } },
      yearRange(year, nowMs),
    );
    return { year, source: "live", generatedAt: new Date().toISOString(), calendar };
  } catch (err) {
    console.error("[github] year falling back to snapshot:", (err as Error).message);
    return fallback;
  }
}
