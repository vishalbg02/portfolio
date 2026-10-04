import { describe, expect, it } from "vitest";
import { latestTicker, tickerText } from "@/lib/github/ticker";
import { NIGHT_STATUS, isNight, istHourOf } from "@/lib/night";

const at = (iso: string) => Date.parse(iso);

describe("night mode", () => {
  it("is from midnight to 7 in the morning in Bengaluru (UTC+5:30), and not otherwise", () => {
    expect(istHourOf(at("2026-10-04T18:30:00Z"))).toBe(0);
    expect(isNight(at("2026-10-04T18:30:00Z"))).toBe(true); // 00:00 IST
    expect(isNight(at("2026-10-05T00:59:00Z"))).toBe(true); // 06:29 IST
    expect(isNight(at("2026-10-05T01:30:00Z"))).toBe(false); // 07:00 IST
    expect(isNight(at("2026-10-05T12:00:00Z"))).toBe(false); // 17:30 IST
    expect(isNight(at("2026-10-05T18:29:00Z"))).toBe(false); // 23:59 IST
  });

  it("does not depend on the visitor's own time zone", () => {
    const t = at("2026-01-15T20:00:00Z"); // 01:30 IST the next morning
    expect(isNight(t)).toBe(true);
    expect(istHourOf(t)).toBe(1);
  });

  it("says GRID is on duty", () => {
    expect(NIGHT_STATUS).toContain("GRID is on duty");
    expect(NIGHT_STATUS).toContain("asleep");
  });
});

describe("ticker", () => {
  it("strips control characters and extra spaces and cuts at a word", () => {
    expect(tickerText("fix:\n  the\tbug\u0000 now")).toBe("fix: the bug now");
    const long = "A very long commit message that goes on and on and on past any reasonable width for a nav";
    const cut = tickerText(long, 40);
    expect(cut.length).toBeLessThanOrEqual(40);
    expect(cut.endsWith("…")).toBe(true);
    expect(long.startsWith(cut.slice(0, -1))).toBe(true);
    expect(tickerText("short")).toBe("short");
  });

  it("takes the newest activity, and only when it is complete and from github.com", () => {
    const item = {
      repo: "portfolio",
      url: "https://github.com/vishalbg02/portfolio",
      text: "fix: x",
      at: "2026-10-04T02:15:55Z",
    };
    expect(latestTicker([item, { ...item, repo: "other" }])).toEqual({ ...item });
    expect(latestTicker([])).toBeNull();
    expect(latestTicker([{ ...item, at: "not a date" }])).toBeNull();
    expect(latestTicker([{ ...item, url: "https://evil.example/portfolio" }])).toBeNull();
    expect(latestTicker([{ ...item, repo: "" }])).toBeNull();
  });
});
