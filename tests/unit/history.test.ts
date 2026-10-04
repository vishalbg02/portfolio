import { describe, expect, it } from "vitest";
import { profile } from "@/content/profile";
import {
  branchName,
  buildGraph,
  commitId,
  educationTag,
  monthIndex,
  parsePeriod,
} from "@/lib/content/history";

describe("commitId", () => {
  it("is a stable 7-character hex id", () => {
    expect(commitId("hello")).toBe(commitId("hello"));
    expect(commitId("hello")).toMatch(/^[0-9a-f]{7}$/);
    expect(commitId("hello")).not.toBe(commitId("hello!"));
  });
  it("gives every commit on the site its own id", () => {
    const ids = profile.experience.flatMap((e) => e.points).map(commitId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("branchName", () => {
  it("slugs the company, dropping legal suffixes and the city", () => {
    expect(branchName("Golden Verdict, Bengaluru")).toBe("feat/golden-verdict");
    expect(branchName("Social Agent (Bricstal Pvt. Ltd.), Bengaluru")).toBe("feat/social-agent");
    expect(branchName("Kaha Technologies Pvt. Ltd. (Cove IoT), Bengaluru")).toBe("feat/kaha-technologies");
  });
});

describe("periods", () => {
  it("reads month-level dates", () => {
    expect(monthIndex("Jun 2025")).toBe(2025 * 12 + 5);
    expect(monthIndex("2026")).toBeNull();
  });
  it("reads closed and open periods", () => {
    expect(parsePeriod("Jun 2025 – Mar 2026")).toEqual({ start: 2025 * 12 + 5, end: 2026 * 12 + 2 });
    expect(parsePeriod("Jan 2026 – Present")).toEqual({ start: 2026 * 12, end: null });
  });
  it("fails loudly on something it can't read", () => {
    expect(() => parsePeriod("sometime")).toThrow();
  });
});

describe("buildGraph", () => {
  it("never claims an order the dates don't support (overlapping roles get their own lanes)", () => {
    const g = buildGraph([
      { period: "Jan 2026 – Present" },
      { period: "Jun 2025 – Mar 2026" },
      { period: "May 2024 – Jul 2024" },
    ]);
    expect(g.lanes).toBe(3);
    expect(g.rows.map((r) => `${r.kind}:${r.role}`)).toEqual([
      "open:0",
      "block:0",
      "merge:1", // Mar 2026
      "block:1",
      "fork:0", // Jan 2026: the freelance role started while the internship was still open
      "fork:1", // Jun 2025
      "merge:2", // Jul 2024
      "block:2",
      "fork:2", // May 2024
    ]);
    const lane = (kind: string, role: number) => g.rows.find((r) => r.kind === kind && r.role === role)!.lane;
    expect(lane("open", 0)).toBe(1);
    expect(lane("merge", 1)).toBe(2);
    expect(lane("merge", 2)).toBe(1); // lane 1 was released when role 0 forked
  });
  it("lists the other open branches as straight-through lines", () => {
    const g = buildGraph([{ period: "Jan 2026 – Present" }, { period: "Jun 2025 – Mar 2026" }]);
    expect(g.rows.find((r) => r.kind === "block" && r.role === 1)!.through).toEqual([{ lane: 1, role: 0 }]);
    expect(g.rows[0]!.through).toEqual([]);
  });
  it("labels merge and fork rows with the month", () => {
    const g = buildGraph([{ period: "Jun 2025 – Mar 2026" }]);
    expect(g.rows.map((r) => r.when)).toEqual(["Mar 2026", null, "Jun 2025"]);
  });
  it("lays out the real profile without throwing", () => {
    const g = buildGraph(profile.experience);
    expect(g.rows.filter((r) => r.kind === "block")).toHaveLength(profile.experience.length);
    expect(g.rows.filter((r) => r.kind === "open")).toHaveLength(
      profile.experience.filter((e) => e.current).length,
    );
  });
});

describe("educationTag", () => {
  it("uses the abbreviation and marks the degree in progress", () => {
    expect(educationTag({ degree: "Master of Computer Applications (MCA)", note: "Pursuing" })).toBe(
      "MCA (in progress)",
    );
    expect(educationTag({ degree: "Bachelor of Computer Applications (BCA)", note: "CGPA 8.45 / 10" })).toBe(
      "BCA",
    );
  });
});
