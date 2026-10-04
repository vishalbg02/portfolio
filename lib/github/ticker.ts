import type { ActivityItem } from "./types";

/** One short, safe line of text from a commit message or description: no control characters, one space between words, cut at `max`. */
export function tickerText(text: string, max = 56): string {
  const clean = text
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

export type Ticker = { repo: string; text: string; url: string; at: string };

/** The latest activity as the nav's ticker, or null when there is none (then nothing is shown). */
export function latestTicker(activity: ActivityItem[]): Ticker | null {
  const a = activity[0];
  if (!a || !a.repo || !Number.isFinite(Date.parse(a.at))) return null;
  if (!/^https:\/\/github\.com\//.test(a.url)) return null;
  return { repo: tickerText(a.repo, 28), text: tickerText(a.text), url: a.url, at: a.at };
}
