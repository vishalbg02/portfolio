import { describe, expect, it } from "vitest";
import { profile, projectBySlug } from "@/content/profile";
import { ProfileSchema } from "@/lib/content/profile-schema";

describe("profile (single source of truth)", () => {
  it("parses against the schema", () => {
    expect(() => ProfileSchema.parse(profile)).not.toThrow();
  });

  it("has the four projects with unique slugs", () => {
    expect(profile.projects.map((p) => p.slug)).toEqual([
      "golden-verdict",
      "talnio",
      "lansymphony",
      "virtual-tour",
    ]);
  });

  it("keeps unknown values null instead of inventing them", () => {
    expect(profile.contact.calLink).toBeNull();
    expect(projectBySlug("talnio")?.live).toBeNull();
    expect(projectBySlug("lansymphony")?.repo).toBeNull();
    expect(projectBySlug("golden-verdict")?.period).toBe("Jan 2026 – Present"); // from his LinkedIn
    expect(projectBySlug("virtual-tour")?.period).toBe("Jan 2025"); // from his résumé
  });

  it("marks at most one experience as current", () => {
    expect(profile.experience.filter((e) => e.current).length).toBeLessThanOrEqual(1);
  });

  it("rejects duplicate project slugs", () => {
    const bad = { ...profile, projects: [...profile.projects.slice(0, 3), profile.projects[0]] };
    expect(ProfileSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects malformed contact data", () => {
    const bad = { ...profile, contact: { ...profile.contact, email: "not-an-email" } };
    expect(ProfileSchema.safeParse(bad).success).toBe(false);
  });
});
