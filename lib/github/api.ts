import type { ActivityItem, ContributionCalendar, ContributionLevel } from "./types";

const LEVELS: Record<string, ContributionLevel> = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

const QUERY = `query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount contributionLevel } }
      }
    }
  }
}`;

type Init = RequestInit & { next?: { revalidate: number } };

/** GraphQL contribution calendar for the last year. Requires a token (read-only public data is enough). */
export async function fetchContributionCalendar(
  login: string,
  token: string,
  init: Init = {},
): Promise<ContributionCalendar> {
  const res = await fetch("https://api.github.com/graphql", {
    ...init,
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "vishalbg-portfolio",
    },
    body: JSON.stringify({ query: QUERY, variables: { login } }),
  });
  if (!res.ok) throw new Error(`GitHub GraphQL ${res.status}`);
  const json = (await res.json()) as {
    data?: {
      user?: {
        contributionsCollection: {
          contributionCalendar: {
            totalContributions: number;
            weeks: Array<{
              contributionDays: Array<{ date: string; contributionCount: number; contributionLevel: string }>;
            }>;
          };
        };
      };
    };
    errors?: Array<{ message: string }>;
  };
  const cal = json.data?.user?.contributionsCollection.contributionCalendar;
  if (!cal) throw new Error(json.errors?.[0]?.message ?? "No contribution data");
  return {
    total: cal.totalContributions,
    weeks: cal.weeks.map((w) =>
      w.contributionDays.map((d) => ({
        date: d.date,
        count: d.contributionCount,
        level: LEVELS[d.contributionLevel] ?? 0,
      })),
    ),
  };
}

type PushEvent = {
  type: string;
  repo: { name: string };
  created_at: string;
  payload?: { commits?: Array<{ message?: string }> };
};
type Repo = {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  pushed_at: string | null;
  fork: boolean;
};

const firstLine = (s: string) => s.split("\n")[0]!.trim();

/** Merges recent public push events with repo descriptions into a short "latest activity" list. */
export function buildActivity(events: PushEvent[], repos: Repo[], limit = 5): ActivityItem[] {
  const byFullName = new Map(repos.map((r) => [r.full_name, r]));
  const items: ActivityItem[] = [];
  const seen = new Set<string>();

  for (const e of events) {
    if (e.type !== "PushEvent" || seen.has(e.repo.name)) continue;
    const repo = byFullName.get(e.repo.name);
    const message = e.payload?.commits?.at(-1)?.message;
    seen.add(e.repo.name);
    items.push({
      repo: e.repo.name.split("/")[1] ?? e.repo.name,
      url: repo?.html_url ?? `https://github.com/${e.repo.name}`,
      text: message ? firstLine(message) : (repo?.description ?? "Pushed new commits"),
      at: e.created_at,
    });
  }
  // Top up with recently pushed repos that had no event in the window.
  for (const r of repos) {
    if (items.length >= limit) break;
    if (seen.has(r.full_name) || !r.pushed_at) continue;
    seen.add(r.full_name);
    items.push({ repo: r.name, url: r.html_url, text: r.description ?? "Updated", at: r.pushed_at });
  }
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

export async function fetchActivity(login: string, token?: string, init: Init = {}): Promise<ActivityItem[]> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "vishalbg-portfolio",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const [eventsRes, reposRes] = await Promise.all([
    fetch(`https://api.github.com/users/${login}/events/public?per_page=50`, { ...init, headers }),
    fetch(`https://api.github.com/users/${login}/repos?sort=pushed&per_page=10&type=owner`, {
      ...init,
      headers,
    }),
  ]);
  if (!eventsRes.ok || !reposRes.ok) throw new Error(`GitHub REST ${eventsRes.status}/${reposRes.status}`);
  return buildActivity((await eventsRes.json()) as PushEvent[], (await reposRes.json()) as Repo[]);
}
