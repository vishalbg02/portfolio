import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Audit of the analytics contract: every event the spec lists is emitted somewhere, nothing is
 * emitted that isn't in the list, and no call site passes obviously personal data.
 */
const EVENTS = [
  "resume_download",
  "recruiter_mode_on",
  "palette_open",
  "copy_email",
  "copy_phone",
  "chat_question",
  "jd_match_run",
  "project_live_click",
  "contact_submit",
  "easter_egg_found",
  // V2
  "rail_jump",
  "work_select",
  "hero_terminal_command",
  "hero_row_expand",
  "dock_tap",
  "milestone_open",
  "demo_launch",
  "demo_step",
  "project_ask",
  "proof_jump",
  "stack_skill_select",
];

function* files(dir: string): Generator<string> {
  for (const f of readdirSync(dir)) {
    const full = path.join(dir, f);
    if (statSync(full).isDirectory()) yield* files(full);
    else if (/\.(ts|tsx)$/.test(f)) yield full;
  }
}
const sources = ["app", "components", "lib"]
  .flatMap((d) => [...files(path.join(process.cwd(), d))])
  .filter((f) => !f.endsWith(path.join("lib", "analytics.ts")))
  .map((f) => ({ f, text: readFileSync(f, "utf8") }));

describe("analytics audit", () => {
  it("the type lists exactly the specified events", () => {
    const type = readFileSync("lib/analytics.ts", "utf8");
    const declared = [...type.matchAll(/\| "([a-z_]+)"/g)].map((m) => m[1]);
    expect(declared.sort()).toEqual([...EVENTS].sort());
  });

  it.each(EVENTS)("%s is emitted from at least one place", (event) => {
    const hit = sources.some(({ text }) => new RegExp(`["']${event}["']`).test(text));
    expect(hit, `${event} is never emitted`).toBe(true);
  });

  it("no track() call or data-track-* attribute carries email, phone or free text (event names like easter-egg ids are fine)", () => {
    for (const { f, text } of sources) {
      for (const m of text.matchAll(/track\("[a-z_]+",\s*\{([^}]*)\}/g)) {
        expect(m[1], `${f}: ${m[0]}`).not.toMatch(/\b(email|phone|message|text|value|query|question)\s*:/i);
      }
      expect(text, f).not.toMatch(/data-track-(email|phone|message|name)/);
    }
  });
});
