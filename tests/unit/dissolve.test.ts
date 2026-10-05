import { describe, expect, it } from "vitest";
import { gridFor, noise } from "@/lib/fx/dissolve";
import { launchLiveEmbed } from "@/lib/work/live-embed";
import { EMBED_ORIGINS, EMBEDS, embedFor } from "@/lib/security/embeds";
import { profile } from "@/content/profile";
import { kindOf } from "@/lib/content/kind";

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

describe("live site launcher", () => {
  it("only frames allow-listed origins, which are the projects' own live URLs", () => {
    const live = profile.projects.flatMap((p) => (p.live ? [new URL(p.live).origin] : []));
    for (const origin of EMBED_ORIGINS) {
      // every allowed origin belongs to a project (Golden Verdict's apex redirects to www, so both are listed)
      expect(
        live.some((o) => o === origin || o.replace("://", "://www.") === origin),
        origin,
      ).toBe(true);
    }
    // refusals happen before any DOM is touched (no document in this environment)
    const slot = {} as HTMLElement;
    expect(launchLiveEmbed(slot, "https://evil.example/", "x")).toBe(false);
    expect(launchLiveEmbed(slot, "not a url", "x")).toBe(false);
    expect(launchLiveEmbed(slot, "javascript:alert(1)", "x")).toBe(false);
    expect(launchLiveEmbed(slot, "http://goldenverdict.com/", "x")).toBe(false);
  });

  it("gives each site its own sandbox, and never allows top navigation", () => {
    expect(embedFor("https://virtual-tour-opal.vercel.app/about")?.sandbox).toContain("allow-pointer-lock");
    expect(embedFor("https://www.goldenverdict.com/")?.sandbox).toBe(
      "allow-scripts allow-same-origin allow-forms allow-popups",
    );
    for (const e of EMBEDS) expect(e.sandbox).not.toContain("allow-top-navigation");
    expect(embedFor(null)).toBeNull();
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
