import { describe, expect, it } from "vitest";
import { profile } from "@/content/profile";
import {
  buildStackGroups,
  buildUseNodes,
  elsewhere,
  projectsUsing,
  roleNodes,
  rolesUsing,
  usesSkill,
} from "@/lib/stack/usage";

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
    for (const skill of ["Java", "Spring Boot", "MongoDB", "AWS", "Maven", "AngularJS"]) {
      expect(projectsUsing(skill), skill).toEqual([]);
    }
  });

  it("covers every skill in profile.ts exactly once, in seven groups", () => {
    const groups = buildStackGroups();
    expect(groups.map((g) => g.label)).toEqual([
      "Backend",
      "Frontend",
      "Mobile",
      "Data & Cloud",
      "AI",
      "Networking & security",
      "Tools",
    ]);
    const all = groups.flatMap((g) => g.items.map((i) => i.name));
    expect(all).toEqual(Object.values(profile.skills).flat());
  });
});

describe("roles on the Stack map", () => {
  it("a role's stack only names what its own description says (no invented links)", () => {
    const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9+]+/g, "");
    for (const job of profile.experience) {
      const text = norm(job.points.join(" "));
      for (const item of job.stack) expect(text, `${job.short}: ${item}`).toContain(norm(item));
    }
  });

  it("internships are their own nodes; the Golden Verdict role is its project, so it is not drawn twice", () => {
    expect(roleNodes().map((e) => e.short)).toEqual(["Social Agent", "Cove IoT"]);
    expect(buildUseNodes().map((n) => n.id)).toEqual([
      "golden-verdict",
      "talnio",
      "lansymphony",
      "virtual-tour",
      "role-socialagent",
      "role-coveiot",
    ]);
  });

  it("the Java side of his work is connected: Cove IoT used Java, Spring, MySQL, REST, microservices, AngularJS", () => {
    for (const skill of [
      "Java",
      "Spring Boot",
      "Spring Security",
      "Spring Data JPA",
      "REST APIs",
      "Microservices",
      "SQL/MySQL",
      "MySQL",
      "AngularJS",
    ]) {
      expect(rolesUsing(skill), skill).toEqual(["role-coveiot"]);
    }
    expect(usesSkill("SQL/MySQL", "MySQL")).toBe(true);
    expect(usesSkill("React", "React Native")).toBe(false);
  });

  it("LanSymphony uses Python and the networking group", () => {
    const used = buildStackGroups()
      .flatMap((g) => g.items)
      .filter((i) => i.used.includes("lansymphony"))
      .map((i) => i.name);
    expect(used).toEqual(["Python", "Socket programming", "Multithreading", "Encryption (Fernet)"]);
  });
});

describe("a skill nothing on the map used says where it comes from", () => {
  it("every skill is either connected or labelled", () => {
    for (const item of buildStackGroups().flatMap((g) => g.items)) {
      expect(item.used.length > 0 || item.elsewhere !== null, item.name).toBe(true);
      if (item.used.length) expect(item.elsewhere, item.name).toBeNull();
    }
  });

  it.each([
    ["React Native", "leadership"],
    ["Kotlin", "certification"],
    ["Android", "certification"],
    ["AWS", "certification"],
    ["RAG fundamentals", "site"],
    ["Git", "site"],
    ["C++", "coursework"],
    ["Node.js", "coursework"],
    ["MongoDB", "coursework"],
  ])("%s → %s", (skill, kind) => {
    expect(elsewhere(skill).kind).toBe(kind);
  });

  it("the coursework label reads 'Coursework & practice' and repeats Vishal's own note", () => {
    expect(elsewhere("C++").text).toBe(`Coursework & practice. ${profile.skillsNote}`);
  });
});
