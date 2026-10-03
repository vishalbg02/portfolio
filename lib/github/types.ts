export type ContributionLevel = 0 | 1 | 2 | 3 | 4;

export type ContributionDay = { date: string; count: number; level: ContributionLevel };

export type ContributionCalendar = {
  total: number;
  /** Oldest → newest; each week is up to 7 days (Sun → Sat). */
  weeks: ContributionDay[][];
};

export type ActivityItem = {
  repo: string;
  url: string;
  /** Commit message (first line) or the repository description. */
  text: string;
  at: string;
};

export type GithubData = {
  login: string;
  /** "live" = fetched with a token during this ISR cycle; "snapshot" = committed JSON. */
  source: "live" | "snapshot";
  generatedAt: string;
  calendar: ContributionCalendar;
  activity: ActivityItem[];
};
