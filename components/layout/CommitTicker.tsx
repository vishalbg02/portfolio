"use client";

import { useMinute } from "@/lib/hooks/use-minute";
import type { Ticker } from "@/lib/github/ticker";
import { relativeTime } from "@/lib/utils/relative-time";

/**
 * The nav's ticker: the latest thing he did on GitHub ("portfolio: Everything Ships … · 2 hours ago"). The text comes
 * from the GitHub data the page already has (sanitised and cut short by `latestTicker`); only the "2 hours ago" is worked
 * out in the browser, so the page can stay static. Shown from lg up, under the wordmark, where it takes no room.
 */
export function CommitTicker({ ticker }: { ticker: Ticker }) {
  const now = useMinute();
  return (
    <a
      href={ticker.url}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="commit-ticker"
      title={`${ticker.repo}: ${ticker.text}`}
      className="mt-1 hidden max-w-[330px] items-center gap-1.5 font-mono text-[11px] leading-none text-muted transition-colors hover:text-text lg:flex"
    >
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-[1px] bg-accent" />
      <span className="truncate">
        {ticker.repo}: {ticker.text}
      </span>
      <span className="inline-block min-w-[9ch] shrink-0" suppressHydrationWarning>
        {now === null ? "" : `· ${relativeTime(ticker.at, now)}`}
      </span>
    </a>
  );
}
