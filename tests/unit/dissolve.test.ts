import { describe, expect, it } from "vitest";
import { gridFor, noise } from "@/lib/fx/dissolve";
import { launchLiveTour } from "@/lib/work/live-tour";
import { EMBED_ORIGINS } from "@/lib/security/embeds";
import { profile } from "@/content/profile";
import { kindOf } from "@/components/work/stage/Scene";

describe("pixel dissolve", () => {
  it("noise is stable, in [0, 1), and spread out (so the squares don't flip in a line)", () => {
    const a = Array.from({ length: 200 }, (_, i) => noise(i, 0));
    expect(a).toEqual(Array.from({ length: 200 }, (_, i) => noise(i, 0)));
    expect(a.every((n) => n >= 0 && n < 1)).toBe(true);
    const mean = a.reduce((s, n) => s + n, 0) / a.length;
    expect(mean).toBeGreaterThan(0.35);
    expect(mean).toBeLessThan(0.65);
    // the cover pass and the reveal pass use different patterns
    expect(Array.from({ length: 50 }, (_, i) => noise(i, 0))).not.toEqual(
      Array.from({ length: 50 }, (_, i) => noise(i, 1)),
    );
  });

  it("a coarse grid: as many 64px squares as fit, never fewer than 4 × 3", () => {
    expect(gridFor(1136, 800, 64)).toEqual({ cols: 18, rows: 13 });
    expect(gridFor(100, 50, 64)).toEqual({ cols: 4, rows: 3 });
  });
});

describe("live tour launcher", () => {
  it("only ever embeds the one allow-listed origin, and that origin is the project's live URL", () => {
    const tour = profile.projects.find((p) => p.slug === "virtual-tour")!;
    expect(EMBED_ORIGINS).toEqual([new URL(tour.live!).origin]);
    // refusals happen before any DOM is touched (no document in this environment)
    const slot = {} as HTMLElement;
    expect(launchLiveTour(slot, "https://evil.example/")).toBe(false);
    expect(launchLiveTour(slot, "not a url")).toBe(false);
    expect(launchLiveTour(slot, "javascript:alert(1)")).toBe(false);
  });
});

describe("scene eyebrow", () => {
  it("keeps as many leading parts of the project type as fit one line", () => {
    expect(kindOf("Freelance · Production")).toBe("Freelance · Production");
    expect(kindOf("Internship · Social Agent · Live on Google Play")).toBe("Internship · Social Agent");
    expect(kindOf("Personal · Built live at Windsurf × The AI Collective OpenBuild (2nd place)")).toBe(
      "Personal",
    );
    expect(kindOf("Personal")).toBe("Personal");
  });
});
