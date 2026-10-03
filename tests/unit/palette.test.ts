import { describe, expect, it } from "vitest";
import { buildPaletteGroups } from "@/components/palette/commands";
import { profile } from "@/content/profile";
import { shipped } from "@/lib/site";

const items = () => buildPaletteGroups().flatMap((g) => g.items);

describe("palette registry", () => {
  it("has Navigate and Actions groups, with ids unique across the palette", () => {
    const groups = buildPaletteGroups();
    expect(groups.map((g) => g.heading)).toEqual(expect.arrayContaining(["Navigate", "Actions"]));
    const ids = items().map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("offers every contact action from the profile", () => {
    const byId = Object.fromEntries(items().map((i) => [i.id, i.action]));
    expect(byId["act-copy-email"]).toMatchObject({ type: "copy", text: profile.contact.email });
    expect(byId["act-copy-phone"]).toMatchObject({ type: "copy", text: profile.contact.phone });
    expect(byId["act-call"]).toMatchObject({ type: "tel", href: profile.contact.phoneHref });
    expect(byId["act-whatsapp"]).toMatchObject({ type: "external", href: profile.contact.whatsapp });
    expect(byId["act-linkedin"]).toMatchObject({ type: "external", href: profile.contact.linkedin });
    expect(byId["act-github"]).toMatchObject({ type: "external", href: profile.contact.github });
    expect(byId["act-resume"]).toMatchObject({ type: "download" });
  });

  it("never links to a route that has not shipped", () => {
    const internal = items()
      .map((i) => i.action)
      .filter((a): a is { type: "route"; href: string } => a.type === "route")
      .map((a) => a.href);
    const allowed = ["/", "/#work", "/#experience", "/#contact"];
    if (shipped.resume) allowed.push("/resume", "/resume#match");
    for (const href of internal) {
      if (allowed.includes(href)) continue;
      if (href.startsWith("/work/")) expect(shipped.caseStudies).toBe(true);
      else if (href === "/log") expect(shipped.log).toBe(true);
      else if (href === "/now") expect(shipped.now).toBe(true);
      else throw new Error(`Unexpected route in palette: ${href}`);
    }
  });

  it("only lists live-site entries for projects that have a live URL", () => {
    const live = items().filter((i) => i.id.endsWith("-live"));
    expect(live.map((i) => i.id).sort()).toEqual(
      profile.projects
        .filter((p) => p.live)
        .map((p) => `proj-${p.slug}-live`)
        .sort(),
    );
  });

  it("hides terminal and recruiter actions until they ship", () => {
    const ids = items().map((i) => i.id);
    expect(ids.includes("act-terminal")).toBe(shipped.terminal);
    expect(ids.includes("act-recruiter")).toBe(shipped.recruiter);
  });
});
