import { describe, expect, it } from "vitest";
import { profile } from "@/content/profile";
import { buildStackGroups, projectsUsing } from "@/lib/stack/usage";

describe("stack → project usage", () => {
  it.each([
    ["React", ["talnio", "virtual-tour"]],
    ["Next.js", ["golden-verdict"]],
    ["TypeScript", ["golden-verdict", "virtual-tour"]],
    ["Tailwind CSS", ["golden-verdict", "talnio"]],
    ["Firebase", ["golden-verdict", "talnio"]],
    ["Firestore", ["golden-verdict", "talnio"]],
    ["Flutter", ["talnio"]],
    ["Dart", ["talnio"]],
    ["Three.js", ["virtual-tour"]],
    ["Vercel", ["virtual-tour"]],
    ["Generative AI APIs", ["talnio"]],
  ])("%s → %j", (skill, expected) => {
    expect(projectsUsing(skill)).toEqual(expected);
  });

  it("does not credit React Native to React projects", () => {
    expect(projectsUsing("React Native")).toEqual([]);
  });

  it("returns nothing for skills no listed project uses (no invented links)", () => {
    for (const skill of ["Java", "Spring Boot", "MongoDB", "AWS", "Maven", "Angular"]) {
      expect(projectsUsing(skill), skill).toEqual([]);
    }
  });

  it("covers every skill in profile.ts exactly once, in six groups", () => {
    const groups = buildStackGroups();
    expect(groups.map((g) => g.label)).toEqual([
      "Backend",
      "Frontend",
      "Mobile",
      "Data & Cloud",
      "AI",
      "Tools",
    ]);
    const all = groups.flatMap((g) => g.items.map((i) => i.name));
    expect(all).toEqual(Object.values(profile.skills).flat());
  });
});
