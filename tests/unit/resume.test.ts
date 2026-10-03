import { renderToBuffer } from "@react-pdf/renderer";
import { extractText, getDocumentProxy } from "unpdf";
import { beforeAll, describe, expect, it } from "vitest";
import { profile } from "@/content/profile";
import { resumeConfig } from "@/content/resume";
import { ResumeDocument } from "@/lib/resume/ResumeDocument";
import {
  RESUME_FILENAME,
  RESUME_SECTION_TITLES,
  buildResumeModel,
  parseCertification,
} from "@/lib/resume/model";
import { ResumeConfigSchema } from "@/lib/resume/config-schema";
import { smart } from "@/lib/text/typography";

const model = buildResumeModel();
const norm = (s: string) => s.replace(/\s+/g, " ").toLowerCase().replace(/×/g, "x");

describe("résumé config stays in step with profile.ts", () => {
  it("validates against its schema", () => {
    expect(() => ResumeConfigSchema.parse(resumeConfig)).not.toThrow();
  });

  it("covers every project: either on the résumé or explicitly omitted with a reason", () => {
    const listed = new Set([
      ...resumeConfig.projects.map((p) => p.slug),
      ...resumeConfig.omittedProjects.map((p) => p.slug),
    ]);
    for (const p of profile.projects) {
      expect(
        listed.has(p.slug),
        `Project "${p.name}" is in profile.ts but not in content/resume.ts (add it to projects or omittedProjects)`,
      ).toBe(true);
    }
    const onResume = resumeConfig.projects.map((p) => p.slug);
    expect(new Set(onResume).size).toBe(onResume.length);
    for (const o of resumeConfig.omittedProjects) expect(onResume).not.toContain(o.slug);
  });

  it("lists every recognition entry from profile.ts under Achievements & Awards", () => {
    const text = norm(resumeConfig.achievements.map((a) => `${a.title} ${a.detail}`).join(" "));
    for (const r of profile.recognition) {
      expect(text, `Add "${r.event}" to achievements in content/resume.ts`).toContain(norm(r.event));
    }
    expect(resumeConfig.achievements).toHaveLength(profile.recognition.length);
  });

  it("covers the leadership entry", () => {
    for (const line of profile.leadership) {
      const key = line.split("—")[1]?.split(",")[0]?.trim() ?? line;
      expect(resumeConfig.leadership.map((l) => l.title).join(" ")).toContain(key.split(" ")[0]!);
    }
  });

  it("keeps the 'N-time podium finisher' claim equal to the number of awards", () => {
    const m = profile.summary.match(/(\d+)-time hackathon podium finisher/);
    expect(m, "summary no longer mentions podium finishes").not.toBeNull();
    expect(Number(m![1])).toBe(profile.recognition.length);
  });

  it("prints the college email by default and can switch to the primary one", () => {
    expect(model.contact[0]!.text).toBe(profile.contact.collegeEmail);
    const primary = buildResumeModel(profile, {
      ...resumeConfig,
      header: { ...resumeConfig.header, email: "primary" },
    });
    expect(primary.contact[0]!.text).toBe(profile.contact.email);
  });
});

describe("résumé model", () => {
  it("takes shared facts straight from profile.ts", () => {
    expect(model.name).toBe(profile.name);
    expect(model.summary).toBe(smart(profile.summary));
    expect(model.experience.map((e) => e.org)).toEqual(profile.experience.map((e) => smart(e.company)));
    expect(model.experience.map((e) => e.period)).toEqual(profile.experience.map((e) => e.period));
    expect(model.education.map((e) => e.school)).toEqual(profile.education.map((e) => e.school));
    expect(model.certifications).toHaveLength(profile.certifications.length);
    expect(RESUME_FILENAME).toBe("Vishal_BG_Resume.pdf");
  });

  it("parses certifications into title / issuer / year", () => {
    expect(parseCertification("AWS Academy Cloud Foundations — Amazon Web Services (2025)")).toEqual({
      title: "AWS Academy Cloud Foundations",
      org: "Amazon Web Services",
      year: "2025",
    });
    expect(() => parseCertification("Just a title")).toThrow(/Title — Issuer/);
  });

  it("uses curly apostrophes (boAt’s, not boAt's) and never touches URLs", () => {
    const text = JSON.stringify(model.experience);
    expect(text).toContain("boAt’s");
    expect(text).not.toContain("boAt's");
    expect(model.contact.find((c) => c.text.includes("linkedin"))!.href).toBe(profile.contact.linkedin);
  });

  it("keeps every character inside the built-in Helvetica (WinAnsi) range", () => {
    const allowed = new Set("–—‘’“”•…·×°€™♦".split(""));
    const text = JSON.stringify(model);
    const bad = [...text].filter((c) => c.charCodeAt(0) > 0xff && !allowed.has(c));
    expect(bad).toEqual([]);
    expect(text).not.toContain("♦"); // not in WinAnsi
  });

  it("smart() handles quotes", () => {
    expect(smart("boAt's")).toBe("boAt’s");
    expect(smart('say "hi"')).toBe("say “hi”");
    expect(smart("'quoted'")).toBe("‘quoted’");
    expect(smart("rock 'n' roll")).toBe("rock ‘n’ roll");
  });
});

describe("generated PDF", () => {
  let pdf: Uint8Array;
  let text: string;
  let pages: number;

  beforeAll(async () => {
    pdf = new Uint8Array(await renderToBuffer(ResumeDocument({ model })));
    const out = await extractText(await getDocumentProxy(pdf.slice()), { mergePages: true });
    text = out.text.replace(/\s+/g, " ");
    pages = out.totalPages;
  }, 60_000);

  it("is a real PDF that fits on ONE page", () => {
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
    expect(pages, "the résumé spilled onto a second page — trim content/resume.ts").toBe(1);
  });

  it("is ATS-friendly: real text and no images", () => {
    expect(text.length).toBeGreaterThan(1500);
    expect(new TextDecoder("latin1").decode(pdf)).not.toMatch(/\/Subtype\s*\/Image/);
  });

  it("keeps section headings extractable as whole words (no 'S U M M A R Y')", () => {
    for (const title of Object.values(RESUME_SECTION_TITLES)) {
      expect(text, `heading "${title}" is not extractable as one piece`).toContain(title.toUpperCase());
    }
  });

  it("lists the sections in the same order as the original résumé", () => {
    const order = Object.values(RESUME_SECTION_TITLES).map((t) => text.indexOf(t.toUpperCase()));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("contains every fact on the model", () => {
    const needles = [
      model.name,
      model.subtitle,
      ...model.contact.map((c) => c.text),
      model.summary,
      ...model.experience.flatMap((e) => [e.org, e.period, e.role, ...e.bullets]),
      ...model.projects.flatMap((p) => [p.title, p.stack, p.date, ...p.bullets]),
      ...model.skills.map((g) => g.text),
      ...model.certifications.flatMap((c) => [c.title, c.org, c.year]),
      ...model.leadership.flatMap((l) => [l.title, l.date, l.role, ...l.bullets]),
      ...model.achievements.flatMap((a) => [a.title, a.detail, a.date]),
      ...model.education.flatMap((e) => [e.school, e.period, e.line]),
    ];
    const hay = text.replace(/\s+/g, "");
    for (const n of needles) expect(hay, `missing from PDF: ${n}`).toContain(n.replace(/\s+/g, ""));
  });
});
