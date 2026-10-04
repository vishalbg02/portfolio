import { describe, expect, it } from "vitest";
import { sceneFor, sceneList } from "@/content/scenes";
import { mediaById } from "@/content/media";
import { profile } from "@/content/profile";
import { ScenesSchema } from "@/lib/content/scene-schema";

/** Everything profile.ts says about a project, lower-cased: the only text a claim may be built from. */
const evidence = (slug: string) => {
  const p = profile.projects.find((x) => x.slug === slug)!;
  const jobs = profile.experience.flatMap((e) => e.points).join(" ");
  const wins = profile.recognition.map((r) => `${r.event} ${r.place} ${r.detail ?? ""}`).join(" ");
  return [p.name, p.tagline, p.type, p.badge ?? "", p.summary, ...p.highlights, p.stack.join(" "), jobs, wins]
    .join(" ")
    .toLowerCase();
};

/** Content words, compared by their first five letters so "transactions" matches "transactional". */
const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9+\- ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 || /\d/.test(w));
const stem = (w: string) => w.slice(0, 5);

describe("scenes (content/scenes.ts)", () => {
  it("is valid and covers every project, in the profile's order", () => {
    expect(ScenesSchema.safeParse(sceneList).success).toBe(true);
    expect(sceneList.map((s) => s.slug)).toEqual(profile.projects.map((p) => p.slug));
  });

  it("every outcome and proof point is backed by profile.ts (no invented claims)", () => {
    for (const s of sceneList) {
      const ev = evidence(s.slug);
      const stems = new Set(words(ev).map(stem));
      for (const line of [s.outcome, ...s.proof]) {
        const missing = words(line).filter((w) => !stems.has(stem(w)));
        // a connective word or two is fine ("for", "side"); a missing fact is not
        expect(
          missing,
          `${s.slug}: "${line}" uses words profile.ts doesn't back: ${missing.join(", ")}`,
        ).toHaveLength(0);
      }
    }
  });

  it("every media reference exists, belongs to its project, and uses the right frame", () => {
    for (const s of sceneList) {
      for (const b of [...s.beats, { id: "hero", label: "", caption: "", media: s.hero }]) {
        if (b.media.type === "illustration") continue;
        const m = mediaById(b.media.id);
        expect(m, `${s.slug}/${b.id}: ${b.media.id}`).toBeDefined();
        expect(m!.slug).toBe(s.slug);
        expect(m!.kind).toBe(b.media.type);
        if (s.frame === "phone") expect(m!.frame).toBe("phone");
        if (s.frame === "browser") expect(m!.frame).toBe("browser");
      }
    }
  });

  it("is honest about illustrations: a scene with one says so, and a scene with only real captures does not need to", () => {
    for (const s of sceneList) {
      const illustrated = s.beats.some((b) => b.media.type === "illustration");
      if (illustrated) expect(s.illustrationNote, s.slug).toBeTruthy();
    }
    // Golden Verdict's private dashboards are never presented as captures
    const gv = sceneFor("golden-verdict")!;
    expect(gv.beats.filter((b) => b.media.type === "illustration").map((b) => b.id)).toEqual([
      "upload",
      "track",
    ]);
  });

  it("never claims what the brief wanted but profile.ts does not say (LanSymphony key exchange)", () => {
    const ls = sceneFor("lansymphony")!;
    const all = JSON.stringify(ls).toLowerCase();
    expect(all).not.toContain("key exchange");
  });
});
