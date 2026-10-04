import { describe, expect, it } from "vitest";
import { profile } from "@/content/profile";
import { milestones } from "@/lib/content/milestones";
import { assignTiers, pinsFor } from "@/lib/github/pins";
import type { ContributionDay } from "@/lib/github/types";

/** Sunday-aligned weeks covering [from, to]. */
function weeks(from: string, to: string): ContributionDay[][] {
  const out: ContributionDay[][] = [];
  const end = Date.parse(`${to}T00:00:00Z`);
  let cur: ContributionDay[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= end; t += 86_400_000) {
    const date = new Date(t).toISOString().slice(0, 10);
    cur.push({ date, count: 0, level: 0 });
    if (new Date(t).getUTCDay() === 6) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

describe("milestones", () => {
  const all = milestones();
  it("pins every award and every role start, with month-level dates only", () => {
    expect(all.filter((m) => m.kind === "award")).toHaveLength(profile.recognition.length);
    expect(all.filter((m) => m.kind === "role")).toHaveLength(profile.experience.length);
    for (const m of all) expect(m.date).toMatch(/^\d{4}-\d{2}$/);
  });
  it("uses the one 'Event — Nth Place' format for awards", () => {
    const titles = all.filter((m) => m.kind === "award").map((m) => m.title);
    expect(titles).toContain("Innovation Sprint 2026 — 2nd Place");
    expect(titles).toContain("24-Hour Hackathon 2026 — 2nd Place");
    expect(titles.every((t) => /^.+ — (1st|2nd|3rd) Place$/.test(t))).toBe(true);
  });
  it("is sorted oldest first and ids are unique", () => {
    expect(all.map((m) => m.date)).toEqual([...all.map((m) => m.date)].sort());
    expect(new Set(all.map((m) => m.id)).size).toBe(all.length);
  });
  it("links proof only to pages that exist", () => {
    const slugs = profile.projects.map((p) => `/work/${p.slug}`);
    for (const m of all) if (m.href) expect(slugs).toContain(m.href);
  });
});

describe("pinsFor", () => {
  it("pins a month to the first day of that month the calendar shows", () => {
    const w = weeks("2025-09-28", "2026-10-03");
    const feb = milestones().find((m) => m.date === "2026-02")!;
    const [pin] = pinsFor(w, [feb]);
    expect(w[pin!.week]![0]!.date <= "2026-02-01").toBe(true);
    expect(pin!.day).toBe(0); // 1 Feb 2026 is a Sunday
  });
  it("skips milestones outside the window", () => {
    const w = weeks("2025-09-28", "2026-10-03");
    const aug24 = milestones().find((m) => m.date === "2024-08")!;
    expect(pinsFor(w, [aug24])).toEqual([]);
  });
  it("handles a partial first week by day-of-week, not array index", () => {
    const w = weeks("2024-05-01", "2024-12-31"); // starts on a Wednesday
    const [pin] = pinsFor(
      w,
      milestones().filter((m) => m.date === "2024-05"),
    );
    expect(pin!.day).toBe(3);
  });
});

describe("assignTiers", () => {
  const p = (week: number) => ({ week });
  it("keeps distant labels on one tier and stacks close ones", () => {
    const res = assignTiers(
      [p(0), p(5), p(40)],
      (q) => q.week * 14,
      () => 100,
    );
    expect(res.map((r) => r.tier)).toEqual([0, 1, 0]);
  });
  it("reuses a tier once its last label has ended", () => {
    const res = assignTiers(
      [p(0), p(2), p(9)],
      (q) => q.week * 14,
      () => 100,
    );
    expect(res.map((r) => r.tier)).toEqual([0, 1, 0]);
  });
});
