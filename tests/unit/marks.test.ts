import { describe, expect, it } from "vitest";
import { profile } from "@/content/profile";
import { milestones } from "@/lib/content/milestones";
import { roleOn, roleSpans } from "@/lib/content/roles";
import { busiest, peakDays } from "@/lib/github/peaks";
import { assignLanes, bandColumns, buildMarks } from "@/lib/github/marks";
import type { ContributionDay } from "@/lib/github/types";

/** Sunday-aligned weeks covering [from, to], with a count per date from `counts`. */
function weeks(from: string, to: string, counts: Record<string, number> = {}): ContributionDay[][] {
  const out: ContributionDay[][] = [];
  const end = Date.parse(`${to}T00:00:00Z`);
  let cur: ContributionDay[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= end; t += 86_400_000) {
    const date = new Date(t).toISOString().slice(0, 10);
    const count = counts[date] ?? 0;
    cur.push({ date, count, level: count === 0 ? 0 : 2 });
    if (new Date(t).getUTCDay() === 6) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

describe("peak days", () => {
  const days = weeks("2026-01-04", "2026-03-28", {
    "2026-02-10": 40,
    "2026-03-03": 55,
    "2026-01-20": 9,
    "2026-03-20": 55,
  }).flat();
  it("picks the busiest days, ties to the more recent, ignoring empty days", () => {
    expect(peakDays(days, 3)).toEqual([
      { date: "2026-03-20", count: 55, rank: 1 },
      { date: "2026-03-03", count: 55, rank: 2 },
      { date: "2026-02-10", count: 40, rank: 3 },
    ]);
    expect(peakDays(weeks("2026-01-04", "2026-01-31").flat())).toEqual([]);
  });
  it("finds the busiest Mon–Sun week and month", () => {
    const b = busiest(days);
    expect(b.month).toEqual({ key: "2026-03", total: 110 });
    expect(b.week?.total).toBe(55);
    expect(busiest([]).week).toBeNull();
  });
});

describe("role bands", () => {
  const w = weeks("2025-10-05", "2026-10-03");
  it("spans from the start month's first week to the end month's last week", () => {
    const c = bandColumns(w, { start: "2026-01", end: "2026-05" })!;
    expect(w[c.from]!.some((d) => d.date.startsWith("2026-01"))).toBe(true);
    expect(w[c.to]!.some((d) => d.date.startsWith("2026-05"))).toBe(true);
    expect(c.cutLeft || c.cutRight).toBe(false);
  });
  it("clips a role that began before the window and drops one entirely outside", () => {
    const c = bandColumns(w, { start: "2025-06", end: "2026-03" })!;
    expect(c).toMatchObject({ from: 0, cutLeft: true, cutRight: false });
    expect(bandColumns(w, { start: "2024-05", end: "2024-07" })).toBeNull();
  });
  it("an open role runs to the right edge", () => {
    expect(bandColumns(w, { start: "2026-08", end: null })).toMatchObject({
      to: w.length - 1,
      cutRight: true,
    });
  });
  it("overlapping bands get separate lanes, and a free lane is reused", () => {
    const l = assignLanes([
      { from: 0, to: 20 },
      { from: 10, to: 30 },
      { from: 25, to: 40 },
    ]);
    expect(l.map((b) => b.lane)).toEqual([0, 1, 0]);
  });
  it("derives a span for every role in profile.ts", () => {
    const spans = roleSpans();
    expect(spans).toHaveLength(profile.experience.length);
    expect(spans.find((s) => s.label === "Golden Verdict")).toMatchObject({
      start: "2026-01",
      end: "2026-05",
      kind: "freelance",
    });
    expect(roleOn("2026-02-14", spans)?.label).toBeTruthy();
    expect(roleOn("2020-01-01", spans)).toBeNull();
  });
});

describe("buildMarks", () => {
  const w = weeks("2025-10-05", "2026-10-03", { "2026-03-20": 80, "2025-12-02": 42 });
  const days = w.flat();
  const { pins, bands } = buildMarks({
    weeks: w,
    milestones: milestones(),
    spans: roleSpans(),
    peaks: peakDays(days, 3),
  });
  it("pins peak days on their exact cell, with the role they fell in", () => {
    const peak = pins.find((p) => p.id === "peak-2026-03-20")!;
    expect(w[peak.week!]!.find((d) => d.date === "2026-03-20")).toBeTruthy();
    expect(peak.title).toBe("Busiest day: 80 contributions");
    expect(peak.story).toMatch(/during the .+ (internship|freelance role)/);
    expect(peak.short).toBe("▲ 80 · 20 Mar");
  });
  it("pins awards on their month and draws roles as bands", () => {
    expect(pins.filter((p) => p.kind === "award").map((p) => p.title)).toContain(
      "24-Hour Hackathon 2026 — 2nd Place",
    );
    expect(bands.map((b) => b.short).sort()).toEqual(["Golden Verdict", "Social Agent"]);
    expect(new Set(bands.map((b) => b.lane)).size).toBe(2); // the two roles overlap Jan–Mar 2026
  });
  it("is empty-safe", () => {
    expect(buildMarks({ weeks: [], milestones: [], spans: [], peaks: [] })).toEqual({ pins: [], bands: [] });
  });
});

describe("client bundle hygiene", () => {
  it("the modules the activity calendar imports at runtime don't pull profile.ts (and its Zod schema) into the browser", async () => {
    const { readFileSync } = await import("node:fs");
    for (const f of [
      "lib/github/marks.ts",
      "lib/github/pins.ts",
      "lib/github/peaks.ts",
      "lib/content/role-span.ts",
    ]) {
      const src = readFileSync(f, "utf8");
      const valueImports = [...src.matchAll(/^import (?!type)[^;]*from "([^"]+)"/gm)].map((m) => m[1]);
      for (const i of valueImports)
        expect(i, `${f} imports ${i}`).not.toMatch(
          /content\/profile|content\/roles|content\/milestones|profile-schema|zod/,
        );
    }
  });
});
