import { describe, expect, it } from "vitest";
import { profile } from "@/content/profile";
import { COMMAND_NAMES, commonPrefix, complete, findProject, run, tokenize } from "@/lib/terminal/commands";

const text = (input: string) =>
  run(input)
    .lines.map((l) => l.text)
    .join("\n");

describe("terminal parsing", () => {
  it("tokenizes with quotes", () => {
    expect(tokenize('echo "hello world"  x')).toEqual(["echo", "hello world", "x"]);
    expect(tokenize("   ")).toEqual([]);
  });
  it("empty input does nothing", () => {
    expect(run("   ")).toEqual({ lines: [] });
  });
});

describe("terminal commands", () => {
  it("help lists every visible command", () => {
    const t = text("help");
    for (const name of COMMAND_NAMES) expect(t).toContain(name);
  });

  it("answers from profile.ts", () => {
    expect(text("whoami")).toContain(profile.name);
    expect(text("contact")).toContain(profile.contact.email);
    expect(text("projects")).toContain("Talnio");
    expect(text("skills backend")).toContain("Spring Boot");
    expect(text("education")).toContain("CHRIST");
    for (const r of profile.recognition) expect(text("awards")).toContain(r.event);
  });

  it("status says he is not currently in a job and names the last role", () => {
    const t = text("status");
    expect(t).toMatch(/Not in a full-time job or internship/);
    expect(t).toContain("Social Agent");
    expect(t).toContain("Mar 2026");
    expect(t).toContain(profile.workPreferences.startDate);
  });

  it("unknown skill groups and projects are errors with hints", () => {
    expect(text("skills nope")).toMatch(/no group/);
    expect(text("open nope")).toMatch(/no such project/);
    expect(run("open").lines[0]!.tone).toBe("error");
  });

  it("open resolves projects by slug, name fragment and alias", () => {
    for (const q of ["talnio", "Golden", "gv", "lan", "tour", "virtual"]) {
      expect(findProject(q), q).toBeDefined();
    }
    expect(run("open gv").action).toEqual({ type: "navigate", href: "/work/golden-verdict" });
    expect(run("open resume").action).toEqual({ type: "navigate", href: "/resume" });
    expect(run("open recruiter").action).toEqual({ type: "navigate", href: "/recruiter" });
  });

  it("actions: copy, download, external, clear, exit, game, ask", () => {
    expect(run("email").action).toEqual({ type: "copy", text: profile.contact.email, label: "Email" });
    expect(run("resume").action).toMatchObject({ type: "download", filename: "Vishal_BG_Resume.pdf" });
    expect(run("cv").action).toMatchObject({ type: "download" });
    expect(run("github").action).toEqual({ type: "external", href: profile.contact.github });
    expect(run("clear").action).toEqual({ type: "clear" });
    expect(run("exit").action).toEqual({ type: "exit" });
    expect(run("quit").action).toEqual({ type: "exit" });
    expect(run("cosmostrike")).toMatchObject({
      action: { type: "game", name: "cosmostrike" },
      egg: "cosmostrike",
    });
    expect(run("ask").action).toEqual({ type: "ask" });
  });

  it("is case-insensitive and does not execute prototype properties", () => {
    expect(text("WHOAMI")).toContain(profile.name);
    expect(text("constructor")).toMatch(/command not found/);
    expect(text("__proto__")).toMatch(/command not found/);
    expect(text("toString")).toMatch(/command not found/);
  });

  it("suggests the nearest command for typos", () => {
    expect(text("projcts")).toContain('Did you mean "projects"');
    expect(text("zzzzzzzz")).toContain("Type help");
  });

  it("easter eggs", () => {
    expect(run("sudo hire vishal")).toMatchObject({
      action: { type: "navigate", href: "/#contact" },
      egg: "sudo-hire",
    });
    expect(text("sudo rm")).toMatch(/not in the sudoers file/);
    expect(run("rm -rf /").egg).toBe("rm-rf");
    expect(text("vim")).toMatch(/not installed/);
    expect(text("fortune")).toContain(profile.motto);
  });
});

describe("tab completion", () => {
  it("completes command names, projects and skill groups", () => {
    expect(complete("pro")).toEqual(["projects"]);
    expect(complete("c")).toEqual(expect.arrayContaining(["contact", "certs", "clear", "cosmostrike"]));
    expect(complete("open ta")).toEqual(["talnio"]);
    expect(complete("skills fro")).toEqual(["frontend"]);
    expect(complete("echo x")).toEqual([]);
  });
  it("finds the longest common prefix", () => {
    expect(commonPrefix(["contact", "certs", "clear", "cosmostrike"])).toBe("c");
    expect(commonPrefix(["projects"])).toBe("projects");
    expect(commonPrefix([])).toBe("");
  });
});
