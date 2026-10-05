import { describe, expect, it } from "vitest";
import { TOOL_NAMES } from "@/lib/ai/protocol";
import { TOOL_DONE, TOOL_WORKING } from "@/lib/grid/demo";
import {
  faceForPipeline,
  idlePipeline,
  pipelineReduce,
  type Pipeline,
  type StageSignal,
} from "@/lib/grid/stages";
import { briefPart } from "@/lib/ai/agent/cards";
import { routeIntent } from "@/lib/ai/agent/router";
import { profile } from "@/content/profile";

const run = (signals: StageSignal[]): Pipeline[] => {
  const out: Pipeline[] = [];
  let p = idlePipeline();
  for (const s of signals) out.push((p = pipelineReduce(p, s)));
  return out;
};

describe("the How GRID works strip (pipelineReduce)", () => {
  it("a router answer: route done, retrieval and ranking skipped, a tool, then the answer", () => {
    const steps = run([
      { kind: "question" },
      { kind: "stage", s: "route", state: "done" },
      { kind: "stage", s: "retrieve", state: "skip" },
      { kind: "stage", s: "rank", state: "skip" },
      { kind: "tool", name: "show_project", state: "running" },
      { kind: "tool", name: "show_project", state: "done" },
      { kind: "stage", s: "answer", state: "start" },
      { kind: "stage", s: "answer", state: "done" },
      { kind: "end" },
    ]);
    expect(steps[0]!.running).toBe(true);
    expect(steps[0]!.steps.question).toBe("done");
    expect(steps[4]!.tool).toBe("show_project");
    expect(steps[4]!.steps.tools).toBe("active");
    expect(faceForPipeline(steps[4]!)).toBe("acting");
    const last = steps.at(-1)!;
    expect(last).toMatchObject({ running: false, router: true, tool: null });
    expect(last.steps).toEqual({
      question: "done",
      route: "done",
      retrieve: "skip",
      rank: "skip",
      tools: "done",
      answer: "done",
    });
    expect(last.counts.tools).toBe(1);
    expect(faceForPipeline(last)).toBe("idle");
  });

  it("a model answer: counts from retrieval and ranking, no tool, so tools are skipped when the answer starts", () => {
    const steps = run([
      { kind: "question" },
      { kind: "stage", s: "route", state: "skip" },
      { kind: "stage", s: "retrieve", state: "start" },
      { kind: "stage", s: "retrieve", state: "done", n: 12 },
      { kind: "stage", s: "rank", state: "done", n: 5 },
      { kind: "stage", s: "answer", state: "start" },
      { kind: "stage", s: "answer", state: "done" },
      { kind: "end" },
    ]);
    expect(faceForPipeline(steps[2]!)).toBe("thinking");
    expect(steps[4]!.steps.tools).toBe("active"); // waiting for a tool call that may come
    expect(steps[5]!.steps.tools).toBe("skip");
    expect(faceForPipeline(steps[5]!)).toBe("speaking");
    const last = steps.at(-1)!;
    expect(last.router).toBe(false);
    expect(last.counts).toEqual({ retrieve: 12, rank: 5 });
    expect(last.steps.answer).toBe("done");
  });

  it("an error ends whatever was running as an error, never stuck lit", () => {
    const last = run([
      { kind: "question" },
      { kind: "stage", s: "route", state: "skip" },
      { kind: "stage", s: "retrieve", state: "start" },
      { kind: "end", error: true },
    ]).at(-1)!;
    expect(last.running).toBe(false);
    expect(last.steps.retrieve).toBe("error");
    expect(Object.values(last.steps)).not.toContain("active");
  });

  it("a new question starts from a clean strip", () => {
    const [, , again] = run([
      { kind: "question" },
      { kind: "stage", s: "retrieve", state: "done", n: 3 },
      { kind: "question" },
    ]);
    expect(again!.counts).toEqual({});
    expect(again!.steps.retrieve).toBe("idle");
  });
});

describe("tool lines", () => {
  it("every tool has a working line and a done line, so the chat never falls back to a generic one", () => {
    expect(Object.keys(TOOL_WORKING).sort()).toEqual([...TOOL_NAMES].sort());
    expect(Object.keys(TOOL_DONE).sort()).toEqual([...TOOL_NAMES].sort());
  });
});

describe("the brief card", () => {
  it("is built from content only: who, up to three proofs with links, fit for every core skill, how to reach him", () => {
    const b = briefPart();
    if (b.kind !== "brief") throw new Error("not a brief");
    expect(b.who).toContain(profile.name);
    expect(b.proofs.length).toBeGreaterThan(0);
    expect(b.proofs.length).toBeLessThanOrEqual(3);
    for (const p of b.proofs) expect(p.href).toMatch(/^\/(work\/|#)/);
    expect(b.fit.map((f) => f.skill)).toEqual(profile.targetRole.coreSkills);
    expect(b.reach.email).toBe(profile.contact.email);
    expect(b.role).toBe(profile.targetRole.title);
  });

  it("'Brief me in 30 seconds' is answered by the router with that card", async () => {
    const r = await routeIntent("Brief me in 30 seconds");
    expect(r?.parts?.map((p) => p.part.kind)).toEqual(["brief"]);
  });
});

describe("the Meet GRID deck", () => {
  // the same requests as components/sections/MeetGrid.tsx: all but the first are answered with no AI key
  it.each([
    ["Show me Talnio", "project"],
    ["Show me the Golden Verdict architecture", "diagram"],
    ["Play the LanSymphony walkthrough", "demo"],
    ["Where did he use Java?", "skill"],
    ["Tailor his résumé for a backend role", "resume"],
    ["I'd like to send Vishal a message", "confirm"],
  ])("%s → a %s card from the router", async (q, kind) => {
    const r = await routeIntent(q);
    expect(r?.parts?.map((p) => p.part.kind)).toContain(kind);
  });

  it("the message tile's card starts empty: nothing fake can reach Vishal", async () => {
    const r = await routeIntent("I'd like to send Vishal a message");
    const c = r?.parts?.[0]?.part;
    expect(c).toMatchObject({ kind: "confirm", name: "", email: "" });
  });
});
