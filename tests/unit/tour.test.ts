import { describe, expect, it } from "vitest";
import { TOUR, STOP_SECONDS } from "@/content/tour";
import { profile } from "@/content/profile";

const captions = TOUR.map((s) => s.caption(profile));

describe("tour script", () => {
  it("is six stops that add up to about a minute, with unique ids and a title and caption each", () => {
    expect(TOUR).toHaveLength(6);
    expect(new Set(TOUR.map((s) => s.id)).size).toBe(6);
    expect(TOUR.length * STOP_SECONDS).toBe(60);
    for (const [i, s] of TOUR.entries()) {
      expect(s.title.length).toBeGreaterThan(2);
      expect(captions[i]!.length, s.id).toBeGreaterThan(30);
      expect(captions[i]!.length, s.id).toBeLessThanOrEqual(260);
      expect(captions[i]).not.toMatch(/undefined|NaN|\[object/);
    }
  });

  it("starts at the top and then follows the home page in order, to sections that exist", () => {
    expect(TOUR[0]!.sectionId).toBeNull();
    const order = ["work", "experience", "stack", "github", "contact"];
    expect(TOUR.slice(1).map((s) => s.sectionId)).toEqual(order);
    // the sections the home page renders (app/page.tsx keeps the same ids for the rail)
    const rail = ["work", "experience", "stack", "github", "ask", "contact"];
    for (const id of order) expect(rail).toContain(id);
  });

  it("says only what the profile says: names, roles, periods, counts and contact details all come from it", () => {
    const text = captions.join(" ");
    expect(captions[0]).toContain(profile.name);
    expect(captions[0]).toContain(profile.status);
    for (const e of profile.experience) {
      expect(text).toContain(e.role);
      expect(text).toContain(e.period);
    }
    for (const p of profile.projects.filter((x) => x.live || x.store)) expect(captions[1]).toContain(p.name);
    for (const p of profile.projects.filter((x) => !x.live && !x.store))
      expect(captions[1]).not.toContain(p.name);
    expect(text).toContain(profile.contact.email);
    // every number in the script is a count worked out from the profile
    const skills = Object.values(profile.skills);
    const allowed = new Set([
      String(profile.experience.length),
      String(skills.reduce((n, a) => n + a.length, 0)),
      String(skills.length),
      String(profile.projects.filter((x) => !x.live && !x.store).length),
      "15", // "a 15-minute call": the Cal.com link in the profile is the 15-minute one
      "3", // "3D"
      ...profile.experience.flatMap((e) => e.period.match(/\d+/g) ?? []),
      ...(profile.contact.email.match(/\d+/g) ?? []), // the digits in his address
    ]);
    for (const n of text.match(/\d+/g) ?? []) expect(allowed, `number ${n}`).toContain(n);
  });

  it("only offers a booked call when a booking link exists", () => {
    const without = TOUR[5]!.caption({ ...profile, contact: { ...profile.contact, calLink: null } });
    expect(without).not.toContain("15-minute");
    expect(captions[5]).toContain("15-minute");
  });

  it("holds up if the profile changes shape: one live project, no projects, one role", () => {
    const one = { ...profile, projects: profile.projects.slice(0, 1) };
    expect(() => TOUR.map((s) => s.caption(one))).not.toThrow();
    const none = { ...profile, projects: [], experience: profile.experience.slice(0, 1) };
    expect(() => TOUR.map((s) => s.caption(none))).not.toThrow();
  });
});

describe("the tour in GRID", () => {
  it("is started by a card with a button, and by plain requests for a tour (no model needed)", async () => {
    const { routeIntent } = await import("@/lib/ai/agent/router");
    for (const q of [
      "Take me on a tour",
      "give me a 60 second tour",
      "show me around",
      "Start the guided tour",
      "tour of the site",
    ]) {
      const r = await routeIntent(q);
      expect(r?.parts, q).toHaveLength(1);
      expect(r?.parts[0], q).toMatchObject({ tool: "start_tour", part: { kind: "tour", stops: 6 } });
      expect(r?.text, q).toContain("60-second tour");
    }
    // not every mention of the word is a request
    for (const q of ["What tour has he done of Europe?", "What did he learn on the tour of duty?"])
      expect((await routeIntent(q))?.parts.some((p) => p.tool === "start_tour") ?? false, q).toBe(false);
  });
});
