import { describe, expect, it } from "vitest";
import { buildPaletteGroups } from "@/components/palette/commands";
import { filterGroups, rankInput } from "@/lib/grid/route-input";

const groups = buildPaletteGroups();
const ids = (r: ReturnType<typeof rankInput>) => r.groups.flatMap((g) => g.items.map((i) => i.id));

describe("Omnibar input routing", () => {
  it("an empty input shows everything and offers GRID first", () => {
    const r = rankInput("", groups);
    expect(r).toMatchObject({ ask: null, askFirst: true, best: null, commandsOnly: false });
    expect(r.groups).toEqual(groups);
  });

  it.each([
    ["work", "nav-work"],
    ["experience", "nav-experience"],
    ["contact", "nav-contact"],
    ["linkedin", "act-linkedin"],
    ["copy email", "act-copy-email"],
    ["match a job", "act-match"],
    ["résumé", "nav-resume"],
    ["resume", "nav-resume"],
  ])("'%s' is a command: it comes first, GRID is still offered", (typed, id) => {
    const r = rankInput(typed, groups);
    expect(r.best?.id).toBe(id);
    expect(r.askFirst).toBe(false);
    expect(r.ask).toBe(typed);
  });

  it.each([
    "What has he built with Spring Boot?",
    "Where did he study?",
    "work experience at kaha technologies",
    "tell me about his awards",
    "is he available",
  ])("'%s' is a question: GRID is first", (typed) => {
    const r = rankInput(typed, groups);
    expect(r.askFirst).toBe(true);
    expect(r.ask).toBe(typed);
  });

  it("a short word that only appears somewhere inside a command does not hijack Enter", () => {
    // 'in' is inside 'LinkedIn', but it is not what the command is called
    const r = rankInput("in", groups);
    expect(r.best).toBeNull();
    expect(r.askFirst).toBe(true);
  });

  it("'>' is commands only: no question row, filtered by what follows", () => {
    const r = rankInput(">contact", groups);
    expect(r).toMatchObject({ ask: null, askFirst: false, commandsOnly: true });
    expect(ids(r)).toContain("nav-contact");
    const none = rankInput("> zzzz", groups);
    expect(none.groups).toEqual([]);
    expect(none.best).toBeNull();
  });

  it("'?' always asks GRID, whatever it looks like", () => {
    const r = rankInput("?contact", groups);
    expect(r).toMatchObject({ ask: "contact", askFirst: true, groups: [], best: null });
    expect(rankInput("?", groups).ask).toBeNull();
  });

  it("filtering needs every word and ignores accents and case", () => {
    expect(filterGroups(groups, "COPY Email").flatMap((g) => g.items.map((i) => i.id))).toEqual([
      "act-copy-email",
    ]);
    expect(filterGroups(groups, "RÉSUMÉ").flatMap((g) => g.items.map((i) => i.id))).toContain("nav-resume");
    expect(filterGroups(groups, "   ")).toEqual(groups);
  });
});
