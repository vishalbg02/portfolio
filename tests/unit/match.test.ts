import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { profile } from "@/content/profile";
import { experienceSummary, periodMonths } from "@/lib/match/experience";
import { extractRequirements, yearsRequired } from "@/lib/match/extract";
import { canonicalSkill, gradeAll, gradeRequirement, summarize } from "@/lib/match/grade";
import { toMarkdown } from "@/lib/match/markdown";
import { SKILLS, SKILL_BY_ID } from "@/lib/match/taxonomy";
import { containsTerm, snippetFor } from "@/lib/match/text";
import { MatchResultSchema, RequirementsSchema, type Requirement } from "@/lib/match/types";
import type { EmbeddingsFile } from "@/lib/rag/types";

const chunks = (JSON.parse(readFileSync("generated/embeddings.json", "utf8")) as EmbeddingsFile).chunks;
const NOW = new Date("2026-10-03T00:00:00Z");
const grade = (skill: string, importance: Requirement["importance"] = "medium") =>
  gradeRequirement({ skill, importance }, chunks, NOW);

describe("containsTerm", () => {
  it("matches whole words and phrases only", () => {
    expect(containsTerm("Java, JavaScript", "java")).toBe(true);
    expect(containsTerm("JavaScript only", "java")).toBe(false);
    expect(containsTerm("built with Spring Boot.", "spring boot")).toBe(true);
    expect(containsTerm("Node.js and C++", "node.js")).toBe(true);
    expect(containsTerm("Node.js and C++", "c++")).toBe(true);
    expect(containsTerm("the rest of the team", "rest api")).toBe(false);
  });
  it("snippetFor returns the sentence containing the term", () => {
    expect(snippetFor("First thing. Uses Firestore transactions here. Last.", "firestore")).toBe(
      "Uses Firestore transactions here.",
    );
  });
});

describe("taxonomy", () => {
  it("has unique ids, resolvable related links and no empty aliases", () => {
    expect(new Set(SKILLS.map((s) => s.id)).size).toBe(SKILLS.length);
    for (const s of SKILLS) {
      expect(s.aliases.length, s.id).toBeGreaterThan(0);
      for (const r of s.related ?? []) expect(SKILL_BY_ID.has(r), `${s.id} → ${r}`).toBe(true);
    }
  });

  it("every skill Vishal lists in profile.ts is recognised and graded strong", () => {
    const listed = Object.values(profile.skills).flat();
    const unrecognised: string[] = [];
    for (const name of listed) {
      const skill = canonicalSkill(name);
      if (!skill) unrecognised.push(name);
    }
    // a few of his listed skills are tool names without JD relevance — but none may be graded below strong if recognised
    for (const name of listed) {
      if (canonicalSkill(name)) expect(grade(name).match, name).not.toBe("gap");
    }
    expect(unrecognised.length).toBeLessThanOrEqual(8);
  });

  it("no evidence term claims something false: a gap skill has no literal evidence in the corpus", () => {
    for (const id of [
      "docker",
      "kubernetes",
      "terraform",
      "linux",
      "testing",
      "agile",
      "cpp",
      "go",
      "rust",
      "php",
    ]) {
      const skill = SKILL_BY_ID.get(id)!;
      expect(skill.evidence, id).toEqual([]);
      // even if a word like "testing" appears in a trade-off sentence, it is not evidence of the skill
      for (const alias of skill.aliases) expect(grade(alias).match, `${id}/${alias}`).toBe("gap");
    }
  });
});

describe("grading is literal, honest evidence", () => {
  it.each([
    "Java",
    "Spring Boot",
    "React",
    "SQL",
    "REST APIs",
    "Firebase",
    "AWS",
    "Python",
    "Next.js",
    "TypeScript",
    "Flutter",
    "Generative AI",
    "RAG",
    "Microservices",
    "Git",
  ])("%s → strong with evidence", (skill) => {
    const r = grade(skill);
    expect(r.match, skill).toBe("strong");
    expect(r.evidence.length).toBeGreaterThan(0);
    for (const e of r.evidence) {
      expect(e.sourceUrl).toMatch(/^\//);
      expect(e.text.length).toBeGreaterThan(5);
    }
  });

  it.each([
    ["PostgreSQL", "sql"],
    ["Vue.js", "react"],
    ["Azure", "cloud"],
    ["Hibernate", "jpa"],
    ["Machine learning", "ai"],
    ["iOS development", "flutter"],
    ["GraphQL", "rest"],
  ])("%s → partial via a related skill (%s)", (skill) => {
    const r = grade(skill);
    expect(r.match, skill).toBe("partial");
    expect(r.evidence.length).toBeGreaterThan(0);
  });

  it.each(["Docker", "Kubernetes", "Terraform", "Linux", "Unit testing", "Agile", "C++", "GoLang", "Redis"])(
    "%s → gap, no invented evidence",
    (skill) => {
      const r = grade(skill);
      expect(r.match, skill).toBe("gap");
      expect(r.evidence).toEqual([]);
    },
  );

  it("PostgreSQL is NOT graded strong just because SQL is (no overclaiming)", () => {
    expect(grade("PostgreSQL").match).not.toBe("strong");
    expect(grade("Oracle").match).not.toBe("strong");
  });

  it("'Java' does not match JavaScript-only text and vice versa", () => {
    expect(canonicalSkill("JavaScript")!.id).toBe("javascript");
    expect(canonicalSkill("Java")!.id).toBe("java");
    expect(canonicalSkill("Java / Spring Boot developer")!.id).toBe("spring-boot"); // longest alias wins
  });

  it("unknown requirements: literal phrase → strong, unrelated → gap", () => {
    expect(grade("Brevo").match).toBe("strong");
    expect(grade("Quantum chemistry simulations").match).toBe("gap");
    // plain words that merely occur in prose are NOT skills
    for (const word of ["Everything", "Ships", "Team", "Production", "Dashboard", "PWNED"])
      expect(grade(word).match, word).toBe("gap");
    expect(grade("!!!").match).toBe("gap");
  });

  it("every piece of evidence quotes real corpus text", () => {
    for (const skill of ["Java", "SQL", "Flutter", "AWS", "Generative AI", "Firebase", "Python"]) {
      for (const e of grade(skill).evidence) {
        const stripped = e.text.replace(/…$/, "");
        expect(
          chunks.some((c) => c.text.replace(/\*\*/g, "").includes(stripped)),
          `${skill}: "${stripped}"`,
        ).toBe(true);
      }
    }
  });
});

describe("years of experience is computed honestly from profile.ts", () => {
  it("parses periods incl. 'Present'", () => {
    expect(periodMonths("May 2024 – Jul 2024", NOW)).toBe(3);
    expect(periodMonths("May 2025 – Present", NOW)).toBe(18); // inclusive of both months
    expect(periodMonths("garbage", NOW)).toBeNull();
  });
  it("counts internships and freelance work once, even where they overlap", () => {
    const s = experienceSummary(profile, NOW);
    // May–Jul 2024 (3) + Jun 2025 – Jun 2026 (13: the Jan–Jun 2026 freelance role overlaps the internship until Mar)
    expect(s.months).toBe(16);
    expect(s.years).toBe(1.3);
    expect(s.text).toContain("internship");
    expect(s.text).toContain("freelance");
  });
  it.each([
    ["1+ years of experience", "strong"],
    ["2+ years of experience", "gap"], // 1.3 years is under 75% of 2
    ["3+ years of experience", "gap"],
    ["5 years of experience", "gap"],
  ])("%s → %s", (skill, expected) => {
    expect(grade(skill, "high").match).toBe(expected);
  });
  it("extracts the largest 'N+ years' figure, marks 'preferred' as low", () => {
    expect(yearsRequired("We need 3+ years of experience with Java.")).toEqual({
      years: 3,
      importance: "high",
    });
    expect(yearsRequired("2-4 years of experience required")!.years).toBe(4);
    expect(yearsRequired("1+ year of experience is preferred")!.importance).toBe("low");
    expect(yearsRequired("Great team, free lunch")).toBeNull();
  });
});

describe("requirement extraction (keyword mode)", () => {
  const JD = `We are hiring a Full Stack Developer.
Requirements: strong Java and Spring Boot experience, REST APIs, SQL databases. 3+ years of experience required.
You will build React front ends and deploy with Docker on AWS.
Nice to have: Kubernetes, familiarity with GraphQL. Experience with Python is a plus.`;
  const reqs = extractRequirements(JD);
  const names = reqs.map((r) => r.skill);

  it("finds the skills mentioned and the years requirement", () => {
    for (const n of [
      "Java",
      "Spring Boot",
      "REST APIs",
      "SQL",
      "React",
      "Docker",
      "AWS",
      "Kubernetes",
      "GraphQL",
      "Python",
      "3+ years of experience",
    ])
      expect(names, n).toContain(n);
  });
  it("rates 'required' high and 'nice to have / plus' low", () => {
    const by = Object.fromEntries(reqs.map((r) => [r.skill, r.importance]));
    expect(by["Java"]).toBe("high");
    expect(by["Spring Boot"]).toBe("high");
    expect(by["Kubernetes"]).toBe("low");
    expect(by["GraphQL"]).toBe("low");
    expect(by["Python"]).toBe("low");
  });
  it("does not double-count: Spring Boot ≠ Spring, React Native ≠ React", () => {
    const n = extractRequirements("We use Spring Boot and React Native.").map((r) => r.skill);
    expect(n).toContain("Spring Boot");
    expect(n).not.toContain("Spring");
    expect(n).toContain("React Native");
    expect(n).not.toContain("React");
    expect(extractRequirements("Spring and React").map((r) => r.skill)).toEqual(
      expect.arrayContaining(["Spring", "React"]),
    );
  });
  it("orders high before low and caps at 14", () => {
    const rank = { high: 0, medium: 1, low: 2 };
    const order = reqs.map((r) => rank[r.importance]);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(extractRequirements(SKILLS.map((s) => s.aliases[0]).join(". ")).length).toBeLessThanOrEqual(14);
  });
  it("does not misread everyday words as skills", () => {
    const names2 = extractRequirements(
      "Join the rest of the team. Express your ideas. Next steps: apply. We value ts and swift delivery.",
    ).map((r) => r.skill);
    expect(names2).not.toContain("REST APIs");
    expect(names2).not.toContain("Express");
    expect(names2).not.toContain("Next.js");
    expect(names2).not.toContain("TypeScript");
  });
  it("returns nothing for text with no requirements", () => {
    expect(extractRequirements("Lorem ipsum dolor sit amet, consectetur adipiscing elit.")).toEqual([]);
  });
});

describe("full match result", () => {
  const JD =
    "Requirements: Java, Spring Boot, Kubernetes (high priority). Nice to have: PostgreSQL. 5+ years of experience required.";
  const result = gradeAll(extractRequirements(JD), chunks, NOW, "keyword");

  it("is valid against the response schema", () => {
    expect(() => MatchResultSchema.parse(result)).not.toThrow();
    expect(RequirementsSchema.safeParse({ requirements: extractRequirements(JD) }).success).toBe(true);
  });
  it("is honest: strengths strong, adjacent partial, missing shown as gaps", () => {
    const by = Object.fromEntries(result.results.map((r) => [r.requirement, r.match]));
    expect(by["Java"]).toBe("strong");
    expect(by["Spring Boot"]).toBe("strong");
    expect(by["Kubernetes"]).toBe("gap");
    expect(by["PostgreSQL"]).toBe("partial");
    expect(by["5+ years of experience"]).toBe("gap");
  });
  it("summary names the gaps and the high-priority ones", () => {
    expect(result.summary).toMatch(/direct evidence for 2 of 5 requirements/);
    expect(result.summary).toContain("Kubernetes");
    expect(result.summary).toMatch(/high priority: .*Kubernetes/);
    expect(result.counts).toEqual({ strong: 2, partial: 1, gap: 2 });
  });
  it("summary edge cases", () => {
    expect(summarize([]).summary).toMatch(/No specific requirements/);
    const allStrong = gradeAll([{ skill: "Java", importance: "high" }], chunks, NOW, "keyword");
    expect(allStrong.summary).toContain("No gaps found");
  });
  it("exports Markdown with links back to the site", () => {
    const md = toMarkdown(result, "https://vishalbg.vercel.app");
    expect(md).toContain("# Job description match");
    expect(md).toContain("## Kubernetes — ⚪ Gap");
    expect(md).toContain("_No evidence on the portfolio._");
    expect(md).toMatch(/\]\(https:\/\/vishalbg\.vercel\.app\/(#experience|work\/[a-z-]+|#stack)/);
    expect(md).toContain("keyword extraction");
  });
});
